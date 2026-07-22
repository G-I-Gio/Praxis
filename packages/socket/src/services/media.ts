/**
 * Praxis media service
 * SHA256, magic bytes, native multipart parser, Range stream, deduplication, ZIP
 */
import { createHash, randomUUID } from "crypto"
import fs from "fs"
import { resolve, join } from "path"
import type { IncomingMessage, ServerResponse } from "http"
import { unzipSync } from "fflate"
import logger from "@razzia/socket/services/logger"

// -- Paths ---------------------------------------------------------------------

export const getMediaDir = (): string => {
  const base = process.env.CONFIG_PATH
    ? resolve(process.env.CONFIG_PATH, "media")
    : resolve(process.cwd(), "../../config/media")
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true })
  return base
}

export const getMediaPath = (hash: string, ext: string): string =>
  join(getMediaDir(), `${hash}.${ext}`)

// -- Whitelist extensions / MIME -----------------------------------------------

export const ALLOWED_MEDIA: Record<string, string> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  gif:  "image/gif",
  webp: "image/webp",
  mp4:  "video/mp4",
  webm: "video/webm",
  mp3:  "audio/mpeg",
  ogg:  "audio/ogg",
  wav:  "audio/wav",
}

// Magic bytes validation -- do not trust client-declared Content-Type
const MAGIC: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "image/jpeg",  bytes: [0xFF, 0xD8, 0xFF] },
  { mime: "image/png",   bytes: [0x89, 0x50, 0x4E, 0x47] },
  { mime: "image/gif",   bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp",  bytes: [0x52, 0x49, 0x46, 0x46] },
  { mime: "video/mp4",   bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { mime: "video/webm",  bytes: [0x1A, 0x45, 0xDF, 0xA3] },
  { mime: "audio/mpeg",  bytes: [0xFF, 0xFB] },
  { mime: "audio/mpeg",  bytes: [0xFF, 0xF3] },
  { mime: "audio/mpeg",  bytes: [0xFF, 0xF2] },
  { mime: "audio/mpeg",  bytes: [0x49, 0x44, 0x33] },
  { mime: "audio/ogg",   bytes: [0x4F, 0x67, 0x67, 0x53] },
  { mime: "audio/wav",   bytes: [0x52, 0x49, 0x46, 0x46] },
]

export const detectMimeFromBytes = (buf: Buffer): string | null => {
  for (const { mime, bytes, offset = 0 } of MAGIC) {
    if (bytes.every((b, i) => buf[offset + i] === b)) return mime
  }
  return null
}

export const extFromFilename = (filename: string): string | null => {
  const dot = filename.lastIndexOf(".")
  if (dot < 0) return null
  return filename.slice(dot + 1).toLowerCase()
}

// -- SHA256 --------------------------------------------------------------------

export const sha256Buffer = (buf: Buffer): string =>
  createHash("sha256").update(buf).digest("hex")

// -- Native multipart parser -- no external dependency -------------------------

const CRLF = Buffer.from([0x0D, 0x0A])
const CRLFCRLF = Buffer.from([0x0D, 0x0A, 0x0D, 0x0A])

const indexOf = (haystack: Buffer, needle: Buffer, start = 0): number => {
  for (let i = start; i <= haystack.length - needle.length; i++) {
    if (haystack.slice(i, i + needle.length).equals(needle)) return i
  }
  return -1
}

const parseMultipartFile = (
  req: IncomingMessage,
  maxBytes: number,
): Promise<{ data: Buffer; filename: string }> =>
  new Promise((resolve, reject) => {
    const ct = req.headers["content-type"] ?? ""
    const boundaryMatch = /boundary=([^;,\s]+)/i.exec(ct)
    if (!boundaryMatch) {
      return reject(new Error("Multipart boundary not found in Content-Type"))
    }
    const boundaryStr = boundaryMatch[1].replace(/^"(.*)"$/, "$1")
    const boundary    = Buffer.from("--" + boundaryStr)
    const boundaryEnd = Buffer.from("--" + boundaryStr + "--")

    const chunks: Buffer[] = []
    let totalSize = 0

    req.on("data", (chunk: Buffer) => {
      totalSize += chunk.byteLength
      if (totalSize > maxBytes + 4096) {
        req.destroy()
        reject(new Error("File too large (max " + Math.round(maxBytes / 1024 / 1024) + " MB)"))
      } else {
        chunks.push(chunk)
      }
    })

    req.on("error", reject)

    req.on("end", () => {
      const body = Buffer.concat(chunks)

      // Find opening boundary
      const boundaryPos = indexOf(body, boundary)
      if (boundaryPos < 0) {
        return reject(new Error("Invalid multipart structure: boundary not found"))
      }

      // Skip boundary + CRLF
      let pos = boundaryPos + boundary.length
      if (body[pos] === 0x0D && body[pos + 1] === 0x0A) pos += 2

      // Find end of part headers (CRLFCRLF)
      const headerEnd = indexOf(body, CRLFCRLF, pos)
      if (headerEnd < 0) {
        return reject(new Error("Invalid multipart structure: headers not found"))
      }

      const headerSection = body.slice(pos, headerEnd).toString("latin1")
      const dataStart = headerEnd + 4

      // Find end of file data (next boundary, preceded by CRLF)
      let dataEnd = indexOf(body, boundary, dataStart)
      if (dataEnd < 0) dataEnd = indexOf(body, boundaryEnd, dataStart)
      if (dataEnd < 0) dataEnd = body.length
      // Strip trailing CRLF before boundary
      if (dataEnd >= 2 && body[dataEnd - 2] === 0x0D && body[dataEnd - 1] === 0x0A) {
        dataEnd -= 2
      }

      const fileData = body.slice(dataStart, dataEnd)

      // Extract filename from Content-Disposition
      const dispositionMatch = /filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i.exec(headerSection)
      const filename = dispositionMatch?.[1]?.trim() ?? "upload.bin"

      resolve({ data: fileData, filename })
    })
  })

// -- Upload handler -------------------------------------------------------------

export interface UploadResult {
  hash:           string
  ext:            string
  mimeType:       string
  size:           number
  originalName:   string
  alreadyExisted: boolean
}

export const handleMediaUpload = async (
  req: IncomingMessage,
): Promise<UploadResult> => {
  const maxBytes = parseInt(process.env.MAX_MEDIA_SIZE ?? "20", 10) * 1024 * 1024

  const { data, filename } = await parseMultipartFile(req, maxBytes)

  const ext = extFromFilename(filename)
  if (!ext || !ALLOWED_MEDIA[ext]) {
    throw new Error("Extension not allowed: ." + (ext ?? "?"))
  }

  const expectedMime = ALLOWED_MEDIA[ext]!

  // Magic bytes validation
  const magic = detectMimeFromBytes(data)
  const mimeOk =
    magic === expectedMime ||
    (ext === "wav"  && magic === "audio/wav")  ||
    (ext === "webp" && magic === "image/webp") ||
    (ext === "mp3"  && magic === "audio/mpeg") ||
    magic === null  // fallback if magic bytes unknown

  if (!mimeOk && magic !== null) {
    throw new Error("File content does not match extension ." + ext)
  }

  const fileHash    = sha256Buffer(data)
  const finalPath   = getMediaPath(fileHash, ext)
  const alreadyExisted = fs.existsSync(finalPath)

  if (!alreadyExisted) {
    fs.writeFileSync(finalPath, data)
  }

  return {
    hash:           fileHash,
    ext,
    mimeType:       expectedMime,
    size:           data.byteLength,
    originalName:   filename,
    alreadyExisted,
  }
}

// -- File stream with Range support --------------------------------------------

export const streamMediaFile = (
  res: ServerResponse,
  filePath: string,
  mimeType: string,
  originalName: string,
  disposition: "inline" | "attachment" = "inline",
  rangeHeader?: string,
): void => {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404)
    res.end()
    return
  }

  const stat  = fs.statSync(filePath)
  const total = stat.size

  const baseHeaders: Record<string, string | number> = {
    "Content-Type":        mimeType,
    "Accept-Ranges":       "bytes",
    "Cache-Control":       "private, max-age=31536000, immutable",
    "Content-Disposition":
      disposition === "attachment"
        ? `attachment; filename="${encodeURIComponent(originalName)}"`
        : "inline",
  }

  if (rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
    if (match) {
      const start     = match[1] ? parseInt(match[1], 10) : 0
      const end       = match[2] ? parseInt(match[2], 10) : total - 1
      const chunkSize = end - start + 1

      res.writeHead(206, {
        ...baseHeaders,
        "Content-Range":  `bytes ${start}-${end}/${total}`,
        "Content-Length": chunkSize,
      })
      fs.createReadStream(filePath, { start, end }).pipe(res)
      return
    }
  }

  res.writeHead(200, { ...baseHeaders, "Content-Length": total })
  fs.createReadStream(filePath).pipe(res)
}

