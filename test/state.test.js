import { describe, it, expect } from 'vitest'
import { rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { bestOf } from '../app/src/shared/format.js'
import { UNGROUPED, podiumOf } from '../app/src/shared/awardGroups.js'
import { DNS } from '../app/src/shared/riderStatus.js'
import { createDefaultState, applyParticipants, applyCommand, saveState, loadState, normalizeOverride, syncAwardSubject, syncTrackScene, clearStaleHighlight, applyServerConfig, UNGROUPED as SERVER_UNGROUPED, PODIUM_PLACES, RIDER_STATUSES } from '../server/state.js'

const rider = (id, fio) => ({
  id, athleteId: id, sportClass: 'C3', classColor: 'green', number: 28,
  fio, city: 'Бердск', motorcycle: 'Triumph', attempts: [], bestTime: null,
  placeInClass: null, placeOverall: null, rating: null,
})

describe('состояние по умолчанию', () => {
  it('стартует с таблицы и первого раунда', () => {
    const s = createDefaultState()
    expect(s.activeScene).toBe('results')
    expect(s.round).toBe('round1')
    expect(s.participants).toEqual([])
    expect(s.highlight.visible).toBe(false)
  })
})

describe('applyParticipants', () => {
  it('принимает свежий список', () => {
    const s = createDefaultState()
    expect(applyParticipants(s, [rider('1', 'Болдов Иван')])).toBe(true)
    expect(s.participants).toHaveLength(1)
    expect(s.lastSuccessfulPoll).toBeGreaterThan(0)
  })

  it('НЕ затирает данные при null — сбой сети не должен гасить кадр', () => {
    const s = createDefaultState()
    applyParticipants(s, [rider('1', 'Болдов Иван')])
    const stamp = s.lastSuccessfulPoll

    expect(applyParticipants(s, null)).toBe(false)
    expect(s.participants).toHaveLength(1)
    expect(s.lastSuccessfulPoll).toBe(stamp)
  })

  it('НЕ затирает непустой список пустым — сломанный парсинг не гасит кадр', () => {
    const s = createDefaultState()
    applyParticipants(s, [rider('1', 'Болдов Иван')])

    expect(applyParticipants(s, [])).toBe(false)
    expect(s.participants).toHaveLength(1)
  })

  it('пустой список принимается, если участников ещё не было', () => {
    const s = createDefaultState()
    expect(applyParticipants(s, [])).toBe(true)
  })
})

describe('applyCommand', () => {
  it('переключает сцену', () => {
    const s = createDefaultState()
    expect(applyCommand(s, { type: 'setActiveScene', payload: 'run' })).toBe(true)
    expect(s.activeScene).toBe('run')
  })

  it('принимает заставку как полноценную сцену', () => {
    const s = createDefaultState()
    expect(applyCommand(s, { type: 'setActiveScene', payload: 'idle' })).toBe(true)
    expect(s.activeScene).toBe('idle')
  })

  it('отвергает несуществующую сцену', () => {
    const s = createDefaultState()
    expect(applyCommand(s, { type: 'setActiveScene', payload: 'нет-такой' })).toBe(false)
    expect(s.activeScene).toBe('results')
  })

  it('задаёт текущий заезд', () => {
    const s = createDefaultState()
    applyCommand(s, { type: 'setCurrentRun', payload: { participantId: '42', attemptLabel: 'Попытка 2', caption: 'дебют' } })
    expect(s.currentRun.participantId).toBe('42')
    expect(s.currentRun.caption).toBe('дебют')
  })

  it('показывает и скрывает хайлайт', () => {
    const s = createDefaultState()
    applyCommand(s, { type: 'showHighlight', payload: { participantId: '42', caption: 'Лучшее время дня' } })
    expect(s.highlight.visible).toBe(true)
    applyCommand(s, { type: 'hideHighlight' })
    expect(s.highlight.visible).toBe(false)
  })

  it('запоминает сцену возврата — иначе после хайлайта кадр опустеет', () => {
    const s = createDefaultState()
    applyCommand(s, { type: 'setActiveScene', payload: 'run' })
    applyCommand(s, { type: 'showHighlight', payload: { participantId: '42' } })
    applyCommand(s, { type: 'setActiveScene', payload: 'highlight' })

    expect(s.highlight.returnScene).toBe('run')
  })

  it('повторный показ поверх хайлайта не делает точкой возврата сам хайлайт', () => {
    const s = createDefaultState()
    applyCommand(s, { type: 'setActiveScene', payload: 'run' })
    applyCommand(s, { type: 'showHighlight', payload: { participantId: '42' } })
    applyCommand(s, { type: 'setActiveScene', payload: 'highlight' })
    applyCommand(s, { type: 'showHighlight', payload: { participantId: '43' } })

    expect(s.highlight.returnScene).toBe('run')
  })

  it('переключает момент дня и отвергает неизвестный', () => {
    const s = createDefaultState()
    expect(applyCommand(s, { type: 'setRound', payload: 'break1' })).toBe(true)
    expect(s.round).toBe('break1')
    expect(applyCommand(s, { type: 'setRound', payload: 'обед' })).toBe(false)
    expect(s.round).toBe('break1')
  })

  it('правит одну ячейку результата аварийно', () => {
    const s = createDefaultState()
    applyParticipants(s, [rider('1', 'Болдов Иван')])
    s.participants[0].attempts = [{ n: 1, time: null, penalty: null }]

    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'time', value: '00:42.31' } })
    expect(s.participants[0].attempts[0].time).toBe('00:42.31')
  })

  it('аварийная правка не трогает поля вне времени и штрафа', () => {
    const s = createDefaultState()
    applyParticipants(s, [rider('1', 'Болдов Иван')])
    s.participants[0].attempts = [{ n: 1, time: null, penalty: null }]

    expect(applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'fio', value: 'взлом' } })).toBe(false)
    expect(s.participants[0].fio).toBe('Болдов Иван')
  })

  it('правка переживает следующий опрос — иначе она бесполезна', () => {
    const s = createDefaultState()
    const withAttempts = () => {
      const r = rider('1', 'Болдов Иван')
      r.attempts = [{ n: 1, time: '00:99.99', penalty: null }]
      return r
    }

    applyParticipants(s, [withAttempts()])
    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'time', value: '00:42.31' } })
    expect(s.participants[0].attempts[0].time).toBe('00:42.31')

    // опросчик принёс свежие данные с сайта — правка должна устоять
    applyParticipants(s, [withAttempts()])
    expect(s.participants[0].attempts[0].time).toBe('00:42.31')
  })

  // Правку снимают, когда она оказалась ошибочной и висит в эфире.
  // Ждать следующего опроса в этот момент — семь секунд неверных данных.
  it('снятие правки возвращает значение сайта сразу, не дожидаясь опроса', () => {
    const s = createDefaultState()
    applyParticipants(s, [rider('1', 'Болдов Иван')])
    s.participants[0].attempts = [{ n: 1, time: '01:24.16', penalty: 2 }]

    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'time', value: '01:19.80' } })
    expect(s.participants[0].attempts[0].time).toBe('01:19.80')

    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'time', value: '' } })
    expect(s.participants[0].attempts[0].time).toBe('01:24.16')
    expect(s.overrides).toEqual({})
    expect(s.originals).toEqual({})
  })

  it('откат идёт к данным сайта, а не к забракованной промежуточной правке', () => {
    const s = createDefaultState()
    applyParticipants(s, [rider('1', 'Болдов Иван')])
    s.participants[0].attempts = [{ n: 1, time: '01:24.16', penalty: 2 }]

    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'time', value: '01:19.80' } })
    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'time', value: '01:18.10' } })
    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'time', value: '' } })

    expect(s.participants[0].attempts[0].time).toBe('01:24.16')
  })

  it('снятие правки с попытки, которой на сайте не было, очищает значение', () => {
    const s = createDefaultState()
    applyParticipants(s, [rider('1', 'Болдов Иван')])
    s.participants[0].attempts = [{ n: 1, time: '01:24.16', penalty: 2 }]

    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 2, field: 'time', value: '01:19.80' } })
    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 2, field: 'time', value: '' } })

    expect(s.participants[0].attempts.find(a => a.n === 2).time).toBeNull()
  })

  it('пустое значение снимает правку и возвращает данные сайта', () => {
    const s = createDefaultState()
    const withAttempts = () => {
      const r = rider('1', 'Болдов Иван')
      r.attempts = [{ n: 1, time: '00:99.99', penalty: null }]
      return r
    }

    applyParticipants(s, [withAttempts()])
    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'time', value: '00:42.31' } })
    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'time', value: '' } })

    applyParticipants(s, [withAttempts()])
    expect(s.participants[0].attempts[0].time).toBe('00:99.99')
  })

  it('заводит попытку, которой ещё нет на сайте — ради этого правка и нужна', () => {
    const s = createDefaultState()
    applyParticipants(s, [rider('1', 'Болдов Иван')])
    s.participants[0].attempts = [{ n: 1, time: '00:42.31', penalty: null }]

    expect(applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 2, field: 'time', value: '00:41.10' } })).toBe(true)
    expect(s.participants[0].attempts).toHaveLength(2)
    expect(s.participants[0].attempts[1]).toMatchObject({ n: 2, time: '00:41.10' })
  })

  it('правка второй попытки держится и после опроса, где её ещё нет', () => {
    const s = createDefaultState()
    const fromSite = () => {
      const r = rider('1', 'Болдов Иван')
      r.attempts = [{ n: 1, time: '00:42.31', penalty: null }]
      return r
    }

    applyParticipants(s, [fromSite()])
    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 2, field: 'time', value: '00:41.10' } })
    applyParticipants(s, [fromSite()])

    expect(s.participants[0].attempts.find(a => a.n === 2)?.time).toBe('00:41.10')
  })

  it('снятие правки не заводит попытку, которой нет на сайте', () => {
    const s = createDefaultState()
    applyParticipants(s, [rider('1', 'Болдов Иван')])
    s.participants[0].attempts = [{ n: 1, time: '00:42.31', penalty: null }]

    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 2, field: 'time', value: '' } })
    expect(s.participants[0].attempts).toHaveLength(1)
  })

  it('правленый участник помечается — кадру нельзя доверять лучшему времени сайта', () => {
    const s = createDefaultState()
    const fromSite = () => {
      const r = rider('1', 'Болдов Иван')
      r.attempts = [{ n: 1, time: '01:24.16', penalty: 2 }]
      r.bestTime = '01:26.16'
      return r
    }

    applyParticipants(s, [fromSite()])
    expect(s.participants[0].corrected).toBeUndefined()

    // сразу, не дожидаясь следующего опроса: иначе семь секунд в кадре
    // висит исправленная попытка при старом «лучшем»
    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'time', value: '01:19.80' } })
    expect(s.participants[0].corrected).toBe(true)

    applyParticipants(s, [fromSite()])
    expect(s.participants[0].corrected).toBe(true)

    // правку сняли — пометка снимается тут же
    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'time', value: '' } })
    expect(s.participants[0].corrected).toBeUndefined()

    applyParticipants(s, [fromSite()])
    expect(s.participants[0].corrected).toBeUndefined()
  })

  // Незачёт — решение судей. Правка времени его не отменяет: иначе кадр
  // разошёлся бы с протоколом, а оператор об этом даже не узнал бы.
  it('правка времени не возвращает незачтённую попытку в зачёт', () => {
    const s = createDefaultState()
    const p = rider('1', 'Болдов Иван')
    p.attempts = [
      { n: 1, time: '03:47.90', penalty: 0, scratched: true },
      { n: 2, time: '02:43.86', penalty: 0 },
    ]
    applyParticipants(s, [p])

    applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'time', value: '01:20.00' } })

    expect(s.participants[0].attempts[0]).toMatchObject({ time: '01:20.00', scratched: true })
    expect(bestOf(s.participants[0])).toBe('02:43.86')
  })

  it('отвергает правку для неизвестного участника', () => {
    const s = createDefaultState()
    applyParticipants(s, [rider('1', 'Болдов Иван')])

    expect(applyCommand(s, { type: 'manualOverride', payload: { participantId: 'нет', attempt: 1, field: 'time', value: '00:42.31' } })).toBe(false)
  })

  it('игнорирует неизвестную команду', () => {
    const s = createDefaultState()
    expect(applyCommand(s, { type: 'что-то', payload: 1 })).toBe(false)
  })
})

