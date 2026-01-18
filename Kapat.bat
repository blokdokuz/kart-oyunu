@echo off
echo Oyun ve Baglantilar Kapatiliyor...

:: Node.js (Sunucu) islemini zorla bitir
taskkill /F /IM node.exe /T

:: Ngrok (Tünel) islemini zorla bitir
taskkill /F /IM ngrok.exe /T

echo.
echo Tum sistem basariyla kapatildi.
timeout /t 3