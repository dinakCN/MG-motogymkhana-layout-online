<script setup>
import { computed } from 'vue'
import { useSocket } from '../useSocket.js'
import ResultsScene from './ResultsScene.vue'
import RunScene from './RunScene.vue'
import HighlightScene from './HighlightScene.vue'
import BreakScene from './BreakScene.vue'
import AwardScene from './AwardScene.vue'
import '../style.css'

const { state } = useSocket()
const scene = computed(() => state.value?.activeScene ?? null)
</script>

<template>
  <Transition name="scene" mode="out-in">
    <ResultsScene v-if="scene === 'results'" :state="state" />
    <RunScene v-else-if="scene === 'run'" :state="state" />
    <HighlightScene v-else-if="scene === 'highlight'" :state="state" />
    <BreakScene v-else-if="scene === 'break'" :state="state" />
    <AwardScene v-else-if="scene === 'award'" :state="state" />
  </Transition>
</template>
