# VS Code Android Pro — 日本語

VS Code に着想を得た Android 向けコーディング環境です。

これは独立した Android ネイティブ基盤であり、Microsoft の公式アプリでも Code-OSS の完全移植版でもありません。

## 現在の状態
この文書はスターター版 0.2.0 の内容を説明します。デスクトップエディターの完全なモバイル実装ではありません。

## 実装済みの機能
Compose UI、メモリ上のタブ、Android ドキュメントピッカーによるファイルの開閉・保存、検索と置換、言語モード選択、ターミナル・出力・問題・デバッグ用パネル UI を含みます。

**Belangrijk:** taalmodi zijn alleen labels en extensieherkenning. Ze betekenen niet dat syntaxiskleuring, IntelliSense, compiler, runtime of debugger beschikbaar is.

## ビルド方法
Android Studio でプロジェクトのルートフォルダーを開きます。JDK 17、Android SDK 35、Android Gradle Plugin 8.9.2 が必要です。Gradle 同期後、API 26 以降の端末またはエミュレーターで app を実行します。

## 上流ソースとライセンス
提供された Code-OSS ソースは Electron ベースのデスクトッププロジェクトです。MIT ライセンスは licenses/CODE_OSS_LICENSE.txt にあります。Awesome VS Code リストは CC0 1.0 で、licenses/AWESOME_VSCODE_CC0.txt を参照してください。デスクトップ全ソースと拡張機能はこのアプリに組み込まれていません。

## 開発ロードマップ
エディターエンジン、ワークスペース、言語サーバー、サンドボックス実行、Git、デバッグの今後の計画は docs/ROADMAP.md を参照してください。これらは未実装です。

## 商標について
VS Code および Visual Studio Code は Microsoft の商標です。本プロジェクトは独立したコミュニティプロジェクトであり、Microsoft の承認を受けていません。
