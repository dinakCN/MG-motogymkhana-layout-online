import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import express from 'express'
import { WebSocketServer } from 'ws'
import { config, awardGroupsProblems } from './config.js'
import { readStateFile, saveState, applyCommand, applyServerConfig, syncAwardSubject, syncTrackScene, clearStaleHighlight } from './state.js'
import { startPolling } from './poller.js'
import { startTimerPolling } from './timer.js'
import { prepareTrackMap } from './trackMap.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Состояние своё у каждого этапа. Общий файл означал бы, что репетиция
// на полигоне затирает сцену и правки боевого дня — а именно их и надо
// поднять, если сервер упал посреди эфира.
const STATE_PATH = join(root, `state.${config.stageId}.json`)

const { state, restored } = readStateFile(STATE_PATH)

// Скан со сканера весит мегабайты, а в кадре занимает вдесятеро меньше
// пикселей. Копию готовим здесь, а не только при сборке: event.config.js
// обещает, что файлы в public/assets подкладывают без пересборки, и схему
// положат утром именно так. Работа пропускается, если копия уже свежая,
// поэтому обычный npm start ничего не ждёт.
const trackMapUrl = await prepareTrackMap(config.trackMapUrl, { root })

// Настройки этапа едут вместе с состоянием: иначе они существовали бы
// только в event.config.js и ни на что не влияли. Что при этом принадлежит
// файлу этапа, а что оператору, разбирает applyServerConfig.
applyServerConfig(state, { ...config, trackMapUrl }, { restored })

// Состав групп мог поменяться, пока сервер лежал: выбранной группы больше
// нет — снимаем выбор, чтобы в кадр не ушёл её заголовок поверх пустого
// подиума, а оператор не смотрел на пустой селектор.
syncAwardSubject(state)

// Схему могли убрать из конфига, пока сервер лежал, — а в состоянии она
// осталась активной сценой. Без сброса кадр поднялся бы с надписью о том,
// что схема не загрузилась.
syncTrackScene(state)

// Хайлайт, переживший падение, снимаем: его страховочный таймер заводится
// командой пульта, а её после падения не было — нижняя треть осталась бы
// в кадре до конца дня.
clearStaleHighlight(state)

const app = express()

app.use('/assets', express.static(join(root, 'public/assets')))
app.use(express.static(join(root, 'dist')))

// Обе страницы отдаёт один и тот же собранный index.html;
// какой интерфейс показать, решает main.js по пути.
for (const route of ['/overlay', '/control']) {
  app.get(route, (_req, res) => res.sendFile(join(root, 'dist/index.html')))
}

const server = createServer(app)
const wss = new WebSocketServer({ server })

function send(message) {
  const text = JSON.stringify(message)
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(text)
  }
}

const broadcast = () => send({ type: 'state', payload: state })

function commit() {
  saveState(state, STATE_PATH)
  broadcast()
}

// Показания таймера идут своим сообщением, а не общим состоянием: они
// меняются три раза в секунду, и гонять ради них весь список участников
// значило бы жечь процессор в кадре без всякой пользы. На диск они не
// пишутся вовсе — по своей природе живут только в текущей секунде.
// Тем же сообщением едет признак связи: он меняется в те же моменты.
const broadcastTimer = () => send({ type: 'timer', payload: state.timer, link: state.timerLink })

// Страховка на случай, если пульт скрыть хайлайт не сможет: вкладку
// закрыли, ноутбук ушёл в сон, связь оборвалась. Нижняя треть — вставка
// на несколько секунд, зависнуть в кадре до конца дня она не должна.
// Запас ко времени показа даёт пульту снять её самому и обычным путём.
const HIGHLIGHT_FAILSAFE = config.highlightTimeout + 4000
let highlightFailsafe = null

function armHighlightFailsafe() {
  clearTimeout(highlightFailsafe)
  highlightFailsafe = setTimeout(() => {
    if (!state.highlight.visible) return

    console.warn('[mg] хайлайт снят по страховочному таймеру — пульт не ответил')
    applyCommand(state, { type: 'hideHighlight' })
    if (state.activeScene === 'highlight') {
      applyCommand(state, { type: 'setActiveScene', payload: state.highlight.returnScene ?? 'results' })
    }
    commit()
  }, HIGHLIGHT_FAILSAFE)
}

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'state', payload: state }))

  socket.on('message', (raw) => {
    let message
    try {
      message = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (!applyCommand(state, message)) return

    if (message.type === 'showHighlight') armHighlightFailsafe()
    if (message.type === 'hideHighlight') clearTimeout(highlightFailsafe)
    commit()
  })
})

startPolling(state, {
  url: config.stageUrl,
  interval: config.pollInterval,
  onUpdate: commit,
})

// Два опросчика с разной частотой и разным поведением при сбое, намеренно
// не смешанные: у протокола сбой не затирает последние хорошие данные,
// а у таймера застывшие цифры вреднее пустого места.
if (config.timerUrl) {
  startTimerPolling(state, {
    url: config.timerUrl,
    interval: config.timerPollInterval,
    onUpdate: broadcastTimer,
  })
}

server.listen(config.port, config.host, () => {
  // Без сборки сервер поднимется, но обе страницы будут пустыми — в OBS
  // это выглядит как «оверлей сломался». Лучше сказать прямо и сразу.
  if (!existsSync(join(root, 'dist/index.html'))) {
    console.error('[mg] ВНИМАНИЕ: dist/ не собран — страницы будут пустыми. Выполните: npm run build')
  }
  if (config.stageId !== config.liveStageId) {
    console.warn(`[mg] ВНИМАНИЕ: этап ${config.stageId} — не боевой (боевой ${config.liveStageId})`)
  }
  // Опечатка в составе групп не проявляет себя ни в пульте, ни в кадре:
  // человек просто уедет не в свой зачёт. Сказать надо один раз и здесь,
  // пока лог ещё читают.
  for (const problem of awardGroupsProblems(config.awardGroups)) {
    console.warn(`[mg] ВНИМАНИЕ: ${problem}`)
  }
  console.log(`[mg] этап ${config.stageId} — ${config.stageUrl}`)
  console.log(state.trackMapUrl
    ? `[mg] схема    ${state.trackMapUrl}`
    : '[mg] схема    не задана — сцена «Схема трассы» в пульте погашена')
  console.log(config.timerUrl
    ? `[mg] таймер   ${config.timerUrl} раз в ${config.timerPollInterval} мс`
    : '[mg] таймер   не задан — зона времени покажет время первой попытки')
  console.log(`[mg] оверлей  http://localhost:${config.port}/overlay`)
  console.log(`[mg] пульт    http://localhost:${config.port}/control`)
})
