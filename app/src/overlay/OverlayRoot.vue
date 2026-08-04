<script setup>
import { computed } from 'vue'
import { useSocket } from '../useSocket.js'
import ResultsScene from './ResultsScene.vue'
import '../style.css'

const { state } = useSocket()
const scene = computed(() => state.value?.activeScene ?? null)
</script>

<template>
  <Transition name="scene" mode="out-in">
    <ResultsScene v-if="scene === 'results'" :state="state" />
  </Transition>
</template>
