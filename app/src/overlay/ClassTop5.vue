<script setup>
import { computed } from 'vue'
import { topOfClass, bestOf, bestSeconds, formatDelta, fractionDigits, NO_RESULT_LABELS } from '../shared/format.js'

const props = defineProps({
  participants: { type: Array, required: true },
  sportClass: { type: String, required: true },
  highlightId: { type: String, default: null },
})

const rows = computed(() => {
  const top = topOfClass(props.participants, props.sportClass, 5)

  // Лидером для отсчёта служит лучшее время в показанной пятёрке, а не
  // первая строка: место с сайта может стоять у того, кто ещё не поехал,
  // и тогда все отставания вышли бы отрицательными.
  const times = top.map(bestSeconds).filter(s => s !== null)
  const leader = times.length ? Math.min(...times) : null

  return top.map((rider) => {
    const own = bestSeconds(rider)
    const label = bestOf(rider)
    const delta = own !== null && leader !== null ? own - leader : null

    // Отставание показываем с точностью самого результата: при хронометраже
    // до десятитысячных двух знаков не хватит, чтобы различить соседей.
    return {
      rider,
      best: label ?? '—',
      dnf: NO_RESULT_LABELS.includes(label),
      delta: formatDelta(delta, fractionDigits(label)),
    }
  })
})
</script>

<template>
  <div v-if="rows.length" class="tower">
    <h3>Класс {{ sportClass }}</h3>
    <div
      v-for="({ rider, best, delta, dnf }) in rows"
      :key="rider.id"
      class="line"
      :class="{ current: rider.id === highlightId }"
    >
      <span class="pl tabular">{{ rider.placeInClass ?? '—' }}</span>
      <span class="nm">{{ rider.fio }}</span>
      <span class="bt tabular" :class="{ dnf }">{{ best }}</span>
      <span class="dl tabular">{{ delta }}</span>
    </div>
  </div>
</template>

<style scoped>
.tower {
  position: absolute;
  right: 96px;
  bottom: 120px;
  width: 490px;
  padding: 20px 22px 14px;
  border-radius: var(--r-lg);
  background: var(--glass-base);
  background-image: var(--glass);
  border: 1px solid var(--glass-edge);
  box-shadow: var(--glass-shadow), var(--glass-inner);
  animation: tower-in 420ms cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes tower-in {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

h3 {
  font-size: 12px;
  font-weight: 590;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-bottom: 12px;
}

.line {
  display: grid;
  grid-template-columns: 30px 1fr 100px 78px;
  gap: 10px;
  align-items: baseline;
  padding: 7px 10px;
  margin: 0 -10px 2px;
  border-radius: var(--r-sm);
  font-size: 20px;
  font-weight: 450;
}

/* Текущий райдер выделен так же, как лидер в общей таблице:
   один язык подсветки на всех сценах. */
.line.current {
  background: linear-gradient(90deg, rgba(255, 159, 10, 0.18) 0%, transparent 65%);
  box-shadow: inset 2px 0 0 var(--accent);
  font-weight: 600;
}

.pl { color: var(--accent); font-weight: 700; }
.nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bt { text-align: right; font-weight: 600; }
.bt.dnf { font-size: 17px; font-style: italic; font-weight: 450; color: var(--ink-faint); }
.dl { text-align: right; color: var(--ink-faint); font-size: 18px; }
</style>
