import { readFileSync, writeFileSync, renameSync, copyFileSync } from 'node:fs'

// idle — тихая заставка: логотип и ничего больше. В отличие от break
// она ничего не заявляет и не привязана к раунду, поэтому её можно
// держать в кадре сколько угодно долго.
// clean — прозрачная заглушка: работает камера, мы держим только айдентику.
// От idle отличается тем, что не закрывает кадр: та гасит картинку целиком.
// track — схема трассы файлом. Единственная сцена, которой может не быть:
// без файла показывать нечего, и команда на неё отвергается.
export const SCENES = ['results', 'run', 'highlight', 'break', 'award', 'idle', 'clean', 'track']

// Ключи моментов дня продублированы в app/src/shared/rounds.js (там же тексты
// для кадра). Сервер не импортирует клиентский код, поэтому совпадение
// списков стережёт тест: разъехавшись, они молча отвергали бы команды пульта.
export const ROUNDS = ['round1', 'break1', 'round2', 'final', 'break2', 'awards']

// Дублирует UNGROUPED из app/src/shared/awardGroups.js: сервер не
// импортирует клиентский код. Совпадение стережёт тест — разъехавшись,
// сервер молча отвергал бы команду пульта показать этих участников.
export const UNGROUPED = 'Вне групп'

// Мест на подиуме три. Столько же призёров отдаёт podiumOf
// (app/src/shared/awardGroups.js) — совпадение стережёт тест.
export const PODIUM_PLACES = 3

// Дублирует DNS из app/src/shared/riderStatus.js по той же причине, что и
// UNGROUPED выше: сервер не импортирует клиентский код. Совпадение стережёт
// тест — разъехавшись, сервер отвергал бы отметку явки, а пульт считал бы
// её поставленной.
export const RIDER_STATUSES = ['dns']

