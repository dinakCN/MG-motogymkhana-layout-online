import { describe, it, expect } from 'vitest'
import { ROUNDS as ROUND_TEXTS, roundText } from '../app/src/shared/rounds.js'
import { ROUNDS as ROUND_KEYS } from '../server/state.js'

describe('моменты дня', () => {
  it('списки сервера и пульта совпадают — иначе кнопка молча не сработает', () => {
    expect(ROUND_TEXTS.map(r => r.key)).toEqual(ROUND_KEYS)
  })

  it('у каждого момента есть подпись для кнопки и заголовок для кадра', () => {
    for (const round of ROUND_TEXTS) {
      expect(round.label, round.key).toBeTruthy()
      expect(round.title, round.key).toBeTruthy()
    }
  })

  it('на неизвестном ключе отдаёт первый момент, а не пустой кадр', () => {
    expect(roundText('обед')).toBe(ROUND_TEXTS[0])
    expect(roundText(undefined).title).toBeTruthy()
  })

  it('перерыв обещает продолжение — ради этого сцена и существует', () => {
    expect(roundText('break1').sub).toMatch(/сери/i)
  })

  // Время в кадре обязывает, а программа соревнований сдвигается всегда:
  // «Вторая серия заездов в 14:30» становится враньём раньше, чем кто-нибудь
  // это заметит. Проверяем все подписи разом, иначе часы вернутся с первой же
  // правкой расписания.
  it('в подписях нет времени — оно локальное и разойдётся с реальностью', () => {
    for (const round of ROUND_TEXTS) {
      expect(round.sub ?? '', round.key).not.toMatch(/\d{1,2}:\d{2}/)
      expect(round.title, round.key).not.toMatch(/\d{1,2}:\d{2}/)
    }
  })
})
