# 🔧 Modifications apportées à Razzia

> 🇬🇧 [English version](modifications.en.md)

Ce document décrit les choix techniques effectués dans le fork Praxis, ce qui a été ajouté, modifié ou conservé par rapport à [Razzia](https://github.com/Ralex91/Razzia), et les raisons de ces choix.

---

## Philosophie générale

Praxis part d'un constat simple : Razzia est un excellent outil pour des événements ponctuels, mais son modèle d'authentification par mot de passe global partagé ne convient pas à un usage en entreprise, où plusieurs animateurs doivent pouvoir coexister avec leurs propres bibliothèques de quiz et leurs propres résultats.

**Trois principes ont guidé le développement :**

1. **Compatibilité totale** — tout ce qui fonctionnait dans Razzia fonctionne dans Praxis. L'interface `/legacy` est préservée intégralement.
2. **Pas de monkey-patch** — chaque modification est structurée, traçable et documentée. On traite les causes, pas les symptômes.
3. **Robustesse avant les fonctionnalités** — sécurité, logs, healthcheck, déploiement non-root avant d'ajouter des features.

---

## Ce qui a été conservé sans modification

- Le moteur de jeu complet (Socket.IO, questions, réponses, scoring, podium)
- Le format des fichiers quiz JSON (`config/quizz/*.json`)
- Les résultats de parties JSON (`config/results/*.json`)
- Le système de branding `config/branding/theme.json` (étendu, non cassé)
- L'interface joueur (`/party/$gameId`)
- Le protocole WebSocket joueur (inchangé — les clients existants fonctionnent)
- Toutes les dépendances npm

---

## Modifications du code Razzia original

Deux fichiers du code original ont été modifiés de façon rétrocompatible :

### `features/game/utils/constants.ts`

La constante statique `SFX` (chemins audio hardcodés) a été remplacée par une fonction `getSFX()` qui lit dynamiquement les chemins depuis le branding. Si aucun son personnalisé n'est configuré, les sons originaux de Razzia sont utilisés en fallback — le comportement est identique à l'original.

### Composants de jeu (Room, Podium, Leaderboard, Answers, Question, Responses, Result, Start, Wait)

Intégration du système d'avatars joueurs. Les composants fonctionnent de manière identique sans avatar — l'avatar est optionnel et se dégrade gracieusement en initiales colorées.

---

## Ajouts backend

### Authentification multi-utilisateurs

**Pourquoi :** un mot de passe global partagé ne permet ni la traçabilité des actions, ni la gestion de bibliothèques personnelles, ni la révocation d'accès individuelle.

**Comment :** nouveau service `database.ts` avec SQLite (better-sqlite3). Tables : `managers`, `manager_sessions`, `setup_tokens`, `audit_log`, `settings`, `quizzes`, `results`. Mots de passe hashés avec bcrypt (12 rounds). Sessions via cookie HttpOnly + SameSite=Strict. Rate limiting en mémoire (5 tentatives → 15 min de blocage par IP).

Les managers peuvent changer leur propre mot de passe via `PUT /auth/password` (vérification bcrypt de l'ancien mot de passe obligatoire). L'invalidation des autres sessions actives est disponible via `POST /auth/sessions/invalidate`.

### API REST

**Pourquoi :** Socket.IO est conçu pour les événements temps réel, pas pour le CRUD de ressources. Utiliser Socket.IO pour gérer les quiz et les résultats mélangeait deux responsabilités dans un seul canal.

**Comment :** serveur HTTP natif Node.js sur le même port que Socket.IO (3001), proxifié par nginx. Routeur léger sans framework. Middlewares `requireAuth` et `requireSuperadmin` basés sur le cookie de session.

Routes complètes :

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/health` | Public | Healthcheck Docker |
| POST | `/auth/setup` | Public (1 fois) | Création super-admin initial |
| GET | `/auth/status` | Public | État du setup et readiness |
| POST | `/auth/login` | Public | Connexion |
| POST | `/auth/logout` | Authentifié | Déconnexion |
| PUT | `/auth/password` | Authentifié | Changer son propre mot de passe |
| POST | `/auth/sessions/invalidate` | Authentifié | Invalider les autres sessions |
| GET | `/auth/me` | Authentifié | Identité courante |
| GET | `/api/quizzes` | Authentifié | Liste des quiz accessibles |
| POST | `/api/quizzes` | Authentifié | Créer un quiz |
| GET | `/api/quizzes/:id` | Lecture | Détail d'un quiz |
| PUT | `/api/quizzes/:id` | Propriétaire | Modifier un quiz |
| DELETE | `/api/quizzes/:id` | Propriétaire | Supprimer un quiz |
| GET | `/api/quizzes/:id/export` | Lecture | Export JSON sans métadonnées |
| POST | `/api/quizzes/import` | Authentifié | Import d'un JSON |
| PATCH | `/api/quizzes/:id/visibility` | Propriétaire | Changer visibilité/partage |
| GET | `/api/results` | Authentifié | Liste des résultats accessibles |
| GET | `/api/results/:id` | Lecture | Détail d'un résultat |
| DELETE | `/api/results/:id` | Propriétaire | Supprimer un résultat |
| PATCH | `/api/results/:id/visibility` | Propriétaire | Changer visibilité/partage |
| GET | `/api/managers` | Authentifié | Liste (complète pour superadmin, id+username pour manager) |
| POST | `/api/managers` | Superadmin | Créer un compte |
| PUT | `/api/managers/:id` | Superadmin | Modifier un compte |
| DELETE | `/api/managers/:id` | Superadmin | Supprimer un compte |
| GET | `/api/branding` | Authentifié | Lire le theme.json |
| PATCH | `/api/branding` | Superadmin | Mettre à jour le theme.json |
| POST | `/api/branding/upload/:field` | Superadmin | Uploader un fichier |
| DELETE | `/api/branding/field/:field` | Superadmin | Remettre un champ à défaut |
| POST | `/api/branding/apply` | Superadmin | Diffuser BRANDING.RELOAD |

### Stockage des quiz et résultats en SQLite

**Pourquoi :** les fichiers JSON dans `config/quizz/` sont des ressources partagées sans notion de propriétaire. Impossible de distinguer "mes quiz" de "les quiz de l'équipe".

**Comment :** tables `quizzes` et `results` avec `owner_id`, `visibility` (private/public/shared), `shared_with` (liste JSON d'UUIDs managers). Les fichiers JSON existants continuent de fonctionner comme quiz publics en lecture seule — aucune migration nécessaire.

Le partage de quiz est en **lecture seule pour les non-propriétaires** : les boutons de modification et de suppression ne s'affichent que pour le propriétaire.

### Pont Socket.IO ↔ HTTP (`AUTH_SESSION`)

**Pourquoi :** lancer une partie depuis le nouveau dashboard nécessite une authentification Socket.IO, mais le dashboard utilise des sessions HTTP (cookie). Deux systèmes d'auth, un seul canal WebSocket.

**Comment :** nouvel événement `manager:authSession` qui reçoit le token de session HTTP via `GET /auth/token`, le valide en base, et authentifie le socket sans passer par le mot de passe global. `socket.data.managerId` est alimenté pour tracer le propriétaire des résultats.

### Service Health (`health.ts`)

Source de vérité unique sur l'état de démarrage. 4 checkpoints séquentiels : `config`, `database`, `http`, `socket`. Chacun passe de `pending` à `ok` ou `error` au fil de l'initialisation dans `index.ts`. Graceful shutdown sur SIGTERM : `setShuttingDown()` immédiatement (le reverse proxy arrête d'envoyer du trafic), puis fermeture propre avec timeout 10 secondes.

### Logger structuré (`logger.ts`)

Remplace tous les `console.log/warn/error` du backend. Format JSON sur stdout avec champ `source: "app"`. Niveau `audit` toujours actif (actions sensibles). Supporte `LOG_FORMAT=pretty` pour le développement local.

---

## Ajouts frontend

### Dashboard `/manager/dashboard`

Interface complète remplaçant la page de connexion Socket.IO originale. Authentification via cookie HTTP. Onglets selon le rôle :

| Onglet | Rôle | Fonctionnalités |
|---|---|---|
| Jouer | Tous | Sélection de quiz, lancement de partie |
| Quiz | Tous | CRUD, import/export, partage granulaire, recherche |
| Résultats | Tous | Consultation, visibilité, partage, recherche (nom + date) |
| Comptes | Superadmin | Création, modification, suppression, recherche |
| Apparence | Superadmin | Branding complet avec application temps réel |

Le header expose un bouton de changement de mot de passe accessible à tous les rôles.

### Route Legacy `/legacy`

L'interface originale de Razzia est déplacée vers `/legacy` et fonctionne de manière identique. La route `/manager` pointe désormais vers le nouveau système d'authentification.

### Page de démarrage (`startup.tsx`)

Affichée pendant l'initialisation du conteneur. Poll `/health` toutes les secondes et affiche les 4 checkpoints en temps réel avec icônes ✓/⏳/✗. Disparaît automatiquement quand l'application est prête.

### Système d'avatars

16 avatars PNG sélectionnables dans la salle d'attente. Fallback sur initiales colorées si aucun avatar n'est sélectionné. Nouvel événement Socket.IO `player:updateAvatar`.

---

## Universalisation Docker

### Exécution non-root

**Pourquoi :** en entreprise, les équipes sécurité/infra refusent souvent les conteneurs tournant en root. Certains environnements (Kubernetes, OpenShift) l'interdisent explicitement.

**Comment :** variables `PUID`/`PGID` dans `compose.yml`. Script `entrypoint.sh` qui crée l'utilisateur dynamiquement (en réutilisant un uid/gid existant si déjà pris) et ajuste les permissions du volume avant de lancer supervisord. nginx et Node tournent sous l'utilisateur cible via la directive `user=` de supervisord.

### Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port exposé sur l'hôte |
| `PUID` | `1000` | UID Unix d'exécution |
| `PGID` | `1000` | GID Unix d'exécution |
| `MAX_UPLOAD_SIZE` | `10` | Taille max uploads en Mo |
| `LOG_LEVEL` | `info` | Niveau de log |
| `LOG_FORMAT` | `json` | Format des logs |

La limite nginx est calculée automatiquement à `MAX_UPLOAD_SIZE × 1.25` par `entrypoint.sh` via `sed` sur `/etc/nginx/http.d/default.conf`.

### Logs structurés JSON

**Pourquoi :** les `console.log` bruts ne sont pas filtrables, pas agrégables, et mélangent des sources hétérogènes.

**Comment :** `logger.ts` côté Node. nginx configuré avec `log_format json_access`. Script `log-relay.sh` qui relaie les logs nginx (access déjà JSON, error encapsulé en JSON minimal) vers stdout. Trois sources filtrables : `app`, `nginx_access`, `nginx_error`.

### Healthcheck et graceful shutdown

`HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3` sur `GET /health`. `setShuttingDown()` appelé dès réception de SIGTERM pour que le reverse proxy cesse d'envoyer du trafic immédiatement.

---

## Nouveaux fichiers créés

### Backend
| Fichier | Rôle |
|---|---|
| `packages/socket/src/services/database.ts` | SQLite : init, migrations, CRUD |
| `packages/socket/src/services/http.ts` | Serveur HTTP natif, toutes les routes REST |
| `packages/socket/src/services/health.ts` | Service de santé et état de démarrage |
| `packages/socket/src/services/logger.ts` | Logger JSON structuré |

### Docker
| Fichier | Rôle |
|---|---|
| `docker/entrypoint.sh` | Création utilisateur PUID/PGID, config nginx dynamique |
| `docker/nginx-main.conf` | Config principale nginx (pid, logs, chemins /tmp) |
| `docker/log-relay.sh` | Relai logs nginx → stdout JSON |

### Frontend — Features Dashboard
| Fichier | Rôle |
|---|---|
| `features/dashboard/useDashboardAuth.ts` | Hook auth HTTP |
| `features/dashboard/useQuizApi.ts` | Hook CRUD quiz REST |
| `features/dashboard/useResultsApi.ts` | Hook CRUD résultats REST |
| `features/dashboard/useManagersApi.ts` | Hook CRUD managers REST |
| `features/dashboard/useBrandingApi.ts` | Hook branding REST |
| `features/dashboard/useAllManagers.ts` | Hook liste managers (partage) |
| `features/dashboard/DashboardQuizList.tsx` | Liste quiz avec partage et recherche |
| `features/dashboard/DashboardResults.tsx` | Liste résultats avec partage et recherche |
| `features/dashboard/DashboardManagers.tsx` | Gestion comptes avec recherche |
| `features/dashboard/DashboardAppearance.tsx` | Personnalisation branding |
| `features/dashboard/ShareResultModal.tsx` | Modale partage résultats avec recherche |
| `features/dashboard/ShareQuizModal.tsx` | Modale partage quiz avec recherche |
| `features/dashboard/ChangePasswordModal.tsx` | Modale changement mot de passe |
| `features/dashboard/PasswordSuccessModal.tsx` | Modale succès + gestion sessions |

---

## Fichiers modifiés

| Fichier | Nature de la modification |
|---|---|
| `packages/common/src/constants.ts` | Ajout events : `PLAYER.UPDATE_AVATAR`, `MANAGER.AUTH_SESSION`, `BRANDING.RELOAD` |
| `packages/common/src/types/game/socket.ts` | Ajout types pour les nouveaux events |
| `packages/common/src/types/game/index.ts` | Ajout champ `avatar?: string` sur Player |
| `packages/socket/src/index.ts` | Checkpoints health, graceful shutdown, `setSocketIo()` |
| `packages/socket/src/handlers/game.ts` | `findQuizz()` cherche dans SQLite puis fichiers JSON |
| `packages/socket/src/handlers/manager.ts` | Handler `AUTH_SESSION`, stockage `managerId` dans `socket.data` |
| `packages/socket/src/services/game/index.ts` | Choix `saveResultDb` vs `saveResult` selon `managerId` |
| `packages/web/src/pages/__root.tsx` | Page de démarrage, écoute `BRANDING.RELOAD` |
| `packages/web/src/pages/manager/dashboard.tsx` | Dashboard complet (tous onglets, modales) |
| `packages/web/src/pages/manager/quizz/*.tsx` | Mode `apiMode` (sauvegarde REST) |
| `packages/web/src/pages/party/manager/$gameId.tsx` | Redirection fin de partie → `/manager/dashboard` |
| `packages/web/src/features/quizz/components/QuizzEditorHeader.tsx` | Mode REST en plus du mode Socket.IO |
| `packages/web/src/pages/(auth)/manager/index.tsx` | Login username/password au lieu du mot de passe global |
| `packages/web/src/features/game/utils/constants.ts` | `SFX` → `getSFX()` dynamique |
| `docker/nginx.conf` | Proxy `/auth/`, `/api/` (20 Mo max), `/branding/`, `/health` |
| `packages/web/src/locales/*/manager.json` | Clés i18n : `tabs.*`, résultats, comptes |
| `packages/web/src/branding.ts` | Schéma audio étendu (9 champs), `appName` fallback |

---

## Ce qui n'a pas été fait (et pourquoi)

**Pas de JWT** — les sessions SQLite (opaque tokens) sont plus simples, révocables à tout moment, et ne nécessitent pas de secret à gérer.

**Pas de permissions granulaires sur les quiz partagés** — le partage est en lecture seule pour les non-propriétaires. Si un propriétaire veut qu'un collègue modifie son quiz, il peut le dupliquer dans sa bibliothèque via l'import/export. Ce choix évite une complexité de gestion des droits disproportionnée par rapport à l'usage réel.

**Pas de multi-instance** — l'état du jeu est en mémoire (choix de Razzia conservé). Load-balancer sur plusieurs instances casserait le jeu.

**Pas de port interne configurable** — le port 3000 interne au conteneur n'a aucune raison d'être changé. Seul le port externe (hôte) est configurable.

**Pas de Docker Secrets** — les variables d'environnement avec un `.env` non versionné sont suffisantes pour le niveau de sécurité cible et bien plus simples à mettre en œuvre.

---

Retour à l'[index de la documentation](README.md).
