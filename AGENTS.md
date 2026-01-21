# AGENTS.md (Ticket-Master)

Ticket-Master is a small React + TypeScript + Vite app (no `src/` folder) for managing VIP events/tickets and validating tickets (manual entry + camera scan).

## Quick Orientation
- Entry points: `index.tsx` (mount), `App.tsx` (routing + state)
- Core UI: `components/Validator.tsx`, `components/EventDetail.tsx`
- Shared types: `types.ts`
- Optional cloud: `services/firebaseClient.ts` (Firebase backup/restore)
- Build tool: Vite (`vite.config.ts` sets `base` for GitHub Pages)
- Styling: Tailwind CDN in `index.html` (no Tailwind build pipeline)

## Commands (Build / Lint / Test)

```bash
# install
npm install
# or CI-like
npm ci

# dev
npm run dev

# build + preview
npm run build
npm run preview

# typecheck
npx tsc -p tsconfig.json --noEmit
```

- Dev server binds `0.0.0.0:5173` and opens a browser tab.
- Production `base` is `/Ticket-Master/`; keep this aligned with the GitHub Pages deploy path.

### Lint / Format
- No ESLint/Prettier configured (no `lint` script). If you add tooling, add npm scripts and update this file.

### Tests
- No test runner configured.
- If adding unit tests, prefer Vitest:
  - All tests: `npm test`
  - Single file: `npm test -- components/Validator.test.tsx`
  - Single test name: `npm test -- -t "ticket validates"`

## Cursor / Copilot Rules
- No Cursor rules found in `.cursor/rules/` and no `.cursorrules`.
- No Copilot instructions found in `.github/copilot-instructions.md`.

## Code Style Guidelines

### Language / React
- TypeScript (ES2022) + ESM (`"type": "module"`); Vite bundler resolution.
- React 19 with `react-jsx` runtime; `React.FC` is used in this repo (keep for consistency).
- Prefer early returns, small helpers, and minimal new dependencies.

### File Organization
- Keep app-level state/routing in `App.tsx`; extract UI blocks into `components/`.
- Keep shared domain types in `types.ts` (`EventData`, `Ticket`, `TicketStatus`, etc.).
- Keep integrations behind `services/*` and return `null` when not configured.

### App Architecture Notes
- Two main modes:
  - `validator` view: open access ticket validation (manual + camera scan)
  - `dashboard` / `event_detail`: manager-only flows (password gated)
- Manager password is currently the `MANAGER_PASSWORD` constant in `App.tsx`.
- Build metadata is injected via Vite defines: `__APP_VERSION__`, `__APP_BUILD_TIME__`.

### Imports
- Order imports: React/hooks -> third-party -> local modules.
- Prefer named imports.
- Use relative imports by default; `@/*` alias points to repo root if needed.

Practical tips:
- Keep large icon imports readable (wrap to multiple lines) and avoid importing unused icons.
- Avoid circular dependencies by keeping shared code in `types.ts` / `services/*`.

### Formatting
- Single quotes, semicolons.
- Trailing commas in multi-line objects/arrays.
- Wrap long JSX props/`className` so diffs stay readable.

### Naming
- Components/types: `PascalCase`; files generally match component name.
- Variables/functions/hooks: `camelCase`.
- True constants: `SCREAMING_SNAKE_CASE` (example: `MANAGER_PASSWORD` in `App.tsx`).
- Prefer string-literal unions for UI modes (`'view' | 'generate' | 'manual'`).

### Types
- Avoid `any`; use `unknown` + narrowing.
- Type boundaries explicitly (component props, exported helpers, service return types).
- Keep state shapes stable; use `Partial<Ticket>` for targeted updates (existing pattern).

When you must loosen types:
- Browser APIs may force `any` (e.g. `BarcodeDetector`); keep it localized to a small block.
- Prefer `as const` for hard-coded string unions and discriminated state.

### Error Handling / UX
- Log unexpected failures via `console.error(...)`.
- Use `alert(...)` for user-visible errors (existing UI pattern).
- For destructive actions, `window.confirm(...)` is acceptable; avoid confirm prompts for non-destructive flows.
- For async actions: set a busy flag, `try/catch/finally`, reset in `finally`.

UI behavior conventions seen in the repo:
- Prefer optimistic updates for “check-in” flows when safe, then persist via state updates.
- Disable buttons when busy/unavailable rather than allowing a failure path.
- Keep copy short and concrete; the UI is bilingual in places (Chinese + English) so avoid overly nuanced phrasing.

### Data & Persistence
- Local persistence keys: `vtm_events`, `vtm_tickets`.
- Use the hydration guard (`isHydrated`) before writing to `localStorage`.
- Backup JSON shape: `{ version, timestamp, events, tickets }`; bump `version` and add migration if you change it.

Data notes:
- Ticket lookup is done by `Ticket.code`; keep codes unique per app.
- Archived events remain in storage; validator treats archived tickets as non-check-in.

### Firebase (Optional)
- `getFirebaseServices()` returns `null` if required `VITE_FIREBASE_*` vars are missing.
- Never commit `.env` or hardcode credentials; security relies on Firebase Auth + Storage rules.

Env vars (Vite):
- Required: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_APP_ID`
- Optional: `VITE_FIREBASE_RECAPTCHA_SITE_KEY` (enables App Check)

Implementation constraints:
- Keep Firebase access behind the “not configured => return null” boundary.
- Keep backups under a per-user path (`backups/{uid}/...`) and rely on Storage rules.

### Styling (Tailwind CDN)
- Tailwind is loaded via CDN; `brand.*` colors are defined in `index.html`.
- Prefer Tailwind utilities over custom CSS.
- Keep accessible semantics: `type="button"` inside forms, visible focus states, reasonable contrast.

Component styling patterns:
- Prefer consistent spacing scales (`p-4`, `p-6`, `gap-2`, `gap-4`) rather than one-off values.
- Use `font-mono` for ticket codes/IDs.
- Use responsive utilities (`sm:`, `md:`, `lg:`) to keep the app usable on mobile.

Avoid:
- Adding a Tailwind build pipeline unless there is a strong reason (the app intentionally uses CDN Tailwind).
- Adding global CSS resets/themes; changes should be local and obvious.

## Safety Notes (Agents)
- Do not read or commit `.env`.
- Avoid large refactors or dependency additions unless requested.
- When changing deploy behavior, keep Vite `base` and GitHub Pages routing in mind.

If you add scripts or tooling:
- Update `package.json` scripts and mirror them in the Commands section above.
- Keep the repo runnable with `npm install && npm run dev`.
