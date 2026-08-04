<script setup>
import { useSocket } from '../useSocket.js'

const { state, connected } = useSocket()
</script>

<template>
  <div class="stub">
    <p>Пульт собирается.</p>
    <p v-if="state">Участников: {{ state.participants.length }} · связь: {{ connected ? 'есть' : 'нет' }}</p>
  </div>
</template>

<style scoped>
.stub {
  font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  color: #f0f6fc;
  background: #0d1117;
  padding: 40px;
  height: 100vh;
}
</style>