// -- ZIP export ----------------------------------------------------------------

export interface ZipMediaEntry {
  hash:         string
  ext:          string
  originalName: string
}

export const buildQuizZip = (
  quizJson: string,
  mediaEntries: ZipMediaEntry[],
): Buffer => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { zipSync, strToU8 } = require("fflate") as typeof import("fflate")

  const files: Record<string, Uint8Array> = {
    "quiz.json": strToU8(quizJson),
  }

  for (const entry of mediaEntries) {
    const filePath = getMediaPath(entry.hash, entry.ext)
    if (fs.existsSync(filePath)) {
      files[`media/${entry.hash}.${entry.ext}`] = new Uint8Array(fs.readFileSync(filePath))
    }
  }

  return Buffer.from(zipSync(files, { level: 1 }))
}

// -- ZIP import ----------------------------------------------------------------

export interface ImportedMedia {
  hash:           string
  ext:            string
  mimeType:       string
  size:           number
  originalName:   string
  alreadyExisted: boolean
}

export const parseQuizZip = (
  zipBuffer: Buffer,
): { quizJson: string; rawMedia: { filename: string; data: Buffer }[] } => {
  const files = unzipSync(new Uint8Array(zipBuffer))

  const quizEntry = files["quiz.json"]
  if (!quizEntry) throw new Error("quiz.json missing from ZIP")

  const quizJson  = Buffer.from(quizEntry).toString("utf-8")
  const rawMedia: { filename: string; data: Buffer }[] = []

  for (const [path, data] of Object.entries(files)) {
    if (path.startsWith("media/") && path !== "media/") {
      rawMedia.push({ filename: path.slice("media/".length), data: Buffer.from(data) })
    }
  }

  return { quizJson, rawMedia }
}

