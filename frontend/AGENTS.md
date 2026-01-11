# PROJECT KNOWLEDGE BASE - Frontend

**Generated:** Sun Jan 11 2026
**Directory:** ./frontend

## OVERVIEW
React frontend for M3U8 proxy with HLS.js player and Tailwind CSS.

## STRUCTURE
```
frontend/
├── src/
│   ├── views/     # Page components
│   ├── ui/        # UI components
│   └── lib/       # Utilities
├── package.json   # Dependencies
├── vite.config.ts # Build config
├── tsconfig.json  # TypeScript config
└── tailwind.config.js # Styling config
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Component development | src/views/ | Page-level components |
| UI elements | src/ui/ | Reusable components |
| Utilities | src/lib/ | Helper functions |
| Build config | vite.config.ts | Dev server, proxy |
| Styling | tailwind.config.js | Theme customization |

## CONVENTIONS
- TypeScript with strict mode
- Tailwind CSS with class-based dark mode
- Path aliases (@/* to ./src/*)
- Vite for build and dev server

## ANTI-PATTERNS
None.