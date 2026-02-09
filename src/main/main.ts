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
  
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  if (process.platform === 'darwin') {
    createMacMenu();
  }
}

function createMacMenu(): void {
  const template: any = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray(): void {
  if (process.platform === 'darwin') {
    const trayPath = path.join(__dirname, '../../assets/tray-icon.png');
    if (!fs.existsSync(trayPath)) {
      return;
    }
    tray = new Tray(trayPath);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show KiroDesk', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]);
    tray.setContextMenu(contextMenu);
    tray.setToolTip('KiroDesk');
  }
}

app.whenReady().then(async () => {
  await projectManager.init();
  setupIpcHandlers();
  createWindow();
  createTray();

  if (process.platform === 'win32') {
    setupWindowsJumpList();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

nativeTheme.on('updated', () => {
  mainWindow?.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
});

async function setupWindowsJumpList() {
  const projects = await projectManager.getProjects();
  const recentProjects = projects.slice(0, 5).map(p => ({
    type: 'task' as const,
    program: process.execPath,
    args: `--project=${p.id}`,
    title: p.name,
    description: p.path
  }));

  app.setJumpList([
    {
      type: 'custom',
      name: 'Recent Projects',
      items: recentProjects
    }
  ]);
}

function setupIpcHandlers() {
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('create-project', async (_, name: string, projectPath: string, type: 'maintenance' | 'new-development') => {
    await kiroCliManager.initProject(projectPath, type);
    const project = await projectManager.addProject(name, projectPath, type);
    if (process.platform === 'win32') {
      await setupWindowsJumpList();
    }
    return project;
  });

  ipcMain.handle('get-projects', async () => {
    return await projectManager.getProjects();
  });

  ipcMain.handle('update-project-main-agent', async (_event, id: string, mainAgent: string) => {
    await projectManager.updateMainAgent(id, mainAgent);
  });

  ipcMain.handle('delete-project', async (_, id: string) => {
    await projectManager.deleteProject(id);
    if (process.platform === 'win32') {
      await setupWindowsJumpList();
    }
  });

  ipcMain.handle('init-session', (event, projectId: string, projectPath: string, agent: string) => {
    console.log(`[Main] Initializing session for project ${projectId}`);
    return new Promise((resolve) => {
      kiroCliManager.initSession(
        projectId,
        { projectPath, agent, message: '' },
        () => {
          console.log(`[Main] Session ready for ${projectId}`);
          resolve({ ready: true });
        },
        (data) => {
          event.sender.send('cli-output', projectId, data);
        },
        (error) => {
          console.log(`[Main] Session error for ${projectId}:`, error);
          event.sender.send('cli-error', projectId, error);
          resolve({ ready: false, error });
        }
      );
    });
  });

  ipcMain.handle('send-message', (event, projectId: string, projectPath: string, agent: string, message: string) => {
    console.log(`[Main] Sending message for project ${projectId}: ${message}`);
    try {
      kiroCliManager.executeCommand(
        projectId,
        { projectPath, agent, message },
        (data) => {
          console.log(`[Main] Output for ${projectId}:`, data.substring(0, 100));
          event.sender.send('cli-output', projectId, data);
        },
        (error) => {
          console.log(`[Main] Error for ${projectId}:`, error);
          event.sender.send('cli-error', projectId, error);
        }
      );
    } catch (error: any) {
      event.sender.send('cli-error', projectId, error?.message || 'Failed to send message');
    }
  });

  ipcMain.handle('get-project-config', async (_event, projectPath: string) => {
    return await projectConfigManager.load(projectPath);
  });

  ipcMain.handle('save-project-agents', async (_event, projectPath: string, agents: any[]) => {
    await projectConfigManager.saveAgents(projectPath, agents);
  });

  ipcMain.handle('save-project-files', async (_event, projectPath: string, kind: 'skills' | 'steering', files: any[]) => {
    await projectConfigManager.saveFiles(projectPath, kind, files);
  });

  ipcMain.handle('save-project-meta', async (_event, projectPath: string, meta: any) => {
    await projectConfigManager.saveMeta(projectPath, meta);
  });

  ipcMain.handle('stop-command', () => {
    kiroCliManager.stopCommand();
  });

  ipcMain.handle('get-theme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  ipcMain.handle('window-minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.handle('window-close', () => {
    mainWindow.close();
  });

  ipcMain.handle('kiro-auth-status', async () => {
    return kiroCliManager.getAuthStatus();
  });

  ipcMain.handle('kiro-login', async () => {
    return kiroCliManager.login();
  });

  ipcMain.handle('kiro-logout', async () => {
    return kiroCliManager.logout();
  });
}
