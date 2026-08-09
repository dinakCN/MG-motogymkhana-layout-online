// Готовит уменьшенную копию схемы трассы рядом с исходником. Скан A4 при
// 300 dpi — это 3508×2480 и несколько мегабайт, а в кадре схема занимает
// 1174×830: без уменьшения OBS декодировал бы вдесятеро больше пикселей
// при каждом входе в сцену.
//
//   npm run trackmap                 схема из event.config.js
//   npm run trackmap -- /assets/x.png   другой файл
//
// Вызывается ещё и сам: из npm run build и при старте сервера. Работа
// пропускается, если копия уже свежее исходника, поэтому лишним запуск
// не бывает.

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import eventConfig from '../event.config.js'
import { resolveTrackMap } from '../server/config.js'
import { prepareTrackMap, needsFitting } from '../server/trackMap.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Схему читаем прямо из файла этапа, а не через loadConfig: тот требует
// вписанного `stage`, а уменьшать картинку можно и до того, как этап
// назначен, — `npm run build` идёт раньше.
const url = process.argv[2] || resolveTrackMap(process.env.TRACK_MAP ?? eventConfig.trackMap)

if (!url) {
  console.log('[схема] не задана в event.config.js — уменьшать нечего')
  process.exit(0)
}

const result = await prepareTrackMap(url, { root })

// Сказать вслух стоит и когда работы не было: запуск руками означает, что
// человек ждёт ответа, а молчание он прочитает как «скрипт не сработал».
//
// Копию prepareTrackMap возвращает и когда она уже свежая, поэтому
// «в кадр пойдёт» — правда в обоих случаях. Исходник обратно приходит
// либо когда уменьшать нечего, либо когда что-то не вышло, — и о втором
// prepareTrackMap уже сказал сам.
if (result !== url) console.log(`[схема] в кадр пойдёт ${result}`)
else if (!needsFitting(url)) console.log(`[схема] уменьшать нечего: ${url}`)
