@echo off
REM FSD 구조로 파일 교체 스크립트 (Windows)

echo 🔄 FSD 구조로 리팩토링 시작...

REM 백업
copy src\renderer\app.tsx src\renderer\app.backup.tsx

REM 새 파일로 교체
move /Y src\renderer\app.new.tsx src\renderer\app.tsx
move /Y src\renderer\components\ProjectList.new.tsx src\renderer\components\ProjectList.tsx
move /Y src\renderer\components\ChatInterface.new.tsx src\renderer\components\ChatInterface.tsx
move /Y src\renderer\components\CreateProject.new.tsx src\renderer\components\CreateProject.tsx
move /Y src\renderer\components\Settings.new.tsx src\renderer\components\Settings.tsx

echo ✅ 리팩토링 완료!
echo.
echo 📝 변경사항:
echo   - app.tsx: 400+ 줄 → 150 줄
echo   - 로직을 custom hooks로 분리
echo   - Context를 Provider로 분리
echo   - 타입을 shared/types로 분리
echo.
echo 🧪 테스트: npm run dev

pause
