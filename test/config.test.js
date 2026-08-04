import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadConfig, resolveStage } from '../server/config.js'
import eventConfig from '../event.config.js'
import { UNGROUPED } from '../app/src/shared/awardGroups.js'

const TEMPLATE = 'https://gymkhana-cup.ru/competitions/stage?id={id}'

describe('event.config.js', () => {
  it('боевой этап и заголовок события заданы', () => {
    expect(String(eventConfig.stage)).toBeTruthy()
    expect(eventConfig.eventTitle).toBeTruthy()
    expect(eventConfig.stageUrlTemplate).toContain('{id}')
  })

  it('значения из файла доезжают до конфига сервера', () => {
    const c = loadConfig({}, { ...eventConfig, stage: '123', port: 4444, pollInterval: 3000 })
    expect(c.stageId).toBe('123')
    expect(c.liveStageId).toBe('123')
    expect(c.port).toBe(4444)
    expect(c.pollInterval).toBe(3000)
  })
})

describe('resolveStage — номер или полная ссылка', () => {
  it('из номера собирает адрес по шаблону', () => {
    expect(resolveStage('677', TEMPLATE)).toEqual({
      stageId: '677',
      stageUrl: 'https://gymkhana-cup.ru/competitions/stage?id=677',
    })
  })

  it('полную ссылку берёт как есть и достаёт из неё номер', () => {
    expect(resolveStage('https://gymkhana-cup.ru/competitions/stage?id=670', TEMPLATE)).toEqual({
      stageId: '670',
      stageUrl: 'https://gymkhana-cup.ru/competitions/stage?id=670',
    })
  })

  it('ссылка на другой сайт и путь работает — сайт мог переехать', () => {
    const url = 'https://example.org/protocol/2026/final?id=42&x=1'
    const { stageId, stageUrl } = resolveStage(url, TEMPLATE)
    expect(stageUrl).toBe(url)
    expect(stageId).toBe('42')
  })

  it('пустой этап — понятная ошибка, а не опрос по адресу без номера', () => {
    expect(() => resolveStage('', TEMPLATE)).toThrow(/event\.config\.js/)
    expect(() => resolveStage(undefined, TEMPLATE)).toThrow(/event\.config\.js/)
  })

  it('ссылке без номера даёт имя, годное для файла состояния', () => {
    const { stageId } = resolveStage('https://example.org/protocol/final', TEMPLATE)
    expect(stageId).toMatch(/^[a-zA-Z0-9-]+$/)
    expect(stageId.length).toBeLessThanOrEqual(40)
  })
})

describe('переменные окружения перекрывают файл', () => {
  const saved = { ...process.env }
  beforeEach(() => { delete process.env.STAGE; delete process.env.STAGE_ID; delete process.env.PORT })
  afterEach(() => { process.env = { ...saved } })

  it('STAGE переключает этап, боевой остаётся из файла', () => {
    const c = loadConfig({ STAGE: '670' }, { ...eventConfig, stage: '677' })
    expect(c.stageId).toBe('670')
    expect(c.liveStageId).toBe('677')
    expect(c.stageId).not.toBe(c.liveStageId)
  })

  it('STAGE принимает и полную ссылку', () => {
    const c = loadConfig({ STAGE: 'https://gymkhana-cup.ru/competitions/stage?id=670' }, eventConfig)
    expect(c.stageUrl).toBe('https://gymkhana-cup.ru/competitions/stage?id=670')
    expect(c.stageId).toBe('670')
  })

  it('STAGE_ID продолжает работать — он записан в шпаргалках', () => {
    expect(loadConfig({ STAGE_ID: '670' }, eventConfig).stageId).toBe('670')
  })

  it('PORT перекрывает порт из файла', () => {
    expect(loadConfig({ PORT: '4310' }, eventConfig).port).toBe(4310)
  })

  it('без переменных окружения работает боевой этап из файла', () => {
    const c = loadConfig({}, eventConfig)
    expect(c.stageId).toBe(String(eventConfig.stage))
    expect(c.stageId).toBe(c.liveStageId)
  })
})

describe('группы награждения', () => {
  it('доезжают из event.config.js до конфига сервера', () => {
    const c = loadConfig({}, {
      ...eventConfig,
      awardGroups: [{ name: 'Любители', classes: ['D2', 'D3'] }],
    })
    expect(c.awardGroups).toEqual([{ name: 'Любители', classes: ['D2', 'D3'] }])
  })

  it('без блока групп — пустой список, сервер поднимается', () => {
    expect(loadConfig({}, { ...eventConfig, awardGroups: undefined }).awardGroups).toEqual([])
  })

  it('в боевом конфиге группы заданы и не спорят с «Вне групп»', () => {
    expect(eventConfig.awardGroups.length).toBeGreaterThan(0)
    for (const group of eventConfig.awardGroups) {
      expect(group.name).not.toBe(UNGROUPED)
      expect(Array.isArray(group.classes)).toBe(true)
    }
  })
})
