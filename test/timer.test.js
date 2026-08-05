import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseReading, nextTimer, formatMs, pollTimerOnce } from '../server/timer.js'
import { parseTimeToSeconds } from '../app/src/shared/format.js'

// Запись живых заездов с прибора, снятая 05.08.2026: строки вида
// «<время получения> <показание>». Пустые показания в ней тоже есть —
// прибор изредка не отвечает, и это часть проверяемого поведения.
const capture = readFileSync(new URL('./fixtures/timer-run.txt', import.meta.url), 'utf-8')
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [t, reading] = line.split(' ')
    return { at: Math.round(Number(t) * 1000), reading: reading ?? '' }
  })

const ok = (body) => async () => ({ ok: true, status: 200, text: async () => body })

describe('parseReading', () => {
  it('разбирает показание в покое', () => {
    expect(parseReading('1019718')).toEqual({ beam: true, running: false, ms: 19718 })
  })

  it('разбирает показание на ходу', () => {
    expect(parseReading('113070')).toEqual({ beam: true, running: true, ms: 3070 })
  })

  it('разбирает момент старта, когда ct умещается в один символ', () => {
    expect(parseReading('110')).toEqual({ beam: true, running: true, ms: 0 })
  })

  it('видит перекрытый луч', () => {
    expect(parseReading('01162')).toEqual({ beam: false, running: true, ms: 162 })
    expect(parseReading('005199')).toEqual({ beam: false, running: false, ms: 5199 })
  })

  it('пустой ответ — не показание', () => {
    expect(parseReading('')).toBeNull()
    expect(parseReading(null)).toBeNull()
    expect(parseReading('   ')).toBeNull()
  })

  it('слишком короткий ответ — не показание', () => {
    expect(parseReading('1')).toBeNull()
    expect(parseReading('10')).toBeNull()
  })

  it('не цифры — не показание', () => {
    expect(parseReading('<html>')).toBeNull()
    expect(parseReading('11abc')).toBeNull()
  })
})

describe('formatMs', () => {
  it('печатает в том же виде, что и время протокола', () => {
    expect(formatMs(10270)).toBe('00:10.270')
    expect(formatMs(5199)).toBe('00:05.199')
    expect(formatMs(83721)).toBe('01:23.721')
    expect(formatMs(0)).toBe('00:00.000')
  })

  // Строку читает кадр — через parseTimeToSeconds из общего модуля.
  // Разъедутся форматы, и на финише в кадре будет пусто.
  it('читается разбором на стороне кадра', () => {
    expect(parseTimeToSeconds(formatMs(83721))).toBeCloseTo(83.721, 3)
    expect(parseTimeToSeconds(formatMs(10270))).toBeCloseTo(10.27, 3)
  })
})

describe('nextTimer', () => {
  const run = (ms) => ({ beam: true, running: true, ms })
  const stop = (ms) => ({ beam: true, running: false, ms })

  it('на пустом месте прибор в покое даёт idle, а не финиш', () => {
    // В покое ct держит прошлый результат. Принять его за свежий финиш
    // значило бы подписать чужое время под текущим спортсменом.
    const t = nextTimer(null, stop(19718), 1000)
    expect(t.phase).toBe('idle')
    expect(t.time).toBeNull()
  })

  it('старт задаёт точку отсчёта в наших часах', () => {
    const t = nextTimer(null, run(162), 10_000)
    expect(t.phase).toBe('running')
    expect(t.startedAt).toBe(9838)
  })

  it('держит самую раннюю оценку точки старта', () => {
    // Задержка сети может сдвинуть оценку только в одну сторону — сделать
    // её позже истины. Значит, лучшая из оценок и есть истина.
    let t = nextTimer(null, run(1000), 10_000)     // старт = 9000
    t = nextTimer(t, run(2000), 11_500)            // старт = 9500, хуже
    expect(t.startedAt).toBe(9000)

    t = nextTimer(t, run(3000), 11_900)            // старт = 8900, лучше
    expect(t.startedAt).toBe(8900)
  })

  it('остановка после хода — это финиш с временем прибора', () => {
    let t = nextTimer(null, run(3000), 10_000)
    t = nextTimer(t, stop(10270), 17_000)

    expect(t.phase).toBe('finished')
    expect(t.time).toBe('00:10.270')
  })

  it('финиш держится, пока прибор стоит', () => {
    let t = nextTimer(null, run(3000), 10_000)
    t = nextTimer(t, stop(10270), 17_000)
    t = nextTimer(t, stop(10270), 20_000)

    expect(t.phase).toBe('finished')
    expect(t.time).toBe('00:10.270')
    expect(t.updatedAt).toBe(20_000)
  })

  it('новый заезд после финиша считает точку старта заново', () => {
    let t = nextTimer(null, run(3000), 10_000)
    t = nextTimer(t, stop(10270), 17_000)
    t = nextTimer(t, run(200), 30_000)

    expect(t.phase).toBe('running')
    expect(t.startedAt).toBe(29_800)
    expect(t.time).toBeNull()
  })

  it('пропущенная остановка не тянет старый отсчёт в новый заезд', () => {
    // Прибор не даёт стартовать раньше, чем через stopDelay (1650 мс),
    // так что скачок точки старта больше секунды — это новый заезд,
    // а не дрожание сети: то не превышало 600 мс.
    let t = nextTimer(null, run(1000), 10_000)     // старт = 9000
    t = nextTimer(t, run(300), 20_000)             // прибор перезапустился

    expect(t.startedAt).toBe(19_700)
  })

  it('пустое показание не трогает состояние и не обновляет метку', () => {
    const t = nextTimer(null, run(1000), 10_000)
    const same = nextTimer(t, null, 11_000)

    expect(same).toEqual(t)
    expect(same.updatedAt).toBe(10_000)
  })

  it('обнулённые снаружи показания не воскрешают прошлый финиш', () => {
    // Смена райдера ставит state.timer в null (server/state.js). Опрос
    // обязан начать с чистого листа, а не дописать туда старое время.
    let t = nextTimer(null, run(3000), 10_000)
    t = nextTimer(t, stop(10270), 17_000)

    const afterReset = nextTimer(null, stop(10270), 18_000)
    expect(afterReset.phase).toBe('idle')
    expect(afterReset.time).toBeNull()
  })
})

