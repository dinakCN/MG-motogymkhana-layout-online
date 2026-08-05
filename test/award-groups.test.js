import { describe, it, expect } from 'vitest'
import {
  UNGROUPED, groupsOf, groupsWithCounts, ridersOfGroup, podiumOf, clampPlace, conflictsOf,
  nextGroups, primaryGroup, topOfGroup,
} from '../app/src/shared/awardGroups.js'

const GROUPS = [
  { name: 'Спортсмены', classes: ['A', 'B', 'C1', 'C2', 'C3', 'D1'] },
  { name: 'Любители', classes: ['D2', 'D3'] },
  { name: 'Новички', classes: ['D4', 'N'] },
  { name: 'Круизер', classes: [] },
  { name: 'SB', classes: [] },
]

const rider = (id, sportClass, bestTime = null) => ({
  id, sportClass, bestTime, fio: `Гонщик ${id}`, number: Number(id),
  city: '', motorcycle: '', attempts: [], placeInClass: null,
})

describe('groupsOf', () => {
  it('выводит группу из класса участника', () => {
    expect(groupsOf(rider('1', 'D3'), GROUPS, {})).toEqual(['Любители'])
    expect(groupsOf(rider('2', 'B'), GROUPS, {})).toEqual(['Спортсмены'])
    expect(groupsOf(rider('3', 'N'), GROUPS, {})).toEqual(['Новички'])
  })

  it('ручной список перебивает класс целиком — SB собирается только руками', () => {
    expect(groupsOf(rider('1', 'D3'), GROUPS, { 1: ['SB'] })).toEqual(['SB'])
  })

  it('участник едет в двух зачётах сразу — класс и мотоцикл', () => {
    expect(groupsOf(rider('1', 'D2'), GROUPS, { 1: ['Любители', 'Круизер'] }))
      .toEqual(['Любители', 'Круизер'])
  })

  it('пустой список — вне зачёта, а не возврат к классу', () => {
    expect(groupsOf(rider('1', 'D3'), GROUPS, { 1: [] })).toEqual([])
  })

  it('класс вне всех групп даёт пустой список', () => {
    expect(groupsOf(rider('1', 'X9'), GROUPS, {})).toEqual([])
    expect(groupsOf(rider('2', ''), GROUPS, {})).toEqual([])
  })

  // Иначе бейдж в строке пульта показывал бы группу, которой нет в этапе,
  // а счётчики рядом её не показывали бы: один экран, два ответа.
  it('пометка на группу из прошлого этапа отсеивается здесь, а не у потребителей', () => {
    expect(groupsOf(rider('1', 'D2'), GROUPS, { 1: ['Ветераны'] })).toEqual([])
    expect(groupsOf(rider('2', 'D2'), GROUPS, { 2: ['Круизер', 'Ветераны'] })).toEqual(['Круизер'])
  })
})

describe('nextGroups', () => {
  it('мягкий режим: отметка добавляет зачёт, не отнимая имеющийся', () => {
    expect(nextGroups(['Любители'], 'Круизер', false)).toEqual(['Любители', 'Круизер'])
  })

  it('мягкий режим: повторная отметка снимает только эту группу', () => {
    expect(nextGroups(['Любители', 'Круизер'], 'Любители', false)).toEqual(['Круизер'])
  })

  it('строгий режим: отметка переносит участника', () => {
    expect(nextGroups(['Любители'], 'Круизер', true)).toEqual(['Круизер'])
  })

  it('строгий режим: клик по единственной отмеченной снимает её — «вне зачёта» достижимо', () => {
    expect(nextGroups(['Круизер'], 'Круизер', true)).toEqual([])
  })

  // Так разрешают конфликт, оставшийся от переключения режима: оператор
  // кликает группу, в которой человек должен остаться. Отдать здесь пустой
  // список значило бы выбросить его из всех зачётов одним кликом.
  it('строгий режим: клик по одной из нескольких оставляет только её', () => {
    expect(nextGroups(['Любители', 'Круизер'], 'Круизер', true)).toEqual(['Круизер'])
  })
})