export function createDefaultState() {
  return {
    eventTitle: 'Чемпионат Новосибирской области по мотоджимхане 2026',
    logoUrl: '/assets/logo.png',
    logoMarkUrl: '/assets/logo-mark.png',
    // Схема трассы: путь к файлу или пусто, если её на этапе нет. Пустое
    // значение гасит кнопку в пульте и запрещает команду — умолчания здесь
    // нет намеренно, в отличие от логотипов выше.
    trackMapUrl: '',
    stageId: null,
    // Перекрываются настройками сервера при старте (server/index.js).
    // Здесь — чтобы состояние было полным даже без него, например в тестах.
    liveStageId: null,
    highlightTimeout: 6000,
    // Тумблеры сцены заезда. Живут в состоянии, а не только в конфиге:
    // оператор гасит их из пульта, и оверлей обязан узнать об этом тем же
    // сообщением, что и все остальные — разойтись они не могут.
    showRunTime: true,
    showClassTop: true,
    // Разрез итоговой таблицы: по классам (как считает сайт) или по группам
    // награждения (как вручают медали). Тот же тумблер, та же дорожка.
    resultsByGroup: false,
    activeScene: 'results',
    round: 'round1',
    lastSuccessfulPoll: 0,
    // dnf — пометка оператора «спортсмен не доедет». Живёт ровно один заезд:
    // судья остановит таймер и на сходе, но это время не результат, и в кадр
    // ему нельзя. Пометка ничего не решает в зачёте — она только запрещает
    // показ, как тумблер, но точечно.
    currentRun: { participantId: null, attemptLabel: 'Попытка 1', caption: '', dnf: false },
    // Показания таймера с прибора на трассе. Пока прибора нет, здесь null,
    // и зона времени показывает в кадре время первой попытки вместо
    // живого отсчёта.
    timer: null,
    // Связь с прибором: { online, seenAt } или null, пока не опрашивали.
    // Ведётся отдельно от показаний (server/timer.js) — прибор может уехать
    // из сети посреди дня, и оператор обязан узнать об этом из пульта,
    // а не по пропавшим цифрам в кадре.
    timerLink: null,
    // Задан ли прибор на этом этапе. Без него пульт не отличил бы
    // «прибора нет по замыслу» от «прибор пропал».
    timerConfigured: false,
    // returnScene живёт в состоянии, а не в пульте: перезагруженная вкладка
    // пульта не должна забыть, куда возвращать кадр после хайлайта.
    highlight: { participantId: null, caption: '', visible: false, returnScene: 'results' },
    // subject — имя группы награждения. Призёры не хранятся: это трое
    // лучших по времени внутри группы, они считаются на месте.
    award: { subject: null, place: 1, showAllThree: false },
    // Справочник групп приезжает из event.config.js при старте сервера.
    awardGroups: [],
    // Строгое разделение: участник ровно в одной группе. Оттуда же.
    // Умолчание строгое — двойной зачёт включают осознанно.
    strictGroups: true,
    // Ручные перемещения между группами: { participantId: ['Любители',
    // 'Круизер'] }. Групп может быть несколько — класс говорит о мастерстве,
    // а Круизер и SB о мотоцикле. Живут отдельно от данных опроса по той же
    // причине, что и overrides: participants перезаписываются целиком
    // каждые семь секунд.
    riderGroups: {},
    // Явка: { participantId: 'dns' }. Часть заявленных не приезжает, и с сайта
    // это не приходит — там у неприехавшего просто нет прокатов, ровно как
    // у того, кто ещё не стартовал. Отличить их может только человек на
    // площадке, поэтому отметку ставит оператор до начала заездов. Живёт
    // рядом с riderGroups и по той же причине.
    riderStatus: {},
    // Ручные правки живут отдельно от данных опроса и накладываются
    // поверх них после каждого успешного обновления. Иначе правка
    // стиралась бы следующим опросом через несколько секунд —
    // то есть ровно тогда, когда она и нужна.
    overrides: {},
    // Что стояло в ячейке до правки. Снимок нужен, чтобы «Снять правку»
    // возвращало кадр сразу, а не через семь секунд до следующего опроса:
    // правку снимают, когда она оказалась ошибочной и висит в эфире.
    originals: {},
    participants: [],
  }
}

const overrideKey = (participantId, attempt, field) => `${participantId}:${attempt}:${field}`

// Состояние прошлой версии хранило одну группу строкой. Строку нужно
// превратить в массив до первого использования: .includes на строке
// сравнивает подстроки, и 'SB'.includes('S') истинно — участник уехал бы
// в чужую группу с похожим именем. Пустой массив значащий и сохраняется:
// это «вне зачёта», а не отсутствие пометки.
function normalizeRiderGroups(riderGroups) {
  const out = {}
  for (const [id, value] of Object.entries(riderGroups ?? {})) {
    // Дубли схлопываем: команда пульта их не пропускает, но в файл они
    // могли попасть из состояния прошлой версии, а группа с дублем
    // посчитала бы одного человека дважды.
    if (typeof value === 'string') out[id] = [value]
    else if (Array.isArray(value)) out[id] = [...new Set(value.filter(name => typeof name === 'string'))]
  }
  return out
}

// Значения явки, которых сервер не знает, отбрасываются при чтении файла:
// он мог быть записан другой версией или поправлен руками. Мусор здесь тише
// всего — отмеченный просто не исчезнет из кадра, и почему, не поймёт никто.
function normalizeRiderStatus(riderStatus) {
  const out = {}
  for (const [id, value] of Object.entries(riderStatus ?? {})) {
    if (RIDER_STATUSES.includes(value)) out[id] = value
  }
  return out
}

