# 🎨 Branding

> 🇫🇷 [Version française](branding.md)

Praxis allows full customisation of the appearance and sounds **without touching the source code**, in two ways:

- **Via the superadmin interface** — *Appearance* tab in the dashboard (recommended)
- **Via `config/branding/theme.json`** — manual file editing

---

## Superadmin interface

Logged in as superadmin, the **Appearance** tab in `/manager/dashboard` allows you to modify:

- **Identity** — application name, logo, favicon
- **Colours** — primary colour, background, 4 answer button colours (A/B/C/D) with a colour picker
- **Visual** — game interface background image
- **Typography** — font family and Google Fonts URL
- **Sounds** — all 9 replaceable audio tracks

The **Save and apply** button saves the changes and applies them instantly to all connected clients (players, managers) without restarting.

---

## `config/branding/theme.json` file

All fields are optional. Anything omitted keeps its default value.

```json
{
  "appName": "My Quiz",
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

## Field Reference

### Identity & visuals

| Field | Description |
|---|---|
| `appName` | Application name and browser tab title |
| `logo` | Path to the logo (SVG, PNG, JPG, WebP) |
| `favicon` | Path to the favicon (SVG, PNG, ICO) |
| `background` | Game interface background image (PNG, JPG, WebP) |

### Colours

| Field | Description |
|---|---|
| `colors.primary` | Primary colour — buttons, accents, progress bar |
| `colors.secondary` | General background colour |
| `answerColors` | Array of 4 colours for answer buttons A, B, C, D |

### Typography

| Field | Description |
|---|---|
| `font.family` | Font family name |
| `font.url` | URL of an external stylesheet (Google Fonts, self-hosted font…) |

### Audio

Each sound is optional. If absent or if the file is not found, the original sound is used.  
Accepted formats: **MP3, OGG, WAV** — maximum size configurable via `MAX_UPLOAD_SIZE`.

| Key | When it plays |
|---|---|
| `answersMusic` | Background music during the answer phase |
| `answersSound` | Sound played when a player submits an answer |
| `resultsSound` | Sound played when individual results are shown |
| `showSound` | Sound played when a question appears |
| `boumpSound` | Sound played each second of the countdown |
| `podiumThree` | Sound for the 3rd place podium reveal |
| `podiumSecond` | Sound for the 2nd place podium reveal |
| `podiumFirst` | Sound for the 1st place podium reveal |
| `podiumSnearRoll` | Drum roll before the 1st place reveal |

---

## Recommended structure

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

Back to the [documentation index](README.en.md).
