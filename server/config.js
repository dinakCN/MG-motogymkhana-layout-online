import eventConfig from '../event.config.js'
import { UNGROUPED } from './state.js'

const URL_RE = /^https?:\/\//i
const ID_IN_URL = /[?&]id=(\d+)/

// Этап задают номером или полной ссылкой. Номер из ссылки всё равно
// вытаскиваем: им подписан пульт и назван файл состояния, и по нему
// сервер понимает, боевой этап в эфире или полигон.
export function resolveStage(value, template) {
  const raw = String(value ?? '').trim()

  // Пустой этап означал бы опрос по адресу без номера: сервер поднялся бы,
  // а данные не пришли бы никогда. Лучше не запуститься и сказать почему.
  if (!raw) {
    throw new Error('Не задан этап: впишите номер или ссылку в event.config.js (поле stage) либо запустите с STAGE=…')
  }

  if (!URL_RE.test(raw)) {
    return { stageId: raw, stageUrl: template.replace('{id}', raw) }
  }

  // Ссылка без узнаваемого id — этапу нужно хоть какое-то имя, пригодное
  // для имени файла: иначе состояние двух таких этапов легло бы в один.
  const id = raw.match(ID_IN_URL)?.[1]
    ?? raw.replace(URL_RE, '').replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 40)

  return { stageId: id, stageUrl: raw }
}

// Таймер задают адресом прибора или полной ссылкой — как и этап.
// Пусто означает «таймера нет»: сервер просто не заводит второй опрос,
// а зона времени в кадре показывает время первой попытки.
export function resolveTimerUrl(value) {
  const raw = String(value ?? '').trim()
  if (!raw || raw === '0') return null

  return URL_RE.test(raw) ? raw : `http://${raw}/laptime`
}

// Опечатки в составе групп ничем себя не проявляют: «Вне групп» не
// появится, счётчики сойдутся, а человек уедет не в свой зачёт или
// оператор увидит в списке два одинаковых пункта. Поэтому конфиг
// проверяется отдельно — тестом перед эфиром и логом при старте.
export function awardGroupsProblems(groups = []) {
  const problems = []
  const seen = new Set()

  for (const group of groups) {
    if (group.name === UNGROUPED) {
      problems.push(`группа «${group.name}» называется как место сбора аномалий — они сольются в один пункт`)
    }
    if (seen.has(group.name)) {
      problems.push(`группа «${group.name}» задана дважды — в пульте это два неразличимых пункта`)
    }
    seen.add(group.name)
  }

  const owner = new Map()
  for (const group of groups) {
    for (const sportClass of group.classes ?? []) {
      const first = owner.get(sportClass)
      if (first) {
        problems.push(`класс ${sportClass} есть и в «${first}», и в «${group.name}» — участники уедут в первую`)
      } else {
        owner.set(sportClass, group.name)
      }
    }
  }

  return problems
}

export function loadConfig(env = process.env, event = eventConfig) {
  const template = event.stageUrlTemplate || 'https://gymkhana-cup.ru/competitions/stage?id={id}'

  // Знак для угла необязателен: без него в кадре встанет обычный логотип —
  // мелко, но узнаваемо. Пустой src был бы хуже: <img> с ним тянет саму
  // страницу оверлея и рисует в углу битую картинку.
  const logoUrl = env.LOGO || event.logo || '/assets/logo.png'

  // STAGE_ID оставлен рядом со STAGE: он записан в готовых шпаргалках
  // и в истории команд, и в день эфира менять его некогда.
  const live = resolveStage(event.stage, template)
  const current = resolveStage(env.STAGE || env.STAGE_ID || event.stage, template)

  return {
    port: Number(env.PORT) || Number(event.port) || 4300,
    eventTitle: event.eventTitle,
    logoUrl,
    logoMarkUrl: env.LOGO_MARK || event.logoMark || logoUrl,
    stageId: current.stageId,
    stageUrl: current.stageUrl,
    liveStageId: live.stageId,
    pollInterval: Number(env.POLL_INTERVAL) || Number(event.pollInterval) || 7000,
    // TIMER=0 гасит таймер, не трогая event.config.js: на репетиции прибора
    // может не быть, а лезть в файл перед эфиром — лишний способ ошибиться.
    timerUrl: resolveTimerUrl(env.TIMER ?? event.timer),
    timerPollInterval: Number(env.TIMER_POLL) || Number(event.timerPollInterval) || 300,
    highlightTimeout: Number(env.HIGHLIGHT_TIMEOUT) || Number(event.highlightTimeout) || 6000,
    showRunTime: env.SHOW_RUN_TIME ? env.SHOW_RUN_TIME !== '0' : event.showRunTime !== false,
    showClassTop: env.SHOW_CLASS_TOP ? env.SHOW_CLASS_TOP !== '0' : event.showClassTop !== false,
    // Умолчание обратное соседям выше: таблица группируется по классам, как
    // и раньше. Места в классе считает сайт, и такая таблица сверяется
    // с протоколом строка в строку; по группам их считаем мы.
    resultsByGroup: env.RESULTS_BY_GROUP ? env.RESULTS_BY_GROUP !== '0' : event.resultsByGroup === true,
    // Переопределения переменной окружения у групп нет: подменять состав
    // награждения из командной строки незачем, а лишний способ ошибиться
    // перед эфиром стоит дороже гибкости.
    awardGroups: Array.isArray(event.awardGroups) ? event.awardGroups : [],
    // Строгое разделение — свойство положения о соревновании, а не решение
    // оператора в эфире: правится тем же файлом, что и состав групп.
    // Умолчание строгое: один участник — одна группа. Двойной зачёт
    // бывает нужен (Круизер и SB определяет мотоцикл, а не мастерство),
    // но включать его должен тот, кто прочитал положение этапа, — иначе
    // человек молча окажется в двух церемониях, где ждали одну.
    strictGroups: event.strictGroups !== false,
  }
}

export const config = loadConfig()
