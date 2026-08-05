<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  participants: { type: Array, required: true },
  currentRun: { type: Object, required: true },
  activeScene: { type: String, required: true },
  preselected: { type: Object, default: null },
  showRunTime: { type: Boolean, default: true },
  showClassTop: { type: Boolean, default: true },
})
const emit = defineEmits(['publish', 'option'])

const numberInput = ref('')
const attempt = ref(1)
const caption = ref('')
const numberField = ref(null)

// Предпросмотр: набор номера меняет карточку здесь, но не в эфире.
// Без этого разделения оператор, готовя следующего райдера заранее,
// выбрасывал бы его в кадр посреди заезда предыдущего.
const preview = ref(null)

watch(() => props.preselected, (rider) => { if (rider) preview.value = rider })

// Номер, которого нет в составе, обязан гасить предпросмотр. Иначе там
// оставался бы прежний райдер, и Enter вывел бы в эфир не того, кого
// оператор только что набрал, — молча и без единого признака ошибки.
const notFound = computed(() => {
  const value = numberInput.value.trim()
  if (!value) return false
  return !props.participants.some(p => p.number === Number.parseInt(value, 10))
})

watch([numberInput, () => props.participants], () => {
  const value = numberInput.value.trim()
  if (!value) return

  const found = props.participants.find(p => p.number === Number.parseInt(value, 10))
  preview.value = found ?? null
})

const onAir = computed(
  () => props.activeScene === 'run' && props.currentRun.participantId === preview.value?.id,
)

function publish() {
  if (!preview.value) return
  emit('publish', {
    participantId: preview.value.id,
    attemptLabel: `Попытка ${attempt.value}`,
    caption: caption.value,
  })
  numberInput.value = ''
}

defineExpose({ focusNumber: () => numberField.value?.focus() })
</script>

<template>
  <div class="panel">
    <h3>Заезд</h3>

    <div class="row">
      <input
        ref="numberField"
        v-model="numberInput"
        class="input num"
        placeholder="№"
        inputmode="numeric"
        @keyup.enter="publish"
      />
      <span class="badge" :class="onAir ? 'air' : 'prev'">
        {{ onAir ? 'В ЭФИРЕ' : 'предпросмотр' }}
      </span>
    </div>

    <div v-if="preview" class="card">
      <div class="line1">{{ preview.sportClass || '—' }} · {{ preview.number ?? '—' }} · {{ preview.fio }}</div>
      <div class="line2">{{ preview.city }}</div>
      <div class="line2">{{ preview.motorcycle }}</div>
    </div>
    <p v-else-if="notFound" class="miss">Номера {{ numberInput }} нет в составе — найдите по ФИО в списке</p>
    <p v-else class="hint">Наберите номер или выберите участника в списке</p>

    <div class="row">
      <span class="label">Попытка</span>
      <button class="btn" :class="{ primary: attempt === 1 }" @click="attempt = 1">1</button>
      <button class="btn" :class="{ primary: attempt === 2 }" @click="attempt = 2">2</button>
    </div>

    <input v-model="caption" class="input" placeholder="подпись (необязательно)" />

    <button class="btn primary wide" :disabled="!preview" @click="publish">
      {{ onAir ? 'Обновить в эфире' : 'В эфир' }}
    </button>

    <div class="options">
      <label class="switch">
        <span class="name">Время в кадре</span>
        <span class="key">T</span>
        <input
          type="checkbox"
          :checked="showRunTime"
          @change="emit('option', { option: 'showRunTime', value: $event.target.checked })"
        />
        <span class="track"></span>
      </label>

      <label class="switch">
        <span class="name">Топ-3 класса</span>
        <input
          type="checkbox"
          :checked="showClassTop"
          @change="emit('option', { option: 'showClassTop', value: $event.target.checked })"
        />
        <span class="track"></span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.label { font-size: 13px; color: var(--ink-faint); }
.num { width: 92px; font-size: 21px; font-weight: 600; text-align: center; }

.badge {
  font-size: 11px;
  font-weight: 640;
  letter-spacing: 0.05em;
  padding: 5px 12px;
  border-radius: var(--r-pill);
}

/* Красный бейдж — единственный сигнал, что карточка уже в кадре. */
.badge.air {
  background: var(--danger);
  color: #fff;
  box-shadow: 0 0 16px rgba(255, 69, 58, 0.5);
}

.badge.prev { background: rgba(255, 255, 255, 0.1); color: var(--ink-faint); }

.card {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-md);
  padding: 13px 15px;
  margin-bottom: 12px;
}

.line1 { font-size: 16px; font-weight: 640; }
.line2 { font-size: 13px; color: var(--ink-faint); margin-top: 2px; }
.hint { font-size: 13px; color: var(--ink-faint); margin-bottom: 12px; }

/* Промах по номеру должен быть виден боковым зрением: в эфире оператор
   смотрит на площадку, а не в пульт. */
.miss {
  font-size: 13px;
  color: var(--warn);
  margin-bottom: 12px;
  padding: 9px 12px;
  border-radius: var(--r-md);
  background: rgba(255, 214, 10, 0.12);
  border: 1px solid rgba(255, 214, 10, 0.3);
}

.wide { width: 100%; margin-top: 10px; }

/* Настройки сцены отделены от команд: кнопка «В эфир» меняет кадр,
   тумблеры — то, из чего он собран. Смешивать их в один столбец значит
   приглашать промахнуться в эфире. */
.options { margin-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.07); }
</style>
