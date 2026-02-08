# renderer-ui

## When to use
- Tasks affecting the React UI, layout, styling, or i18n in the renderer process.

## Key files
- /Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/renderer/app.tsx
- /Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/renderer/components/*
- /Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/renderer/styles.css
- /Users/bangmq/Desktop/kiroTester/kiro-cli-controller/src/renderer/i18n.ts

## Workflow
1. Locate the component responsible in `components/` or `app.tsx`.
2. For text, update `i18n.ts` keys in both `ko` and `en`.
3. Use Tailwind utility classes or add component styles in `styles.css`.
4. For IPC calls, go through `window.electronAPI` (see `ipc-contract` if adding new methods).

## Guardrails
- Preserve theme switching logic (dark/light) and existing classes.
- Avoid direct DOM manipulation; use React state/effects.
- Keep UI text in `i18n.ts` rather than hardcoding.
