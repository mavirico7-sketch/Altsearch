@echo off
echo Starting AltSearch with Nginx Proxy Manager...
docker compose --profile npm up -d

echo.
echo =====================================
echo    Server & Proxy Manager started!   
echo    App URL: http://localhost:3000    
echo    NPM Admin: http://localhost:81    
echo =====================================
echo.
echo Available Authentication Methods:

findstr /C:"allow_local_login: true" config.yaml >nul 2>&1
if %errorlevel%==0 (
    echo - Local User (allow_local_login is enabled in config.yaml)
)

if exist .env (
    findstr /C:"AUTH_GOOGLE_ID" .env >nul 2>&1
    if %errorlevel%==0 (
        echo - Google (AUTH_GOOGLE_ID is configured in .env)
    )
    findstr /C:"AUTH_GITHUB_ID" .env >nul 2>&1
    if %errorlevel%==0 (
        echo - GitHub (AUTH_GITHUB_ID is configured in .env)
    )
)
echo.
