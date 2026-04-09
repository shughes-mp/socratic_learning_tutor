@echo off

if not exist ".env" (
  echo No .env file found. Creating one from template...
  copy .env.template .env
  echo.
  echo   Edit .env and add your Anthropic API key, then run this script again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=1,2 delims==" %%a in (.env) do set %%a=%%b

if "%ANTHROPIC_API_KEY%"=="" (
  echo Error: ANTHROPIC_API_KEY is not set in .env
  pause
  exit /b 1
)

if "%ANTHROPIC_API_KEY%"=="sk-ant-your-key-here" (
  echo Error: Replace the placeholder in .env with your actual API key.
  pause
  exit /b 1
)

python -c "import flask, anthropic" 2>nul || (
  echo Installing dependencies...
  pip install flask flask-cors anthropic -q
)

echo.
echo   Socratic Tutor running at http://localhost:7860
echo   Press Ctrl+C to stop.
echo.

python server.py
