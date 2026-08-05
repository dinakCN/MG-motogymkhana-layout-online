<script setup>
import { computed } from 'vue'
import RiderCard from './RiderCard.vue'
import RunTime from './RunTime.vue'
import ClassTop from './ClassTop.vue'
import LogoBug from './LogoBug.vue'
import { primaryGroup } from '../shared/awardGroups.js'

// Что показывать в сцене, решают тумблеры пульта (state.showRunTime,
// state.showClassTop): они приезжают вместе с состоянием.
const props = defineProps({ state: { type: Object, required: true } })

const rider = computed(
  () => props.state.participants.find(p => p.id === props.state.currentRun.participantId) || null,
)

// Топ показываем по группе награждения, а не по классу: медаль вручают
// в группе, и соседи по колонке — те же люди, что выйдут на подиум.
// Группы нет (класс не попал ни в одну или человек снят с зачёта) —
// блока в кадре нет: показать вместо группы класс значило бы дать одной
// колонке два разных смысла в течение дня.
const group = computed(
  () => primaryGroup(rider.value, props.state.awardGroups ?? [], props.state.riderGroups ?? {}),
)

// Общая высота трёх блоков — единственное, что они знают друг о друге.
// Подпись райдера занимает третью строку карточки, и тогда подрастает вся
// сцена разом: разъехавшиеся на 38 px края читались бы как сбой вёрстки.
//
// Базовая высота берётся из --band-h, а не пишется числом: тем же ростом
// стоит жучок в правом верхнем углу, и равенство не должно держаться на
// том, что кто-то поправит два числа в разных файлах. Подпись прибавляет
// строку только полосе — жучок остаётся на месте.
const sceneHeight = computed(
  () => (props.state.currentRun.caption ? 'calc(var(--band-h) + 38px)' : 'var(--band-h)'),
)
</script>

<template>
  <div v-if="rider" class="run" :style="{ '--scene-h': sceneHeight }">
    <RiderCard
      :rider="rider"
      :attempt-label="state.currentRun.attemptLabel"
      :caption="state.currentRun.caption"
    />
    <RunTime
      v-if="state.showRunTime ?? true"
      :rider="rider"
      :attempt-label="state.currentRun.attemptLabel"
      :timer="state.timer ?? null"
      :dnf="state.currentRun.dnf ?? false"
    />
    <ClassTop
      v-if="(state.showClassTop ?? true) && group"
      :participants="state.participants"
      :group="group"
      :award-groups="state.awardGroups ?? []"
      :rider-groups="state.riderGroups ?? {}"
      :highlight-id="rider.id"
    />
    <LogoBug :src="state.logoMarkUrl" />
  </div>
</template>

<style scoped>
/* Прозрачный фон: сцена живёт поверх картинки с камеры. Блоки внутри
   позиционируются от краёв кадра, а не потоком, — выключенный тумблером
   сосед не двигает остальных. */
.run { width: 100%; height: 100%; position: relative; }
</style>
