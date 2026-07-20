# 📋 Logs

> 🇬🇧 [English version](logs.en.md)

Praxis produit des logs structurés en JSON sur stdout, filtrables par source et par niveau.

---

## Sources de logs

Chaque ligne de log contient un champ `source` identifiant son origine :

| Source | Description |
|---|---|
| `app` | Logs applicatifs Node.js (démarrage, authentification, jeu, erreurs) |
| `nginx_access` | Requêtes HTTP reçues par nginx |
| `nginx_error` | Erreurs et avertissements nginx |

Les logs supervisord (démarrage des processus) sont émis en texte brut et apparaissent uniquement au démarrage du conteneur.

---

## Format JSON

### Logs applicatifs (`source: "app"`)

```json
{
  "ts": "2026-07-18T20:15:20.082Z",
  "level": "info",
  "source": "app",
  "msg": "[startup] Serveur HTTP prêt",
  "ctx": { "port": 3001 }
}
```

### Requêtes HTTP (`source: "nginx_access"`)

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

### Erreurs nginx (`source: "nginx_error"`)

```json
{
  "ts": "2026-07-18T20:15:20.000Z",
  "level": "warn",
  "source": "nginx_error",
  "msg": "upstream timed out ..."
}
```

---

## Niveaux de log

Contrôlés par la variable `LOG_LEVEL` (voir [Configuration](configuration.md)).

| Niveau | Description |
|---|---|
| `debug` | Informations de débogage détaillées |
| `info` | Informations générales de fonctionnement |
| `warn` | Avertissements non bloquants |
| `error` | Erreurs nécessitant une attention |
| `audit` | Actions sensibles — **toujours actif** quel que soit `LOG_LEVEL` |

Le niveau `audit` trace : connexions réussies et échouées, création/modification/suppression de comptes, uploads de branding, rechargement du thème.

---

## Commandes de filtrage

### Linux / macOS

```bash
# Tout
docker logs praxis

# Application uniquement
docker logs praxis 2>&1 | grep '"source":"app"'

# Requêtes HTTP uniquement
docker logs praxis 2>&1 | grep '"source":"nginx_access"'

# Erreurs nginx uniquement
docker logs praxis 2>&1 | grep '"source":"nginx_error"'

# Actions d'audit uniquement
docker logs praxis 2>&1 | grep '"level":"audit"'

# Suivi en temps réel — requêtes uniquement
docker logs praxis -f 2>&1 | grep '"source":"nginx_access"'

# Avec jq pour une lecture formatée
docker logs praxis 2>&1 | grep '"source":"app"' | jq .
```

### PowerShell (Windows)

```powershell
# Tout
docker logs praxis-stack-praxis-1 2>&1

# Application uniquement
docker logs praxis-stack-praxis-1 2>&1 | Select-String '"source":"app"'

# Requêtes HTTP uniquement
docker logs praxis-stack-praxis-1 2>&1 | Select-String '"source":"nginx_access"'

# Erreurs nginx uniquement
docker logs praxis-stack-praxis-1 2>&1 | Select-String '"source":"nginx_error"'

# Suivi en temps réel
docker logs praxis-stack-praxis-1 -f 2>&1 | Select-String '"source":"app"'
```

---

## Format Pretty (développement)

En définissant `LOG_FORMAT=pretty`, les logs applicatifs sont affichés dans un format coloré lisible :

```
[2026-07-18 20:15:20.082] INFO  [startup] Serveur HTTP prêt  port=3001
[2026-07-18 20:15:20.083] INFO  [startup] Handlers WebSocket enregistrés — application prête
```

> Ce format n'est pas parseable par les agrégateurs de logs. Utiliser `json` en production.

---

## Intégration avec un agrégateur

Les logs JSON sont compatibles nativement avec Loki, Datadog, ELK et tout agrégateur supportant le format JSON sur stdin. Il suffit de pointer l'agrégateur sur `docker logs` ou de configurer un driver de log Docker.

---

Retour à l'[index de la documentation](README.md).