describe('запись живого заезда', () => {
  const replay = () => {
    const out = []
    let timer = null
    for (const { at, reading } of capture) {
      const before = timer
      timer = nextTimer(timer, parseReading(reading), at)
      if (before?.phase !== timer?.phase) out.push({ at, ...timer })
    }
    return out
  }

  it('находит все три заезда с их временем', () => {
    const finishes = replay().filter(x => x.phase === 'finished')

    // Третий — длиной ровно в мёртвую зону датчика (stopDelay 1650 мс):
    // луч перекрыли и держали, прибор перезарядился и остановился сам.
    expect(finishes.map(x => x.time)).toEqual(['00:10.270', '00:05.199', '00:01.660'])
  })

  it('начинает с покоя, хотя на табло висит прошлый результат', () => {
    expect(replay()[0].phase).toBe('idle')
  })

  it('пропуски ответа не рвут заезд на несколько', () => {
    // В записи прибор молчит десятки раз. Прими опрос молчание за остановку —
    // и один заезд рассыпался бы на цепочку ложных финишей.
    const empty = capture.filter(x => !parseReading(x.reading)).length
    expect(empty).toBeGreaterThan(10)

    expect(replay().filter(x => x.phase === 'finished')).toHaveLength(3)
  })

  it('точка старта внутри заезда держится в пределах дрожания сети', () => {
    // Уползёт — и цифра в кадре прыгнет назад, что в эфире читается
    // как поломка.
    //
    // Оговорка к фикстуре: время в ней снято ПЕРЕД запросом, а не по приходу
    // ответа, поэтому оценки смещены на задержку в раннюю сторону. Разброс
    // от этого только шире настоящего — проверке это не мешает.
    const runs = []
    let timer = null
    let current = null

    for (const { at, reading } of capture) {
      const was = timer?.phase
      timer = nextTimer(timer, parseReading(reading), at)
      if (timer?.phase !== 'running') continue

      if (was !== 'running') { current = []; runs.push(current) }
      current.push(timer.startedAt)
    }

    expect(runs).toHaveLength(3)
    for (const starts of runs) {
      expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(700)
    }
  })
})

describe('pollTimerOnce', () => {
  it('заполняет показания из ответа прибора', async () => {
    const state = { timer: null }
    const changed = await pollTimerOnce(state, {
      url: 'http://x/laptime', fetchImpl: ok('113070'), now: () => 10_000,
    })

    expect(changed).toBe(true)
    expect(state.timer.phase).toBe('running')
    expect(state.timer.updatedAt).toBe(10_000)
  })

  it('сетевая ошибка не роняет процесс и не трогает показания', async () => {
    const state = { timer: { phase: 'running', startedAt: 1, time: null, updatedAt: 2 } }
    const changed = await pollTimerOnce(state, {
      url: 'http://x/laptime',
      fetchImpl: async () => { throw new Error('ECONNREFUSED') },
    })

    expect(changed).toBe(false)
    expect(state.timer.updatedAt).toBe(2)
  })

  it('мусор в ответе не трогает показания', async () => {
    const state = { timer: null }
    const changed = await pollTimerOnce(state, {
      url: 'http://x/laptime', fetchImpl: ok('<html>роутер</html>'), now: () => 10_000,
    })

    expect(changed).toBe(false)
    expect(state.timer).toBeNull()
  })
})
