<script setup>
import { computed } from 'vue'
import { topOfClass, bestOf, parseTimeToSeconds, formatDelta } from '../shared/format.js'

const props = defineProps({
  participants: { type: Array, required: true },
  sportClass: { type: String, required: true },
  highlightId: { type: String, default: null },
})

const rows = computed(() => {
  const top = topOfClass(props.participants, props.sportClass, 5)
  const leader = parseTimeToSeconds(bestOf(top[0] || {}))

  return top.map((rider) => {
    const own = parseTimeToSeconds(bestOf(rider))
    const delta = own !== null && leader !== null ? own - leader : null
    return { rider, best: bestOf(rider) ?? '—', delta: formatDelta(delta) }
  })
})
</script>

<template>
  <div v-if="rows.length" class="tower">
    <h3>Класс {{ sportClass }}</h3>
    <div
      v-for="({ rider, best, delta }) in rows"
      :key="rider.id"
      class="line"
      :class="{ current: rider.id === highlightId }"
    >
      <span class="pl tabular">{{ rider.placeInClass ?? '—' }}</span>
      <span class="nm">{{ rider.fio }}</span>
      <span class="bt tabular">{{ best }}</span>
      <span class="dl tabular">{{ delta }}</span>
    </div>
  </div>
</template>

<style scoped>
.tower {
  position: absolute;
  right: 96px;
  bottom: 120px;
  width: 480px;
  padding: 20px 24px;
  background: rgba(13, 17, 23, 0.88);
  animation: tower-in 350ms ease-out;
}

@keyframes tower-in {
  from { opacity: 0; transform: translateX(32px); }
  to   { opacity: 1; transform: translateX(0); }
}

h3 { font-size: 19px; color: var(--muted); margin-bottom: 12px; font-weight: 600; }

.line {
  display: grid;
  grid-template-columns: 28px 1fr 96px 74px;
  gap: 10px;
  padding: 6px 0;
  font-size: 20px;
  border-bottom: 1px solid var(--line);
}

.line.current { color: var(--accent); font-weight: 700; }
.pl { color: var(--accent); font-weight: 700; }
.nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bt { text-align: right; }
.dl { text-align: right; color: var(--muted); }
</style>
