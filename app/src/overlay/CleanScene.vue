<script setup>
import LogoBug from './LogoBug.vue'

// Заглушка, которая не закрывает картинку: камера работает, мы держим
// только айдентику. От заставки отличается именно этим — та гасит кадр
// целиком тёмным фоном и нужна, когда камеру показывать нельзя.
//
// Момента дня, времени и расписания здесь нет намеренно: сцена висит
// подолгу, а одна строка с названием события разойтись с реальностью
// не может. Всё, что обещает зрителю продолжение, живёт на «Паузе».
defineProps({ state: { type: Object, required: true } })
</script>

<template>
  <div class="clean">
    <div class="title surface">{{ state.eventTitle }}</div>
    <LogoBug :src="state.logoMarkUrl" />
  </div>
</template>

<style scoped>
/* Фона у сцены нет: прозрачность и есть её смысл. Низ кадра свободен
   целиком — если микшер ставит свои титры, они не столкнутся с нашими. */
.clean { width: 100%; height: 100%; position: relative; }

/* Середины плашки и жучка стоят на одной линии: у жучка высота 74 при
   top 32, у плашки 60 — отсюда top 39. Поля 48 симметричны с обеих сторон. */
.title {
  position: absolute;
  left: 48px;
  top: 39px;
  padding: 13px 22px;
  border-radius: var(--r-md);
  font-size: 26px;
  font-weight: 560;
  letter-spacing: -0.01em;
  animation: title-in 350ms ease-out;
}

@keyframes title-in {
  from { opacity: 0; transform: translateX(-40px); }
  to   { opacity: 1; transform: translateX(0); }
}
</style>
