<script setup>
import { computed } from 'vue'
import { bestOf } from '../shared/format.js'

const props = defineProps({
  participants: { type: Array, required: true },
  query: { type: String, default: '' },
  selectedId: { type: String, default: null },
})
const emit = defineEmits(['pick'])

// Поиск идёт и по ФИО: у части участников номера не проставлены,
// и безномерного райдера иначе в эфир не вызвать.
const filtered = computed(() => {
  const q = props.query.trim().toLowerCase()
  if (!q) return props.participants

  return props.participants.filter(p =>
    p.fio.toLowerCase().includes(q)
    || String(p.number ?? '').includes(q)
    || (p.sportClass || '').toLowerCase().includes(q)
    || (p.city || '').toLowerCase().includes(q),
  )
})
</script>

<template>
  <div class="list">
    <div
      v-for="rider in filtered"
      :key="rider.id"
      class="item"
      :class="{ selected: rider.id === selectedId }"
      @click="emit('pick', rider)"
    >
      <span class="cls">{{ rider.sportClass || '—' }}</span>
      <span class="num tabular">{{ rider.number ?? '—' }}</span>
      <span class="fio">{{ rider.fio }}</span>
      <span class="city">{{ rider.city }}</span>
      <span class="best tabular">{{ bestOf(rider) ?? '—' }}</span>
    </div>

    <p v-if="!filtered.length" class="empty">Никого не нашлось</p>
  </div>
</template>

<style scoped>
.list { overflow-y: auto; height: 100%; padding: 6px; }

.item {
  display: grid;
  grid-template-columns: 46px 42px 1fr 130px 96px;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: var(--r-md);
  font-size: 14px;
  cursor: pointer;
  transition: background 140ms ease;
}

.item:hover { background: rgba(255, 255, 255, 0.07); }

.item.selected {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px rgba(255, 159, 10, 0.35);
}

.cls {
  justify-self: start;
  font-size: 12px;
  font-weight: 640;
  color: var(--accent);
  padding: 2px 9px;
  border-radius: var(--r-pill);
  background: var(--accent-soft);
}

.num { color: var(--ink-faint); }
.fio { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.city { color: var(--ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.best { text-align: right; font-weight: 560; }

.empty { padding: 22px; color: var(--ink-faint); font-size: 14px; }

.list::-webkit-scrollbar { width: 10px; }
.list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.14);
  border-radius: var(--r-pill);
  border: 3px solid transparent;
  background-clip: content-box;
}
</style>