describe('groupsWithCounts', () => {
  it('считает людей в каждой группе, порядок берёт из конфига', () => {
    const list = [rider('1', 'D2'), rider('2', 'D3'), rider('3', 'N'), rider('4', 'C3')]
    expect(groupsWithCounts(list, GROUPS, {})).toEqual([
      { name: 'Спортсмены', count: 1 },
      { name: 'Любители', count: 2 },
      { name: 'Новички', count: 1 },
      { name: 'Круизер', count: 0 },
      { name: 'SB', count: 0 },
    ])
  })

  it('ручное перемещение переносит человека между счётчиками', () => {
    const list = [rider('1', 'D2'), rider('2', 'D3')]
    expect(groupsWithCounts(list, GROUPS, { 1: ['SB'] })).toEqual([
      { name: 'Спортсмены', count: 0 },
      { name: 'Любители', count: 1 },
      { name: 'Новички', count: 0 },
      { name: 'Круизер', count: 0 },
      { name: 'SB', count: 1 },
    ])
  })

  it('«Вне групп» появляется, только когда такие участники есть', () => {
    const ok = groupsWithCounts([rider('1', 'D2')], GROUPS, {})
    expect(ok.some(g => g.name === UNGROUPED)).toBe(false)

    const broken = groupsWithCounts([rider('1', 'D2'), rider('2', 'X9')], GROUPS, {})
    expect(broken.at(-1)).toEqual({ name: UNGROUPED, count: 1 })
  })

  it('сумма счётчиков больше числа участников, когда кто-то в двух группах', () => {
    const list = [rider('1', 'D2'), rider('2', 'N')]
    const rows = groupsWithCounts(list, GROUPS, { 1: ['Любители', 'Круизер'] })

    expect(rows.find(r => r.name === 'Любители').count).toBe(1)
    expect(rows.find(r => r.name === 'Круизер').count).toBe(1)
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(3)
  })

  it('пустой список уводит участника во «Вне групп», а не к классу', () => {
    const rows = groupsWithCounts([rider('1', 'D2')], GROUPS, { 1: [] })
    expect(rows.find(r => r.name === 'Любители').count).toBe(0)
    expect(rows.at(-1)).toEqual({ name: UNGROUPED, count: 1 })
  })
})

describe('ridersOfGroup', () => {
  it('собирает классы группы и сортирует по лучшему времени', () => {
    const list = [
      rider('1', 'D2', '00:44.15'),
      rider('2', 'D3', '00:42.31'),
      rider('3', 'N', '00:40.00'),
      rider('4', 'D3', '00:43.80'),
    ]
    expect(ridersOfGroup(list, 'Любители', GROUPS, {}).map(r => r.id)).toEqual(['2', '4', '1'])
  })

  it('без времени и сошедшие уходят в конец', () => {
    const list = [
      rider('1', 'D2', null),
      rider('2', 'D2', '59:59.99'),
      rider('3', 'D2', '00:44.15'),
    ]
    expect(ridersOfGroup(list, 'Любители', GROUPS, {}).map(r => r.id)).toEqual(['3', '1', '2'])
  })

  it('при равном времени сохраняет порядок протокола — подиум не должен прыгать', () => {
    const list = [
      rider('1', 'D2', '00:42.31'),
      rider('2', 'D3', '00:42.31'),
      rider('3', 'D2', '00:42.31'),
    ]
    expect(ridersOfGroup(list, 'Любители', GROUPS, {}).map(r => r.id)).toEqual(['1', '2', '3'])
  })

  it('в «Вне групп» попадают те, чей класс не нашёлся', () => {
    const list = [rider('1', 'D2'), rider('2', 'X9'), rider('3', '')]
    expect(ridersOfGroup(list, UNGROUPED, GROUPS, {}).map(r => r.id)).toEqual(['2', '3'])
  })

  it('без выбранной группы возвращает пустой список', () => {
    expect(ridersOfGroup([rider('1', 'D2')], null, GROUPS, {})).toEqual([])
  })

  it('участник в двух группах попадает в оба состава', () => {
    const list = [rider('1', 'D2', '01:30.00'), rider('2', 'D3', '01:40.00')]
    const marks = { 1: ['Любители', 'Круизер'] }

    expect(ridersOfGroup(list, 'Любители', GROUPS, marks).map(r => r.id)).toEqual(['1', '2'])
    expect(ridersOfGroup(list, 'Круизер', GROUPS, marks).map(r => r.id)).toEqual(['1'])
  })

  it('участник без единой группы уходит во «Вне групп»', () => {
    expect(ridersOfGroup([rider('1', 'D2')], UNGROUPED, GROUPS, { 1: [] }).map(r => r.id))
      .toEqual(['1'])
  })

  it('пометка на группу из прошлого этапа не удерживает участника нигде', () => {
    const list = [rider('1', 'D2')]
    expect(ridersOfGroup(list, 'Любители', GROUPS, { 1: ['Ветераны'] })).toEqual([])
    expect(ridersOfGroup(list, UNGROUPED, GROUPS, { 1: ['Ветераны'] }).map(r => r.id)).toEqual(['1'])
  })
})

