# PROJECT KNOWLEDGE BASE

**Generated:** Sun Jan 11 2026 11:15:56
**Commit:** da4fefc
**Branch:** main

## OVERVIEW
M3U8 proxy service with AI-powered ad filtering using neural networks.

## STRUCTURE
```
m3u8-proxy/
├── server.js              # Main backend entry
├── *-manager.js           # Core modules (cache, stats, etc.)
├── *-processor.js         # M3U8 processing logic
├── config.js              # Configuration
├── frontend/              # React app
│   ├── src/               # Source code
│   ├── package.json       # Frontend deps
│   └── vite.config.ts     # Build config
├── test/                  # Manual tests
├── data/                  # Persistent data
├── public/                # Static assets
└── README.md              # Docs
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Backend development | ./ | server.js, *-manager.js |
| Frontend development | ./frontend | npm run ui:dev |
| Testing | ./test | node test/test-*.js |
| Configuration | ./config.js | Environment variables |
| Data persistence | ./data | JSON files |

## CONVENTIONS
- Flat backend structure (no src/ dir)
- Manual testing without framework
- Monorepo with frontend in subdir

## ANTI-PATTERNS (THIS PROJECT)
None documented.

## UNIQUE STYLES
- AI ad filtering with neural network
- Multi-source decision fusion
- TS metadata detection

## COMMANDS
```bash
npm start    # Production server
npm run dev  # Development server
npm run ui:dev  # Frontend development
npm run ui:build  # Build frontend
```

## NOTES
- Change default password in config.js for production
- TS detection temporarily disabled