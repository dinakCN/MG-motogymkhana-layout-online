// ────────────────────────────────────────────────────────────────────────
// Арифметика результата. Проверена на протоколе этапа 670 (test/fixtures):
// у всех участников наш расчёт совпадает с тем, что посчитал сайт.
//
// Два правила, снятые с реальных данных:
//   1. Результат попытки = время + штраф, штраф в секундах.
//      Стажко: 01:21.61 + 1 → сайт показывает 01:22.61.
//   2. Сход записывается как 59:59.99 и в зачёт не идёт.
//      Буланов: 01:38.80+4 и 59:59.99 → сайт показывает 01:42.80.
// ────────────────────────────────────────────────────────────────────────

// Два разных исхода, и путать их нельзя.
//
// «сход» — заезд не завершён: 59:59.99 в протоколе.
// «незачёт» — трасса пройдена, время намерено, но результат не засчитан
// по спортивным причинам; на сайте такая попытка зачёркнута.
//
// Спортсмену эта разница видна сразу, и назвать незачёт сходом в эфире —
// сказать неправду о его заезде.
export const DNF_LABEL = 'сход'
export const NOT_COUNTED_LABEL = 'незачёт'
export const NO_RESULT_LABELS = [DNF_LABEL, NOT_COUNTED_LABEL]

// Всё, что дольше десяти минут, — не заезд. Так на сайте помечают
// незавершённую попытку (59:59.99), и порог с запасом накрывает любую
// подобную заглушку: самый долгий реальный заезд в протоколе — 3:47.
const NOT_A_RESULT_FROM = 600

// Точность не зашита: хронометраж ведут до десятитысячных, а сайт сегодня
// печатает сотые. Разбираем сколько дали и столько же возвращаем — округлять
// чужой результат до привычных двух знаков мы не вправе.
const MAX_FRACTION_DIGITS = 4

export function parseTimeToSeconds(value) {
  if (!value) return null
  const match = String(value).match(/^(\d+):(\d+)\.(\d+)$/)
  if (!match) return null
  const [, mm, ss, frac] = match
  return Number(mm) * 60 + Number(ss) + Number(`0.${frac}`)
}

// Сколько знаков после точки в записи времени: 01:23.72 → 2, 01:23.7215 → 4.
export function fractionDigits(time) {
  const frac = String(time ?? '').match(/^\d+:\d+\.(\d+)$/)?.[1]
  return frac ? Math.min(frac.length, MAX_FRACTION_DIGITS) : 2
}

export function formatSeconds(seconds, digits = 2) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return null

  const d = Math.min(Math.max(digits, 1), MAX_FRACTION_DIGITS)

  // Округляем до нужного знака ДО разбора на минуты: 59.999 иначе дало бы
  // «60.00» в секундах вместо «01:00.00».
  const scale = 10 ** d
  const total = Math.round(seconds * scale) / scale
  const mm = Math.floor(total / 60)
  const ss = total - mm * 60

  return `${String(mm).padStart(2, '0')}:${ss.toFixed(d).padStart(d + 3, '0')}`
}

// Сход — не медленный заезд, а его отсутствие. Показывать 59:59.99
// в кадре нельзя: зритель прочитает это как результат.
export function isDnf(time) {
  const seconds = parseTimeToSeconds(time)
  return seconds !== null && seconds >= NOT_A_RESULT_FROM
}

// Заваленная попытка. На сайте она зачёркнута, и время у неё бывает
// обычным: Крюкова проехала 03:47.90, но в зачёт это не пошло. Величина
// времени тут ничего не решает — решает пометка протокола, поэтому
// зачёркивание проверяем первым, а порог держим страховкой на случай,
// если разметку на сайте поменяют.
export function isScratched(attempt) {
  return Boolean(attempt?.scratched) || isDnf(attempt?.time)
}

