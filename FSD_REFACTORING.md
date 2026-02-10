# Feature-Sliced Design 리팩토링 가이드

## 현재 구조의 문제점
- app.tsx에 모든 로직이 집중 (400+ 줄)
- Context, Hook, UI가 한 파일에 혼재
- 재사용 가능한 로직이 분리되지 않음

## 새로운 FSD 구조

```
src/
├── app/                          # 앱 초기화
│   └── index.tsx                 # 진입점, Provider 구성
│
├── entities/                     # 비즈니스 엔티티
│   ├── project/
│   │   └── model/
│   │       └── use-projects.ts   # 프로젝트 CRUD hook
│   ├── auth/
│   │   └── model/
│   │       └── use-auth.ts       # 인증 관리 hook
│   └── chat/
│       └── model/
│           └── conversation-context.tsx  # 대화 상태 관리
│
├── widgets/                      # 복합 UI 블록
│   ├── project-list/             # 프로젝트 목록 (기존 ProjectList)
│   ├── chat-interface/           # 채팅 인터페이스 (기존 ChatInterface)
│   ├── settings-panel/           # 설정 패널 (기존 Settings)
│   └── index.ts                  # 재export
│
├── shared/                       # 공유 코드
│   ├── types/
│   │   ├── project.ts            # Project, Message 타입
│   │   └── auth.ts               # AuthStatus 타입
│   ├── lib/
│   │   ├── i18n.ts               # i18n 유틸리티
│   │   ├── i18n-context.tsx      # i18n Context Provider
│   │   └── translations.ts       # 번역 데이터
│   └── ui/
│       └── title-bar.tsx         # 타이틀바 컴포넌트
│
├── main/                         # Electron main process (변경 없음)
├── preload/                      # Electron preload (변경 없음)
└── types/                        # TypeScript 타입 정의 (변경 없음)
```

## 리팩토링 단계

### 1단계: 공유 타입 분리 ✅ 완료
- `src/shared/types/project.ts` - Project, Message
- `src/shared/types/auth.ts` - AuthStatus

### 2단계: Context 분리 ✅ 완료
- `src/shared/lib/i18n-context.tsx` - I18n Provider
- `src/entities/chat/model/conversation-context.tsx` - Conversation Provider

### 3단계: 비즈니스 로직 Hook 분리 ✅ 완료
- `src/entities/project/model/use-projects.ts` - 프로젝트 관리
- `src/entities/auth/model/use-auth.ts` - 인증 관리

### 4단계: UI 컴포넌트 분리 ✅ 완료
- `src/shared/ui/title-bar.tsx` - 타이틀바

### 5단계: app.tsx 리팩토링 (수동 작업 필요)

기존 `src/renderer/app.tsx`를 다음과 같이 수정:

```typescript
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, useI18n } from '../shared/lib/i18n-context';
import { ConversationProvider } from '../entities/chat/model/conversation-context';
import { useProjects } from '../entities/project/model/use-projects';
import { useAuth } from '../entities/auth/model/use-auth';
import { TitleBar } from '../shared/ui/title-bar';
import ProjectList from './components/ProjectList';
import ChatInterface from './components/ChatInterface';
import Settings from './components/Settings';
import CreateProject from './components/CreateProject';
import ProjectSettings from './components/ProjectSettings';
import { Project } from '../shared/types/project';
import './styles.css';

// 기존 export 유지 (하위 호환성)
export { useI18n } from '../shared/lib/i18n-context';
export { useConversation } from '../entities/chat/model/conversation-context';

const App: React.FC = () => {
  const isMac = window.electronAPI.platform === 'darwin';
  const { projects, createProject, deleteProject } = useProjects();
  const { authStatus, login, logout } = useAuth();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [projectSettingsProject, setProjectSettingsProject] = useState<Project | null>(null);

  const handleCreateProject = async (name: string, path: string, type: 'maintenance' | 'new-development') => {
    await createProject(name, path, type);
    setShowCreateProject(false);
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProject(id);
    if (selectedProject?.id === id) setSelectedProject(null);
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setShowSettings(false);
    setShowCreateProject(false);
    setProjectSettingsProject(null);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <TitleBar isMac={isMac} />
      
      <div className="flex flex-1 overflow-hidden">
        {/* 사이드바 */}
        <div className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="p-3 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              KiroDesk
            </h2>
            <button 
              onClick={() => {
                setShowCreateProject(true);
                setShowSettings(false);
                setSelectedProject(null);
              }}
              className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors group"
            >
              <svg className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          
          <ProjectList 
            projects={projects}
            selectedProject={showSettings ? null : selectedProject}
            onSelect={handleSelectProject}
            onDelete={handleDeleteProject}
            onOpenSettings={(project) => {
              setSelectedProject(project);
              setProjectSettingsProject(project);
              setShowSettings(false);
              setShowCreateProject(false);
            }}
          />
          
          <div className="p-3 border-t border-gray-700">
            <button
              onClick={() => {
                setShowSettings(true);
                setSelectedProject(null);
                setShowCreateProject(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-700 transition-colors text-left"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-medium">설정</span>
            </button>
          </div>
        </div>
        
        {/* 메인 컨텐츠 */}
        <div className="flex-1 flex flex-col">
          {showSettings ? (
            <Settings
              onClose={() => setShowSettings(false)}
              authStatus={authStatus}
              onLogin={login}
              onLogout={logout}
            />
          ) : showCreateProject ? (
            <CreateProject 
              onCancel={() => setShowCreateProject(false)}
              onCreate={handleCreateProject}
            />
          ) : projectSettingsProject ? (
            <ProjectSettings
              project={projectSettingsProject}
              onClose={() => setProjectSettingsProject(null)}
            />
          ) : selectedProject ? (
            <ChatInterface project={selectedProject} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <svg className="w-24 h-24 mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <h3 className="text-xl font-semibold mb-2">KiroDesk에 오신 것을 환영합니다</h3>
              <p className="text-gray-600">프로젝트를 선택하거나 새로 만들어 시작하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <I18nProvider>
    <ConversationProvider>
      <App />
    </ConversationProvider>
  </I18nProvider>
);
```

## 주요 변경사항

### Before (기존)
- app.tsx: 400+ 줄, 모든 로직 포함
- Context, State, UI가 혼재
- 재사용 불가능한 구조

### After (FSD)
- app.tsx: 150 줄, UI 구성만 담당
- 로직은 custom hooks로 분리
- Context는 Provider로 분리
- 타입은 shared/types로 분리
- 재사용 가능한 모듈 구조

## 장점

1. **관심사 분리**: 각 레이어가 명확한 책임을 가짐
2. **재사용성**: hooks와 컴포넌트를 다른 곳에서도 사용 가능
3. **테스트 용이성**: 각 모듈을 독립적으로 테스트 가능
4. **유지보수성**: 변경 영향 범위가 명확함
5. **확장성**: 새로운 기능 추가 시 구조가 명확함

## 다음 단계 (선택사항)

1. 기존 컴포넌트들도 widgets로 이동
2. 각 widget 내부를 features로 세분화
3. API 호출 로직을 shared/api로 분리
4. 공통 UI 컴포넌트를 shared/ui로 확장
