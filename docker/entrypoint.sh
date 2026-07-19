#!/bin/sh

PUID=${PUID:-1000}
PGID=${PGID:-1000}
MAX_UPLOAD_SIZE=${MAX_UPLOAD_SIZE:-10}
LOG_LEVEL=${LOG_LEVEL:-info}
LOG_FORMAT=${LOG_FORMAT:-json}

echo "[entrypoint] PUID=${PUID} PGID=${PGID}"
echo "[entrypoint] MAX_UPLOAD_SIZE=${MAX_UPLOAD_SIZE}Mo LOG_LEVEL=${LOG_LEVEL} LOG_FORMAT=${LOG_FORMAT}"

# Créer le groupe seulement si le GID n'est pas déjà attribué
if ! getent group "${PGID}" > /dev/null 2>&1; then
  addgroup -g "${PGID}" praxis
fi
GROUPNAME=$(getent group "${PGID}" | cut -d: -f1)

# Créer l'utilisateur seulement si le UID n'est pas déjà attribué
if ! getent passwd "${PUID}" > /dev/null 2>&1; then
  adduser -D -u "${PUID}" -G "${GROUPNAME}" -h /app -s /bin/sh praxis
fi
USERNAME=$(getent passwd "${PUID}" | cut -d: -f1)

echo "[entrypoint] Utilisation de ${USERNAME}:${GROUPNAME} (${PUID}:${PGID})"

# ── Génération dynamique de la config nginx ──────────────────────────────────
# client_max_body_size = ceil(MAX_UPLOAD_SIZE * 1.25) en Mo
# Calcul entier : (MAX_UPLOAD_SIZE * 5 + 3) / 4
NGINX_BODY_SIZE=$(( (MAX_UPLOAD_SIZE * 5 + 3) / 4 ))
echo "[entrypoint] nginx client_max_body_size=${NGINX_BODY_SIZE}m (MAX_UPLOAD_SIZE=${MAX_UPLOAD_SIZE}Mo x1.25)"

sed -i "s|client_max_body_size [0-9]*m;|client_max_body_size ${NGINX_BODY_SIZE}m;|g" \
  /etc/nginx/http.d/default.conf

# ── Dossiers et fichiers runtime nginx dans /tmp ─────────────────────────────
mkdir -p /tmp/nginx/run /tmp/nginx/client_body \
         /tmp/nginx/proxy /tmp/nginx/fastcgi \
         /tmp/nginx/uwsgi /tmp/nginx/scgi
touch /tmp/nginx/access.log /tmp/nginx/error.log
chown -R "${PUID}:${PGID}" /tmp/nginx

# ── Dossier de config (volume monté depuis l'hôte) ───────────────────────────
chown -R "${PUID}:${PGID}" /app/config 2>/dev/null || true

# ── Export des variables pour supervisord et les processus enfants ───────────
export PRAXIS_UID="${PUID}"
export PRAXIS_GID="${PGID}"
export PRAXIS_USER="${USERNAME}"
export LOG_LEVEL="${LOG_LEVEL}"
export LOG_FORMAT="${LOG_FORMAT}"
export MAX_UPLOAD_SIZE="${MAX_UPLOAD_SIZE}"

echo "[entrypoint] Démarrage supervisord (socket et nginx tourneront en tant que ${USERNAME})"
exec supervisord -c /etc/supervisord.conf
