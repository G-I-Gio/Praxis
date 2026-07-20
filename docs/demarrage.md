# 🚀 Démarrage rapide

> 🇬🇧 [English version](getting-started.md)

## Prérequis

- Docker et Docker Compose

C'est tout. Praxis est distribué sous forme d'image Docker auto-suffisante.

---

## Installation

### 1. Récupérer les fichiers

Cloner le dépôt ou copier les fichiers `compose.yml` et `.env.example` sur votre serveur.

### 2. Créer le fichier de configuration

```bash
cp .env.example .env
```

Puis éditer `.env` selon votre environnement (voir [Configuration](configuration.md)).

**Minimum requis pour démarrer :**

```env
PUID=1000
PGID=1000
```

> **Linux :** obtenez vos valeurs avec `id -u` et `id -g`.  
> **Windows/macOS avec Docker Desktop :** laissez `1000`.

### 3. Builder l'image

Praxis est un fork avec du code modifié — il faut construire l'image localement :

```bash
docker build -t praxis:latest .
```

Le premier build prend 5 à 15 minutes. Les suivants sont plus rapides grâce au cache Docker.

### 4. Démarrer le conteneur

```bash
docker compose up -d
```

L'application est accessible sur **http://localhost:3000** (ou le port défini dans `.env`).

---

## Premier lancement — Création du super-admin

Au premier démarrage, Praxis affiche une **page de configuration initiale** à l'adresse :

```
http://localhost:3000/setup
```

Cette page est **automatiquement désactivée** dès qu'un super-admin est créé. Elle ne peut pas être ré-affichée sans supprimer la base de données.

Renseignez :
- Un identifiant (3 à 32 caractères)
- Un mot de passe (8 caractères minimum)

Le compte créé est un **superadmin** — il a accès à toutes les fonctionnalités, y compris la gestion des autres comptes.

---

## Connexion

Accédez au tableau de bord manager sur :

```
http://localhost:3000/manager
```

Connectez-vous avec les identifiants créés à l'étape précédente.

---

## Structure du volume `config/`

Praxis crée automatiquement la structure suivante dans le dossier monté :

```
config/
├── praxis.db          ← Base de données SQLite (comptes, quiz, résultats)
├── game.json          ← Configuration legacy (mot de passe manager legacy)
├── admin.json         ← Configuration admin legacy
├── branding/
│   └── theme.json     ← Personnalisation visuelle et audio (optionnel)
├── quizz/
│   └── example.json   ← Quiz d'exemple (quiz public, lecture seule)
└── results/           ← Résultats de parties legacy (créé au premier quiz terminé)
```

> **Sauvegarde :** il suffit de copier le dossier `config/` pour sauvegarder l'intégralité de vos données.

---

## Mise à jour

```bash
# Rebuilder l'image avec le nouveau code
docker build -t praxis:latest .

# Redémarrer le conteneur
docker compose up -d
```

Vos données dans `config/` sont préservées entre les mises à jour.

---

## Déploiement derrière un reverse proxy

Voir [Reverse Proxy](reverse-proxy.md) pour les exemples Traefik, Caddy et Nginx.

---

Retour à l'[index de la documentation](README.md).
