import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  parseTimeToSeconds, formatSeconds, formatDelta, isDnf, attemptTotal,
  bestSeconds, bestOf, attemptLabel, groupByClass, topOfClass, secondsSince,
  fractionDigits, DNF_LABEL,
} from '../app/src/shared/format.js'
import { parseStage } from '../server/parser.js'

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
    expect(parseTimeToSeconds('01:23,72')).toBeNull()
    expect(parseTimeToSeconds('DNF')).toBeNull()
  })
})

describe('formatSeconds', () => {
  it('собирает время обратно в формат протокола', () => {
    expect(formatSeconds(83.72)).toBe('01:23.72')
    expect(formatSeconds(42.31)).toBe('00:42.31')
    expect(formatSeconds(125)).toBe('02:05.00')
  })

  it('не выдаёт «60» в секундах на округлении', () => {
    expect(formatSeconds(59.999)).toBe('01:00.00')
    expect(formatSeconds(119.996)).toBe('02:00.00')
  })

  it('переживает сложение с плавающей точкой', () => {
    // 83.72 + 1 в двоичной арифметике даёт 84.72000000000001
    expect(formatSeconds(parseTimeToSeconds('01:23.72') + 1)).toBe('01:24.72')
  })

  it('туда и обратно без потерь', () => {
    for (const t of ['00:42.31', '01:23.50', '02:43.86', '03:47.90']) {
      expect(formatSeconds(parseTimeToSeconds(t))).toBe(t)
    }
  })
})

// 59:59.99 — так на сайте помечают незавершённую попытку. Пустить это
// в кадр числом значило бы показать зрителю час с лишним как результат.
describe('сход', () => {
  it('узнаётся по времени из протокола', () => {
    expect(isDnf('59:59.99')).toBe(true)
    expect(isDnf('03:47.90')).toBe(false)
    expect(isDnf(null)).toBe(false)
  })

  it('в кадре пишется словом, а не числом', () => {
    expect(attemptLabel({ n: 1, time: '59:59.99', penalty: 0 })).toBe(DNF_LABEL)
    expect(attemptLabel({ n: 1, time: '01:23.50', penalty: 0 })).toBe('01:23.50')
    expect(attemptLabel({ n: 1, time: null, penalty: null })).toBeNull()
  })

  it('не идёт в зачёт даже как единственная попытка', () => {
    const p = rider({ attempts: [{ n: 1, time: '59:59.99', penalty: 0 }] })
    expect(bestSeconds(p)).toBeNull()
    expect(bestOf(p)).toBe(DNF_LABEL)
  })

  it('не вытесняет засчитанную попытку', () => {
    const p = rider({ attempts: [
      { n: 1, time: '01:38.80', penalty: 4 },
      { n: 2, time: '59:59.99', penalty: 0 },
    ] })
    expect(bestOf(p)).toBe('01:42.80')
  })

  // Заваленная попытка на сайте зачёркнута, и время у неё бывает обычным:
  // Крюкова проехала 03:47.90, в зачёт не пошло. Ловить только 59:59.99
  // недостаточно — величина времени тут ничего не решает.
  it('заваленная попытка не идёт в зачёт даже с обычным временем', () => {
    const p = rider({ attempts: [
      { n: 1, time: '03:47.90', penalty: 0, scratched: true },
      { n: 2, time: '02:43.86', penalty: 0 },
    ] })
    expect(bestOf(p)).toBe('02:43.86')
  })

  it('заваленная попытка не идёт в зачёт, даже если она быстрее засчитанной', () => {
    const p = rider({ attempts: [
      { n: 1, time: '01:19.00', penalty: 0, scratched: true },
      { n: 2, time: '01:43.00', penalty: 0 },
    ] })
    expect(bestOf(p)).toBe('01:43.00')
    expect(bestSeconds(p)).toBeCloseTo(103, 2)
  })

  it('заваленные все попытки — результата нет', () => {
    const p = rider({ attempts: [
      { n: 1, time: '01:19.00', penalty: 0, scratched: true },
      { n: 2, time: '01:43.00', penalty: 0, scratched: true },
    ] })
    expect(bestSeconds(p)).toBeNull()
    expect(bestOf(p)).toBe(DNF_LABEL)
  })

  it('сход в готовом значении сайта тоже становится словом', () => {
    expect(bestOf(rider({ bestTime: '59:59.99' }))).toBe(DNF_LABEL)
    expect(bestSeconds(rider({ bestTime: '59:59.99' }))).toBeNull()
  })

  it('не ехавший вовсе отличается от сошедшего', () => {
    expect(bestOf(rider({ attempts: [{ n: 1, time: null, penalty: null }] }))).toBeNull()
    expect(bestOf(rider({ attempts: [] }))).toBeNull()
  })
})

