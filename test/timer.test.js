import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseReading, nextTimer, formatMs, pollTimerOnce, nextLink } from '../server/timer.js'
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

  // Прибор опрашивают трижды в секунду, поэтому заезд идёт цепочкой
  // показаний, а не двумя точками: с дырами в наблюдении разговор особый,
  // он ниже.
  const untilStop = (from, to) => {
    let t = nextTimer(null, run(3000), from)
    for (let at = from + 300; at < to; at += 300) t = nextTimer(t, run(3000 + at - from), at)
    return t
  }

  it('остановка после хода — это финиш с временем прибора', () => {
    let t = untilStop(10_000, 17_000)
    t = nextTimer(t, stop(10270), 17_000)

    expect(t.phase).toBe('finished')
    expect(t.time).toBe('00:10.270')
  })

  it('финиш держится, пока прибор стоит', () => {
    let t = untilStop(10_000, 17_000)
    t = nextTimer(t, stop(10270), 17_000)
    t = nextTimer(t, stop(10270), 20_000)

    expect(t.phase).toBe('finished')
    expect(t.time).toBe('00:10.270')
    expect(t.updatedAt).toBe(20_000)
  })

  it('новый заезд после финиша считает точку старта заново', () => {
    let t = untilStop(10_000, 17_000)
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

  // Переход «ход → покой» достоверен только при непрерывном наблюдении.
  // Прибор мог пропасть из сети посреди заезда и вернуться перезагруженным
  // по питанию — с обнулённым табло. Объявить это финишем значило бы
  // подписать «00:00.000» под именем спортсмена, который трассу прошёл.
  it('после дыры в связи финиш не объявляется — что было на трассе, неизвестно', () => {
    let t = nextTimer(null, run(3000), 10_000)
    for (let at = 10_300; at < 18_000; at += 300) t = nextTimer(t, null, at)

    t = nextTimer(t, stop(0), 18_000)
    expect(t.phase).toBe('idle')
    expect(t.time).toBeNull()
  })

  it('короткий пропуск финиша не отменяет — прибор молчит через раз штатно', () => {
    let t = nextTimer(null, run(3000), 10_000)
    t = nextTimer(t, null, 10_300)
    t = nextTimer(t, stop(10270), 10_600)

    expect(t.phase).toBe('finished')
    expect(t.time).toBe('00:10.270')
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

// Прибор может уехать из сети незаметно: его выключили, унесли, роутер
// площадки перезагрузился. Опросчик молчит об этом намеренно — жалоба на
// каждый неудачный запрос залила бы журнал за день. Значит связь надо
// держать отдельным признаком: без него пропажу прибора видно только по
// кадру, где зона времени тихо возвращается ко времени первой попытки.
describe('связь с прибором', () => {
  it('первое разобранное показание — прибор на связи', () => {
    expect(nextLink(null, { ok: true, at: 1000 })).toEqual({ online: true, seenAt: 1000 })
  })

  // Первый запрос уходит в ту же секунду, что и запуск сервера. Объявить
  // прибор пропавшим по одному неответу значило бы пугать оператора там,
  // где прибор просто не успел ответить.
  it('первый неответ — ещё не приговор', () => {
    expect(nextLink(null, { ok: false, at: 1000 }).online).toBe(null)
  })

  // Самая частая беда дня: в event.config.js остался адрес прошлой сети.
  // Прибор при этом не «пропал» — он не отвечал ни разу, и сказать об этом
  // надо ровно так же.
  it('молчащий с самого запуска прибор признаётся недоступным', () => {
    const waiting = nextLink(null, { ok: false, at: 1000 })
    expect(nextLink(waiting, { ok: false, at: 4000 }).online).toBe(false)
  })

  // Прибор не отвечает примерно на один запрос из ста — это его норма.
  it('одиночный пропуск связь не рвёт', () => {
    const link = nextLink({ online: true, seenAt: 1000 }, { ok: false, at: 1300 })
    expect(link.online).toBe(true)
  })

  it('три секунды тишины — это уже пропажа', () => {
    const link = nextLink({ online: true, seenAt: 1000 }, { ok: false, at: 4000 })
    expect(link.online).toBe(false)
  })

  it('вернувшийся прибор снова на связи', () => {
    const link = nextLink({ online: false, seenAt: 1000 }, { ok: true, at: 9000 })
    expect(link).toEqual({ online: true, seenAt: 9000 })
  })
})

describe('pollTimerOnce', () => {
  it('перемену связи разносит как и показания — иначе пульт о ней не узнает', async () => {
    const state = { timer: null, timerLink: { online: true, seenAt: 1000 } }
    const changed = await pollTimerOnce(state, {
      url: 'http://x/laptime',
      fetchImpl: async () => { throw new Error('ECONNREFUSED') },
      now: () => 5000,
    })

    expect(changed).toBe(true)
    expect(state.timerLink.online).toBe(false)
  })

  it('о приборе, молчащем с запуска, пульт тоже узнаёт', async () => {
    const state = { timer: null, timerLink: { online: null, seenAt: 1000 } }
    const changed = await pollTimerOnce(state, {
      url: 'http://x/laptime',
      fetchImpl: async () => { throw new Error('EHOSTUNREACH') },
      now: () => 4000,
    })

    expect(changed).toBe(true)
    expect(state.timerLink.online).toBe(false)
  })

  // Точку старта считают от момента, когда показание получено, а не когда
  // запрос ушёл: задержка сети обязана сдвигать оценку в позднюю сторону,
  // иначе самая ранняя из оценок перестаёт быть истиной и отсчёт в кадре
  // идёт впереди прибора.
  it('точку старта считает от момента ответа, а не от момента запроса', async () => {
    let clock = 1000
    const slowFetch = async () => {
      clock += 200
      return { ok: true, status: 200, text: async () => '11200' }
    }

    const state = { timer: null, timerLink: null }
    await pollTimerOnce(state, { url: 'http://x/laptime', fetchImpl: slowFetch, now: () => clock })

    expect(state.timer.startedAt).toBe(1000)
  })

  it('пока прибор отвечает, связь держится', async () => {
    const state = { timer: null, timerLink: null }
    await pollTimerOnce(state, { url: 'http://x/laptime', fetchImpl: ok('1019718'), now: () => 10_000 })

    expect(state.timerLink).toEqual({ online: true, seenAt: 10_000 })
  })

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
