@echo off
setlocal enabledelayedexpansion

:: 移除 GIT/usr/bin 避免 GNU link.exe 劫持
set "NEWP=."
for %%i in ("%PATH:;=" "%") do (
  set "P=%%~i"
  echo !P! | find /i "Git\usr\bin" >nul || set "NEWP=!NEWP!;!P!"
)

:: 添加 MSVC 路径到最前面
set "PATH=C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.43.34808\bin\Hostx64\x64;!NEWP!"

:: 设置 Cargo 目标目录（无空格）
set "CARGO_TARGET_DIR=C:\Users\Administrator\AppData\Local\Temp\tauri-target"

cd /d "%~dp0"
echo [BUILD] 使用 link.exe:
where link.exe 2>nul | find /i "MSVC" && (
  echo   找到 MSVC link.exe
) || (
  echo   WARNING: 未找到 MSVC link.exe
)

echo [BUILD] 开始 Tauri 构建...
echo ============================================================
call npm run tauri build
echo ============================================================
echo [BUILD] 完成，退出码 %ERRORLEVEL%
pause
