# 📋 Changelog

> 🇬🇧 [English version](changelog.en.md)

Historique des versions de Praxis. Les dates correspondent aux releases GitHub.

---

## v0.0.3.2 — Médias et sécurité (22 juillet 2026)

### Nouvelles fonctionnalités

- **Bibliothèque de médias** — upload d’images, vidéos et sons (jpg/png/gif/webp/mp4/webm/mp3/ogg/wav), déduplication automatique par SHA-256, visibilité privé/partagé/public, onglet dédié dans le dashboard
- **Médias dans les questions** — intégration de médias (bibliothèque ou URL externe) dans l’éditeur de quiz, affichage plein écran pendant la partie
- **Export ZIP quiz+médias** — `GET /api/quizzes/:id/export?format=zip` exporte le quiz et tous ses médias référencés dans une archive prête au transfert
- **Import ZIP** — `POST /api/quizzes/import` accepte un ZIP quiz+médias et reconstruit automatiquement les références
- **Accès médias en partie** — `GET /media/:gameId/:hash.:ext` sert les médias aux joueurs uniquement pendant une partie active (double vérification : partie active + hash autorisé)

### Correctifs

- **Éditeur de quiz — barre latérale** — les miniatures d’images dans la liste des questions n’affichaient pas les médias issus de la bibliothèque (URL `media:<uuid>` non résolue en `/api/media/<uuid>/file`) ; corrigé
- **Sécurité — cookie de session** — ajout du flag `Secure` (transmission HTTPS uniquement) ; désactivable via `COOKIE_SECURE=false` pour le développement local HTTP
- **Sécurité — CORS** — suppression des headers `Access-Control-Allow-Origin: *` et `Access-Control-Allow-Credentials: true` contradictoires (combinaison rejetée par les navigateurs, inutile en same-origin)
- **Sécurité — import ZIP** — ajout d’une limite mémoire sur le buffer ZIP avant décompression pour prévenir les ZIP bombs (`MAX_MEDIA_SIZE × 5`, soit 100 Mo par défaut)

### Variables d’environnement

- `MAX_MEDIA_SIZE` — taille max par fichier média en Mo (défaut : `20`, indépendant de `MAX_UPLOAD_SIZE`)
- `COOKIE_SECURE` — flag Secure sur le cookie de session (défaut : `true`)
- `KNOWN_PROXIES` — IPs/CIDRs des reverse-proxies de confiance pour la résolution de l’IP réelle

### Backend

- `GET /api/media` — liste des médias accessibles
- `POST /api/media/upload` — upload multipart avec validation magic bytes
- `GET /api/media/:id` — métadonnées d’un média
- `GET /api/media/:id/file` — stream inline avec support Range (lecture vidéo/audio)
- `GET /api/media/:id/download` — téléchargement forcé
- `PATCH /api/media/:id/visibility` — modifier la visibilité
- `DELETE /api/media/:id` — suppression (bloquée si le média est référencé par un quiz)
- `GET /media/:gameId/:hash.:ext` — accès public médias en partie (sans authentification)

---

## v0.0.3.1 — Consolidation (19 juillet 2026)

### Correctifs
- **Partage de quiz** — correction de l'erreur de validation lors du changement de visibilité (`PUT /api/quizzes/:id` exigeait `subject` et `questions` ; remplacé par `PATCH /api/quizzes/:id/visibility` dédié, symétrique avec les résultats)
- **Modale de partage de résultats** — la liste des managers disponibles était chargée une seule fois au montage ; elle se rafraîchit maintenant à chaque ouverture de la modale
- **Recherche dans la modale de partage** — champ de recherche manquant dans `ShareResultModal`, ajouté avec scroll indépendant

### Nouvelles fonctionnalités
- **Changement de mot de passe** — bouton dédié (icône clé) dans le header du dashboard, accessible à tous les rôles. Modale avec affichage/masquage individuel des caractères et double confirmation. Après changement réussi : proposition de déconnecter toutes les autres sessions actives
- **Partage de quiz entre managers** — bouton de partage (icône Share2) sur chaque quiz, visible uniquement par le propriétaire. Modale identique au partage de résultats avec recherche intégrée. Les managers non-propriétaires ont accès en lecture seule (bouton modifier masqué, suppression impossible)
- **Recherche** — champ de recherche ajouté dans les onglets Quiz (par nom), Résultats (par nom ou date JJ/MM/AAAA) et Comptes (par nom d'utilisateur). Largeur uniforme, filtrage immédiat

### Backend
- `PUT /auth/password` — changer son propre mot de passe (vérification bcrypt de l'ancien)
- `POST /auth/sessions/invalidate` — invalider toutes les sessions actives sauf la courante
- `PATCH /api/quizzes/:id/visibility` — mettre à jour uniquement la visibilité d'un quiz

---

## v0.0.3 — Première release publique (19 juillet 2026)

Release initiale du fork Praxis. Voir [Modifications apportées à Razzia](modifications.md) pour le détail complet de ce qui distingue Praxis de Razzia.

### Authentification & comptes
- Système de comptes individuels avec rôles (manager / superadmin)
- Sessions SQLite avec cookie HttpOnly + SameSite=Strict
- Rate limiting : 5 tentatives échouées → blocage IP 15 minutes
- Audit log de toutes les actions sensibles
- Page de création du super-admin au premier démarrage (`/setup`)

### API REST
- Routes `/auth/*` — authentification, sessions
- Routes `/api/quizzes` — CRUD quiz avec visibilité (private / public / shared)
- Routes `/api/results` — résultats de parties avec visibilité et partage
- Routes `/api/managers` — gestion des comptes (superadmin)
- Routes `/api/branding` — personnalisation et upload de fichiers
- Route `/health` — healthcheck Docker

### Dashboard manager (`/manager/dashboard`)
- Onglet **Jouer** — sélection de quiz et lancement de partie
- Onglet **Quiz** — CRUD, import/export JSON, partage
- Onglet **Résultats** — consultation, visibilité, partage granulaire par manager
- Onglet **Comptes** *(superadmin)* — création, modification, suppression de comptes
- Onglet **Apparence** *(superadmin)* — branding complet avec application temps réel

### Infrastructure Docker
- Exécution non-root via `PUID`/`PGID` configurables
- Variables d'environnement : `MAX_UPLOAD_SIZE`, `LOG_LEVEL`, `LOG_FORMAT`
- Logs structurés JSON avec champ `source` (`app`, `nginx_access`, `nginx_error`)
- Healthcheck Docker sur `/health` avec page de démarrage frontend
- Graceful shutdown sur SIGTERM (timeout 10 secondes)

### Compatibilité
- Interface Razzia originale préservée sur `/legacy`
- Format des fichiers quiz JSON inchangé
- Protocole WebSocket joueur inchangé

---

## v0.0.2 — Base du fork (historique)

Version de départ du fork. Contient les premiers travaux d'adaptation à partir de Razzia :

- Renommage Praxis, branding custom
- Système d'avatars joueurs (16 PNG, sélection en salle d'attente)
- Salle d'attente enrichie
- Audio custom configurable via `theme.json`
- Ébauche du système d'authentification manager

---

Retour à l'[index de la documentation](README.md).
