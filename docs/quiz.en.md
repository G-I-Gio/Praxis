# 🎮 Quiz

> 🇫🇷 [Version française](quiz.md)

Praxis manages two types of quizzes:

- **Private quizzes** — stored in the SQLite database, created and managed via the manager dashboard
- **Public quizzes** — JSON files in `config/quizz/`, readable by all managers (read-only)

---

## Creating a quiz via the dashboard

This is the recommended method. From `/manager/dashboard`:

1. **Quiz** tab → **Create** button
2. The built-in editor lets you add questions, answers and media
3. Save — the quiz is stored in the SQLite database and belongs to your account

### Visibility

Each quiz has a visibility level:

| Visibility | Access |
|---|---|
| **Private** | You only |
| **Public** | All managers |
| **Shared** | Selected managers |

### Sharing with specific managers

The **Share2** button (share icon) on each quiz opens a sharing management modal:

- **Has access** — list of managers with access, with a button to remove access
- **Add access** — list of available managers with a search field, + button to grant access

The visibility automatically switches to `shared` when at least one manager is added, and reverts to `private` when the list is emptied.

> **Read-only for non-owners**: a manager who receives a shared quiz can view it and use it to launch a game, but cannot edit or delete it. Only the owner sees the edit and delete buttons.

### Import / Export

- **Export** — downloads the quiz as a JSON file (without internal metadata)
- **Import** — imports a JSON file into your private library

---

## Public quizzes (JSON files)

Files placed in `config/quizz/` are loaded at startup as public quizzes, visible to all managers in read-only mode.

Example (`config/quizz/example.json`):

```json
{
  "subject": "Example Quiz",
  "questions": [
    {
      "question": "What is the correct answer?",
      "answers": ["No", "Yes", "No", "No"],
      "solutions": [1],
      "cooldown": 5,
      "time": 15
    },
    {
      "question": "Which of these are primary colors?",
      "answers": ["Red", "Green", "Blue", "Yellow"],
      "solutions": [0, 2, 3],
      "cooldown": 5,
      "time": 20
    },
    {
      "question": "Question with an image?",
      "answers": ["No", "Yes", "No", "No"],
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

## Field Reference

### Quiz fields

| Field | Type | Description |
|---|---|---|
| `subject` | `string` | Quiz title |
| `questions` | `array` | List of questions |

### Question fields

| Field | Type | Default | Description |
|---|---|---|---|
| `question` | `string` | — | Question text |
| `answers` | `string[]` | — | 2 to 4 possible answers |
| `solutions` | `number[]` | — | Indices (0-based) of correct answers |
| `cooldown` | `number` | — | Seconds before results are shown (3–15) |
| `time` | `number` | — | Seconds allowed to answer (5–120) |
| `maxPoints` | `number` | `1000` | Maximum points for a correct answer |
| `penalty` | `number` | none | Points deducted for a wrong answer (total cannot go below 0) |
| `media.type` | `string` | — | `"image"`, `"video"` or `"audio"` |
| `media.url` | `string` | — | URL of the media associated with the question |

> **Note:** an `id` field is automatically added by the application on first load. Do not edit it manually.

---

Back to the [documentation index](README.en.md).
