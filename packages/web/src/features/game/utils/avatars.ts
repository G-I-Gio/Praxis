// Zéro import — évite tout risque de dépendance circulaire
export const AVATARS = Array.from(
  { length: 16 },
  (_, i) => `/avatars/${String(i + 1).padStart(3, "0")}.png`,
)

const FALLBACK_COLORS = [
  "#e69f00", "#56b4e9", "#3dbfa0", "#cc79a7",
  "#f0722e", "#6a5acd", "#2e8b57", "#dc143c",
]

export const getAvatarColor = (username: string): string => {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
}

export const getInitial = (username: string): string =>
  username.charAt(0).toUpperCase()
