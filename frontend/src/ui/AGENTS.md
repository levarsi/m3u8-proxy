# PROJECT KNOWLEDGE BASE - UI

**Generated:** Wed Jan 14 2026 20:57:08
**Directory:** ./frontend/src/ui

## OVERVIEW
Reusable React UI components with Tailwind styling.

## WHERE TO LOOK
| Task | File | Notes |
|------|------|-------|
| Buttons | Button.tsx | Variants: primary, secondary, danger |
| Cards | Card.tsx | Container with header/footer |
| Layout | Layout.tsx | Main app shell with sidebar |
| Input | Input.tsx | Form fields with validation |
| Table | Table.tsx | Data display with sorting |

## CONVENTIONS
- Tailwind CSS for all styling
- TypeScript interfaces
- Prop-driven variants (variant, size, disabled)
- No internal state (controlled components)

## ANTI-PATTERNS
- Some components lack loading states
- Missing accessibility attributes (aria-*)
