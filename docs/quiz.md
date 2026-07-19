# 🎮 Quiz

> 🇬🇧 [English version](quiz.en.md)

Praxis gère deux types de quiz :

- **Quiz privés** — stockés en base SQLite, créés et gérés via le tableau de bord manager
- **Quiz publics** — fichiers JSON dans `config/quizz/`, lisibles par tous les managers (lecture seule)

---

## Créer un quiz via le tableau de bord

C'est la méthode recommandée. Depuis `/manager/dashboard` :

1. Onglet **Quiz** → bouton **Créer**
2. L'éditeur intégré permet d'ajouter des questions, réponses et médias
3. Sauvegarder — le quiz est enregistré en base SQLite et appartient à votre compte

### Visibilité

Chaque quiz dispose d'un niveau de visibilité :

| Visibilité | Accès |
|---|---|
| **Privé** | Vous uniquement |
| **Public** | Tous les managers |
| **Partagé** | Managers sélectionnés |

### Import / Export

- **Export** — télécharge le quiz au format JSON (sans métadonnées internes)
- **Import** — importe un fichier JSON dans votre bibliothèque privée

---

## Quiz publics (fichiers JSON)

Les fichiers placés dans `config/quizz/` sont chargés au démarrage comme quiz publics, visibles par tous les managers en lecture seule.

Exemple (`config/quizz/exemple.json`) :

```json
{
  "subject": "Quiz Exemple",
  "questions": [
    {
      "question": "Quelle est la bonne réponse ?",
      "answers": ["Non", "Oui", "Non", "Non"],
      "solutions": [1],
      "cooldown": 5,
      "time": 15
    },
    {
      "question": "Quelles sont les couleurs primaires ?",
      "answers": ["Rouge", "Vert", "Bleu", "Jaune"],
      "solutions": [0, 2, 3],
      "cooldown": 5,
      "time": 20
    },
    {
      "question": "Question avec image ?",
      "answers": ["Non", "Oui", "Non", "Non"],
      "media": {
        "type": "image",
        "url": "https://placehold.co/600x400.png"
      },
      "solutions": [1],
      "cooldown": 5,
      "time": 20
    }
  ]
}
```

---

## Référence des champs

### Champs du quiz

| Champ | Type | Description |
|---|---|---|
| `subject` | `string` | Titre du quiz |
| `questions` | `array` | Liste des questions |

### Champs d'une question

| Champ | Type | Défaut | Description |
|---|---|---|---|
| `question` | `string` | — | Texte de la question |
| `answers` | `string[]` | — | 2 à 4 réponses possibles |
| `solutions` | `number[]` | — | Indices (base 0) des bonnes réponses |
| `cooldown` | `number` | — | Secondes avant l'affichage des résultats (3–15) |
| `time` | `number` | — | Secondes accordées pour répondre (5–120) |
| `maxPoints` | `number` | `1000` | Points maximum pour une bonne réponse |
| `penalty` | `number` | aucun | Points retirés pour une mauvaise réponse (le total ne peut pas descendre en dessous de 0) |
| `media.type` | `string` | — | `"image"`, `"video"` ou `"audio"` |
| `media.url` | `string` | — | URL du média associé à la question |

> **Note :** un champ `id` est automatiquement ajouté par l'application au premier chargement. Ne pas le modifier manuellement.

---

Retour à l'[index de la documentation](README.md).