// Правку набирают руками и в спешке. Значение, которое не разберётся
// дальше, осело бы в таблице строкой и выглядело результатом, не попадая
// при этом ни в лучшее время, ни в отставания.
describe('нормализация аварийной правки', () => {
  it('приводит время к виду протокола', () => {
    expect(normalizeOverride('time', '1:23.7')).toBe('01:23.70')
    expect(normalizeOverride('time', '01:23,72')).toBe('01:23.72')
    expect(normalizeOverride('time', ' 01:23.72 ')).toBe('01:23.72')
    expect(normalizeOverride('time', '1:2')).toBe('01:02.00')
  })

  it('сохраняет четыре знака — хронометраж точнее протокола', () => {
    expect(normalizeOverride('time', '01:23.7215')).toBe('01:23.7215')
    expect(normalizeOverride('time', '1:23,715')).toBe('01:23.715')
  })

  it('отвергает то, что не время', () => {
    expect(normalizeOverride('time', 'быстро')).toBeNull()
    expect(normalizeOverride('time', '83.72')).toBeNull()
    expect(normalizeOverride('time', '01:73.00')).toBeNull()
    expect(normalizeOverride('time', '')).toBeNull()
  })

  it('штраф — только целые секунды', () => {
    expect(normalizeOverride('penalty', '4')).toBe(4)
    expect(normalizeOverride('penalty', 0)).toBe(0)
    expect(normalizeOverride('penalty', '2.5')).toBeNull()
    expect(normalizeOverride('penalty', 'abc')).toBeNull()
    expect(normalizeOverride('penalty', -1)).toBeNull()
  })

  it('мусор не проходит через команду и не портит данные', () => {
    const s = createDefaultState()
    applyParticipants(s, [rider('1', 'Болдов Иван')])
    s.participants[0].attempts = [{ n: 1, time: '01:23.72', penalty: 0 }]

    expect(applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'time', value: 'быстро' } })).toBe(false)
    expect(applyCommand(s, { type: 'manualOverride', payload: { participantId: '1', attempt: 1, field: 'penalty', value: NaN } })).toBe(false)
    expect(s.participants[0].attempts[0]).toEqual({ n: 1, time: '01:23.72', penalty: 0 })
    expect(s.overrides).toEqual({})
  })
})

