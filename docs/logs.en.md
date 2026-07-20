# 📋 Logs

> 🇫🇷 [Version française](logs.md)

Praxis produces structured JSON logs on stdout, filterable by source and level.

---

## Log sources

Each log line contains a `source` field identifying its origin:

| Source | Description |
|---|---|
| `app` | Node.js application logs (startup, authentication, game, errors) |
| `nginx_access` | HTTP requests received by nginx |
| `nginx_error` | nginx errors and warnings |

Supervisord logs (process startup) are emitted as plain text and only appear at container startup.

---

## JSON Format

### Application logs (`source: "app"`)

```json
{
  "ts": "2026-07-18T20:15:20.082Z",
  "level": "info",
  "source": "app",
  "msg": "[startup] HTTP server ready",
  "ctx": { "port": 3001 }
}
```

### HTTP requests (`source: "nginx_access"`)

```json
{
  "ts": "2026-07-18T20:15:20+00:00",
  "level": "info",
  "source": "nginx_access",
  "msg": "GET /api/quizzes 200",
  "ctx": {
    "ip": "172.18.0.1",
    "method": "GET",
    "path": "/api/quizzes",
    "status": 200,
    "bytes": 2621,
    "duration_ms": 0.012,
    "ua": "Mozilla/5.0 ..."
  }
}
```

### nginx errors (`source: "nginx_error"`)

```json
{
  "ts": "2026-07-18T20:15:20.000Z",
  "level": "warn",
  "source": "nginx_error",
  "msg": "upstream timed out ..."
}
```

---

## Log Levels

Controlled by the `LOG_LEVEL` variable (see [Configuration](configuration.en.md)).

| Level | Description |
|---|---|
| `debug` | Detailed debugging information |
| `info` | General operational information |
| `warn` | Non-blocking warnings |
| `error` | Errors requiring attention |
| `audit` | Sensitive actions — **always active** regardless of `LOG_LEVEL` |

The `audit` level records: successful and failed logins, account creation/modification/deletion, branding uploads, theme reloads.

---

## Filtering Commands

### Linux / macOS

```bash
# Everything
docker logs praxis

# Application only
docker logs praxis 2>&1 | grep '"source":"app"'

# HTTP requests only
docker logs praxis 2>&1 | grep '"source":"nginx_access"'

# nginx errors only
docker logs praxis 2>&1 | grep '"source":"nginx_error"'

# Audit actions only
docker logs praxis 2>&1 | grep '"level":"audit"'

# Live follow — requests only
docker logs praxis -f 2>&1 | grep '"source":"nginx_access"'

# With jq for formatted output
docker logs praxis 2>&1 | grep '"source":"app"' | jq .
```

### PowerShell (Windows)

```powershell
# Everything
docker logs praxis-stack-praxis-1 2>&1

# Application only
docker logs praxis-stack-praxis-1 2>&1 | Select-String '"source":"app"'

# HTTP requests only
docker logs praxis-stack-praxis-1 2>&1 | Select-String '"source":"nginx_access"'

# nginx errors only
docker logs praxis-stack-praxis-1 2>&1 | Select-String '"source":"nginx_error"'

# Live follow
docker logs praxis-stack-praxis-1 -f 2>&1 | Select-String '"source":"app"'
```

---

## Pretty Format (development)

By setting `LOG_FORMAT=pretty`, application logs are displayed in a readable coloured format:

```
[2026-07-18 20:15:20.082] INFO  [startup] HTTP server ready  port=3001
[2026-07-18 20:15:20.083] INFO  [startup] WebSocket handlers registered — application ready
```

> This format is not parseable by log aggregators. Use `json` in production.

---

## Integration with a log aggregator

JSON logs are natively compatible with Loki, Datadog, ELK and any aggregator supporting JSON format on stdin. Simply point the aggregator at `docker logs` or configure a Docker log driver.

---

Back to the [documentation index](README.en.md).
