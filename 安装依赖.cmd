@echo off
chcp 65001 >nul
cd /d "%~dp0"
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 24 LTS，再运行本文件。当前 Codex 环境已有内置依赖，可先尝试直接启动应用。
  pause
  exit /b 1
)
call npm.cmd install
pause
