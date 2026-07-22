import type { BrandingTheme } from "@razzia/web/branding"
import { applyBranding } from "@razzia/web/branding"
import Button from "@razzia/web/components/Button"
import Input from "@razzia/web/components/Input"
import { RotateCcw, Upload } from "lucide-react"
import { type ChangeEvent, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

interface Props {
  theme: BrandingTheme
  saving: boolean
  onSave: (_patch: Partial<BrandingTheme>) => Promise<BrandingTheme>
  onUpload: (_field: string, _file: File) => Promise<BrandingTheme>
  onReset: (_field: string) => Promise<BrandingTheme>
  onApply: () => Promise<void>
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-accent rounded-lg border-2 p-3">
    <p className="text-foreground mb-3 text-xs font-bold uppercase tracking-wider">{title}</p>
    <div className="flex flex-col gap-3">{children}</div>
  </div>
)

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label className="text-muted-foreground text-xs font-medium">{label}</label>
    {children}
  </div>
)

interface ColorPickerProps { value: string; onChange: (_v: string) => void }

const ColorPicker = ({ value, onChange }: ColorPickerProps) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={value || "#000000"}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
    />
    <Input
      variant="sm"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="#rrggbb"
      className="flex-1 font-mono"
    />
  </div>
)

interface FileFieldProps {
  label: string
  field: string
  currentPath?: string
  accept: string
  onUpload: (_field: string, _file: File) => Promise<BrandingTheme>
  onReset: (_field: string) => Promise<BrandingTheme>
}

const FileField = ({ label, field, currentPath, accept, onUpload, onReset }: FileFieldProps) => {
  const { t } = useTranslation()
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const updatedTheme = await onUpload(field, file)
      applyBranding(updatedTheme)
      toast.success(t("manager:appearance.updated", { label }))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ""
    }
  }

  const handleReset = async () => {
    setBusy(true)
    try {
      const updatedTheme = await onReset(field)
      applyBranding(updatedTheme)
      toast.success(t("manager:appearance.reset", { label }))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        {currentPath ? (
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{currentPath}</span>
        ) : (
          <span className="text-muted-foreground flex-1 text-xs italic">{t("manager:appearance.default")}</span>
        )}
        <button
          className="bg-muted text-accent-foreground hover:bg-accent flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium"
          onClick={() => ref.current?.click()}
          disabled={busy}
        >
          <Upload className="size-3" />
          {t("manager:appearance.choose")}
        </button>
        {currentPath && (
          <button
            className="text-muted-foreground hover:text-foreground shrink-0 rounded-md p-1.5"
            onClick={handleReset}
            disabled={busy}
            title={t("manager:appearance.resetDefault")}
          >
            <RotateCcw className="size-3.5" />
          </button>
        )}
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={handleFile} />
      </div>
    </Field>
  )
}

