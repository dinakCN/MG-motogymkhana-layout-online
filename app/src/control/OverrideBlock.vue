<script setup>
import { ref, computed, watch } from 'vue'
import { isScratched } from '../shared/format.js'

const props = defineProps({ rider: { type: Object, default: null } })
const emit = defineEmits(['override'])

const open = ref(false)
const attempt = ref(1)
const field = ref('time')
const value = ref('')

watch(field, () => { value.value = '' })

// Те же правила, что и на сервере (normalizeOverride в server/state.js):
// сервер отвергает неразобранное значение молча, и без этой проверки
// оператор в эфире не понял бы, почему правка «не применилась».
const valid = computed(() => {
  const raw = value.value.trim()
  if (!raw) return false

  return field.value === 'penalty'
    ? /^\d{1,3}$/.test(raw)
    : /^\d{1,2}:[0-5]?\d([.,]\d{1,4})?$/.test(raw)
})

// Знаков после точки — сколько намерил хронометраж, до четырёх.
const hint = computed(() => (field.value === 'penalty'
  ? 'целые секунды штрафа, например 4'
  : 'время как в протоколе: 01:23.72 или 01:23.7215'))

// В зачёт идёт только засчитанная попытка. Правка времени незачтённой
// её не воскрешает — и это правильно, иначе кадр разошёлся бы с решением
// судей. Но молча оператор бы не понял, почему вписанное время не считается.
const notCounted = computed(() => {
  const chosen = props.rider?.attempts?.find(a => a.n === attempt.value)
  return Boolean(chosen && isScratched(chosen))
})

function apply() {
  if (!props.rider || !valid.value) return

  const raw = value.value.trim()
  emit('override', {
    participantId: props.rider.id,
    attempt: attempt.value,
    field: field.value,
    value: field.value === 'penalty' ? Number(raw) : raw,
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

      <input
        v-model="value"
        class="input"
        :class="{ bad: value.trim() && !valid }"
        :placeholder="hint"
        @keyup.enter="apply"
      />
      <p v-if="value.trim() && !valid" class="bad-hint">Не разберётся: {{ hint }}</p>
      <p v-if="notCounted" class="warn">
        Попытка {{ attempt }} не зачтена в протоколе — правка не вернёт её в зачёт.
        Лучшее время считается по засчитанным попыткам.
      </p>

      <div class="row">
        <button class="btn danger grow" :disabled="!rider || !valid" @click="apply">Применить</button>
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

/* Значение, которое сервер отвергнет, видно до нажатия: молчаливый отказ
   в эфире выглядел бы как «правка не работает». */
.input.bad { border-color: var(--danger); }
.bad-hint { font-size: 12px; color: var(--danger); }
</style>
