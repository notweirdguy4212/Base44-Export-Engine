package dev.vscodeandroid.pro

import dev.vscodeandroid.pro.workspace.WorkspaceRegistry
import org.junit.Assert.*
import org.junit.Test
import java.nio.file.Files

class WorkspaceRegistryTest {
    @Test fun createsRenamesAndDeletesIndependentProjects() {
        val root = Files.createTempDirectory("workspace-registry").toFile()
        try {
            val registry = WorkspaceRegistry(root)
            val project = registry.create("Mobile App")
            assertEquals("Mobile App", project.displayName)
            assertTrue(project.root.isDirectory)
            assertTrue(registry.list().any { it.id == project.id })
            val renamed = registry.rename(project.id, "Android Project")
            assertEquals("Android Project", renamed.displayName)
            registry.delete(project.id)
            assertFalse(renamed.root.exists())
            assertTrue(registry.list().any { it.id == "default" })
        } finally { root.deleteRecursively() }
    }

    @Test(expected = IllegalArgumentException::class)
    fun protectsDefaultProject() {
        val root = Files.createTempDirectory("workspace-registry-default").toFile()
        try { WorkspaceRegistry(root).delete("default") } finally { root.deleteRecursively() }
    }
}
