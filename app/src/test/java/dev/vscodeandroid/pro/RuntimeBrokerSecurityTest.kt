package dev.vscodeandroid.pro

import dev.vscodeandroid.pro.runtime.RuntimeBroker
import org.junit.Assert.*
import org.junit.Test
import java.nio.file.Files

class RuntimeBrokerSecurityTest {
    @Test fun rejectsUnsupportedRuntimeAndWorkspaceTraversal() {
        val root = Files.createTempDirectory("runtime-broker-test").toFile()
        try {
            val broker = RuntimeBroker(root)
            java.io.File(root, "workspaces/demo").mkdirs()
            java.io.File(root, "workspaces/outside.py").writeText("print('no')")
            assertThrows(IllegalArgumentException::class.java) { broker.run("shell", "demo", "outside.py") }
            assertThrows(IllegalArgumentException::class.java) { broker.run("python", "demo", "../outside.py") }
        } finally { root.deleteRecursively() }
    }

    @Test fun rejectsSymlinkThatEscapesWorkspace() {
        val root = Files.createTempDirectory("runtime-symlink-test").toFile()
        try {
            val workspaces = java.io.File(root, "workspaces")
            val project = java.io.File(workspaces, "demo").apply { mkdirs() }
            val outside = java.io.File(workspaces, "outside.py").apply { writeText("print('outside')") }
            val link = java.io.File(project, "escape.py")
            Files.createSymbolicLink(link.toPath(), outside.toPath())
            assertThrows(IllegalArgumentException::class.java) { RuntimeBroker(root).run("python", "demo", "escape.py") }
        } finally { root.deleteRecursively() }
    }

    @Test fun capsRuntimeOutputWithoutLoadingUnboundedLines() {
        val root = Files.createTempDirectory("runtime-output-test").toFile()
        try {
            val tools = java.io.File(root, "toolchains").apply { mkdirs() }
            val project = java.io.File(root, "workspaces/demo").apply { mkdirs() }
            java.io.File(project, "main.py").writeText("# source")
            val fakePython = java.io.File(tools, "python").apply {
                writeText("#!/bin/sh\nprintf '%02000d' 0\n")
                setExecutable(true)
            }
            assertTrue(fakePython.canExecute())
            val result = RuntimeBroker(root).run("python", "demo", "main.py", maxOutputBytes = 1024)
            assertEquals(0, result.exitCode)
            assertTrue(result.stdout.length < 1200)
            assertTrue(result.stdout.contains("output truncated"))
        } finally { root.deleteRecursively() }
    }
}
