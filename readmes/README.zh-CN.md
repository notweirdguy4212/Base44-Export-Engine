# VS Code Android Pro — 简体中文

受 VS Code 启发的 Android 编程工作区。

这是一个独立的 Android 原生基础项目，并非 Microsoft 官方应用，也不是完整的 Code-OSS 移植版。

## 项目状态
本文档介绍 0.2.0 初始版本。该应用目前还不是桌面编辑器的完整移动端实现。

## 当前功能
Compose 原生界面、内存标签页、通过 Android 文档选择器打开和保存文件、查找与替换、语言模式选择，以及终端、输出、问题和调试面板界面。

**Belangrijk:** taalmodi zijn alleen labels en extensieherkenning. Ze betekenen niet dat syntaxiskleuring, IntelliSense, compiler, runtime of debugger beschikbaar is.

## 构建运行
使用 Android Studio 打开项目根目录。需要 JDK 17、Android SDK 35 和 Android Gradle Plugin 8.9.2。完成 Gradle 同步后，在 API 26 或更高版本的 Android 设备或模拟器上运行 app。

## 上游代码与许可证
提供的 Code-OSS 源码是基于 Electron 的桌面项目。MIT 许可证位于 licenses/CODE_OSS_LICENSE.txt。Awesome VS Code 列表采用 CC0 1.0，见 licenses/AWESOME_VSCODE_CC0.txt。完整桌面源码及其扩展并未集成到本应用中。

## 开发路线图
请查看 docs/ROADMAP.md，了解编辑器引擎、工作区、语言服务器、沙箱执行、Git 和调试的后续计划。这些功能尚未标记为已完成。

## 商标声明
VS Code 和 Visual Studio Code 是 Microsoft 的商标。本项目为独立社区项目，未获得 Microsoft 认可或赞助。
