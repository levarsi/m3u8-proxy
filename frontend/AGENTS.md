# PROJECT KNOWLEDGE BASE - Frontend

**Generated:** Wed Jan 14 2026 20:57:08
**Directory:** ./frontend

## OVERVIEW
React 18 admin panel with HLS.js player, TanStack Query state, and Tailwind CSS styling.

## STRUCTURE
```
frontend/
├── src/
│   ├── views/        # Route pages (Home, Settings, Test, Stats)
│   ├── ui/           # Reusable components (Button, Card, Layout)
│   └── lib/          # API client, hooks, utils
├── package.json      # React, Vite, Tailwind, TanStack Query
├── vite.config.ts    # Dev server, proxy to :3000
├── tsconfig.json     # Strict TypeScript, path aliases
└── tailwind.config.js # Dark mode, custom theme
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Pages | src/views/ | Route components |
| UI kit | src/ui/ | Buttons, cards, layout |
| API | src/lib/api.ts | Backend communication |
| Build | vite.config.ts | Proxy, plugins |
| Theme | tailwind.config.js | Colors, dark mode |

## CONVENTIONS
- TypeScript strict mode
- Tailwind CSS with `dark:` variants
- Path aliases: `@/*` → `./src/*`
- TanStack Query for async state
- One component per file

## ANTI-PATTERNS
- No unit/integration tests for components
- API client lacks error boundary handling

## UNIQUE STYLES
- HLS.js integration for stream playback
- Real-time stats polling (5s interval)
- Class-based dark mode toggle
