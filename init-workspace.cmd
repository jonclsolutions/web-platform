@echo off
rem =============================================================================
rem @file init-workspace.cmd
rem @path init-workspace.cmd (root of the web-platform monorepo)
rem @project JS web-platform
rem @author JS
rem @created 2026
rem @description Windows launcher of dev\windows\init-workspace.ps1 - prepares WSL 2, Docker Desktop and the project, then runs init-workspace.sh inside WSL. Double-click it or run .\init-workspace.cmd
rem   Runs it with the execution policy relaxed for this one process only (Windows blocks
rem   unsigned scripts by default); arguments are passed on.
rem =============================================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev\windows\init-workspace.ps1" %*
exit /b %ERRORLEVEL%