describe('podiumOf', () => {
  it('трое лучших по времени в группе', () => {
    const list = [
      rider('1', 'D2', '00:44.15'),
      rider('2', 'D3', '00:42.31'),
      rider('3', 'D3', '00:43.80'),
      rider('4', 'D2', '00:45.00'),
    ]
    expect(podiumOf(list, 'Любители', GROUPS, {}).map(r => r.id)).toEqual(['2', '3', '1'])
  })

  it('без времени и сошедшие на подиум не попадают', () => {
    const list = [
      rider('1', 'D2', '00:44.15'),
      rider('2', 'D3', '00:42.31'),
      rider('3', 'D2', null),
      rider('4', 'D3', '59:59.99'),
    ]
    expect(podiumOf(list, 'Любители', GROUPS, {}).map(r => r.id)).toEqual(['2', '1'])
  })

  it('в группе меньше трёх — подиум короче, это законно', () => {
    expect(podiumOf([], 'Круизер', GROUPS, {})).toEqual([])
  })

  it('ручное перемещение попадает на подиум своей новой группы', () => {
    const list = [rider('1', 'D2', '00:44.15'), rider('2', 'D3', '00:42.31')]
    expect(podiumOf(list, 'SB', GROUPS, { 2: ['SB'] }).map(r => r.id)).toEqual(['2'])
    expect(podiumOf(list, 'Любители', GROUPS, { 2: ['SB'] }).map(r => r.id)).toEqual(['1'])
  })

  it('участник в двух группах едет на оба подиума — в этом и смысл', () => {
    const list = [rider('1', 'D2', '00:44.15'), rider('2', 'D3', '00:42.31')]
    const marks = { 1: ['Любители', 'Круизер'] }

    expect(podiumOf(list, 'Круизер', GROUPS, marks).map(r => r.id)).toEqual(['1'])
    expect(podiumOf(list, 'Любители', GROUPS, marks).map(r => r.id)).toEqual(['2', '1'])
  })
})

describe('conflictsOf', () => {
  it('находит участников больше чем в одной группе', () => {
    const list = [rider('1', 'D2'), rider('2', 'N')]
    expect(conflictsOf(list, GROUPS, { 1: ['Любители', 'Круизер'] }).map(r => r.id)).toEqual(['1'])
  })

  it('пуст, когда каждый ровно в одной группе', () => {
    const list = [rider('1', 'D2'), rider('2', 'N')]
    expect(conflictsOf(list, GROUPS, { 2: ['SB'] })).toEqual([])
  })

  it('не считает конфликтом группу из прошлого этапа — её всё равно нет', () => {
    const list = [rider('1', 'D2')]
    expect(conflictsOf(list, GROUPS, { 1: ['Круизер', 'Ветераны'] })).toEqual([])
  })
})

describe('clampPlace', () => {
  it('оставляет место, на которое призёр есть', () => {
    expect(clampPlace(3, 3)).toBe(3)
    expect(clampPlace(2, 3)).toBe(2)
    expect(clampPlace(1, 1)).toBe(1)
  })

  it('прижимает к числу призёров — переход на группу, где людей меньше', () => {
    expect(clampPlace(3, 1)).toBe(1)
    expect(clampPlace(3, 2)).toBe(2)
    expect(clampPlace(2, 1)).toBe(1)
  })

  it('пустая группа даёт первое место: других сервер не принимает', () => {
    expect(clampPlace(3, 0)).toBe(1)
    expect(clampPlace(1, 0)).toBe(1)
  })

  it('место ниже первого не появляется даже из испорченного состояния', () => {
    expect(clampPlace(0, 3)).toBe(1)
    expect(clampPlace(-2, 3)).toBe(1)
  })
})

