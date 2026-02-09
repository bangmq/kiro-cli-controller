# KiroDesk Architecture

## 프로젝트 개요
Electron 기반 데스크톱 애플리케이션으로, 여러 프로젝트의 kiro-cli agent를 동시에 관리하고 상호작용할 수 있는 멀티 프로젝트 컨트롤러입니다.

## 기술 스택
- **Electron**: 28.x - 데스크톱 앱 프레임워크
- **React**: 18.x - UI 라이브러리
- **TypeScript**: 5.x - 타입 안정성
- **Tailwind CSS**: 3.x - 스타일링
- **node-pty**: 1.x - 터미널 에뮬레이션
- **esbuild**: 번들링

## 아키텍처 패턴

### 3-Layer Architecture

```
┌─────────────────────────────────────────┐
│         Renderer Process (UI)           │
│  React + TypeScript + Tailwind CSS      │
│  - app.tsx (메인 앱)                     │
│  - components/ (UI 컴포넌트들)           │
│  - i18n.ts (다국어 지원)                 │
└──────────────┬──────────────────────────┘
               │ IPC (contextBridge)
┌──────────────┴──────────────────────────┐
│         Preload Script (Bridge)         │
│  - preload.ts                           │
│  - IPC API 노출 (보안 계층)              │
└──────────────┬──────────────────────────┘
               │ IPC (ipcRenderer)
┌──────────────┴──────────────────────────┐
│         Main Process (Backend)          │
│  - main.ts (앱 생명주기)                 │
│  - projectManager.ts (프로젝트 관리)     │
│  - kiroCliManager.ts (CLI 오케스트레이션)│
│  - projectConfig.ts (설정 관리)          │
└─────────────────────────────────────────┘
```

## 디렉토리 구조

```
kirodesk/
├── src/
│   ├── main/                    # Main Process
│   │   ├── main.ts             # 앱 진입점, 윈도우 관리, IPC 핸들러
│   │   ├── projectManager.ts   # 프로젝트 CRUD (projects.json)
│   │   ├── kiroCliManager.ts   # kiro-cli 프로세스 관리 (node-pty)
│   │   └── projectConfig.ts    # 프로젝트별 설정 관리
│   │
│   ├── preload/                 # Preload Script
│   │   └── preload.ts          # IPC bridge, contextBridge API
│   │
│   ├── renderer/                # Renderer Process
│   │   ├── app.tsx             # React 루트 컴포넌트
│   │   ├── index.html          # HTML 진입점
│   │   ├── styles.css          # Tailwind CSS
│   │   ├── i18n.ts             # 다국어 (ko, en)
│   │   └── components/
│   │       ├── ChatGrid.tsx        # 멀티 채팅 그리드 레이아웃
│   │       ├── ChatInterface.tsx   # 개별 채팅 인터페이스
│   │       ├── CreateProject.tsx   # 프로젝트 생성 폼
│   │       ├── ProjectList.tsx     # 프로젝트 목록
│   │       ├── ProjectSettings.tsx # 프로젝트별 설정
│   │       ├── Settings.tsx        # 전역 설정
│   │       └── TabBar.tsx          # 탭 네비게이션
│   │
│   └── types/                   # TypeScript Definitions
│       ├── electron.d.ts       # IPC API 타입 정의
│       ├── node-pty.d.ts       # node-pty 타입
│       └── project.ts          # 프로젝트 타입
│
├── skills/                      # Skill-based 문서
│   ├── main-process/
│   ├── ipc-contract/
│   └── renderer-ui/
│
├── dist/                        # 빌드 출력
├── package.json
├── tsconfig.main.json          # Main process TS 설정
├── tsconfig.renderer.json      # Renderer TS 설정
└── tailwind.config.js
```

## 핵심 컴포넌트

### 1. Main Process (src/main/)

#### main.ts
- Electron 앱 생명주기 관리
- BrowserWindow 생성 및 관리
- IPC 핸들러 등록
- 보안 설정 (nodeIntegration: false, contextIsolation: true)

#### projectManager.ts
- 프로젝트 데이터 영속화 (userData/projects.json)
- CRUD 작업: loadProjects, saveProjects, addProject, updateProject

#### kiroCliManager.ts
- kiro-cli 프로세스 생성 및 관리 (node-pty)
- 터미널 입출력 처리
- 프로세스 생명주기 관리
- 멀티 세션 지원

#### projectConfig.ts
- 프로젝트별 설정 관리
- Agent 설정, 환경 변수, 경로 등

### 2. Preload Script (src/preload/)

#### preload.ts
- contextBridge를 통한 안전한 IPC API 노출
- Main ↔ Renderer 간 통신 브릿지
- 타입 안전성 보장

**노출된 API**:
```typescript
window.electron = {
  // 프로젝트 관리
  loadProjects: () => Promise<Project[]>
  saveProjects: (projects: Project[]) => Promise<void>
  
  // CLI 관리
  startKiroCli: (projectId: string, config: any) => Promise<void>
  sendToKiroCli: (projectId: string, message: string) => Promise<void>
  stopKiroCli: (projectId: string) => Promise<void>
  
  // 이벤트 리스너
  onKiroOutput: (callback: (data: any) => void) => void
  onKiroError: (callback: (data: any) => void) => void
}
```

