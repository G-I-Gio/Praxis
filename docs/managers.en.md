# 👥 Manager Accounts

> 🇫🇷 [Version française](managers.md)

Praxis introduces an individual account system with two distinct roles, replacing Razzia's single shared password.

---

## Roles

### Manager

- Access to the `/manager/dashboard` dashboard
- Create, edit and delete **their own quizzes**
- View **public quizzes** and **quizzes shared** with them
- View and share **their own results**
- Launch games

### Superadmin

Has all manager capabilities, plus:

- **Account management** — create, edit, delete manager accounts
- **Quizzes** — read/write access to all quizzes from all managers
- **Results** — read access to all results
- **Appearance** — branding customisation (colours, sounds, logo…)

---

## Creating the first account (initial setup)

On first startup, go to `/setup` to create the initial superadmin account. This page is only accessible once.

See [Getting Started](getting-started.md) for details.

---

## Managing accounts (superadmin)

From `/manager/dashboard`, **Accounts** tab:

### Create an account

1. Click **Create an account**
2. Enter the username and password
3. Choose the role: **Manager** or **Super Admin**
4. Confirm

### Edit an account

Click the ✏️ icon next to the account. You can modify:
- The username
- The password (leave blank to keep unchanged)
- The role

### Delete an account

Click the 🗑️ icon. A superadmin cannot delete their own account.

---

## Changing your password

Any manager can change their own password from the dashboard, regardless of their role.

1. Click the **key** icon (🔑) in the dashboard header
2. Enter the current password
3. Enter the new password (minimum 8 characters) and confirm it
4. Click **Save**

Each field has a 👁 button to show/hide the characters.

After a successful change, a window offers to **disconnect all other active sessions** (other browsers or devices). If no other session is active, a simple confirmation message is shown.

> The superadmin can also change any manager's password from the **Accounts** tab without knowing the old password.

---

## Authentication

- Login via `/manager` (username + password)
- Session stored in an **HttpOnly** + **SameSite=Strict** cookie — inaccessible from JavaScript
- Session duration configurable via global settings
- **Rate limiting** — 5 failed login attempts → IP blocked for 15 minutes
- **Audit log** — all logins, creations and deletions are recorded

---

## Legacy Interface

The original Razzia interface remains accessible at `/legacy` using the password defined in `config/game.json`. It is maintained for compatibility and works independently of the account system.

---

Back to the [documentation index](README.en.md).
