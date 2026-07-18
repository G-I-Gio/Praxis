import { AVATARS } from "@razzia/web/features/game/utils/avatars"
import clsx from "clsx"

interface Props {
  selected?: string
  onSelect: (avatar: string | undefined) => void
}

const AvatarPicker = ({ selected, onSelect }: Props) => (
  <div className="flex flex-col gap-3">
    <div className="grid grid-cols-4 gap-2">
      {AVATARS.map((avatar) => (
        <button
          key={avatar}
          type="button"
          onClick={() => onSelect(avatar)}
          className={clsx(
            "rounded-xl p-1 transition-all",
            selected === avatar
              ? "bg-white/30 ring-primary ring-2 scale-110"
              : "hover:bg-white/10",
          )}
        >
          <img src={avatar} alt="" className="size-14 rounded-lg object-cover" />
        </button>
      ))}
    </div>
    {selected && (
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        className="rounded-lg bg-white/10 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/20 transition-colors"
      >
        Retirer l&apos;avatar
      </button>
    )}
  </div>
)

export default AvatarPicker
