import { describe, it, expect } from 'vitest'
import { parseTimeToSeconds, formatDelta, bestOf, groupByClass, topOfClass } from '../app/src/shared/format.js'

const rider = (over) => ({
  id: '1', sportClass: 'C3', classColor: 'green', number: 1, fio: 'Тест',
  city: '', motorcycle: '', attempts: [], bestTime: null,
  placeInClass: null, placeOverall: null, rating: null, ...over,
})

describe('parseTimeToSeconds', () => {
  it('разбирает формат сайта мм:сс.сс', () => {
    expect(parseTimeToSeconds('01:23.72')).toBeCloseTo(83.72, 2)
    expect(parseTimeToSeconds('00:42.31')).toBeCloseTo(42.31, 2)
  })

  it('пустое и мусор дают null', () => {
    expect(parseTimeToSeconds('')).toBeNull()
    expect(parseTimeToSeconds(null)).toBeNull()
    expect(parseTimeToSeconds('—')).toBeNull()
  })
})

describe('formatDelta', () => {
  it('лидер обозначается прочерком', () => {
    expect(formatDelta(0)).toBe('—')
  })

  it('отставание со знаком плюс и двумя знаками', () => {
    expect(formatDelta(0.84)).toBe('+0.84')
    expect(formatDelta(12.5)).toBe('+12.50')
  })

  it('null остаётся прочерком', () => {
    expect(formatDelta(null)).toBe('—')
  })
})

describe('bestOf', () => {
  it('берёт готовое значение с сайта', () => {
    expect(bestOf(rider({ bestTime: '01:23.50' }))).toBe('01:23.50')
  })

  it('считает сам, если сайт не посчитал', () => {
    const p = rider({ attempts: [
      { n: 1, time: '00:44.00', penalty: 0 },
      { n: 2, time: '00:42.00', penalty: 5 },
    ] })
    // 44.00 против 42.00+5=47.00 — лучше первая
    expect(bestOf(p)).toBe('00:44.00')
  })

  it('без результатов возвращает null', () => {
    expect(bestOf(rider({ attempts: [{ n: 1, time: null, penalty: null }] }))).toBeNull()
  })
})

describe('groupByClass', () => {
  it('сохраняет порядок появления классов', () => {
    const groups = groupByClass([
      rider({ id: 'a', sportClass: 'B', classColor: 'blue' }),
      rider({ id: 'b', sportClass: 'C3' }),
      rider({ id: 'c', sportClass: 'B', classColor: 'blue' }),
    ])
    expect(groups.map(g => g.sportClass)).toEqual(['B', 'C3'])
    expect(groups[0].riders).toHaveLength(2)
  })

  it('участник без класса попадает в отдельную группу', () => {
    const groups = groupByClass([rider({ id: 'a', sportClass: '' })])
    expect(groups[0].sportClass).toBe('Без класса')
  })
})

describe('topOfClass', () => {
  it('сортирует по месту в классе и режет по лимиту', () => {
    const list = [
      rider({ id: 'a', placeInClass: 3 }),
      rider({ id: 'b', placeInClass: 1 }),
      rider({ id: 'c', placeInClass: 2 }),
    ]
    expect(topOfClass(list, 'C3', 2).map(p => p.id)).toEqual(['b', 'c'])
  })

  it('участники без места уходят в конец, а не наверх', () => {
    const list = [
      rider({ id: 'a', placeInClass: null }),
      rider({ id: 'b', placeInClass: 1 }),
    ]
    expect(topOfClass(list, 'C3', 5).map(p => p.id)).toEqual(['b', 'a'])
  })
})
