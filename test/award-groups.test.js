import { describe, it, expect } from 'vitest'
import {
  UNGROUPED, groupsOf, groupsWithCounts, ridersOfGroup, podiumOf, clampPlace,
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