// Аварийную правку набирают руками и в спешке. Значение, которое не
// разберётся дальше, хуже отсутствующего: время в чужом формате осело бы
// в таблице строкой, не попало ни в лучшее время, ни в отставания, и
// выглядело бы при этом как настоящий результат.
//
// Принимаем «1:23,7», «01:23.72», «01:23.7215» — и приводим к виду протокола.
// Дробную часть не режем: хронометраж ведут до десятитысячных, и правка,
// округлённая до сотых, разошлась бы с официальным результатом.
// Возвращаем null, если разобрать не удалось: команда будет отвергнута.
export function normalizeOverride(field, value) {
  if (field === 'penalty') {
    const penalty = Number(value)
    return Number.isInteger(penalty) && penalty >= 0 && penalty <= 999 ? penalty : null
  }

  const match = String(value).trim().match(/^(\d{1,2}):(\d{1,2})(?:[.,](\d{1,4}))?$/)
  if (!match) return null

  const [, mm, ss, frac = '0'] = match
  if (Number(ss) > 59) return null

  return `${mm.padStart(2, '0')}:${ss.padStart(2, '0')}.${frac.padEnd(2, '0')}`
}

// Находит попытку участника, при необходимости заводя пустую. Аварийная
// правка нужна ровно тогда, когда данных нет: строки второй попытки на
// сайте может ещё не быть, а результат уже объявили в эфире.
function attemptSlot(participant, n) {
  if (!participant) return null
  participant.attempts ??= []

  let attempt = participant.attempts.find(a => a.n === n)
  if (!attempt) {
    attempt = { n, time: null, penalty: null }
    participant.attempts.push(attempt)
    participant.attempts.sort((a, b) => a.n - b.n)
  }
  return attempt
}

const hasOverrides = (state, participantId) =>
  Object.keys(state.overrides ?? {}).some(key => key.startsWith(`${participantId}:`))

// Пометка для кадра: попытки этого участника правил оператор, и лучшее
// время сайта посчитано по устаревшим данным. Ставится сразу в момент
// правки — ждать следующего опроса нельзя, эти семь секунд в кадре висело
// бы противоречие: исправленная попытка 01:19.80 при «лучшем» 01:22.61.
function markCorrected(state, participant) {
  if (!participant) return
  if (hasOverrides(state, participant.id)) participant.corrected = true
  else delete participant.corrected
}

export function applyOverrides(state) {
  for (const [key, value] of Object.entries(state.overrides ?? {})) {
    const [participantId, attemptNumber, field] = key.split(':')
    const participant = state.participants.find(p => p.id === participantId)
    const attempt = attemptSlot(participant, Number(attemptNumber))
    if (!attempt) continue

    attempt[field] = value
    participant.corrected = true
  }
}

// Возвращает true, если данные приняты. Пустой или отсутствующий результат
// поверх уже имеющихся участников отвергается: сбой сети или сломанный
// парсинг не должны гасить картинку в эфире.
export function applyParticipants(state, participants) {
  if (!Array.isArray(participants)) return false
  if (participants.length === 0 && state.participants.length > 0) return false

  rehomeManualMarks(state, participants)
  state.participants = participants
  state.lastSuccessfulPoll = Date.now()
  applyOverrides(state)
  return true
}

// Идентификатор участника не вечен: у безномерных он собран из ФИО, и как
// только организатор привяжет профиль, id станет числом. Такие правки
// делают по ходу дня — а руками помечают как раз тех, у кого профиля нет.
// Без переноса пометка молча осиротела бы за час до церемонии: человек уехал
// бы не в свой зачёт, а неявившийся вернулся бы в кадр.
//
// Переносим только при однозначном совпадении ФИО: два тёзки в протоколе —
// повод не трогать ничего, ошибиться здесь дороже, чем оставить как есть.
function rehomeManualMarks(state, next) {
  const byId = new Map(state.participants.map(p => [p.id, p]))
  const arrived = new Set(next.map(p => p.id))

  const fioCount = new Map()
  for (const p of next) fioCount.set(p.fio, (fioCount.get(p.fio) ?? 0) + 1)

  const heirOf = (id) => {
    if (arrived.has(id)) return null

    const fio = byId.get(id)?.fio
    if (!fio || fioCount.get(fio) !== 1) return null

    return next.find(p => p.fio === fio) ?? null
  }

  for (const [what, marks] of [['групп', state.riderGroups], ['явки', state.riderStatus]]) {
    for (const [id, value] of Object.entries(marks ?? {})) {
      const heir = heirOf(id)
      // Своя пометка у наследника важнее: совпадение ФИО не повод
      // перекладывать на него чужую.
      if (!heir || marks[heir.id] !== undefined) continue

      marks[heir.id] = value
      delete marks[id]
      console.log(`[state] пометка ${what} перенесена: ${id} → ${heir.id} (${heir.fio})`)
    }
  }
}

