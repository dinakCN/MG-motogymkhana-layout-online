import { describe, it, expect } from 'vitest'
import { rmSync, writeFileSync } from 'node:fs'
import { bestOf } from '../app/src/shared/format.js'
import { UNGROUPED } from '../app/src/shared/awardGroups.js'
import { createDefaultState, applyParticipants, applyCommand, saveState, loadState, normalizeOverride, UNGROUPED as SERVER_UNGROUPED } from '../server/state.js'

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

  it('отвергает неизвестную группу — в кадре не должно быть заголовка без состава', () => {
    const s = withGroups()
    expect(applyCommand(s, { type: 'setAward', payload: { subject: 'Ветераны' } })).toBe(false)
    expect(s.award.subject).toBe(null)
  })
})

describe('setRiderGroup', () => {
  it('перемещает участника в другую группу', () => {
    const s = withGroups()
    expect(applyCommand(s, { type: 'setRiderGroup', payload: { participantId: '1', group: 'SB' } })).toBe(true)
    expect(s.riderGroups['1']).toBe('SB')
  })

  it('null возвращает участника в группу по его классу', () => {
    const s = withGroups()
    applyCommand(s, { type: 'setRiderGroup', payload: { participantId: '1', group: 'SB' } })
    expect(applyCommand(s, { type: 'setRiderGroup', payload: { participantId: '1', group: null } })).toBe(true)
    expect(s.riderGroups['1']).toBeUndefined()
  })

  it('отвергает неизвестную группу и «Вне групп» — она вычисляется, а не хранится', () => {
    const s = withGroups()
    expect(applyCommand(s, { type: 'setRiderGroup', payload: { participantId: '1', group: 'Ветераны' } })).toBe(false)
    expect(applyCommand(s, { type: 'setRiderGroup', payload: { participantId: '1', group: UNGROUPED } })).toBe(false)
    expect(s.riderGroups).toEqual({})
  })

  it('отвергает несуществующего участника', () => {
    const s = withGroups()
    expect(applyCommand(s, { type: 'setRiderGroup', payload: { participantId: '99', group: 'SB' } })).toBe(false)
  })

  it('пометка переживает опрос — иначе стёрлась бы через семь секунд', () => {
    const s = withGroups()
    applyCommand(s, { type: 'setRiderGroup', payload: { participantId: '1', group: 'SB' } })
    applyParticipants(s, [rider('1', 'Болдов Иван'), rider('2', 'Петров Илья')])
    expect(s.riderGroups['1']).toBe('SB')
  })
})

describe('UNGROUPED', () => {
  it('совпадает с константой клиента — сервер не импортирует клиентский код', () => {
    expect(SERVER_UNGROUPED).toBe(UNGROUPED)
  })
})

describe('состояние награждения по группам', () => {
  it('стартует без выбранной группы', () => {
    const s = createDefaultState()
    expect(s.award).toEqual({ subject: null, place: 1, showAllThree: false })
    expect(s.awardGroups).toEqual([])
    expect(s.riderGroups).toEqual({})
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
})
