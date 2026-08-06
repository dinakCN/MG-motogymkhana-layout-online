import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadConfig, resolveStage, resolveTimerUrl, awardGroupsProblems } from '../server/config.js'
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

describe('логотип', () => {
  it('путь из файла доезжает до конфига сервера', () => {
    const c = loadConfig({}, { ...eventConfig, logo: '/assets/mgk-nsk.png' })
    expect(c.logoUrl).toBe('/assets/mgk-nsk.png')
  })

  it('полная ссылка принимается — логотип этапа может лежать не у нас', () => {
    const url = 'https://example.org/logo.png'
    expect(loadConfig({}, { ...eventConfig, logo: url }).logoUrl).toBe(url)
  })

  it('LOGO перекрывает файл — репетиция с чужой эмблемой без правки конфига', () => {
    const c = loadConfig({ LOGO: '/assets/other.png' }, eventConfig)
    expect(c.logoUrl).toBe('/assets/other.png')
  })

  // Пустой src у <img> тянет саму страницу оверлея: в углу кадра появилась бы
  // битая картинка вместо эмблемы.
  it('без логотипа и с пустым значением — путь по умолчанию, а не пустой src', () => {
    expect(loadConfig({}, { ...eventConfig, logo: undefined }).logoUrl).toBe('/assets/logo.png')
    expect(loadConfig({}, { ...eventConfig, logo: '' }).logoUrl).toBe('/assets/logo.png')
  })

  it('в боевом конфиге логотип задан', () => {
    expect(eventConfig.logo).toBeTruthy()
  })
})