export const processZipMedia = (
  rawMedia: { filename: string; data: Buffer }[],
): ImportedMedia[] => {
  const maxBytes  = parseInt(process.env.MAX_MEDIA_SIZE ?? "20", 10) * 1024 * 1024
  const results: ImportedMedia[] = []

  for (const { filename, data } of rawMedia) {
    const ext = extFromFilename(filename)
    if (!ext || !ALLOWED_MEDIA[ext]) {
      logger.warn("ZIP import: skipping unsupported file", { filename })
      continue
    }
    if (data.byteLength > maxBytes) {
      logger.warn("ZIP import: skipping oversized file", { filename, size: data.byteLength })
      continue
    }

    const hash           = sha256Buffer(data)
    const finalPath      = getMediaPath(hash, ext)
    const alreadyExisted = fs.existsSync(finalPath)

    if (!alreadyExisted) fs.writeFileSync(finalPath, data)

    results.push({
      hash,
      ext,
      mimeType:     ALLOWED_MEDIA[ext]!,
      size:         data.byteLength,
      originalName: filename,
      alreadyExisted,
    })
  }

  return results
}

export const substituteMediaRefs = (
  quizJson: string,
  hashToId: Map<string, string>,
): string => {
  let result = quizJson
  for (const [hashExt, id] of hashToId) {
    result = result.split("media:" + hashExt).join("media:" + id)
  }
  return result
}

logger.info("Media service initialized", { dir: getMediaDir() })
