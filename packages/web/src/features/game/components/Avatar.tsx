import { getAvatarColor, getInitial } from "@razzia/web/features/game/utils/avatars"
import clsx from "clsx"

interface Props {
  username: string
  avatar?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizes = { sm: "size-8 text-sm", md: "size-12 text-lg", lg: "size-16 text-2xl" }

const Avatar = ({ username, avatar, size = "md", className }: Props) => {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={username}
        className={clsx("rounded-full object-cover ring-2 ring-white/40", sizes[size], className)}
      />
    )
  }
  return (
    <div
      className={clsx("flex items-center justify-center rounded-full font-bold text-white ring-2 ring-white/40", sizes[size], className)}
      style={{ backgroundColor: getAvatarColor(username) }}
    >
      {getInitial(username)}
    </div>
  )
}

export default Avatar
