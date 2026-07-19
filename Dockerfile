# ---- BASE ----
FROM node:26-alpine AS base
RUN npm install -g pnpm

# ---- BUILDER ----
FROM base AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY pnpm-workspace.yaml package.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/web/package.json ./packages/web/
COPY packages/socket/package.json ./packages/socket/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install

COPY . .

RUN pnpm build

# Déploiement isolé : résout toutes les dépendances du socket (y compris better-sqlite3)
RUN pnpm --filter @razzia/socket deploy --prod --legacy /app/deploy/socket

# ---- RUNNER ----
FROM node:26-alpine AS runner

# su-exec : outil minimal Alpine pour changer d'utilisateur sans fork
# (équivalent léger de gosu)
RUN apk add --no-cache nginx supervisor su-exec

# Config nginx
COPY docker/nginx-main.conf /etc/nginx/nginx.conf
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

# Dossiers nginx — accessibles à tout utilisateur au runtime
# /var/lib/nginx est créé par le package nginx mais appartient à root
RUN mkdir -p /var/lib/nginx/logs /var/lib/nginx/tmp \
             /var/log/nginx \
 && chmod -R 777 /var/lib/nginx /var/log/nginx

COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/log-relay.sh /docker/log-relay.sh

COPY --from=builder /app/packages/web/dist /app/web
COPY --from=builder /app/packages/socket/dist/index.cjs /app/deploy/socket/index.cjs
COPY --from=builder /app/deploy/socket/node_modules /app/deploy/socket/node_modules

# Dossier config — sera monté en volume depuis l'hôte
# On le crée pour éviter que Docker le crée en root automatiquement
RUN mkdir -p /app/config

# L'entrypoint crée l'utilisateur praxis avec PUID/PGID au runtime
# et transfère les droits sur les dossiers nécessaires
EXPOSE 3000

# Healthcheck Docker — vérifie que l'application est prête
# start-period : laisse 30s au conteneur pour démarrer avant de compter les échecs
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health | grep -q '"ready":true' || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