describe('штраф входит в результат', () => {
  it('результат попытки — время плюс штраф в секундах', () => {
    expect(attemptTotal({ n: 1, time: '01:21.61', penalty: 1 })).toBeCloseTo(82.61, 2)
    expect(attemptTotal({ n: 1, time: '01:21.61', penalty: 0 })).toBeCloseTo(81.61, 2)
    expect(attemptTotal({ n: 1, time: '01:21.61', penalty: null })).toBeCloseTo(81.61, 2)
    expect(attemptTotal({ n: 1, time: null, penalty: 3 })).toBeNull()
  })

  it('лучшее выбирается по сумме со штрафом, а не по чистому времени', () => {
    const p = rider({ attempts: [
      { n: 1, time: '01:40.50', penalty: 1 },  // 101.50
      { n: 2, time: '01:40.00', penalty: 2 },  // 102.00 — чистое время лучше, сумма хуже
    ] })
    expect(bestOf(p)).toBe('01:41.50')
  })

  it('показанное лучшее время — с штрафом, как в протоколе', () => {
    const p = rider({ attempts: [{ n: 1, time: '01:23.40', penalty: 1 }] })
    expect(bestOf(p)).toBe('01:24.40')
  })

  it('готовое значение сайта не пересчитывается', () => {
    const p = rider({ bestTime: '01:22.61', attempts: [{ n: 1, time: '01:21.61', penalty: 1 }] })
    expect(bestOf(p)).toBe('01:22.61')
  })

  // Пока сайт не пересчитал, в кадре была бы исправленная попытка
  // 01:19.80 при «лучшем» 01:22.61 — зритель читает это как ошибку.
  it('после аварийной правки лучшее считается заново, а не берётся с сайта', () => {
    const p = rider({
      bestTime: '01:22.61',
      corrected: true,
      attempts: [
        { n: 1, time: '01:24.16', penalty: 2 },
        { n: 2, time: '01:19.80', penalty: 1 },
      ],
    })
    expect(bestOf(p)).toBe('01:20.80')
  })
})

// Железная проверка: убираем у каждого участника посчитанное сайтом
// значение и требуем, чтобы наш расчёт дал ровно то же самое.
describe('наш расчёт против протокола этапа 670', () => {
  const list = parseStage(readFileSync(new URL('./fixtures/stage670.html', import.meta.url), 'utf-8'))
  const withBest = list.filter(p => p.bestTime)

  it('в фикстуре есть на чём проверять', () => {
    expect(withBest.length).toBeGreaterThan(15)
  })

  it('совпадает у всех участников — со штрафами и сходами', () => {
    const mismatches = withBest
      .map(p => ({ fio: p.fio, сайт: p.bestTime, наш: bestOf({ ...p, bestTime: null }) }))
      .filter(x => x.сайт !== x.наш)

    expect(mismatches).toEqual([])
  })
})

