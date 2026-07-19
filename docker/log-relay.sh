#!/bin/sh
# Relai logs nginx → stdout
#
# access.log : déjà en JSON (log_format json_access dans nginx-main.conf)
#              → transmis tel quel
#
# error.log  : format texte nginx non configurable en JSON
#              → encapsulé dans un objet JSON minimal
#
# Les deux flux arrivent sur stdout, filtrables par champ "source" :
#   nginx_access : docker logs praxis 2>&1 | grep '"source":"nginx_access"'
#   nginx_error  : docker logs praxis 2>&1 | grep '"source":"nginx_error"'

ACCESS_LOG="/tmp/nginx/access.log"
ERROR_LOG="/tmp/nginx/error.log"

# Attendre que les fichiers existent (nginx démarre après ce script)
wait_for_file() {
  local file="$1"
  local attempts=0
  while [ ! -f "$file" ] && [ $attempts -lt 30 ]; do
    sleep 1
    attempts=$((attempts + 1))
  done
}

wait_for_file "$ACCESS_LOG"
wait_for_file "$ERROR_LOG"

# Relai access.log — déjà JSON, transmission directe
tail -F "$ACCESS_LOG" &
ACCESS_PID=$!

# Relai error.log — encapsulation en JSON minimal
tail -F "$ERROR_LOG" | while IFS= read -r line; do
  # Échapper les caractères spéciaux JSON dans la ligne brute
  escaped=$(printf '%s' "$line" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g')
  printf '{"ts":"%s","level":"warn","source":"nginx_error","msg":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
    "$escaped"
done &
ERROR_PID=$!

# Attendre que l'un des deux se termine (ne devrait pas arriver)
wait $ACCESS_PID $ERROR_PID
