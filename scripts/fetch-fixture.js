// Скачивает страницу протокола в test/fixtures — с этого начинается починка
// парсера, когда сайт поменял вёрстку. Тесты гоняются по сохранённому HTML,
// поэтому чинить можно без сети и не дожидаясь эфира.
//
//   npm run fixture                 боевой этап из event.config.js
//   npm run fixture -- 670          другой этап по номеру
//   npm run fixture -- https://...  страница по полной ссылке
//
// Дальше: npm test — упавшие тесты покажут, что именно разъехалось.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import eventConfig from '../event.config.js'
import { resolveStage } from '../server/config.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const template = eventConfig.stageUrlTemplate || 'https://gymkhana-cup.ru/competitions/stage?id={id}'
const { stageId, stageUrl } = resolveStage(process.argv[2] || eventConfig.stage, template)

const response = await fetch(stageUrl, { headers: { 'User-Agent': 'mg-overlay/1.0' } })
if (!response.ok) {
  console.error(`[fixture] HTTP ${response.status} — ${stageUrl}`)
  process.exit(1)
}

const path = join(root, 'test/fixtures', `stage${stageId}.html`)
writeFileSync(path, await response.text(), 'utf-8')

console.log(`[fixture] ${stageUrl}`)
console.log(`[fixture] сохранено: ${path}`)
console.log('[fixture] дальше: npm test')
