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
  background: linear-gradient(160deg, #0d1117 0%, #161b22 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
}

.logo { height: 90px; }
h1 { font-size: 52px; font-weight: 700; }

.podium { display: flex; gap: 48px; align-items: flex-end; }

.slot {
  min-width: 420px;
  padding: 32px;
  background: rgba(240, 246, 252, 0.05);
  border-top: 6px solid var(--muted);
  text-align: center;
  animation: slot-in 350ms ease-out;
}

@keyframes slot-in {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Первое место выше и в акцентном цвете — это подиум, а не три
   одинаковые карточки. Высота задаётся сверху, потому что карточки
   выровнены по нижней кромке. */
.p1 { border-top-color: var(--accent); padding-top: 56px; }
.p2 { padding-top: 34px; }

.place { font-size: 64px; font-weight: 700; color: var(--accent); }
.fio { font-size: 34px; font-weight: 700; margin-top: 12px; }
.city { font-size: 22px; color: var(--muted); }
.moto { font-size: 20px; margin-top: 10px; overflow-wrap: anywhere; }
.time { font-size: 32px; font-weight: 700; margin-top: 16px; }

.empty { font-size: 24px; color: var(--muted); }
</style>
