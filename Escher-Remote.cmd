@echo off
setlocal

set "PACKAGE_DIR=%~dp0"
set "REMOTE_PORT=%~1"
if "%REMOTE_PORT%"=="" set "REMOTE_PORT=40456"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or later is required.
  pause
  exit /b 1
)

node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"
if errorlevel 1 (
  echo Node.js 18 or later is required.
  pause
  exit /b 1
)

node "%PACKAGE_DIR%server.mjs" --app-root "%PACKAGE_DIR%app" --host 0.0.0.0 --port "%REMOTE_PORT%" --access-token auto --open-path "/?map=merged" --open
endlocal
