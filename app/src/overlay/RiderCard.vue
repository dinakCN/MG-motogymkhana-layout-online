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
  padding: 28px 36px;
  background: rgba(13, 17, 23, 0.92);
  border-left: 6px solid var(--accent);
  animation: card-in 350ms ease-out;
}

@keyframes card-in {
  from { opacity: 0; transform: translateX(-32px); }
  to   { opacity: 1; transform: translateX(0); }
}

.head { display: flex; align-items: center; gap: 16px; margin-bottom: 10px; }

.cls {
  background: var(--accent);
  color: #0d1117;
  font-weight: 700;
  font-size: 22px;
  padding: 3px 14px;
}

.num { font-size: 22px; color: var(--muted); }
.attempt { font-size: 20px; color: var(--muted); margin-left: auto; }

/* Длинные названия мотоциклов есть в данных («Honda CBR Frankenstein RR»),
   поэтому переносим, а не обрезаем жёсткой шириной. */
.fio { font-size: 46px; font-weight: 700; line-height: 1.1; }
.city { font-size: 26px; color: var(--muted); margin-top: 4px; }
.moto { font-size: 24px; margin-top: 10px; overflow-wrap: anywhere; }
.caption { font-size: 22px; color: var(--accent); margin-top: 12px; }
</style>
