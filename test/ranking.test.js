import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseStage, LAYOUT } from '../server/parser.js'
import { bestOf, bestSeconds, topOfClass } from '../app/src/shared/format.js'
import { podiumOf } from '../app/src/shared/awardGroups.js'

// На странице этапа два зачёта: наш — по классам, второй — по группам
// награждения (Новички, Любители, Спортсмены, ПРО) со своими местами.
// Второй разбираем тем же парсером через подмену селектора и сверяем
// с ним подиумы: это единственный способ проверить награждение на
// настоящих данных, а не на придуманных.
const CATEGORIES = { ...LAYOUT, table: 'div.show-pk table.results:not(.results-with-img)' }

// Сверка порядка с официальным протоколом. Места расставляет сайт, но
// топ-5 класса в кадре выстраиваем мы — и до того, как сайт проставит
// места, порядок целиком наш. Разойтись с протоколом в эфире нельзя,
// поэтому проверяем на настоящих этапах, а не на придуманных данных.
//
// 670 — Кубок Орловской области, 22 участника, 7 классов, есть сход.
// 679 — Кубок Федерации (Воронеж), 54 участника, 10 классов, четыре схода.
const STAGES = ['670', '679']

const load = id => parseStage(readFileSync(new URL(`./fixtures/stage${id}.html`, import.meta.url), 'utf-8'))

describe.each(STAGES)('этап %s — порядок совпадает с протоколом', (id) => {
  const list = load(id)

  it('участники и классы разобраны', () => {
    expect(list.length).toBeGreaterThan(20)
    expect(new Set(list.map(p => p.sportClass)).size).toBeGreaterThan(4)
  })

  // Сортировку проверяем на данных без мест: так выглядит таблица в начале
  // дня, когда результаты уже есть, а места сайт ещё не проставил.
  it('внутри класса наш порядок по времени совпадает с местами сайта', () => {
    const расхождения = []

    for (const cls of new Set(list.map(p => p.sportClass))) {
      const сайт = list
        .filter(p => p.sportClass === cls && p.placeInClass != null)
        .sort((a, b) => a.placeInClass - b.placeInClass)
        .map(p => p.fio)

      const наш = topOfClass(list.map(p => ({ ...p, placeInClass: null })), cls, 99)
        .filter(p => сайт.includes(p.fio))
        .map(p => p.fio)

      if (JSON.stringify(наш) !== JSON.stringify(сайт)) расхождения.push({ cls, сайт, наш })
    }

    expect(расхождения).toEqual([])
  })

  it('вне класса порядок по лучшему времени совпадает с местами сайта', () => {
    const сместом = list.filter(p => p.placeOverall != null)

    const сайт = [...сместом].sort((a, b) => a.placeOverall - b.placeOverall).map(p => p.fio)
    const наш = [...сместом].sort((a, b) => bestSeconds(a) - bestSeconds(b)).map(p => p.fio)

    expect(наш).toEqual(сайт)
  })

  // Сайт сошедшим мест не даёт вовсе — и мы не должны ставить их в топ.
  it('сошедшим сайт не даёт мест', () => {
    for (const p of list.filter(p => bestOf(p) === 'сход')) {
      expect(p.placeInClass, p.fio).toBeNull()
      expect(p.placeOverall, p.fio).toBeNull()
      expect(bestSeconds(p), p.fio).toBeNull()
    }
  })

  it('ни один сошедший не стоит выше участника с результатом', () => {
    for (const cls of new Set(list.map(p => p.sportClass))) {
      const порядок = topOfClass(list, cls, 99).map(p => bestSeconds(p) !== null)
      const первыйБезРезультата = порядок.indexOf(false)

      if (первыйБезРезультата !== -1) {
        expect(порядок.slice(первыйБезРезультата).some(Boolean), cls).toBe(false)
      }
    }
  })

  it('лучшее время у всех совпадает с посчитанным сайтом', () => {
    const расхождения = list
      .filter(p => p.bestTime)
      .map(p => ({ fio: p.fio, сайт: p.bestTime, наш: bestOf({ ...p, bestTime: null }) }))
      .filter(x => x.сайт !== x.наш)

    expect(расхождения).toEqual([])
  })
})

describe.each(STAGES)('этап %s — подиум группы совпадает с протоколом', (id) => {
  const html = readFileSync(new URL(`./fixtures/stage${id}.html`, import.meta.url), 'utf-8')
  const list = parseStage(html)
  const cats = parseStage(html, CATEGORIES)
  const names = [...new Set(cats.map(p => p.sportClass))]

  it('второй зачёт разобран и групп в нём несколько', () => {
    expect(cats.length).toBe(list.length)
    expect(names.length).toBeGreaterThan(2)
  })

  it.each(names.length ? names : ['—'])('группа «%s»', (name) => {
    const состав = cats.filter(c => c.sportClass === name).map(c => c.fio)
    const участники = list.filter(p => состав.includes(p.fio))

    // Состав задаём вручную: на этих этапах группы другие, чем в боевом
    // конфиге, и берём мы их из самого протокола.
    const наш = podiumOf(
      участники,
      name,
      [{ name, classes: [] }],
      Object.fromEntries(участники.map(p => [p.id, name])),
    ).map(p => p.fio)

    const сайт = cats
      .filter(c => c.sportClass === name && c.placeInClass != null)
      .sort((a, b) => a.placeInClass - b.placeInClass)
      .slice(0, 3)
      .map(c => c.fio)

    expect(наш).toEqual(сайт)
  })
})

describe('этап 679 — на нём есть то, чего нет в 670', () => {
  const list = load('679')

  it('четыре схода, и все без мест', () => {
    expect(list.filter(p => bestOf(p) === 'сход')).toHaveLength(4)
  })

  it('классы от A до N разобраны все', () => {
    expect([...new Set(list.map(p => p.sportClass))].sort())
      .toEqual(['A', 'B', 'C1', 'C2', 'C3', 'D1', 'D2', 'D3', 'D4', 'N'])
  })
})
