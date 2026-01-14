# PROJECT KNOWLEDGE BASE

**Generated:** Wed Jan 14 2026 20:57:08
**Commit:** db6e050
**Branch:** main

## OVERVIEW
M3U8 proxy service with AI-powered ad filtering using neural networks and multi-source decision fusion.

## STRUCTURE
```
m3u8-proxy/
├── server.js              # Express backend, JWT auth, rate limiting
├── m3u8-processor.js      # Core M3U8 parsing and ad filtering
├── neural-network-model.js # TensorFlow.js ad classifier
├── multi-source-fusion.js  # Weighted detection fusion engine
├── ts-metadata-detector.js # MPEG-TS deep analysis
├── config.js              # Centralized configuration
├── frontend/              # React admin panel
│   └── src/
│       ├── views/         # Page components
│       └── ui/            # Reusable UI
├── test/                  # Manual Node.js tests
├── data/                  # JSON persistence (cache, model)
└── public/                # Static assets
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Backend entry | server.js | Routes, auth, proxy |
| M3U8 processing | m3u8-processor.js | Parsing, filtering |
| AI detection | neural-network-model.js | TF.js model, training |
| Decision fusion | multi-source-fusion.js | 6-source weighted voting |
| TS analysis | ts-metadata-detector.js | Stream metadata parsing |
| Frontend | frontend/src/views/ | Admin UI |
| Config | config.js | All settings |

## CONVENTIONS
- Flat backend (no src/ dir)
- Manual Node.js tests (no framework)
- Monorepo: frontend in subdirectory
- Pattern: `*-manager.js`, `*-processor.js`, `*-detector.js`

## ANTI-PATTERNS (THIS PROJECT)
- TS metadata detection currently disabled in config (may cause false negatives)
- No frontend testing framework (manual UI verification only)
- Large neural network model (~50KB) stored as JSON

## UNIQUE STYLES
- Multi-layer ad detection: regex → structural → duration → TS → NN
- TensorFlow.js in Node.js (non-browser)
- MPEG-TS PAT/PMT table parsing for ad identification
- Learning from user feedback for model improvement

## COMMANDS
```bash
npm start       # Production server
npm run dev     # Development server (auto-reload)
npm run ui:dev  # Frontend dev server
npm run ui:build # Build frontend for production
node test/test-*.js  # Run specific test
```

## NOTES
- Default credentials: admin/admin (change in production!)
- M3U8 files: 10,746 lines of JS/TS code
- AI model requires TensorFlow.js (@tensorflow/tfjs)
- Cache and model data persist to ./data/
