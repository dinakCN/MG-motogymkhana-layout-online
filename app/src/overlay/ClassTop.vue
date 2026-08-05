<script setup>
import { computed } from 'vue'
import { bestOf, bestSeconds, formatDelta, fractionDigits, NO_RESULT_LABELS } from '../shared/format.js'
import { topOfGroup } from '../shared/awardGroups.js'

const props = defineProps({
  participants: { type: Array, required: true },
  group: { type: String, required: true },
  awardGroups: { type: Array, default: () => [] },
  riderGroups: { type: Object, default: () => ({}) },
  highlightId: { type: String, default: null },
  limit: { type: Number, default: 3 },
})

const rows = computed(() => {
  const top = topOfGroup(
    props.participants, props.group, props.awardGroups, props.riderGroups,
    props.highlightId, props.limit,
  )

  // Лидер отсчёта — лучшее время среди показанных, а не первая строка:
  // в начале дня наверху может стоять тот, кто ещё не ехал, и отставания
  // от пустого времени не считаются.
  const times = top.map(({ rider }) => bestSeconds(rider)).filter(s => s !== null)
  const leader = times.length ? Math.min(...times) : null

  return top.map(({ rider, place }) => {
    const own = bestSeconds(rider)
    const label = bestOf(rider)
    const delta = own !== null && leader !== null ? own - leader : null

    // Отставание показываем с точностью самого результата: при хронометраже
    // до десятитысячных двух знаков не хватит, чтобы различить соседей.
    return {
      rider,
      place,
      best: label ?? '—',
      dnf: NO_RESULT_LABELS.includes(label),
      delta: formatDelta(delta, fractionDigits(label)),
    }
  })
})
</script>

<template>
  <div v-if="rows.length" class="tower">
    <h3>{{ group }}</h3>
    <div
      v-for="({ rider, place, best, delta, dnf }) in rows"
      :key="rider.id"
      class="line"
      :class="{ current: rider.id === highlightId }"
    >
      <span class="pl tabular">{{ place ?? '—' }}</span>
      <span class="nm">{{ rider.fio }}</span>
      <span class="bt tabular" :class="{ dnf }">{{ best }}</span>
      <span class="dl tabular">{{ delta }}</span>
    </div>
  </div>
</template>

<style scoped>
.tower {
  position: absolute;
  left: 1418px;
  bottom: 64px;
  width: 430px;
  height: var(--scene-h);
  padding: 0 18px;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--glass-base);
  background-image: var(--glass);
  border: 1px solid var(--glass-edge);
  box-shadow: var(--glass-shadow), var(--glass-inner);
  animation: tower-in 420ms cubic-bezier(0.32, 0.72, 0, 1);
  transition: height 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes tower-in {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

h3 {
  font-size: 11px;
  font-weight: 620;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-bottom: 9px;
}

.line {
  display: grid;
  grid-template-columns: 24px 1fr 94px 68px;
  gap: 9px;
  align-items: baseline;
  padding: 6px 8px;
  margin: 0 -8px;
  border-radius: 10px;
  font-size: 18px;
  font-weight: 450;
}

/* Текущий райдер выделен так же, как лидер в общей таблице:
   один язык подсветки на всех сценах. */
.line.current {
  background: rgba(255, 159, 10, 0.14);
  box-shadow: inset 2px 0 0 var(--accent);
  font-weight: 620;
}

.pl { color: var(--accent); font-weight: 700; font-size: 16px; }
.nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bt { text-align: right; font-weight: 620; }
.bt.dnf { font-size: 15px; font-style: italic; font-weight: 450; color: var(--ink-faint); }
.dl { text-align: right; color: var(--ink-faint); font-size: 16px; }
</style>
