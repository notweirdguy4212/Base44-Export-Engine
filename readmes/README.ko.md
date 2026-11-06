# VS Code Android Pro — 한국어

VS Code에서 영감을 받은 Android 코딩 작업 공간입니다.

이 프로젝트는 독립적인 Android 네이티브 기반이며 Microsoft 공식 앱이나 완전한 Code-OSS 포트가 아닙니다.

## 현재 상태
이 문서는 스타터 버전 0.2.0을 설명합니다. 아직 데스크톱 편집기의 완전한 모바일 구현은 아닙니다.

## 현재 구현된 기능
Compose UI, 메모리 탭, Android 문서 선택기를 통한 파일 열기 및 저장, 찾기/바꾸기, 언어 모드 선택, 터미널·출력·문제·디버그 패널 UI를 포함합니다.

**Belangrijk:** taalmodi zijn alleen labels en extensieherkenning. Ze betekenen niet dat syntaxiskleuring, IntelliSense, compiler, runtime of debugger beschikbaar is.

## 빌드 방법
Android Studio에서 프로젝트 루트 폴더를 엽니다. JDK 17, Android SDK 35, Android Gradle Plugin 8.9.2가 필요합니다. Gradle 동기화 후 API 26 이상 Android 기기나 에뮬레이터에서 app을 실행하세요.

## 업스트림 자료 및 라이선스
제공된 Code-OSS 소스는 Electron 기반 데스크톱 프로젝트입니다. MIT 라이선스는 licenses/CODE_OSS_LICENSE.txt에 있습니다. Awesome VS Code 목록은 CC0 1.0이며 licenses/AWESOME_VSCODE_CC0.txt를 참고하세요. 전체 데스크톱 소스와 확장 기능은 이 앱에 포함되지 않았습니다.

## 개발 로드맵
에디터 엔진, 작업 공간, 언어 서버, 샌드박스 실행, Git 및 디버깅의 향후 계획은 docs/ROADMAP.md를 참고하세요. 이 기능들은 아직 구현 완료로 표시되지 않았습니다.

## 상표 안내
VS Code와 Visual Studio Code는 Microsoft의 상표입니다. 이 프로젝트는 독립 커뮤니티 프로젝트이며 Microsoft의 후원을 받지 않습니다.
