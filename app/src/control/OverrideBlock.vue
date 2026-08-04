<script setup>
import { ref } from 'vue'

const props = defineProps({ rider: { type: Object, default: null } })
const emit = defineEmits(['override'])

const open = ref(false)
const attempt = ref(1)
const field = ref('time')
const value = ref('')

function apply() {
  if (!props.rider || !value.value) return

  emit('override', {
    participantId: props.rider.id,
    attempt: attempt.value,
    field: field.value,
    value: field.value === 'penalty' ? Number(value.value) : value.value,
  })
  value.value = ''
}

// Правка держится поверх данных сайта, пока её не снимут: пустое значение
// возвращает ячейку под управление опросчика.
function reset() {
  if (!props.rider) return

  emit('override', {
    participantId: props.rider.id,
    attempt: attempt.value,
    field: field.value,
    value: '',
  })
  value.value = ''
}
</script>

<template>
  <div class="panel">
    <button class="toggle" @click="open = !open">
      {{ open ? '▾' : '▸' }} Аварийная правка результата
    </button>

    <div v-if="open" class="body">
      <p class="warn">Только если парсинг сломался. Обычный путь — данные с сайта.</p>
      <p class="who">{{ rider ? `${rider.number ?? '—'} · ${rider.fio}` : 'выберите участника в списке' }}</p>

      <div class="row">
        <select v-model.number="attempt" class="input">
          <option :value="1">Попытка 1</option>
          <option :value="2">Попытка 2</option>
        </select>
        <select v-model="field" class="input">
          <option value="time">Время</option>
          <option value="penalty">Штраф</option>
        </select>
      </div>

      <input v-model="value" class="input" placeholder="например 00:42.31" @keyup.enter="apply" />

      <div class="row">
        <button class="btn danger grow" :disabled="!rider || !value" @click="apply">Применить</button>
        <button class="btn" :disabled="!rider" @click="reset">Снять правку</button>
      </div>

      <p class="note">Правка держится поверх данных сайта, пока её не снять.</p>
    </div>
  </div>
</template>

<style scoped>
.toggle {
  background: none;
  border: 0;
  color: var(--ink-faint);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  padding: 0;
}

.body { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.warn { font-size: 12px; color: var(--warn); }
.who { font-size: 13px; }
.row { display: flex; gap: 8px; }
.grow { flex: 1; }
.note { font-size: 11px; color: var(--ink-faint); }
</style>
