<script setup>
defineProps({ active: { type: String, required: true } })
const emit = defineEmits(['pick'])

const SCENES = [
  { key: 'results', label: 'Таблица', hot: '1' },
  { key: 'run', label: 'Заезд', hot: '2' },
  { key: 'highlight', label: 'Хайлайт', hot: '3' },
  { key: 'break', label: 'Пауза', hot: '4' },
  { key: 'award', label: 'Награждение', hot: '5' },
  { key: 'idle', label: 'Заставка', hot: '6' },
  { key: 'clean', label: 'Чистый кадр', hot: '7' },
]
</script>

<template>
  <div class="tabs">
    <button
      v-for="scene in SCENES"
      :key="scene.key"
      class="tab"
      :class="{ active: active === scene.key }"
      @click="emit('pick', scene.key)"
    >
      <span class="hot">{{ scene.hot }}</span>
      {{ scene.label }}
    </button>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 8px;
  padding: 14px 16px 6px;
}

.tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 17px 12px;
  font-size: 16px;
  font-weight: 560;
  font-family: inherit;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.08);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--r-pill);
  cursor: pointer;
  transition: transform 180ms cubic-bezier(0.32, 0.72, 0, 1),
    background 180ms ease, box-shadow 180ms ease;
}

.tab:hover { background: rgba(255, 255, 255, 0.14); }
.tab:active { transform: scale(0.98); }
.tab:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

/* Активная сцена должна читаться с другого конца стола: заливка плюс
   свечение, а не только смена цвета текста. */
.tab.active {
  background: var(--accent);
  color: #0a0d12;
  font-weight: 640;
  border-color: transparent;
  box-shadow: 0 6px 24px rgba(255, 159, 10, 0.35);
}

.hot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.14);
  color: var(--ink-dim);
}

.tab.active .hot { background: rgba(0, 0, 0, 0.18); color: rgba(0, 0, 0, 0.6); }
</style>