// Хронометраж ведут до десятитысячных, сайт сегодня печатает сотые.
// Округлять чужой результат до привычных двух знаков нельзя: 01:23.7215
// и 01:23.7249 — разные результаты, и в кадре они обязаны различаться.
describe('точность времени — сколько дали, столько и показываем', () => {
  it('разбирает четыре знака без потери', () => {
    expect(parseTimeToSeconds('01:23.7215')).toBeCloseTo(83.7215, 4)
    expect(fractionDigits('01:23.7215')).toBe(4)
    expect(fractionDigits('01:23.72')).toBe(2)
    expect(fractionDigits('01:23.7')).toBe(1)
    expect(fractionDigits(null)).toBe(2)
  })

  it('собирает обратно с той же точностью', () => {
    expect(formatSeconds(83.7215, 4)).toBe('01:23.7215')
    expect(formatSeconds(83.72, 2)).toBe('01:23.72')
    expect(formatSeconds(83.7, 1)).toBe('01:23.7')
    expect(formatSeconds(59.9999, 4)).toBe('00:59.9999')
  })

  it('не выдаёт «60» в секундах при округлении на четвёртом знаке', () => {
    expect(formatSeconds(59.99999, 4)).toBe('01:00.0000')
  })

  it('лучшее время сохраняет точность попытки, а не режется до сотых', () => {
    const p = rider({ attempts: [{ n: 1, time: '01:23.7215', penalty: 0 }] })
    expect(bestOf(p)).toBe('01:23.7215')
  })

  it('штраф прибавляется без потери знаков', () => {
    const p = rider({ attempts: [{ n: 1, time: '01:23.7215', penalty: 1 }] })
    expect(bestOf(p)).toBe('01:24.7215')
  })

  it('выбор лучшей попытки различает тысячные', () => {
    const p = rider({ attempts: [
      { n: 1, time: '01:23.7215', penalty: 0 },
      { n: 2, time: '01:23.7249', penalty: 0 },
    ] })
    expect(bestOf(p)).toBe('01:23.7215')
  })

  it('готовое значение сайта с четырьмя знаками не трогаем', () => {
    expect(bestOf(rider({ bestTime: '01:23.7215' }))).toBe('01:23.7215')
  })

  it('отставание в тысячных не схлопывается в «—»', () => {
    expect(formatDelta(0.0034, 4)).toBe('+0.0034')
    expect(formatDelta(0.0034, 2)).toBe('—')  // в сотых такой разницы не видно
  })

  it('сотые и четыре знака сравниваются между собой корректно', () => {
    const p = rider({ attempts: [
      { n: 1, time: '01:23.72', penalty: 0 },
      { n: 2, time: '01:23.7150', penalty: 0 },
    ] })
    expect(bestOf(p)).toBe('01:23.7150')
  })
})

describe('formatDelta', () => {
  it('лидер обозначается прочерком', () => {
    expect(formatDelta(0)).toBe('—')
    expect(formatDelta(0.001)).toBe('—')
  })

  it('отставание со знаком плюс и двумя знаками', () => {
    expect(formatDelta(0.84)).toBe('+0.84')
    expect(formatDelta(12.5)).toBe('+12.50')
  })

  it('опережение показывается минусом, а не «+-0.40»', () => {
    expect(formatDelta(-0.4)).toBe('−0.40')
  })

  it('null остаётся прочерком', () => {
    expect(formatDelta(null)).toBe('—')
    expect(formatDelta(undefined)).toBe('—')
    expect(formatDelta(NaN)).toBe('—')
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

// Индикатор свежести — единственный сигнал о том, что сеть легла:
// оверлей в этот момент продолжает показывать старые данные и выглядит
// исправным. Поэтому его основа покрыта тестами.
describe('secondsSince', () => {
  it('считает возраст данных в секундах', () => {
    expect(secondsSince(Date.now() - 45_000)).toBe(45)
  })

  it('свежие данные дают ноль', () => {
    expect(secondsSince(Date.now())).toBe(0)
  })

  it('нулевая метка означает «данных ещё не было», а не «обновлено только что»', () => {
    expect(secondsSince(0)).toBeNull()
    expect(secondsSince(null)).toBeNull()
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

  // Начало дня: времена уже есть, мест сайт ещё не проставил.
  it('без мест выстраивает по лучшему времени, а не по порядку в таблице', () => {
    const list = [
      rider({ id: 'медленный', bestTime: '01:50.00' }),
      rider({ id: 'быстрый', bestTime: '01:20.00' }),
      rider({ id: 'средний', bestTime: '01:35.00' }),
    ]
    expect(topOfClass(list, 'C3', 5).map(p => p.id)).toEqual(['быстрый', 'средний', 'медленный'])
  })

  it('сошедшие и не стартовавшие уходят вниз', () => {
    const list = [
      rider({ id: 'сход', bestTime: '59:59.99' }),
      rider({ id: 'не ехал' }),
      rider({ id: 'результат', bestTime: '01:40.00' }),
    ]
    expect(topOfClass(list, 'C3', 5)[0].id).toBe('результат')
  })
})
