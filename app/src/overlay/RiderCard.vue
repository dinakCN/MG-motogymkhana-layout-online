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
      {{ rider.city }}<span v-if="rider.city && rider.motorcycle" class="dot">·</span>{{ rider.motorcycle }}
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

.head { display: flex; align-items: center; gap: 11px; }

.cls {
  background: var(--accent);
  color: #0a0d12;
  font-weight: 700;
  font-size: 15px;
  line-height: 1;
  padding: 5px 11px;
  border-radius: var(--r-pill);
}

.no { font-size: 15px; font-weight: 600; color: var(--ink-dim); }
.att { font-size: 14px; color: var(--ink-faint); margin-left: auto; }

.fio { font-size: 36px; font-weight: 660; line-height: 1.1; letter-spacing: -0.02em; margin-top: 9px; }

/* Длинные названия мотоциклов есть в данных («Honda CBR Frankenstein RR»),
   но переносить их больше нельзя: перенос ломает фиксированную высоту
   блока, а с ней и равенство трёх блоков сцены. Обрезаем многоточием. */
.sub {
  font-size: 17px;
  color: var(--ink-dim);
  margin-top: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub .dot { color: var(--ink-faint); margin: 0 8px; }

.cap { font-size: 17px; color: var(--accent); margin-top: 5px; }
</style>
