# main-process

## When to use
- Tasks touching Electron main process, project persistence, CLI execution, or app lifecycle.

## Key files
- /Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/main/main.ts
- /Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/main/projectManager.ts
- /Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/main/kiroCliManager.ts

## Workflow
1. Identify which main-process module is responsible.
2. If adding or changing IPC, coordinate with the `ipc-contract` skill.
3. Keep file I/O async and avoid blocking the event loop.
4. Preserve OS-specific behavior (mac menu/tray, Windows jump list, WSL paths).

## Guardrails
- Do not enable `nodeIntegration` in the renderer.
- Keep IPC handlers small; route complex logic into `projectManager` or `kiroCliManager`.
- For new app data, prefer `app.getPath('userData')`.

## Quick checks
- `npm run build` for TypeScript/build errors.
- `npm run start` or `npm run dev` for runtime sanity.
