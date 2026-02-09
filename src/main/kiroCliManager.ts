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
  onDone?: () => void;
}

interface KiroSession {
  proc: any;
  projectId: string;
  buffer: string;
  callbacks: SessionCallbacks;
  stdin: any;
  flushTimer?: NodeJS.Timeout;
  responseIdleTimer?: NodeJS.Timeout;
  responseStartTimer?: NodeJS.Timeout;
  responseStarted: boolean;
  awaitingResponse: boolean;
  endAfterLine: boolean;
  responseEmitted: boolean;
  responseAccumulator?: string;
  ready: boolean;
  pendingMessage?: string;
  lastMessage?: string;
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

    // line 내부에 섞인 Thinking... 제거 및 선행 프롬프트 기호 제거
    let normalizedLine = cleaned;

    // "Thinking...> 실제응답" 형태 처리
    if (/Thinking\.\.\./.test(normalizedLine) && normalizedLine.includes('>')) {
      const after = normalizedLine.split('>').pop() || '';
      normalizedLine = after;
    }

    normalizedLine = normalizedLine.replace(/Thinking\.\.\./g, '').trim();
    if (normalizedLine.startsWith('>')) {
      normalizedLine = normalizedLine.slice(1).trim();
    }
    if (!normalizedLine) return null;

    const normalizeForEcho = (text: string) =>
      text
        .replace(/[\s\u0000-\u001f\u007f]/g, '')
        .replace(/[^0-9A-Za-z\uAC00-\uD7A3]/g, '')
        .toLowerCase();

