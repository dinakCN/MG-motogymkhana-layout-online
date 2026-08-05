import eventConfig from '../event.config.js'

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
    highlightTimeout: Number(env.HIGHLIGHT_TIMEOUT) || Number(event.highlightTimeout) || 6000,
    showRunTime: env.SHOW_RUN_TIME ? env.SHOW_RUN_TIME !== '0' : event.showRunTime !== false,
    showClassTop: env.SHOW_CLASS_TOP ? env.SHOW_CLASS_TOP !== '0' : event.showClassTop !== false,
    // Переопределения переменной окружения у групп нет: подменять состав
    // награждения из командной строки незачем, а лишний способ ошибиться
    // перед эфиром стоит дороже гибкости.
    awardGroups: Array.isArray(event.awardGroups) ? event.awardGroups : [],
  }
}

export const config = loadConfig()
