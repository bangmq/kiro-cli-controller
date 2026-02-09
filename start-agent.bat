@echo off
echo Starting KiroDesk Developer Agent...
echo.
wsl bash -l -c "cd '/mnt/c/Users/user/kiro controller/kirodesk' && kiro-cli chat --agent 'kirodesk-dev'"
pause
