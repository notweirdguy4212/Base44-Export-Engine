# Notes on supplied upstream archives

## `vscode-main.zip`
The supplied source identifies itself as Code - OSS version `1.146.0`, with Electron as its native desktop runtime. The root package is a large pnpm/Node build with Gulp compilation and Electron-specific native build steps. It is useful as a reference for workbench behavior, editor architecture, extension contributions, language features and product configuration. It is not a ready-made Android Studio module.

The root upstream license is MIT; a copy of the license text is included in `licenses/CODE_OSS_LICENSE.txt`. This starter does not claim that its own Compose UI is the full Code-OSS workbench and does not bundle the upstream tree.

## `awesome-vscode-master.zip`
The supplied archive is a curated directory of VS Code extensions and resources, with sections covering languages, linting, IntelliSense, productivity, themes, snippets and more. Its root README calls it a curated list, and its root license is CC0 1.0. The list is useful for identifying candidate tools and extension ecosystems; it is not proof that any listed desktop extension works on Android.

## Integration policy
Before adding any upstream code or extension:
1. Identify its exact source repository and version.
2. Read its license and third-party notices.
3. Check native dependencies and platform support.
4. Check whether it expects Electron, Node APIs, desktop filesystem paths or unsupported VS Code proposals.
5. Add attribution and preserve required notices.
6. Test on Android devices and document capability gaps.
