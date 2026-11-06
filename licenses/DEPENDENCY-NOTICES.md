# Dependency license notices

This project incorporates or references the following third-party software. The list is based on the declared Gradle dependencies in this source tree and should be regenerated from the resolved dependency graph before a production release.

| Component | Declared version | License / notice |
|---|---|---|
| Sora Editor (`editor`, `language-textmate`) | 0.24.4 | LGPL-2.1-or-later; see `SORA_EDITOR_LGPL-2.1.txt` |
| Eclipse JGit | 6.10.0.202406032230-r | EPL-2.0; see `JGIT_EPL-2.0.txt` |
| AndroidX Activity Compose | 1.10.1 | Apache-2.0 |
| AndroidX Compose BOM / UI / Material 3 | 2025.02.00 | Apache-2.0 |
| AndroidX Lifecycle Runtime KTX | 2.8.7 | Apache-2.0 |
| AndroidX DocumentFile | 1.0.1 | Apache-2.0 |
| Kotlin Android / Compose compiler plugins | 2.1.0 | Apache-2.0 |
| Android Gradle Plugin | 8.9.2 | Apache-2.0 |
| JUnit | 4.13.2 | EPL-1.0 (with Classpath Exception) |
| desugar_jdk_libs | 2.1.5 | Apache-2.0 |

Apache-2.0 text: https://www.apache.org/licenses/LICENSE-2.0
EPL-1.0 text: https://www.eclipse.org/legal/epl-v10.html
JUnit 4 license and notice: https://github.com/junit-team/junit4/blob/main/LICENSE-junit.txt

A complete production distribution must generate an SBOM from the resolved dependency graph, include every transitive dependency's required notices, scan for license-policy conflicts and verify the exact artifacts that are shipped. This hand-maintained summary is not a substitute for that process.
