# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server (http://localhost:5173)
npm run build    # tsc -b (type-check) && vite build -> dist/
npm run preview  # serve the production build locally
```

There is no lint script and no test runner configured in this repo — there are no automated tests. Type errors surface via `npm run build` (the `tsc -b` step runs before `vite build` and will fail the build on type errors).

Requires a `.env` with `VITE_API_BASE_URL` (backend API base URL) and `VITE_GOOGLE_CLIENT_ID` (Google OAuth login button).

## Architecture

Vite + React 18 + TypeScript + Tailwind, routed with `react-router-dom` v7. All routes are declared in one place: [src/routes/AppRoutes.tsx](src/routes/AppRoutes.tsx). Authenticated pages render inside `AppShell` (the sidebar/layout shell); `/login` is the only route outside it.

**Route guards are defined inline in AppRoutes.tsx itself** (`PrivateRoute`, `SupervisorRoute`), not in a shared auth module — they duplicate the token/role-reading logic that also lives in `src/lib/auth.ts`. If you change how roles or auth are read, update both places.

### Auth token handling is duplicated across the codebase, not centralized

There is no single source of truth for "how do I read the current user/JWT." The same localStorage/sessionStorage key lookup (checking `token`, `access_token`, `auth_token`, `accessToken` in turn) and manual base64 JWT-payload decoding is reimplemented independently in at least:
- [src/lib/auth.ts](src/lib/auth.ts)
- [src/service/http.ts](src/service/http.ts) (axios request interceptor)
- [src/routes/AppRoutes.tsx](src/routes/AppRoutes.tsx) (local `getAuthPayload`/`isSupervisorOrAdmin`)
- [src/components/supervision/api.ts](src/components/supervision/api.ts) (`getAuthToken`/`getAuthHeaders` for its own `fetchJSON`)

When changing login, logout, token storage keys, or the shape of the JWT payload (role/isAdmin/isSupervisorOrAdmin), grep for `access_token`/`auth_token`/`getAuthPayload` and update every copy — a fix in one file will not propagate to the others.

### Two parallel HTTP client patterns

- `src/service/http.ts` exports a shared `axios` instance (`http`) with a request interceptor that attaches `Authorization: Bearer <token>`. Most `src/service/*.service.ts` files use this.
- `src/components/supervision/api.ts` instead exports a standalone `fetchJSON` wrapper around the native `fetch`, with its own auth header logic and its own base URL resolution (`VITE_API_BASE_URL`, separately from `http.ts`'s `baseURL`).

Pick whichever pattern matches the sibling code in the file/feature you're editing rather than introducing a third.

### Feature organization

- `src/pages/` — one file per route/screen (e.g. `TareasPage`, `ClientesPage`, `TareasSupervisionPage`), some with their own subfolders for sub-views (`pages/supervision/views`, `pages/creacion-tareas/tabs`).
- `src/components/` — shared/domain components grouped by feature subfolder (`cierre-tareas`, `clientes`, `personas`, `supervision`, `tareas`, `task-assignment`, `tickets`, `ui`).
- `src/modules/tickets/` — the most self-contained feature module (own `api/`, `components/`, `hooks/`, `pages/`, `services/`, `types/`, `utils/`, plus its own [README.md](src/modules/tickets/README.md) documenting the ticket visibility rules, HUD filters, and endpoints it calls). Note the ticket routes are currently commented out in `AppRoutes.tsx`.
- `src/service/*.service.ts` — axios-based API clients for non-modularized features (bitacora, clientes, tareas, supervisión de tareas).

Role gating convention: `SupervisorRoute` wraps routes that should only be visible to `ADMIN`/`SUPERVISOR` roles (as decoded from the JWT); everything else behind `PrivateRoute` just requires any valid token.

Rich text editing uses TipTap (`@tiptap/*`); spreadsheet import/export uses `exceljs`/`xlsx`/`xlsx-populate`/`xlsx-js-style` and `file-saver` (see `src/utils/bitacorasExcel.ts` and the `Excel*` components under `components/clientes` and `components/task-assignment`).

Deploys to Netlify (`netlify.toml` — SPA fallback rewrites all paths to `index.html`). `dist/` is committed at the repo root as the last built output.