describe('знак для угла кадра', () => {
  it('путь из файла доезжает до конфига сервера', () => {
    const c = loadConfig({}, { ...eventConfig, logoMark: '/assets/mark.png' })
    expect(c.logoMarkUrl).toBe('/assets/mark.png')
  })

  it('LOGO_MARK перекрывает файл', () => {
    expect(loadConfig({ LOGO_MARK: '/assets/other.png' }, eventConfig).logoMarkUrl)
      .toBe('/assets/other.png')
  })

  // Знак необязателен: без него в углу встанет обычный логотип — мелко,
  // но узнаваемо. Пустой угол или битая картинка были бы хуже.
  it('без знака подставляется обычный логотип, а не пустой src', () => {
    const c = loadConfig({}, { ...eventConfig, logo: '/assets/l.png', logoMark: undefined })
    expect(c.logoMarkUrl).toBe('/assets/l.png')
    expect(loadConfig({}, { ...eventConfig, logo: '/assets/l.png', logoMark: '' }).logoMarkUrl)
      .toBe('/assets/l.png')
  })

  it('LOGO перетягивает и знак, если своего у знака нет', () => {
    const c = loadConfig({ LOGO: '/assets/env.png' }, { ...eventConfig, logoMark: undefined })
    expect(c.logoMarkUrl).toBe('/assets/env.png')
  })

  it('в боевом конфиге знак задан и отличается от полного логотипа', () => {
    expect(eventConfig.logoMark).toBeTruthy()
    expect(eventConfig.logoMark).not.toBe(eventConfig.logo)
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

  // Опечатку в составе групп иначе не видно ничем: «Вне групп» не появится,
  // счётчики сойдутся, а человек уедет не в свой зачёт.
  it('находит класс, попавший сразу в две группы', () => {
    const problems = awardGroupsProblems([
      { name: 'Спортсмены', classes: ['D1', 'D2'] },
      { name: 'Любители', classes: ['D2', 'D3'] },
    ])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('D2')
  })

  it('находит две группы с одним именем — в пульте это два неразличимых пункта', () => {
    const problems = awardGroupsProblems([
      { name: 'Любители', classes: ['D2'] },
      { name: 'Любители', classes: ['D3'] },
    ])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('Любители')
  })

  it('находит имя, отнятое у «Вне групп»', () => {
    const problems = awardGroupsProblems([{ name: UNGROUPED, classes: ['D2'] }])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(UNGROUPED)
  })

  it('на здоровом составе молчит', () => {
    expect(awardGroupsProblems([
      { name: 'Спортсмены', classes: ['D1'] },
      { name: 'Любители', classes: ['D2', 'D3'] },
      { name: 'SB', classes: [] },
    ])).toEqual([])
  })

  it('боевой конфиг здоров — проверка перед эфиром, а не после', () => {
    expect(awardGroupsProblems(eventConfig.awardGroups)).toEqual([])
  })

  it('strictGroups читается из файла', () => {
    expect(loadConfig({}, { ...eventConfig, strictGroups: false }).strictGroups).toBe(false)
  })

  it('без ключа разделение строгое — один участник, одна группа', () => {
    expect(loadConfig({}, { ...eventConfig, strictGroups: undefined }).strictGroups).toBe(true)
  })

  it('мягкий режим включается только явным false — как у тумблеров сцены', () => {
    expect(loadConfig({}, { ...eventConfig, strictGroups: 'false' }).strictGroups).toBe(true)
    expect(loadConfig({}, { ...eventConfig, strictGroups: 0 }).strictGroups).toBe(true)
  })
})

describe('режим итоговой таблицы', () => {
  // Умолчание — нынешнее поведение: класс считает места сам сайт, и
  // таблица по классам сверяется с протоколом строка в строку.
  it('без ключа таблица группируется по классам', () => {
    expect(loadConfig({}, { ...eventConfig, resultsByGroup: undefined }).resultsByGroup).toBe(false)
  })

  it('resultsByGroup читается из файла', () => {
    expect(loadConfig({}, { ...eventConfig, resultsByGroup: true }).resultsByGroup).toBe(true)
  })

  it('включается только явным true — строка «true» не считается', () => {
    expect(loadConfig({}, { ...eventConfig, resultsByGroup: 'true' }).resultsByGroup).toBe(false)
    expect(loadConfig({}, { ...eventConfig, resultsByGroup: 1 }).resultsByGroup).toBe(false)
  })

  it('переменная окружения перекрывает файл — репетиция без правки', () => {
    const on = loadConfig({ RESULTS_BY_GROUP: '1' }, { ...eventConfig, resultsByGroup: false })
    expect(on.resultsByGroup).toBe(true)

    const off = loadConfig({ RESULTS_BY_GROUP: '0' }, { ...eventConfig, resultsByGroup: true })
    expect(off.resultsByGroup).toBe(false)
  })
})

// Пульт нужен и с планшета, поэтому сервер по умолчанию слушает все
// интерфейсы машины. Но сеть на соревнованиях общая, и когда пульт живёт
// на том же ноутбуке, что и OBS, вход снаружи лучше закрыть.
describe('на каких интерфейсах слушать', () => {
  it('по умолчанию на всех — пульт открывают и с другого устройства', () => {
    expect(loadConfig({}, eventConfig).host).toBe(undefined)
  })

  it('HOST ограничивает одной машиной', () => {
    expect(loadConfig({ HOST: '127.0.0.1' }, eventConfig).host).toBe('127.0.0.1')
  })
})

// Тумблеры кадра оператор переключает из пульта, и перезапуск сервера
// посреди дня не должен отменять его выбор (server/state.js,
// applyServerConfig). Отличить «оператор выбрал» от «так в файле этапа»
// сервер может только по тому, назвали ли тумблер прямо в командной строке.
describe('тумблеры, названные в командной строке', () => {
  it('перечисляются в конфиге', () => {
    const c = loadConfig({ RESULTS_BY_GROUP: '1' }, eventConfig)
    expect(c.sceneOptionsFromEnv).toEqual(['resultsByGroup'])
  })

  it('гашение тумблера — тоже прямое указание', () => {
    const c = loadConfig({ SHOW_RUN_TIME: '0' }, eventConfig)
    expect(c.sceneOptionsFromEnv).toEqual(['showRunTime'])
  })

  it('без переменных список пуст — в кадре останется выбор оператора', () => {
    expect(loadConfig({}, eventConfig).sceneOptionsFromEnv).toEqual([])
  })
})

describe('resolveTimerUrl', () => {
  it('из адреса прибора собирает путь к показаниям', () => {
    expect(resolveTimerUrl('192.168.1.97')).toBe('http://192.168.1.97/laptime')
  })

  it('полную ссылку берёт как есть', () => {
    expect(resolveTimerUrl('http://timer.local/lap')).toBe('http://timer.local/lap')
  })

  it('пусто означает «таймера нет»', () => {
    expect(resolveTimerUrl('')).toBeNull()
    expect(resolveTimerUrl(undefined)).toBeNull()
    expect(resolveTimerUrl('  ')).toBeNull()
  })

  it('TIMER=0 гасит таймер, не трогая файл', () => {
    expect(loadConfig({ TIMER: '0' }, { ...eventConfig, timer: '192.168.1.97' }).timerUrl).toBeNull()
  })

  it('переменная окружения перекрывает файл', () => {
    const c = loadConfig({ TIMER: '10.0.0.5' }, { ...eventConfig, timer: '192.168.1.97' })
    expect(c.timerUrl).toBe('http://10.0.0.5/laptime')
  })

  it('без настройки сервер поднимается без таймера', () => {
    expect(loadConfig({}, { ...eventConfig, timer: undefined }).timerUrl).toBeNull()
    expect(loadConfig({}, { ...eventConfig, timer: undefined }).timerPollInterval).toBe(300)
  })
})
