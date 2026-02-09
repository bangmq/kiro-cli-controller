# KiroDesk Common Tasks

## 프로젝트 관리

### 새 프로젝트 추가
**파일**: `src/main/projectManager.ts`, `src/renderer/components/CreateProject.tsx`

1. UI에서 프로젝트 정보 입력 (이름, 경로, agent)
2. `window.electron.saveProjects()` 호출
3. Main process에서 `projects.json`에 저장
4. 프로젝트 목록 갱신

### 프로젝트 삭제
**파일**: `src/main/projectManager.ts`, `src/renderer/components/ProjectList.tsx`

1. 삭제 확인 다이얼로그 표시
2. `window.electron.deleteProject(projectId)` 호출
3. Main process에서 `projects.json`에서 제거
4. 활성 CLI 프로세스 종료
5. 프로젝트 목록 갱신

### 프로젝트 설정 변경
**파일**: `src/main/projectConfig.ts`, `src/renderer/components/ProjectSettings.tsx`

1. 설정 UI에서 값 변경
2. `window.electron.updateProjectConfig(projectId, config)` 호출
3. Main process에서 설정 저장
4. CLI 재시작 (필요 시)

## CLI 상호작용

### CLI 프로세스 시작
**파일**: `src/main/kiroCliManager.ts`

```typescript
// Renderer
await window.electron.startKiroCli(projectId, {
  agent: 'my-agent',
  workingDir: '/path/to/project'
});

// Main
const ptyProcess = spawn('wsl.exe', [
  '-e', 'bash', '-l', '-c',
  `cd '${workingDir}' && kiro-cli chat --agent '${agent}'`
], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.env.HOME
});
```

### 메시지 전송
**파일**: `src/renderer/components/ChatInterface.tsx`

```typescript
const handleSend = async (message: string) => {
  // UI에 사용자 메시지 추가
  setMessages(prev => [...prev, {
    role: 'user',
    content: message,
    timestamp: Date.now()
  }]);
  
  // CLI에 전송
  await window.electron.sendToKiroCli(projectId, message);
};
```

### 출력 수신
**파일**: `src/renderer/app.tsx`

```typescript
useEffect(() => {
  window.electron.onKiroOutput((data: { projectId: string; data: string }) => {
    setChatHistory(prev => {
      const history = new Map(prev);
      const messages = history.get(data.projectId) || [];
      history.set(data.projectId, [...messages, {
        role: 'assistant',
        content: data.data,
        timestamp: Date.now()
      }]);
      return history;
    });
  });
}, []);
```

### CLI 프로세스 종료
**파일**: `src/main/kiroCliManager.ts`

```typescript
// Renderer
await window.electron.stopKiroCli(projectId);

// Main
const ptyProcess = this.processes.get(projectId);
if (ptyProcess) {
  ptyProcess.kill();
  this.processes.delete(projectId);
}
```

## UI 컴포넌트

### 새 컴포넌트 추가
**파일**: `src/renderer/components/NewComponent.tsx`

```typescript
import React, { useState } from 'react';

interface Props {
  projectId: string;
  onClose: () => void;
}

export function NewComponent({ projectId, onClose }: Props) {
  const [state, setState] = useState<string>('');
  
  return (
    <div className="flex flex-col p-4">
      <h2 className="text-xl font-bold mb-4">New Component</h2>
      {/* 구현 */}
    </div>
  );
}
```

### 다국어 문자열 추가
**파일**: `src/renderer/i18n.ts`

```typescript
export const translations = {
  ko: {
    newFeature: {
      title: '새 기능',
      description: '설명'
    }
  },
  en: {
    newFeature: {
      title: 'New Feature',
      description: 'Description'
    }
  }
};

// 사용
const t = translations[language];
<h2>{t.newFeature.title}</h2>
```

### 레이아웃 변경
**파일**: `src/renderer/components/ChatGrid.tsx`

```typescript
// 그리드 레이아웃 추가 (예: 3x1)
const layouts = {
  '1x1': 'grid-cols-1 grid-rows-1',
  '2x1': 'grid-cols-2 grid-rows-1',
  '2x2': 'grid-cols-2 grid-rows-2',
  '3x1': 'grid-cols-3 grid-rows-1'  // 새 레이아웃
};
```

## IPC 통신

### 새 IPC 채널 추가

**1. Main Process 핸들러 추가**
**파일**: `src/main/main.ts`

```typescript
ipcMain.handle('project:export', async (event, projectId: string): Promise<string> => {
  const project = await projectManager.getProject(projectId);
  return JSON.stringify(project, null, 2);
});
```

**2. Preload API 노출**
**파일**: `src/preload/preload.ts`

```typescript
contextBridge.exposeInMainWorld('electron', {
  // 기존 API...
  exportProject: (projectId: string): Promise<string> => 
    ipcRenderer.invoke('project:export', projectId)
});
```

**3. 타입 정의 추가**
**파일**: `src/types/electron.d.ts`

```typescript
interface ElectronAPI {
  // 기존 API...
  exportProject: (projectId: string) => Promise<string>;
}
```

**4. Renderer에서 사용**
**파일**: `src/renderer/components/ProjectSettings.tsx`

```typescript
const handleExport = async () => {
  const data = await window.electron.exportProject(projectId);
  // 파일로 저장 또는 클립보드 복사
};
```

### 이벤트 기반 통신 (Main → Renderer)

**1. Main에서 이벤트 발송**
**파일**: `src/main/main.ts`

```typescript
// 프로젝트 상태 변경 시
mainWindow.webContents.send('project:status', {
  projectId: 'abc',
  status: 'running'
});
```