    // CLI 에코/프롬프트 라인(예: "[agent] > ...")
    if (/^\[[^\]]+\]\s*>\s*/.test(normalizedLine)) {
      const promptContent = normalizedLine.replace(/^\[[^\]]+\]\s*>\s*/, '').trim();
      // 사용자가 보낸 메시지 에코라면 응답 진행 상태는 유지
      if (session.lastMessage) {
        const last = session.lastMessage.trim();
        const lastNorm = normalizeForEcho(last);
        const promptNorm = normalizeForEcho(promptContent);
        if (
          promptContent === last ||
          last.startsWith(promptContent) ||
          promptContent.startsWith(last) ||
          (lastNorm && promptNorm && (lastNorm.startsWith(promptNorm) || promptNorm.startsWith(lastNorm))) ||
          (lastNorm && promptNorm && (lastNorm.includes(promptNorm) || promptNorm.includes(lastNorm)))
        ) {
          return null;
        }
      }
      // 대화 중이 아닐 때의 프롬프트는 UI에 표시하지 않음
      if (!session.awaitingResponse && !session.responseStarted) {
        return null;
      }
      // 이미 응답을 출력했다면 프롬프트는 종료 신호로만 처리
      if (session.responseEmitted) {
        this.finishResponse(session);
        return null;
      }
      // 에코가 아니라면 프롬프트/응답 라인으로 간주 (표시 후 종료)
      session.endAfterLine = true;
      return promptContent || null;
    }
    
    if (!session.ready && /^Model:/.test(normalizedLine)) {
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
    
    if (/^\[.*\]\s*\d+%\s*>/.test(normalizedLine)) {
      console.log('[KiroCliManager] Prompt line, skipping');
      this.finishResponse(session);
      return null;
    }
    
    // "Time:" 앞에 있는 실제 응답 추출
    const timeMatch = normalizedLine.match(/^(.+?)\s*Time:\s*\d+s/);
    if (timeMatch) {
      const response = timeMatch[1].trim();
      console.log('[KiroCliManager] Extracted response before Time:', response);
      console.log('[KiroCliManager] Response hex:', Buffer.from(response, 'utf8').toString('hex'));
      this.finishResponse(session);
      if (response && response.length > 0) {
        return response;
      }
      return null;
    }
    
    if (!session.responseStarted) {
      console.log('[KiroCliManager] Not started, checking:', normalizedLine.substring(0, 50));
      if (/^[╭╰│═─┌┐└┘├┤┬┴┼⠀]/.test(normalizedLine)) return null;
      if (/Did you know\?/.test(normalizedLine)) return null;
      if (/Welcome to Kiro/i.test(normalizedLine)) return null;
      if (/Run \/prompts/i.test(normalizedLine)) return null;
      if (/Use \/tangent/i.test(normalizedLine)) return null;
      if (/enable custom tools with MCP/i.test(normalizedLine)) return null;
      if (/You can (use|see)/i.test(normalizedLine)) return null;
      if (/Use shift \+ tab/i.test(normalizedLine)) return null;
      if (/^💡/.test(normalizedLine)) return null;
      if (/^🔧/.test(normalizedLine)) return null;
      if (/^Model:/.test(normalizedLine)) return null;
      if (/^Time:/.test(normalizedLine)) return null;

      // 응답 대기 중이면, 프롬프트가 아니고 무시 목록도 아닌 첫 라인을 응답 시작으로 간주
      if (session.awaitingResponse) {
        console.log('[KiroCliManager] Response starting (awaitingResponse)');
        session.responseStarted = true;
        return normalizedLine;
      }

      if (normalizedLine.length > 5 && /^>/.test(normalizedLine)) {
        console.log('[KiroCliManager] Response starting!');
        session.responseStarted = true;
        return normalizedLine.substring(1).trim();
      }

      return null;
    }
    
    // 에코 조각은 응답 중에도 숨김 (예: "녕")
    if (session.lastMessage && !session.responseEmitted) {
      const lastNorm = normalizeForEcho(session.lastMessage);
      const lineNorm = normalizeForEcho(normalizedLine);
      if (lineNorm && lastNorm && (lastNorm.startsWith(lineNorm) || lastNorm.includes(lineNorm)) && lineNorm.length <= lastNorm.length) {
        return null;
      }
    }

    if (/^Time:/.test(normalizedLine)) {
      console.log('[KiroCliManager] Response ended');
      this.finishResponse(session);
      return null;
    }
    
    return normalizedLine;
  }

  initSession(
    projectId: string,
    options: KiroCliOptions,
    onReady: () => void,
    onData: (data: string) => void,
    onError: (error: string) => void,
    onDone?: () => void
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
      command = kiroPath;
      args = ['chat', '--agent', options.agent];
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
      // macOS/Linux에서도 PTY를 사용해야 CLI가 응답을 flush하는 경우가 많음
      const pty = require('node-pty');
      proc = pty.spawn(command, args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: options.projectPath,
        env: {
          ...process.env,
          LANG: 'C.UTF-8',
          LC_ALL: 'C.UTF-8'
        }
      });
      stdinWriter = proc; // node-pty는 proc.write() 사용
    }

    console.log('[KiroCliManager] Process spawned, PID:', proc.pid);

    const session: KiroSession = {
      proc,
      projectId,
      buffer: '',
      callbacks: { onData, onError, onDone },
      stdin: stdinWriter,
      responseStarted: false,
      ready: false,
      awaitingResponse: false,
      endAfterLine: false,
      responseEmitted: false,
      lastMessage: undefined,
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
      const normalized = data.replace(/\r/g, '\n');
      const rawPreview = data
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .slice(0, 300);
      console.log('[KiroCliManager] Raw chunk:', rawPreview);
      session.buffer += normalized;
      
      if (session.flushTimer) {
        clearTimeout(session.flushTimer);
      }

      if (session.responseIdleTimer) {
        clearTimeout(session.responseIdleTimer);
      }

      const stripAnsi = (text: string) =>
        text
          .replace(/\x1b\][0-9];[^\x07]*\x07/g, '')
          .replace(/\x1b\][0-9];[^\x1b]*\x1b\\/g, '')
          .replace(/\x1b\[\?[0-9]+[hl]/g, '')
          .replace(/\x1b\[[0-9;]*m/g, '')
          .replace(/\x1b\[[0-9;]*[A-HJKSTfhilmnsu]/g, '');

      const normalizeForEcho = (text: string) =>
        text
          .replace(/[\s\u0000-\u001f\u007f]/g, '')
          .replace(/[^0-9A-Za-z\uAC00-\uD7A3]/g, '')
          .toLowerCase();

      const sanitizeResponseChunk = (text: string): string => {
        let t = stripAnsi(text).replace(/\r/g, '');
        if (!t) return '';
        // spinner/Thinking 제거
        t = t.replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏▸]/g, '');
        if (/Thinking\.\.\./.test(t) && t.includes('>')) {
          t = t.split('>').pop() || '';
        }
        t = t.replace(/Thinking\.\.\./g, '');

        // 프롬프트/에코 제거
        if (/\[[^\]]+\]\s*>\s*/.test(t)) {
          const content = t.replace(/^\s*\[[^\]]+\]\s*>\s*/, '').trim();
          const last = session.lastMessage ? session.lastMessage.trim() : '';
          const lastNorm = normalizeForEcho(last);
          const contentNorm = normalizeForEcho(content);
          const isEcho =
            last &&
            (content === last ||
              last.startsWith(content) ||
              content.startsWith(last) ||
              (lastNorm && contentNorm && (lastNorm.startsWith(contentNorm) || contentNorm.startsWith(lastNorm))) ||
              (lastNorm && contentNorm && (lastNorm.includes(contentNorm) || contentNorm.includes(lastNorm))));
          if (isEcho) return '';
          return content;
        }

        return t;
      };

      // 응답 중이면 raw chunk 기반으로 누적 (줄바꿈 없이 한 글자씩 오는 경우 대응)
      if (session.responseStarted) {
        const rawText = sanitizeResponseChunk(data);
        if (/Time:\s*\d+s/.test(rawText)) {
          const before = rawText.split(/Time:\s*\d+s/)[0] || '';
          if (before.trim()) {
            session.responseEmitted = true;
            session.responseAccumulator = (session.responseAccumulator || '') + before;
          }
          this.finishResponse(session);
          return;
        }
        if (rawText) {
          session.responseEmitted = true;
          session.responseAccumulator = (session.responseAccumulator || '') + rawText;
        }

        if (session.responseStarted) {
          session.responseIdleTimer = setTimeout(() => {
            this.finishResponse(session);
          }, 800);
        }
        return;
      }
      
      // Time: 패턴이 포함된 경우, Time: 이전 내용을 안전하게 추출
      if (session.buffer.includes('Time:')) {
        const idx = session.buffer.indexOf('Time:');
        const before = session.buffer.slice(0, idx);
        const after = session.buffer.slice(idx);

        // before에서 실제 응답을 추출 (ANSI 제거 + Thinking 제거)
        let cleanedBefore = before
          .replace(/\x1b\][0-9];[^\x07]*\x07/g, '')
          .replace(/\x1b\][0-9];[^\x1b]*\x1b\\/g, '')
          .replace(/\x1b\[\?[0-9]+[hl]/g, '')
          .replace(/\x1b\[[0-9;]*m/g, '')
          .replace(/\x1b\[[0-9;]*[A-HJKSTfhilmnsu]/g, '')
          .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏▸]/g, '')
          .replace(/Thinking\.\.\./g, '')
          .trim();

        // 프롬프트 형태는 제거
        if (/^\[[^\]]+\]\s*>\s*/.test(cleanedBefore)) {
          const promptContent = cleanedBefore.replace(/^\[[^\]]+\]\s*>\s*/, '').trim();
          const last = session.lastMessage ? session.lastMessage.trim() : '';
          const normalize = (text: string) =>
            text
              .replace(/[\s\u0000-\u001f\u007f]/g, '')
              .replace(/[^0-9A-Za-z\uAC00-\uD7A3]/g, '')
              .toLowerCase();
          const lastNorm = normalize(last);
          const promptNorm = normalize(promptContent);
          const isEcho =
            last &&
            (promptContent === last ||
              last.startsWith(promptContent) ||
              promptContent.startsWith(last) ||
              (lastNorm && promptNorm && (lastNorm.startsWith(promptNorm) || promptNorm.startsWith(lastNorm))) ||
              (lastNorm && promptNorm && (lastNorm.includes(promptNorm) || promptNorm.includes(lastNorm))));

          cleanedBefore = isEcho ? '' : promptContent;
        }

        if (cleanedBefore) {
          session.responseEmitted = true;
          session.responseAccumulator = (session.responseAccumulator || '') + cleanedBefore;
        }

        // Time: 이후는 버퍼에 남기고, 응답 종료 처리
        session.buffer = after;
        this.finishResponse(session);
        return;
      }

      if (session.buffer.includes('\n')) {
        const lines = session.buffer.split('\n');
        session.buffer = lines.pop() || '';
        
        console.log('[KiroCliManager] Processing', lines.length, 'lines (responseStarted=' + session.responseStarted + ')');
        
        for (const line of lines) {
          const cleaned = this.cleanLine(line, session);
          if (cleaned) {
            console.log('[KiroCliManager] Sending line to UI:', cleaned.substring(0, 50));
            session.responseEmitted = true;
            session.responseAccumulator = (session.responseAccumulator || '') + cleaned;
            if (session.endAfterLine) {
              session.endAfterLine = false;
              this.finishResponse(session);
            }
          }
        }
      }
      
      session.flushTimer = setTimeout(() => {
        if (session.buffer.trim()) {
          const cleaned = this.cleanLine(session.buffer, session);
          if (cleaned) {
            session.responseEmitted = true;
            session.responseAccumulator = (session.responseAccumulator || '') + cleaned;
            if (session.endAfterLine) {
              session.endAfterLine = false;
              this.finishResponse(session);
            }
          }
          session.buffer = '';
        }
      }, 100);

      // 응답 도중 추가 출력이 멈췄다면 자동 종료
      if (session.responseStarted) {
        session.responseIdleTimer = setTimeout(() => {
          this.finishResponse(session);
        }, 800);
      }
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
      // node-pty는 onData 이벤트 사용
      proc.onData(processData);
      
      proc.onExit((event: { exitCode: number; signal?: number }) => {
        console.log('[KiroCliManager] Process closed:', event.exitCode);
        clearTimeout(timeout);
        this.sessions.delete(projectId);
      });
    }
  }

  executeCommand(
    projectId: string,
    options: KiroCliOptions,
    onData: (data: string) => void,
    onError: (error: string) => void,
    onDone?: () => void
  ): void {
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
      session.awaitingResponse = true;
      session.endAfterLine = false;
      session.responseEmitted = false;
      session.responseAccumulator = '';
      if (session.responseIdleTimer) {
        clearTimeout(session.responseIdleTimer);
      }
      if (session.responseStartTimer) {
        clearTimeout(session.responseStartTimer);
      }
      session.lastMessage = message;
      session.callbacks.onData = onData;
      session.callbacks.onError = onError;
      session.callbacks.onDone = onDone;
      
      if (typeof session.stdin.write === 'function') {
        session.stdin.write(message + '\r\n');
      } else {
        onError('Session stdin not writable');
      }

      // 첫 출력이 너무 오래 없으면 응답 종료 처리 (다음 메시지 막힘 방지)
      session.responseStartTimer = setTimeout(() => {
        if (!session.responseEmitted && session.responseStarted) {
          onError('No response from kiro-cli. Please try again.');
          this.finishResponse(session);
        }
      }, 5000);
    } else {
      onError('Session stdin not available');
    }
  }

  private finishResponse(session: KiroSession): void {
    session.responseStarted = false;
    session.awaitingResponse = false;
    session.endAfterLine = false;
    if (session.responseAccumulator) {
      let output = session.responseAccumulator;
      // ANSI 및 이상 공백 정리
      output = output
        .replace(/\x1b\][0-9];[^\x07]*\x07/g, '')
        .replace(/\x1b\][0-9];[^\x1b]*\x1b\\/g, '')
        .replace(/\x1b\[\?[0-9]+[hl]/g, '')
        .replace(/\x1b\[[0-9;]*m/g, '')
        .replace(/\x1b\[[0-9;]*[A-HJKSTfhilmnsu]/g, '')
        .replace(/\r/g, '\n');

      // 덮어쓰기 때문에 생긴 과도한 들여쓰기/프롬프트 표시 제거
      output = output
        .replace(/^\s{6,}/gm, '')
        .replace(/\n\s*>\s*/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (output) {
        session.callbacks.onData(output + '\n');
      }
      session.responseAccumulator = '';
    }
    if (session.responseIdleTimer) {
      clearTimeout(session.responseIdleTimer);
      session.responseIdleTimer = undefined;
    }
    if (session.responseStartTimer) {
      clearTimeout(session.responseStartTimer);
      session.responseStartTimer = undefined;
    }
    if (session.callbacks.onDone) {
      session.callbacks.onDone();
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
