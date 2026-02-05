import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';

export interface KiroCliOptions {
  projectPath: string;
  agent: string;
  message: string;
}

export class KiroCliManager {
  private activeProcesses: Map<string, ChildProcess> = new Map();

  async initProject(projectPath: string, type: 'maintenance' | 'new-development'): Promise<void> {
    const kiroDir = path.join(projectPath, '.kiro');
    const agentsDir = path.join(kiroDir, 'agents');
    
    await fs.ensureDir(agentsDir);

    if (type === 'maintenance') {
      await fs.writeJson(path.join(agentsDir, 'pm.json'), {
        name: 'pm_agent',
        description: 'Project Manager for maintenance tasks',
        prompt: 'You are a project manager coordinating maintenance work.'
      });
      await fs.writeJson(path.join(agentsDir, 'analyst.json'), {
        name: 'analyst_agent',
        description: 'Code Analyst for review and analysis',
        prompt: 'You are a code analyst reviewing and analyzing code.'
      });
      await fs.writeJson(path.join(agentsDir, 'coder.json'), {
        name: 'coder_agent',
        description: 'Developer for implementation',
        prompt: 'You are a developer implementing code changes.'
      });
    } else {
      await fs.writeJson(path.join(agentsDir, 'pm.json'), {
        name: 'pm_agent',
        description: 'Project Manager for new development',
        prompt: 'You are a project manager coordinating new development.'
      });
      await fs.writeJson(path.join(agentsDir, 'architect.json'), {
        name: 'architect_agent',
        description: 'System Architect for design',
        prompt: 'You are a system architect designing the system.'
      });
    }

    await fs.writeJson(path.join(kiroDir, 'config.json'), {
      projectPath,
      type,
      createdAt: new Date().toISOString()
    });
  }

  executeCommand(projectId: string, options: KiroCliOptions, onData: (data: string) => void, onError: (error: string) => void): void {
    if (this.activeProcesses.has(projectId)) {
      this.activeProcesses.get(projectId)?.kill();
    }

    const isWindows = process.platform === 'win32';
    let command: string;
    let args: string[];

    if (isWindows) {
      const wslPath = options.projectPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (match, drive) => 
        `/mnt/${drive.toLowerCase()}`
      );
      const kiroCliPath = '/home/blake/.local/bin/kiro-cli';
      const escapedMessage = options.message.replace(/"/g, '\\"').replace(/\$/g, '\\$');
      command = 'wsl';
      args = ['-e', 'bash', '-c', `export LANG=C.UTF-8 && cd "${wslPath}" && ${kiroCliPath} chat --agent ${options.agent} "${escapedMessage}"`];
    } else {
      command = 'kiro-cli';
      args = ['chat', '--agent', options.agent, options.message];
    }

    const proc = spawn(command, args, {
      shell: false,
      env: { ...process.env },
      windowsHide: true
    });

    this.activeProcesses.set(projectId, proc);

    const stripAnsi = (str: string) => {
      // ANSI escape sequences만 제거하고 공백과 줄바꿈은 유지
      return str
        .replace(/\x1b\[[0-9;]*m/g, '')           // 색상 코드
        .replace(/\x1b\[[0-9;]*[A-HJKSTfhilmnsu]/g, '') // 커서 이동 등
        .replace(/\x1b\][0-9;]*.*?(\x07|\x1b\\)/g, '')  // OSC sequences
        .replace(/\x1b[=>]/g, '')                 // 기타
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // 제어 문자 (탭, 줄바꿈 제외)
    };

    if (proc.stdout) {
      proc.stdout.setEncoding('utf8');
      let buffer = '';
      
      proc.stdout.on('data', (data) => {
        const rawData = data.toString();
        const cleaned = stripAnsi(rawData);
        
        // 필터링된 내용만 전송
        if (cleaned && 
            !cleaned.includes('⠀') && 
            !cleaned.includes('─') &&
            !cleaned.includes('Did you know') &&
            !cleaned.includes('▸ Time:') &&
            !cleaned.includes('Welcome to') &&
            !cleaned.includes('Model:') &&
            !cleaned.includes('Thinking')) {
          onData(cleaned);
        }
      });
    }

    if (proc.stderr) {
      proc.stderr.setEncoding('utf8');
      proc.stderr.on('data', (data) => {
        const cleaned = stripAnsi(data.toString());
        if (cleaned.includes('fatal') || cleaned.includes('Failed') || cleaned.includes('Cannot')) {
          onError(cleaned);
        }
      });
    }

    proc.on('error', (err) => {
      onError(`Failed to start WSL/kiro-cli: ${err.message}`);
      this.activeProcesses.delete(projectId);
    });

    proc.on('close', () => {
      this.activeProcesses.delete(projectId);
    });
  }

  stopCommand(projectId?: string): void {
    if (projectId) {
      if (this.activeProcesses.has(projectId)) {
        this.activeProcesses.get(projectId)?.kill();
        this.activeProcesses.delete(projectId);
      }
    } else {
      // 모든 프로세스 종료
      this.activeProcesses.forEach((proc) => proc.kill());
      this.activeProcesses.clear();
    }
  }
}

export const kiroCliManager = new KiroCliManager();
