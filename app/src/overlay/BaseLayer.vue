<script setup>
// Базовый слой всей полноэкранной графики: фон, логотип и место под
// содержимое. Заставка — это он же без содержимого; пауза и награждение
// кладут на него свои элементы. Фон описан здесь один раз, поэтому
// сцены не расходятся между собой.
defineProps({
  logoUrl: { type: String, default: '/assets/logo.png' },
  logo: { type: String, default: 'medium' },
  quiet: { type: Boolean, default: false },

  // Логотипы рисуют под светлый фон — логотип федерации, например,
  // почти чёрный и на тёмной сцене тонет. Светлая подложка снимает
  // зависимость от того, каким придёт файл. Выключается, если логотип
  // окажется светлым.
  plate: { type: Boolean, default: true },
})
</script>

<template>
  <div class="base" :class="{ quiet }">
    <div class="logo-slot" :class="[`logo-${logo}`, { plate }]">
      <img :src="logoUrl" alt="" />
    </div>
    <slot />
  </div>
</template>

<style scoped>
.base {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background:
    radial-gradient(90% 60% at 50% 30%, rgba(255, 159, 10, 0.14) 0%, transparent 65%),
    linear-gradient(170deg, #10141a 0%, #0a0d12 100%);
}

/* Заставка стоит в кадре подолгу: свет приглушён, но не погашен —
   иначе кадр читается как выключенный экран. Медленное дыхание
   отличает живую графику от зависшей картинки. */
.base.quiet {
  background:
    radial-gradient(64% 46% at 50% 44%, rgba(255, 159, 10, 0.16) 0%, transparent 72%),
    linear-gradient(170deg, #131820 0%, #0a0e13 100%);
  animation: breathe 14s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { opacity: 0.94; }
  50% { opacity: 1; }
}

.logo-slot { display: flex; align-items: center; justify-content: center; }
.logo-slot img { max-width: 100%; max-height: 100%; }

/* Подложка держит логотип читаемым независимо от того, тёмный он или
   светлый, и заодно даёт эмблеме тот же скруглённый материал, что и
   у остальной графики. */
.logo-slot.plate {
  background: rgba(255, 255, 255, 0.94);
  border-radius: var(--r-lg);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
}

.logo-large { height: 190px; padding: 26px 34px; }
.logo-medium { height: 132px; padding: 20px 26px; margin-bottom: 28px; }
.logo-small { height: 88px; padding: 14px 18px; }

/* Ореол вокруг подложки: не даёт эмблеме потеряться в центре
   пустого кадра. */
.base.quiet .logo-slot {
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), 0 0 90px rgba(255, 159, 10, 0.22);
}
</style>
