# PROJECT KNOWLEDGE BASE - Test

**Generated:** Sun Jan 11 2026
**Directory:** ./test

## OVERVIEW
Manual Node.js test suite for backend functionality.

## STRUCTURE
```
test/
├── test-*.js      # Individual test files
├── test-model-custom.json  # Test data
└── test-ad-audio.m3u8     # Sample M3U8
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Unit tests | test-ts-detection.js | TS metadata tests |
| Integration tests | test-integration.js | Full system tests |
| AI tests | test-learning.js | Model training tests |
| Audio tests | test-audio-ad-filtering.js | Ad filtering tests |

## CONVENTIONS
- test- prefix for all test files
- Manual execution with node
- No test framework
- Self-contained scripts

## ANTI-PATTERNS
None.