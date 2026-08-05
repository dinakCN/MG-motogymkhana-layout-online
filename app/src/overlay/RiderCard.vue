<script setup>
defineProps({
  rider: { type: Object, required: true },
  attemptLabel: { type: String, default: '' },
  caption: { type: String, default: '' },
})
</script>

<template>
  <div class="card">
    <div class="head">
      <span class="cls">{{ rider.sportClass || '—' }}</span>
      <span class="no tabular">№ {{ rider.number ?? '—' }}</span>
      <span v-if="attemptLabel" class="att">{{ attemptLabel }}</span>
    </div>

    <h2 class="fio">{{ rider.fio }}</h2>
    <p class="sub">
      {{ rider.city }}<span v-if="rider.city && rider.motorcycle" class="dot">·</span><span class="moto">{{ rider.motorcycle }}</span>
    </p>
    <p v-if="caption" class="cap">{{ caption }}</p>
  </div>
</template>

<style scoped>
.card {
  position: absolute;
  left: 72px;
  bottom: 64px;
  width: 620px;
  height: var(--scene-h);
  padding: 0 26px;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--glass-base);
  background-image: var(--glass);
  border: 1px solid var(--glass-edge);
  box-shadow: var(--glass-shadow), var(--glass-inner);
  animation: card-in 420ms cubic-bezier(0.32, 0.72, 0, 1);
  transition: height 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* Три кегля на карточку: 36 — имя, 17 — откуда и на чём, 14 — служебная
   шапка. Ступени 2,1× и 1,2×: соседние размеры обязаны отличаться настолько,
   чтобы разница читалась как ранг, а не как случайность набора. */
.head { display: flex; align-items: center; gap: 10px; }

.cls {
  background: var(--accent);
  color: #0a0d12;
  font-weight: 700;
  font-size: 14px;
  line-height: 1;
  padding: 5px 10px;
  border-radius: var(--r-pill);
}

.no { font-size: 14px; font-weight: 600; color: var(--ink-dim); }

/* Номер попытки — не украшение: он объясняет, почему в зоне времени стоит
   сравнение с первой попыткой. На ink-faint он пропадал первым, поэтому
   стоит наравне с городом. */
.att { font-size: 14px; color: var(--ink-dim); margin-left: auto; }

/* Имя не переносим: высота блока задана жёстко, и вторая строка вылезла бы
   за край стекла. Самое длинное в боевом составе — «Тетерятникова
   Анастасия», оно помещается с запасом; многоточие — страховка на случай
   имени, которого в протоколе пока не встречалось. */
.fio {
  font-size: 36px;
  font-weight: 660;
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin-top: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Длинные названия мотоциклов есть в данных («Honda CBR Frankenstein RR»),
   но переносить их больше нельзя: перенос ломает фиксированную высоту
   блока, а с ней и равенство трёх блоков сцены. Обрезаем многоточием. */
.sub {
  font-size: 17px;
  color: var(--ink-dim);
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Регистр мотоциклов в протоколе пляшет: «KAWASAKI Z400», «Honda CBR
   Frankenstein RR», «Honda Cb 900f hornet». Капс убирает разнобой, не трогая
   данные, и строка начинает читаться как техническая метка, а не как имя
   собственное. Кегль на два меньше городского — оптическая компенсация:
   капс кажется крупнее строчных при одном размере. */
.moto { font-size: 15px; letter-spacing: 0.04em; text-transform: uppercase; }

.sub .dot { color: var(--ink-faint); margin: 0 9px; }

.cap { font-size: 17px; color: var(--accent); margin-top: 6px; }
</style>
