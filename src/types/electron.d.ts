export interface ElectronAPI {
  selectFolder: () => Promise<string | null>;
  createProject: (name: string, path: string, type: 'maintenance' | 'new-development') => Promise<any>;
  getProjects: () => Promise<any[]>;
  deleteProject: (id: string) => Promise<void>;
  sendMessage: (projectId: string, projectPath: string, agent: string, message: string) => Promise<void>;
  stopCommand: () => Promise<void>;
  onCliOutput: (callback: (projectId: string, data: string) => void) => void;
  onCliError: (callback: (projectId: string, error: string) => void) => void;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}