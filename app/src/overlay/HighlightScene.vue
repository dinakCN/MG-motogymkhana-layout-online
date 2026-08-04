<script setup>
import { computed } from 'vue'
import { bestOf } from '../shared/format.js'

const props = defineProps({ state: { type: Object, required: true } })

const rider = computed(
  () => props.state.participants.find(p => p.id === props.state.highlight.participantId) || null,
)
</script>

<template>
  <div v-if="rider && state.highlight.visible" class="lower-third">
    <div class="bar">
      <span class="tag">{{ state.highlight.caption || 'Лучший заезд' }}</span>
      <span class="fio">{{ rider.fio }}</span>
      <span class="time tabular">{{ bestOf(rider) ?? '—' }}</span>
    </div>
  </div>
</template>

<style scoped>
.lower-third {
  position: absolute;
  left: 96px;
  bottom: 140px;
  animation: lt-in 420ms cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes lt-in {
  from { opacity: 0; transform: translateY(26px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.bar {
  display: flex;
  align-items: center;
  gap: 26px;
  padding: 18px 28px;
  border-radius: var(--r-pill);
  background: var(--glass-base);
  background-image: var(--glass);
  border: 1px solid var(--glass-edge);
  box-shadow: var(--glass-shadow), var(--glass-inner);
}

.tag {
  background: var(--accent);
  color: #0a0d12;
  font-weight: 700;
  font-size: 18px;
  padding: 6px 18px;
  border-radius: var(--r-pill);
}

.fio { font-size: 38px; font-weight: 700; letter-spacing: -0.02em; }
.time { font-size: 38px; font-weight: 700; color: var(--accent); padding-right: 8px; }
</style>
