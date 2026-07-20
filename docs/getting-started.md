# 🚀 Getting Started

> 🇫🇷 [Version française](demarrage.md)

## Prerequisites

- Docker and Docker Compose

That's it. Praxis is distributed as a self-contained Docker image.

---

## Installation

### 1. Get the files

Clone the repository or copy the `compose.yml` and `.env.example` files to your server.

### 2. Create the configuration file

```bash
cp .env.example .env
```

Then edit `.env` according to your environment (see [Configuration](configuration.en.md)).

**Minimum required to get started:**

```env
PUID=1000
PGID=1000
```

> **Linux:** get your values with `id -u` and `id -g`.  
> **Windows/macOS with Docker Desktop:** leave as `1000`.

### 3. Build the image

Praxis is a fork with modified code — the image must be built locally:

```bash
docker build -t praxis:latest .
```

The first build takes 5 to 15 minutes. Subsequent builds are faster thanks to Docker's cache.

### 4. Start the container

```bash
docker compose up -d
```

The application is available at **http://localhost:3000** (or the port defined in `.env`).

---

## First Launch — Super-admin Creation

On first startup, Praxis displays an **initial setup page** at:

```
http://localhost:3000/setup
```

This page is **automatically disabled** once a super-admin has been created. It cannot be re-displayed without deleting the database.

Fill in:
- A username (3 to 32 characters)
- A password (minimum 8 characters)

The created account is a **superadmin** — it has access to all features, including managing other accounts.

---

## Login

Access the manager dashboard at:

```
http://localhost:3000/manager
```

Log in with the credentials created in the previous step.

---

## `config/` volume structure

Praxis automatically creates the following structure in the mounted folder:

```
config/
├── praxis.db          ← SQLite database (accounts, quizzes, results)
├── game.json          ← Legacy configuration (legacy manager password)
├── admin.json         ← Legacy admin configuration
├── branding/
│   └── theme.json     ← Visual and audio customisation (optional)
├── quizz/
│   └── example.json   ← Example quiz (public quiz, read-only)
└── results/           ← Legacy game results (created after first completed game)
```

> **Backup:** simply copy the `config/` folder to back up all your data.

---

## Updating

```bash
# Rebuild the image with the new code
docker build -t praxis:latest .

# Restart the container
docker compose up -d
```

Your data in `config/` is preserved between updates.

---

## Deploying behind a reverse proxy

See [Reverse Proxy](reverse-proxy.en.md) for Traefik, Caddy and Nginx examples.

---

Back to the [documentation index](README.en.md).
