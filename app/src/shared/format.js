export function parseTimeToSeconds(value) {
  if (!value) return null
  const match = String(value).match(/^(\d+):(\d+)\.(\d+)$/)
  if (!match) return null
  const [, mm, ss, frac] = match
  return Number(mm) * 60 + Number(ss) + Number(`0.${frac}`)
}

export function formatDelta(seconds) {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds === 0) return '—'
  return `+${seconds.toFixed(2)}`
}

// Лучшее время берём готовым с сайта: расходиться с официальным
// протоколом в прямом эфире недопустимо. Считаем сами только когда
// сайт значение ещё не проставил.
export function bestOf(participant) {
  if (participant.bestTime) return participant.bestTime

  let best = null
  for (const attempt of participant.attempts || []) {
    const time = parseTimeToSeconds(attempt.time)
    if (time === null) continue
    const total = time + (attempt.penalty || 0)
    if (best === null || total < best.total) best = { total, label: attempt.time }
  }
  return best ? best.label : null
}

export function groupByClass(participants) {
  const groups = []
  const index = new Map()

  for (const rider of participants) {
    const name = rider.sportClass || 'Без класса'
    if (!index.has(name)) {
      index.set(name, { sportClass: name, classColor: rider.classColor, riders: [] })
      groups.push(index.get(name))
    }
    index.get(name).riders.push(rider)
  }
  return groups
}

export function topOfClass(participants, sportClass, limit = 5) {
  return participants
    .filter(p => (p.sportClass || 'Без класса') === sportClass)
    .sort((a, b) => (a.placeInClass ?? Infinity) - (b.placeInClass ?? Infinity))
    .slice(0, limit)
}

export function secondsSince(timestamp) {
  if (!timestamp) return null
  return Math.floor((Date.now() - timestamp) / 1000)
}
