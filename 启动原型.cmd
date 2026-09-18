@echo off
setlocal
chcp 65001 >nul
set "ELECTRON_RUN_AS_NODE="
set "CS_RENT_APP=%~dp0..\release\win-unpacked\CS饰品平台-交互原型.exe"
if not exist "%CS_RENT_APP%" goto missing
start "" /D "%~dp0..\release\win-unpacked" "%CS_RENT_APP%"
if errorlevel 1 goto failed
exit /b 0

:missing
echo 未找到原型运行程序：
echo "%CS_RENT_APP%"
echo 请保留上一级完整的 release\win-unpacked 目录后重试。
pause
exit /b 1

:failed
echo 原型启动失败，请直接打开 release\win-unpacked 中的程序检查错误。
pause
exit /b 1
