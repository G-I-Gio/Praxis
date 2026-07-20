# 🔁 Reverse Proxy

> 🇫🇷 [Version française](reverse-proxy.md)

Praxis's container serves everything on a single port (`3000`): static assets, manager interface, REST API and WebSocket on `/ws`.

If you put Praxis behind a reverse proxy (for a domain name, HTTPS, or to run several applications on one host), the only requirement is that the proxy **forwards WebSocket upgrade requests**. Without this, the app loads but never connects (players stay stuck on "connecting").

> **Single instance only:** game state is kept in memory. Do not load-balance across multiple Praxis instances.

In all examples below, `praxis` resolves to wherever the container is reachable (e.g. `localhost:3000`, or the Docker Compose service name on the same network).

---

## Nginx Proxy Manager

Recommended graphical interface for homelabs and simple deployments.

1. Create a **Proxy Host**
2. **Forward Hostname / IP**: `praxis` (or `localhost`)
3. **Forward Port**: `3000`
4. Enable **Websockets Support** ✓
5. Configure SSL certificate if needed

---

## Traefik

Traefik proxies WebSocket upgrades automatically — no extra configuration needed. Example using Docker labels:

```yaml
services:
  praxis:
    image: praxis:latest
    volumes:
      - ./config:/app/config
    environment:
      PUID: 1000
      PGID: 1000
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.praxis.rule=Host(`quiz.example.com`)"
      - "traefik.http.routers.praxis.entrypoints=websecure"
      - "traefik.http.routers.praxis.tls.certresolver=letsencrypt"
      - "traefik.http.services.praxis.loadbalancer.server.port=3000"
    networks:
      - traefik
```

---

## Caddy

Caddy detects and proxies WebSocket upgrades automatically:

```caddyfile
quiz.example.com {
    reverse_proxy praxis:3000
}
```

---

## Nginx (manual configuration)

The `Upgrade`/`Connection` headers and the extended `proxy_read_timeout` keep the WebSocket connection alive for the duration of the game.

```nginx
server {
    listen 80;
    server_name quiz.example.com;

    location / {
        proxy_pass http://praxis:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }
}
```

---

## Other proxies

Any reverse proxy works as long as it:

- Forwards all paths (`/`, `/branding/`, `/ws`, `/api/`, `/auth/`) to the container's port `3000`
- Passes through `Upgrade` and `Connection` headers for WebSocket upgrades on `/ws`
- Uses a generous read timeout — players stay connected for the entire game (potentially longer than many proxies' default 60s timeout)

---

Back to the [documentation index](README.en.md).