// Группа награждения, выбранная до правки конфига, могла из него исчезнуть:
// её переименовали или убрали. Пульт показал бы пустой селектор, а сцена
// награждения — заголовок несуществующей группы поверх пустого подиума.
// Возвращает true, если пришлось сбросить.
export function syncAwardSubject(state) {
  const subject = state.award?.subject
  if (!subject || subject === UNGROUPED) return false
  if ((state.awardGroups ?? []).some(g => g.name === subject)) return false

  console.warn(`[state] группа награждения «${subject}» исчезла из конфига — сброшено`)
  state.award.subject = null
  return true
}

// Схему могли убрать из конфига, пока сервер лежал: этап кончился, файл
// переложили, поле стёрли. В сохранённом состоянии она при этом осталась
// активной сценой — и поднятый сервер вывел бы в кадр надпись о том, что
// схема не загрузилась. Возвращает true, если пришлось сбрасывать.
export function syncTrackScene(state) {
  if (state.activeScene !== 'track' || state.trackMapUrl) return false

  console.warn('[state] схема трассы исчезла из конфига — кадр возвращён к таблице')
  state.activeScene = 'results'
  return true
}

// Тумблеры кадра: ими распоряжаются и команда пульта ('setSceneOption'),
// и настройки этапа при старте — одни и те же поля состояния.
const SCENE_OPTIONS = ['showRunTime', 'showClassTop', 'resultsByGroup']

// Настройки этапа приезжают в состояние при старте сервера: иначе они
// существовали бы только в event.config.js и ни на что не влияли.
//
// Этап и оформление принадлежат файлу этапа всегда — сохранённое значение
// затирается. Иначе после репетиции на полигоне в пульте показывался бы
// этап из файла состояния, а данные шли бы с боевого.
//
// Тумблеры кадра — наоборот, принадлежат оператору: он переключает их из
// пульта по ходу дня. К концу дня в кадре обычно таблица по группам, по ней
// вручают медали, — и перезапуск сервера в разгар награждения не должен
// молча возвращать разрез по классам. Файл этапа задаёт лишь то, с чего
// день начнётся; перебить выбор оператора можно, назвав тумблер прямо
// в командной строке.
export function applyServerConfig(state, config, { restored } = {}) {
  state.stageId = config.stageId
  state.eventTitle = config.eventTitle
  state.logoUrl = config.logoUrl
  state.logoMarkUrl = config.logoMarkUrl
  // Трасса на этапе одна, и переключать её из пульта незачем: схема
  // принадлежит файлу этапа так же, как логотип.
  state.trackMapUrl = config.trackMapUrl ?? ''
  state.liveStageId = config.liveStageId
  state.highlightTimeout = config.highlightTimeout
  state.awardGroups = config.awardGroups
  state.strictGroups = config.strictGroups

  for (const option of SCENE_OPTIONS) {
    const named = config.sceneOptionsFromEnv?.includes(option)
    if (!restored || named) {
      state[option] = config[option]
    } else if (state[option] !== config[option]) {
      // Расхождение с файлом этапа — обычно след дневной работы пульта.
      // Сказать стоит: иначе оператор гадал бы, почему кадр не такой,
      // как записано в event.config.js.
      console.log(`[state] тумблер ${option} поднят из состояния: ${state[option]} (в файле этапа ${config[option]})`)
    }
  }

  // Показания таймера эфемерны и с диска не поднимаются. Сервер, поднятый
  // посреди дня, видит на табло прибора прошлый результат — и обязан считать
  // это покоем, иначе чужое время подпишется под текущим спортсменом.
  state.timer = null

  // Связь с прибором проверяется заново первым же опросом: за время, пока
  // сервер лежал, прибор могли унести с трассы.
  state.timerLink = null
  state.timerConfigured = Boolean(config.timerUrl)
}

