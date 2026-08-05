<script setup>
import { computed } from 'vue'
import RiderCard from './RiderCard.vue'
import RunTime from './RunTime.vue'
import ClassTop from './ClassTop.vue'
import LogoBug from './LogoBug.vue'

// Что показывать в сцене, решают тумблеры пульта (state.showRunTime,
// state.showClassTop): они приезжают вместе с состоянием.
const props = defineProps({ state: { type: Object, required: true } })

const rider = computed(
  () => props.state.participants.find(p => p.id === props.state.currentRun.participantId) || null,
)

// Общая высота трёх блоков — единственное, что они знают друг о друге.
// Подпись райдера занимает третью строку карточки, и тогда подрастает вся
// сцена разом: разъехавшиеся на 38 px края читались бы как сбой вёрстки.
const sceneHeight = computed(() => (props.state.currentRun.caption ? '190px' : '152px'))
</script>

<template>
  <div v-if="rider" class="run" :style="{ '--scene-h': sceneHeight }">
    <RiderCard
      :rider="rider"
      :attempt-label="state.currentRun.attemptLabel"
      :caption="state.currentRun.caption"
    />
    <RunTime
      v-if="state.showRunTime ?? true"
      :rider="rider"
      :attempt-label="state.currentRun.attemptLabel"
      :timer="state.timer ?? null"
      :dnf="state.currentRun.dnf ?? false"
    />
    <ClassTop
      v-if="(state.showClassTop ?? true) && rider.sportClass"
      :participants="state.participants"
      :sport-class="rider.sportClass"
      :highlight-id="rider.id"
    />
    <LogoBug :src="state.logoMarkUrl" />
  </div>
</template>

<style scoped>
/* Прозрачный фон: сцена живёт поверх картинки с камеры. Блоки внутри
   позиционируются от краёв кадра, а не потоком, — выключенный тумблером
   сосед не двигает остальных. */
.run { width: 100%; height: 100%; position: relative; }
</style>
