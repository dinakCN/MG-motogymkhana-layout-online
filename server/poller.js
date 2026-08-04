import { parseStage } from './parser.js'
import { applyParticipants } from './state.js'

export async function pollOnce(state, { url, fetchImpl = fetch }) {
  let html
  try {
    const response = await fetchImpl(url, { headers: { 'User-Agent': 'mg-overlay/1.0' } })
    if (!response.ok) {
      console.error(`[poller] HTTP ${response.status}, пропускаем итерацию`)
      return false
    }
    html = await response.text()
  } catch (err) {
    console.error('[poller] сеть недоступна:', err.message)
    return false
  }

  let participants
  try {
    participants = parseStage(html)
  } catch (err) {
    console.error('[poller] разбор не удался:', err.message)
    return false
  }

  return applyParticipants(state, participants)
}

export function startPolling(state, { url, interval, onUpdate, fetchImpl = fetch }) {
  let stopped = false

  const tick = async () => {
    if (stopped) return
    const updated = await pollOnce(state, { url, fetchImpl })
    if (updated && onUpdate) onUpdate(state)
    if (!stopped) setTimeout(tick, interval)
  }

  tick()
  return () => { stopped = true }
}
