// Настройка секундомера MG StopWatcher с этой машины.
//
//   npm run timer            найти прибор в сети и показать его настройки
//   npm run timer -- setup   перевести в общую сеть: спросит имя сети и пароль
//   npm run timer -- ap      вернуть на собственную точку доступа
//
// Зачем скрипт, если у прибора есть веб-интерфейс: активную сеть выбирает
// поле `wifi.wifiid`, а органа управления им в интерфейсе нет. Добавленная
// там клиентская сеть сохраняется, но не включается — со стороны выглядит
// как «не подключился», и диагностика уходит в пароли, где искать нечего.

import { createInterface } from 'node:readline/promises'
import { networkInterfaces } from 'node:os'
import { parseReading } from '../server/timer.js'
import eventConfig from '../event.config.js'

const REQUEST_TIMEOUT = 1500

// Собственная точка доступа прибора. Проверяем её первой: если ноутбук
// подключён к `StopWatcher1`, прибор именно здесь.
const OWN_AP = '192.168.4.1'

async function get(ip, path) {
  try {
    const response = await fetch(`http://${ip}${path}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
    return response.ok ? await response.text() : null
  } catch {
    return null
  }
}

// Прибор опознаём по показаниям, а не по открытому порту: в домашней сети
// веб-сервер найдётся и у роутера, и у пылесоса.
const isTimer = async (ip) => Boolean(parseReading(await get(ip, '/laptime')))

function subnets() {
  const found = []
  for (const list of Object.values(networkInterfaces())) {
    for (const iface of list ?? []) {
      if (iface.family !== 'IPv4' || iface.internal) continue
      found.push(iface.address.split('.').slice(0, 3).join('.'))
    }
  }
  return [...new Set(found)]
}

async function findTimer(hint) {
  // Адрес из конфига пробуем первым: пока он верен, поиск не нужен вовсе.
  const direct = [...new Set([hint, eventConfig.timer, OWN_AP].filter(Boolean))]
  for (const ip of direct) {
    process.stdout.write(`  проверяю ${ip}… `)
    if (await isTimer(ip)) { console.log('нашёлся'); return ip }
    console.log('нет')
  }

  for (const net of subnets()) {
    console.log(`  ищу в ${net}.0/24…`)
    const hits = await Promise.all(
      Array.from({ length: 254 }, (_, i) => `${net}.${i + 1}`)
        .map(async (ip) => (await isTimer(ip) ? ip : null)),
    )
    const found = hits.find(Boolean)
    if (found) return found
  }

  return null
}

async function readConfig(ip) {
  const text = await get(ip, '/config')
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function writeConfig(ip, cfg) {
  const response = await fetch(`http://${ip}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify(cfg),
    signal: AbortSignal.timeout(5000),
  })
  return response.ok
}

// После перезагрузки прибор получает новый адрес от роутера. Ждём его
// сами, чтобы не заставлять человека искать вручную.
async function waitForTimer(seconds) {
  const until = Date.now() + seconds * 1000
  while (Date.now() < until) {
    const ip = await findTimer(null)
    if (ip) return ip
  }
  return null
}

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => rl.question(q)

const mode = process.argv[2] ?? 'find'

console.log()
const ip = await findTimer(process.argv[3])

if (!ip) {
  console.log('\n  Прибор не найден.')
  console.log('  Он либо выключен, либо раздаёт свою точку — тогда подключись')
  console.log('  к wifi StopWatcher1 и запусти снова.\n')
  rl.close()
  process.exit(1)
}

const cfg = await readConfig(ip)
if (!cfg?.wifi?.list?.length) {
  console.log(`\n  ${ip} отвечает показаниями, но конфигурацию не отдал — не трогаю.\n`)
  rl.close()
  process.exit(1)
}

const active = cfg.wifi.list[Number(cfg.wifi.wifiid) || 0]

console.log(`\n  Прибор: http://${ip}`)
console.log(`  Режим таймера: ${cfg.timer?.mode === 'ss' ? 'старт-стоп' : cfg.timer?.mode}`)
console.log(`  Задержка на луч: ${cfg.timer?.stopDelay} мс`)
console.log(`  Активная сеть: #${Number(cfg.wifi.wifiid) + 1} — ${active?.ssid} (${active?.mode})`)
console.log('  Список сетей:')
for (const [i, net] of cfg.wifi.list.entries()) {
  console.log(`    #${i + 1}  ${net.mode.padEnd(6)} ${net.ssid}`)
}

if (mode === 'find') {
  console.log(`\n  В event.config.js:  timer: '${ip}',\n`)
  rl.close()
  process.exit(0)
}

if (mode !== 'setup' && mode !== 'ap') {
  console.log(`\n  Неизвестная команда «${mode}». Есть: setup, ap.\n`)
  rl.close()
  process.exit(1)
}

const next = structuredClone(cfg)

if (mode === 'setup') {
  console.log('\n  Прибор зайдёт в общую сеть как обычное устройство.')
  console.log('  Сеть обязана вещать на 2,4 ГГц — пятигигагерцевую ESP не видит.\n')

  const ssid = (await ask('  Имя сети (ssid): ')).trim()
  const pass = (await ask('  Пароль: ')).trim()

  if (!ssid) {
    console.log('\n  Пустое имя сети — отменено, прибор не тронут.\n')
    rl.close()
    process.exit(1)
  }

  // Первая запись — несъёмная точка доступа прибора, её режим менять
  // нельзя. Клиентскую держим второй: она и станет активной.
  next.wifi.list = [next.wifi.list[0], { mode: 'client', ssid, pass }]
  next.wifi.wifiid = '1'
} else {
  next.wifi.wifiid = '0'
  console.log('\n  Прибор вернётся на собственную точку доступа.')
}

const target = next.wifi.list[Number(next.wifi.wifiid)]
console.log(`\n  Станет активной сеть #${Number(next.wifi.wifiid) + 1} — ${target.ssid} (${target.mode})`)

const ok = (await ask('  Записать в прибор? (y/N) ')).trim().toLowerCase()
if (ok !== 'y') {
  console.log('\n  Отменено, прибор не тронут.\n')
  rl.close()
  process.exit(0)
}

if (!await writeConfig(ip, next)) {
  console.log('\n  Прибор не принял настройки. Ничего не изменилось.\n')
  rl.close()
  process.exit(1)
}

console.log('\n  Записано. Теперь выключи и включи питание прибора.')
await ask('  Нажми Enter, когда он загрузится: ')

console.log()
const found = await waitForTimer(90)

if (found) {
  console.log(`\n  Прибор на ${found}.`)
  console.log(`\n  В event.config.js:  timer: '${found}',\n`)
} else {
  console.log('\n  Прибор не нашёлся за полторы минуты.')
  console.log(mode === 'setup'
    ? '  Скорее всего, сеть не подошла и он откатился на свою точку.\n  Подключись к wifi StopWatcher1 и запусти скрипт снова.\n'
    : '  Подключись к wifi StopWatcher1 и запусти скрипт снова.\n')
}

rl.close()