describe('сохранение и загрузка', () => {
  it('переживает перезапуск сервера', () => {
    const path = 'test/tmp-state.json'
    const s = createDefaultState()
    applyCommand(s, { type: 'setActiveScene', payload: 'award' })
    applyParticipants(s, [rider('1', 'Болдов Иван')])
    saveState(s, path)

    const restored = loadState(path)
    expect(restored.activeScene).toBe('award')
    expect(restored.participants).toHaveLength(1)

    rmSync(path, { force: true })
  })

  it('на отсутствующем файле отдаёт состояние по умолчанию', () => {
    expect(loadState('test/нет-такого.json').activeScene).toBe('results')
  })

  it('на битом JSON отдаёт состояние по умолчанию, а не падает', () => {
    const bad = 'test/tmp-bad.json'
    writeFileSync(bad, '{сломано')
    expect(loadState(bad).activeScene).toBe('results')
    rmSync(bad, { force: true })
    rmSync(`${bad}.broken`, { force: true })
  })

  // Файл состояния переписывается несколько тысяч раз за день эфира — после
  // каждой команды пульта и каждого удачного опроса. Обрыв ровно в момент
  // записи (крышка, разряд, kill) оставил бы половину JSON, и всё, что
  // оператор наработал за день, — правки и пометки групп — молча пропало бы.
  it('не трогает сохранённое состояние, если новая запись не удалась', () => {
    const path = 'test/tmp-atomic.json'
    // Упавший прогон оставляет папку-заглушку ниже; она сорвала бы и запись
    // первого состояния, и весь смысл проверки.
    rmSync(`${path}.tmp`, { recursive: true, force: true })

    const first = createDefaultState()
    applyCommand(first, { type: 'setActiveScene', payload: 'award' })
    saveState(first, path)

    // Занимаем путь временного файла папкой: записать в неё нельзя,
    // и это единственный способ увидеть сбой записи в тесте.
    mkdirSync(`${path}.tmp`, { recursive: true })

    const second = createDefaultState()
    applyCommand(second, { type: 'setActiveScene', payload: 'run' })
    saveState(second, path)

    expect(loadState(path).activeScene).toBe('award')

    rmSync(`${path}.tmp`, { recursive: true, force: true })
    rmSync(path, { force: true })
  })

  it('битый файл откладывает рядом — правки дня можно достать руками', () => {
    const bad = 'test/tmp-broken.json'
    writeFileSync(bad, '{"activeScene":"award","participants":[{"id":"1"')

    loadState(bad)

    expect(readFileSync(`${bad}.broken`, 'utf-8')).toContain('"activeScene":"award"')

    rmSync(`${bad}.broken`, { force: true })
    rmSync(bad, { force: true })
  })

  it('на отсутствующем файле копию не заводит — первый запуск не авария', () => {
    loadState('test/нет-такого.json')
    expect(existsSync('test/нет-такого.json.broken')).toBe(false)
  })

  it('добирает поля, которых не было в файле прошлой версии', () => {
    const old = 'test/tmp-old.json'
    writeFileSync(old, JSON.stringify({ activeScene: 'run', highlight: { visible: true } }))

    const restored = loadState(old)
    expect(restored.activeScene).toBe('run')
    expect(restored.highlight.visible).toBe(true)
    // поля не было в файле — берём значение по умолчанию, а не undefined
    expect(restored.highlight.returnScene).toBe('results')
    expect(restored.participants).toEqual([])

    rmSync(old, { force: true })
  })
})

const withGroups = () => {
  const s = createDefaultState()
  s.awardGroups = [
    { name: 'Любители', classes: ['D2', 'D3'] },
    { name: 'SB', classes: [] },
  ]
  applyParticipants(s, [rider('1', 'Болдов Иван'), rider('2', 'Петров Илья')])
  return s
}