### 3. Renderer Process (src/renderer/)

#### app.tsx
- React 루트 컴포넌트
- 전역 상태 관리 (useState)
- 라우팅 (view 상태: 'list' | 'chat' | 'create' | 'settings')
- IPC 이벤트 구독

#### 주요 컴포넌트

**ChatGrid.tsx**
- 멀티 채팅 그리드 레이아웃 (1x1, 2x1, 2x2)
- 각 그리드 셀에 ChatInterface 렌더링
- 레이아웃 전환 기능

**ChatInterface.tsx**
- 개별 프로젝트와의 채팅 인터페이스
- 메시지 입출력
- Markdown 렌더링 (react-markdown)
- 자동 스크롤

**ProjectList.tsx**
- 프로젝트 목록 표시
- 프로젝트 선택 및 활성화
- 프로젝트 설정 접근

**CreateProject.tsx**
- 새 프로젝트 생성 폼
- 경로 선택, agent 설정
- 유효성 검사

**ProjectSettings.tsx**
- 프로젝트별 설정 편집
- Agent 설정, 환경 변수
- 설정 저장

**Settings.tsx**
- 전역 앱 설정
- 언어 설정 (ko/en)
- 테마 설정 (향후)

#### i18n.ts
- 다국어 지원 (한국어, 영어)
- 모든 UI 문자열 중앙 관리
- 타입 안전한 번역 함수

## 데이터 흐름

### 프로젝트 로드
```
1. Renderer: loadProjects() 호출
2. Preload: IPC invoke('project:load')
3. Main: projectManager.loadProjects()
4. Main: userData/projects.json 읽기
5. Main: 데이터 반환
6. Renderer: 상태 업데이트
```

### CLI 상호작용
```
1. Renderer: sendToKiroCli(projectId, message)
2. Preload: IPC invoke('kiro:send')
3. Main: kiroCliManager.write(projectId, message)
4. Main: node-pty로 CLI에 전송
5. CLI: 응답 생성
6. Main: IPC send('kiro:output', {projectId, data})
7. Preload: 이벤트 전달
8. Renderer: onKiroOutput 콜백 실행
9. Renderer: UI 업데이트
```

## 보안 모델

### Electron 보안 설정
```typescript
webPreferences: {
  nodeIntegration: false,        // Renderer에서 Node.js 직접 접근 차단
  contextIsolation: true,        // 컨텍스트 격리
  preload: path.join(__dirname, 'preload.js')  // 안전한 API만 노출
}
```

### IPC 보안
- Renderer는 preload를 통해서만 Main과 통신
- 모든 IPC 채널은 명시적으로 정의
- 파일 시스템 접근은 Main에서만
- 사용자 입력 검증

## 상태 관리

### Renderer 상태 (React useState)
```typescript
- projects: Project[]           // 프로젝트 목록
- activeProjects: string[]      // 활성 프로젝트 ID들
- chatHistory: Map<string, Message[]>  // 채팅 기록
- view: 'list' | 'chat' | 'create' | 'settings'
- language: 'ko' | 'en'
```

### Main 상태
```typescript
- projects: Map<string, Project>  // 프로젝트 데이터
- cliProcesses: Map<string, IPty>  // CLI 프로세스들
```

## 빌드 프로세스

```bash
npm run build
├── tsc -p tsconfig.main.json      # Main process 컴파일
├── tailwindcss                     # CSS 빌드
├── esbuild src/renderer/app.tsx   # Renderer 번들링
└── copy-assets                     # HTML 복사
```

## 배포

```bash
npm run package
# electron-builder로 패키징
# - macOS: .dmg, .zip
# - Windows: .exe (NSIS), portable
```

## 확장 포인트

### 새 IPC API 추가
1. `src/main/main.ts`: ipcMain.handle() 추가
2. `src/preload/preload.ts`: contextBridge API 추가
3. `src/types/electron.d.ts`: 타입 정의 추가
4. Renderer에서 사용

### 새 컴포넌트 추가
1. `src/renderer/components/` 에 컴포넌트 생성
2. `app.tsx`에서 import 및 사용
3. `i18n.ts`에 필요한 문자열 추가 (ko, en)

### 새 프로젝트 설정 추가
1. `src/types/project.ts`: 타입 정의
2. `src/main/projectConfig.ts`: 설정 로직
3. `src/renderer/components/ProjectSettings.tsx`: UI

## 성능 고려사항

- **멀티 프로세스**: 각 프로젝트의 CLI는 독립 프로세스
- **메모리**: 채팅 기록은 메모리에만 (영속화 안 함)
- **렌더링**: React 가상 DOM으로 효율적 업데이트
- **IPC**: 대용량 데이터는 스트리밍 고려

## 디버깅

```bash
npm run dev  # 개발 모드 (DevTools 자동 열림)
```

- Main process: console.log → 터미널
- Renderer process: console.log → DevTools
- IPC 통신: 양쪽 로그 확인
