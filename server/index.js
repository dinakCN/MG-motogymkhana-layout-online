import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import express from 'express'
import { WebSocketServer } from 'ws'
import { config } from './config.js'
import { loadState, saveState, applyCommand } from './state.js'
import { startPolling } from './poller.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Состояние своё у каждого этапа. Общий файл означал бы, что репетиция
// на полигоне затирает сцену и правки боевого дня — а именно их и надо
// поднять, если сервер упал посреди эфира.
const STATE_PATH = join(root, `state.${config.stageId}.json`)

const state = loadState(STATE_PATH)

// Всегда перекрываем сохранённое значение текущим: иначе после репетиции
// на полигоне в пульте показывался бы этап из state.json, а данные шли бы
// с боевого — и наоборот. Оператор должен видеть, откуда данные на самом деле.
state.stageId = config.stageId

// Настройки, которые нужны в кадре и в пульте, едут вместе с состоянием:
// иначе они существовали бы только в event.config.js и ни на что не влияли.
state.eventTitle = config.eventTitle
state.liveStageId = config.liveStageId
state.highlightTimeout = config.highlightTimeout
state.showClassTop5 = config.showClassTop5

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

function broadcast() {
  const message = JSON.stringify({ type: 'state', payload: state })
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(message)
  }
}

function commit() {
  saveState(state, STATE_PATH)
  broadcast()
}

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

server.listen(config.port, () => {
  // Без сборки сервер поднимется, но обе страницы будут пустыми — в OBS
  // это выглядит как «оверлей сломался». Лучше сказать прямо и сразу.
  if (!existsSync(join(root, 'dist/index.html'))) {
    console.error('[mg] ВНИМАНИЕ: dist/ не собран — страницы будут пустыми. Выполните: npm run build')
  }
  if (config.stageId !== config.liveStageId) {
    console.warn(`[mg] ВНИМАНИЕ: этап ${config.stageId} — не боевой (боевой ${config.liveStageId})`)
  }
  console.log(`[mg] этап ${config.stageId} — ${config.stageUrl}`)
  console.log(`[mg] оверлей  http://localhost:${config.port}/overlay`)
  console.log(`[mg] пульт    http://localhost:${config.port}/control`)
})
