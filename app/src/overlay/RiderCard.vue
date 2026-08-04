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
      <span class="num tabular">{{ rider.number ?? '—' }}</span>
      <span v-if="attemptLabel" class="attempt">{{ attemptLabel }}</span>
    </div>

    <h2 class="fio">{{ rider.fio }}</h2>
    <p class="city">{{ rider.city }}</p>
    <p class="moto">{{ rider.motorcycle }}</p>
    <p v-if="caption" class="caption">{{ caption }}</p>
  </div>
</template>

<style scoped>
.card {
  position: absolute;
  left: 96px;
  bottom: 120px;
  min-width: 620px;
  max-width: 900px;
  padding: 30px 38px;
  border-radius: var(--r-xl);
  background: var(--glass-base);
  background-image: var(--glass);
  border: 1px solid var(--glass-edge);
  box-shadow: var(--glass-shadow), var(--glass-inner);
  animation: card-in 420ms cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.head { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }

.cls {
  background: var(--accent);
  color: #0a0d12;
  font-weight: 700;
  font-size: 20px;
  padding: 4px 16px;
  border-radius: var(--r-pill);
}

.num {
  font-size: 20px;
  font-weight: 600;
  color: var(--ink);
  padding: 4px 14px;
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.attempt {
  font-size: 18px;
  font-weight: 500;
  color: var(--ink-dim);
  margin-left: auto;
}

/* Длинные названия мотоциклов есть в данных («Honda CBR Frankenstein RR»),
   поэтому переносим, а не обрезаем жёсткой шириной. */
.fio { font-size: 48px; font-weight: 700; line-height: 1.06; letter-spacing: -0.02em; }
.city { font-size: 25px; color: var(--ink-dim); margin-top: 6px; }
.moto { font-size: 23px; color: var(--ink-dim); margin-top: 12px; overflow-wrap: anywhere; }

.caption {
  display: inline-block;
  font-size: 20px;
  font-weight: 500;
  color: var(--accent);
  margin-top: 16px;
  padding: 6px 16px;
  border-radius: var(--r-pill);
  background: var(--accent-soft);
}
</style>
