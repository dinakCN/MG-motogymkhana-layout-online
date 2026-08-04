<script setup>
import { computed } from 'vue'
import RiderCard from './RiderCard.vue'
import ClassTop5 from './ClassTop5.vue'
import LogoBug from './LogoBug.vue'

const props = defineProps({
  state: { type: Object, required: true },
  showTop5: { type: Boolean, default: true },
})

const rider = computed(
  () => props.state.participants.find(p => p.id === props.state.currentRun.participantId) || null,
)
</script>

<template>
  <div v-if="rider" class="run">
    <RiderCard
      :rider="rider"
      :attempt-label="state.currentRun.attemptLabel"
      :caption="state.currentRun.caption"
    />
    <ClassTop5
      v-if="showTop5 && rider.sportClass"
      :participants="state.participants"
      :sport-class="rider.sportClass"
      :highlight-id="rider.id"
    />
    <LogoBug :src="state.logoUrl" />
  </div>
</template>

<style scoped>
/* Прозрачный фон: сцена живёт поверх картинки с камеры. */
.run { width: 100%; height: 100%; position: relative; }
</style>
