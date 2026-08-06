import { describe, it, expect } from 'vitest'
import { ref, watchEffect, nextTick } from 'vue'
import { sceneStateOf } from '../app/src/overlay/sceneState.js'
import { DNS } from '../app/src/shared/riderStatus.js'

const rider = (id, bestTime = null) => ({
  id, fio: `Гонщик ${id}`, sportClass: 'C3', number: Number(id),
  city: '', motorcycle: '', attempts: [], bestTime, placeInClass: null,
})

const stateWith = (extra = {}) => ref({
  participants: [rider('1'), rider('2'), rider('3')],
  riderStatus: {},
  timer: null,
  activeScene: 'results',
  ...extra,
})

describe('состояние сцен', () => {
  it('вычитает неявившихся из состава', () => {
    const state = stateWith({ riderStatus: { 2: DNS } })
    const scene = sceneStateOf(state)

    expect(scene.value.participants.map(p => p.id)).toEqual(['1', '3'])
  })

  it('остальные поля отдаёт как есть', () => {
    const state = stateWith({ activeScene: 'award' })
    expect(sceneStateOf(state).value.activeScene).toBe('award')
  })

  it('пустое состояние не ломает', () => {
    expect(sceneStateOf(ref(null)).value).toBeNull()
  })

  it('отмеченный возвращается, как только у него появился результат', async () => {
    const state = stateWith({ riderStatus: { 2: DNS } })
    const scene = sceneStateOf(state)
    expect(scene.value.participants).toHaveLength(2)

    state.value = { ...state.value, participants: [rider('1'), rider('2', '01:23.50'), rider('3')] }
    await nextTick()

    expect(scene.value.participants).toHaveLength(3)
  })
})

// Показания прибора приходят три раза в секунду и кладутся в состояние
// точечной записью (useSocket.js) ровно ради того, чтобы таблица на них
// не перерисовывалась. Пересборка состояния сцены копией это сломала бы
// молча: в кадре 43 строки, а поймать лишние перерисовки глазами нельзя.
describe('таймер не будит состав', () => {
  const countRuns = (read) => {
    const runs = { n: 0 }
    watchEffect(() => { read(); runs.n += 1 })
    return runs
  }

  it('показания таймера не пересчитывают участников', async () => {
    const state = stateWith()
    const scene = sceneStateOf(state)

    const roster = countRuns(() => scene.value.participants)
    expect(roster.n).toBe(1)

    state.value.timer = { seconds: 12.3 }
    await nextTick()
    state.value.timer = { seconds: 12.6 }
    await nextTick()

    expect(roster.n).toBe(1)
  })

  it('но зона времени показания получает', async () => {
    const state = stateWith()
    const scene = sceneStateOf(state)

    const clock = countRuns(() => scene.value.timer)
    expect(clock.n).toBe(1)

    state.value.timer = { seconds: 12.3 }
    await nextTick()

    expect(clock.n).toBe(2)
  })

  it('смена состава участников пересчитывает', async () => {
    const state = stateWith()
    const scene = sceneStateOf(state)

    const roster = countRuns(() => scene.value.participants)

    state.value.participants = [rider('1'), rider('2')]
    await nextTick()

    expect(roster.n).toBe(2)
  })

  it('отметка явки пересчитывает', async () => {
    const state = stateWith()
    const scene = sceneStateOf(state)

    const roster = countRuns(() => scene.value.participants)

    state.value.riderStatus = { 1: DNS }
    await nextTick()

    expect(roster.n).toBe(2)
    expect(scene.value.participants).toHaveLength(2)
  })
})
