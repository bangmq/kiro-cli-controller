declare module 'node-pty' {
  export interface IPty {
    write(data: string): void;
    kill(signal?: string): void;
    onData(listener: (data: string) => void): void;
    onExit(listener: (event: { exitCode: number; signal?: number }) => void): void;
    on?(event: string, listener: (...args: any[]) => void): void;
  }

  export interface SpawnOptions {
    name?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  }

  export function spawn(
    file: string,
    args?: string[],
    options?: SpawnOptions
  ): IPty;
}
