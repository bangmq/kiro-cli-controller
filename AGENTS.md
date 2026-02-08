# AGENTS.md

<INSTRUCTIONS>
## Purpose
- Provide session-level rules for how Codex should operate in this workspace.

## Project overview
- Electron + React desktop app (KiroDesk) that orchestrates `kiro-cli` for multiple projects.
- Main process lives in `src/main`, preload in `src/preload`, renderer UI in `src/renderer`.
- Data persists under Electron `userData` as `projects.json`.

## Skills
- Skills are defined in `SKILL.md` files and listed below when present.
- If a user names a skill (e.g. `$skill-name`) or the task clearly matches a skill description, you MUST use that skill for the current turn.
- If multiple skills apply, choose the minimal set that covers the request and state the order you will use.
- Do not carry skills across turns unless re-mentioned.

## Available skills
- main-process: Electron main process, persistence, CLI orchestration (file: /Users/bangmq/Desktop/kiroTester/kiro-cli-controller/skills/main-process/SKILL.md)
- ipc-contract: IPC surface across main/preload/renderer (file: /Users/bangmq/Desktop/kiroTester/kiro-cli-controller/skills/ipc-contract/SKILL.md)
- renderer-ui: React UI, Tailwind styles, i18n (file: /Users/bangmq/Desktop/kiroTester/kiro-cli-controller/skills/renderer-ui/SKILL.md)

## How to use skills
1. Open the referenced `SKILL.md` and read only what you need to proceed.
2. Resolve any relative paths in the skill file relative to the skill directory first.
3. Prefer scripts/templates in the skill’s folder over retyping or rebuilding.
4. If the skill references extra docs, open only the specific files needed.

## Behavior
- Prefer local repo context over web research unless explicitly needed.
- Keep context small: summarize large files instead of pasting them.
- Be explicit about assumptions and ask when blocked.
- Use `rg` for search when possible.
- Avoid destructive git actions unless explicitly requested.
- Preserve Electron security defaults (`nodeIntegration: false`, `contextIsolation: true`).
- If changing IPC, update `main.ts`, `preload.ts`, and `electron.d.ts` together.
- Keep UI strings in `src/renderer/i18n.ts` (both `ko` and `en`).

## Commands
- Build: `npm run build`
- Dev: `npm run dev`
- Package: `npm run package`

## Code map
- Main process: `/Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/main/main.ts`
- Project storage: `/Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/main/projectManager.ts`
- CLI orchestration: `/Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/main/kiroCliManager.ts`
- Preload bridge: `/Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/preload/preload.ts`
- Renderer entry: `/Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/renderer/app.tsx`
- UI components: `/Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/renderer/components`
- Tailwind styles: `/Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/renderer/styles.css`
- i18n: `/Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/renderer/i18n.ts`

## Output
- Keep responses concise and actionable.
- Provide next steps only when there are clear follow-ons.
</INSTRUCTIONS>
