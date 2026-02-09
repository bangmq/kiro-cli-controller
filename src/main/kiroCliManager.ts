import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

export interface KiroCliOptions {
  projectPath: string;
  agent: string;
  message: string;
}

interface SessionCallbacks {
  onData: (data: string) => void;
  onError: (error: string) => void;
}

interface KiroSession {
  proc: any;
  projectId: string;
  buffer: string;
  callbacks: SessionCallbacks;
  stdin: any;
  flushTimer?: NodeJS.Timeout;
  responseStarted: boolean;
  ready: boolean;
  pendingMessage?: string;
  onReady?: () => void;
}

export class KiroCliManager {
  private sessions: Map<string, KiroSession> = new Map();
  private wslKiroPath: string | null = null;

  private getWslKiroPath(): string {
    if (this.wslKiroPath) return this.wslKiroPath;
    
    try {
      const result = execSync('wsl -e bash -c "which kiro-cli 2>/dev/null || echo \\$HOME/.local/bin/kiro-cli"', { 
        encoding: 'utf8',
        timeout: 3000
      }).trim();
      this.wslKiroPath = result || '$HOME/.local/bin/kiro-cli';
      console.log('[KiroCliManager] WSL kiro-cli path:', this.wslKiroPath);
      return this.wslKiroPath;
    } catch (err: any) {
      console.error('[KiroCliManager] Failed to detect WSL kiro-cli path:', err.message);
      this.wslKiroPath = '$HOME/.local/bin/kiro-cli';
      return this.wslKiroPath;
    }
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
        const escapedArgs = args.map((arg) => `'${arg.replace(/'/g, `'"'"'`)}'`).join(' ');
        const bashCommand = `${cdCmd}${kiroCliPath} ${escapedArgs}`;
        command = 'wsl';
        spawnArgs = ['-e', 'bash', '-c', bashCommand];
      } else {
        command = this.resolveKiroCliPath();
        spawnArgs = args;
      }

      const proc = spawn(command, spawnArgs, {
        cwd: isWindows ? undefined : cwd,
        env: {
          ...process.env,
          LANG: 'C.UTF-8',
          LC_ALL: 'C.UTF-8'
        }
      });

      let stdout = '';
      let stderr = '';

      if (proc.stdout) {
        proc.stdout.setEncoding('utf8');
        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (proc.stderr) {
        proc.stderr.setEncoding('utf8');
        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      proc.on('error', (err) => {
        reject(err);
      });

      proc.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
    });
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
        try {
          return fs.realpathSync(candidate);
        } catch {
          return candidate;
        }
      }
    }
    return 'kiro-cli';
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
      const message = (result.stdout || result.stderr || '').trim();
      return { success: result.code === 0, message };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Login failed' };
    }
  }

  async logout(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.runKiroCli(['logout']);
      const message = (result.stdout || result.stderr || '').trim();
      return { success: result.code === 0, message };
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

  private cleanLine(line: string, session: KiroSession): string | null {
    const cleaned = line
      .replace(/\x1b\][0-9];[^\x07]*\x07/g, '')
      .replace(/\x1b\][0-9];[^\x1b]*\x1b\\/g, '')
      .replace(/\x1b\[\?[0-9]+[hl]/g, '')
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\x1b\[[0-9;]*[A-HJKSTfhilmnsu]/g, '')
      .replace(/\[0m/g, '')
      .replace(/\[38;5;\d+m/g, '')
      .replace(/\[1m/g, '')
      .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏▸]/g, '')
      .trim();
    
    console.log('[KiroCliManager] Cleaned:', cleaned.substring(0, 100));
    
    if (!cleaned) return null;
    
    if (!session.ready && /^Model:/.test(cleaned)) {
      session.ready = true;
      console.log('[KiroCliManager] Session ready (Model detected)');
      
      if (session.onReady) {
        session.onReady();
      }
      
      if (session.pendingMessage && session.stdin) {
        console.log('[KiroCliManager] Sending pending message:', session.pendingMessage);
        session.stdin.write(session.pendingMessage + '\r');
        session.pendingMessage = undefined;
      }
      return null;
    }
    
    if (/^\[.*\]\s*\d+%\s*>/.test(cleaned)) {
      console.log('[KiroCliManager] Prompt line, skipping');
      if (session.responseStarted) {
        session.responseStarted = false;
      }
      return null;
    }
    
    // "Time:" 앞에 있는 실제 응답 추출
    const timeMatch = cleaned.match(/^(.+?)\s*Time:\s*\d+s/);
    if (timeMatch) {
      const response = timeMatch[1].trim();
      console.log('[KiroCliManager] Extracted response before Time:', response);
      console.log('[KiroCliManager] Response hex:', Buffer.from(response, 'utf8').toString('hex'));
      session.responseStarted = false;
      if (response && response.length > 0) {
        return response;
      }
      return null;
    }
    
    if (!session.responseStarted) {
      console.log('[KiroCliManager] Not started, checking:', cleaned.substring(0, 50));
      if (/^[╭╰│═─┌┐└┘├┤┬┴┼⠀]/.test(cleaned)) return null;
      if (/Did you know\?/.test(cleaned)) return null;
      if (/Welcome to Kiro/i.test(cleaned)) return null;
      if (/Run \/prompts/i.test(cleaned)) return null;
      if (/Use \/tangent/i.test(cleaned)) return null;
      if (/enable custom tools with MCP/i.test(cleaned)) return null;
      if (/You can (use|see)/i.test(cleaned)) return null;
      if (/Use shift \+ tab/i.test(cleaned)) return null;
      if (/^💡/.test(cleaned)) return null;
      if (/^🔧/.test(cleaned)) return null;
      if (/^Model:/.test(cleaned)) return null;
      if (/Thinking\.\.\./.test(cleaned)) return null;
      if (/^Time:/.test(cleaned)) return null;
      
      if (cleaned.length > 5 && /^>/.test(cleaned)) {
        console.log('[KiroCliManager] Response starting!');
        session.responseStarted = true;
        return cleaned.substring(1).trim();
      }
      
      return null;
    }
    
    if (/Thinking\.\.\./.test(cleaned)) return null;
    if (/^Time:/.test(cleaned)) {
      console.log('[KiroCliManager] Response ended');
      session.responseStarted = false;
      return null;
    }
    
    return cleaned;
  }

  initSession(
    projectId: string,
    options: KiroCliOptions,
    onReady: () => void,
    onData: (data: string) => void,
    onError: (error: string) => void
  ): void {
    const existing = this.sessions.get(projectId);
    if (existing) {
      if (existing.ready) {
        onReady();
      } else {
        existing.onReady = onReady;
      }
      return;
    }

    const isWindows = process.platform === 'win32';
    let command: string;
    let args: string[];

    if (isWindows) {
      const kiroCliPath = this.getWslKiroPath();
      const wslPath = options.projectPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
      command = 'wsl';
      args = ['--', 'bash', '-c', `export LANG=en_US.UTF-8 && cd "${wslPath}" && ${kiroCliPath} chat --agent ${options.agent}`];
      console.log('[KiroCliManager] Command:', command, args);
    } else {
      const kiroPath = this.resolveKiroCliPath();
      command = '/bin/bash';
      args = ['-c', `${kiroPath} chat --agent ${options.agent}`];
    }

    console.log('[KiroCliManager] Creating new session');

    let proc: any;
    let stdinWriter: any;
    
    if (isWindows) {
      // Windows에서는 node-pty 사용 (ConPTY로 UTF-8 처리)
      const pty = require('node-pty');
      proc = pty.spawn('C:\\Windows\\System32\\wsl.exe', args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: undefined,
        env: {
          ...process.env,
          LANG: 'C.UTF-8',
          LC_ALL: 'C.UTF-8'
        }
      });
      stdinWriter = proc; // node-pty는 proc.write() 사용
    } else {
      proc = spawn(command, args, {
        cwd: options.projectPath,
        env: {
          ...process.env,
          LANG: 'C.UTF-8',
          LC_ALL: 'C.UTF-8'
        }
      });
      stdinWriter = proc.stdin;
    }

    console.log('[KiroCliManager] Process spawned, PID:', proc.pid);

    const session: KiroSession = {
      proc,
      projectId,
      buffer: '',
      callbacks: { onData, onError },
      stdin: stdinWriter,
      responseStarted: false,
      ready: false,
      onReady
    };

    this.sessions.set(projectId, session);

    // 30초 타임아웃
    const timeout = setTimeout(() => {
      if (!session.ready) {
        console.error('[KiroCliManager] Session timeout for', projectId);
        onError('Session initialization timeout. Please try again.');
        this.sessions.delete(projectId);
        proc.kill();
      }
    }, 30000);

    const processData = (data: string) => {
      session.buffer += data;
      
      if (session.flushTimer) {
        clearTimeout(session.flushTimer);
      }
      
      // Time: 패턴이 나오면 즉시 처리
      if (session.buffer.includes('Time:') && session.buffer.match(/Time:\s*\d+s/)) {
        const fullBuffer = session.buffer;
        session.buffer = '';
        
        console.log('[KiroCliManager] Response complete, responseStarted was:', session.responseStarted);
        
        // 마지막 Thinking... 이후, Time: 이전의 실제 응답 추출
        const parts = fullBuffer.split(/Thinking\.\.\./);
        const lastPart = parts[parts.length - 1]; // 마지막 Thinking... 이후
        
        const responseMatch = lastPart.match(/([\s\S]*?)Time:/);
        if (responseMatch) {
          let response = responseMatch[1];
          
          // ANSI 제어 문자 제거
          response = response
            .replace(/\x1b\][0-9];[^\x07]*\x07/g, '')
            .replace(/\x1b\][0-9];[^\x1b]*\x1b\\/g, '')
            .replace(/\x1b\[\?[0-9]+[hl]/g, '')
            .replace(/\x1b\[[0-9;]*m/g, '')
            .replace(/\x1b\[[0-9;]*[A-HJKSTfhilmnsu]/g, '')
            .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏▸]/g, '')
            .replace(/^\s*>\s*/, '')
            .trim();
          
          console.log('[KiroCliManager] Extracted response:', response.substring(0, 100));
          
          if (response && response.length > 0) {
            onData(response + '\n');
          }
        }
        
        session.responseStarted = false;
        return;
      }
      
      // Time: 패턴이 나올 때까지는 라인 처리하지 않음 (Thinking 스피너 방지)
      if (session.responseStarted) {
        console.log('[KiroCliManager] Skipping line processing (responseStarted=true)');
        return;
      }
      
      if (session.buffer.includes('\n')) {
        const lines = session.buffer.split('\n');
        session.buffer = lines.pop() || '';
        
        console.log('[KiroCliManager] Processing', lines.length, 'lines (responseStarted=false)');
        
        for (const line of lines) {
          const cleaned = this.cleanLine(line, session);
          if (cleaned) {
            console.log('[KiroCliManager] Sending line to UI:', cleaned.substring(0, 50));
            onData(cleaned + '\n');
          }
        }
      }
      
      session.flushTimer = setTimeout(() => {
        if (session.buffer.trim() && !session.responseStarted) {
          const cleaned = this.cleanLine(session.buffer, session);
          if (cleaned) {
            onData(cleaned + '\n');
          }
          session.buffer = '';
        }
      }, 100);
    };

    if (isWindows) {
      // node-pty는 onData 이벤트 사용
      proc.onData(processData);
      
      proc.onExit((event: { exitCode: number; signal?: number }) => {
        console.log('[KiroCliManager] Process closed:', event.exitCode);
        clearTimeout(timeout);
        this.sessions.delete(projectId);
      });
    } else {
      if (proc.stdout) {
        proc.stdout.setEncoding('utf8');
        proc.stdout.on('data', (data: Buffer | string) => {
          const text = Buffer.isBuffer(data) ? data.toString('utf8') : data;
          console.log('[KiroCliManager] stdout:', text.substring(0, 100));
          processData(text);
        });
      }

      if (proc.stderr) {
        proc.stderr.setEncoding('utf8');
        proc.stderr.on('data', (data: Buffer | string) => {
          const text = Buffer.isBuffer(data) ? data.toString('utf8') : data;
          console.log('[KiroCliManager] stderr:', text.substring(0, 100));
          processData(text);
        });
      }

      proc.on('error', (err: any) => {
        console.error('[KiroCliManager] Process error:', err);
        onError(`Failed to execute: ${err.message}`);
        this.sessions.delete(projectId);
      });

      proc.on('close', (code: number | null) => {
        console.log('[KiroCliManager] Process closed:', code);
        clearTimeout(timeout);
        this.sessions.delete(projectId);
      });
    }
  }

  executeCommand(projectId: string, options: KiroCliOptions, onData: (data: string) => void, onError: (error: string) => void): void {
    const session = this.sessions.get(projectId);
    
    if (!session) {
      onError('Session not initialized. Call initSession first.');
      return;
    }

    if (!session.ready) {
      session.pendingMessage = options.message;
      return;
    }

    if (session.stdin) {
      const message = options.message;
      console.log('[KiroCliManager] Setting responseStarted = true');
      session.responseStarted = true;
      
      if (typeof session.stdin.write === 'function') {
        session.stdin.write(message + '\r');
      } else {
        onError('Session stdin not writable');
      }
    } else {
      onError('Session stdin not available');
    }
  }

  stopCommand(projectId?: string): void {
    if (projectId) {
      const session = this.sessions.get(projectId);
      if (session) {
        if (session.flushTimer) {
          clearTimeout(session.flushTimer);
        }
        session.proc.kill();
        this.sessions.delete(projectId);
      }
    } else {
      this.sessions.forEach((session) => {
        if (session.flushTimer) {
          clearTimeout(session.flushTimer);
        }
        session.proc.kill();
      });
      this.sessions.clear();
    }
  }
}

export const kiroCliManager = new KiroCliManager();
