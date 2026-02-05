import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import ProjectList from './components/ProjectList';
import ChatInterface from './components/ChatInterface';
import CreateProject from './components/CreateProject';
import Settings from './components/Settings';
import ChatGrid from './components/ChatGrid';
import { translations, Language } from './i18n';
import './styles.css';

interface Project {
  id: string;
  name: string;
  path: string;
  type: 'maintenance' | 'new-development';
  mainAgent: string;
  lastAccess: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.ko) => string;
}

interface ConversationContextType {
  conversations: Map<string, Message[]>;
  loadingProjects: Set<string>;
  getConversation: (projectId: string) => Message[];
  setConversation: (projectId: string, updater: Message[] | ((prev: Message[]) => Message[])) => void;
  isLoading: (projectId: string) => boolean;
  setLoading: (projectId: string, loading: boolean) => void;
}

const I18nContext = createContext<I18nContextType>({
  language: 'ko',
  setLanguage: () => {},
  t: (key) => key
});

const ConversationContext = createContext<ConversationContextType>({
  conversations: new Map(),
  loadingProjects: new Set(),
  getConversation: () => [],
  setConversation: () => {},
  isLoading: () => false,
  setLoading: () => {}
});

export const useI18n = () => useContext(I18nContext);
export const useConversation = () => useContext(ConversationContext);

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [language, setLanguage] = useState<Language>('ko');
  const [gridCells, setGridCells] = useState<Array<{projects: Project[], activeProjectId: string | null}>>([
    {projects: [], activeProjectId: null},
    {projects: [], activeProjectId: null},
    {projects: [], activeProjectId: null},
    {projects: [], activeProjectId: null}
  ]);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [draggedFromGrid, setDraggedFromGrid] = useState<number | null>(null);
  const conversationsRef = useRef<Map<string, Message[]>>(new Map());
  const loadingProjectsRef = useRef<Set<string>>(new Set());
  const [, forceUpdate] = useState({});

  const t = (key: keyof typeof translations.ko) => translations[language][key];

  const getConversation = (projectId: string): Message[] => {
    return conversationsRef.current.get(projectId) || [];
  };

  const setConversation = (projectId: string, updater: Message[] | ((prev: Message[]) => Message[])) => {
    const currentMessages = conversationsRef.current.get(projectId) || [];
    const newMessages = typeof updater === 'function' ? updater(currentMessages) : updater;
    conversationsRef.current.set(projectId, newMessages);
    forceUpdate({});
  };

  const isLoading = (projectId: string): boolean => {
    return loadingProjectsRef.current.has(projectId);
  };

  const setLoading = (projectId: string, loading: boolean) => {
    if (loading) {
      loadingProjectsRef.current.add(projectId);
    } else {
      loadingProjectsRef.current.delete(projectId);
    }
    forceUpdate({});
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const data = await window.electronAPI.getProjects();
    setProjects(data);
  };

  const handleCreateProject = async (name: string, path: string, type: 'maintenance' | 'new-development') => {
    await window.electronAPI.createProject(name, path, type);
    await loadProjects();
    setShowCreateProject(false);
  };

  const handleDeleteProject = async (id: string) => {
    await window.electronAPI.deleteProject(id);
    if (selectedProject?.id === id) setSelectedProject(null);
    setGridCells(prev => prev.map(cell => ({
      projects: cell.projects.filter(p => p.id !== id),
      activeProjectId: cell.activeProjectId === id ? (cell.projects.filter(p => p.id !== id)[0]?.id || null) : cell.activeProjectId
    })));
    conversationsRef.current.delete(id);
    await loadProjects();
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setShowSettings(false);
    setShowCreateProject(false);
    
    // 첫 번째 빈 그리드에 추가
    setGridCells(prev => {
      const emptyIndex = prev.findIndex(cell => cell.projects.length === 0);
      if (emptyIndex !== -1) {
        const newCells = [...prev];
        newCells[emptyIndex] = { projects: [project], activeProjectId: project.id };
        return newCells;
      }
      // 빈 그리드 없으면 첫 번째 그리드에 추가
      const newCells = [...prev];
      if (!newCells[0].projects.find(p => p.id === project.id)) {
        newCells[0] = { 
          projects: [...newCells[0].projects, project], 
          activeProjectId: project.id 
        };
      } else {
        newCells[0].activeProjectId = project.id;
      }
      return newCells;
    });
  };

  const handleTabClose = (gridIndex: number, projectId: string) => {
    setGridCells(prev => {
      const newCells = [...prev];
      const cell = newCells[gridIndex];
      const newProjects = cell.projects.filter(p => p.id !== projectId);
      newCells[gridIndex] = {
        projects: newProjects,
        activeProjectId: cell.activeProjectId === projectId ? (newProjects[0]?.id || null) : cell.activeProjectId
      };
      return newCells;
    });
  };

  const handleTabSelect = (gridIndex: number, projectId: string) => {
    setGridCells(prev => {
      const newCells = [...prev];
      newCells[gridIndex] = { ...newCells[gridIndex], activeProjectId: projectId };
      return newCells;
    });
  };

  const handleTabDragStart = (gridIndex: number, projectId: string) => {
    setDraggedTabId(projectId);
    setDraggedFromGrid(gridIndex);
  };

  const handleGridDrop = (targetIndex: number) => {
    if (!draggedTabId || draggedFromGrid === null) return;
    
    setGridCells(prev => {
      const newCells = [...prev];
      const sourceCell = newCells[draggedFromGrid];
      const project = sourceCell.projects.find(p => p.id === draggedTabId);
      if (!project) return prev;
      
      // 같은 그리드면 무시
      if (draggedFromGrid === targetIndex) return prev;
      
      // 소스에서 제거
      newCells[draggedFromGrid] = {
        projects: sourceCell.projects.filter(p => p.id !== draggedTabId),
        activeProjectId: sourceCell.activeProjectId === draggedTabId ? 
          (sourceCell.projects.filter(p => p.id !== draggedTabId)[0]?.id || null) : 
          sourceCell.activeProjectId
      };
      
      // 타겟에 추가
      const targetCell = newCells[targetIndex];
      if (!targetCell.projects.find(p => p.id === draggedTabId)) {
        newCells[targetIndex] = {
          projects: [...targetCell.projects, project],
          activeProjectId: project.id
        };
      }
      
      return newCells;
    });
    
    setDraggedTabId(null);
    setDraggedFromGrid(null);
    setSelectedProject(null);
  };

  const handleGridClose = (index: number) => {
    setGridCells(prev => {
      const newCells = [...prev];
      newCells[index] = { projects: [], activeProjectId: null };
      return newCells;
    });
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      <ConversationContext.Provider value={{ 
        conversations: conversationsRef.current, 
        loadingProjects: loadingProjectsRef.current,
        getConversation, 
        setConversation,
        isLoading,
        setLoading
      }}>
      <div className="flex flex-col h-screen bg-gray-900">
        {/* Custom Title Bar */}
        <div className="h-8 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 select-none" style={{WebkitAppRegion: 'drag'} as any}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              {t('appName')}
            </span>
          </div>
          <div className="flex items-center gap-1" style={{WebkitAppRegion: 'no-drag'} as any}>
            <button
              onClick={() => window.electronAPI.windowMinimize()}
              className="w-12 h-8 flex items-center justify-center hover:bg-gray-700 transition-colors"
              title="Minimize"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
                <rect x="0" y="5" width="10" height="1" />
              </svg>
            </button>
            <button
              onClick={() => window.electronAPI.windowMaximize()}
              className="w-12 h-8 flex items-center justify-center hover:bg-gray-700 transition-colors"
              title="Maximize"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 10 10">
                <rect x="0" y="0" width="10" height="10" />
              </svg>
            </button>
            <button
              onClick={() => window.electronAPI.windowClose()}
              className="w-12 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
              title="Close"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
                <polygon points="11,1.576 10.424,1 6,5.424 1.576,1 1,1.576 5.424,6 1,10.424 1.576,11 6,6.576 10.424,11 11,10.424 6.576,6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              {t('appName')}
            </h2>
            <button 
              onClick={() => {
                setShowCreateProject(true);
                setShowSettings(false);
                setSelectedProject(null);
              }}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors group"
              title={t('newProject')}
            >
              <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <ProjectList 
            projects={projects}
            selectedProject={showSettings ? null : selectedProject}
            onSelect={handleSelectProject}
            onDelete={handleDeleteProject}
          />
          <div className="p-4 border-t border-gray-700">
            <button
              onClick={() => {
                setShowSettings(true);
                setSelectedProject(null);
                setShowCreateProject(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors text-left"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium">{t('settings')}</span>
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          {showSettings ? (
            <Settings onClose={() => setShowSettings(false)} />
          ) : showCreateProject ? (
            <CreateProject 
              onCancel={() => setShowCreateProject(false)}
              onCreate={handleCreateProject}
            />
          ) : (
            <div className="flex flex-col h-full">
              {draggedTabId !== null ? (
                <ChatGrid
                  gridCells={gridCells}
                  isDragging={true}
                  draggedTabId={draggedTabId}
                  draggedFromGrid={draggedFromGrid}
                  onDrop={handleGridDrop}
                  onClose={handleGridClose}
                  onTabClose={handleTabClose}
                  onTabSelect={handleTabSelect}
                  onTabDragStart={handleTabDragStart}
                />
              ) : gridCells.some(cell => cell.projects.length > 0) ? (
                <ChatGrid
                  gridCells={gridCells}
                  isDragging={false}
                  draggedTabId={null}
                  draggedFromGrid={null}
                  onDrop={handleGridDrop}
                  onClose={handleGridClose}
                  onTabClose={handleTabClose}
                  onTabSelect={handleTabSelect}
                  onTabDragStart={handleTabDragStart}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                  <svg className="w-24 h-24 mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <h3 className="text-xl font-semibold mb-2">{t('welcome')}</h3>
                  <p className="text-gray-600">{t('welcomeDesc')}</p>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
      </ConversationContext.Provider>
    </I18nContext.Provider>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
