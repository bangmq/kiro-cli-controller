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

    const chatArgs = ['chat', '--no-interactive', '--trust-all-tools', '--wrap', 'never'];

    if (isFirstMessage) {
      chatArgs.push('--agent', options.agent);
    } else {
      chatArgs.push('--resume');
    }

    chatArgs.push(options.message);

    if (isWindows) {
      const kiroCliPath = this.getWslKiroPath();
      const wslPath = options.projectPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
      const msgBase64 = Buffer.from(options.message, 'utf8').toString('base64');
      const chatArgsWithoutMsg = chatArgs.slice(0, -1);
      const escapedArgs = chatArgsWithoutMsg.map(a => `'${a.replace(/'/g, `'"'"'`)}'`).join(' ');
      const bashCommand = `cd "${wslPath}" && ${kiroCliPath} ${escapedArgs} "$(echo '${msgBase64}' | base64 -d)"`;
      return { command: 'wsl', args: ['-e', 'bash', '-c', bashCommand] };
    }

    return { command: this.resolveKiroCliPath(), args: chatArgs, cwd: options.projectPath };
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
    await fs.writeJson(path.join(kiroDir, 'config.json'), {
      projectPath, type, createdAt: new Date().toISOString()
    });
  }

  setupProjectWithMetaAgent(
    projectPath: string,
    type: 'maintenance' | 'new-development',
    onProgress: (message: string) => void,
    onDone: (success: boolean, error?: string) => void
  ): void {
    const prompt = type === 'maintenance'
      ? 'Analyze this project codebase. Read the file structure and key source files, then create appropriate .kiro/agents/ JSON configs (pm, analyst, coder), .kiro/skills/ markdown files, and .kiro/steering/ markdown files tailored to this project. Each agent should have a specific role for maintaining this codebase.'
      : 'Analyze this project codebase. Read the file structure and key source files, then create appropriate .kiro/agents/ JSON configs (pm, architect, coder), .kiro/skills/ markdown files, and .kiro/steering/ markdown files tailored to this project. Each agent should have a specific role for developing new features.';

    const { command, args, cwd } = this.buildMetaCommand(projectPath, prompt);
    onProgress('analyzing');

    const proc = spawn(command, args, {
      cwd, env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }
    });

    let allOutput = '';
    proc.stdout?.setEncoding('utf8');
    proc.stderr?.setEncoding('utf8');
    proc.stdout?.on('data', (chunk: string) => { allOutput += chunk; });
    proc.stderr?.on('data', (chunk: string) => {
      allOutput += chunk;
      if (/reading|read|scanning/i.test(chunk)) onProgress('reading');
      if (/creating|writing|generat/i.test(chunk)) onProgress('generating');
    });

    proc.on('error', (err) => { onDone(false, err.message); });
    proc.on('close', () => {
      onProgress('finalizing');
      const agentsDir = path.join(projectPath, '.kiro', 'agents');
      const hasAgents = fs.existsSync(agentsDir) && fs.readdirSync(agentsDir).some(f => f.endsWith('.json'));
      onDone(hasAgents, hasAgents ? undefined : 'Meta agent did not generate agent configs');
    });
  }

  private buildMetaCommand(projectPath: string, message: string): { command: string; args: string[]; cwd?: string } {
    const isWindows = process.platform === 'win32';
    const chatArgs = ['chat', '--no-interactive', '--trust-all-tools', '--wrap', 'never', message];

    if (isWindows) {
      const kiroCliPath = this.getWslKiroPath();
      const wslPath = projectPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
      const msgBase64 = Buffer.from(message, 'utf8').toString('base64');
      const argsWithoutMsg = chatArgs.slice(0, -1);
      const escapedArgs = argsWithoutMsg.map(a => `'${a.replace(/'/g, `'"'"'`)}'`).join(' ');
      const bashCommand = `cd "${wslPath}" && ${kiroCliPath} ${escapedArgs} "$(echo '${msgBase64}' | base64 -d)"`;
      return { command: 'wsl', args: ['-e', 'bash', '-c', bashCommand] };
    }

    return { command: this.resolveKiroCliPath(), args: chatArgs, cwd: projectPath };
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

  private isNoiseLine(t: string): boolean {
    if (/^Error:/i.test(t)) return true;
    if (/^Model:/i.test(t)) return true;
    if (/^Time:\s*\d+/i.test(t)) return true;
    if (/Picking up where we left off/i.test(t)) return true;
    if (/Define indexed resources/i.test(t)) return true;
    if (/Welcome to Kiro/i.test(t)) return true;
    if (/^Did you know/i.test(t)) return true;
    if (/^Run \/prompts/i.test(t)) return true;
    if (/^Use \/tangent/i.test(t)) return true;
    if (/enable custom tools with MCP/i.test(t)) return true;
    if (/All tools are now trusted/i.test(t)) return true;
    if (/understand the risks/i.test(t)) return true;
    if (/Learn more at https:\/\//i.test(t)) return true;
    if (/^[╭╰│═─┌┐└┘├┤┬┴┼⠀⋮↱]/.test(t)) return true;
    if (/^[💡🔧▸⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(t)) return true;
    if (/^Thinking\.\.\./i.test(t)) return true;
    if (/^Completed in \d+/i.test(t)) return true;
    if (/^Purpose:/i.test(t)) return true;
    return false;
  }

  private extractToolStatus(t: string): string | null | undefined {
    const readFile = t.match(/^Reading file:\s*(.+?)(?:,|\s*\()/i);
    if (readFile) return `📄 ${readFile[1].trim().split('/').pop()} 읽는 중...`;

    const readDir = t.match(/^Reading directory:\s*(.+?)(?:\s*\()/i);
    if (readDir) return `📁 ${readDir[1].trim().split('/').pop()}/ 탐색 중...`;

    if (/^I will run the following command:/i.test(t)) return '⚡ 명령어 실행 중...';

    const modify = t.match(/^I'll modify the following file:\s*(.+?)(?:\s*\()/i);
    if (modify) return `✏️ ${modify[1].trim().split('/').pop()} 수정 중...`;

    if (/^Updating:\s*(.+)/i.test(t)) return `💾 ${t.replace(/^Updating:\s*/i, '').trim().split('/').pop()} 저장 중...`;

    if (/^✓ Successfully found (\d+) files/i.test(t)) {
      const m = t.match(/(\d+) files/);
      return m ? `🔍 ${m[1]}개 파일 발견` : null;
    }
    if (/^✓ Successfully/i.test(t)) return null;
    if (/^Completed in \d+/i.test(t)) return null;

    // 배치 작업 로그
    if (/^[↱⋮]\s*Operation \d+/i.test(t)) return null;
    if (/^Operation \d+/i.test(t)) return null;
    if (/^⋮\s*$/.test(t)) return null;
    if (/^Summary:\s*\d+ operations/i.test(t)) {
      const m = t.match(/(\d+) successful/i);
      return m ? `✅ ${m[1]}개 작업 완료` : null;
    }

    if (/\(using tool:\s*\w+\)/i.test(t)) return null;

    return undefined; // undefined = 일반 응답 라인
  }

  private extractResponse(raw: string): string {
    const stripped = this.stripAnsi(raw);
    const lines = stripped.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      const t = line.trim();
      if (!t) {
        result.push('');
        continue;
      }
      if (this.isNoiseLine(t)) continue;

      const status = this.extractToolStatus(t);
      if (status === null) continue; // 도구 로그지만 표시 불필요
      if (status !== undefined) continue; // 도구 상태 메시지 (별도 채널로 전송됨)

      result.push(
        line
          .replace(/\s*▸?\s*Time:\s*\d+s\s*$/i, '')
          .replace(/\s*Completed in \d+[\d.]*s?\s*/gi, '')
          .trimEnd()
      );
    }

    return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  sendMessage(
    projectId: string,
    options: KiroCliOptions,
    onData: (data: string) => void,
    onStatus: (status: string) => void,
    onError: (error: string) => void,
    onDone: () => void
  ): void {
    const existing = this.activeProcesses.get(projectId);
    if (existing) {
      onError('Previous message is still processing.');
      return;
    }

    const { command, args, cwd } = this.buildCommand(options);
    console.log('[KiroCliManager] Spawning:', command, args.join(' ').substring(0, 200));

    const proc = spawn(command, args, {
      cwd, env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }
    });

    this.activeProcesses.set(projectId, { proc, projectId });
    let allOutput = '';

    proc.stdout?.setEncoding('utf8');
    proc.stderr?.setEncoding('utf8');

    // stderr/stdout를 실시간으로 파싱하여 도구 상태를 즉시 전달
    let statusSent = false;
    const processChunkForStatus = (chunk: string) => {
      const stripped = this.stripAnsi(chunk);
      for (const line of stripped.split('\n')) {
        const t = line.trim();
        if (!t) continue;

        // 초기 로딩 상태
        if (/Thinking\.\.\./i.test(t) || /^Model:/i.test(t)) {
          onStatus('🤔 생각하는 중...');
          statusSent = true;
          continue;
        }
        if (/Picking up where we left off/i.test(t)) {
          onStatus('🔄 이전 대화 불러오는 중...');
          statusSent = true;
          continue;
        }

        const status = this.extractToolStatus(t);
        if (status) {
          onStatus(status);
          statusSent = true;
        }
      }
    };

    proc.stdout?.on('data', (chunk: string) => {
      allOutput += chunk;
      processChunkForStatus(chunk);
    });

    proc.stderr?.on('data', (chunk: string) => {
      console.log('[KiroCliManager] stderr:', chunk.substring(0, 200));
      allOutput += chunk;
      processChunkForStatus(chunk);
    });

    proc.on('error', (err) => {
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
      }

      if (code !== 0) {
        const errorMatch = allOutput.match(/error:\s*(.+)/i);
        const errorMsg = errorMatch ? errorMatch[1].trim() : `kiro-cli exited with code ${code}`;
        if (!response) {
          onError(errorMsg);
        } else {
          onData('\n\n⚠️ ' + errorMsg);
        }
      } else if (response) {
        this.sessionStarted.set(options.projectPath, true);
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
