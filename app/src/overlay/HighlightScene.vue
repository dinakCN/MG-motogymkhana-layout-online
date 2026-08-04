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
  animation: lt-in 350ms ease-out;
}

@keyframes lt-in {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}

.bar {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 20px 36px;
  background: rgba(13, 17, 23, 0.94);
  border-left: 6px solid var(--accent);
}

.tag { background: var(--accent); color: #0d1117; font-weight: 700; font-size: 20px; padding: 4px 14px; }
.fio { font-size: 40px; font-weight: 700; }
.time { font-size: 40px; font-weight: 700; color: var(--accent); }
</style>
