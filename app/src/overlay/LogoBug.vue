<script setup>
defineProps({ src: { type: String, default: '/assets/logo.png' } })
</script>

<template>
  <img class="logo-bug" :src="src" alt="" />
</template>

<style scoped>
.logo-bug {
  position: absolute;
  top: 32px;
  right: 48px;
  height: 72px;
  animation: bug-in 350ms ease-out;
}

/* Выезжает при появлении сцены и дальше стоит неподвижно —
   вещательный «жучок», а не постоянно движущийся элемент. */
@keyframes bug-in {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0); }
}
</style>
