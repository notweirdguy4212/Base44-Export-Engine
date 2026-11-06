package dev.vscodeandroid.pro.runtime

import android.app.Service
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Shell-only execution endpoint hosted under Android's isolated-process UID.
 * The isolated UID cannot read the app's private workspace/toolchain files or inherit app permissions.
 */
class IsolatedShellExecutionService : Service() {
    private val worker = Executors.newCachedThreadPool()
    private val messenger by lazy { Messenger(Handler(Looper.getMainLooper()) { message ->
        if (message.what != RUN) return@Handler false
        val reply = message.replyTo ?: return@Handler true
        val script = message.data.getString(SCRIPT).orEmpty()
        val timeout = message.data.getInt(TIMEOUT, 10).coerceIn(1, 30)
        worker.execute {
            val result = execute(script, timeout)
            val response = Message.obtain(null, RESULT).apply {
                data = Bundle().apply {
                    putInt(EXIT_CODE, result.exitCode)
                    putBoolean(TIMED_OUT, result.timedOut)
                    putString(STDOUT, result.stdout)
                    putString(STDERR, result.stderr)
                    putInt(EXECUTION_UID, result.executionUid)
                }
            }
            runCatching { reply.send(response) }
        }
        true
    }) }

    override fun onBind(intent: Intent?): IBinder = messenger.binder

    private data class Result(val exitCode: Int, val timedOut: Boolean, val stdout: String, val stderr: String, val executionUid: Int)

    private fun execute(script: String, timeoutSeconds: Int): Result {
        if (script.toByteArray(Charsets.UTF_8).size > MAX_SCRIPT_BYTES) return Result(126, false, "", "Script exceeds 256 KiB", android.os.Process.myUid())
        var process: Process? = null
        return try {
            val builder = ProcessBuilder("/system/bin/sh", "-s")
                .directory(java.io.File("/"))
                .apply {
                    environment().clear()
                    environment()["PATH"] = "/system/bin"
                    environment()["HOME"] = "/"
                }
            val started = builder.start()
            process = started
            val stdout = ByteArrayOutputStream()
            val stderr = ByteArrayOutputStream()
            val outThread = Thread { copyBounded(started.inputStream, stdout) }.apply { isDaemon = true; start() }
            val errThread = Thread { copyBounded(started.errorStream, stderr) }.apply { isDaemon = true; start() }
            started.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write("umask 077\n"); it.write(script); it.write("\n") }
            val finished = started.waitFor(timeoutSeconds.toLong(), TimeUnit.SECONDS)
            if (!finished) {
                started.destroyForcibly()
                runCatching { started.outputStream.close() }
                runCatching { started.inputStream.close() }
                runCatching { started.errorStream.close() }
            }
            outThread.join(500); errThread.join(500)
            Result(if (finished) started.exitValue() else 124, !finished,
                stdout.toString("UTF-8"), stderr.toString("UTF-8") + if (!finished) "\n[isolated shell timed out]" else "", android.os.Process.myUid())
        } catch (failure: Exception) {
            process?.destroyForcibly()
            Result(126, false, "", "Isolated execution failed: ${failure.message}", android.os.Process.myUid())
        }
    }

    private fun copyBounded(input: InputStream, output: ByteArrayOutputStream) {
        input.use {
            val buffer = ByteArray(8192)
            var total = 0
            while (true) {
                val n = it.read(buffer)
                if (n < 0) break
                val allowed = (MAX_OUTPUT_BYTES - total).coerceAtLeast(0)
                if (allowed > 0) output.write(buffer, 0, minOf(n, allowed))
                total += n
            }
            if (total > MAX_OUTPUT_BYTES) output.write("\n[output truncated at 512 KiB]".toByteArray())
        }
    }

    override fun onDestroy() {
        worker.shutdownNow()
        super.onDestroy()
    }

    companion object {
        const val RUN = 1
        const val RESULT = 2
        const val SCRIPT = "script"
        const val TIMEOUT = "timeout"
        const val EXIT_CODE = "exitCode"
        const val TIMED_OUT = "timedOut"
        const val STDOUT = "stdout"
        const val STDERR = "stderr"
        const val EXECUTION_UID = "executionUid"
        private const val MAX_SCRIPT_BYTES = 256 * 1024
        private const val MAX_OUTPUT_BYTES = 512 * 1024
    }
}
