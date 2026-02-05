import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  createProject: (name: string, path: string, type: 'maintenance' | 'new-development') => 
    ipcRenderer.invoke('create-project', name, path, type),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  deleteProject: (id: string) => ipcRenderer.invoke('delete-project', id),
  sendMessage: (projectId: string, projectPath: string, agent: string, message: string) => 
    ipcRenderer.invoke('send-message', projectId, projectPath, agent, message),
  stopCommand: () => ipcRenderer.invoke('stop-command'),
  onCliOutput: (callback: (projectId: string, data: string) => void) => 
    ipcRenderer.on('cli-output', (_, projectId, data) => callback(projectId, data)),
  onCliError: (callback: (projectId: string, error: string) => void) => 
    ipcRenderer.on('cli-error', (_, projectId, error) => callback(projectId, error)),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close')
});