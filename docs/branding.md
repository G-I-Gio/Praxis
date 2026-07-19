# 🎨 Branding

> 🇬🇧 [English version](branding.en.md)

Praxis permet de personnaliser entièrement l'apparence et les sons **sans toucher au code source**, de deux manières :

- **Via l'interface superadmin** — onglet *Apparence* du tableau de bord (recommandé)
- **Via `config/branding/theme.json`** — édition manuelle du fichier

---

## Interface superadmin

Connecté en tant que superadmin, l'onglet **Apparence** dans `/manager/dashboard` permet de modifier :

- **Identité** — nom de l'application, logo, favicon
- **Couleurs** — couleur principale, fond, 4 couleurs de réponses (A/B/C/D) avec color picker
- **Visuel** — image de fond de l'interface de jeu
- **Typographie** — famille de police et URL Google Fonts
- **Sons** — les 9 pistes audio remplaçables

Le bouton **Sauvegarder et appliquer** enregistre les modifications et les applique instantanément sur tous les clients connectés (joueurs, managers) sans redémarrage.

---

## Fichier `config/branding/theme.json`

Tous les champs sont optionnels. Ce qui est omis conserve sa valeur par défaut.

```json
{
  "appName": "Mon Quiz",
  "colors": {
    "primary": "#ff9900",
    "secondary": "#1a140b"
  },
  "answerColors": ["#e69f00", "#56b4e9", "#3dbfa0", "#cc79a7"],
  "font": {
    "family": "Rubik Variable",
    "url": "https://fonts.googleapis.com/css2?family=Rubik:wght@300..900&display=swap"
  },
  "logo": "/branding/logo.png",
  "favicon": "/branding/favicon.ico",
  "background": "/branding/background.png",
  "audio": {
    "answersMusic":    "/branding/answersMusic.mp3",
    "answersSound":    "/branding/answersSound.mp3",
    "resultsSound":    "/branding/resultsSound.mp3",
    "showSound":       "/branding/showSound.mp3",
    "boumpSound":      "/branding/boumpSound.mp3",
    "podiumThree":     "/branding/podiumThree.mp3",
    "podiumSecond":    "/branding/podiumSecond.mp3",
    "podiumFirst":     "/branding/podiumFirst.mp3",
    "podiumSnearRoll": "/branding/podiumSnearRoll.mp3"
  }
}
```

---

## Référence des champs

### Identité & visuel

| Champ | Description |
|---|---|
| `appName` | Nom de l'application et titre de l'onglet navigateur |
| `logo` | Chemin vers le logo (SVG, PNG, JPG, WebP) |
| `favicon` | Chemin vers le favicon (SVG, PNG, ICO) |
| `background` | Image de fond de l'interface de jeu (PNG, JPG, WebP) |

### Couleurs

| Champ | Description |
|---|---|
| `colors.primary` | Couleur principale — boutons, accents, barre de progression |
| `colors.secondary` | Couleur de fond général |
| `answerColors` | Tableau de 4 couleurs pour les boutons de réponse A, B, C, D |

### Typographie

| Champ | Description |
|---|---|
| `font.family` | Nom de la famille de police |
| `font.url` | URL d'une feuille de style externe (Google Fonts, police auto-hébergée…) |

### Audio

Chaque son est optionnel. Si absent ou si le fichier est introuvable, le son d'origine est utilisé.  
Formats acceptés : **MP3, OGG, WAV** — taille max configurable via `MAX_UPLOAD_SIZE`.

| Clé | Moment de déclenchement |
|---|---|
| `answersMusic` | Musique de fond pendant la phase de réponse |
| `answersSound` | Son joué à chaque réponse soumise par un joueur |
| `resultsSound` | Son joué à l'affichage du résultat individuel |
| `showSound` | Son joué à l'apparition de la question |
| `boumpSound` | Son joué à chaque seconde du compte à rebours |
| `podiumThree` | Son pour l'apparition de la 3e place au podium |
| `podiumSecond` | Son pour l'apparition de la 2e place au podium |
| `podiumFirst` | Son pour l'apparition de la 1re place au podium |
| `podiumSnearRoll` | Roulement de tambour avant la révélation de la 1re place |

---

## Structure recommandée

```
config/
└── branding/
    ├── theme.json
    ├── logo.png
    ├── favicon.ico
    ├── background.png
    ├── answersMusic.mp3
    ├── podiumFirst.mp3
    └── ...
```

---

Retour à l'[index de la documentation](README.md).
