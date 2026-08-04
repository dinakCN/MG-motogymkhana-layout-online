<script setup>
import { computed } from 'vue'
import { topOfClass, bestOf } from '../shared/format.js'

const props = defineProps({ state: { type: Object, required: true } })

const podium = computed(() => {
  const cls = props.state.award.sportClass
  if (!cls) return []

  const top3 = topOfClass(props.state.participants, cls, 3)

  if (!props.state.award.showAllThree) {
    return top3.filter(p => p.placeInClass === props.state.award.place)
  }

  // Второе слева, первое в центре, третье справа — узнаваемая форма
  // подиума. Порядок 1-2-3 читался бы как обычный список.
  return [2, 1, 3]
    .map(place => top3.find(p => p.placeInClass === place))
    .filter(Boolean)
})
</script>

<template>
  <div class="award">
    <img class="logo" :src="state.logoUrl" alt="" />
    <h1>Класс {{ state.award.sportClass || '—' }}</h1>

    <div class="podium">
      <div
        v-for="rider in podium"
        :key="rider.id"
        class="slot"
        :class="`p${rider.placeInClass}`"
      >
        <div class="place">{{ rider.placeInClass }}</div>
        <div class="fio">{{ rider.fio }}</div>
        <div class="city">{{ rider.city }}</div>
        <div class="moto">{{ rider.motorcycle }}</div>
        <div class="time tabular">{{ bestOf(rider) ?? '—' }}</div>
      </div>
    </div>

    <p v-if="!podium.length" class="empty">Призёры появятся, когда будут результаты</p>
  </div>
</template>

<style scoped>
.award {
  width: 100%;
  height: 100%;
  background:
    radial-gradient(100% 70% at 50% 100%, rgba(255, 159, 10, 0.16) 0%, transparent 65%),
    linear-gradient(170deg, #10141a 0%, #0a0d12 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 36px;
}

.logo { height: 88px; }
h1 { font-size: 46px; font-weight: 700; letter-spacing: -0.02em; }

.podium { display: flex; gap: 36px; align-items: flex-end; }

.slot {
  min-width: 400px;
  padding: 34px 32px;
  border-radius: var(--r-xl);
  background: var(--glass-base);
  background-image: var(--glass);
  border: 1px solid var(--glass-edge);
  box-shadow: var(--glass-shadow), var(--glass-inner);
  text-align: center;
  animation: slot-in 460ms cubic-bezier(0.32, 0.72, 0, 1) backwards;
}

@keyframes slot-in {
  from { opacity: 0; transform: translateY(26px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* Первое место выше и подсвечено — это подиум, а не три одинаковые
   карточки. Высота задаётся сверху: карточки выровнены по нижней кромке.
   Появляются по очереди снизу вверх, как на настоящей церемонии. */
.p1 {
  padding-top: 58px;
  border-color: rgba(255, 159, 10, 0.45);
  box-shadow: var(--glass-shadow), var(--glass-inner), 0 0 60px rgba(255, 159, 10, 0.18);
  animation-delay: 240ms;
}

.p2 { padding-top: 36px; animation-delay: 120ms; }
.p3 { animation-delay: 0ms; }

.place {
  font-size: 60px;
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
  letter-spacing: -0.03em;
}

.fio { font-size: 32px; font-weight: 700; margin-top: 16px; letter-spacing: -0.01em; }
.city { font-size: 21px; color: var(--ink-dim); margin-top: 2px; }
.moto { font-size: 19px; color: var(--ink-faint); margin-top: 12px; overflow-wrap: anywhere; }

.time {
  display: inline-block;
  font-size: 30px;
  font-weight: 700;
  margin-top: 18px;
  padding: 6px 20px;
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.08);
}

.empty { font-size: 23px; color: var(--ink-dim); }
</style>
