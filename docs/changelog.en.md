# 📋 Changelog

> 🇫🇷 [Version française](changelog.md)

Version history for Praxis. Dates correspond to GitHub releases.

---

## v0.0.3.1 — Consolidation (19 July 2026)

### Bug fixes
- **Quiz sharing** — fixed validation error when changing visibility (`PUT /api/quizzes/:id` required `subject` and `questions`; replaced by a dedicated `PATCH /api/quizzes/:id/visibility`, symmetric with results)
- **Result sharing modal** — the list of available managers was loaded once at mount; it now refreshes every time the modal is opened
- **Search in sharing modal** — missing search field in `ShareResultModal`, added with independent scroll

### New features
- **Password change** — dedicated button (key icon) in the dashboard header, accessible to all roles. Modal with individual show/hide toggles and double confirmation. After a successful change: option to disconnect all other active sessions
- **Quiz sharing between managers** — share button (Share2 icon) on each quiz, visible only to the owner. Modal identical to result sharing with integrated search. Non-owner managers have read-only access (edit button hidden, deletion disabled)
- **Search** — search field added in the Quiz tab (by name), Results tab (by name or date DD/MM/YYYY) and Accounts tab (by username). Uniform width, immediate filtering

### Backend
- `PUT /auth/password` — change your own password (bcrypt verification of the current password)
- `POST /auth/sessions/invalidate` — invalidate all active sessions except the current one
- `PATCH /api/quizzes/:id/visibility` — update only the visibility of a quiz

---

## v0.0.3 — First public release (19 July 2026)

Initial release of the Praxis fork. See [Changes from Razzia](modifications.en.md) for the full details of what distinguishes Praxis from Razzia.

### Authentication & accounts
- Individual account system with roles (manager / superadmin)
- SQLite sessions with HttpOnly + SameSite=Strict cookie
- Rate limiting: 5 failed attempts → IP blocked for 15 minutes
- Audit log of all sensitive actions
- Super-admin creation page on first startup (`/setup`)

### REST API
- `/auth/*` routes — authentication, sessions
- `/api/quizzes` routes — quiz CRUD with visibility (private / public / shared)
- `/api/results` routes — game results with visibility and sharing
- `/api/managers` routes — account management (superadmin)
- `/api/branding` routes — customisation and file uploads
- `/health` route — Docker healthcheck

### Manager dashboard (`/manager/dashboard`)
- **Play** tab — quiz selection and game launch
- **Quiz** tab — CRUD, JSON import/export, sharing
- **Results** tab — viewing, visibility, granular sharing per manager
- **Accounts** tab *(superadmin)* — account creation, editing, deletion
- **Appearance** tab *(superadmin)* — full branding with real-time application

### Docker infrastructure
- Non-root execution via configurable `PUID`/`PGID`
- Environment variables: `MAX_UPLOAD_SIZE`, `LOG_LEVEL`, `LOG_FORMAT`
- Structured JSON logs with `source` field (`app`, `nginx_access`, `nginx_error`)
- Docker healthcheck on `/health` with frontend startup page
- Graceful shutdown on SIGTERM (10-second timeout)

### Compatibility
- Original Razzia interface preserved at `/legacy`
- JSON quiz file format unchanged
- Player WebSocket protocol unchanged

---

## v0.0.2 — Fork baseline (historical)

Starting version of the fork. Contains the initial adaptation work from Razzia:

- Praxis renaming, custom branding
- Player avatar system (16 PNGs, selection in waiting room)
- Enhanced waiting room
- Custom audio configurable via `theme.json`
- Draft manager authentication system

---

Back to the [documentation index](README.en.md).
