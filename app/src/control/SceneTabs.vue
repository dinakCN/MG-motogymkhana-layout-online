<script setup>
defineProps({ active: { type: String, required: true } })
const emit = defineEmits(['pick'])

const SCENES = [
  { key: 'results', label: 'Таблица', hot: '1' },
  { key: 'run', label: 'Заезд', hot: '2' },
  { key: 'highlight', label: 'Хайлайт', hot: '3' },
  { key: 'break', label: 'Пауза', hot: '4' },
  { key: 'award', label: 'Награждение', hot: '5' },
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
.tabs { display: flex; gap: 8px; padding: 12px 18px; background: #0d1117; }

.tab {
  flex: 1;
  padding: 18px 12px;
  font-size: 17px;
  font-weight: 600;
  font-family: inherit;
  background: #21262d;
  color: #f0f6fc;
  border: 2px solid transparent;
  cursor: pointer;
}

.tab:hover { background: #30363d; }

/* Активная сцена должна читаться с другого конца стола. */
.tab.active { background: #f5a524; color: #0d1117; border-color: #f5a524; }

.hot { display: inline-block; margin-right: 8px; opacity: 0.5; font-size: 13px; }
</style>
