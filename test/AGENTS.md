# PROJECT KNOWLEDGE BASE - Test

**Generated:** Wed Jan 14 2026 20:57:08
**Directory:** ./test

## OVERVIEW
Manual Node.js test scripts without testing framework.

## STRUCTURE
```
test/
├── test-*.js              # Standalone test scripts
├── test-model-custom.json # NN model test data
└── test-ad-audio.m3u8     # Sample M3U8 with ads
```

## WHERE TO LOOK
| Task | File | Notes |
|------|------|-------|
| TS detection | test-ts-detection.js | TS metadata parser tests |
| Integration | test-integration.js | Full M3U8 pipeline |
| Neural network | test-nn-serialization.js | Model save/load |
| Learning | test-learning.js | Model training tests |
| Audio ads | test-audio-ad-filtering.js | Audio ad detection |

## CONVENTIONS
- `test-` prefix for all files
- Manual execution: `node test/test-*.js`
- Self-contained (no test framework)
- Console.log output for assertions

## ANTI-PATTERNS
- No automated test runner
- No assertion library
- Manual verification required
