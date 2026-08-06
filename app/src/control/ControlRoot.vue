<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSocket } from '../useSocket.js'
import { competing } from '../shared/riderStatus.js'
import StatusBar from './StatusBar.vue'
import SceneTabs from './SceneTabs.vue'
import ParticipantsPanel from './ParticipantsPanel.vue'
import RunBlock from './RunBlock.vue'
import RoundBlock from './RoundBlock.vue'
import ResultsBlock from './ResultsBlock.vue'
import HighlightBlock from './HighlightBlock.vue'
import AwardBlock from './AwardBlock.vue'
import OverrideBlock from './OverrideBlock.vue'
import OverlayPreview from './OverlayPreview.vue'
import './control.css'

const { state, connected, send } = useSocket()

const selected = ref(null)
const runBlock = ref(null)
const preview = ref(null)

const participants = computed(() => state.value?.participants ?? [])

// Блоки «Таблица» и «Награждение» показывают то, что получится в кадре,
// поэтому неявившихся они не считают — иначе пульт обещал бы одно, а сцена
// показывала другое. Список рядом, наоборот, знает весь состав: отметку
// надо уметь снять, а человек может доехать к третьему классу.
const onAir = computed(() => competing(participants.value, state.value?.riderStatus ?? {}))

// Кто сейчас в кадре: заезд, а пока висит хайлайт — райдер хайлайта.
// Состояние уже знает это, списку остаётся показать точкой.
const onAirId = computed(() => (state.value?.highlight?.visible
  ? state.value.highlight.participantId
  : state.value?.currentRun?.participantId) ?? null)

// Кого кадр держит: назначенного заездом и показанного хайлайтом разом.
// Отметить их сервер не даст — от таблицы до заезда один клик, и участник,
// вынутый из состава между этими мгновениями, дал бы пустой кадр.
const inFrameIds = computed(() => [
  state.value?.currentRun?.participantId,
  state.value?.highlight?.visible ? state.value.highlight.participantId : null,
].filter(Boolean))

// Превью всплывает на смену сцены — той же командой, которой оператор её
// и переключил, откуда бы она ни пришла: кнопкой, клавишей или с другого
// устройства в сети.
watch(() => state.value?.activeScene, (scene, was) => {
  if (scene && was && scene !== was) preview.value?.flash()
})

const HOTKEYS = {
  1: 'results', 2: 'run', 3: 'highlight', 4: 'break', 5: 'award', 6: 'idle', 7: 'clean',
  8: 'track',
}

// Схема трассы без файла показывать нечего. Кнопку в пульте гасим, но
// решает всё равно сервер: он отвергает такую команду, и разойтись
// пульту с кадром негде.
const unavailable = computed(() => (state.value?.trackMapUrl ? [] : ['track']))

// Пока курсор в поле ввода, цифры набирают номер; вне поля — переключают
// сцены. Вход в поле — «/», выход — Esc.
function onKey(event) {
  const inField = ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)

  if (event.key === 'Escape') {
    // Открытую плашку — меню групп или превью кадра — закрывает сам браузер,
    // но событие всё равно всплывает сюда. Без этой проверки оператор,
    // закрывая её, заодно гасил бы хайлайт в эфире.
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

  // Клавиша погашенной вкладки молчит так же, как сама вкладка: сервер
  // такую команду всё равно отвергнет, но оператор не должен видеть разное
  // поведение мыши и клавиатуры.
  const scene = HOTKEYS[event.key]
  if (scene && !unavailable.value.includes(scene)) send('setActiveScene', scene)

  // Клавишу ловим по коду, а не по символу: в русской раскладке та же
  // клавиша даёт «е», и проверка по event.key молча перестала бы работать
  // ровно тогда, когда оператор печатал подпись кириллицей.
  if (event.code === 'KeyT') {
    send('setSceneOption', { option: 'showRunTime', value: !(state.value?.showRunTime ?? true) })
  }

  // Разрез итоговой таблицы: по классам или по группам награждения.
  // Клавиша нужна ближе к концу дня, когда таблицу держат в кадре между
  // заездами, а разговор в эфире уже про медали.
  if (event.code === 'KeyG') {
    send('setSceneOption', { option: 'resultsByGroup', value: !(state.value?.resultsByGroup ?? false) })
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
    <SceneTabs
      :active="state.activeScene"
      :unavailable="unavailable"
      @pick="send('setActiveScene', $event)"
    />

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
        <ResultsBlock
          :by-group="state.resultsByGroup ?? false"
          :participants="onAir"
          :award-groups="state.awardGroups ?? []"
          :rider-groups="state.riderGroups ?? {}"
          @option="send('setSceneOption', $event)"
        />
        <AwardBlock
          :participants="onAir"
          :award="state.award"
          :award-groups="state.awardGroups ?? []"
          :rider-groups="state.riderGroups ?? {}"
          :strict-groups="state.strictGroups ?? false"
          @change="send('setAward', $event)"
        />
        <OverrideBlock :rider="selected" @override="send('manualOverride', $event)" />
      </div>

      <!-- Правая колонка отдана списку целиком. Раньше её делили превью
           кадра и панель поиска, и списку доставалось шесть строк из
           двадцати с лишним участников. -->
      <ParticipantsPanel
        :participants="participants"
        :rider-status="state.riderStatus ?? {}"
        :award-groups="state.awardGroups ?? []"
        :rider-groups="state.riderGroups ?? {}"
        :award-subject="state.award.subject"
        :selected-id="selected?.id ?? null"
        :on-air-id="onAirId"
        :in-frame-ids="inFrameIds"
        :strict-groups="state.strictGroups ?? false"
        @pick="selected = $event"
        @group="send('setRiderGroup', $event)"
        @status="send('setRiderStatus', $event)"
      />
    </div>

    <OverlayPreview ref="preview" />
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

.left { display: flex; flex-direction: column; gap: 14px; overflow-y: auto; padding-right: 2px; }

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
