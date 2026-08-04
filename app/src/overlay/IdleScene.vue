<script setup>
import BaseLayer from './BaseLayer.vue'

defineProps({ state: { type: Object, required: true } })
</script>

<template>
  <!-- Заставка — базовый слой и ничего больше. Никаких заголовков и
       расписания: она рассчитана на то, чтобы висеть в кадре долго
       и не требовать обновления. -->
  <BaseLayer :logo-url="state.logoUrl" logo="large" quiet>
    <p class="event">{{ state.eventTitle }}</p>
  </BaseLayer>
</template>

<style scoped>
.event {
  margin-top: 32px;
  font-size: 19px;
  font-weight: 450;
  letter-spacing: 0.02em;
  color: rgba(235, 235, 245, 0.34);
}
</style>
