@echo off
chcp 65001 >nul
title 弦养 · 本地预览服务
cd /d "%~dp0"

echo.
echo   ============================================
echo            弦养 · 启动本地服务
echo   ============================================
echo.

REM ---- 端口占用检查 ----
set PORT=5173
netstat -ano | findstr ":%PORT%" | findstr LISTENING >nul
if %errorlevel%==0 (
  echo   [提示] 端口 %PORT% 已被占用，可能是本程序已在运行。
  echo          请直接看浏览器窗口，关闭后再重新启动本程序。
  echo.
  start "" "http://localhost:%PORT%"
  echo   已在浏览器打开。
  timeout /t 3 >nul
  exit /b 0
)

where node >nul 2>nul
if %errorlevel%==0 goto :start

echo   [错误] 没找到 Node.js。
echo.
echo   本程序需要 Node.js 才能启动本地服务。请任选一种方式：
echo.
echo   方式一（推荐）：到 https://nodejs.org 下载 LTS 版，
echo                   安装时保持默认选项即可（约 30MB）
echo.
echo   方式二：如果你的电脑已装 Chrome/Edge 浏览器，
echo                   也可以改用项目里的「直开版」（见 交付说明.md 附录）
echo.
pause
exit /b 1

:start
echo   正在启动…首次启动可能需要 3~5 秒
echo.
start "" "http://localhost:%PORT%"

node server.cjs %PORT%

echo.
echo   服务已停止。
pause
