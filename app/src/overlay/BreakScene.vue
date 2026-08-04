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
  background: linear-gradient(160deg, #0d1117 0%, #161b22 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
}

.logo { height: 140px; margin-bottom: 24px; }
h1 { font-size: 76px; font-weight: 700; }
p { font-size: 32px; color: var(--muted); }
.event { font-size: 24px; margin-top: 40px; }
</style>
