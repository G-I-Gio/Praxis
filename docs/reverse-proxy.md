# 🔁 Reverse Proxy

> 🇬🇧 [English version](reverse-proxy.en.md)

Le conteneur Praxis expose tout sur un seul port (`3000`) : assets statiques, interface manager, API REST et WebSocket sur `/ws`.

Si vous placez Praxis derrière un reverse proxy (pour un nom de domaine, HTTPS, ou faire tourner plusieurs applications sur un même hôte), le seul prérequis est que le proxy **transmette les requêtes de mise à niveau WebSocket**. Sans ça, l'application se charge mais ne se connecte jamais (les joueurs restent bloqués sur "connexion en cours").

> **Instance unique uniquement :** l'état du jeu est conservé en mémoire. Ne pas load-balancer sur plusieurs instances Praxis.

Dans tous les exemples ci-dessous, `praxis` pointe vers l'endroit où le conteneur est accessible (ex: `localhost:3000`, ou le nom du service Docker Compose sur le même réseau).

---

## Nginx Proxy Manager

Interface graphique recommandée pour les homelab et les déploiements simples.

1. Créer un **Proxy Host**
2. **Forward Hostname / IP** : `praxis` (ou `localhost`)
3. **Forward Port** : `3000`
4. Activer **Websockets Support** ✓
5. Configurer le certificat SSL si nécessaire

---

## Traefik

Traefik gère les WebSockets automatiquement — aucune configuration supplémentaire nécessaire. Exemple avec les labels Docker :

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
      - "traefik.http.routers.praxis.rule=Host(`quiz.exemple.fr`)"
      - "traefik.http.routers.praxis.entrypoints=websecure"
      - "traefik.http.routers.praxis.tls.certresolver=letsencrypt"
      - "traefik.http.services.praxis.loadbalancer.server.port=3000"
    networks:
      - traefik
```

---

## Caddy

Caddy détecte et proxifie les WebSockets automatiquement :

```caddyfile
quiz.exemple.fr {
    reverse_proxy praxis:3000
}
```

---

## Nginx (configuration manuelle)

Les headers `Upgrade`/`Connection` et le `proxy_read_timeout` élevé maintiennent la connexion WebSocket ouverte pendant toute la durée de la partie.

```nginx
server {
    listen 80;
    server_name quiz.exemple.fr;

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

## Autres proxies

Tout reverse proxy fonctionne à condition de :

- Transmettre tous les chemins (`/`, `/branding/`, `/ws`, `/api/`, `/auth/`) vers le port `3000` du conteneur
- Faire passer les headers `Upgrade` et `Connection` pour les WebSockets sur `/ws`
- Utiliser un timeout de lecture généreux — les joueurs restent connectés pendant toute la partie (potentiellement plus de 60s, valeur par défaut de beaucoup de proxies)

---

Retour à l'[index de la documentation](README.md).
