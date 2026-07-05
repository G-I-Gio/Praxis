import { EXAMPLE_QUIZZ } from "@razzia/common/constants"
import type {
  GameResult,
  GameResultMeta,
  QuizzWithId,
} from "@razzia/common/types/game"
import { quizzValidator } from "@razzia/common/validators/quizz"
import { normalizeFilename } from "@razzia/socket/utils/game"
import fs from "fs"
import { isAbsolute, relative, resolve } from "path"

interface GameConfig {
  managerPassword: string
}

const inContainerPath = process.env.CONFIG_PATH

const getPath = (path = "") =>
  inContainerPath
    ? resolve(inContainerPath, path)
    : resolve(process.cwd(), "../../config", path)

// Ids come from the network and are interpolated into file paths, so they must
// be strictly validated to prevent path traversal (e.g. id = "../game").
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/

const getSafePath = (subDir: string, id: unknown): string => {
  if (typeof id !== "string" || !SAFE_ID_PATTERN.test(id)) {
    throw new Error(`Invalid id "${String(id)}"`)
  }

  const baseDir = getPath(subDir)
  const target = resolve(baseDir, `${id}.json`)
  const rel = relative(baseDir, target)

  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Invalid id "${id}"`)
  }

  return target
}

export const initConfig = () => {
  const isConfigFolderExists = fs.existsSync(getPath())

  if (!isConfigFolderExists) {
    fs.mkdirSync(getPath())
  }

  const isGameConfigExists = fs.existsSync(getPath("game.json"))

  if (!isGameConfigExists) {
    fs.writeFileSync(
      getPath("game.json"),
      JSON.stringify(
        {
          managerPassword: "PASSWORD",
        },
        null,
        2,
      ),
    )
  }

  const isQuizzExists = fs.existsSync(getPath("quizz"))

  if (!isQuizzExists) {
    fs.mkdirSync(getPath("quizz"))

    fs.writeFileSync(
      getPath("quizz/example.json"),
      JSON.stringify(EXAMPLE_QUIZZ, null, 2),
    )
  }
}

export const getGameConfig = (): GameConfig => {
  const isExists = fs.existsSync(getPath("game.json"))

  if (!isExists) {
    throw new Error("Game config not found")
  }

  try {
    const config = fs.readFileSync(getPath("game.json"), "utf-8")

    return JSON.parse(config) as GameConfig
  } catch (error) {
    console.error("Failed to read game config:", error)
  }

  return {} as GameConfig
}

export const getQuizzMeta = () =>
  getQuizz().map(({ id, subject }) => ({ id, subject }))

export const getQuizzById = (id: string) => {
  const filePath = getSafePath("quizz", id)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Quizz "${id}" not found`)
  }

  const data = fs.readFileSync(filePath, "utf-8")
  const result = quizzValidator.safeParse(JSON.parse(data))

  if (!result.success) {
    throw new Error(`Invalid quizz "${id}"`)
  }

  return { id, ...result.data }
}

export const getQuizz = () => {
  const isExists = fs.existsSync(getPath("quizz"))

  if (!isExists) {
    return []
  }

  try {
    const files = fs
      .readdirSync(getPath("quizz"))
      .filter((file) => file.endsWith(".json"))

    const quizz: QuizzWithId[] = files.flatMap((file) => {
      const data = fs.readFileSync(getPath(`quizz/${file}`), "utf-8")
      const id = file.replace(".json", "")
      const result = quizzValidator.safeParse(JSON.parse(data))

      if (!result.success) {
        console.warn(`Invalid quizz config "${file}":`, result.error.issues)

        return []
      }

      return [{ id, ...result.data }]
    })

    return quizz
  } catch (error) {
    console.error("Failed to read quizz config:", error)

    return []
  }
}

export const updateQuizz = (id: string, data: unknown): { id: string } => {
  const result = quizzValidator.safeParse(data)

  if (!result.success) {
    throw new Error(result.error.issues[0].message)
  }

  const oldPath = getSafePath("quizz", id)

  if (!fs.existsSync(oldPath)) {
    throw new Error(`Quizz "${id}" not found`)
  }

  fs.writeFileSync(oldPath, JSON.stringify(result.data, null, 2))

  return { id }
}

export const deleteQuizz = (id: string): void => {
  const filePath = getSafePath("quizz", id)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Quizz "${id}" not found`)
  }

  fs.unlinkSync(filePath)
}

export const saveResult = (data: GameResult): void => {
  try {
    const resultsPath = getPath("results")

    if (!fs.existsSync(resultsPath)) {
      fs.mkdirSync(resultsPath)
    }

    fs.writeFileSync(
      getSafePath("results", data.id),
      JSON.stringify(data, null, 2),
    )

    console.log(`Saved result for "${data.subject}"`)
  } catch (error) {
    console.error("Failed to save result:", error)
  }
}

export const getResultsMeta = (): GameResultMeta[] => {
  const resultsPath = getPath("results")

  if (!fs.existsSync(resultsPath)) {
    return []
  }

  const readMeta = (file: string): GameResultMeta | null => {
    try {
      const data = fs.readFileSync(getPath(`results/${file}`), "utf-8")
      const result = JSON.parse(data) as GameResult

      return {
        id: result.id,
        subject: result.subject,
        date: result.date,
        playerCount: result.players.length,
      }
    } catch {
      return null
    }
  }

  try {
    return fs
      .readdirSync(resultsPath)
      .filter((file) => file.endsWith(".json"))
      .map(readMeta)
      .filter((meta): meta is GameResultMeta => meta !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  } catch {
    return []
  }
}

export const getResultById = (id: string): GameResult => {
  const filePath = getSafePath("results", id)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Result "${id}" not found`)
  }

  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as GameResult
}

export const deleteResult = (id: string): void => {
  const filePath = getSafePath("results", id)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Result "${id}" not found`)
  }

  fs.unlinkSync(filePath)
}

export const saveQuizz = (data: unknown): { id: string } => {
  const result = quizzValidator.safeParse(data)

  if (!result.success) {
    throw new Error(result.error.issues[0].message)
  }

  const id = normalizeFilename(result.data.subject)
  const filePath = getSafePath("quizz", id)

  fs.writeFileSync(filePath, JSON.stringify(result.data, null, 2))

  return { id }
}
