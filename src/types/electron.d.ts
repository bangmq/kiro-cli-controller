export interface ElectronAPI {
  platform: NodeJS.Platform;
  selectFolder: () => Promise<string | null>;
  createProject: (name: string, path: string, type: 'maintenance' | 'new-development') => Promise<any>;
  getProjects: () => Promise<any[]>;
  deleteProject: (id: string) => Promise<void>;
  initSession: (projectId: string, projectPath: string, agent: string) => Promise<{ ready: boolean; error?: string }>;
  sendMessage: (projectId: string, projectPath: string, agent: string, message: string) => Promise<void>;
  stopCommand: (projectId?: string) => Promise<void>;
  resetSession: (projectPath: string) => Promise<void>;
  onCliOutput: (callback: (projectId: string, data: string) => void) => void;
  onCliStatus: (callback: (projectId: string, status: string) => void) => void;
  onCliError: (callback: (projectId: string, error: string) => void) => void;
  onCliDone: (callback: (projectId: string) => void) => void;
  onProjectSetupProgress: (callback: (projectId: string, status: string) => void) => void;
  onProjectSetupDone: (callback: (projectId: string, success: boolean, error: string | null) => void) => void;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  kiroAuthStatus: () => Promise<{ loggedIn: boolean; user: string | null; raw: string }>;
  kiroLogin: () => Promise<{ success: boolean; message: string }>;
  kiroLogout: () => Promise<{ success: boolean; message: string }>;
  getProjectConfig: (projectPath: string) => Promise<{
    agents: Array<{ fileName: string; name: string; description: string; prompt: string }>;
    skills: Array<{ fileName: string; content: string }>;
    steering: Array<{ fileName: string; content: string }>;
    meta: {
      mainAgentFile: string | null;
      subAgentFiles: string[];
      agentSkills: Record<string, string[]>;
      agentSteering: Record<string, string[]>;
      mainAgentSubAgents: string[];
    };
  }>;
  saveProjectAgents: (projectPath: string, agents: Array<{ fileName: string; name: string; description: string; prompt: string }>) => Promise<void>;
  saveProjectFiles: (projectPath: string, kind: 'skills' | 'steering', files: Array<{ fileName: string; content: string }>) => Promise<void>;
  saveProjectMeta: (projectPath: string, meta: {
    mainAgentFile: string | null;
    subAgentFiles: string[];
    agentSkills: Record<string, string[]>;
    agentSteering: Record<string, string[]>;
    mainAgentSubAgents: string[];
  }) => Promise<void>;
  updateProjectMainAgent: (projectId: string, mainAgent: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
