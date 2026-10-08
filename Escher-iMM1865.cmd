@echo off
setlocal

set "PACKAGE_DIR=%~dp0"
set "MAP_NAME=%~1"
if "%MAP_NAME%"=="" set "MAP_NAME=merged"

if /I "%MAP_NAME%"=="merged" goto map_ok
if /I "%MAP_NAME%"=="map00240" goto map_ok
if /I "%MAP_NAME%"=="map00410" goto map_ok
echo Usage: %~nx0 [merged^|map00240^|map00410]
exit /b 2

:map_ok
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or later is required.
  echo Install it from https://nodejs.org and run this launcher again.
  pause
  exit /b 1
)

node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"
if errorlevel 1 (
  echo Node.js 18 or later is required.
  node --version
  pause
  exit /b 1
)

node "%PACKAGE_DIR%server.mjs" --app-root "%PACKAGE_DIR%app" --port 0 --open-path "/?map=%MAP_NAME%" --open
endlocal
