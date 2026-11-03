@echo off
setlocal
set "EXT_DIR=%~dp0"

echo.
echo Base44 Toolkit 4.0.0 - Chrome extension setup
echo =============================================
echo.
echo 1. Open chrome://extensions in Chrome or Chromium.
echo 2. Enable Developer mode.
echo 3. Select Load unpacked.
echo 4. Choose this folder:
echo.
echo    %EXT_DIR%
echo.
echo Press any key to open the extensions page.
pause >nul
start "" chrome "chrome://extensions"
echo.
echo Select the folder shown above in the Load unpacked dialog.
echo Keep this folder in place while using the extension.
echo.
pause
