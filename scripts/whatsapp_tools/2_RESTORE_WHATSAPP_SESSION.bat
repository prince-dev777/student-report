@echo off
title Career Xone Pro - 1-Click WhatsApp Session Restore
color 0B
cls
echo =====================================================================
echo    CAREER XONE PRO - WHATSAPP SESSION PORTABLE RESTORATION TOOL
echo =====================================================================
echo.

set "BACKUP_DIR=%~dp0WhatsApp_Session_Portable"
set "TARGET_AUTH=%APPDATA%\Career Xone Pro\data\.wwebjs_auth"
set "TARGET_SESSION=%TARGET_AUTH%\session"
set "TARGET_VAULT=%TARGET_AUTH%\session_vault"

echo [1/4] Verifying backup data...

if not exist "%BACKUP_DIR%\Default\IndexedDB" (
    color 0C
    echo.
    echo [ERROR] No backup session found at:
    echo "%BACKUP_DIR%"
    echo.
    echo Please make sure you have run "1_BACKUP_WHATSAPP_SESSION.bat" first!
    echo.
    pause
    exit /b 1
)

echo [2/4] Terminating any running background browser or app processes...
taskkill /F /IM "Career Xone Pro.exe" >nul 2>&1
powershell -NoProfile -Command ^
    "$procs = Get-CimInstance Win32_Process -Filter \"Name='chrome.exe' OR Name='msedge.exe'\";" ^
    "foreach ($p in $procs) { if ($p.CommandLine -and ($p.CommandLine -like '*wwebjs_auth*' -or $p.CommandLine -like '*.wwebjs_cache*')) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } }"

echo [3/4] Restoring session and safety vault into Career Xone Pro...
if not exist "%TARGET_SESSION%\Default" mkdir "%TARGET_SESSION%\Default"
if not exist "%TARGET_VAULT%" mkdir "%TARGET_VAULT%"

powershell -NoProfile -Command ^
    "$backup = '%BACKUP_DIR%';" ^
    "$targetSession = '%TARGET_SESSION%';" ^
    "$targetVault = '%TARGET_VAULT%';" ^
    "$destIdb = Join-Path $targetSession 'Default\IndexedDB';" ^
    "$destLs = Join-Path $targetSession 'Default\Local Storage';" ^
    "if (Test-Path $destIdb) { Remove-Item -Recurse -Force $destIdb -ErrorAction SilentlyContinue };" ^
    "if (Test-Path $destLs) { Remove-Item -Recurse -Force $destLs -ErrorAction SilentlyContinue };" ^
    "New-Item -ItemType Directory -Force -Path $destIdb | Out-Null;" ^
    "New-Item -ItemType Directory -Force -Path $destLs | Out-Null;" ^
    "Copy-Item -Path (Join-Path $backup 'Default\IndexedDB\*') -Destination $destIdb -Recurse -Force -Exclude 'LOCK','SingletonLock','SingletonCookie','SingletonSocket','lockfile';" ^
    "if (Test-Path (Join-Path $backup 'Default\Local Storage')) { Copy-Item -Path (Join-Path $backup 'Default\Local Storage\*') -Destination $destLs -Recurse -Force -Exclude 'LOCK','SingletonLock','SingletonCookie','SingletonSocket','lockfile'; };" ^
    "if (Test-Path (Join-Path $backup 'Local State')) { Copy-Item -Path (Join-Path $backup 'Local State') -Destination (Join-Path $targetSession 'Local State') -Force; };" ^
    "Copy-Item -Path (Join-Path $backup 'Default\IndexedDB') -Destination $targetVault -Recurse -Force -Exclude 'LOCK','SingletonLock','SingletonCookie','SingletonSocket','lockfile';" ^
    "if (Test-Path (Join-Path $backup 'Default\Local Storage')) { Copy-Item -Path (Join-Path $backup 'Default\Local Storage') -Destination $targetVault -Recurse -Force -Exclude 'LOCK','SingletonLock','SingletonCookie','SingletonSocket','lockfile'; };" ^
    "if (Test-Path (Join-Path $backup 'Local State')) { Copy-Item -Path (Join-Path $backup 'Local State') -Destination (Join-Path $targetVault 'Local State') -Force; };" ^
    "if (Test-Path (Join-Path $backup 'vault_meta.json')) { Copy-Item -Path (Join-Path $backup 'vault_meta.json') -Destination (Join-Path $targetVault 'vault_meta.json') -Force; };" ^
    "$permLocal = 'C:\CareerXone_Backups\WhatsApp_Session_Vault';" ^
    "New-Item -ItemType Directory -Force -Path $permLocal | Out-Null;" ^
    "Copy-Item -Path (Join-Path $backup 'Default\IndexedDB') -Destination $permLocal -Recurse -Force -Exclude 'LOCK','SingletonLock','SingletonCookie','SingletonSocket','lockfile';" ^
    "if (Test-Path (Join-Path $backup 'Default\Local Storage')) { Copy-Item -Path (Join-Path $backup 'Default\Local Storage') -Destination $permLocal -Recurse -Force -Exclude 'LOCK','SingletonLock','SingletonCookie','SingletonSocket','lockfile'; };" ^
    "if (Test-Path (Join-Path $backup 'Local State')) { Copy-Item -Path (Join-Path $backup 'Local State') -Destination (Join-Path $permLocal 'Local State') -Force; };" ^
    "if (Test-Path (Join-Path $backup 'vault_meta.json')) { Copy-Item -Path (Join-Path $backup 'vault_meta.json') -Destination (Join-Path $permLocal 'vault_meta.json') -Force; };" ^
    "if (Test-Path (Join-Path '%TARGET_AUTH%' '.manual_disconnect')) { Remove-Item (Join-Path '%TARGET_AUTH%' '.manual_disconnect') -Force -ErrorAction SilentlyContinue; };" ^
    "Get-ChildItem -Path '%TARGET_AUTH%' -Recurse -Include 'SingletonLock','SingletonCookie','SingletonSocket','lockfile','LOCK','.manual_disconnect' -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue;" ^
    "Write-Host '   -> Session, Vault, and Local Permanent Storage successfully restored!';"

echo.
echo [4/4] Done!
echo =====================================================================
echo  SUCCESS! WhatsApp authentication has been restored successfully!
echo.
echo  Now open Career Xone Pro - WhatsApp will immediately show as
echo  "Online / Connected" WITHOUT requiring any QR code scan!
echo =====================================================================
echo.
pause
