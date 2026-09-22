@echo off
title Career Xone Pro - 1-Click WhatsApp Session Backup
color 0A
cls
echo =====================================================================
echo    CAREER XONE PRO - WHATSAPP SESSION PORTABLE BACKUP TOOL
echo =====================================================================
echo.

set "SOURCE_VAULT=%APPDATA%\Career Xone Pro\data\.wwebjs_auth\session_vault"
set "SOURCE_SESSION=%APPDATA%\Career Xone Pro\data\.wwebjs_auth\session"
set "DEST_BACKUP=%~dp0WhatsApp_Session_Portable"

echo [1/3] Checking WhatsApp authentication on this PC...

if not exist "%SOURCE_VAULT%\IndexedDB" (
    if not exist "%SOURCE_SESSION%\Default\IndexedDB" (
        color 0C
        echo.
        echo [ERROR] No active WhatsApp session or vault found in:
        echo "%APPDATA%\Career Xone Pro\data\.wwebjs_auth"
        echo.
        echo Please ensure WhatsApp is logged in at least once before taking a backup.
        echo.
        pause
        exit /b 1
    )
)

echo [2/3] WhatsApp session found! Creating safe portable backup...
if not exist "%DEST_BACKUP%" mkdir "%DEST_BACKUP%"
if not exist "%DEST_BACKUP%\Default" mkdir "%DEST_BACKUP%\Default"

powershell -NoProfile -Command ^
    "$dest = '%DEST_BACKUP%';" ^
    "$vault = '%SOURCE_VAULT%';" ^
    "$session = '%SOURCE_SESSION%';" ^
    "if (Test-Path (Join-Path $vault 'IndexedDB')) { $srcIdb = Join-Path $vault 'IndexedDB'; } else { $srcIdb = Join-Path $session 'Default\IndexedDB'; }" ^
    "if (Test-Path (Join-Path $vault 'Local Storage')) { $srcLs = Join-Path $vault 'Local Storage'; } else { $srcLs = Join-Path $session 'Default\Local Storage'; }" ^
    "if (Test-Path (Join-Path $vault 'Local State')) { $srcLsState = Join-Path $vault 'Local State'; } else { $srcLsState = Join-Path $session 'Local State'; }" ^
    "$destIdb = Join-Path $dest 'Default\IndexedDB';" ^
    "$destLs = Join-Path $dest 'Default\Local Storage';" ^
    "New-Item -ItemType Directory -Force -Path $destIdb | Out-Null;" ^
    "Copy-Item -Path $srcIdb\* -Destination $destIdb -Recurse -Force -Exclude 'LOCK','SingletonLock','SingletonCookie','SingletonSocket','lockfile';" ^
    "if (Test-Path $srcLs) { New-Item -ItemType Directory -Force -Path $destLs | Out-Null; Copy-Item -Path $srcLs\* -Destination $destLs -Recurse -Force -Exclude 'LOCK','SingletonLock','SingletonCookie','SingletonSocket','lockfile'; }" ^
    "if (Test-Path $srcLsState) { Copy-Item -Path $srcLsState -Destination (Join-Path $dest 'Local State') -Force; }" ^
    "if (Test-Path (Join-Path $vault 'vault_meta.json')) { Copy-Item -Path (Join-Path $vault 'vault_meta.json') -Destination (Join-Path $dest 'vault_meta.json') -Force; }" ^
    "Write-Host '   -> Successfully sealed session into: ' $dest;"

echo.
echo [3/3] Backup Complete!
echo =====================================================================
echo  SUCCESS! WhatsApp session is now safely backed up at:
echo  "%DEST_BACKUP%"
echo.
echo  You can now copy this folder or keep this pendrive safe!
echo  To restore on ANY PC without scanning QR code, run:
echo  "2_RESTORE_WHATSAPP_SESSION.bat"
echo =====================================================================
echo.
pause
