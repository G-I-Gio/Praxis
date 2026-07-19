# ⚙️ Configuration

> 🇬🇧 [English version](configuration.en.md)

La configuration de Praxis se fait via deux mécanismes complémentaires :

- **Variables d'environnement** — comportement du conteneur (utilisateur, logs, uploads)
- **Volume `config/`** — données applicatives (quiz, branding, base SQLite)

---

## Variables d'environnement

Toutes les variables sont optionnelles et disposent d'une valeur par défaut.  
Elles se définissent dans le fichier `.env` (copié depuis `.env.example`).

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port exposé sur l'hôte |
| `PUID` | `1000` | UID Unix sous lequel le conteneur s'exécute |
| `PGID` | `1000` | GID Unix sous lequel le conteneur s'exécute |
| `MAX_UPLOAD_SIZE` | `10` | Taille max des uploads en Mo (logo, sons…) |
| `LOG_LEVEL` | `info` | Niveau de log : `debug` \| `info` \| `warn` \| `error` |
| `LOG_FORMAT` | `json` | Format des logs : `json` (production) \| `pretty` (dev) |

### `PUID` / `PGID`

Permettent de faire tourner le conteneur sous un utilisateur spécifique, essentiel en environnement Linux pour que les fichiers créés dans `config/` appartiennent au bon utilisateur.

```bash
# Obtenir les valeurs sur Linux
id -u   # → PUID
id -g   # → PGID
```

> **Windows/macOS avec Docker Desktop :** laisser à `1000`, les permissions sont gérées par la VM.

### `MAX_UPLOAD_SIZE`

Contrôle la taille maximale des fichiers uploadés via l'interface d'administration (logo, favicon, sons). nginx est automatiquement configuré à `MAX_UPLOAD_SIZE × 1.25` pour laisser une marge de sécurité.

```env
MAX_UPLOAD_SIZE=20   # Node valide à 20 Mo, nginx accepte jusqu'à 25 Mo
```

### `LOG_LEVEL`

Filtre les logs applicatifs Node.js. Le niveau `audit` (actions sensibles : connexion, création de compte, suppression) est **toujours actif** quel que soit le niveau configuré.

```env
LOG_LEVEL=debug   # Tous les logs, y compris le débogage
LOG_LEVEL=info    # Défaut — informations générales
LOG_LEVEL=warn    # Avertissements et erreurs uniquement
LOG_LEVEL=error   # Erreurs uniquement
```

### `LOG_FORMAT`

```env
LOG_FORMAT=json    # Une ligne JSON par événement — recommandé en production
LOG_FORMAT=pretty  # Sortie colorée lisible — pratique en développement local
```

Voir [Logs](logs.md) pour les commandes de filtrage.

---

## Volume `config/`

Le volume `./config:/app/config` dans `compose.yml` persiste toutes les données applicatives entre les mises à jour du conteneur.

### `config/game.json`

Configuration de l'interface **legacy** (mode Razzia original, accessible sur `/legacy`).

```json
{
  "managerPassword": "PASSWORD"
}
```

> Ce fichier n'est utilisé que par l'interface `/legacy`. La nouvelle interface `/manager` utilise les comptes en base de données.

### `config/branding/theme.json`

Personnalisation visuelle et audio. Gérable directement depuis l'interface superadmin — voir [Branding](branding.md).

### `config/quizz/`

Quiz au format JSON, servis comme **quiz publics** lisibles par tous les managers. Voir [Quiz](quiz.md).

### `config/praxis.db`

Base de données SQLite. Contient les comptes managers, sessions, quiz privés et résultats de parties.

Tables principales :
- `managers` — comptes utilisateurs (identifiant, mot de passe hashé, rôle)
- `manager_sessions` — tokens de session actifs
- `quizzes` — quiz créés via le dashboard (avec visibilité et propriétaire)
- `results` — résultats de parties (avec visibilité et propriétaire)
- `audit_log` — journal des actions sensibles
- `settings` — paramètres globaux

> **Ne pas supprimer** ce fichier sans avoir exporté vos données — la suppression efface tous les comptes et déclenche à nouveau la page `/setup`.

---

## Exemple de fichier `.env`

```env
# Réseau
PORT=3000

# Utilisateur d'exécution (Linux : id -u / id -g)
PUID=1000
PGID=1000

# Uploads
MAX_UPLOAD_SIZE=10

# Logs
LOG_LEVEL=info
LOG_FORMAT=json
```

---

Retour à l'[index de la documentation](README.md).