// Хайлайт в поднятом состоянии — след падения, а не намерение оператора:
// нижнюю треть показывают на несколько секунд, и снимает её страховочный
// таймер сервера. Таймер заводится командой пульта, а после падения команды
// не было — вставка осталась бы в кадре до конца дня.
// Возвращает true, если пришлось снимать.
export function clearStaleHighlight(state) {
  if (!state.highlight?.visible) return false

  console.warn('[state] хайлайт остался от прошлого запуска — снят')
  state.highlight = { ...state.highlight, visible: false }
  if (state.activeScene === 'highlight') {
    state.activeScene = state.highlight.returnScene ?? 'results'
  }
  return true
}

// Оператор, выводящий человека в кадр, тем самым утверждает, что тот
// участвует, — сервер обязан это принять. Без снятия карточка приехавшего
// позже спортсмена уехала бы в эфир пустой: времени у первой попытки ещё
// нет, а для сцен отмеченный участник не существует.
function clearNoShow(state, participantId) {
  if (!participantId || !state.riderStatus?.[participantId]) return

  delete state.riderStatus[participantId]
  console.log(`[state] отметка «не явился» снята: ${participantId} вышел в кадр`)
}

export function applyCommand(state, message) {
  const { type, payload } = message || {}

  switch (type) {
    case 'setActiveScene':
      if (!SCENES.includes(payload)) return false
      // Схема без файла показала бы пустой лист с надписью об ошибке.
      // Кнопка в пульте на этот случай погашена, но горячая клавиша прошла
      // бы мимо неё — проверка обязана стоять здесь, у источника правды.
      if (payload === 'track' && !state.trackMapUrl) return false
      state.activeScene = payload
      return true

    case 'setRound':
      if (!ROUNDS.includes(payload)) return false
      state.round = payload
      return true

    case 'setCurrentRun': {
      const participantId = payload?.participantId ?? null
      const attemptLabel = payload?.attemptLabel ?? 'Попытка 1'

      // Тот же заезд — это тот же спортсмен на той же попытке. Команда
      // прилетает и когда оператор дописывает подпись прямо во время
      // проезда: обнулять там показания значило бы гасить живой отсчёт
      // посреди трассы. Вторая попытка — уже другой заезд.
      const sameRun = participantId !== null
        && participantId === state.currentRun.participantId
        && attemptLabel === state.currentRun.attemptLabel

      state.currentRun = {
        participantId,
        attemptLabel,
        caption: payload?.caption ?? '',
        dnf: sameRun ? Boolean(state.currentRun.dnf) : false,
      }

      // Показания предыдущего заезда с новым райдером не переносятся: иначе
      // финишное время предыдущего спортсмена подписалось бы под именем
      // следующего — ошибка, которую в эфире не отличить от правды.
      if (!sameRun) state.timer = null

      clearNoShow(state, participantId)
      return true
    }

    // Сход помечает оператор, как только видит, что спортсмен не доедет, —
    // не дожидаясь остановки таймера. Пометка сильнее показаний моста:
    // пришедший следом финиш в кадр уже не попадёт.
    case 'setRunDnf':
      state.currentRun = { ...state.currentRun, dnf: Boolean(payload) }
      return true

    case 'setSceneOption': {
      if (!SCENE_OPTIONS.includes(payload?.option)) return false

      state[payload.option] = Boolean(payload.value)
      return true
    }

    case 'showHighlight':
      clearNoShow(state, payload?.participantId)
      state.highlight = {
        participantId: payload?.participantId ?? null,
        caption: payload?.caption ?? '',
        visible: true,
        // Сцену запоминаем только на входе в хайлайт: повторный показ
        // поверх уже висящего не должен записать 'highlight' как точку возврата.
        returnScene: state.activeScene === 'highlight'
          ? (state.highlight.returnScene ?? 'results')
          : state.activeScene,
      }
      return true

    case 'hideHighlight':
      state.highlight = { ...state.highlight, visible: false }
      return true

    case 'setAward': {
      const subject = payload?.subject ?? null

      // Неизвестное имя означает, что пульт и сервер разошлись: приняв его,
      // мы вывели бы в кадр заголовок группы, которой нет.
      const known = subject === null
        || subject === UNGROUPED
        || (state.awardGroups ?? []).some(g => g.name === subject)
      if (!known) return false

      // Место на подиуме — 1, 2 или 3, других не бывает. Приняв, скажем,
      // 99, сервер отдал бы в кадр пустую сцену с надписью «призёры
      // появятся, когда будут результаты» — при том, что результаты есть.
      const place = payload?.place ?? 1
      if (!Number.isInteger(place) || place < 1 || place > PODIUM_PLACES) return false

      state.award = { subject, place, showAllThree: Boolean(payload?.showAllThree) }
      return true
    }

    case 'setRiderGroup': {
      const p = state.participants.find(x => x.id === payload?.participantId)
      if (!p) return false

      const groups = payload?.groups ?? null

      // Пустое значение возвращает участника в группу по его классу.
      // Пустой массив — не то же самое: он значит «вне зачёта».
      if (groups === null) {
        delete state.riderGroups[payload.participantId]
        return true
      }
      if (!Array.isArray(groups)) return false

      const known = state.awardGroups ?? []
      const unique = [...new Set(groups)]

      // UNGROUPED сюда не принимается: это вычисляемое место сбора тех, чей
      // класс не нашёлся, а не группа, в которую можно кого-то положить.
      // Хоть одно негодное имя — отвергается вся команда: выполненная
      // наполовину, она оставила бы человека не в тех группах.
      if (unique.some(name => !known.some(g => g.name === name))) return false

      // Жёсткое разделение ограничивает только ввод. Молча усечь до одной
      // группы нельзя: оператор не узнал бы, что половину его команды
      // сервер выбросил, — и человек уехал бы не на ту церемонию.
      if (state.strictGroups && unique.length > 1) return false

      // Порядок конфига, а не кликов: бейджи в строке пульта не должны
      // переставляться от того, в какой последовательности их ставили.
      state.riderGroups[payload.participantId] = known
        .filter(g => unique.includes(g.name))
        .map(g => g.name)
      return true
    }

    // Явка. С сайта она не приходит: у неприехавшего просто нет прокатов,
    // как и у того, кто ещё не стартовал, — различить их может только
    // человек на площадке.
    case 'setRiderStatus': {
      const p = state.participants.find(x => x.id === payload?.participantId)
      if (!p) return false

      const status = payload?.status ?? null

      // Пустое значение снимает отметку: ошибочная явка иначе была бы
      // необратимой, а ставят её утром и по бумажному списку.
      if (status === null) {
        delete state.riderStatus[payload.participantId]
        return true
      }

      // Неизвестное значение означает, что пульт и сервер разошлись. Приняв
      // его, сервер завёл бы статус, которого не понимает ни один потребитель:
      // человек остался бы в кадре, а пульт показывал бы его снятым.
      if (!RIDER_STATUSES.includes(status)) return false

      state.riderStatus[payload.participantId] = status
      return true
    }

    case 'manualOverride': {
      const p = state.participants.find(x => x.id === payload?.participantId)
      if (!p || !Number.isInteger(payload?.attempt)) return false
      if (!['time', 'penalty'].includes(payload?.field)) return false

      const key = overrideKey(payload.participantId, payload.attempt, payload.field)

      // Пустое значение снимает правку и возвращает строку под управление
      // опросчика — иначе ошибочную правку было бы не отменить. Значение
      // сайта возвращаем тут же из снимка: ждать опроса нельзя, ошибочная
      // правка эти секунды была бы в эфире. Попытку при этом не заводим:
      // снятие не должно оставлять после себя строку, которой на сайте нет.
      if (payload.value === '' || payload.value === null) {
        delete state.overrides[key]

        const existing = p.attempts?.find(a => a.n === payload.attempt)
        if (existing && key in state.originals) existing[payload.field] = state.originals[key]
        delete state.originals[key]

        markCorrected(state, p)
        return true
      }

      const value = normalizeOverride(payload.field, payload.value)
      if (value === null) return false

      const attempt = attemptSlot(p, payload.attempt)

      // Снимок берём только на первой правке этого поля: вторая правка
      // поверх первой должна откатываться к данным сайта, а не к промежуточному
      // значению, которое оператор уже забраковал.
      if (!(key in state.originals)) state.originals[key] = attempt[payload.field] ?? null

      state.overrides[key] = value
      attempt[payload.field] = value
      markCorrected(state, p)
      return true
    }

    default:
      return false
  }
}

