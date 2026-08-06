import { statSync } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'

// Схему показывают файлом, и файл этот приезжает со сканера: A4 при 300 dpi —
// это 3508×2480 и несколько мегабайт. В кадре под схему остаётся 1816×830,
// то есть больше восьми девятых пикселей декодируются впустую при каждом
// входе в сцену. Поэтому рядом с исходником готовится уменьшенная копия.
//
// Здесь — правила: что уменьшать, до какого размера и когда работу можно
// пропустить. Всё чистые функции без диска и без sharp, потому что ошибиться
// тут дороже всего: неверное правило либо гонит пережатие на каждом старте,
// либо оставляет в кадре исходник на шесть мегабайт.

// Коробка — размер кадра, а не фактическое место под схемой. Запас выходит
// тридцатипроцентный и стоит около сотни лишних килобайт, зато цифра не
// зависит от полей сцены: уменьшат отступы или снимут шапку — схема
// останется чёткой, и переделывать здесь будет нечего.
export const FIT_BOX = { width: 1920, height: 1080 }

// Качество подобрано под скан: линии на бумаге держатся, а вес со скана A4
// падает до 200–300 КБ. CEF внутри OBS рисует WebP с 2014 года.
export const FIT_QUALITY = 82

const HTTP_RE = /^https?:\/\//i

// Метка производной в имени. Вынесена в константу, потому что участвует
// в двух правилах сразу: по ней собирается имя и по ней же производная
// узнаётся, чтобы не стать исходником самой себе.
const FIT_MARK = '.fit'
const FIT_EXT = '.webp'

export function needsFitting(url) {
  const raw = String(url ?? '').trim()
  if (!raw) return false

  // Чужой хост нам не принадлежит: писать туда некуда, а тянуть файл к себе
  // ради уменьшения значило бы зависеть от сети в момент старта — ровно
  // того, от чего вся система и уходит.
  if (HTTP_RE.test(raw)) return false

  const name = basename(raw)
  const ext = extname(name).toLowerCase()

  // Векторной схеме уменьшать нечего: она рисуется в любом размере и весит
  // сотни байт. Растеризовав её, мы сделали бы из чёткой графики мыло.
  if (ext === '.svg') return false

  // Производная сама себе исходником быть не может: иначе каждый старт
  // пережимал бы уже пережатое, теряя качество на каждом круге.
  if (extname(basename(name, ext)).toLowerCase() === FIT_MARK) return false

  return Boolean(ext)
}

// Вписывание без увеличения. Растягивать маленький файл незачем: пикселей
// от этого не прибавится, а вес вырастет втрое.
export function fitSize(width, height, box = FIT_BOX) {
  const scale = Math.min(box.width / width, box.height / height, 1)
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

// Режется последнее расширение, а не всё после первой точки: имена вроде
// «схема.v2.png» встречаются, и две разные схемы писали бы в один файл.
export const derivedName = (name) =>
  `${basename(name, extname(name))}${FIT_MARK}${FIT_EXT}`

export const derivedUrl = (url) =>
  `${dirname(url)}/${derivedName(basename(url))}`

// Производной нет или она старше исходника — схему заменили, готовим заново.
// Равные отметки — норма: копирование файлов сохраняет mtime с точностью
// до секунды.
export const isStale = (srcMtime, outMtime) => outMtime == null || srcMtime > outMtime

const mtimeOf = (path) => {
  try {
    return statSync(path).mtimeMs
  } catch {
    return null
  }
}

const sizeOf = (path) => {
  try {
    return statSync(path).size
  } catch {
    return null
  }
}

function human(bytes) {
  if (bytes == null) return '?'
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} МБ`
    : `${Math.round(bytes / 1024)} КБ`
}

// Готовит уменьшенную копию и возвращает URL, который надо отдать в кадр.
// Любая неудача возвращает исходный URL: подготовка картинки не имеет права
// уронить сервер за минуту до эфира, а исходник в кадре хуже уменьшенного,
// но лучше пустоты.
//
// Вызывается из двух мест — из npm run build и при старте сервера. Одной
// сборки мало: event.config.js обещает, что файлы в public/assets
// подкладывают без пересборки, и схему положат утром именно так.
export async function prepareTrackMap(url, { root, quiet = false } = {}) {
  if (!needsFitting(url)) return url

  const src = join(root, 'public', url)
  const outUrl = derivedUrl(url)
  const out = join(root, 'public', outUrl)

  const srcMtime = mtimeOf(src)
  if (srcMtime === null) {
    console.warn(`[схема] файла нет: ${url} — в кадре будет сказано, что схема не загрузилась`)
    return url
  }

  if (!isStale(srcMtime, mtimeOf(out))) return outUrl

  let sharp
  try {
    ({ default: sharp } = await import('sharp'))
  } catch {
    console.warn(`[схема] sharp не установлен — в кадр уедет исходник ${basename(url)} (${human(sizeOf(src))}). Лечится: npm install`)
    return url
  }

  try {
    const { width, height } = await sharp(src).metadata()
    const target = fitSize(width, height)

    await sharp(src)
      .resize(target.width, target.height)
      .webp({ quality: FIT_QUALITY })
      .toFile(out)

    if (!quiet) {
      console.log(`[схема]   ${basename(url)} ${width}×${height} (${human(sizeOf(src))})`
        + ` → ${basename(outUrl)} ${target.width}×${target.height} (${human(sizeOf(out))})`)
    }
    return outUrl
  } catch (err) {
    console.warn(`[схема] уменьшить не удалось (${err.message}) — в кадр уедет исходник`)
    return url
  }
}
