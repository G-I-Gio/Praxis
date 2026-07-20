# ⚙️ Configuration

> 🇫🇷 [Version française](configuration.md)

Praxis configuration uses two complementary mechanisms:

- **Environment variables** — container behaviour (user, logs, uploads)
- **`config/` volume** — application data (quizzes, branding, SQLite database)

---

## Environment Variables

All variables are optional and have default values.  
They are defined in the `.env` file (copied from `.env.example`).

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port exposed on the host |
| `PUID` | `1000` | Unix UID the container runs as |
| `PGID` | `1000` | Unix GID the container runs as |
| `MAX_UPLOAD_SIZE` | `10` | Maximum upload size in MB (logo, sounds…) |
| `LOG_LEVEL` | `info` | Log level: `debug` \| `info` \| `warn` \| `error` |
| `LOG_FORMAT` | `json` | Log format: `json` (production) \| `pretty` (dev) |

### `PUID` / `PGID`

Allow the container to run as a specific user — essential on Linux so that files created in `config/` belong to the right user.

```bash
# Get the values on Linux
id -u   # → PUID
id -g   # → PGID
```

> **Windows/macOS with Docker Desktop:** leave as `1000`, permissions are managed by the VM.

### `MAX_UPLOAD_SIZE`

Controls the maximum size of files uploaded via the admin interface (logo, favicon, sounds). nginx is automatically configured to `MAX_UPLOAD_SIZE × 1.25` for a safety margin.

```env
MAX_UPLOAD_SIZE=20   # Node validates at 20 MB, nginx accepts up to 25 MB
```

### `LOG_LEVEL`

Filters Node.js application logs. The `audit` level (sensitive actions: login, account creation, deletion) is **always active** regardless of the configured level.

```env
LOG_LEVEL=debug   # All logs including debug output
LOG_LEVEL=info    # Default — general information
LOG_LEVEL=warn    # Warnings and errors only
LOG_LEVEL=error   # Errors only
```

### `LOG_FORMAT`

```env
LOG_FORMAT=json    # One JSON line per event — recommended in production
LOG_FORMAT=pretty  # Coloured readable output — useful for local development
```

See [Logs](logs.en.md) for filtering commands.

---

## `config/` Volume

The `./config:/app/config` volume in `compose.yml` persists all application data between container updates.

### `config/game.json`

Configuration for the **legacy** interface (original Razzia mode, accessible at `/legacy`).

```json
{
  "managerPassword": "PASSWORD"
}
```

> This file is only used by the `/legacy` interface. The new `/manager` interface uses database accounts.

### `config/branding/theme.json`

Visual and audio customisation. Manageable directly from the superadmin interface — see [Branding](branding.en.md).

### `config/quizz/`

JSON-formatted quizzes, served as **public quizzes** readable by all managers. See [Quiz](quiz.en.md).

### `config/praxis.db`

SQLite database. Contains manager accounts, sessions, private quizzes and game results.

Main tables:
- `managers` — user accounts (username, hashed password, role)
- `manager_sessions` — active session tokens
- `quizzes` — quizzes created via the dashboard (with visibility and owner)
- `results` — game results (with visibility and owner)
- `audit_log` — log of sensitive actions
- `settings` — global settings

> **Do not delete** this file without exporting your data first — deleting it erases all accounts and triggers the `/setup` page again.

---

## Example `.env` file

```env
# Network
PORT=3000

# Execution user (Linux: id -u / id -g)
PUID=1000
PGID=1000

# Uploads
MAX_UPLOAD_SIZE=10

# Logs
LOG_LEVEL=info
LOG_FORMAT=json
```

---

Back to the [documentation index](README.en.md).
