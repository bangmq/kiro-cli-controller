import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import ProjectList from './components/ProjectList';
import ChatInterface from './components/ChatInterface';
import CreateProject from './components/CreateProject';
import Settings from './components/Settings';
import ProjectSettings from './components/ProjectSettings';
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

export type SetupStatus = 'starting' | 'analyzing' | 'reading' | 'generating' | 'finalizing' | 'done' | 'error';

export interface ProjectSetupState {
  status: SetupStatus;
  error?: string | null;
}

interface SetupContextType {
  setupStates: Map<string, ProjectSetupState>;
  getSetupState: (projectId: string) => ProjectSetupState | undefined;
}

interface AuthStatus {
  loading: boolean;
  error: string | null;
  loggedIn: boolean;
  user: string | null;
  actionLoading: boolean;
  actionError: string | null;
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

const SetupContext = createContext<SetupContextType>({
  setupStates: new Map(),
  getSetupState: () => undefined
});

export const useI18n = () => useContext(I18nContext);
export const useConversation = () => useContext(ConversationContext);
export const useSetup = () => useContext(SetupContext);

const App: React.FC = () => {
  const isMac = window.electronAPI.platform === 'darwin';
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [projectSettingsProject, setProjectSettingsProject] = useState<Project | null>(null);
  const [language, setLanguage] = useState<Language>('ko');
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    loading: true,
    error: null,
    loggedIn: false,
    user: null,
    actionLoading: false,
    actionError: null
  });
  const conversationsRef = useRef<Map<string, Message[]>>(new Map());
  const loadingProjectsRef = useRef<Set<string>>(new Set());
  const setupStatesRef = useRef<Map<string, ProjectSetupState>>(new Map());
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

  const getSetupState = (projectId: string): ProjectSetupState | undefined => {
    return setupStatesRef.current.get(projectId);
  };

  useEffect(() => {
    window.electronAPI.onProjectSetupProgress((projectId: string, status: string) => {
      setupStatesRef.current.set(projectId, { status: status as SetupStatus });
      forceUpdate({});
    });

    window.electronAPI.onProjectSetupDone((projectId: string, success: boolean, error: string | null) => {
      if (success) {
        setupStatesRef.current.set(projectId, { status: 'done' });
        setTimeout(() => {
          setupStatesRef.current.delete(projectId);
          loadProjects();
          forceUpdate({});
        }, 1500);
      } else {
        setupStatesRef.current.set(projectId, { status: 'error', error });
        setTimeout(() => {
          setupStatesRef.current.delete(projectId);
          forceUpdate({});
        }, 3000);
      }
      forceUpdate({});
    });
  }, []);

  useEffect(() => {
    loadProjects();
    refreshAuthStatus();
  }, []);

  const loadProjects = async () => {
    const data = await window.electronAPI.getProjects();
    setProjects(data);
  };

  const handleDeleteProject = async (id: string) => {
    await window.electronAPI.deleteProject(id);
    if (selectedProject?.id === id) setSelectedProject(null);
    conversationsRef.current.delete(id);
    await loadProjects();
  };

  const refreshAuthStatus = async () => {
    setAuthStatus(prev => ({ ...prev, loading: true, error: null }));
    try {
      const status = await window.electronAPI.kiroAuthStatus();
      setAuthStatus(prev => ({
        ...prev, loading: false, loggedIn: status.loggedIn, user: status.user, error: null
      }));
    } catch {
      setAuthStatus(prev => ({
        ...prev, loading: false, loggedIn: false, user: null, error: t('authError')
      }));
    }
  };

  const handleLogin = async () => {
    setAuthStatus(prev => ({ ...prev, actionLoading: true, actionError: null }));
    const result = await window.electronAPI.kiroLogin();
    if (!result.success) {
      setAuthStatus(prev => ({ ...prev, actionError: result.message || t('loginFailed') }));
    }
    await refreshAuthStatus();
    setAuthStatus(prev => ({ ...prev, actionLoading: false }));
  };

  const handleLogout = async () => {
    setAuthStatus(prev => ({ ...prev, actionLoading: true, actionError: null }));
    const result = await window.electronAPI.kiroLogout();
    if (!result.success) {
      setAuthStatus(prev => ({ ...prev, actionError: result.message || t('logoutFailed') }));
    }
    await refreshAuthStatus();
    setAuthStatus(prev => ({ ...prev, actionLoading: false }));
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setShowSettings(false);
    setShowCreateProject(false);
    setProjectSettingsProject(null);
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      <ConversationContext.Provider value={{ 
        conversations: conversationsRef.current, 
        loadingProjects: loadingProjectsRef.current,
        getConversation, setConversation, isLoading, setLoading
      }}>
      <SetupContext.Provider value={{ setupStates: setupStatesRef.current, getSetupState }}>
      <div className="flex flex-col h-screen bg-gray-900">
        <div className="h-7 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-3 select-none" style={{WebkitAppRegion: 'drag'} as any}>
          <div className={`flex items-center gap-2 ${isMac ? 'pl-14' : ''}`}>
            <span className="text-xs font-semibold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              {t('appName')}
            </span>
          </div>
          {!isMac && (
            <div className="flex items-center gap-1" style={{WebkitAppRegion: 'no-drag'} as any}>
              <button onClick={() => window.electronAPI.windowMinimize()} className="w-10 h-7 flex items-center justify-center hover:bg-gray-700 transition-colors" title="Minimize">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12"><rect x="0" y="5" width="10" height="1" /></svg>
              </button>
              <button onClick={() => window.electronAPI.windowMaximize()} className="w-10 h-7 flex items-center justify-center hover:bg-gray-700 transition-colors" title="Maximize">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" /></svg>
              </button>
              <button onClick={() => window.electronAPI.windowClose()} className="w-10 h-7 flex items-center justify-center hover:bg-red-600 transition-colors" title="Close">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12"><polygon points="11,1.576 10.424,1 6,5.424 1.576,1 1,1.576 5.424,6 1,10.424 1.576,11 6,6.576 10.424,11 11,10.424 6.576,6" /></svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col">
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                {t('appName')}
              </h2>
              <button 
                onClick={() => { setShowCreateProject(true); setShowSettings(false); setSelectedProject(null); }}
                className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors group"
                title={t('newProject')}
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
                onClick={() => { setShowSettings(true); setSelectedProject(null); setShowCreateProject(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-700 transition-colors text-left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium">{t('settings')}</span>
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            {showSettings ? (
              <Settings onClose={() => setShowSettings(false)} authStatus={authStatus} onLogin={handleLogin} onLogout={handleLogout} />
            ) : showCreateProject ? (
              <CreateProject 
                onCancel={() => { setShowCreateProject(false); loadProjects(); }}
                onCreated={() => loadProjects()}
              />
            ) : projectSettingsProject ? (
              <ProjectSettings project={projectSettingsProject} onClose={() => setProjectSettingsProject(null)} />
            ) : (
              <div className="flex flex-col h-full">
                {selectedProject ? (
                  <ChatInterface project={selectedProject} />
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
      </SetupContext.Provider>
      </ConversationContext.Provider>
    </I18nContext.Provider>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
