<script setup>
import { computed } from 'vue'
import { ROUNDS, roundText } from '../shared/rounds.js'

const props = defineProps({ round: { type: String, required: true } })
const emit = defineEmits(['change'])

// Оператор выбирает момент дня вслепую, если не видит текста: подпись
// под кнопками показывает ровно то, что уйдёт в кадр на сцене «Пауза».
const preview = computed(() => roundText(props.round))
</script>

<template>
  <div class="panel">
    <h3>Момент дня</h3>

    <div class="chips">
      <button
        v-for="item in ROUNDS"
        :key="item.key"
        class="chip"
        :class="{ active: item.key === round }"
        @click="emit('change', item.key)"
      >{{ item.label }}</button>
    </div>

    <div class="preview">
      <span class="cap">на паузе (клавиша 4)</span>
      <div class="title">{{ preview.title }}</div>
      <div v-if="preview.sub" class="sub">{{ preview.sub }}</div>
    </div>
  </div>
</template>

<style scoped>
.chips { display: flex; flex-wrap: wrap; gap: 6px; }

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

.title { font-size: 15px; font-weight: 640; margin-top: 4px; }
.sub { font-size: 13px; color: var(--ink-faint); margin-top: 2px; }
</style>
