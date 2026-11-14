@echo off
chcp 65001 >nul
"C:/Users/oppd_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe" "%~dp0launch.cjs"
if errorlevel 1 pause
