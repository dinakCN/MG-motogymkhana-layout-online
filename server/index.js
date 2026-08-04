import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import express from 'express'
import { WebSocketServer } from 'ws'
import { config } from './config.js'
import { loadState, saveState, applyCommand } from './state.js'
import { startPolling } from './poller.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const STATE_PATH = join(root, 'state.json')

const state = loadState(STATE_PATH)
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

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'state', payload: state }))

  socket.on('message', (raw) => {
    let message
    try {
      message = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (applyCommand(state, message)) {
      saveState(state, STATE_PATH)
      broadcast()
    }
  })
})

startPolling(state, {
  url: config.stageUrl,
  interval: config.pollInterval,
  onUpdate: () => { saveState(state, STATE_PATH); broadcast() },
})

server.listen(config.port, () => {
  console.log(`[mg] этап ${config.stageId} — ${config.stageUrl}`)
  console.log(`[mg] оверлей  http://localhost:${config.port}/overlay`)
  console.log(`[mg] пульт    http://localhost:${config.port}/control`)
})
