<script setup>
import { ref, onUnmounted } from 'vue'

// Сколько держится автопоказ. Двух секунд хватает убедиться, что в кадре
// то, что заказывали; дольше — и плашка начинает мешать работе со списком,
// ради которого её отсюда и убрали.
const FLASH_MS = 2000

const box = ref(null)
let auto = false
let timer = null

function close() {
  auto = false
  box.value?.hidePopover?.()
}

// Автопоказ при смене сцены. Открытое руками превью он не трогает: оператор
// раскрыл его сам, значит смотрит, и гасить это через две секунды — значит
// отнимать у него то, что он только что попросил.
function flash() {
  const el = box.value
  if (!el) return

  if (el.matches(':popover-open')) {
    if (!auto) return
  } else {
    auto = true
    el.showPopover()
  }

  clearTimeout(timer)
  timer = setTimeout(close, FLASH_MS)
}

// Закрыли руками (Esc, клик мимо, повторный клик по чипу) — автопоказ
// больше не наш, таймер снимаем: иначе он погасил бы превью, открытое
// оператором сразу после автопоказа.
function onToggle(event) {
  if (event.newState === 'closed') {
    auto = false
    clearTimeout(timer)
  }
}

onUnmounted(() => clearTimeout(timer))
defineExpose({ flash })
</script>

<template>
  <!-- popover, а не панель: рисуется в top-layer, поэтому не обрезается
       колонками пульта, а закрытие по Esc и по клику мимо достаётся даром.
       Привязан к чипу «кадр» в строке состояния. -->
  <div id="frame-preview" ref="box" popover class="pop" @toggle="onToggle">
    <div class="frame">
      <!-- Тот же собранный оверлей, ужатый до 25 %. Оператор видит эфир,
           не переключаясь в OBS, где руки заняты.

           ?preview=1 отключает в нём анимации: браузер придерживает кадры
           у неактивного окна, и плавные переходы залипали бы на секунды —
           оператор видел бы старую сцену и жал кнопку второй раз. -->
      <iframe src="/overlay?preview=1" title="превью оверлея" scrolling="no"></iframe>
    </div>
  </div>
</template>

<style scoped>
.pop {
  position: absolute;
  /* Под чипом, прижато к его правому краю: имя якоря объявлено в StatusBar. */
  position-anchor: --frame-chip;
  position-area: block-end span-inline-start;
  margin: 8px 0 0;
  padding: 8px;
  border: 1px solid var(--panel-edge);
  border-radius: var(--r-lg);
  /* Плотный фон, а не стекло: backdrop-filter в top-layer заставляет
     Chromium перерисовать всё, что лежит под плашкой, — и вкладки сцен
     с их собственным блюром остаются выцветшими после закрытия превью.
     Оператор читает активную вкладку с другого конца стола, и терять её
     заливку ради размытия под плашкой, за которой всё равно ничего не
     видно, нельзя. */
  background: #14181e;
  box-shadow: var(--panel-shadow);
  overflow: visible;
}

.frame {
  position: relative;
  width: 480px;
  height: 270px;
  overflow: hidden;
  /* Тёмная клетка: видно, где у оверлея прозрачный фон, а где подложка. */
  background:
    repeating-conic-gradient(#1c2128 0 25%, #22272e 0 50%) 0 0 / 24px 24px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--r-md);
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
