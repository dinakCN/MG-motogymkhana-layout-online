<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSocket } from '../useSocket.js'
import StatusBar from './StatusBar.vue'
import SceneTabs from './SceneTabs.vue'
import ParticipantList from './ParticipantList.vue'
import RunBlock from './RunBlock.vue'
import RoundBlock from './RoundBlock.vue'
import HighlightBlock from './HighlightBlock.vue'
import AwardBlock from './AwardBlock.vue'
import OverrideBlock from './OverrideBlock.vue'
import OverlayPreview from './OverlayPreview.vue'
import './control.css'

const { state, connected, send } = useSocket()

const query = ref('')
const selected = ref(null)
const runBlock = ref(null)

const participants = computed(() => state.value?.participants ?? [])

const HOTKEYS = { 1: 'results', 2: 'run', 3: 'highlight', 4: 'break', 5: 'award', 6: 'idle' }

// Пока курсор в поле ввода, цифры набирают номер; вне поля — переключают
// сцены. Вход в поле — «/», выход — Esc.
function onKey(event) {
  const inField = ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)

  if (event.key === 'Escape') {
    event.target.blur?.()
    hideHighlight()
    return
  }

  if (event.key === '/' && !inField) {
    event.preventDefault()
    runBlock.value?.focusNumber()
    return
  }

  if (inField) return

  if (HOTKEYS[event.key]) send('setActiveScene', HOTKEYS[event.key])
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

function publishRun(payload) {
  send('setCurrentRun', payload)
  send('setActiveScene', 'run')
}

// Хайлайт — вставка поверх эфира, а не пункт назначения: после него кадр
// обязан вернуться туда, откуда пришёл, иначе через 6 секунд в эфире
// останется пустота. Сцену возврата помнит сервер (state.highlight.returnScene),
// поэтому перезагруженный посреди хайлайта пульт вернёт кадр туда же.
function showHighlight(payload) {
  send('showHighlight', payload)
  send('setActiveScene', 'highlight')
}

function hideHighlight() {
  send('hideHighlight')
  if (state.value?.activeScene === 'highlight') {
    send('setActiveScene', state.value?.highlight?.returnScene ?? 'results')
  }
}
</script>

<template>
  <div v-if="state" class="control">
    <StatusBar :state="state" :connected="connected" />
    <SceneTabs :active="state.activeScene" @pick="send('setActiveScene', $event)" />

    <div class="main">
      <div class="left">
        <RunBlock
          ref="runBlock"
          :participants="participants"
          :current-run="state.currentRun"
          :active-scene="state.activeScene"
          :preselected="selected"
          @publish="publishRun"
        />
        <HighlightBlock
          :preselected="selected"
          :timeout="state.highlightTimeout ?? 6000"
          @show="showHighlight"
          @hide="hideHighlight"
        />
        <RoundBlock :round="state.round" @change="send('setRound', $event)" />
        <AwardBlock
          :participants="participants"
          :award="state.award"
          @change="send('setAward', $event)"
        />
        <OverrideBlock :rider="selected" @override="send('manualOverride', $event)" />
      </div>

      <div class="right">
        <OverlayPreview />

        <div class="panel search-panel">
          <h3>Участники · {{ participants.length }}</h3>
          <input v-model="query" class="input" placeholder="поиск: ФИО, номер, класс, город" />
        </div>

        <div class="panel list-panel">
          <ParticipantList
            :participants="participants"
            :query="query"
            :selected-id="selected?.id ?? null"
            @pick="selected = $event"
          />
        </div>
      </div>
    </div>
  </div>

  <div v-else class="control loading">Подключаемся к серверу…</div>
</template>

<style scoped>
.main {
  display: grid;
  grid-template-columns: 404px 1fr;
  gap: 14px;
  padding: 10px 16px 16px;
  overflow: hidden;
}

.left, .right { display: flex; flex-direction: column; gap: 14px; overflow: hidden; }
.left { overflow-y: auto; padding-right: 2px; }
.search-panel { flex: none; }
.list-panel { padding: 0; flex: 1; overflow: hidden; }

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  color: var(--ink-dim);
}

.left::-webkit-scrollbar { width: 8px; }
.left::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: var(--r-pill);
}
</style>
