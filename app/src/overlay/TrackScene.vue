<script setup>
import { ref, watch } from 'vue'
import SheetLayer from './SheetLayer.vue'

// Схема трассы — сканированный лист, который показывают, пока комментатор
// разбирает трассу. Сцена не делает ничего, кроме показа файла: ни зума,
// ни прокрутки, ни разбора по секторам. Разбирает голос, графике достаточно
// не мешать.
const props = defineProps({ state: { type: Object, required: true } })

// Файла может не оказаться: путь с опечаткой, файл унесли, диск отвалился.
// Битая иконка в углу пустого кадра читается как поломка графики вообще,
// поэтому вместо неё — строка словами: по ней понятно, что чинить.
const failed = ref(false)

// Схему заменили или поправили путь — даём файлу второй шанс. Без сброса
// сцена помнила бы старую неудачу до перезагрузки вкладки, а перезагружать
// оверлей в OBS посреди эфира никто не станет.
watch(() => props.state.trackMapUrl, () => { failed.value = false })
</script>

<template>
  <SheetLayer :title="state.eventTitle" :logo-mark-url="state.logoMarkUrl">
    <div class="sheet-body">
      <!-- Плашка под листом: скан приходит с белым фоном, и без подложки
           его край на тёмной сцене читался бы как случайный обрез. Материал
           тот же, что у подложки логотипа в BaseLayer. -->
      <div v-if="!failed" class="plate">
        <img :src="state.trackMapUrl" alt="" @error="failed = true" />
      </div>

      <p v-else class="failed">Схема трассы не загрузилась</p>
    </div>
  </SheetLayer>
</template>

<style scoped>
.sheet-body {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Плашка сжимается по листу, а не растягивается на всю площадь: у A4
   альбомного соотношение 1.41 против 1.78 у кадра, и растянутая подложка
   торчала бы белыми полями по бокам схемы. */
.plate {
  max-width: 100%;
  max-height: 100%;
  padding: 18px;
  background: rgba(255, 255, 255, 0.94);
  border-radius: var(--r-lg);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
  display: flex;
}

/* Вписывается целиком и не обрезается: по краям листа живут легенда,
   стрелки направления и подписи ворот — ровно то, ради чего схему
   и показывают. */
.plate img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}

.failed {
  font-size: 26px;
  font-weight: 450;
  color: var(--ink-faint);
}
</style>
