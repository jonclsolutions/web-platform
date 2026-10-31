@echo off
rem =============================================================================
rem @file dev.cmd
rem @path dev.cmd (root of the web-platform monorepo)
rem @project RPSW Web
rem @author RPSW
rem @created 2026-10-31
rem @description Windows launcher of dev\windows\dev.ps1 - runs ./dev.sh inside WSL (same commands: dev.cmd, dev.cmd up -d, dev.cmd logs api, ...).
rem   Runs it with the execution policy relaxed for this one process only (Windows blocks
rem   unsigned scripts by default); arguments are passed on.
rem @refactor-note (2026-10-31) The .ps1 moved to dev\windows\ (root clean-up).
rem =============================================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev\windows\dev.ps1" %*
exit /b %ERRORLEVEL%