describe('setAward', () => {
  it('принимает группу из справочника', () => {
    const s = withGroups()
    expect(applyCommand(s, { type: 'setAward', payload: { subject: 'Любители', place: 2 } })).toBe(true)
    expect(s.award.subject).toBe('Любители')
    expect(s.award.place).toBe(2)
  })

  it('принимает «Вне групп» — аномалию тоже нужно показать', () => {
    const s = withGroups()
    expect(applyCommand(s, { type: 'setAward', payload: { subject: UNGROUPED } })).toBe(true)
    expect(s.award.subject).toBe(UNGROUPED)
  })

  it('принимает сброс выбора', () => {
    const s = withGroups()
    applyCommand(s, { type: 'setAward', payload: { subject: 'Любители' } })
    expect(applyCommand(s, { type: 'setAward', payload: { subject: null } })).toBe(true)
    expect(s.award.subject).toBe(null)
  })

  // Место 99 сервер принимал молча, и кадр показывал «призёры появятся,
  // когда будут результаты» при том, что результаты есть.
  it('отвергает место, которого нет на подиуме', () => {
    const s = withGroups()
    applyCommand(s, { type: 'setAward', payload: { subject: 'Любители', place: 2 } })

    for (const place of [0, -1, 99, PODIUM_PLACES + 1, 1.5, '2', 'первое', NaN]) {
      expect(applyCommand(s, { type: 'setAward', payload: { subject: 'Любители', place } }), String(place)).toBe(false)
    }
    expect(s.award.place).toBe(2)
  })

  it('принимает все места подиума и пустое место как первое', () => {
    const s = withGroups()

    for (let place = 1; place <= PODIUM_PLACES; place += 1) {
      expect(applyCommand(s, { type: 'setAward', payload: { subject: 'Любители', place } })).toBe(true)
      expect(s.award.place).toBe(place)
    }

    // Пустое место — «не задано», а не ошибка: пульт присылает его,
    // когда переключает группу, не трогая выбор места.
    for (const place of [undefined, null]) {
      expect(applyCommand(s, { type: 'setAward', payload: { subject: 'Любители', place } })).toBe(true)
      expect(s.award.place).toBe(1)
    }
  })

  // Сервер валидирует место, призёров отбирает клиентский модуль — эти
  // два числа обязаны совпадать, иначе третье место окажется недостижимым
  // или четвёртый призёр не получит места.
  it('мест на подиуме столько же, сколько призёров отдаёт podiumOf', () => {
    const riders = Array.from({ length: 6 }, (_, i) => ({
      id: String(i), fio: 'Гонщик ' + i, sportClass: 'D2',
      attempts: [{ n: 1, time: `01:${String(20 + i).padStart(2, '0')}.00`, penalty: 0 }],
      bestTime: null,
    }))

    const podium = podiumOf(riders, 'Любители', [{ name: 'Любители', classes: ['D2'] }], {})
    expect(podium).toHaveLength(PODIUM_PLACES)
  })

  it('отвергает неизвестную группу — в кадре не должно быть заголовка без состава', () => {
    const s = withGroups()
    expect(applyCommand(s, { type: 'setAward', payload: { subject: 'Ветераны' } })).toBe(false)
    expect(s.award.subject).toBe(null)
  })
})

describe('setRiderGroup', () => {
  const setGroups = (s, participantId, groups) =>
    applyCommand(s, { type: 'setRiderGroup', payload: { participantId, groups } })

  it('ставит участнику список групп', () => {
    const s = withGroups()
    expect(setGroups(s, '1', ['SB'])).toBe(true)
    expect(s.riderGroups['1']).toEqual(['SB'])
  })

  it('принимает две группы, когда разделение отключили', () => {
    const s = withGroups()
    s.strictGroups = false
    expect(setGroups(s, '1', ['Любители', 'SB'])).toBe(true)
    expect(s.riderGroups['1']).toEqual(['Любители', 'SB'])
  })

  it('схлопывает дубли и выстраивает порядок по конфигу, а не по кликам', () => {
    const s = withGroups()
    s.strictGroups = false
    setGroups(s, '1', ['SB', 'Любители', 'SB'])
    expect(s.riderGroups['1']).toEqual(['Любители', 'SB'])
  })

  it('по умолчанию вторая группа не принимается — разделение строгое', () => {
    const s = withGroups()
    expect(setGroups(s, '1', ['Любители', 'SB'])).toBe(false)
    expect(s.riderGroups).toEqual({})
  })

  it('пустой список принимается — это «вне зачёта», а не сброс к классу', () => {
    const s = withGroups()
    expect(setGroups(s, '1', [])).toBe(true)
    expect(s.riderGroups['1']).toEqual([])
  })

  it('null возвращает участника в группу по его классу', () => {
    const s = withGroups()
    setGroups(s, '1', ['SB'])
    expect(setGroups(s, '1', null)).toBe(true)
    expect(s.riderGroups['1']).toBeUndefined()
  })

  it('отвергает неизвестную группу и «Вне групп» — она вычисляется, а не хранится', () => {
    const s = withGroups()
    expect(setGroups(s, '1', ['Ветераны'])).toBe(false)
    expect(setGroups(s, '1', [UNGROUPED])).toBe(false)
    expect(s.riderGroups).toEqual({})
  })

  it('отвергает всю команду, если хоть одна группа неизвестна', () => {
    const s = withGroups()
    expect(setGroups(s, '1', ['SB', 'Ветераны'])).toBe(false)
    expect(s.riderGroups).toEqual({})
  })

  it('отвергает не массив — payload прошлой версии не должен пролезть', () => {
    const s = withGroups()
    expect(setGroups(s, '1', 'SB')).toBe(false)
    expect(s.riderGroups).toEqual({})
  })

  it('отвергает несуществующего участника', () => {
    const s = withGroups()
    expect(setGroups(s, '99', ['SB'])).toBe(false)
  })

  it('пометка переживает опрос — иначе стёрлась бы через семь секунд', () => {
    const s = withGroups()
    setGroups(s, '1', ['SB'])
    applyParticipants(s, [rider('1', 'Болдов Иван'), rider('2', 'Петров Илья')])
    expect(s.riderGroups['1']).toEqual(['SB'])
  })

  it('строгое разделение отвергает вторую группу целиком, а не усекает', () => {
    const s = withGroups()

    // Команда, выполненная наполовину, оставила бы человека не в тех
    // группах, и оператор об этом не узнал бы.
    expect(setGroups(s, '1', ['Любители', 'SB'])).toBe(false)
    expect(s.riderGroups).toEqual({})
  })

  it('строгое разделение принимает одну группу и пустой список', () => {
    const s = withGroups()
    expect(setGroups(s, '1', ['SB'])).toBe(true)
    expect(setGroups(s, '2', [])).toBe(true)
  })
})

