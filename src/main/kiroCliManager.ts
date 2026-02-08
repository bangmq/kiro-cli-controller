import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as pty from 'node-pty';

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
  proc: pty.IPty;
  projectId: string;
  projectPath: string;
  agent: string;
  callbacks: SessionCallbacks;
  lastUserMessage: string | null;
  ttyLine: string[];
  ttyCursor: number;
  waitForPrompt: boolean;
  echoPending: boolean;
}

export class KiroCliManager {
  private sessions: Map<string, KiroSession> = new Map();

  private runKiroCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      let command: string;
      let spawnArgs: string[];

      if (isWindows) {
        const kiroCliPath = '/home/blake/.local/bin/kiro-cli';
        const escapedArgs = args.map((arg) => `'${arg.replace(/'/g, `'"'"'`)}'`).join(' ');
        const bashCommand = `export LANG=C.UTF-8 && ${kiroCliPath} ${escapedArgs}`;
        command = 'wsl';
        spawnArgs = ['-e', 'bash', '-c', bashCommand];
      } else {
        command = this.resolveKiroCliPath();
        spawnArgs = args;
      }

      const proc = spawn(command, spawnArgs, {
        shell: false,
        env: {
          ...process.env,
          PATH: `${process.env.PATH || ''}:${process.env.HOME || ''}/.local/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin`
        },
        windowsHide: true
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

  private stripAnsi(str: string) {
    return str
      .replace(/\x1b\[[0-9; ]*m/g, '')
      .replace(/\x1b\[[0-9;]*[A-HJKSTfhilmnsu]/g, '')
      .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\][0-9;]*.*?(\x07|\x1b\\)/g, '')
      .replace(/\x1b[=>]/g, '')
      .replace(/[\x00-\x07\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  private normalizeOutput(str: string) {
    return str.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
  }

  private renderTtyChunk(session: KiroSession, str: string) {
    const lines: string[] = [];

    for (let i = 0; i < str.length; i += 1) {
      const ch = str[i];
      if (ch === '\n') {
        lines.push(session.ttyLine.join(''));
        session.ttyLine = [];
        session.ttyCursor = 0;
        continue;
      }
      if (ch === '\r') {
        session.ttyCursor = 0;
        continue;
      }
      if (ch === '\b') {
        if (session.ttyCursor > 0) {
          session.ttyCursor -= 1;
          session.ttyLine.splice(session.ttyCursor, 1);
        }
        continue;
      }
      if (session.ttyCursor === session.ttyLine.length) {
        session.ttyLine.push(ch);
      } else {
        session.ttyLine[session.ttyCursor] = ch;
      }
      session.ttyCursor += 1;
    }

    return lines.join('\n');
  }

  private stripPrompt(line: string) {
    return line.replace(/^.*\[[^\]]+\]\s*>\s?/, '');
  }

  private stripInlineThinking(line: string) {
    return line.replace(/(?:\s*[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s+Thinking\.\.\.)+/g, '');
  }

  private isSpinnerOnly(line: string) {
    return /^\s*(?:[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s+Thinking\.\.\.\s*)+$/.test(line);
  }

  private isBannerLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (/\[[^\]]+\]\s*>\s*/.test(trimmed)) return false;
    if (/^[╭╰│]/.test(trimmed)) return true;
    if (/^Did you know\?$/i.test(trimmed)) return true;
    if (/^Model:\s+/i.test(trimmed)) return true;
    if (/^▸\s*Time:/i.test(trimmed)) return true;
    // ASCII art / box drawing line with heavy block characters
    if (/[⣴⣶⣦⣿⡇⡆⢿⠟⠿]/.test(trimmed)) return true;
    return false;
  }

  private normalizeForEcho(value: string) {
    return value
      .replace(/[\p{Z}\p{Cf}\p{Cc}]/gu, '')
      .replace(/[^0-9a-zA-Z가-힣]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  private compactKoreanSpacing(value: string) {
    return value;
  }

  private shouldSuppressLine(line: string, lastUserMessage: string | null) {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (/^\[[^\]]+\]\s*>\s*$/.test(trimmed)) return true;
    if (/^Model:\s+/i.test(trimmed)) return true;
    if (/^▸\s*Time:/i.test(trimmed)) return true;
    if (lastUserMessage) {
      const normalizedUser = this.normalizeForEcho(lastUserMessage.trim());
      const normalizedLine = this.normalizeForEcho(trimmed);
      if (normalizedLine === normalizedUser) return true;
      const stripped = this.stripPrompt(trimmed).trim();
      if (this.normalizeForEcho(stripped) === normalizedUser) return true;
      if (normalizedLine.length > 0 && normalizedLine.length <= normalizedUser.length + 1) {
        if (normalizedLine.includes(normalizedUser)) return true;
      }
    }
    return false;
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

  private ensureSession(
    projectId: string,
    projectPath: string,
    agent: string,
    callbacks: SessionCallbacks
  ): KiroSession {
    const existing = this.sessions.get(projectId);
    if (existing) {
      existing.projectPath = projectPath;
      existing.agent = agent;
      existing.callbacks = callbacks;
      return existing;
    }

    const isWindows = process.platform === 'win32';
    let command: string;
    let args: string[];

    if (isWindows) {
      const wslPath = projectPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (match, drive) =>
        `/mnt/${drive.toLowerCase()}`
      );
      const kiroCliPath = '/home/blake/.local/bin/kiro-cli';
      command = 'wsl';
      args = ['-e', 'bash', '-c', `export LANG=C.UTF-8 && cd "${wslPath}" && ${kiroCliPath} chat --agent ${agent}`];
    } else {
      const kiroPath = this.resolveKiroCliPath();
      command = '/bin/zsh';
      args = ['-lc', `export LANG=C.UTF-8; stty -echo; exec "${kiroPath}" chat --agent "${agent}"`];
    }

    const homeDir = process.env.HOME || os.homedir();
    const proc = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: isWindows ? undefined : projectPath,
      env: {
        ...process.env,
        LANG: 'C.UTF-8',
        TERM: 'xterm-256color',
        PATH: `${process.env.PATH || ''}:${homeDir}/.local/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin`
      }
    });

    const session: KiroSession = {
      proc,
      projectId,
      projectPath,
      agent,
      callbacks,
      lastUserMessage: null,
      ttyLine: [],
      ttyCursor: 0,
      waitForPrompt: true,
      echoPending: false
    };
    let outputReady = false;

    this.sessions.set(projectId, session);

    const handleOutput = (data: string) => {
      const cleaned = this.renderTtyChunk(session, this.normalizeOutput(this.stripAnsi(data.toString())));
      if (!cleaned) return;
      const rawLines = cleaned.split('\n');
      const filteredLines = rawLines
        .map((line) => this.stripInlineThinking(line))
        .map((line) => this.compactKoreanSpacing(line))
        .filter((line) => {
          if (this.isSpinnerOnly(line)) return false;
          if (this.isBannerLine(line)) return false;
          if (session.waitForPrompt) {
            if (/\[[^\]]+\]\s*>\s*/.test(line)) {
              session.waitForPrompt = false;
              return false;
            }
            if (line.trim().length > 0 && !this.isSpinnerOnly(line) && !this.isBannerLine(line)) {
              // Some kiro-cli builds don't emit a prompt line; unlock on first real content.
              session.waitForPrompt = false;
            } else {
              return false;
            }
          }
          line = this.stripPrompt(line);
          line = line.replace(/^[> ]+/, '').trim();
          if (session.echoPending && session.lastUserMessage) {
            const normalizedUser = this.normalizeForEcho(session.lastUserMessage);
            const normalizedLine = this.normalizeForEcho(line);
            if (normalizedLine.includes(normalizedUser)) {
              session.echoPending = false;
              return false;
            }
          }
          return !this.shouldSuppressLine(line, session.lastUserMessage);
        });
      const merged = filteredLines.join('\n');
      if (merged.trim().length > 0) {
        callbacks.onData(merged + '\n');
      }
    };

    proc.onData(handleOutput);

    proc.onExit((event: { exitCode: number; signal?: number }) => {
      this.sessions.delete(projectId);
      if (event.exitCode !== 0) {
        callbacks.onError(`Terminal exited with code ${event.exitCode}`);
      }
    });

    if (typeof (proc as any).on === 'function') {
      (proc as any).on('error', (err: any) => {
        callbacks.onError(`Failed to start kiro-cli: ${err.message}`);
        this.sessions.delete(projectId);
      });
    }

    return session;
  }

  executeCommand(projectId: string, options: KiroCliOptions, onData: (data: string) => void, onError: (error: string) => void): void {
    const session = this.ensureSession(projectId, options.projectPath, options.agent, { onData, onError });
    session.lastUserMessage = options.message;
    session.echoPending = true;
    session.proc.write(`${options.message}\r`);
  }

  stopCommand(projectId?: string): void {
    if (projectId) {
      const session = this.sessions.get(projectId);
      if (session) {
        session.proc.kill();
        this.sessions.delete(projectId);
      }
    } else {
      this.sessions.forEach((session) => session.proc.kill());
      this.sessions.clear();
    }
  }
}

export const kiroCliManager = new KiroCliManager();
