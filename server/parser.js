import * as cheerio from 'cheerio'

// ────────────────────────────────────────────────────────────────────────
// Разметка чужого сайта. Единственное место, которое приходится править,
// если на gymkhana-cup.ru переставят колонки или переименуют таблицу.
// Порядок починки — в ARCHITECTURE.md, раздел «Парсер сломался».
// ────────────────────────────────────────────────────────────────────────
export const LAYOUT = {
  // На странице несколько таблиц, включая мобильную копию тех же данных.
  // Берём только десктопную, иначе участники удвоятся.
  table: 'div.show-pk table.results.results-with-img',

  // Порядок колонок: класс, место в классе, №, участник, мотоцикл,
  // попытка, время, штраф, лучшее время, место вне класса, рейтинг.
  // Заголовки таблицы на сайте — картинки, поэтому привязка только к индексу.
  columns: {
    CLASS: 0, PLACE_IN_CLASS: 1, NUMBER: 2, PARTICIPANT: 3, MOTORCYCLE: 4,
    ATTEMPT: 5, TIME: 6, PENALTY: 7, BEST: 8, PLACE_OVERALL: 9, RATING: 10,
  },

  // Ячейки, общие для всех попыток участника, вынесены через rowspan:
  // строка-начало участника несёт их все, строка-продолжение — только
  // попытку, время и штраф. Отличаем одну от другой по числу ячеек.
  newParticipantCells: 9,

  // Цвет класса живёт в CSS-классе строки, а не в тексте.
  colorByCss: {
    'result-blue': 'blue',
    'result-green': 'green',
    'result-yellow': 'yellow',
    'result-white': 'white',
  },
}

function textOrNull(value) {
  const t = (value || '').trim()
  return t === '' ? null : t
}

function intOrNull(value) {
  const t = (value || '').trim().replace(/\.$/, '')
  if (t === '') return null
  const n = Number.parseInt(t, 10)
  return Number.isNaN(n) ? null : n
}

// Запасной ключ для участника без ссылки на профиль.
// Считается только от ФИО, чтобы оставаться неизменным между опросами:
// номер и класс могут проставить по ходу дня.
function hashName(fio) {
  let h = 0
  for (let i = 0; i < fio.length; i += 1) {
    h = (h * 31 + fio.charCodeAt(i)) | 0
  }
  return `anon-${Math.abs(h).toString(36)}`
}

function colorFromRow($row, colorByCss = {}) {
  const css = ($row.attr('class') || '').split(/\s+/)
  for (const name of css) {
    if (colorByCss[name]) return colorByCss[name]
  }
  return 'unknown'
}

function parseParticipantCell($, cell) {
  const $cell = $(cell)
  const link = $cell.find('a').first()
  const href = link.attr('href') || ''
  const match = href.match(/id=(\d+)/)

  // ФИО и город лежат в одной ячейке и разделены <br>.
  const parts = ($cell.html() || '').split(/<br\s*\/?>/i)
  const cityHtml = parts.length > 1 ? parts.slice(1).join(' ') : ''

  return {
    athleteId: match ? match[1] : null,
    fio: link.text().trim() || cheerio.load(`<i>${parts[0] || ''}</i>`)('i').text().trim(),
    city: cheerio.load(`<i>${cityHtml}</i>`)('i').text().trim(),
  }
}

export function parseStage(html, layout = LAYOUT) {
  if (!html) return []

  const COL = layout.columns

  let $
  try {
    $ = cheerio.load(html)
  } catch {
    return []
  }

  const table = $(layout.table).first()
  if (table.length === 0) return []

  const participants = []

  table.find('tbody > tr').each((_, row) => {
    const $row = $(row)
    const cells = $row.children('td').toArray()

    const isNewParticipant = cells.length >= layout.newParticipantCells

    if (isNewParticipant) {
      const { athleteId, fio, city } = parseParticipantCell($, cells[COL.PARTICIPANT])
      if (!fio) return

      participants.push({
        id: athleteId || hashName(fio),
        athleteId,
        sportClass: $(cells[COL.CLASS]).text().trim(),
        classColor: colorFromRow($row, layout.colorByCss),
        number: intOrNull($(cells[COL.NUMBER]).text()),
        fio,
        city,
        motorcycle: $(cells[COL.MOTORCYCLE]).text().trim(),
        attempts: [{
          n: intOrNull($(cells[COL.ATTEMPT]).text()) || 1,
          time: textOrNull($(cells[COL.TIME]).text()),
          penalty: intOrNull($(cells[COL.PENALTY]).text()),
        }],
        bestTime: textOrNull($(cells[COL.BEST]).text()),
        placeInClass: intOrNull($(cells[COL.PLACE_IN_CLASS]).text()),
        placeOverall: intOrNull($(cells[COL.PLACE_OVERALL]).text()),
        // На незаполненном этапе в ячейке остаётся голый знак процента —
        // это не значение, а пустота.
        rating: textOrNull($(cells[COL.RATING]).text().trim().replace(/^%$/, '')),
      })
      return
    }

    const current = participants[participants.length - 1]
    if (!current || cells.length < 3) return

    current.attempts.push({
      n: intOrNull($(cells[0]).text()) || current.attempts.length + 1,
      time: textOrNull($(cells[1]).text()),
      penalty: intOrNull($(cells[2]).text()),
    })
  })

  return participants
}
