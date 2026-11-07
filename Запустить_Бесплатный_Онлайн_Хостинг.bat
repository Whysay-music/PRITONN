@echo off
chcp 65001 > nul
title PRITONN — Онлайн Хостинг (Cloudflare)
echo ===================================================================
echo               PRITONN — БЕСПЛАТНЫЙ ОНЛАЙН ХОСТИНГ
echo ===================================================================
echo.
echo 1. Проверяем работу сервера PRITONN...
curl -s http://localhost:4000/api/users > nul
if %errorlevel% neq 0 (
    echo [!] Сервер не запущен. Запускаем фоновый сервер...
    start /b node "%~dp0server\server.js"
    timeout /t 2 > nul
)

echo 2. Запуск защищенного Cloudflare HTTPS туннеля...
echo    - Без паролей и подтверждений
echo    - Работает на всех смартфонах (Android, iPhone) и компьютерах
echo    - Поддерживает аудио/видео звонки и демонстрацию экрана
echo.
echo ===================================================================
echo Ваша ссылка генерируется:
echo ===================================================================
echo.
"%~dp0tools\cloudflared.exe" tunnel --url http://localhost:4000
pause
