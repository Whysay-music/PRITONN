@echo off
chcp 65001 > nul
echo ========================================================
echo        PRITONN — Сборка для Android
echo ========================================================
echo.
echo 1. Открытие проекта в Android Studio...
echo Проект находится по пути:
echo %~dp0client\android
echo.
cd /d "%~dp0\client"
call npx.cmd cap open android
pause
