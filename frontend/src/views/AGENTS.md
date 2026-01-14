# PROJECT KNOWLEDGE BASE - Views

**Generated:** Wed Jan 14 2026 20:57:08
**Directory:** ./frontend/src/views

## OVERVIEW
Page-level React components for admin routes.

## WHERE TO LOOK
| Task | File | Notes |
|------|------|-------|
| Main dashboard | Home.tsx | Stream proxy, player |
| Configuration | Settings.tsx | Ad filter toggles |
| Testing UI | Test.tsx | M3U8 input, results |
| Statistics | Stats.tsx | Real-time metrics |
| Logs viewer | Logs.tsx | System logs |

## CONVENTIONS
- TypeScript interfaces for props
- TanStack Query for data fetching
- Tailwind classes for styling
- One component per file

## ANTI-PATTERNS
- No route code-splitting
- Large components (500+ lines)