describe('перенос пометок при смене id участника', () => {
  const named = (id, fio) => ({ ...rider(id, fio), id })

  it('пометка переезжает на новый id, когда организатор привязал профиль', () => {
    const s = withGroups()
    applyParticipants(s, [named('anon-p67ilg', 'Полухин Никита')])
    applyCommand(s, { type: 'setRiderGroup', payload: { participantId: 'anon-p67ilg', groups: ['SB'] } })

    // тот же человек, но у него появился профиль на сайте — id стал числом
    applyParticipants(s, [named('9999', 'Полухин Никита')])

    expect(s.riderGroups['9999']).toEqual(['SB'])
    expect(s.riderGroups['anon-p67ilg']).toBeUndefined()
  })

  it('не переносит к тёзке — двух одинаковых ФИО достаточно, чтобы ошибиться', () => {
    const s = withGroups()
    applyParticipants(s, [named('anon-1', 'Иванов Иван')])
    applyCommand(s, { type: 'setRiderGroup', payload: { participantId: 'anon-1', groups: ['SB'] } })

    applyParticipants(s, [named('11', 'Иванов Иван'), named('22', 'Иванов Иван')])

    expect(s.riderGroups['11']).toBeUndefined()
    expect(s.riderGroups['22']).toBeUndefined()
  })

  it('не затирает пометку, которая уже стоит на новом id', () => {
    const s = withGroups()
    applyParticipants(s, [named('anon-1', 'Полухин Никита'), named('7', 'Другой Гонщик')])
    applyCommand(s, { type: 'setRiderGroup', payload: { participantId: 'anon-1', groups: ['SB'] } })
    applyCommand(s, { type: 'setRiderGroup', payload: { participantId: '7', groups: ['Любители'] } })

    // сайт переименовал участника «7» в «Полухин Никита» — совпадение ФИО
    // не повод перекладывать чужую пометку
    applyParticipants(s, [named('7', 'Полухин Никита')])

    expect(s.riderGroups['7']).toEqual(['Любители'])
  })

  it('участник просто снялся — пометка остаётся, картинку она не портит', () => {
    const s = withGroups()
    applyParticipants(s, [named('1', 'Болдов Иван')])
    applyCommand(s, { type: 'setRiderGroup', payload: { participantId: '1', groups: ['SB'] } })

    applyParticipants(s, [named('2', 'Петров Илья')])

    expect(s.riderGroups['1']).toEqual(['SB'])
  })
})

describe('syncAwardSubject', () => {
  it('сбрасывает группу, которой больше нет в конфиге — иначе её заголовок уйдёт в эфир', () => {
    const s = createDefaultState()
    s.awardGroups = [{ name: 'Любители', classes: ['D2'] }]
    s.award.subject = 'Круизер'

    expect(syncAwardSubject(s)).toBe(true)
    expect(s.award.subject).toBe(null)
  })

  it('существующую группу не трогает', () => {
    const s = createDefaultState()
    s.awardGroups = [{ name: 'Любители', classes: ['D2'] }]
    s.award.subject = 'Любители'

    expect(syncAwardSubject(s)).toBe(false)
    expect(s.award.subject).toBe('Любители')
  })

  it('«Вне групп» оставляет — это вычисляемый пункт, а не группа из конфига', () => {
    const s = createDefaultState()
    s.awardGroups = [{ name: 'Любители', classes: ['D2'] }]
    s.award.subject = UNGROUPED

    expect(syncAwardSubject(s)).toBe(false)
    expect(s.award.subject).toBe(UNGROUPED)
  })
})

// Настройки этапа приезжают в состояние при старте сервера. Часть из них —
// оформление и состав групп — принадлежит файлу этапа всегда. Тумблеры кадра
// принадлежат оператору: он переключает их из пульта по ходу дня.
describe('применение настроек этапа при старте', () => {
  const stageConfig = {
    stageId: '677', liveStageId: '677', eventTitle: 'Этап из файла',
    logoUrl: '/assets/logo.png', logoMarkUrl: '/assets/logo-mark.png',
    highlightTimeout: 6000, showRunTime: true, showClassTop: true,
    resultsByGroup: false, awardGroups: [{ name: 'Любители', classes: ['D2'] }],
    strictGroups: true, timerUrl: null, trackMapUrl: '', sceneOptionsFromEnv: [],
  }

  it('этап и оформление всегда из файла — иначе репетиция утекла бы в эфир', () => {
    const s = createDefaultState()
    s.stageId = '670'
    s.eventTitle = 'Прошлогоднее название'

    applyServerConfig(s, stageConfig, { restored: true })
    expect(s.stageId).toBe('677')
    expect(s.eventTitle).toBe('Этап из файла')
    expect(s.awardGroups).toHaveLength(1)
  })

  // К концу дня в кадре обычно таблица по группам: по ней вручают медали.
  // Перезапуск сервера в разгар награждения молча вернул бы разрез по классам.
  it('разрез таблицы, выбранный оператором, переживает перезапуск', () => {
    const s = createDefaultState()
    applyCommand(s, { type: 'setSceneOption', payload: { option: 'resultsByGroup', value: true } })

    applyServerConfig(s, stageConfig, { restored: true })
    expect(s.resultsByGroup).toBe(true)
  })

  it('названный в командной строке тумблер сильнее выбора оператора', () => {
    const s = createDefaultState()
    applyCommand(s, { type: 'setSceneOption', payload: { option: 'resultsByGroup', value: true } })

    applyServerConfig(s, { ...stageConfig, sceneOptionsFromEnv: ['resultsByGroup'] }, { restored: true })
    expect(s.resultsByGroup).toBe(false)
  })

  it('на первом запуске этапа тумблеры берутся из файла', () => {
    const s = createDefaultState()
    s.resultsByGroup = true

    applyServerConfig(s, stageConfig, { restored: false })
    expect(s.resultsByGroup).toBe(false)
  })

  // Показания эфемерны: сервер, поднятый посреди дня, видит на табло прибора
  // прошлый результат — и обязан считать это покоем.
  it('показания таймера с диска не поднимаются', () => {
    const s = createDefaultState()
    s.timer = { phase: 'finished', startedAt: 1, time: '00:19.718', updatedAt: 2 }

    applyServerConfig(s, stageConfig, { restored: true })
    expect(s.timer).toBe(null)
  })

  it('связь с прибором проверяется заново, а не поднимается с диска', () => {
    const s = createDefaultState()
    s.timerLink = { online: true, seenAt: 1000 }

    applyServerConfig(s, stageConfig, { restored: true })
    expect(s.timerLink).toBe(null)
  })

  // Трасса на этапе одна, и переключать её из пульта незачем: схема
  // принадлежит файлу этапа так же, как логотип. Сохранённое значение
  // затирается — иначе после репетиции в кадре висела бы чужая трасса.
  it('схема трассы всегда из файла этапа', () => {
    const s = createDefaultState()
    s.trackMapUrl = '/assets/прошлогодняя.png'

    applyServerConfig(s, { ...stageConfig, trackMapUrl: '/assets/track-map.svg' }, { restored: true })
    expect(s.trackMapUrl).toBe('/assets/track-map.svg')
  })

  // Пульту нужно отличать «прибора нет по замыслу» от «прибор пропал»:
  // на этапе без таймера молчание прибора — не повод тревожить оператора.
  it('сообщает пульту, задан ли прибор на этом этапе', () => {
    const without = createDefaultState()
    applyServerConfig(without, stageConfig, { restored: false })
    expect(without.timerConfigured).toBe(false)

    const with_ = createDefaultState()
    applyServerConfig(with_, { ...stageConfig, timerUrl: 'http://192.168.1.97/laptime' }, { restored: false })
    expect(with_.timerConfigured).toBe(true)
  })
})