// Пишем рядом и переставляем именем. Файл переписывается тысячи раз за день:
// после каждой команды пульта и каждого удачного опроса. Записи прямо в
// боевой файл хватило бы одного обрыва в неудачный момент — крышка, разряд,
// kill, — чтобы на диске осталась половина JSON, а с ней пропали правки и
// пометки групп за весь день. rename в пределах одной папки атомарен: на
// диске в любой момент лежит либо прошлое состояние целиком, либо новое.
export function saveState(state, path) {
  const tmp = `${path}.tmp`
  try {
    writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8')
    renameSync(tmp, path)
  } catch (err) {
    console.error('[state] не удалось сохранить:', err.message)
  }
}

// Вложенные объекты сливаются по полям, а не заменяются целиком: state.json
// мог быть записан прошлой версией, где какого-то поля ещё не было, —
// и в эфир ушло бы состояние с дырой вместо значения по умолчанию.
//
// Возвращает ещё и признак восстановления: поднятое с диска состояние
// сервер уважает больше, чем настройки из файла этапа (server/index.js).
export function readStateFile(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf-8')
  } catch {
    // Файла нет — обычный первый запуск этапа, а не поломка.
    return { state: createDefaultState(), restored: false }
  }

  let saved
  try {
    saved = JSON.parse(raw)
  } catch (err) {
    // Молча начать с чистого листа нельзя: следующая же запись затрёт
    // остаток, и восстанавливать будет нечего. Откладываем копию и говорим
    // вслух — оператор увидит это в журнале и успеет позвать на помощь.
    const copy = `${path}.broken`
    try {
      copyFileSync(path, copy)
      console.error(`[state] файл состояния повреждён (${err.message}). Копия: ${copy}`)
    } catch {
      console.error(`[state] файл состояния повреждён (${err.message}), и копию отложить не удалось`)
    }
    console.error('[state] день начнётся с чистого состояния: правки и пометки групп придётся расставить заново')
    return { state: createDefaultState(), restored: false }
  }

  const state = createDefaultState()
  for (const [key, value] of Object.entries(saved ?? {})) {
    if (value === null || value === undefined) continue

    const base = state[key]
    const bothPlainObjects = base && typeof base === 'object' && !Array.isArray(base)
      && value && typeof value === 'object' && !Array.isArray(value)

    state[key] = bothPlainObjects ? { ...base, ...value } : value
  }

  state.riderGroups = normalizeRiderGroups(state.riderGroups)
  state.riderStatus = normalizeRiderStatus(state.riderStatus)
  return { state, restored: true }
}

export const loadState = (path) => readStateFile(path).state