**2. Preload에서 리스너 등록**
**파일**: `src/preload/preload.ts`

```typescript
contextBridge.exposeInMainWorld('electron', {
  // 기존 API...
  onProjectStatus: (callback: (data: { projectId: string; status: string }) => void) => {
    ipcRenderer.on('project:status', (event, data) => callback(data));
  }
});
```

**3. 타입 정의**
**파일**: `src/types/electron.d.ts`

```typescript
interface ElectronAPI {
  // 기존 API...
  onProjectStatus: (callback: (data: { projectId: string; status: string }) => void) => void;
}
```

**4. Renderer에서 구독**
**파일**: `src/renderer/app.tsx`

```typescript
useEffect(() => {
  window.electron.onProjectStatus((data) => {
    console.log(`Project ${data.projectId} is ${data.status}`);
    // 상태 업데이트
  });
}, []);
```

## 데이터 영속화

### 프로젝트 데이터 저장
**파일**: `src/main/projectManager.ts`

```typescript
import { app } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';

const PROJECTS_FILE = path.join(app.getPath('userData'), 'projects.json');

export async function saveProjects(projects: Project[]): Promise<void> {
  await fs.ensureDir(path.dirname(PROJECTS_FILE));
  await fs.writeJson(PROJECTS_FILE, projects, { spaces: 2 });
}

export async function loadProjects(): Promise<Project[]> {
  if (await fs.pathExists(PROJECTS_FILE)) {
    return await fs.readJson(PROJECTS_FILE);
  }
  return [];
}
```

### 설정 파일 관리
**파일**: `src/main/projectConfig.ts`

```typescript
const CONFIG_DIR = path.join(app.getPath('userData'), 'configs');

export async function saveConfig(projectId: string, config: any): Promise<void> {
  const configFile = path.join(CONFIG_DIR, `${projectId}.json`);
  await fs.ensureDir(CONFIG_DIR);
  await fs.writeJson(configFile, config, { spaces: 2 });
}

export async function loadConfig(projectId: string): Promise<any> {
  const configFile = path.join(CONFIG_DIR, `${projectId}.json`);
  if (await fs.pathExists(configFile)) {
    return await fs.readJson(configFile);
  }
  return {};
}
```

## 에러 처리

### Main Process 에러
**파일**: `src/main/main.ts`

```typescript
ipcMain.handle('project:load', async (): Promise<Project[]> => {
  try {
    return await projectManager.loadProjects();
  } catch (error) {
    console.error('Failed to load projects:', error);
    // 에러를 Renderer로 전달
    throw new Error('프로젝트를 불러올 수 없습니다.');
  }
});
```

### Renderer 에러
**파일**: `src/renderer/components/ProjectList.tsx`

```typescript
const loadProjects = async () => {
  try {
    const projects = await window.electron.loadProjects();
    setProjects(projects);
  } catch (error) {
    console.error('Load failed:', error);
    // 사용자에게 알림
    alert(error instanceof Error ? error.message : '알 수 없는 오류');
  }
};
```

### CLI 프로세스 에러
**파일**: `src/main/kiroCliManager.ts`

```typescript
ptyProcess.onData((data: string) => {
  if (data.includes('ERROR') || data.includes('error')) {
    mainWindow.webContents.send('kiro:error', {
      projectId,
      error: data
    });
  } else {
    mainWindow.webContents.send('kiro:output', {
      projectId,
      data
    });
  }
});
```

## 빌드 및 배포

### 개발 빌드
```bash
npm run build
npm run dev
```

### 프로덕션 빌드
```bash
npm run build
npm run package
```

### 빌드 설정 변경
**파일**: `package.json`

```json
{
  "build": {
    "appId": "com.aws.kirodesk",
    "productName": "KiroDesk",
    "files": [
      "dist/**/*",
      "package.json"
    ],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "assets/icon.ico"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "icon": "assets/icon.icns"
    }
  }
}
```

## 디버깅

### Main Process 디버깅
```typescript
// main.ts
console.log('Main process:', data);

// 터미널에서 확인
npm run dev
```

### Renderer Process 디버깅
```typescript
// app.tsx
console.log('Renderer:', data);

// DevTools에서 확인 (자동으로 열림)
```

### IPC 통신 디버깅
```typescript
// Main
ipcMain.handle('project:load', async () => {
  console.log('[IPC] project:load called');
  const result = await projectManager.loadProjects();
  console.log('[IPC] project:load result:', result);
  return result;
});

// Renderer
const projects = await window.electron.loadProjects();
console.log('[IPC] Received projects:', projects);
```

## 성능 최적화

### React 리렌더링 최적화
```typescript
// 메모이제이션
const ChatMessage = React.memo(({ message }: Props) => {
  return <div>{message.content}</div>;
});

// useCallback
const handleSend = useCallback((message: string) => {
  sendMessage(projectId, message);
}, [projectId]);

// useMemo
const sortedProjects = useMemo(() => {
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}, [projects]);
```

### 대용량 메시지 처리
```typescript
// 최근 N개만 렌더링
const MAX_VISIBLE_MESSAGES = 100;
const visibleMessages = messages.slice(-MAX_VISIBLE_MESSAGES);

return (
  <div>
    {visibleMessages.map(msg => (
      <ChatMessage key={msg.id} message={msg} />
    ))}
  </div>
);
```

### CLI 출력 버퍼링
```typescript
// 출력을 버퍼링하여 한 번에 전송
let buffer = '';
let timeout: NodeJS.Timeout;

ptyProcess.onData((data: string) => {
  buffer += data;
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    mainWindow.webContents.send('kiro:output', {
      projectId,
      data: buffer
    });
    buffer = '';
  }, 100);
});
```
