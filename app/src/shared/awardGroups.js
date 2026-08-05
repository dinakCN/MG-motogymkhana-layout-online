import { bestSeconds } from './format.js'

// ────────────────────────────────────────────────────────────────────────
// Награждают не по классам, а по их объединениям: на этапе 677 это
// Спортсмены (D1-B), Любители (D2-D3), Новички (N-D4), Круизер и SB.
// Состав задаётся в event.config.js, ручные перемещения — в пульте.
//
// Групп у участника может быть несколько: класс говорит о мастерстве,
// а Круизер и SB — о мотоцикле, и D2-шник на круизере награждается
// в обоих зачётах. Запретить это этап может ключом strictGroups.
// ────────────────────────────────────────────────────────────────────────

// Участники, чей класс не попал ни в одну группу. Не хранится, а
// вычисляется: это не настоящая группа, а видимое место сбора аномалий.
// Без него человек с незнакомым классом молча пропал бы из награждения.
export const UNGROUPED = 'Вне групп'

export function groupsOf(rider, groups = [], riderGroups = {}) {
  // Ручной список — полный ответ, включая пустой: пустой значит «вне
  // зачёта», и подставлять вместо него класс нельзя. Круизер и SB из
  // протокола не выводятся вообще — их определяет мотоцикл, а не индекс
  // класса, поэтому набранное руками всегда важнее вычисленного.
  //
  // Неизвестные имена отсеиваются здесь, а не у каждого потребителя:
  // пометка могла остаться от прошлого этапа, где группы назывались иначе.
  // Пока фильтрация жила ниже, бейдж в строке показывал такую группу как
  // настоящую, счётчики рядом её не видели, а меню отправляло серверу
  // команду с несуществующим именем — та отвергалась целиком, и оператор
  // молча терял управление группами этого участника.
  const manual = riderGroups[rider?.id]
  if (Array.isArray(manual)) return manual.filter(name => isKnown(name, groups))

  const sportClass = rider?.sportClass
  if (!sportClass) return []

  // Класс, попавший сразу в две группы, — опечатка в конфиге, а не способ
  // задать двойной зачёт: двойной задаётся пометкой.
  const group = groups.find(g => (g.classes || []).includes(sportClass))
  return group ? [group.name] : []
}

// Группа известна, только если она есть в справочнике: пометка могла
// остаться от прошлого этапа, где состав групп был другим.
function isKnown(name, groups) {
  return Boolean(name) && groups.some(g => g.name === name)
}

// Каким станет список групп участника после клика по строке меню.
// Живёт здесь, а не в компоненте: это единственный производитель payload
// для setRiderGroup, и проверять его нужно тестами, а не глазами в эфире.
export function nextGroups(current = [], name, strict = false) {
  const has = current.includes(name)

  if (!strict) return has ? current.filter(n => n !== name) : [...current, name]

  // Строгий режим ведёт себя как радиокнопки, но с одной оговоркой.
  // Клик по отмеченной группе снимает её — иначе «вне зачёта» было бы
  // недостижимо. А вот когда групп несколько (режим включили после того,
  // как пометки проставили), тот же клик означает противоположное:
  // оператор разрешает конфликт и оставляет ту группу, по которой щёлкнул.
  // Отдавать здесь пустой список значило бы выбрасывать человека из всех
  // зачётов ровно тем движением, которым его хотели в зачёте оставить.
  if (has) return current.length > 1 ? [name] : []
  return [name]
}

export function groupsWithCounts(participants = [], groups = [], riderGroups = {}) {
  const counts = new Map(groups.map(g => [g.name, 0]))
  let ungrouped = 0

  for (const rider of participants) {
    const names = groupsOf(rider, groups, riderGroups)

    // В мягком режиме сумма счётчиков больше числа участников: тот, кто
    // едет и в «Любителях», и в «Круизере», посчитан дважды — и это ровно
    // то, ради чего режим включают.
    if (names.length) for (const name of names) counts.set(name, counts.get(name) + 1)
    else ungrouped += 1
  }

  const rows = groups.map(g => ({ name: g.name, count: counts.get(g.name) }))
  if (ungrouped > 0) rows.push({ name: UNGROUPED, count: ungrouped })
  return rows
}

export function ridersOfGroup(participants = [], name, groups = [], riderGroups = {}) {
  if (!name) return []

  return participants
    .filter((rider) => {
      const names = groupsOf(rider, groups, riderGroups)
      return name === UNGROUPED ? !names.length : names.includes(name)
    })
    // Похоже на topOfClass из format.js, но объединять нельзя: тот сначала
    // сортирует по placeInClass, а здесь это запрещено — сайт считает места
    // внутри класса, и в группе «Любители» первых мест два, от D2 и от D3.
    // Порядок в протоколе запоминаем и используем при равном времени:
    // подиум не должен переставляться сам между опросами.
    .map((rider, order) => ({ rider, order, seconds: bestSeconds(rider) }))
    .sort((a, b) => (a.seconds ?? Infinity) - (b.seconds ?? Infinity) || a.order - b.order)
    .map(x => x.rider)
}

// Участники, у которых известных групп больше одной. В мягком режиме это
// норма, ради которой всё и делалось; в строгом — след переключения режима
// посреди этапа. Состояние не чинится само: тихо вынуть человека из группы
// перед его церемонией хуже, чем показать противоречие и дать разобраться.
export function conflictsOf(participants = [], groups = [], riderGroups = {}) {
  return participants.filter(rider => groupsOf(rider, groups, riderGroups).length > 1)
}

// Призёры группы. Короче трёх — законно: в группе может быть меньше людей,
// а сошедшие и не стартовавшие в награждении не участвуют.
export function podiumOf(participants = [], subject, groups = [], riderGroups = {}) {
  return ridersOfGroup(participants, subject, groups, riderGroups)
    .filter(rider => bestSeconds(rider) !== null)
    .slice(0, 3)
}

// Место, которое останется осмысленным в другой группе. Церемонию ведут
// с третьего места, но в Круизере и SB призёров может быть один-два, и
// перенос выбранного третьего места на такую группу оставил бы в кадре
// надпись «призёры появятся» вместо победителя, который стоит в зале.
// Пустая группа даёт первое место: других сервер не принимает.
export function clampPlace(place, podiumSize) {
  return Math.min(Math.max(place, 1), Math.max(podiumSize, 1))
}
