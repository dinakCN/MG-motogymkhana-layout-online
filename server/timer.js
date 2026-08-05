// Опрос секундомера MG StopWatcher — прибора на ESP, который стоит на трассе
// и отдаёт показания по локальной сети. Устройство прибора, формат ответа
// и обоснование решений — docs/superpowers/plans/2026-08-04-timer-bridge.md.
//
// Здесь нет ничего про кадр: модуль заполняет state.timer по контракту,
// а как это показать, решает app/src/overlay/RunTime.vue.

// Ответ прибора — одна строка без разделителей: луч, ход, миллисекунды.
//
//   1019718  →  луч цел, заезд стоит, на табло 19.718 с
//   110      →  луч цел, заезд идёт, только что стартовал
//   005199   →  луч перекрыт, заезд стоит, результат 5.199 с
//
// Длина переменная: на старте ct умещается в один символ. Поэтому берём
// «всё начиная с третьего», а не фиксированные позиции.
const READING_RE = /^(\d)(\d)(\d+)$/

export function parseReading(text) {
  const raw = String(text ?? '').trim()
  const match = raw.match(READING_RE)
  if (!match) return null

  const [, beam, running, ms] = match
  return { beam: beam === '1', running: running === '1', ms: Number(ms) }
}

// Время в том же виде, в каком его печатает протокол, — его читает кадр
// через parseTimeToSeconds. Прибор считает в миллисекундах, поэтому знаков
// после точки три: приписать четвёртый значило бы заявить точность,
// которой в исходных данных нет.
export function formatMs(ms) {
  const total = Math.max(0, Math.round(ms))
  const mm = String(Math.floor(total / 60000)).padStart(2, '0')
  const ss = String(Math.floor(total / 1000) % 60).padStart(2, '0')
  const frac = String(total % 1000).padStart(3, '0')

  return `${mm}:${ss}.${frac}`
}

// Скачок точки старта вперёд больше чем на секунду — это новый заезд,
// а не дрожание сети. Прибор не даёт стартовать раньше, чем через stopDelay
// (1650 мс по конфигу), а наблюдавшееся дрожание не превышало 600 мс.
// Между этими числами и проходит граница.
const RESTART_JUMP = 1000

// Чистый шаг: прошлые показания, новое показание и момент его получения.
// Вся память живёт в самих показаниях, поэтому обнуление state.timer
// снаружи (смена райдера) начинает счёт с чистого листа само собой.
export function nextTimer(prev, reading, receivedAt) {
  // Прибор не ответил. Метку не двигаем: через две секунды кадр сочтёт
  // показания протухшими и уберёт цифры сам — так и задумано.
  if (!reading) return prev

  if (reading.running) {
    const candidate = receivedAt - reading.ms

    // Задержка сети может сдвинуть оценку только в одну сторону — сделать
    // её позже истины. Значит, самая ранняя из оценок и есть истина.
    const keepPrevious = prev?.phase === 'running'
      && prev.startedAt !== null
      && candidate - prev.startedAt < RESTART_JUMP

    return {
      phase: 'running',
      startedAt: keepPrevious ? Math.min(prev.startedAt, candidate) : candidate,
      time: null,
      updatedAt: receivedAt,
    }
  }

  // Прибор стоит. Финиш ставим только по наблюдённому переходу: в покое
  // ct держит прошлый результат, и принять его за свежий финиш значило бы
  // подписать чужое время под текущим спортсменом.
  if (prev?.phase === 'running') {
    return {
      phase: 'finished',
      startedAt: prev.startedAt,
      time: formatMs(reading.ms),
      updatedAt: receivedAt,
    }
  }

  if (prev?.phase === 'finished') {
    return { ...prev, updatedAt: receivedAt }
  }

  return { phase: 'idle', startedAt: null, time: null, updatedAt: receivedAt }
}

// Ответ прибора — десяток байт, и ждать его дольше интервала опроса
// бессмысленно: следующий запрос всё равно принесёт свежее показание.
const REQUEST_TIMEOUT = 1000

export async function pollTimerOnce(state, { url, fetchImpl = fetch, now = Date.now }) {
  let text
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) })
    if (!response.ok) return false
    text = await response.text()
  } catch {
    // Молчим намеренно. Прибор не отвечает примерно на один запрос из ста,
    // и жалоба на каждый залила бы журнал за день эфира.
    return false
  }

  const reading = parseReading(text)
  if (!reading) return false

  state.timer = nextTimer(state.timer, reading, now())
  return true
}

export function startTimerPolling(state, { url, interval, onUpdate, fetchImpl = fetch }) {
  let stopped = false

  // Следующая итерация назначается в finally — по той же причине, что
  // и в poller.js: неожиданная ошибка в рассылке не должна тихо остановить
  // опрос на весь день.
  const tick = async () => {
    if (stopped) return
    try {
      const updated = await pollTimerOnce(state, { url, fetchImpl })
      if (updated && onUpdate) onUpdate(state)
    } catch (err) {
      console.error('[timer] непредвиденный сбой итерации:', err.message)
    } finally {
      if (!stopped) setTimeout(tick, interval)
    }
  }

  tick()
  return () => { stopped = true }
}
