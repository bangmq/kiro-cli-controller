# KiroDesk Project Context

## 프로젝트 개요
**KiroDesk**는 Electron 기반 데스크톱 애플리케이션으로, 여러 프로젝트의 kiro-cli agent를 동시에 관리하고 상호작용할 수 있는 멀티 프로젝트 컨트롤러입니다.

## 핵심 기능
- 멀티 프로젝트 관리 (추가, 삭제, 설정)
- 동시 다중 CLI 세션 실행
- 그리드 레이아웃 채팅 인터페이스 (1x1, 2x1, 2x2)
- 프로젝트별 agent 설정
- 다국어 지원 (한국어, 영어)
- 채팅 기록 관리

## 기술 스택
- **Electron** 28.x - 크로스 플랫폼 데스크톱 앱
- **React** 18.x - UI 프레임워크
- **TypeScript** 5.x - 타입 안전성
- **Tailwind CSS** 3.x - 유틸리티 기반 스타일링
- **node-pty** 1.x - 터미널 에뮬레이션
- **esbuild** - 빠른 번들링

## 프로젝트 구조
```
kirodesk/
├── src/
│   ├── main/           # Electron main process
│   ├── preload/        # IPC bridge
│   ├── renderer/       # React UI
│   └── types/          # TypeScript definitions
├── skills/             # Skill-based documentation
├── .ai/                # AI agent configuration
├── .kiro/              # Kiro CLI configuration
└── dist/               # Build output
```

## 주요 파일
- `src/main/main.ts` - Electron 앱 진입점
- `src/main/projectManager.ts` - 프로젝트 데이터 관리
- `src/main/kiroCliManager.ts` - CLI 프로세스 오케스트레이션
- `src/preload/preload.ts` - 안전한 IPC API 노출
- `src/renderer/app.tsx` - React 루트 컴포넌트
- `src/renderer/i18n.ts` - 다국어 지원

## 개발 명령어
```bash
npm run build       # 전체 빌드
npm run dev         # 개발 모드 실행
npm run package     # 배포 패키지 생성
```

## 데이터 저장
- **프로젝트 목록**: `{userData}/projects.json`
- **프로젝트 설정**: `{userData}/configs/{projectId}.json`
- **채팅 기록**: 메모리에만 (영속화 안 함)

## 보안 모델
- `nodeIntegration: false` - Renderer에서 Node.js 직접 접근 차단
- `contextIsolation: true` - 컨텍스트 격리
- Preload를 통한 안전한 IPC API만 노출

## 아키텍처 특징
- **3-Layer Architecture**: Main Process ↔ Preload ↔ Renderer
- **멀티 프로세스**: 각 프로젝트의 CLI는 독립 프로세스
- **타입 안전성**: 전체 코드베이스 TypeScript
- **반응형 UI**: React + Tailwind CSS

## 확장 가능성
- 새 IPC API 추가 용이
- 컴포넌트 기반 UI 확장
- 플러그인 시스템 (향후)
- 테마 커스터마이징 (향후)

## 참고 문서
- `ARCHITECTURE.md` - 상세 아키텍처 설명
- `CODING_GUIDELINES.md` - 코딩 규칙 및 베스트 프랙티스
- `COMMON_TASKS.md` - 일반적인 개발 작업 가이드
- `AGENTS.md` - Skill-based agent 사용법