describe('primaryGroup', () => {
  it('выводит группу из класса', () => {
    expect(primaryGroup(rider('1', 'D3'), GROUPS, {})).toBe('Любители')
    expect(primaryGroup(rider('2', 'B'), GROUPS, {})).toBe('Спортсмены')
  })

  // Кадр показывает одну колонку, и она не должна зависеть от того, в каком
  // порядке оператор расставлял галочки: два одинаковых райдера показали бы
  // разные группы.
  it('из двух зачётов берёт тот, что выше в конфиге, а не первую пометку', () => {
    expect(primaryGroup(rider('1', 'D2'), GROUPS, { 1: ['Круизер', 'Любители'] }))
      .toBe('Любители')
    expect(primaryGroup(rider('1', 'D2'), GROUPS, { 1: ['Любители', 'Круизер'] }))
      .toBe('Любители')
  })

  it('ручная пометка перебивает класс', () => {
    expect(primaryGroup(rider('1', 'D3'), GROUPS, { 1: ['SB'] })).toBe('SB')
  })

  it('вне зачёта и незнакомый класс группы не дают', () => {
    expect(primaryGroup(rider('1', 'D3'), GROUPS, { 1: [] })).toBeNull()
    expect(primaryGroup(rider('2', 'X9'), GROUPS, {})).toBeNull()
    expect(primaryGroup(null, GROUPS, {})).toBeNull()
  })
})

describe('topOfGroup', () => {
  it('нумерует группу насквозь через классы: в «Любителях» первое место одно', () => {
    const list = [
      rider('1', 'D2', '00:44.15'),
      rider('2', 'D3', '00:42.31'),
      rider('3', 'D3', '00:43.80'),
    ]
    expect(topOfGroup(list, 'Любители', GROUPS, {})).toEqual([
      { rider: list[1], place: 1 },
      { rider: list[2], place: 2 },
      { rider: list[0], place: 3 },
    ])
  })

  it('три строки, даже когда в группе едет больше', () => {
    const list = [
      rider('1', 'D2', '00:44.15'),
      rider('2', 'D3', '00:42.31'),
      rider('3', 'D3', '00:43.80'),
      rider('4', 'D2', '00:45.00'),
    ]
    expect(topOfGroup(list, 'Любители', GROUPS, {}).map(r => r.rider.id))
      .toEqual(['2', '3', '1'])
  })

  // Место без результата — не ноль и не «четвёртый»: человек ещё не ехал.
  it('не ехавшим и сошедшим места не выдаёт', () => {
    const list = [
      rider('1', 'D2', '00:44.15'),
      rider('2', 'D3', null),
      rider('3', 'D2', '59:59.99'),
    ]
    expect(topOfGroup(list, 'Любители', GROUPS, {})).toEqual([
      { rider: list[0], place: 1 },
      { rider: list[1], place: null },
      { rider: list[2], place: null },
    ])
  })

  it('райдер в тройке — срез не трогаем', () => {
    const list = [
      rider('1', 'D2', '00:44.15'),
      rider('2', 'D3', '00:42.31'),
      rider('3', 'D3', '00:43.80'),
      rider('4', 'D2', '00:45.00'),
    ]
    expect(topOfGroup(list, 'Любители', GROUPS, {}, '1').map(r => r.rider.id))
      .toEqual(['2', '3', '1'])
  })

  // Иначе блок в кадре превращается в список чужих фамилий, пока человек едет.
  it('райдер вне тройки занимает последнюю строку со своим настоящим местом', () => {
    const list = [
      rider('1', 'D2', '00:42.00'),
      rider('2', 'D3', '00:43.00'),
      rider('3', 'D3', '00:44.00'),
      rider('4', 'D2', '00:45.00'),
      rider('5', 'D2', '00:46.00'),
    ]
    expect(topOfGroup(list, 'Любители', GROUPS, {}, '5')).toEqual([
      { rider: list[0], place: 1 },
      { rider: list[1], place: 2 },
      { rider: list[4], place: 5 },
    ])
  })

  it('райдер из чужой группы ничего не подменяет', () => {
    const list = [
      rider('1', 'D2', '00:44.15'),
      rider('2', 'D3', '00:42.31'),
      rider('3', 'D3', '00:43.80'),
      rider('4', 'B', '00:30.00'),
    ]
    expect(topOfGroup(list, 'Любители', GROUPS, {}, '4').map(r => r.rider.id))
      .toEqual(['2', '3', '1'])
  })

  it('без группы возвращает пустой список', () => {
    expect(topOfGroup([rider('1', 'D2', '00:44.15')], null, GROUPS, {})).toEqual([])
  })

  it('ручная пометка меняет состав колонки вслед за зачётом', () => {
    const list = [rider('1', 'D2', '00:44.15'), rider('2', 'D3', '00:42.31')]
    expect(topOfGroup(list, 'Круизер', GROUPS, { 1: ['Круизер'] }).map(r => r.rider.id))
      .toEqual(['1'])
    expect(topOfGroup(list, 'Любители', GROUPS, { 1: ['Круизер'] }).map(r => r.rider.id))
      .toEqual(['2'])
  })
})
