<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { secondsSince } from '../shared/format.js'

const props = defineProps({
  state: { type: Object, required: true },
  connected: { type: Boolean, required: true },
})

const now = ref(Date.now())
let timer = null

onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => clearInterval(timer))

const age = computed(() => {
  now.value // подписка на ежесекундный тик
  return secondsSince(props.state.lastSuccessfulPoll)
})

// Оверлей продолжает показывать последние хорошие данные и выглядит
// исправным, даже когда сеть легла. Этот индикатор — единственный способ
// заметить проблему до того, как о ней напишут в чат.
const level = computed(() => {
  if (age.value === null || age.value > 60) return 'bad'
  if (age.value > 30) return 'warn'
  return 'ok'
})

const ROUNDS = {
  round1: '1-я попытка',
  break1: 'перерыв',
  round2: '2-я попытка',
  final: 'итоги',
  break2: 'перед награждением',
  awards: 'награждение',
}
</script>

<template>
  <div class="bar">
    <span class="dot" :class="level"></span>
    <span>{{ age === null ? 'данных ещё не было' : `обновлено ${age} с назад` }}</span>

    <span class="sep">·</span>
    <span :class="{ warn: !connected }">{{ connected ? 'сервер на связи' : 'НЕТ СВЯЗИ С СЕРВЕРОМ' }}</span>

    <span class="sep">·</span>
    <!-- Номер этапа на виду: защита от эфира на данных полигона. -->
    <span class="stage" :class="{ rehearsal: state.stageId && state.stageId !== '677' }">
      этап {{ state.stageId ?? '—' }}{{ state.stageId && state.stageId !== '677' ? ' (не боевой!)' : '' }}
    </span>

    <span class="sep">·</span>
    <span>участников: {{ state.participants.length }}</span>

    <span class="sep">·</span>
    <span>раунд: {{ ROUNDS[state.round] ?? state.round }}</span>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  background: #161b22;
  border-bottom: 1px solid rgba(240, 246, 252, 0.1);
  font-size: 14px;
}

.dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.dot.ok { background: #3fb950; }
.dot.warn { background: #d29922; }
.dot.bad { background: #f85149; }

.sep { color: #8b949e; }
.warn { color: #f85149; font-weight: 700; }

.stage.rehearsal {
  background: #d29922;
  color: #0d1117;
  font-weight: 700;
  padding: 2px 10px;
}
</style>
