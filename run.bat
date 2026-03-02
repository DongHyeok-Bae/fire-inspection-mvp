@echo off
chcp 65001 >nul 2>&1
title MVP Test - 카메라 프로토타입

cd /d "%~dp0"

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Python이 설치되어 있지 않습니다.
    echo Python을 설치한 후 다시 실행해주세요.
    pause
    exit /b 1
)

echo ========================================
echo   카메라 MVP 프로토타입 서버 시작
echo ========================================
echo.
echo   http://localhost:8080 에서 접속 가능
echo   종료하려면 Ctrl+C 를 누르세요
echo ========================================
echo.

start http://localhost:8080
python -m http.server 8080
