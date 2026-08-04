<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  participants: { type: Array, required: true },
  currentRun: { type: Object, required: true },
  activeScene: { type: String, required: true },
  preselected: { type: Object, default: null },
})
const emit = defineEmits(['publish'])

const numberInput = ref('')
const attempt = ref(1)
const caption = ref('')
const numberField = ref(null)

// Предпросмотр: набор номера меняет карточку здесь, но не в эфире.
// Без этого разделения оператор, готовя следующего райдера заранее,
// выбрасывал бы его в кадр посреди заезда предыдущего.
const preview = ref(null)

watch(() => props.preselected, (rider) => { if (rider) preview.value = rider })

watch(numberInput, (value) => {
  const n = Number.parseInt(value, 10)
  if (Number.isNaN(n)) return
  const found = props.participants.find(p => p.number === n)
  if (found) preview.value = found
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
  </div>
</template>

<style scoped>
.row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.label { font-size: 13px; color: #8b949e; }
.num { width: 90px; font-size: 20px; text-align: center; }

.badge { font-size: 12px; padding: 4px 10px; font-weight: 700; letter-spacing: 0.04em; }
.badge.air { background: #f85149; color: #fff; }
.badge.prev { background: #21262d; color: #8b949e; }

.card { background: #0d1117; padding: 12px; margin-bottom: 10px; }
.line1 { font-size: 16px; font-weight: 700; }
.line2 { font-size: 13px; color: #8b949e; }
.hint { font-size: 13px; color: #8b949e; margin-bottom: 10px; }

.wide { width: 100%; margin-top: 10px; }
</style>
