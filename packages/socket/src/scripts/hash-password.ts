/**
 * Script utilitaire pour générer un hash bcrypt d'un mot de passe.
 * Usage : pnpm hash-password <mot_de_passe>
 *
 * Exemple :
 *   pnpm hash-password monMotDePasse123
 *
 * Copiez le hash généré dans config/admin.json :
 * {
 *   "username": "admin",
 *   "passwordHash": "<hash>"
 * }
 */

import bcrypt from "bcryptjs"

const SALT_ROUNDS = 12

const password = process.argv[2]

if (!password) {
  console.error("❌ Erreur : aucun mot de passe fourni.")
  console.error("   Usage : pnpm hash-password <mot_de_passe>")
  process.exit(1)
}

if (password.length < 8) {
  console.error("❌ Erreur : le mot de passe doit contenir au moins 8 caractères.")
  process.exit(1)
}

const hash = await bcrypt.hash(password, SALT_ROUNDS)

console.log("\n✅ Hash généré avec succès !\n")
console.log("Copiez ce hash dans config/admin.json :\n")
console.log(hash)
console.log("\nExemple de config/admin.json :")
console.log(JSON.stringify({ username: "admin", passwordHash: hash }, null, 2))
console.log()
