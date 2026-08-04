import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('config', () => {
  const saved = { ...process.env }
  beforeEach(() => { delete process.env.STAGE_ID; delete process.env.PORT })
  afterEach(() => { process.env = { ...saved } })

  it('по умолчанию боевой этап 677 и порт 4300', async () => {
    const { loadConfig } = await import('../server/config.js')
    const c = loadConfig()
    expect(c.stageId).toBe('677')
    expect(c.port).toBe(4300)
    expect(c.pollInterval).toBe(7000)
  })

  it('STAGE_ID переключает этап на полигон', async () => {
    process.env.STAGE_ID = '670'
    const { loadConfig } = await import('../server/config.js')
    expect(loadConfig().stageId).toBe('670')
  })

  it('stageUrl собирается из stageId', async () => {
    process.env.STAGE_ID = '670'
    const { loadConfig } = await import('../server/config.js')
    expect(loadConfig().stageUrl).toBe('https://gymkhana-cup.ru/competitions/stage?id=670')
  })
})
