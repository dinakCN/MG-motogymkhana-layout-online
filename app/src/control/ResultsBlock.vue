<script setup>
import { computed } from 'vue'
import { sectionsOfGroups, UNGROUPED } from '../shared/awardGroups.js'
import { groupByClass } from '../shared/format.js'

const props = defineProps({
  byGroup: { type: Boolean, default: false },
  participants: { type: Array, default: () => [] },
  awardGroups: { type: Array, default: () => [] },
  riderGroups: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['option'])

// Список секций считается тем же кодом, что и в кадре: оператор видит,
// что получится, до переключения, а не после. Ради «Вне групп» проверка
// и нужна — она появляется, только когда чей-то класс не разобрался, и
// в разрезе по классам этого не видно вовсе.
const preview = computed(() => (props.byGroup
  ? sectionsOfGroups(props.participants, props.awardGroups, props.riderGroups)
    .map(s => ({ name: s.name, count: s.riders.length, warn: s.name === UNGROUPED }))

  : groupByClass(props.participants)
    .map(g => ({ name: g.sportClass, count: g.riders.length, warn: false }))
))

const pick = value => emit('option', { option: 'resultsByGroup', value })
</script>

<template>
  <div class="panel">
    <h3>Таблица</h3>

    <div class="chips">
      <button class="chip" :class="{ active: !byGroup }" @click="pick(false)">по классам</button>
      <button class="chip" :class="{ active: byGroup }" @click="pick(true)">по группам</button>
      <span class="key">G</span>
    </div>

    <div class="preview">
      <span class="cap">в кадре (клавиша 1)</span>

      <div v-if="preview.length" class="list">
        <span
          v-for="section in preview"
          :key="section.name"
          class="item"
          :class="{ warn: section.warn }"
        >{{ section.name }}<i>{{ section.count }}</i></span>
      </div>

      <div v-else class="empty">участников ещё нет</div>
    </div>
  </div>
</template>

<style scoped>
.chips { display: flex; align-items: center; gap: 6px; }

.chip {
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--r-pill);
  cursor: pointer;
  transition: background 140ms ease;
}

.chip:hover { background: rgba(255, 255, 255, 0.14); }

.chip.active {
  background: var(--accent);
  border-color: transparent;
  color: #0a0d12;
  font-weight: 640;
}

.key { margin-left: auto; font-size: 11px; color: var(--ink-faint); }

.preview {
  margin-top: 12px;
  padding: 10px 13px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-md);
}

.cap {
  font-size: 10px;
  font-weight: 590;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

.list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }

.item {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 4px 9px;
  font-size: 13px;
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.07);
}

.item i {
  font-style: normal;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--ink-faint);
}

/* Жёлтым — люди, которые в кадре соберутся в плашку «Вне групп»: у них не
   разобрался класс, и до церемонии это надо развести руками в списке ниже. */
.item.warn {
  background: rgba(255, 214, 10, 0.14);
  border: 1px solid rgba(255, 214, 10, 0.3);
  color: var(--warn);
}

.item.warn i { color: var(--warn); }

.empty { font-size: 13px; color: var(--ink-faint); margin-top: 6px; }
</style>