// Нижняя треть — вставка на несколько секунд, и снимает её страховочный
// таймер сервера (server/index.js). Таймер заводится командой пульта, а
// после падения команды не было: поднятый сервер вернул бы хайлайт в кадр
// и оставил бы его там до конца дня.
describe('хайлайт, переживший падение сервера', () => {
  it('снимается при подъёме', () => {
    const s = createDefaultState()
    applyCommand(s, { type: 'showHighlight', payload: { participantId: '1', caption: 'Лучшее время дня' } })

    expect(clearStaleHighlight(s)).toBe(true)
    expect(s.highlight.visible).toBe(false)
  })

  it('возвращает кадр туда, откуда его вызывали', () => {
    const s = createDefaultState()
    applyCommand(s, { type: 'setActiveScene', payload: 'run' })
    applyCommand(s, { type: 'showHighlight', payload: { participantId: '1' } })
    applyCommand(s, { type: 'setActiveScene', payload: 'highlight' })

    clearStaleHighlight(s)
    expect(s.activeScene).toBe('run')
  })

  it('состояние без хайлайта не трогает', () => {
    const s = createDefaultState()
    applyCommand(s, { type: 'setActiveScene', payload: 'award' })

    expect(clearStaleHighlight(s)).toBe(false)
    expect(s.activeScene).toBe('award')
  })
})

describe('UNGROUPED', () => {
  it('совпадает с константой клиента — сервер не импортирует клиентский код', () => {
    expect(SERVER_UNGROUPED).toBe(UNGROUPED)
  })
})

describe('список статусов явки', () => {
  // Разъехавшись, списки дали бы худшее: пульт показывает человека снятым,
  // сервер отметку не принял, а в кадре он едет.
  it('знает статус клиента', () => {
    expect(RIDER_STATUSES).toContain(DNS)
  })
})

describe('состояние награждения по группам', () => {
  it('стартует без выбранной группы', () => {
    const s = createDefaultState()
    expect(s.award).toEqual({ subject: null, place: 1, showAllThree: false })
    expect(s.awardGroups).toEqual([])
    expect(s.riderGroups).toEqual({})
    expect(s.strictGroups).toBe(true)
  })

  it('состояние прошлой версии с award.sportClass грузится без падения', () => {
    const path = 'test/tmp-award-state.json'
    writeFileSync(path, JSON.stringify({
      activeScene: 'award',
      award: { sportClass: 'N', place: 1, showAllThree: false },
    }), 'utf-8')

    const s = loadState(path)
    expect(s.activeScene).toBe('award')
    expect(s.award.subject).toBe(null)
    rmSync(path, { force: true })
  })

  it('состояние прошлой версии со строкой в riderGroups нормализуется в массив', () => {
    const path = 'test/tmp-rider-groups-state.json'
    writeFileSync(path, JSON.stringify({
      riderGroups: { 1: 'SB', 2: ['Любители', 'Круизер'], 3: [], 4: 42 },
    }), 'utf-8')

    // 'SB'.includes('S') истинно, поэтому строку нельзя оставлять как есть:
    // участник уехал бы в чужую группу с похожим именем.
    const s = loadState(path)
    expect(s.riderGroups).toEqual({ 1: ['SB'], 2: ['Любители', 'Круизер'], 3: [] })
    rmSync(path, { force: true })
  })

  it('дубли в файле схлопываются — иначе участник посчитан в группе дважды', () => {
    const path = 'test/tmp-dup-groups-state.json'
    writeFileSync(path, JSON.stringify({ riderGroups: { 1: ['Любители', 'Любители'] } }), 'utf-8')

    const s = loadState(path)
    expect(s.riderGroups['1']).toEqual(['Любители'])
    rmSync(path, { force: true })
  })
})

describe('тумблеры сцены заезда', () => {
  it('по умолчанию оба включены', () => {
    const state = createDefaultState()
    expect(state.showRunTime).toBe(true)
    expect(state.showClassTop).toBe(true)
  })

  it('пульт гасит зону времени', () => {
    const state = createDefaultState()
    expect(applyCommand(state, {
      type: 'setSceneOption',
      payload: { option: 'showRunTime', value: false },
    })).toBe(true)
    expect(state.showRunTime).toBe(false)
  })

  it('пульт гасит топ-3', () => {
    const state = createDefaultState()
    applyCommand(state, { type: 'setSceneOption', payload: { option: 'showClassTop', value: false } })
    expect(state.showClassTop).toBe(false)
  })

  // Неизвестная опция означает, что пульт и сервер разошлись версиями.
  // Приняв её, сервер завёл бы в состоянии поле, которое никто не читает.
  it('неизвестная опция отвергается и состояния не меняет', () => {
    const state = createDefaultState()
    expect(applyCommand(state, {
      type: 'setSceneOption',
      payload: { option: 'showEverything', value: false },
    })).toBe(false)
    expect(state.showEverything).toBeUndefined()
  })

  it('значение приводится к булеву', () => {
    const state = createDefaultState()
    applyCommand(state, { type: 'setSceneOption', payload: { option: 'showRunTime', value: 0 } })
    expect(state.showRunTime).toBe(false)
  })
})

describe('режим итоговой таблицы', () => {
  it('по умолчанию таблица группируется по классам', () => {
    expect(createDefaultState().resultsByGroup).toBe(false)
  })

  it('пульт переключает таблицу на группы награждения', () => {
    const state = createDefaultState()
    expect(applyCommand(state, {
      type: 'setSceneOption',
      payload: { option: 'resultsByGroup', value: true },
    })).toBe(true)
    expect(state.resultsByGroup).toBe(true)
  })
})

