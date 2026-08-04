<script setup>
import { computed } from 'vue'

const props = defineProps({
  participants: { type: Array, required: true },
  award: { type: Object, required: true },
})
const emit = defineEmits(['change'])

const classes = computed(
  () => [...new Set(props.participants.map(p => p.sportClass).filter(Boolean))].sort(),
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
      :value="award.sportClass ?? ''"
      @change="update({ sportClass: $event.target.value || null })"
    >
      <option value="">— класс —</option>
      <option v-for="c in classes" :key="c" :value="c">{{ c }}</option>
    </select>

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
.row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.label { font-size: 13px; color: var(--ink-faint); }
.check { display: flex; align-items: center; gap: 8px; font-size: 14px; margin-top: 12px; cursor: pointer; }
</style>
