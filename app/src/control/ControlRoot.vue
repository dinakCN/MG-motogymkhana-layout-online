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
const onlyGroup = ref(false)
const selected = ref(null)
const runBlock = ref(null)

const participants = computed(() => state.value?.participants ?? [])

const HOTKEYS = { 1: 'results', 2: 'run', 3: 'highlight', 4: 'break', 5: 'award', 6: 'idle' }

// Пока курсор в поле ввода, цифры набирают номер; вне поля — переключают
// сцены. Вход в поле — «/», выход — Esc.
function onKey(event) {
  const inField = ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)

  if (event.key === 'Escape') {
    // Открытое меню групп закрывает сам браузер, но событие всё равно
    // всплывает сюда. Без этой проверки оператор, закрывая меню, заодно
    // гасил бы хайлайт в эфире.
    if (document.querySelector('[popover]:popover-open')) return

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

  // Клавишу ловим по коду, а не по символу: в русской раскладке та же
  // клавиша даёт «е», и проверка по event.key молча перестала бы работать
  // ровно тогда, когда оператор печатал подпись кириллицей.
  if (event.code === 'KeyT') {
    send('setSceneOption', { option: 'showRunTime', value: !(state.value?.showRunTime ?? true) })
  }

  // Сход помечают в те же секунды, когда спортсмен встал, — тянуться мышью
  // в этот момент некогда. Пометка снимается той же клавишей.
  if (event.code === 'KeyS' && state.value?.currentRun?.participantId) {
    send('setRunDnf', !(state.value?.currentRun?.dnf ?? false))
  }
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
          :show-run-time="state.showRunTime ?? true"
          :show-class-top="state.showClassTop ?? true"
          @publish="publishRun"
          @option="send('setSceneOption', $event)"
          @dnf="send('setRunDnf', $event)"
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
          :award-groups="state.awardGroups ?? []"
          :rider-groups="state.riderGroups ?? {}"
          :strict-groups="state.strictGroups ?? false"
          @change="send('setAward', $event)"
        />
        <OverrideBlock :rider="selected" @override="send('manualOverride', $event)" />
      </div>

      <div class="right">
        <OverlayPreview />

        <div class="panel search-panel">
          <h3>Участники · {{ participants.length }}</h3>
          <input v-model="query" class="input" placeholder="поиск: ФИО, номер, класс, город" />
          <label class="check">
            <input v-model="onlyGroup" type="checkbox" :disabled="!state.award.subject" />
            только группа награждения
          </label>
        </div>

        <div class="panel list-panel">
          <ParticipantList
            :participants="participants"
            :query="query"
            :selected-id="selected?.id ?? null"
            :award-groups="state.awardGroups ?? []"
            :rider-groups="state.riderGroups ?? {}"
            :group-filter="onlyGroup ? state.award.subject : null"
            :strict-groups="state.strictGroups ?? false"
            @pick="selected = $event"
            @group="send('setRiderGroup', $event)"
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
.check { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-top: 8px; cursor: pointer; color: var(--ink-dim); }

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