describe('показания таймера', () => {
  it('по умолчанию их нет', () => {
    expect(createDefaultState().timer).toBeNull()
  })

  // Иначе финишное время предыдущего спортсмена подписалось бы под именем
  // следующего — ошибка, которую в эфире не отличить от правды.
  it('новый райдер в эфире обнуляет показания предыдущего', () => {
    const state = createDefaultState()
    state.timer = { phase: 'finished', startedAt: 1, time: '01:23.72', updatedAt: 2 }

    applyCommand(state, {
      type: 'setCurrentRun',
      payload: { participantId: 'следующий', attemptLabel: 'Попытка 1', caption: '' },
    })

    expect(state.timer).toBeNull()
  })
})

describe('сход в заезде', () => {
  const started = (state, participantId, attemptLabel = 'Попытка 2') => {
    applyCommand(state, { type: 'setCurrentRun', payload: { participantId, attemptLabel, caption: '' } })
    state.timer = { phase: 'running', startedAt: 1, time: null, updatedAt: 2 }
  }

  it('по умолчанию схода нет', () => {
    expect(createDefaultState().currentRun.dnf).toBe(false)
  })

  it('пульт помечает сход и снимает пометку', () => {
    const state = createDefaultState()
    expect(applyCommand(state, { type: 'setRunDnf', payload: true })).toBe(true)
    expect(state.currentRun.dnf).toBe(true)

    applyCommand(state, { type: 'setRunDnf', payload: false })
    expect(state.currentRun.dnf).toBe(false)
  })

  // Оператор дописывает подпись прямо во время заезда, и это тот же заезд:
  // сбрасывать здесь показания значило бы гасить живой отсчёт посреди трассы.
  it('правка подписи того же заезда не трогает ни таймер, ни сход', () => {
    const state = createDefaultState()
    started(state, 'первый')
    applyCommand(state, { type: 'setRunDnf', payload: true })

    applyCommand(state, {
      type: 'setCurrentRun',
      payload: { participantId: 'первый', attemptLabel: 'Попытка 2', caption: 'чемпион области' },
    })

    expect(state.timer).not.toBeNull()
    expect(state.currentRun.dnf).toBe(true)
    expect(state.currentRun.caption).toBe('чемпион области')
  })

  it('новый райдер обнуляет и показания, и сход', () => {
    const state = createDefaultState()
    started(state, 'первый')
    applyCommand(state, { type: 'setRunDnf', payload: true })

    applyCommand(state, {
      type: 'setCurrentRun',
      payload: { participantId: 'второй', attemptLabel: 'Попытка 2', caption: '' },
    })

    expect(state.timer).toBeNull()
    expect(state.currentRun.dnf).toBe(false)
  })

  // Вторая попытка того же спортсмена — другой заезд, и сход первой к ней
  // отношения не имеет.
  it('смена попытки у того же райдера тоже обнуляет', () => {
    const state = createDefaultState()
    started(state, 'первый', 'Попытка 1')
    applyCommand(state, { type: 'setRunDnf', payload: true })

    applyCommand(state, {
      type: 'setCurrentRun',
      payload: { participantId: 'первый', attemptLabel: 'Попытка 2', caption: '' },
    })

    expect(state.timer).toBeNull()
    expect(state.currentRun.dnf).toBe(false)
  })
})

describe('сцена «Чистый кадр»', () => {
  it('сервер её принимает', () => {
    const s = createDefaultState()
    expect(applyCommand(s, { type: 'setActiveScene', payload: 'clean' })).toBe(true)
    expect(s.activeScene).toBe('clean')
  })
})

// Сцена показывает единственное — файл со схемой. Без файла показывать
// нечего, поэтому её нет вовсе: кнопка в пульте погашена, а сервер отвергает
// команду. Проверка на сервере обязательна — иначе горячая клавиша прошла бы
// мимо погашенной кнопки и вывела в эфир пустоту.
describe('сцена «Схема трассы»', () => {
  it('сервер её принимает, когда схема задана', () => {
    const s = createDefaultState()
    s.trackMapUrl = '/assets/track-map.svg'

    expect(applyCommand(s, { type: 'setActiveScene', payload: 'track' })).toBe(true)
    expect(s.activeScene).toBe('track')
  })

  it('без файла команда отвергается — показывать было бы нечего', () => {
    const s = createDefaultState()
    s.activeScene = 'results'

    expect(applyCommand(s, { type: 'setActiveScene', payload: 'track' })).toBe(false)
    expect(s.activeScene).toBe('results')
  })

  it('в состоянии по умолчанию схемы нет', () => {
    expect(createDefaultState().trackMapUrl).toBe('')
  })
})

// Вчера схему показывали, сервер сохранил её как активную сцену, сегодня
// поле убрали из конфига. Без сброса сервер поднялся бы прямо в кадр,
// где сказано, что схема не загрузилась.
describe('syncTrackScene', () => {
  it('возвращает кадр к таблице, если схема исчезла из конфига', () => {
    const s = createDefaultState()
    s.activeScene = 'track'
    s.trackMapUrl = ''

    expect(syncTrackScene(s)).toBe(true)
    expect(s.activeScene).toBe('results')
  })

  it('оставляет сцену, когда файл на месте', () => {
    const s = createDefaultState()
    s.activeScene = 'track'
    s.trackMapUrl = '/assets/track-map.svg'

    expect(syncTrackScene(s)).toBe(false)
    expect(s.activeScene).toBe('track')
  })

  // Схемы нет — обычное состояние этапа, где её не готовили. Трогать при
  // этом чужую сцену нельзя: сервер, поднятый посреди награждения, обязан
  // вернуться в награждение.
  it('другие сцены не трогает даже без схемы', () => {
    const s = createDefaultState()
    s.activeScene = 'award'
    s.trackMapUrl = ''

    expect(syncTrackScene(s)).toBe(false)
    expect(s.activeScene).toBe('award')
  })
})

