<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  formatClock, attemptResultLabel, deltaToAttempt,
  parseTimeToSeconds, formatDelta, fractionDigits,
} from '../shared/format.js'

const props = defineProps({
  rider: { type: Object, required: true },
  attemptLabel: { type: String, default: '' },
  // Заполняет мост со второго ноутбука. Пока его нет — здесь null, и блок
  // работает во втором режиме: показывает время первой попытки.
  timer: { type: Object, default: null },
})

// Показания моста считаются протухшими через две секунды. Решение принимает
// кадр, а не сервер: застывшие цифры хуже отсутствующих, и узнать об этом
// первым должен тот, кто их рисует.
const STALE_AFTER = 2000

const now = ref(Date.now())
let ticker = null

// Четыре тика в секунду с пересчётом от точки старта. Секунда в кадре
// сменится с запозданием максимум на 250 мс и никогда не уползёт:
// накопительное сложение на интервале дрейфует, и за длинный заезд
// расхождение стало бы заметным.
onMounted(() => { ticker = setInterval(() => { now.value = Date.now() }, 250) })
onUnmounted(() => clearInterval(ticker))

const live = computed(
  () => Boolean(props.timer) && now.value - (props.timer.updatedAt ?? 0) < STALE_AFTER,
)

const attemptNumber = computed(() => Number(String(props.attemptLabel).match(/\d+/)?.[0] ?? 1))

const previous = computed(() => {
  if (attemptNumber.value < 2) return null
  return (props.rider?.attempts || []).find(a => a.n === attemptNumber.value - 1) ?? null
})

const previousLabel = computed(() => attemptResultLabel(previous.value))

const elapsed = computed(() => {
  if (!live.value || props.timer.phase !== 'running' || !props.timer.startedAt) return null
  return (now.value - props.timer.startedAt) / 1000
})

// Разницу показываем только на финише и только когда есть с чем сравнивать.
const delta = computed(() => {
  if (!live.value || props.timer.phase !== 'finished') return null

  const seconds = deltaToAttempt(
    parseTimeToSeconds(props.timer.time), props.rider, attemptNumber.value - 1,
  )
  if (seconds === null) return null

  return { seconds, text: formatDelta(seconds, fractionDigits(props.timer.time)) }
})

// Что стоит в блоке: подпись, крупные цифры и притушенный хвост сетки.
const face = computed(() => {
  if (live.value) {
    if (props.timer.phase === 'finished' && props.timer.time) {
      return { label: 'Финиш', value: props.timer.time, tail: '', gold: true }
    }
    if (props.timer.phase === 'running') {
      return { label: 'Заезд', value: formatClock(elapsed.value), tail: '.0000', gold: false }
    }
    return { label: 'Заезд', value: '—:—', tail: '.0000', gold: false, dim: true }
  }

  // Моста нет. Показываем то единственное про время, что знаем наверняка.
  if (previousLabel.value) {
    return {
      label: `${attemptNumber.value - 1}-я попытка`,
      value: previousLabel.value,
      tail: '',
      gold: false,
    }
  }

  return null
})
</script>

<template>
  <div v-if="face" class="time">
    <div class="lab">{{ face.label }}</div>
    <div class="val tabular" :class="{ gold: face.gold, dim: face.dim }">
      {{ face.value }}<span v-if="face.tail" class="tail">{{ face.tail }}</span>
    </div>

    <div v-if="delta" class="prev" :class="{ better: delta.seconds < 0 }">
      {{ delta.text }} <i>к первой</i>
    </div>
    <div v-else-if="live && previousLabel" class="prev">
      {{ attemptNumber - 1 }}-я попытка <b>{{ previousLabel }}</b>
    </div>
  </div>
</template>

<style scoped>
/* Единственный блок сцены без подложки: цифры лежат прямо на картинке.
   Плашка вернула бы в кадр ровно тот вес, ради снятия которого сцену
   и перебирали. */
.time {
  position: absolute;
  left: 881px;
  bottom: 64px;
  width: 348px;
  height: var(--scene-h);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  animation: time-in 420ms cubic-bezier(0.32, 0.72, 0, 1);
  transition: height 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes time-in {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Дымка вместо плашки: на светлом бетоне под солнцем одних теней не
   хватает, белый текст пропадает. Краёв у неё нет, на тёмном асфальте
   она не читается вовсе. */
.time::before {
  content: "";
  position: absolute;
  inset: -30px -40px;
  background: radial-gradient(
    60% 62% at 50% 50%,
    rgba(0, 0, 0, 0.52) 0%,
    rgba(0, 0, 0, 0.32) 45%,
    transparent 78%
  );
  pointer-events: none;
}

.lab {
  position: relative;
  font-size: 15px;
  font-weight: 620;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.85);
}

.val {
  position: relative;
  font-size: 62px;
  font-weight: 640;
  letter-spacing: -0.02em;
  line-height: 1.02;
  margin-top: 7px;
  text-shadow: 0 2px 5px rgba(0, 0, 0, 0.75), 0 10px 34px rgba(0, 0, 0, 0.7);
}

.val.gold { color: var(--accent); }
.val.dim { color: var(--ink-faint); }

/* Хвост сетки знакомест 00:00.0000 стоит серым всегда: без него цифры
   на финише разъехались бы и блок прыгнул. */
.tail { color: rgba(255, 255, 255, 0.26); }

.prev {
  position: relative;
  font-size: 19px;
  font-weight: 600;
  margin-top: 7px;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.85);
}

.prev i { font-style: normal; color: var(--ink-faint); font-weight: 450; }

/* Улучшение — зелёным, ухудшение остаётся серым. Красного нет намеренно:
   графика показывает результат, а не оценивает спортсмена. */
.prev.better { color: var(--class-green); font-weight: 660; }
</style>
