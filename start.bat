@echo off
echo Starting AltSearch...
docker compose up -d

echo.
echo =====================================
echo    Server successfully started!      
echo    Access URL: http://localhost:3000 
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
