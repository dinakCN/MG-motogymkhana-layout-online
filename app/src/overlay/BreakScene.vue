<script setup>
import { computed } from 'vue'
import BaseLayer from './BaseLayer.vue'
import { roundText } from '../shared/rounds.js'

const props = defineProps({ state: { type: Object, required: true } })

// Что написано на паузе, определяет момент дня: его переключают с пульта.
// Если нужен экран без обещаний — это заставка, отдельная сцена.
const text = computed(() => roundText(props.state.round))
</script>

<template>
  <BaseLayer :logo-url="state.logoUrl" :logo-mark-url="state.logoMarkUrl" logo="medium">
    <h1>{{ text.title }}</h1>
    <p v-if="text.sub" class="sub">{{ text.sub }}</p>
    <p class="event">{{ state.eventTitle }}</p>
  </BaseLayer>
</template>

<style scoped>
h1 {
  font-size: 72px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.sub { font-size: 30px; color: var(--ink-dim); }

.event {
  font-size: 20px;
  color: var(--ink-faint);
  margin-top: 44px;
  padding: 8px 24px;
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
