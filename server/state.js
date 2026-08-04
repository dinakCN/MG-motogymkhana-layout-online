import { readFileSync, writeFileSync } from 'node:fs'

const SCENES = ['results', 'run', 'highlight', 'break', 'award']
const ROUNDS = ['round1', 'break1', 'round2', 'final', 'break2', 'awards']

export function createDefaultState() {
  return {
    eventTitle: 'Чемпионат Новосибирской области по мотоджимхане 2026',
    logoUrl: '/assets/logo.png',
    stageId: null,
    activeScene: 'results',
    round: 'round1',
    lastSuccessfulPoll: 0,
    currentRun: { participantId: null, attemptLabel: 'Попытка 1', caption: '' },
    highlight: { participantId: null, caption: '', visible: false },
    award: { sportClass: null, place: 1, showAllThree: false },
    // Ручные правки живут отдельно от данных опроса и накладываются
    // поверх них после каждого успешного обновления. Иначе правка
    // стиралась бы следующим опросом через несколько секунд —
    // то есть ровно тогда, когда она и нужна.
    overrides: {},
    participants: [],
  }
}

const overrideKey = (participantId, attempt, field) => `${participantId}:${attempt}:${field}`

export function applyOverrides(state) {
  for (const [key, value] of Object.entries(state.overrides ?? {})) {
    const [participantId, attemptNumber, field] = key.split(':')
    const participant = state.participants.find(p => p.id === participantId)
    const attempt = participant?.attempts?.find(a => a.n === Number(attemptNumber))
    if (attempt) attempt[field] = value
  }
}

// Возвращает true, если данные приняты. Пустой или отсутствующий результат
// поверх уже имеющихся участников отвергается: сбой сети или сломанный
// парсинг не должны гасить картинку в эфире.
export function applyParticipants(state, participants) {
  if (!Array.isArray(participants)) return false
  if (participants.length === 0 && state.participants.length > 0) return false

  state.participants = participants
  state.lastSuccessfulPoll = Date.now()
  applyOverrides(state)
  return true
}

export function applyCommand(state, message) {
  const { type, payload } = message || {}

  switch (type) {
    case 'setActiveScene':
      if (!SCENES.includes(payload)) return false
      state.activeScene = payload
      return true

    case 'setRound':
      if (!ROUNDS.includes(payload)) return false
      state.round = payload
      return true

    case 'setCurrentRun':
      state.currentRun = {
        participantId: payload?.participantId ?? null,
        attemptLabel: payload?.attemptLabel ?? 'Попытка 1',
        caption: payload?.caption ?? '',
      }
      return true

    case 'showHighlight':
      state.highlight = {
        participantId: payload?.participantId ?? null,
        caption: payload?.caption ?? '',
        visible: true,
      }
      return true

    case 'hideHighlight':
      state.highlight = { ...state.highlight, visible: false }
      return true

    case 'setAward':
      state.award = {
        sportClass: payload?.sportClass ?? null,
        place: payload?.place ?? 1,
        showAllThree: Boolean(payload?.showAllThree),
      }
      return true

    case 'manualOverride': {
      const p = state.participants.find(x => x.id === payload?.participantId)
      const attempt = p?.attempts?.find(a => a.n === payload?.attempt)
      if (!attempt || !['time', 'penalty'].includes(payload?.field)) return false

      const key = overrideKey(payload.participantId, payload.attempt, payload.field)

      // Пустое значение снимает правку и возвращает строку под управление
      // опросчика — иначе ошибочную правку было бы не отменить.
      if (payload.value === '' || payload.value === null) {
        delete state.overrides[key]
      } else {
        state.overrides[key] = payload.value
        attempt[payload.field] = payload.value
      }
      return true
    }

    default:
      return false
  }
}

export function saveState(state, path) {
  try {
    writeFileSync(path, JSON.stringify(state, null, 2), 'utf-8')
  } catch (err) {
    console.error('[state] не удалось сохранить:', err.message)
  }
}

export function loadState(path) {
  try {
    return { ...createDefaultState(), ...JSON.parse(readFileSync(path, 'utf-8')) }
  } catch {
    return createDefaultState()
  }
}