describe('отметка неявки', () => {
  const withRiders = () => {
    const s = createDefaultState()
    applyParticipants(s, [rider('1', 'Болдов Иван'), rider('2', 'Петров Илья')])
    return s
  }

  const mark = (s, participantId, status = DNS) =>
    applyCommand(s, { type: 'setRiderStatus', payload: { participantId, status } })

  it('ставится и снимается', () => {
    const s = withRiders()

    expect(mark(s, '1')).toBe(true)
    expect(s.riderStatus['1']).toBe(DNS)

    expect(mark(s, '1', null)).toBe(true)
    expect(s.riderStatus['1']).toBeUndefined()
  })

  it('пустого состояния хватает: по умолчанию отметок нет', () => {
    expect(createDefaultState().riderStatus).toEqual({})
  })

  it('участника нет в составе — команда отвергается', () => {
    const s = withRiders()
    expect(mark(s, '99')).toBe(false)
    expect(s.riderStatus['99']).toBeUndefined()
  })

  // Неизвестное значение означает, что пульт и сервер разошлись. Приняв его,
  // сервер завёл бы статус, которого не понимает ни один потребитель, —
  // человек остался бы в кадре, а пульт показывал бы его снятым.
  it('неизвестный статус отвергается', () => {
    const s = withRiders()
    expect(applyCommand(s, { type: 'setRiderStatus', payload: { participantId: '1', status: 'dq' } })).toBe(false)
    expect(s.riderStatus['1']).toBeUndefined()
  })

  it('отметка переживает опрос сайта', () => {
    const s = withRiders()
    mark(s, '1')

    applyParticipants(s, [rider('1', 'Болдов Иван'), rider('2', 'Петров Илья')])

    expect(s.riderStatus['1']).toBe(DNS)
  })

  // Тот же случай, что с пометкой групп: у безномерного id собран из ФИО и
  // меняется, как только организатор привяжет профиль. Осиротевшая отметка
  // молча вернула бы человека в кадр.
  it('переезжает на новый id вместе с пометкой групп', () => {
    const s = createDefaultState()
    applyParticipants(s, [{ ...rider('anon-x', 'Полухин Никита'), id: 'anon-x' }])
    mark(s, 'anon-x')

    applyParticipants(s, [{ ...rider('9999', 'Полухин Никита'), id: '9999' }])

    expect(s.riderStatus['9999']).toBe(DNS)
    expect(s.riderStatus['anon-x']).toBeUndefined()
  })

  it('к тёзке отметка не переезжает', () => {
    const s = createDefaultState()
    applyParticipants(s, [{ ...rider('anon-x', 'Иванов Иван'), id: 'anon-x' }])
    mark(s, 'anon-x')

    applyParticipants(s, [
      { ...rider('11', 'Иванов Иван'), id: '11' },
      { ...rider('22', 'Иванов Иван'), id: '22' },
    ])

    expect(s.riderStatus['11']).toBeUndefined()
    expect(s.riderStatus['22']).toBeUndefined()
  })

  // Оператор, выводящий человека в эфир, тем самым утверждает, что тот
  // участвует. Без снятия отметки карточка уехала бы в кадр пустой: времени
  // у первой попытки ещё нет, и участник для сцен не существует.
  it('вывод заезда в эфир снимает отметку', () => {
    const s = withRiders()
    mark(s, '1')

    applyCommand(s, { type: 'setCurrentRun', payload: { participantId: '1', attemptLabel: 'Попытка 1' } })

    expect(s.riderStatus['1']).toBeUndefined()
  })

  it('хайлайт снимает отметку так же', () => {
    const s = withRiders()
    mark(s, '2')

    applyCommand(s, { type: 'showHighlight', payload: { participantId: '2', caption: 'Лучшее время дня' } })

    expect(s.riderStatus['2']).toBeUndefined()
  })

  // Промах мышью по соседней строке не должен стоить кадра: в первую попытку
  // результата ещё нет, и отметка вынула бы участника из состава сцен —
  // карточка погасла бы прямо во время заезда.
  it('того, кто назначен заездом, отметить нельзя', () => {
    const s = withRiders()
    applyCommand(s, { type: 'setCurrentRun', payload: { participantId: '1' } })

    expect(mark(s, '1')).toBe(false)
    expect(s.riderStatus['1']).toBeUndefined()
  })

  it('того, кто в хайлайте, отметить нельзя', () => {
    const s = withRiders()
    applyCommand(s, { type: 'showHighlight', payload: { participantId: '2' } })

    expect(mark(s, '2')).toBe(false)
    expect(s.riderStatus['2']).toBeUndefined()
  })

  it('снятый хайлайт больше никого не держит', () => {
    const s = withRiders()
    applyCommand(s, { type: 'showHighlight', payload: { participantId: '2' } })
    applyCommand(s, { type: 'hideHighlight' })

    expect(mark(s, '2')).toBe(true)
  })

  // Запрет односторонний: он бережёт кадр от исчезновения, а не запрещает
  // оператору передумать. Иначе ошибочная отметка держалась бы до смены заезда.
  it('снять отметку можно и у того, кто в кадре', () => {
    const s = withRiders()
    mark(s, '1')
    applyCommand(s, { type: 'setCurrentRun', payload: { participantId: '2' } })
    applyCommand(s, { type: 'setCurrentRun', payload: { participantId: '1' } })

    // вывод в кадр отметку уже снял, но команда на снятие обязана проходить
    expect(mark(s, '1', null)).toBe(true)
    expect(s.riderStatus['1']).toBeUndefined()
  })

  it('соседей текущий заезд не держит', () => {
    const s = withRiders()
    applyCommand(s, { type: 'setCurrentRun', payload: { participantId: '1' } })

    expect(mark(s, '2')).toBe(true)
  })

  it('снятие заезда с эфира чужих отметок не трогает', () => {
    const s = withRiders()
    mark(s, '1')

    applyCommand(s, { type: 'setCurrentRun', payload: { participantId: null } })

    expect(s.riderStatus['1']).toBe(DNS)
  })

  it('поднимается из файла состояния', () => {
    const dir = 'test/tmp'
    mkdirSync(dir, { recursive: true })
    const path = `${dir}/status-state.json`

    const s = withRiders()
    mark(s, '1')
    saveState(s, path)

    expect(loadState(path).riderStatus).toEqual({ 1: DNS })
    rmSync(path, { force: true })
  })

  // Файл мог быть записан версией, которая знала другие значения, или
  // отредактирован руками. Мусор в статусе тише всего: человек просто
  // не исчезнет из кадра, и никто не поймёт, почему отметка не работает.
  it('мусор из файла состояния отбрасывается', () => {
    const dir = 'test/tmp'
    mkdirSync(dir, { recursive: true })
    const path = `${dir}/status-broken.json`

    const s = withRiders()
    s.riderStatus = { 1: DNS, 2: 'dq', 3: true, 4: null }
    saveState(s, path)

    expect(loadState(path).riderStatus).toEqual({ 1: DNS })
    rmSync(path, { force: true })
  })
})
