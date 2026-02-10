import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../shared/lib/i18n-context';
import { ConversationProvider } from '../entities/chat/model/conversation-context';
import { useProjects } from '../entities/project/model/use-projects';
import { useAuth } from '../entities/auth/model/use-auth';
import { TitleBar } from '../shared/ui/title-bar';
import { ProjectList, ChatInterface, Settings, CreateProject, ProjectSettings } from '../widgets';
import { Project } from '../shared/types/project';
import '../renderer/styles.css';

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
