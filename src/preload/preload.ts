import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  createProject: (name: string, path: string, type: 'maintenance' | 'new-development') => 
    ipcRenderer.invoke('create-project', name, path, type),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  deleteProject: (id: string) => ipcRenderer.invoke('delete-project', id),
  initSession: (projectId: string, projectPath: string, agent: string) =>
    ipcRenderer.invoke('init-session', projectId, projectPath, agent),
  sendMessage: (projectId: string, projectPath: string, agent: string, message: string) => 
    ipcRenderer.invoke('send-message', projectId, projectPath, agent, message),
  stopCommand: () => ipcRenderer.invoke('stop-command'),
  onCliOutput: (callback: (projectId: string, data: string) => void) => 
    ipcRenderer.on('cli-output', (_, projectId, data) => callback(projectId, data)),
  onCliError: (callback: (projectId: string, error: string) => void) => 
    ipcRenderer.on('cli-error', (_, projectId, error) => callback(projectId, error)),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  kiroAuthStatus: () => ipcRenderer.invoke('kiro-auth-status'),
  kiroLogin: () => ipcRenderer.invoke('kiro-login'),
  kiroLogout: () => ipcRenderer.invoke('kiro-logout'),
  getProjectConfig: (projectPath: string) => ipcRenderer.invoke('get-project-config', projectPath),
  saveProjectAgents: (projectPath: string, agents: any[]) => ipcRenderer.invoke('save-project-agents', projectPath, agents),
  saveProjectFiles: (projectPath: string, kind: 'skills' | 'steering', files: any[]) => ipcRenderer.invoke('save-project-files', projectPath, kind, files),
  saveProjectMeta: (projectPath: string, meta: any) => ipcRenderer.invoke('save-project-meta', projectPath, meta),
  updateProjectMainAgent: (projectId: string, mainAgent: string) => ipcRenderer.invoke('update-project-main-agent', projectId, mainAgent)
});