// Результат попытки в секундах: время плюс штраф. null — попытки не было
// или она не засчитана.
export function attemptTotal(attempt) {
  if (isScratched(attempt)) return null

  const time = parseTimeToSeconds(attempt?.time)
  if (time === null) return null
  return time + (attempt.penalty || 0)
}

// Лучшее время в секундах — для сравнений и отставаний.
// Готовое значение сайта в приоритете: расходиться с официальным
// протоколом в прямом эфире недопустимо.
// Правка оператора отменяет доверие к готовому значению: раз попытки
// исправляли руками, лучшее время сайта посчитано по старым данным
// (`corrected` ставит applyOverrides в server/state.js).
const trustSite = participant => Boolean(participant?.bestTime) && !participant?.corrected

export function bestSeconds(participant) {
  const fromSite = trustSite(participant) ? parseTimeToSeconds(participant.bestTime) : null
  if (fromSite !== null) return fromSite >= NOT_A_RESULT_FROM ? null : fromSite

  return bestAttempt(participant)?.total ?? null
}

// Лучшая засчитанная попытка вместе с её точностью: показать результат
// с большим числом знаков, чем намерил хронометраж, нельзя.
function bestAttempt(participant) {
  let best = null
  for (const attempt of participant?.attempts || []) {
    const total = attemptTotal(attempt)
    if (total === null) continue
    if (best === null || total < best.total) {
      best = { total, digits: fractionDigits(attempt.time) }
    }
  }
  return best
}

// Лучшее время для показа: строка протокола, «сход» или null («ещё не ехал»).
// Считаем сами только там, где у сайта значения нет, — и по тем же
// правилам, что и он: с штрафом и без учёта сходов.
export function bestOf(participant) {
  if (trustSite(participant)) {
    return isDnf(participant.bestTime) ? DNF_LABEL : participant.bestTime
  }

  const best = bestAttempt(participant)
  if (best) return formatSeconds(best.total, best.digits)

  // Засчитанных попыток нет. Что написать — зависит от того, что случилось:
  // трассу прошёл, но не зачли, или не доехал вовсе. Пройденная трасса
  // весомее: человек проехал, и «сход» о нём был бы неправдой.
  const attempts = participant?.attempts || []
  if (attempts.some(a => a.time && !isDnf(a.time))) return NOT_COUNTED_LABEL
  if (attempts.some(a => isDnf(a.time))) return DNF_LABEL

  return null
}

// Время попытки для показа: сход словом, чтобы 59:59.99 не ушло в кадр
// числом. Заваленную попытку с обычным временем показываем как есть —
// зачёркнутой, как в протоколе: зритель видит, что заезд был, и что он
// не в зачёт.
export function attemptLabel(attempt) {
  if (!attempt?.time) return null
  return isDnf(attempt.time) ? DNF_LABEL : attempt.time
}

// Отставание от лидера. Знак обязан быть верным: если данные разъехались
// и участник оказался быстрее «лидера» по местам, «+-0.40» выглядело бы
// как опечатка в эфире.
export function formatDelta(seconds, digits = 2) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—'

  const d = Math.min(Math.max(digits, 1), MAX_FRACTION_DIGITS)

  // Нулём считаем то, что неразличимо в показанной точности. Иначе при
  // хронометраже до десятитысячных два разных результата выглядели бы
  // одинаково — «+0.00» вместо «+0.0012».
  if (Math.abs(seconds) < 0.5 / 10 ** d) return '—'

  return `${seconds > 0 ? '+' : '−'}${Math.abs(seconds).toFixed(d)}`
}

export function groupByClass(participants) {
  const groups = []
  const index = new Map()

  for (const rider of participants) {
    const name = rider.sportClass || 'Без класса'
    if (!index.has(name)) {
      index.set(name, { sportClass: name, classColor: rider.classColor, riders: [] })
      groups.push(index.get(name))
    }
    index.get(name).riders.push(rider)
  }
  return groups
}

