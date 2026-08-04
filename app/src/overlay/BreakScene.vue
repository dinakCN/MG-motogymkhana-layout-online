<script setup>
import { computed } from 'vue'
import BaseLayer from './BaseLayer.vue'

const props = defineProps({ state: { type: Object, required: true } })

// Перерыв — плановый элемент вещания, поэтому в кадре всегда написано,
// что будет дальше, а не просто «пауза». Если нужен экран без обещаний —
// это заставка, отдельная сцена.
const TEXTS = {
  round1: { title: 'Идут заезды', sub: 'Первая серия · 12:15–14:00' },
  break1: { title: 'Перерыв', sub: 'Вторая серия заездов в 14:30' },
  round2: { title: 'Идут заезды', sub: 'Вторая серия · 14:30–16:30' },
  final: { title: 'Подведение итогов', sub: 'Награждение в 17:00' },
  break2: { title: 'Готовимся к награждению', sub: 'Начало в 17:00' },
  awards: { title: 'Награждение', sub: '' },
}

const text = computed(() => TEXTS[props.state.round] || TEXTS.break1)
</script>

<template>
  <BaseLayer :logo-url="state.logoUrl" logo="medium">
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
