<template>
  <div class="panel preview-panel">
    <h3>Что в кадре</h3>
    <div class="frame">
      <!-- Тот же собранный оверлей, ужатый до 25 %. Оператор видит эфир,
           не переключаясь в OBS, где руки заняты. -->
      <iframe src="/overlay" title="превью оверлея" scrolling="no"></iframe>
    </div>
  </div>
</template>

<style scoped>
.preview-panel { flex: none; }

.frame {
  position: relative;
  width: 480px;
  height: 270px;
  overflow: hidden;
  /* Тёмная клетка: видно, где у оверлея прозрачный фон, а где подложка. */
  background:
    repeating-conic-gradient(#1c2128 0 25%, #22272e 0 50%) 0 0 / 24px 24px;
  border: 1px solid rgba(240, 246, 252, 0.15);
}

iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 1920px;
  height: 1080px;
  border: 0;
  transform: scale(0.25);
  transform-origin: top left;
}
</style>
