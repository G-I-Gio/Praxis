# 🔧 Changes from Razzia

> 🇫🇷 [Version française](modifications.md)

This document describes the technical choices made in the Praxis fork, what was added, modified or preserved compared to [Razzia](https://github.com/Ralex91/Razzia), and the reasons behind those choices.

---

## General Philosophy

Praxis starts from a simple observation: Razzia is an excellent tool for one-off events, but its shared global password authentication model is not suitable for enterprise use, where multiple facilitators need to coexist with their own quiz libraries and their own results.

**Three principles guided the development:**

1. **Full compatibility** — everything that worked in Razzia works in Praxis. The `/legacy` interface is preserved in its entirety.
2. **No monkey-patching** — every modification is structured, traceable and documented. We fix causes, not symptoms.
3. **Robustness before features** — security, logs, healthcheck, non-root deployment before adding features.

---

## What was kept unchanged

- The complete game engine (Socket.IO, questions, answers, scoring, podium)
- The JSON quiz file format (`config/quizz/*.json`)
- JSON game results (`config/results/*.json`)
- The `config/branding/theme.json` branding system (extended, not broken)
- The player interface (`/party/$gameId`)
- The player WebSocket protocol (unchanged — existing clients work)
- All npm dependencies

---

## Modifications to the original Razzia code

Two files from the original code were modified in a backwards-compatible way:

### `features/game/utils/constants.ts`

The static `SFX` constant (hardcoded audio paths) was replaced by a `getSFX()` function that dynamically reads paths from the branding configuration. If no custom sounds are configured, Razzia's original sounds are used as fallback — the behaviour is identical to the original.

### Game components (Room, Podium, Leaderboard, Answers, Question, Responses, Result, Start, Wait)

Integration of the player avatar system. Components work identically without an avatar — the avatar is optional and gracefully degrades to coloured initials.

---

## Backend additions

### Multi-user authentication

**Why:** a shared global password allows no action traceability, no personal quiz libraries, and no individual access revocation.

**How:** new `database.ts` service with SQLite (better-sqlite3). Tables: `managers`, `manager_sessions`, `audit_log`, `settings`, `quizzes`, `results`. Passwords hashed with bcrypt (12 rounds). Sessions via HttpOnly + SameSite=Strict cookie. In-memory rate limiting (5 attempts → 15 min IP block).

Managers can change their own password via `PUT /auth/password` (bcrypt verification of the current password required). Invalidating other active sessions is available via `POST /auth/sessions/invalidate`.

### REST API

**Why:** Socket.IO is designed for real-time events, not resource CRUD. Using Socket.IO to manage quizzes and results mixed two responsibilities into a single channel.

**How:** native Node.js HTTP server on the same port as Socket.IO (3001), proxied by nginx. Lightweight router without a framework. `requireAuth` and `requireSuperadmin` middlewares based on the session cookie.

Full routes:

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/health` | Public | Docker healthcheck |
| POST | `/auth/setup` | Public (once) | Super-admin creation |
| GET | `/auth/status` | Public | Setup state and readiness |
| POST | `/auth/login` | Public | Login |
| POST | `/auth/logout` | Authenticated | Logout |
| PUT | `/auth/password` | Authenticated | Change own password |
| POST | `/auth/sessions/invalidate` | Authenticated | Invalidate other sessions |
| GET | `/auth/me` | Authenticated | Current identity |
| GET | `/api/quizzes` | Authenticated | List accessible quizzes |
| POST | `/api/quizzes` | Authenticated | Create a quiz |
| GET | `/api/quizzes/:id` | Read | Quiz details |
| PUT | `/api/quizzes/:id` | Owner | Edit a quiz |
| DELETE | `/api/quizzes/:id` | Owner | Delete a quiz |
| GET | `/api/quizzes/:id/export` | Read | JSON export without metadata |
| POST | `/api/quizzes/import` | Authenticated | Import a JSON file |
| PATCH | `/api/quizzes/:id/visibility` | Owner | Change visibility/sharing |
| GET | `/api/results` | Authenticated | List accessible results |
| GET | `/api/results/:id` | Read | Result details |
| DELETE | `/api/results/:id` | Owner | Delete a result |
| PATCH | `/api/results/:id/visibility` | Owner | Change visibility/sharing |
| GET | `/api/managers` | Authenticated | List (full for superadmin, id+username for manager) |
| POST | `/api/managers` | Superadmin | Create an account |
| PUT | `/api/managers/:id` | Superadmin | Edit an account |
| DELETE | `/api/managers/:id` | Superadmin | Delete an account |
| GET | `/api/branding` | Authenticated | Read theme.json |
| PATCH | `/api/branding` | Superadmin | Update theme.json |
| POST | `/api/branding/upload/:field` | Superadmin | Upload a file |
| DELETE | `/api/branding/field/:field` | Superadmin | Reset a field to default |
| POST | `/api/branding/apply` | Superadmin | Broadcast BRANDING.RELOAD |

### SQLite storage for quizzes and results

**Why:** JSON files in `config/quizz/` are shared resources with no concept of ownership. Impossible to distinguish "my quizzes" from "the team's quizzes".

**How:** `quizzes` and `results` tables with `owner_id`, `visibility` (private/public/shared), `shared_with` (JSON array of manager UUIDs). Existing JSON files continue to work as read-only public quizzes — no migration needed.

Quiz sharing is **read-only for non-owners**: edit and delete buttons are only shown to the owner.

### Socket.IO ↔ HTTP bridge (`AUTH_SESSION`)

**Why:** launching a game from the new dashboard requires Socket.IO authentication, but the dashboard uses HTTP sessions (cookie). Two auth systems, one WebSocket channel.

**How:** new `manager:authSession` event that receives the HTTP session token via `GET /auth/token`, validates it in the database, and authenticates the socket without going through the global password. `socket.data.managerId` is populated to track result ownership.

### Health service (`health.ts`)

Single source of truth on startup state. 4 sequential checkpoints: `config`, `database`, `http`, `socket`. Each transitions from `pending` to `ok` or `error` during initialisation in `index.ts`. Graceful shutdown on SIGTERM: `setShuttingDown()` immediately (reverse proxy stops sending traffic), then clean shutdown with 10-second timeout.

### Structured logger (`logger.ts`)

Replaces all backend `console.log/warn/error`. JSON format on stdout with `source: "app"` field. `audit` level always active (sensitive actions). Supports `LOG_FORMAT=pretty` for local development.

---

## Frontend additions

### `/manager/dashboard` dashboard

Complete interface replacing the original Socket.IO login page. HTTP cookie authentication. Tabs by role:

| Tab | Role | Features |
|---|---|---|
| Play | All | Quiz selection, game launch |
| Quiz | All | CRUD, import/export, granular sharing, search |
| Results | All | Viewing, visibility, sharing, search (name + date) |
| Accounts | Superadmin | Creation, editing, deletion, search |
| Appearance | Superadmin | Full branding with real-time application |

The header exposes a password change button accessible to all roles.

### Legacy route `/legacy`

The original Razzia interface is moved to `/legacy` and works identically. The `/manager` route now points to the new authentication system.

### Startup page (`startup.tsx`)

Displayed during container initialisation. Polls `/health` every second and displays the 4 checkpoints in real time with ✓/⏳/✗ icons. Disappears automatically when the application is ready.

### Avatar system

16 selectable PNG avatars in the waiting room. Falls back to coloured initials if no avatar is selected. New Socket.IO event `player:updateAvatar`.

---

## Docker universalisation

### Non-root execution

**Why:** in enterprise environments, security/infrastructure teams often refuse containers running as root. Some environments (Kubernetes, OpenShift) explicitly prohibit it.

**How:** `PUID`/`PGID` variables in `compose.yml`. `entrypoint.sh` script that creates the user dynamically (reusing an existing uid/gid if already taken) and adjusts volume permissions before launching supervisord. nginx and Node run under the target user via supervisord's `user=` directive.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PUID` | `1000` | Unix execution UID |
| `PGID` | `1000` | Unix execution GID |
| `MAX_UPLOAD_SIZE` | `10` | Max upload size in MB |
| `LOG_LEVEL` | `info` | Log level |
| `LOG_FORMAT` | `json` | Log format |

The nginx body limit is automatically calculated at `MAX_UPLOAD_SIZE × 1.25` by `entrypoint.sh` via `sed` on `/etc/nginx/http.d/default.conf`.

### Structured JSON logs

**Why:** raw `console.log` output is not filterable, not aggregatable, and mixes heterogeneous sources.

**How:** `logger.ts` on the Node side. nginx configured with `log_format json_access`. `log-relay.sh` script that relays nginx logs (access already JSON, error encapsulated in minimal JSON) to stdout. Three filterable sources: `app`, `nginx_access`, `nginx_error`.

### Healthcheck and graceful shutdown

`HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3` on `GET /health`. `setShuttingDown()` called upon receiving SIGTERM so the reverse proxy stops sending traffic immediately.

---

## New files created

### Backend
| File | Role |
|---|---|
| `packages/socket/src/services/database.ts` | SQLite: init, migrations, CRUD |
| `packages/socket/src/services/http.ts` | Native HTTP server, all REST routes |
| `packages/socket/src/services/health.ts` | Health service and startup state |
| `packages/socket/src/services/logger.ts` | Structured JSON logger |

### Docker
| File | Role |
|---|---|
| `docker/entrypoint.sh` | PUID/PGID user creation, dynamic nginx config |
| `docker/nginx-main.conf` | Main nginx config (pid, logs, /tmp paths) |
| `docker/log-relay.sh` | nginx logs → stdout JSON relay |

### Frontend — Dashboard Features
| File | Role |
|---|---|
| `features/dashboard/useDashboardAuth.ts` | HTTP auth hook |
| `features/dashboard/useQuizApi.ts` | Quiz REST CRUD hook |
| `features/dashboard/useResultsApi.ts` | Results REST CRUD hook |
| `features/dashboard/useManagersApi.ts` | Managers REST CRUD hook |
| `features/dashboard/useBrandingApi.ts` | Branding REST hook |
| `features/dashboard/useAllManagers.ts` | Managers list hook (sharing) |
| `features/dashboard/DashboardQuizList.tsx` | Quiz list with sharing and search |
| `features/dashboard/DashboardResults.tsx` | Results list with sharing and search |
| `features/dashboard/DashboardManagers.tsx` | Account management with search |
| `features/dashboard/DashboardAppearance.tsx` | Branding customisation |
| `features/dashboard/ShareResultModal.tsx` | Result sharing modal with search |
| `features/dashboard/ShareQuizModal.tsx` | Quiz sharing modal with search |
| `features/dashboard/ChangePasswordModal.tsx` | Password change modal |
| `features/dashboard/PasswordSuccessModal.tsx` | Success modal + session management |

---

## Modified files

| File | Nature of change |
|---|---|
| `packages/common/src/constants.ts` | Added events: `PLAYER.UPDATE_AVATAR`, `MANAGER.AUTH_SESSION`, `BRANDING.RELOAD` |
| `packages/common/src/types/game/socket.ts` | Added types for new events |
| `packages/common/src/types/game/index.ts` | Added `avatar?: string` field on Player |
| `packages/socket/src/index.ts` | Health checkpoints, graceful shutdown, `setSocketIo()` |
| `packages/socket/src/handlers/game.ts` | `findQuizz()` searches SQLite then JSON files |
| `packages/socket/src/handlers/manager.ts` | `AUTH_SESSION` handler, `managerId` stored in `socket.data` |
| `packages/socket/src/services/game/index.ts` | `saveResultDb` vs `saveResult` based on `managerId` |
| `packages/web/src/pages/__root.tsx` | Startup page, listens for `BRANDING.RELOAD` |
| `packages/web/src/pages/manager/dashboard.tsx` | Full dashboard (all tabs, modals) |
| `packages/web/src/pages/manager/quizz/*.tsx` | `apiMode` (REST save) |
| `packages/web/src/pages/party/manager/$gameId.tsx` | End-of-game redirect → `/manager/dashboard` |
| `packages/web/src/features/quizz/components/QuizzEditorHeader.tsx` | REST mode added alongside Socket.IO mode |
| `packages/web/src/pages/(auth)/manager/index.tsx` | Username/password login instead of global password |
| `packages/web/src/features/game/utils/constants.ts` | `SFX` → dynamic `getSFX()` |
| `docker/nginx.conf` | Proxy `/auth/`, `/api/` (20 MB max), `/branding/`, `/health` |
| `packages/web/src/locales/*/manager.json` | i18n keys: `tabs.*`, results, accounts |
| `packages/web/src/branding.ts` | Extended audio schema (9 fields), `appName` fallback |

---

## What was not done (and why)

**No JWT** — SQLite sessions (opaque tokens) are simpler, revocable at any time, and require no secret to manage.

**No granular permissions on shared quizzes** — sharing is read-only for non-owners. If an owner wants a colleague to edit their quiz, they can duplicate it via import/export. This avoids disproportionate rights management complexity.

**No multi-instance** — game state is in memory (Razzia's choice preserved). Load-balancing across multiple instances would break the game.

**No configurable internal port** — the internal container port 3000 has no reason to be changed. Only the external (host) port is configurable.

**No Docker Secrets** — environment variables with an unversioned `.env` file are sufficient for the target security level and far simpler to implement.

---

Back to the [documentation index](README.en.md).
