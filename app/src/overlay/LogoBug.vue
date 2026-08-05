<script setup>
// В угол идёт знак без надписи (state.logoMarkUrl): на высоте жучка вордмарк
// превращается в кашу, а знак узнаётся. Если знак в конфиге не задан, сервер
// подставит сюда обычный логотип — мелко, но лучше пустого угла.
defineProps({ src: { type: String, default: '/assets/logo-mark.png' } })
</script>

<template>
  <div class="logo-bug surface">
    <img :src="src" alt="" />
  </div>
</template>

<style scoped>
/* Жучок висит поверх картинки с камеры: фон под ним заранее неизвестен и
   меняется в течение заезда. Без подложки тёмные части знака пропадали бы
   на асфальте в тени, светлые — на небе. Материал тот же, что у карточки
   райдера и топа класса, поэтому угол читается как часть той же графики. */
.logo-bug {
  position: absolute;
  top: 32px;
  right: 48px;
  padding: 14px;
  border-radius: var(--r-md);
  display: flex;
  animation: bug-in 350ms ease-out;
}

.logo-bug img { height: 80px; width: auto; display: block; }

/* Выезжает при появлении сцены и дальше стоит неподвижно —
   вещательный «жучок», а не постоянно движущийся элемент. */
@keyframes bug-in {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0); }
}
</style>
