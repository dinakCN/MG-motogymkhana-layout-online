<script setup>
import { computed } from 'vue'
import { groupsWithCounts, podiumOf } from '../shared/awardGroups.js'
import { bestOf } from '../shared/format.js'

const props = defineProps({
  participants: { type: Array, required: true },
  award: { type: Object, required: true },
  awardGroups: { type: Array, default: () => [] },
  riderGroups: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['change'])

const groups = computed(
  () => groupsWithCounts(props.participants, props.awardGroups, props.riderGroups),
)

// Призёры показаны только для чтения: оператор должен видеть, кто поедет
// в кадр, до того как переключит сцену.
const podium = computed(
  () => podiumOf(props.participants, props.award.subject, props.awardGroups, props.riderGroups),
)

function update(patch) {
  emit('change', { ...props.award, ...patch })
}
</script>

<template>
  <div class="panel">
    <h3>Награждение</h3>

    <select
      class="input"
      :value="award.subject ?? ''"
      @change="update({ subject: $event.target.value || null })"
    >
      <option value="">— группа —</option>
      <option v-for="g in groups" :key="g.name" :value="g.name">
        {{ g.name }} · {{ g.count }}
      </option>
    </select>

    <ol v-if="award.subject" class="podium">
      <li v-for="(rider, index) in podium" :key="rider.id" class="slot">
        <span class="pl tabular">{{ index + 1 }}</span>
        <span class="fio">{{ rider.fio }}</span>
        <span class="bt tabular">{{ bestOf(rider) ?? '—' }}</span>
      </li>
      <li v-if="!podium.length" class="slot empty">результатов пока нет</li>
    </ol>

    <div class="row">
      <span class="label">Место</span>
      <button
        v-for="place in [3, 2, 1]"
        :key="place"
        class="btn"
        :class="{ primary: !award.showAllThree && award.place === place }"
        @click="update({ place, showAllThree: false })"
      >{{ place }}</button>
    </div>

    <label class="check">
      <input
        type="checkbox"
        :checked="award.showAllThree"
        @change="update({ showAllThree: $event.target.checked })"
      />
      весь подиум разом
    </label>
  </div>
</template>

<style scoped>
.podium { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }

.slot {
  display: grid;
  grid-template-columns: 20px 1fr 76px;
  gap: 8px;
  align-items: center;
  font-size: 14px;
  padding: 5px 8px;
  border-radius: var(--r-md);
  background: rgba(255, 255, 255, 0.05);
}

.slot.empty { display: block; color: var(--ink-faint); font-size: 13px; }
.pl { color: var(--accent); font-weight: 640; }
.fio { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bt { text-align: right; color: var(--ink-dim); }

.row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.label { font-size: 13px; color: var(--ink-faint); }
.check { display: flex; align-items: center; gap: 8px; font-size: 14px; margin-top: 12px; cursor: pointer; }
</style>
