<script setup>
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  preselected: { type: Object, default: null },
  timeout: { type: Number, default: 6000 },
})
const emit = defineEmits(['show', 'hide'])

const rider = ref(null)
const caption = ref('Лучшее время дня')
let hideTimer = null

watch(() => props.preselected, (value) => { if (value) rider.value = value })

function show() {
  if (!rider.value) return
  emit('show', { participantId: rider.value.id, caption: caption.value })

  // Автоскрытие: нижняя треть должна висеть 3–6 секунд, а не до тех пор,
  // пока оператор о ней вспомнит.
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => emit('hide'), props.timeout)
}

function hide() {
  clearTimeout(hideTimer)
  emit('hide')
}

onUnmounted(() => clearTimeout(hideTimer))
</script>

<template>
  <div class="panel">
    <h3>Хайлайт</h3>

    <p class="who">{{ rider ? `${rider.number ?? '—'} · ${rider.fio}` : 'выберите участника в списке' }}</p>
    <input v-model="caption" class="input" placeholder="подпись" />

    <div class="row">
      <button class="btn primary" :disabled="!rider" @click="show">
        Показать {{ Math.round(timeout / 1000) }} с
      </button>
      <button class="btn danger" @click="hide">Скрыть</button>
    </div>
  </div>
</template>

<style scoped>
.who { font-size: 14px; margin-bottom: 10px; }
.row { display: flex; gap: 8px; margin-top: 10px; }
</style>
