import { bestSeconds } from './format.js'

// ────────────────────────────────────────────────────────────────────────
// Награждают не по классам, а по их объединениям: на этапе 677 это
// Спортсмены (D1-B), Любители (D2-D3), Новички (N-D4), Круизер и SB.
// Состав задаётся в event.config.js, ручные перемещения — в пульте.
// ────────────────────────────────────────────────────────────────────────

// Участники, чей класс не попал ни в одну группу. Не хранится, а
// вычисляется: это не настоящая группа, а видимое место сбора аномалий.
// Без него человек с незнакомым классом молча пропал бы из награждения.
export const UNGROUPED = 'Вне групп'

export function groupOf(rider, groups = [], riderGroups = {}) {
  // Ручная пометка важнее класса: Круизер и SB из протокола не выводятся
  // вообще — их определяет мотоцикл, а не индекс класса.
  const manual = riderGroups[rider?.id]
  if (manual) return manual

  const sportClass = rider?.sportClass
  if (!sportClass) return null

  const group = groups.find(g => (g.classes || []).includes(sportClass))
  return group ? group.name : null
}

// Группа известна, только если она есть в справочнике: пометка могла
// остаться от прошлого этапа, где состав групп был другим.
function isKnown(name, groups) {
  return Boolean(name) && groups.some(g => g.name === name)
}

export function groupsWithCounts(participants = [], groups = [], riderGroups = {}) {
  const counts = new Map(groups.map(g => [g.name, 0]))
  let ungrouped = 0

  for (const rider of participants) {
    const name = groupOf(rider, groups, riderGroups)
    if (isKnown(name, groups)) counts.set(name, counts.get(name) + 1)
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
      const group = groupOf(rider, groups, riderGroups)
      return name === UNGROUPED ? !isKnown(group, groups) : group === name
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

// Призёры группы. Короче трёх — законно: в группе может быть меньше людей,
// а сошедшие и не стартовавшие в награждении не участвуют.
export function podiumOf(participants = [], subject, groups = [], riderGroups = {}) {
  return ridersOfGroup(participants, subject, groups, riderGroups)
    .filter(rider => bestSeconds(rider) !== null)
    .slice(0, 3)
}
