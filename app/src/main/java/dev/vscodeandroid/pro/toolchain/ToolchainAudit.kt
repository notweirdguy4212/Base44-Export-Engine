package dev.vscodeandroid.pro.toolchain

import android.os.Build
import java.io.File
import java.security.MessageDigest

/** Audits imported ELF binaries against the running device ABI; this is not a vendor signature check. */
object ToolchainAudit {
    data class Finding(val file: File, val sha256: String, val elfMachine: Int?, val abiMatch: Boolean?, val executable: Boolean, val notes: String)

    /** Rejects ELF binaries whose machine type is not reported by this device. Scripts remain dependency-unverified. */
    fun requireDeviceAbiCompatible(file: File) {
        val machine = readElfMachine(file.canonicalFile) ?: return
        val supported = Build.SUPPORTED_ABIS.mapNotNull(::abiToElfMachine).toSet()
        require(machine in supported) { "${file.name} has ELF machine $machine, which does not match this device's supported ABIs (${Build.SUPPORTED_ABIS.joinToString()})" }
    }

    fun inspect(file: File): Finding {
        val canonical = file.canonicalFile
        require(canonical.isFile && canonical.length() <= 1_073_741_824L) { "Toolchain file is missing or too large" }
        val digest = MessageDigest.getInstance("SHA-256")
        canonical.inputStream().use { input -> val buffer = ByteArray(64 * 1024); while (true) { val n = input.read(buffer); if (n < 0) break; digest.update(buffer, 0, n) } }
        val hash = digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
        val machine = readElfMachine(canonical)
        val expected = Build.SUPPORTED_ABIS.mapNotNull(::abiToElfMachine).toSet()
        val match = machine?.let { it in expected }
        val note = when {
            machine == null -> "Not an ELF executable; interpreter script or data file. Verify its shebang and dependencies separately."
            match == true -> "ELF architecture matches at least one ABI reported by this device. Dynamic libraries and runtime dependencies remain unverified."
            else -> "ELF architecture does not match the ABIs reported by this device. Do not execute on this device."
        }
        return Finding(canonical, hash, machine, match, canonical.canExecute(), note)
    }

    private fun readElfMachine(file: File): Int? = runCatching {
        file.inputStream().use { input ->
            val header = ByteArray(20)
            var offset = 0
            while (offset < header.size) { val n = input.read(header, offset, header.size - offset); if (n < 0) return null; offset += n }
            if (header[0] != 0x7f.toByte() || header[1] != 'E'.code.toByte() || header[2] != 'L'.code.toByte() || header[3] != 'F'.code.toByte()) return null
            val little = header[5].toInt() == 1
            val a = header[18].toInt() and 0xff; val b = header[19].toInt() and 0xff
            if (little) a or (b shl 8) else (a shl 8) or b
        }
    }.getOrNull()

    private fun abiToElfMachine(abi: String): Int? = when {
        abi.startsWith("arm64-v8a") -> 183
        abi.startsWith("armeabi") -> 40
        abi.startsWith("x86_64") -> 62
        abi.startsWith("x86") -> 3
        else -> null
    }
}
