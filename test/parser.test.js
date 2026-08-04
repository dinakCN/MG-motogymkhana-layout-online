import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseStage, LAYOUT } from '../server/parser.js'

const html670 = readFileSync(new URL('./fixtures/stage670.html', import.meta.url), 'utf-8')
const html677 = readFileSync(new URL('./fixtures/stage677.html', import.meta.url), 'utf-8')

describe('parseStage — этап с результатами (670)', () => {
  const list = parseStage(html670)

  it('находит 22 участников и не удваивает их мобильной таблицей', () => {
    expect(list).toHaveLength(22)
  })

  it('разбирает первого участника целиком', () => {
    const p = list[0]
    expect(p.sportClass).toBe('C1')
    expect(p.number).toBe(88)
    expect(p.fio).toBe('Акимов Александр')
    expect(p.city).toBe('Тула')
    expect(p.motorcycle).toBe('Honda CBR Frankenstein RR')
    expect(p.placeInClass).toBe(1)
    expect(p.placeOverall).toBe(2)
    expect(p.bestTime).toBe('01:23.50')
    expect(p.rating).toBe('113.78%')
  })

  it('собирает обе попытки со своими временем и штрафом', () => {
    const p = list[0]
    expect(p.attempts).toHaveLength(2)
    expect(p.attempts[0]).toEqual({ n: 1, time: '01:23.72', penalty: 0 })
    expect(p.attempts[1]).toEqual({ n: 2, time: '01:23.50', penalty: 0 })
  })

  it('у всех участников есть athleteId и он же служит id', () => {
    expect(list.every(p => p.athleteId !== null)).toBe(true)
    expect(list.every(p => p.id === p.athleteId)).toBe(true)
  })

  it('id уникальны — иначе TransitionGroup сломается', () => {
    expect(new Set(list.map(p => p.id)).size).toBe(list.length)
  })
})

describe('parseStage — боевой этап без результатов (677)', () => {
  const list = parseStage(html677)

  it('находит все 39 участников', () => {
    expect(list).toHaveLength(39)
  })

  it('пустые результаты дают null, а не пустые строки и не падение', () => {
    const p = list.find(x => x.fio === 'Болдов Иван')
    expect(p.sportClass).toBe('C3')
    expect(p.number).toBe(28)
    expect(p.attempts[0].time).toBeNull()
    expect(p.attempts[0].penalty).toBeNull()
    expect(p.bestTime).toBeNull()
    expect(p.placeInClass).toBeNull()
    expect(p.rating).toBeNull()
  })

  it('участник без номера разбирается, номер равен null', () => {
    const p = list.find(x => x.fio === 'Филимонов Ефим')
    expect(p.number).toBeNull()
    expect(p.sportClass).toBe('B')
    expect(p.city).toBe('Северск')
  })

  it('участник без класса не ломает разбор', () => {
    const noClass = list.filter(p => p.sportClass === '')
    expect(noClass).toHaveLength(1)
  })

  it('цвет класса снимается с CSS-класса строки', () => {
    expect(list.find(p => p.sportClass === 'B').classColor).toBe('blue')
    expect(list.find(p => p.sportClass === 'C3').classColor).toBe('green')
    expect(list.find(p => p.sportClass === 'D1').classColor).toBe('yellow')
    expect(list.find(p => p.sportClass === 'N').classColor).toBe('white')
  })

  it('D1 и D3 окрашены одинаково — цвет не различает классы', () => {
    const d1 = list.find(p => p.sportClass === 'D1')
    const d3 = list.find(p => p.sportClass === 'D3')
    expect(d1.classColor).toBe(d3.classColor)
  })

  it('участнику без athleteId выдаётся запасной стабильный id', () => {
    const anon = list.filter(p => p.athleteId === null)
    expect(anon.length).toBeGreaterThan(0)
    expect(anon.every(p => p.id.startsWith('anon-'))).toBe(true)
  })

  it('повторный разбор того же HTML даёт те же id', () => {
    const again = parseStage(html677)
    expect(again.map(p => p.id)).toEqual(list.map(p => p.id))
  })

  it('у каждого участника ровно две попытки', () => {
    expect(list.every(p => p.attempts.length === 2)).toBe(true)
  })
})

// Если сайт переставит колонки или переименует таблицу, чинить придётся
// LAYOUT — эти тесты проверяют, что править действительно достаточно его.
describe('parseStage — разметка сайта вынесена в LAYOUT', () => {
  it('таблицу ищет по селектору из LAYOUT', () => {
    const custom = { ...LAYOUT, table: 'table.нет-такой' }
    expect(parseStage(html670, custom)).toEqual([])
  })

  it('переставленные колонки чинятся правкой индексов, без правки кода', () => {
    // как если бы на сайте поменяли местами «класс» и «место в классе»
    const swapped = {
      ...LAYOUT,
      columns: { ...LAYOUT.columns, CLASS: 1, PLACE_IN_CLASS: 0 },
    }
    const p = parseStage(html670, swapped)[0]

    expect(p.sportClass).toBe('1')
    expect(p.placeInClass).toBeNull()
  })

  it('цвета классов берутся из LAYOUT', () => {
    const custom = { ...LAYOUT, colorByCss: { 'result-green': 'изумруд' } }
    const list = parseStage(html677, custom)

    expect(list.find(p => p.sportClass === 'C3').classColor).toBe('изумруд')
    expect(list.find(p => p.sportClass === 'B').classColor).toBe('unknown')
  })
})

describe('parseStage — устойчивость', () => {
  it('на мусоре возвращает пустой массив, а не бросает', () => {
    expect(parseStage('<html><body>ничего</body></html>')).toEqual([])
  })

  it('на пустой строке возвращает пустой массив', () => {
    expect(parseStage('')).toEqual([])
  })

  it('на null возвращает пустой массив', () => {
    expect(parseStage(null)).toEqual([])
  })
})
