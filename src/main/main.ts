import { app, BrowserWindow, ipcMain, dialog, nativeTheme, Menu, Tray } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { projectManager } from './projectManager';
import { kiroCliManager } from './kiroCliManager';
import { projectConfigManager } from './projectConfig';

let mainWindow: BrowserWindow;
let tray: Tray | null = null;

function createWindow(): void {
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    },
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    frame: !isMac,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff'
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools();
  if (process.platform === 'darwin') createMacMenu();
}

function createMacMenu(): void {
  const template: any = [
    { label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray(): void {
  if (process.platform === 'darwin') {
    const trayPath = path.join(__dirname, '../../assets/tray-icon.png');
    if (!fs.existsSync(trayPath)) return;
    tray = new Tray(trayPath);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show KiroDesk', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]));
    tray.setToolTip('KiroDesk');
  }
}

app.whenReady().then(async () => {
  await projectManager.init();
  setupIpcHandlers();
  createWindow();
  createTray();
  if (process.platform === 'win32') setupWindowsJumpList();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
nativeTheme.on('updated', () => { mainWindow?.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors); });

async function setupWindowsJumpList() {
  const projects = await projectManager.getProjects();
  app.setJumpList([{
    type: 'custom', name: 'Recent Projects',
    items: projects.slice(0, 5).map(p => ({ type: 'task' as const, program: process.execPath, args: `--project=${p.id}`, title: p.name, description: p.path }))
  }]);
}

function setupIpcHandlers() {
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('create-project', async (event, name: string, projectPath: string, type: 'maintenance' | 'new-development') => {
    await kiroCliManager.initProject(projectPath, type);
    const project = await projectManager.addProject(name, projectPath, type);
    event.sender.send('project-setup-progress', project.id, 'starting');
    kiroCliManager.setupProjectWithMetaAgent(projectPath, type,
      (progress) => { event.sender.send('project-setup-progress', project.id, progress); },
      async (success, error) => {
        if (success) {
          try {
            const config = await projectConfigManager.load(projectPath);
            if (config.agents.length > 0) await projectManager.updateMainAgent(project.id, config.agents[0].name);
          } catch {}
        }
        event.sender.send('project-setup-done', project.id, success, error || null);
        if (process.platform === 'win32') await setupWindowsJumpList();
      }
    );
    return project;
  });

  ipcMain.handle('get-projects', () => projectManager.getProjects());
  ipcMain.handle('update-project-main-agent', (_, id: string, mainAgent: string) => projectManager.updateMainAgent(id, mainAgent));

  ipcMain.handle('delete-project', async (_, id: string) => {
    await projectManager.deleteProject(id);
    if (process.platform === 'win32') await setupWindowsJumpList();
  });

  ipcMain.handle('init-session', () => ({ ready: true }));

  ipcMain.handle('send-message', (event, projectId: string, projectPath: string, agent: string, message: string) => {
    console.log(`[Main] Sending message for project ${projectId}: ${message}`);
    kiroCliManager.sendMessage(
      projectId,
      { projectPath, agent, message },
      (data) => { event.sender.send('cli-output', projectId, data); },
      (status) => { event.sender.send('cli-status', projectId, status); },
      (error) => { event.sender.send('cli-error', projectId, error); },
      () => { event.sender.send('cli-done', projectId); }
    );
  });

  ipcMain.handle('reset-session', (_, projectPath: string) => { kiroCliManager.resetSession(projectPath); });
  ipcMain.handle('get-project-config', (_, projectPath: string) => projectConfigManager.load(projectPath));
  ipcMain.handle('save-project-agents', (_, projectPath: string, agents: any[]) => projectConfigManager.saveAgents(projectPath, agents));
  ipcMain.handle('save-project-files', (_, projectPath: string, kind: 'skills' | 'steering', files: any[]) => projectConfigManager.saveFiles(projectPath, kind, files));
  ipcMain.handle('save-project-meta', (_, projectPath: string, meta: any) => projectConfigManager.saveMeta(projectPath, meta));
  ipcMain.handle('stop-command', (_, projectId?: string) => { kiroCliManager.stopCommand(projectId); });
  ipcMain.handle('get-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
  ipcMain.handle('window-minimize', () => { mainWindow.minimize(); });
  ipcMain.handle('window-maximize', () => { mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
  ipcMain.handle('window-close', () => { mainWindow.close(); });
  ipcMain.handle('kiro-auth-status', () => kiroCliManager.getAuthStatus());
  ipcMain.handle('kiro-login', () => kiroCliManager.login());
  ipcMain.handle('kiro-logout', () => kiroCliManager.logout());
}
