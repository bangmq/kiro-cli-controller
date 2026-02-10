#!/bin/bash

# FSD 구조로 파일 교체 스크립트

echo "🔄 FSD 구조로 리팩토링 시작..."

# 백업
cp src/renderer/app.tsx src/renderer/app.backup.tsx

# 새 파일로 교체
mv src/renderer/app.new.tsx src/renderer/app.tsx
mv src/renderer/components/ProjectList.new.tsx src/renderer/components/ProjectList.tsx
mv src/renderer/components/ChatInterface.new.tsx src/renderer/components/ChatInterface.tsx
mv src/renderer/components/CreateProject.new.tsx src/renderer/components/CreateProject.tsx
mv src/renderer/components/Settings.new.tsx src/renderer/components/Settings.tsx

# ProjectSettings는 import만 수정
sed -i "s|from '../app'|from '../../shared/lib/i18n-context'|g" src/renderer/components/ProjectSettings.tsx
sed -i "1i import { Project } from '../../shared/types/project';" src/renderer/components/ProjectSettings.tsx

echo "✅ 리팩토링 완료!"
echo ""
echo "📝 변경사항:"
echo "  - app.tsx: 400+ 줄 → 150 줄"
echo "  - 로직을 custom hooks로 분리"
echo "  - Context를 Provider로 분리"
echo "  - 타입을 shared/types로 분리"
echo ""
echo "🧪 테스트: npm run dev"
