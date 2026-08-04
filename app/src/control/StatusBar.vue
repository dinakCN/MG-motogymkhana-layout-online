<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { secondsSince } from '../shared/format.js'
import { roundText } from '../shared/rounds.js'

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

// Боевой этап приходит с сервера (config.liveStageId): держать его номер
// ещё и здесь значило бы, что после смены этапа предупреждение начнёт врать.
const rehearsal = computed(
  () => Boolean(props.state.liveStageId && props.state.stageId !== props.state.liveStageId),
)
</script>

<template>
  <div class="bar">
    <span class="dot" :class="level"></span>
    <span>{{ age === null ? 'данных ещё не было' : `обновлено ${age} с назад` }}</span>

    <span class="sep">·</span>
    <span :class="{ warn: !connected }">{{ connected ? 'сервер на связи' : 'НЕТ СВЯЗИ С СЕРВЕРОМ' }}</span>

    <span class="sep">·</span>
    <!-- Номер этапа на виду: защита от эфира на данных полигона. -->
    <span class="stage" :class="{ rehearsal }">
      этап {{ state.stageId ?? '—' }}{{ rehearsal ? ' (не боевой!)' : '' }}
    </span>

    <span class="sep">·</span>
    <span>участников: {{ state.participants.length }}</span>

    <span class="sep">·</span>
    <span>момент: {{ roundText(state.round).label }}</span>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 16px 0;
  padding: 11px 18px;
  background: rgba(28, 32, 40, 0.72);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  backdrop-filter: blur(30px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--r-pill);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.14);
  font-size: 14px;
  color: var(--ink-dim);
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
  transition: background 300ms ease, box-shadow 300ms ease;
}

.dot.ok { background: var(--ok); box-shadow: 0 0 10px rgba(48, 209, 88, 0.7); }
.dot.warn { background: var(--warn); box-shadow: 0 0 10px rgba(255, 214, 10, 0.7); }
.dot.bad { background: var(--danger); box-shadow: 0 0 12px rgba(255, 69, 58, 0.8); }

.sep { color: var(--ink-faint); }
.warn { color: var(--danger); font-weight: 640; }

/* Не боевой этап — единственное, что подсвечивается в этой строке:
     провести эфир на данных полигона — самая обидная ошибка дня. */
.stage.rehearsal {
  background: var(--warn);
  color: #0a0d12;
  font-weight: 640;
  padding: 3px 12px;
  border-radius: var(--r-pill);
}
</style>