const DashboardAppearance = ({ theme, saving, onSave, onUpload, onReset, onApply }: Props) => {
  const { t } = useTranslation()
  const [appName, setAppName]         = useState(theme.appName ?? "")
  const [primary, setPrimary]         = useState(theme.colors?.primary ?? "#ff9900")
  const [secondary, setSecondary]     = useState(theme.colors?.secondary ?? "#1a140b")
  const [answerColors, setAnswerColors] = useState<string[]>(
    theme.answerColors ?? ["#e69f00", "#56b4e9", "#3dbfa0", "#cc79a7"],
  )
  const [fontFamily, setFontFamily]   = useState(theme.font?.family ?? "")
  const [fontUrl, setFontUrl]         = useState(theme.font?.url ?? "")

  // Bug fix: never shadow `t` with a local variable — use `updatedTheme` instead
  const handleSaveIdentity = async () => {
    try {
      const updatedTheme = await onSave({ appName: appName || "" })
      applyBranding(updatedTheme)
      toast.success(t("manager:appearance.identitySaved"))
    } catch (e) { toast.error((e as Error).message) }
  }

  const handleSaveColors = async () => {
    try {
      const updatedTheme = await onSave({ colors: { primary, secondary }, answerColors })
      applyBranding(updatedTheme)
      toast.success(t("manager:appearance.colorsSaved"))
    } catch (e) { toast.error((e as Error).message) }
  }

  const handleSaveFont = async () => {
    try {
      const updatedTheme = await onSave({
        font: fontFamily ? { family: fontFamily, url: fontUrl || undefined } : undefined,
      })
      applyBranding(updatedTheme)
      toast.success(t("manager:appearance.fontSaved"))
    } catch (e) { toast.error((e as Error).message) }
  }

  const setAnswerColor = (i: number, v: string) =>
    setAnswerColors((prev) => prev.map((c, idx) => (idx === i ? v : c)))

  const AUDIO_FIELDS: { field: string; label: string }[] = [
    { field: "answersMusic",    label: t("manager:appearance.audio.answersMusic") },
    { field: "answersSound",    label: t("manager:appearance.audio.answersSound") },
    { field: "showSound",       label: t("manager:appearance.audio.showSound") },
    { field: "resultsSound",    label: t("manager:appearance.audio.resultsSound") },
    { field: "boumpSound",      label: t("manager:appearance.audio.boumpSound") },
    { field: "podiumThree",     label: t("manager:appearance.audio.podiumThree") },
    { field: "podiumSecond",    label: t("manager:appearance.audio.podiumSecond") },
    { field: "podiumFirst",     label: t("manager:appearance.audio.podiumFirst") },
    { field: "podiumSnearRoll", label: t("manager:appearance.audio.podiumSnearRoll") },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">

      <Section title={t("manager:appearance.section.identity")}>
        <Field label={t("manager:appearance.field.appName")}>
          <Input
            variant="sm"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="Praxis"
          />
        </Field>
        <FileField
          label={t("manager:appearance.field.logo")}
          field="logo"
          currentPath={theme.logo}
          accept=".svg,.png,.jpg,.jpeg,.webp"
          onUpload={onUpload}
          onReset={onReset}
        />
        <FileField
          label={t("manager:appearance.field.favicon")}
          field="favicon"
          currentPath={theme.favicon}
          accept=".svg,.png,.ico"
          onUpload={onUpload}
          onReset={onReset}
        />
        <Button size="sm" onClick={handleSaveIdentity} disabled={saving}>
          {t("common:save")}
        </Button>
      </Section>

      <Section title={t("manager:appearance.section.colors")}>
        <Field label={t("manager:appearance.field.primaryColor")}>
          <ColorPicker value={primary} onChange={setPrimary} />
        </Field>
        <Field label={t("manager:appearance.field.backgroundColor")}>
          <ColorPicker value={secondary} onChange={setSecondary} />
        </Field>
        {["A", "B", "C", "D"].map((letter, i) => (
          <Field key={letter} label={t("manager:appearance.field.answerColor", { letter })}>
            <ColorPicker value={answerColors[i] ?? "#cccccc"} onChange={(v) => setAnswerColor(i, v)} />
          </Field>
        ))}
        <Button size="sm" onClick={handleSaveColors} disabled={saving}>
          {t("common:save")}
        </Button>
      </Section>

      <Section title={t("manager:appearance.section.visual")}>
        <FileField
          label={t("manager:appearance.field.background")}
          field="background"
          currentPath={theme.background}
          accept=".png,.jpg,.jpeg,.webp"
          onUpload={onUpload}
          onReset={onReset}
        />
      </Section>

      <Section title={t("manager:appearance.section.typography")}>
        <Field label={t("manager:appearance.field.fontFamily")}>
          <Input
            variant="sm"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            placeholder="Rubik Variable"
          />
        </Field>
        <Field label={t("manager:appearance.field.fontUrl")}>
          <Input
            variant="sm"
            value={fontUrl}
            onChange={(e) => setFontUrl(e.target.value)}
            placeholder="https://fonts.googleapis.com/css2?family=..."
          />
        </Field>
        <Button size="sm" onClick={handleSaveFont} disabled={saving}>
          {t("common:save")}
        </Button>
      </Section>

      <Section title={t("manager:appearance.section.sounds")}>
        {AUDIO_FIELDS.map(({ field, label }) => (
          <FileField
            key={field}
            label={label}
            field={field}
            currentPath={(theme.audio as Record<string, string> | undefined)?.[field]}
            accept=".mp3,.ogg,.wav"
            onUpload={onUpload}
            onReset={onReset}
          />
        ))}
      </Section>

      <div className="border-primary rounded-lg border-2 bg-primary/5 p-3">
        <p className="text-foreground mb-1 text-xs font-semibold">
          {t("manager:appearance.applyTitle")}
        </p>
        <p className="text-muted-foreground mb-3 text-xs">
          {t("manager:appearance.applyDesc")}
        </p>
        <Button
          size="sm"
          className="bg-primary w-full"
          onClick={() =>
            onApply()
              .then(() => toast.success(t("manager:appearance.themeApplied")))
              .catch((e: Error) => toast.error(e.message))
          }
          disabled={saving}
        >
          {t("manager:appearance.applyButton")}
        </Button>
      </div>

    </div>
  )
}

export default DashboardAppearance
