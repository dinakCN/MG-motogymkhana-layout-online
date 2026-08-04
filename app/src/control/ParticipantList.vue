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
.list { overflow-y: auto; height: 100%; }

.item {
  display: grid;
  grid-template-columns: 52px 44px 1fr 130px 96px;
  gap: 10px;
  padding: 9px 12px;
  font-size: 14px;
  border-bottom: 1px solid rgba(240, 246, 252, 0.07);
  cursor: pointer;
}

.item:hover { background: #21262d; }
.item.selected { background: #30363d; }

.cls { color: #f5a524; font-weight: 700; }
.num { color: #8b949e; }
.fio { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.city { color: #8b949e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.best { text-align: right; }

.empty { padding: 20px; color: #8b949e; font-size: 14px; }
</style>
