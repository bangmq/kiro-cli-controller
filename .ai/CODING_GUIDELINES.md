# KiroDesk Coding Guidelines

## TypeScript 규칙

### 타입 정의
```typescript
// ✅ 명시적 타입 지정
function loadProjects(): Promise<Project[]> {
  return ipcRenderer.invoke('project:load');
}

// ❌ 암시적 any
function loadProjects() {
  return ipcRenderer.invoke('project:load');
}

// ✅ 인터페이스 사용
interface Project {
  id: string;
  name: string;
  path: string;
}

// ✅ 타입 가드
function isProject(obj: any): obj is Project {
  return obj && typeof obj.id === 'string';
}
```

### Async/Await
```typescript
// ✅ async/await 사용
async function saveProject(project: Project): Promise<void> {
  try {
    await window.electron.saveProjects([project]);
  } catch (error) {
    console.error('Failed to save:', error);
    throw error;
  }
}

// ❌ Promise 체이닝
function saveProject(project: Project) {
  return window.electron.saveProjects([project])
    .then(() => console.log('Saved'))
    .catch(error => console.error(error));
}
```

### 에러 처리
```typescript
// ✅ 구체적인 에러 처리
try {
  const projects = await loadProjects();
  if (projects.length === 0) {
    throw new Error('No projects found');
  }
} catch (error) {
  if (error instanceof Error) {
    console.error('Load failed:', error.message);
  }
  // 사용자에게 명확한 메시지
  alert('프로젝트를 불러올 수 없습니다.');
}

// ❌ 에러 무시
try {
  await loadProjects();
} catch (error) {
  // 아무것도 안 함
}
```

## React 규칙

### 함수형 컴포넌트
```typescript
// ✅ 함수형 컴포넌트 + Hooks
interface Props {
  projectId: string;
  onClose: () => void;
}

export function ChatInterface({ projectId, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  
  useEffect(() => {
    // 초기화 로직
  }, [projectId]);
  
  return <div>...</div>;
}

// ❌ 클래스 컴포넌트
class ChatInterface extends React.Component {
  // 사용하지 않음
}
```

### Hooks 규칙
```typescript
// ✅ 의존성 배열 명시
useEffect(() => {
  loadMessages(projectId);
}, [projectId]);

// ❌ 의존성 누락
useEffect(() => {
  loadMessages(projectId);
}, []); // projectId 변경 시 업데이트 안 됨

// ✅ 커스텀 Hook
function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  
  useEffect(() => {
    window.electron.loadProjects().then(setProjects);
  }, []);
  
  return projects;
}
```

### 상태 업데이트
```typescript
// ✅ 함수형 업데이트
setMessages(prev => [...prev, newMessage]);

// ❌ 직접 수정
messages.push(newMessage);
setMessages(messages);

// ✅ 불변성 유지
setProject({ ...project, name: newName });

// ❌ 직접 수정
project.name = newName;
setProject(project);
```

## Electron 규칙

### IPC 통신
```typescript
// Main Process (main.ts)
// ✅ 타입 안전한 핸들러
ipcMain.handle('project:load', async (): Promise<Project[]> => {
  return await projectManager.loadProjects();
});

// ❌ 타입 없는 핸들러
ipcMain.handle('project:load', async () => {
  return await projectManager.loadProjects();
});

// Preload (preload.ts)
// ✅ contextBridge로 안전하게 노출
contextBridge.exposeInMainWorld('electron', {
  loadProjects: (): Promise<Project[]> => 
    ipcRenderer.invoke('project:load')
});

// ❌ nodeIntegration으로 직접 노출 (보안 위험)
```

### 보안
```typescript
// ✅ 보안 설정 유지
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.js')
  }
});

// ❌ 보안 설정 해제
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: true,  // 위험!
    contextIsolation: false  // 위험!
  }
});
```

## 네이밍 규칙

### 파일명
```
✅ camelCase
- projectManager.ts
- kiroCliManager.ts

✅ PascalCase (컴포넌트)
- ChatInterface.tsx
- ProjectList.tsx

❌ kebab-case
- project-manager.ts
```

### 변수/함수
```typescript
// ✅ camelCase
const projectList = [];
function loadProjects() {}

// ❌ snake_case
const project_list = [];
function load_projects() {}

// ✅ 동사 + 명사
function saveProject() {}
function deleteProject() {}

// ❌ 모호한 이름
function doIt() {}
function handle() {}
```

### 타입/인터페이스
```typescript
// ✅ PascalCase
interface ProjectConfig {}
type MessageType = 'user' | 'assistant';

// ❌ camelCase
interface projectConfig {}
type messageType = 'user' | 'assistant';
```

### 상수
```typescript
// ✅ UPPER_SNAKE_CASE
const MAX_PROJECTS = 10;
const DEFAULT_LANGUAGE = 'ko';

// ❌ camelCase
const maxProjects = 10;
```

