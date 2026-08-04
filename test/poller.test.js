import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { pollOnce } from '../server/poller.js'
import { createDefaultState, applyParticipants } from '../server/state.js'

const html670 = readFileSync(new URL('./fixtures/stage670.html', import.meta.url), 'utf-8')
const ok = (body) => async () => ({ ok: true, status: 200, text: async () => body })

describe('pollOnce', () => {
  it('заполняет участников из ответа сайта', async () => {
    const s = createDefaultState()
    const result = await pollOnce(s, { url: 'http://x', fetchImpl: ok(html670) })

    expect(result).toBe(true)
    expect(s.participants).toHaveLength(22)
  })

  it('сетевая ошибка не роняет процесс и не трогает данные', async () => {
    const s = createDefaultState()
    applyParticipants(s, [{ id: '1', fio: 'Был', attempts: [] }])

    const result = await pollOnce(s, {
      url: 'http://x',
      fetchImpl: async () => { throw new Error('ECONNREFUSED') },
    })

    expect(result).toBe(false)
    expect(s.participants).toHaveLength(1)
    expect(s.participants[0].fio).toBe('Был')
  })

  it('ответ 500 не трогает данные', async () => {
    const s = createDefaultState()
    applyParticipants(s, [{ id: '1', fio: 'Был', attempts: [] }])

    const result = await pollOnce(s, {
      url: 'http://x',
      fetchImpl: async () => ({ ok: false, status: 500, text: async () => '' }),
    })

    expect(result).toBe(false)
    expect(s.participants).toHaveLength(1)
  })

  it('сломанная вёрстка не трогает данные', async () => {
    const s = createDefaultState()
    applyParticipants(s, [{ id: '1', fio: 'Был', attempts: [] }])

    const result = await pollOnce(s, { url: 'http://x', fetchImpl: ok('<html>другой сайт</html>') })

    expect(result).toBe(false)
    expect(s.participants).toHaveLength(1)
  })

  it('отмечает время последнего успешного опроса', async () => {
    const s = createDefaultState()
    await pollOnce(s, { url: 'http://x', fetchImpl: ok(html670) })
    expect(s.lastSuccessfulPoll).toBeGreaterThan(0)
  })
})
