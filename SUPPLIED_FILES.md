# Supplied source archive review

| User archive | What it contains | How used here |
|---|---|---|
| `vscode-main.zip` | Code-OSS 1.146.0 desktop source using Electron and a large pnpm/Gulp build | Reviewed package metadata and upstream license; documented integration constraints; MIT notice copied |
| `awesome-vscode-master.zip` | CC0 curated VS Code extensions, themes, language and productivity resource catalogue | Reviewed its categories and license; used as a planning/reference catalogue; CC0 notice copied |

The two large archives are not nested inside this deliverable to avoid shipping a redundant 100+ MB desktop source archive inside an Android starter. Keep the originals alongside this project for reference. A desktop extension being listed in the Awesome catalogue does not establish Android compatibility.
