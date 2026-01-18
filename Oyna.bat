@echo off
echo Kart Oyunu Baslatiliyor...

:: 1. Sunucuyu Başlat (Yeni pencerede)
start cmd /k "cd /d C:\Coding\cards_playtable && node server.js"

:: 2. 3 Saniye Bekle (Sunucu kendine gelsin)
timeout /t 3

:: 3. Ngrok'u Başlat (Yeni pencerede)
start cmd /k "cd /d C:\Coding\cards_playtable && ngrok http 3000"

echo Her sey hazir! Iyi oyunlar...