<script setup>
import { computed } from 'vue'

const props = defineProps({ state: { type: Object, required: true } })

// Перерыв — плановый элемент вещания, поэтому в кадре всегда написано,
// что будет дальше, а не просто «пауза».
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
  <div class="break">
    <img class="logo" :src="state.logoUrl" alt="" />
    <h1>{{ text.title }}</h1>
    <p v-if="text.sub">{{ text.sub }}</p>
    <p class="event">{{ state.eventTitle }}</p>
  </div>
</template>

<style scoped>
.break {
  width: 100%;
  height: 100%;
  background:
    radial-gradient(90% 60% at 50% 30%, rgba(255, 159, 10, 0.14) 0%, transparent 65%),
    linear-gradient(170deg, #10141a 0%, #0a0d12 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.logo { height: 132px; margin-bottom: 28px; }

h1 {
  font-size: 72px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

p { font-size: 30px; color: var(--ink-dim); }

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
