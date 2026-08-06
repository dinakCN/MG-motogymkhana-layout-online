<script setup>
import { computed } from 'vue'
import { useSocket } from '../useSocket.js'
import { competing } from '../shared/riderStatus.js'
import ResultsScene from './ResultsScene.vue'
import RunScene from './RunScene.vue'
import HighlightScene from './HighlightScene.vue'
import BreakScene from './BreakScene.vue'
import AwardScene from './AwardScene.vue'
import IdleScene from './IdleScene.vue'
import CleanScene from './CleanScene.vue'
import TrackScene from './TrackScene.vue'
import '../style.css'

const SCENES = {
  results: ResultsScene,
  run: RunScene,
  highlight: HighlightScene,
  break: BreakScene,
  award: AwardScene,
  idle: IdleScene,
  clean: CleanScene,
  track: TrackScene,
}

const { state } = useSocket()
const scene = computed(() => SCENES[state.value?.activeScene] ?? null)

// Неявившихся вычитаем здесь и один раз на все сцены. Фильтровать в каждой
// сцене отдельно нельзя: итоговая таблица, топ-3 в заезде и подиум считают
// места по одному составу, и разъехавшись, они дали бы разные ответы
// на вопрос «кто выиграл» — в день награждения это худшая из поломок.
const sceneState = computed(() => (state.value
  ? { ...state.value, participants: competing(state.value.participants, state.value.riderStatus) }
  : null))

// Превью в пульте идёт без перехода между сценами. Дело не в красоте:
// Vue снимает классы перехода в следующем кадре анимации, а браузер
// придерживает кадры у неактивного или перекрытого окна — и сцена
// застревает полупрозрачной на секунды. Оператор в это время думает,
// что команда не ушла, и жмёт кнопку второй раз. В эфире перехода это
// не касается: OBS рисует источник всегда.
const preview = document.documentElement.classList.contains('preview')
</script>

<template>
  <component :is="scene" v-if="preview && scene" :state="sceneState" />

  <Transition v-else name="scene" mode="out-in">
    <component :is="scene" v-if="scene" :state="sceneState" />
  </Transition>
</template>