// Порядок в классе — по официальным местам. Пока сайт их не проставил
// (начало дня, первые заезды), выстраиваем по лучшему времени: иначе
// топ-5 показывал бы случайный порядок из таблицы. Сошедшие и не
// стартовавшие уходят в конец.
export function topOfClass(participants, sportClass, limit = 5) {
  return participants
    .filter(p => (p.sportClass || 'Без класса') === sportClass)
    .map((rider, order) => ({ rider, order, seconds: bestSeconds(rider) }))
    .sort((a, b) =>
      (a.rider.placeInClass ?? Infinity) - (b.rider.placeInClass ?? Infinity)
      || (a.seconds ?? Infinity) - (b.seconds ?? Infinity)
      || a.order - b.order,
    )
    .slice(0, limit)
    .map(x => x.rider)
}

// Топ класса, в котором последнюю строку занимает текущий райдер, если сам
// он в срез не попал. Пять строк держали контекст сами собой — в трёх
// спортсмен выпадает, и блок превращается в список чужих фамилий.
export function topWithRider(participants, sportClass, riderId, limit = 3) {
  const top = topOfClass(participants, sportClass, limit)
  if (!riderId || top.some(p => p.id === riderId)) return top

  const rider = participants.find(
    p => p.id === riderId && (p.sportClass || 'Без класса') === sportClass,
  )
  if (!rider || top.length < limit) return top

  return [...top.slice(0, limit - 1), rider]
}

// Результат попытки для показа рядом с живым временем. В отличие от
// attemptLabel зачёркнутая попытка называется словом: в зоне времени она
// стоит эталоном для сравнения, а сравнивать с незасчитанным нечего, и
// показанное там время читалось бы как действующий результат.
export function attemptResultLabel(attempt) {
  if (!attempt?.time) return null
  if (isDnf(attempt.time)) return DNF_LABEL
  if (isScratched(attempt)) return NOT_COUNTED_LABEL

  return formatSeconds(attemptTotal(attempt), fractionDigits(attempt.time))
}

// Разница показанного времени с результатом попытки n. Живой отсчёт про
// штраф не знает, а результат попытки — знает: сравниваем с тем, что пойдёт
// в протокол, иначе «улучшил» в кадре разошлось бы с итоговой таблицей.
export function deltaToAttempt(seconds, participant, n) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return null

  const attempt = (participant?.attempts || []).find(a => a.n === n)
  const total = attemptTotal(attempt)
  if (total === null) return null

  return seconds - total
}

// Часы живого отсчёта. Доли отбрасываем, а не округляем — иначе на 01:22.6
// в кадре стояло бы 01:23, и переход к точному финишному времени выглядел бы
// как шаг назад.
//
// Знаков после точки столько, сколько успевает показать кадр. При 25 кадрах
// в секунду это десятые: они меняются раз в два с половиной кадра и читаются
// как счёт. Сотые менялись бы вчетверо чаще, чем кадр успевает смениться, —
// последний разряд превратился бы в рябь. Точности хватает: точка старта
// восстанавливается с ошибкой около 23 мс, то есть десятая цифра верна.
export function formatClock(seconds, digits = 0) {
  const d = Math.min(Math.max(digits, 0), MAX_FRACTION_DIGITS)
  const scale = 10 ** d

  const total = Math.max(0, Math.floor((seconds || 0) * scale)) / scale
  const mm = Math.floor(total / 60)
  const ss = total - mm * 60

  const body = d ? ss.toFixed(d).padStart(d + 3, '0') : String(ss).padStart(2, '0')
  return `${String(mm).padStart(2, '0')}:${body}`
}

// Возраст данных считается по часам той машины, где открыт пульт, а метка
// приходит с сервера. Часы могут разойтись, и «обновлено −4 с назад»
// в строке состояния читалось бы как поломка. Ниже нуля не опускаемся.
export function secondsSince(timestamp) {
  if (!timestamp) return null
  return Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
}
