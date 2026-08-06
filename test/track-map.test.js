import { describe, it, expect } from 'vitest'
import { needsFitting, fitSize, derivedUrl, derivedName, isStale, FIT_BOX } from '../server/trackMap.js'

describe('что уменьшаем, а что нет', () => {
  it('обычный скан уменьшаем', () => {
    expect(needsFitting('/assets/track-map.png')).toBe(true)
    expect(needsFitting('/assets/track-map.jpg')).toBe(true)
    expect(needsFitting('/assets/Схема Трассы.JPEG')).toBe(true)
  })

  // Векторной схеме уменьшать нечего: она рисуется в любом размере
  // и весит сотни байт. Прогнав её через растеризацию, мы бы сделали
  // из чёткой графики мыло и раздули файл.
  it('SVG не трогаем', () => {
    expect(needsFitting('/assets/track-map.svg')).toBe(false)
    expect(needsFitting('/assets/TRACK.SVG')).toBe(false)
  })

  // Чужой хост нам не принадлежит: писать туда некуда, а тянуть файл
  // к себе ради уменьшения значило бы зависеть от сети при старте.
  it('полную ссылку не трогаем', () => {
    expect(needsFitting('https://example.org/track.png')).toBe(false)
    expect(needsFitting('http://example.org/track.png')).toBe(false)
  })

  it('пустое поле — работы нет', () => {
    expect(needsFitting('')).toBe(false)
    expect(needsFitting(null)).toBe(false)
    expect(needsFitting(undefined)).toBe(false)
  })

  // Производная сама себе исходником быть не может: иначе каждый старт
  // пережимал бы уже пережатое, теряя качество на каждом круге.
  it('готовую производную второй раз не жмём', () => {
    expect(needsFitting('/assets/track-map.fit.webp')).toBe(false)
  })
})

describe('целевой размер', () => {
  // Кадр 1920×1080. Скан A4 альбомный вписывается по высоте, потому что
  // лист (1.41) уже кадра (1.78) — по бокам останутся поля.
  it('скан A4 вписывается по высоте', () => {
    expect(fitSize(3508, 2480, FIT_BOX)).toEqual({ width: 1528, height: 1080 })
  })

  it('портретный лист тоже вписывается по высоте', () => {
    expect(fitSize(2480, 3508, FIT_BOX)).toEqual({ width: 764, height: 1080 })
  })

  // Панорамная схема шире кадра ограничивается шириной, иначе уехала бы
  // за кромку и её обрезало бы contain'ом в сцене.
  it('слишком широкая схема вписывается по ширине', () => {
    expect(fitSize(6000, 1500, FIT_BOX)).toEqual({ width: 1920, height: 480 })
  })

  // Растягивать маленький файл незачем: пикселей от этого не прибавится,
  // а вес вырастет втрое. Пусть лучше останется как есть.
  it('маленькую картинку не увеличиваем', () => {
    expect(fitSize(800, 600, FIT_BOX)).toEqual({ width: 800, height: 600 })
  })

  it('ровно по коробке — оставляем как есть', () => {
    expect(fitSize(1920, 1080, FIT_BOX)).toEqual({ width: 1920, height: 1080 })
  })
})

describe('имя производной', () => {
  it('расширение меняется на .fit.webp рядом с исходником', () => {
    expect(derivedName('track-map.png')).toBe('track-map.fit.webp')
    expect(derivedName('scheme.jpeg')).toBe('scheme.fit.webp')
  })

  it('URL производной лежит в той же папке', () => {
    expect(derivedUrl('/assets/track-map.png')).toBe('/assets/track-map.fit.webp')
    expect(derivedUrl('/assets/stage/670.jpg')).toBe('/assets/stage/670.fit.webp')
  })

  // Точки в имени файла встречаются: «схема.v2.png». Резать надо последнюю,
  // иначе производная называлась бы «схема.fit.webp» и две разные схемы
  // писали бы в один файл.
  it('точки в имени не сбивают — режется последнее расширение', () => {
    expect(derivedName('схема.v2.png')).toBe('схема.v2.fit.webp')
  })
})

describe('свежесть производной', () => {
  it('производной нет — готовим', () => {
    expect(isStale(1000, null)).toBe(true)
  })

  it('производная старше исходника — схему заменили, готовим заново', () => {
    expect(isStale(2000, 1000)).toBe(true)
  })

  // Обычный npm start: производная на месте и свежая. Ждать нечего,
  // иначе каждый перезапуск сервера стоил бы секунды на ровном месте.
  it('производная свежее исходника — работы нет', () => {
    expect(isStale(1000, 2000)).toBe(false)
  })

  // Копирование файлов сохраняет mtime с точностью до секунды, и равные
  // отметки — норма, а не признак устаревания.
  it('отметки совпали — работы нет', () => {
    expect(isStale(1000, 1000)).toBe(false)
  })
})