## 코드 구조

### 파일 구조
```typescript
// ✅ 순서: import → 타입 → 상수 → 함수/컴포넌트
import React, { useState } from 'react';
import { Project } from '../types/project';

interface Props {
  projectId: string;
}

const MAX_MESSAGES = 100;

export function ChatInterface({ projectId }: Props) {
  // 구현
}

// ❌ 순서 없이 섞여 있음
```

### 함수 크기
```typescript
// ✅ 작고 단일 책임
function validateProject(project: Project): boolean {
  return project.id && project.name && project.path;
}

function saveProject(project: Project): Promise<void> {
  if (!validateProject(project)) {
    throw new Error('Invalid project');
  }
  return window.electron.saveProjects([project]);
}

// ❌ 너무 큰 함수
function saveProject(project: Project) {
  // 100줄 이상의 로직
}
```

## 스타일링 (Tailwind CSS)

### 클래스 순서
```tsx
// ✅ 논리적 순서: 레이아웃 → 크기 → 스타일
<div className="flex flex-col w-full h-screen bg-gray-100 p-4">

// ❌ 무작위 순서
<div className="p-4 bg-gray-100 flex w-full flex-col h-screen">
```

### 조건부 클래스
```tsx
// ✅ 명확한 조건
<div className={`p-4 ${isActive ? 'bg-blue-500' : 'bg-gray-500'}`}>

// ✅ 복잡한 경우 변수 사용
const buttonClass = isActive 
  ? 'bg-blue-500 text-white' 
  : 'bg-gray-500 text-gray-200';
<button className={buttonClass}>
```

## 주석

### 언제 주석을 쓸까
```typescript
// ✅ 복잡한 로직 설명
// node-pty를 사용하여 kiro-cli 프로세스를 생성
// Windows에서는 wsl.exe를 통해 실행
const ptyProcess = spawn('wsl.exe', ['-e', 'kiro-cli'], {
  name: 'xterm-color',
  cols: 80,
  rows: 30
});

// ❌ 자명한 코드에 주석
// 프로젝트를 로드한다
const projects = await loadProjects();
```

### JSDoc
```typescript
// ✅ 공개 API에 JSDoc
/**
 * 프로젝트를 저장합니다.
 * @param project 저장할 프로젝트
 * @throws {Error} 프로젝트가 유효하지 않을 때
 */
export async function saveProject(project: Project): Promise<void> {
  // 구현
}
```

## 다국어 (i18n)

### 문자열 관리
```typescript
// ✅ i18n.ts에 모든 문자열
export const translations = {
  ko: {
    project: {
      create: '프로젝트 생성',
      delete: '프로젝트 삭제'
    }
  },
  en: {
    project: {
      create: 'Create Project',
      delete: 'Delete Project'
    }
  }
};

// ✅ 컴포넌트에서 사용
const t = translations[language];
<button>{t.project.create}</button>

// ❌ 하드코딩
<button>프로젝트 생성</button>
```

## 테스트 가능한 코드

### 순수 함수 선호
```typescript
// ✅ 순수 함수 (테스트 쉬움)
function formatMessage(message: string, timestamp: number): string {
  return `[${new Date(timestamp).toLocaleTimeString()}] ${message}`;
}

// ❌ 부수 효과 (테스트 어려움)
function formatMessage(message: string): string {
  console.log('Formatting:', message);
  return `[${new Date().toLocaleTimeString()}] ${message}`;
}
```

### 의존성 주입
```typescript
// ✅ 의존성 주입
function saveToFile(data: string, fs: FileSystem): Promise<void> {
  return fs.writeFile('data.json', data);
}

// ❌ 하드코딩된 의존성
function saveToFile(data: string): Promise<void> {
  return require('fs').writeFile('data.json', data);
}
```

## 성능

### 불필요한 리렌더링 방지
```typescript
// ✅ React.memo 사용
export const ChatMessage = React.memo(({ message }: Props) => {
  return <div>{message.content}</div>;
});

// ✅ useCallback으로 함수 메모이제이션
const handleSend = useCallback((message: string) => {
  sendMessage(projectId, message);
}, [projectId]);
```

### 대용량 데이터 처리
```typescript
// ✅ 가상화 또는 페이지네이션
const visibleMessages = messages.slice(-100);

// ❌ 모든 데이터 렌더링
messages.map(msg => <ChatMessage message={msg} />)
```

## 금지 사항

- ❌ `any` 타입 남용
- ❌ `console.log` 프로덕션 코드에 남기기
- ❌ 하드코딩된 경로나 설정
- ❌ 전역 변수 사용
- ❌ 동기 파일 I/O (fs.readFileSync 등)
- ❌ nodeIntegration 활성화
- ❌ eval() 사용
- ❌ 민감한 정보 로깅
