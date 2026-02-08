# ipc-contract

## When to use
- Tasks that add/modify IPC channels or window API surface (`window.electronAPI`).

## Key files
- /Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/main/main.ts
- /Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/preload/preload.ts
- /Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/types/electron.d.ts
- /Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/renderer/**

## Workflow
1. Add or update `ipcMain.handle(...)` in `main.ts`.
2. Expose a matching method via `contextBridge` in `preload.ts`.
3. Update types in `electron.d.ts` so renderer usage stays typed.
4. Update renderer usage (usually in components or `app.tsx`).

## Guardrails
- Keep channel names stable and consistent.
- Return serializable data only; avoid passing complex class instances.
- Prefer `ipcRenderer.invoke` for request/response, and `ipcRenderer.on` for streaming output.
