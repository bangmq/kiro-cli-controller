import { spawn, execSync, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

export interface KiroCliOptions {
  projectPath: string;
  agent: string;
  message: string;
}

interface ActiveProcess {
  proc: ChildProcess;
  projectId: string;
}

export class KiroCliManager {
  private activeProcesses: Map<string, ActiveProcess> = new Map();
  private sessionStarted: Map<string, boolean> = new Map();
  private wslKiroPath: string | null = null;

  private getWslKiroPath(): string {
    if (this.wslKiroPath) return this.wslKiroPath;
    try {
      const result = execSync('wsl -e bash -c "which kiro-cli 2>/dev/null || echo \\$HOME/.local/bin/kiro-cli"', {
        encoding: 'utf8',
        timeout: 3000
      }).trim();
      this.wslKiroPath = result || '$HOME/.local/bin/kiro-cli';
      return this.wslKiroPath;
    } catch {
      this.wslKiroPath = '$HOME/.local/bin/kiro-cli';
      return this.wslKiroPath;
    }
  }

  private resolveKiroCliPath(): string {
    const homeDir = process.env.HOME || os.homedir();
    const candidates = [
      process.env.KIRO_CLI_PATH,
      path.join(homeDir, '.local/bin/kiro-cli'),
      '/usr/local/bin/kiro-cli',
      '/opt/homebrew/bin/kiro-cli',
      '/usr/bin/kiro-cli',
      'kiro-cli'
    ].filter(Boolean) as string[];
    for (const candidate of candidates) {
      if (candidate !== 'kiro-cli' && fs.existsSync(candidate)) {
        try { return fs.realpathSync(candidate); } catch { return candidate; }
      }
    }
    return 'kiro-cli';
  }

  private buildCommand(options: KiroCliOptions): { command: string; args: string[]; cwd?: string } {
    const isWindows = process.platform === 'win32';
    const isFirstMessage = !this.sessionStarted.get(options.projectPath);

    const chatArgs = ['chat', '--no-interactive', '--wrap', 'never'];

    if (isFirstMessage) {
      chatArgs.push('--agent', options.agent);
    } else {
      chatArgs.push('--resume');
    }

    chatArgs.push(options.message);

    if (isWindows) {
      const kiroCliPath = this.getWslKiroPath();
      const wslPath = options.projectPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
      // base64로 메시지를 전달하여 한글 인코딩 보존
      const msgBase64 = Buffer.from(options.message, 'utf8').toString('base64');
      const chatArgsWithoutMsg = chatArgs.slice(0, -1);
      const escapedArgs = chatArgsWithoutMsg.map(a => `'${a.replace(/'/g, `'"'"'`)}'`).join(' ');
      const bashCommand = `cd "${wslPath}" && ${kiroCliPath} ${escapedArgs} "$(echo '${msgBase64}' | base64 -d)"`;
      return {
        command: 'wsl',
        args: ['-e', 'bash', '-c', bashCommand]
      };
    }

    return {
      command: this.resolveKiroCliPath(),
      args: chatArgs,
      cwd: options.projectPath
    };
  }

  private runKiroCli(args: string[], cwd?: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      let command: string;
      let spawnArgs: string[];

      if (isWindows) {
        const kiroCliPath = this.getWslKiroPath();
        const wslCwd = cwd ? cwd.replace(/\\/g, '/').replace(/^([A-Z]):/, (_, d) => `/mnt/${d.toLowerCase()}`) : '';
        const cdCmd = wslCwd ? `cd "${wslCwd}" && ` : '';
        const escapedArgs = args.map(a => `'${a.replace(/'/g, `'"'"'`)}'`).join(' ');
        command = 'wsl';
        spawnArgs = ['-e', 'bash', '-c', `${cdCmd}${kiroCliPath} ${escapedArgs}`];
      } else {
        command = this.resolveKiroCliPath();
        spawnArgs = args;
      }

      const proc = spawn(command, spawnArgs, {
        cwd: isWindows ? undefined : cwd,
        env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }
      });

      let stdout = '';
      let stderr = '';
      proc.stdout?.on('data', (d) => { stdout += d.toString(); });
      proc.stderr?.on('data', (d) => { stderr += d.toString(); });
      proc.on('error', reject);
      proc.on('close', (code) => resolve({ code, stdout, stderr }));
    });
  }

  async getAuthStatus(): Promise<{ loggedIn: boolean; user: string | null; raw: string }> {
    try {
      const result = await this.runKiroCli(['whoami']);
      const output = result.stdout.trim();
      if (result.code === 0 && output) {
        return { loggedIn: true, user: output.split('\n')[0], raw: result.stdout };
      }
      return { loggedIn: false, user: null, raw: result.stderr || result.stdout };
    } catch (err: any) {
      return { loggedIn: false, user: null, raw: err?.message || 'Failed to check auth status' };
    }
  }

  async login(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.runKiroCli(['login']);
      return { success: result.code === 0, message: (result.stdout || result.stderr || '').trim() };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Login failed' };
    }
  }

  async logout(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.runKiroCli(['logout']);
      return { success: result.code === 0, message: (result.stdout || result.stderr || '').trim() };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Logout failed' };
    }
  }

  async initProject(projectPath: string, type: 'maintenance' | 'new-development'): Promise<void> {
    const kiroDir = path.join(projectPath, '.kiro');
    const agentsDir = path.join(kiroDir, 'agents');
    await fs.ensureDir(agentsDir);

    if (type === 'maintenance') {
      await fs.writeJson(path.join(agentsDir, 'pm.json'), {
        name: 'pm_agent', description: 'Project Manager for maintenance tasks',
        prompt: 'You are a project manager coordinating maintenance work.'
      });
      await fs.writeJson(path.join(agentsDir, 'analyst.json'), {
        name: 'analyst_agent', description: 'Code Analyst for review and analysis',
        prompt: 'You are a code analyst reviewing and analyzing code.'
      });
      await fs.writeJson(path.join(agentsDir, 'coder.json'), {
        name: 'coder_agent', description: 'Developer for implementation',
        prompt: 'You are a developer implementing code changes.'
      });
    } else {
      await fs.writeJson(path.join(agentsDir, 'pm.json'), {
        name: 'pm_agent', description: 'Project Manager for new development',
        prompt: 'You are a project manager coordinating new development.'
      });
      await fs.writeJson(path.join(agentsDir, 'architect.json'), {
        name: 'architect_agent', description: 'System Architect for design',
        prompt: 'You are a system architect designing the system.'
      });
    }

    await fs.writeJson(path.join(kiroDir, 'config.json'), {
      projectPath, type, createdAt: new Date().toISOString()
    });
  }

  private stripAnsi(text: string): string {
    return text
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\x1b\[\?[0-9]+[hl]/g, '')
      .replace(/\x1b\[[0-9;]*[A-HJKSTfhilmnsu]/g, '')
      .replace(/\x1b\][0-9];[^\x07]*\x07/g, '')
      .replace(/\x1b\][0-9];[^\x1b]*\x1b\\/g, '')
      .replace(/\[38;5;\d+m/g, '')
      .replace(/\[0m/g, '')
      .replace(/\[1m/g, '')
      .replace(/^>\s*/gm, '');
  }

  private extractResponse(raw: string): string {
    const stripped = this.stripAnsi(raw);
    const lines = stripped.split('\n');
    const filtered = lines.filter(line => {
      const t = line.trim();
      if (!t) return false;
      if (/^Error:/i.test(t)) return false;
      if (/^Model:/i.test(t)) return false;
      if (/^Time:\s*\d+/i.test(t)) return false;
      if (/Time:\s*\d+s\s*$/i.test(t)) {
        // "응답내용 Time: 3s" 형태에서 Time 부분만 제거
        return true;
      }
      if (/Picking up where we left off/i.test(t)) return false;
      if (/Define indexed resources/i.test(t)) return false;
      if (/Welcome to Kiro/i.test(t)) return false;
      if (/^Did you know/i.test(t)) return false;
      if (/^Run \/prompts/i.test(t)) return false;
      if (/^Use \/tangent/i.test(t)) return false;
      if (/enable custom tools with MCP/i.test(t)) return false;
      if (/^[╭╰│═─┌┐└┘├┤┬┴┼⠀]/.test(t)) return false;
      if (/^[💡🔧▸⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(t)) return false;
      if (/^Thinking\.\.\./i.test(t)) return false;
      return true;
    }).map(line => {
      // 라인 끝의 "Time: Xs" 제거
      return line.replace(/\s*▸?\s*Time:\s*\d+s\s*$/i, '').trimEnd();
    });

    return filtered.join('\n').trim();
  }

  sendMessage(
    projectId: string,
    options: KiroCliOptions,
    onData: (data: string) => void,
    onError: (error: string) => void,
    onDone: () => void
  ): void {
    // 이전 프로세스가 아직 실행 중이면 무시
    const existing = this.activeProcesses.get(projectId);
    if (existing) {
      onError('Previous message is still processing.');
      return;
    }

    const { command, args, cwd } = this.buildCommand(options);

    console.log('[KiroCliManager] Spawning:', command, args.join(' ').substring(0, 200));

    const proc = spawn(command, args, {
      cwd,
      env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }
    });

    this.activeProcesses.set(projectId, { proc, projectId });

    let allOutput = '';

    proc.stdout?.setEncoding('utf8');
    proc.stderr?.setEncoding('utf8');

    proc.stdout?.on('data', (chunk: string) => {
      allOutput += chunk;
    });

    proc.stderr?.on('data', (chunk: string) => {
      console.log('[KiroCliManager] stderr:', chunk.substring(0, 200));
      allOutput += chunk;
    });

    proc.on('error', (err) => {
      console.error('[KiroCliManager] Process error:', err.message);
      this.activeProcesses.delete(projectId);
      onError(err.message);
      onDone();
    });

    proc.on('close', (code) => {
      console.log('[KiroCliManager] Process closed, code:', code);
      this.activeProcesses.delete(projectId);

      const response = this.extractResponse(allOutput);

      if (response) {
        this.sessionStarted.set(options.projectPath, true);
        onData(response);
      } else if (code !== 0) {
        onError(`kiro-cli exited with code ${code}`);
      }

      onDone();
    });
  }

  stopCommand(projectId?: string): void {
    if (projectId) {
      const active = this.activeProcesses.get(projectId);
      if (active) {
        active.proc.kill();
        this.activeProcesses.delete(projectId);
      }
    } else {
      this.activeProcesses.forEach((active) => active.proc.kill());
      this.activeProcesses.clear();
    }
  }

  resetSession(projectPath: string): void {
    this.sessionStarted.delete(projectPath);
  }
}

export const kiroCliManager = new KiroCliManager();
