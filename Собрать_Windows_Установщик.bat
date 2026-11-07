@echo off
chcp 65001 > nul
echo ========================================================
echo        Сборка Windows Установщика PRITONN (.exe)
echo ========================================================
echo.
cd /d "%~dp0\client"
call npm.cmd run electron:build
echo.
echo Сборка завершена! Установщик находится в папке client\release
pause
