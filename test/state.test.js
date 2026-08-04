import { describe, it, expect } from 'vitest'
import { rmSync, writeFileSync } from 'node:fs'
import { createDefaultState, applyParticipants, applyCommand, saveState, loadState } from '../server/state.js'

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

  it('игнорирует неизвестную команду', () => {
    const s = createDefaultState()
    expect(applyCommand(s, { type: 'что-то', payload: 1 })).toBe(false)
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
})
