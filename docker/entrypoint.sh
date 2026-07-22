#!/bin/sh

PUID=${PUID:-1000}
PGID=${PGID:-1000}
MAX_UPLOAD_SIZE=${MAX_UPLOAD_SIZE:-10}
MAX_MEDIA_SIZE=${MAX_MEDIA_SIZE:-20}
LOG_LEVEL=${LOG_LEVEL:-info}
LOG_FORMAT=${LOG_FORMAT:-json}
KNOWN_PROXIES=${KNOWN_PROXIES:-}

echo "[entrypoint] PUID=${PUID} PGID=${PGID}"
echo "[entrypoint] MAX_UPLOAD_SIZE=${MAX_UPLOAD_SIZE}Mo MAX_MEDIA_SIZE=${MAX_MEDIA_SIZE}Mo"
echo "[entrypoint] LOG_LEVEL=${LOG_LEVEL} LOG_FORMAT=${LOG_FORMAT}"
echo "[entrypoint] KNOWN_PROXIES=${KNOWN_PROXIES:-<non défini — nginx interne uniquement>}"

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

# Limite branding : ceil(MAX_UPLOAD_SIZE * 1.25)
NGINX_UPLOAD_SIZE=$(( (MAX_UPLOAD_SIZE * 5 + 3) / 4 ))

# Limite médias : ceil(MAX_MEDIA_SIZE * 1.25)
NGINX_MEDIA_SIZE=$(( (MAX_MEDIA_SIZE * 5 + 3) / 4 ))

# On prend le max des deux pour client_max_body_size global
# (la restriction fine est faite côté Node pour chaque route)
if [ "${NGINX_MEDIA_SIZE}" -gt "${NGINX_UPLOAD_SIZE}" ]; then
  NGINX_BODY_SIZE="${NGINX_MEDIA_SIZE}"
else
  NGINX_BODY_SIZE="${NGINX_UPLOAD_SIZE}"
fi

echo "[entrypoint] nginx client_max_body_size=${NGINX_BODY_SIZE}m" \
     "(upload=${NGINX_UPLOAD_SIZE}m, media=${NGINX_MEDIA_SIZE}m)"

sed -i "s|client_max_body_size [0-9]*m;|client_max_body_size ${NGINX_BODY_SIZE}m;|g" \
  /etc/nginx/http.d/default.conf

# ── Injection des KNOWN_PROXIES dans la config nginx (set_real_ip_from) ──────
# Le placeholder KNOWN_PROXIES_PLACEHOLDER est remplacé par les directives réelles
REAL_IP_DIRECTIVES=""
if [ -n "${KNOWN_PROXIES}" ]; then
  # Itérer sur les entrées séparées par des virgules
  OLD_IFS="$IFS"
  IFS=","
  for proxy in ${KNOWN_PROXIES}; do
    # Trim des espaces
    proxy=$(echo "${proxy}" | tr -d ' ')
    if [ -n "${proxy}" ]; then
      REAL_IP_DIRECTIVES="${REAL_IP_DIRECTIVES}set_real_ip_from ${proxy};\n"
      echo "[entrypoint] Proxy de confiance ajouté : ${proxy}"
    fi
  done
  IFS="$OLD_IFS"
fi

if [ -n "${REAL_IP_DIRECTIVES}" ]; then
  # Remplacer le placeholder par les directives réelles
  # Note : sed avec \n nécessite printf sur Alpine/BusyBox
  DIRECTIVES_ESCAPED=$(printf '%s' "${REAL_IP_DIRECTIVES}" | sed 's/[[\.*^$()+?{|]/\\&/g')
  sed -i "s|# KNOWN_PROXIES_PLACEHOLDER|${REAL_IP_DIRECTIVES}|" \
    /etc/nginx/http.d/default.conf
  echo "[entrypoint] ${KNOWN_PROXIES} injecté dans nginx (set_real_ip_from)"
else
  # Aucun proxy externe — supprimer juste le placeholder
  sed -i "s|# KNOWN_PROXIES_PLACEHOLDER||" \
    /etc/nginx/http.d/default.conf
  echo "[entrypoint] Pas de KNOWN_PROXIES — nginx fait confiance uniquement au loopback"
fi

# ── Dossiers et fichiers runtime nginx dans /tmp ─────────────────────────────
mkdir -p /tmp/nginx/run /tmp/nginx/client_body \
         /tmp/nginx/proxy /tmp/nginx/fastcgi \
         /tmp/nginx/uwsgi /tmp/nginx/scgi
touch /tmp/nginx/access.log /tmp/nginx/error.log
chown -R "${PUID}:${PGID}" /tmp/nginx

# ── Dossier de config (volume monté depuis l'hôte) ───────────────────────────
mkdir -p /app/config/media
chown -R "${PUID}:${PGID}" /app/config 2>/dev/null || true

# ── Export des variables pour supervisord et les processus enfants ───────────
export PRAXIS_UID="${PUID}"
export PRAXIS_GID="${PGID}"
export PRAXIS_USER="${USERNAME}"
export LOG_LEVEL="${LOG_LEVEL}"
export LOG_FORMAT="${LOG_FORMAT}"
export MAX_UPLOAD_SIZE="${MAX_UPLOAD_SIZE}"
export MAX_MEDIA_SIZE="${MAX_MEDIA_SIZE}"
export KNOWN_PROXIES="${KNOWN_PROXIES}"

echo "[entrypoint] Démarrage supervisord (socket et nginx tourneront en tant que ${USERNAME})"
exec supervisord -c /etc/supervisord.conf
