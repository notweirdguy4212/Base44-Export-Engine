package dev.vscodeandroid.pro.runtime

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.os.Messenger
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/** Binds to the isolated-UID service and returns bounded shell output. */
object IsolatedShellRunner {
    data class Result(val exitCode: Int, val timedOut: Boolean, val stdout: String, val stderr: String, val executionUid: Int)

    suspend fun run(context: Context, script: String, timeoutSeconds: Int = 10): Result =
        suspendCancellableCoroutine { continuation ->
            val app = context.applicationContext
            var bound = false
            lateinit var connection: ServiceConnection
            val reply = Messenger(Handler(Looper.getMainLooper()) { message ->
                if (message.what == IsolatedShellExecutionService.RESULT && continuation.isActive) {
                    val data = message.data
                    val executionUid = data.getInt(IsolatedShellExecutionService.EXECUTION_UID, -1)
                    val appUid = android.os.Process.myUid()
                    val result = if (executionUid < 0 || executionUid == appUid) {
                        Result(126, false, "", "Isolation verification failed: runner UID is not distinct from the app UID", executionUid)
                    } else Result(
                        data.getInt(IsolatedShellExecutionService.EXIT_CODE, 126),
                        data.getBoolean(IsolatedShellExecutionService.TIMED_OUT),
                        data.getString(IsolatedShellExecutionService.STDOUT).orEmpty(),
                        data.getString(IsolatedShellExecutionService.STDERR).orEmpty(),
                        executionUid
                    )
                    continuation.resume(result)
                    if (bound) runCatching { app.unbindService(connection) }
                    bound = false
                }
                true
            })
            connection = object : ServiceConnection {
                override fun onServiceConnected(name: ComponentName, binder: android.os.IBinder) {
                    val request = Message.obtain(null, IsolatedShellExecutionService.RUN).apply {
                        data = Bundle().apply {
                            putString(IsolatedShellExecutionService.SCRIPT, script)
                            putInt(IsolatedShellExecutionService.TIMEOUT, timeoutSeconds.coerceIn(1, 30))
                        }
                        replyTo = reply
                    }
                    runCatching { Messenger(binder).send(request) }.onFailure {
                        if (continuation.isActive) continuation.resume(Result(126, false, "", "Unable to call isolated runner: ${it.message}", -1))
                        if (bound) runCatching { app.unbindService(connection) }
                        bound = false
                    }
                }
                override fun onServiceDisconnected(name: ComponentName) {
                    if (continuation.isActive) continuation.resume(Result(126, false, "", "Isolated runner disconnected", -1))
                }
            }
            bound = runCatching {
                app.bindService(Intent(app, IsolatedShellExecutionService::class.java), connection, Context.BIND_AUTO_CREATE)
            }.getOrDefault(false)
            if (!bound && continuation.isActive) continuation.resume(Result(126, false, "", "Unable to bind isolated execution service", -1))
            continuation.invokeOnCancellation { if (bound) runCatching { app.unbindService(connection) }; bound = false }
        }
}
