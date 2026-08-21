@echo off
:: ==============================================================================
:: Career Xone Pro - 1-Click Static IP Configuration
:: Sets Wi-Fi IP to 192.168.0.160 to match your Biometric Machine ServerIP
:: ==============================================================================

echo.
echo ====================================================================
echo   Career Xone Pro - Setting Static IP to 192.168.0.160
echo ====================================================================
echo.

echo [1/3] Setting IP Address to 192.168.0.160...
netsh interface ip set address name="Wi-Fi" static 192.168.0.160 255.255.255.0 192.168.0.1

echo [2/3] Setting Primary DNS to 192.168.0.1...
netsh interface ip set dns name="Wi-Fi" static 192.168.0.1

echo [3/3] Setting Secondary DNS to 8.8.8.8...
netsh interface ip add dns name="Wi-Fi" 8.8.8.8 index=2

echo.
echo ====================================================================
echo   [SUCCESS] Your Computer's IP is now permanently set to:
echo   IP Address : 192.168.0.160
echo   Subnet Mask: 255.255.255.0
echo   Gateway    : 192.168.0.1
echo ====================================================================
echo.
echo Press any key to close this window...
pause >nul
