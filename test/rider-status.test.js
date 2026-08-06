import { describe, it, expect } from 'vitest'
import {
  DNS, isNoShow, competing, noShowConflicts, countsOf,
} from '../app/src/shared/riderStatus.js'

const rider = (id, { bestTime = null, attempts = [] } = {}) => ({
  id, fio: `Гонщик ${id}`, sportClass: 'C3', number: Number(id),
  city: 'Бердск', motorcycle: '', bestTime, attempts, placeInClass: null,
})

const attempt = (n, time, extra = {}) => ({ n, time, penalty: null, ...extra })

describe('isNoShow', () => {
  it('отмеченный без единой попытки не участвует', () => {
    expect(isNoShow(rider('1'), { 1: DNS })).toBe(true)
  })

  it('без отметки участвует, даже если ещё не ехал', () => {
    expect(isNoShow(rider('1'), {})).toBe(false)
  })

  it('чужая отметка не задевает соседа', () => {
    expect(isNoShow(rider('2'), { 1: DNS })).toBe(false)
  })

  // Отметку ставят утром по списку, время приходит с сайта по факту заезда.
  // Факт сильнее предположения: иначе проехавший человек пропал бы
  // из итоговой таблицы из-за утренней ошибки оператора.
  it('результат отменяет отметку — человек проехал', () => {
    expect(isNoShow(rider('1', { bestTime: '01:23.50' }), { 1: DNS })).toBe(false)
  })

  it('засчитанная попытка отменяет отметку без готового лучшего времени', () => {
    const r = rider('1', { attempts: [attempt(1, '01:23.50')] })
    expect(isNoShow(r, { 1: DNS })).toBe(false)
  })

  // Сошедший — приехал: он стоял на старте, и в протоколе у него строка.
  // Считать его неявившимся значило бы стереть его заезд.
  it('сход отменяет отметку', () => {
    const r = rider('1', { attempts: [attempt(1, '59:59.99')] })
    expect(isNoShow(r, { 1: DNS })).toBe(false)
  })

  it('незачёт отменяет отметку', () => {
    const r = rider('1', { attempts: [attempt(1, '03:47.90', { scratched: true })] })
    expect(isNoShow(r, { 1: DNS })).toBe(false)
  })

  it('пустая попытка без времени отметку не отменяет', () => {
    const r = rider('1', { attempts: [attempt(1, null)] })
    expect(isNoShow(r, { 1: DNS })).toBe(true)
  })

  it('неизвестное значение статуса игнорируется', () => {
    expect(isNoShow(rider('1'), { 1: 'что-то' })).toBe(false)
  })
})

describe('competing', () => {
  it('вычитает отмеченных из состава', () => {
    const list = [rider('1'), rider('2'), rider('3')]
    expect(competing(list, { 2: DNS }).map(r => r.id)).toEqual(['1', '3'])
  })

  it('без отметок отдаёт состав целиком', () => {
    const list = [rider('1'), rider('2')]
    expect(competing(list, {})).toHaveLength(2)
  })

  it('порядок протокола сохраняется', () => {
    const list = [rider('1'), rider('2'), rider('3'), rider('4')]
    expect(competing(list, { 1: DNS, 3: DNS }).map(r => r.id)).toEqual(['2', '4'])
  })

  it('переживает отсутствие аргументов', () => {
    expect(competing()).toEqual([])
    expect(competing([rider('1')])).toHaveLength(1)
  })
})

describe('noShowConflicts', () => {
  it('находит отмеченных, у которых появился результат', () => {
    const list = [
      rider('1'),
      rider('2', { bestTime: '01:23.50' }),
      rider('3', { bestTime: '01:30.00' }),
    ]
    expect(noShowConflicts(list, { 1: DNS, 2: DNS }).map(r => r.id)).toEqual(['2'])
  })

  it('без противоречий отдаёт пустой список', () => {
    expect(noShowConflicts([rider('1'), rider('2')], { 1: DNS })).toEqual([])
  })
})

describe('countsOf', () => {
  it('считает заявленных, едущих и неявки', () => {
    const list = [rider('1'), rider('2'), rider('3', { bestTime: '01:23.50' })]
    expect(countsOf(list, { 1: DNS })).toEqual({
      declared: 3, competing: 2, noShow: 1, conflicts: 0,
    })
  })

  // Противоречие считается отдельно: такой участник едет в кадре, поэтому
  // в «неявки» ему нельзя, но и молчать о нём нельзя.
  it('противоречие не попадает в неявки, но видно счётчиком', () => {
    const list = [rider('1'), rider('2', { bestTime: '01:23.50' })]
    expect(countsOf(list, { 1: DNS, 2: DNS })).toEqual({
      declared: 2, competing: 1, noShow: 1, conflicts: 1,
    })
  })

  it('пустой состав не ломает счётчики', () => {
    expect(countsOf([], {})).toEqual({ declared: 0, competing: 0, noShow: 0, conflicts: 0 })
  })
})
