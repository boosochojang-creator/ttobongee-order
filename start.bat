@echo off
start "customer-app" cmd /k "cd /d %~dp0customer-app && set PORT=3000 && npm run dev"
start "owner-app"   cmd /k "cd /d %~dp0owner-app   && set PORT=3001 && npm run dev"
