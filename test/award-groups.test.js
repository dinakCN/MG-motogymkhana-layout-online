import { describe, it, expect } from 'vitest'
import {
  UNGROUPED, groupOf, groupsWithCounts, ridersOfGroup, podiumOf,
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

describe('groupOf', () => {
  it('выводит группу из класса участника', () => {
    expect(groupOf(rider('1', 'D3'), GROUPS, {})).toBe('Любители')
    expect(groupOf(rider('2', 'B'), GROUPS, {})).toBe('Спортсмены')
    expect(groupOf(rider('3', 'N'), GROUPS, {})).toBe('Новички')
  })

  it('ручная пометка важнее класса — SB собирается только руками', () => {
    expect(groupOf(rider('1', 'D3'), GROUPS, { 1: 'SB' })).toBe('SB')
  })

  it('класс вне всех групп даёт null', () => {
    expect(groupOf(rider('1', 'X9'), GROUPS, {})).toBe(null)
    expect(groupOf(rider('2', ''), GROUPS, {})).toBe(null)
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
    expect(groupsWithCounts(list, GROUPS, { 1: 'SB' })).toEqual([
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
    expect(podiumOf(list, 'SB', GROUPS, { 2: 'SB' }).map(r => r.id)).toEqual(['2'])
    expect(podiumOf(list, 'Любители', GROUPS, { 2: 'SB' }).map(r => r.id)).toEqual(['1'])
  })
})
