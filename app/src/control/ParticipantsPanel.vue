<script setup>
import { ref, computed, watch } from 'vue'
import { bestOf } from '../shared/format.js'
import { groupsOf, ridersOfGroup } from '../shared/awardGroups.js'
import { DNS, isNoShow, countsOf } from '../shared/riderStatus.js'
import ParticipantList from './ParticipantList.vue'

const props = defineProps({
  participants: { type: Array, required: true },
  riderStatus: { type: Object, default: () => ({}) },
  awardGroups: { type: Array, default: () => [] },
  riderGroups: { type: Object, default: () => ({}) },
  awardSubject: { type: String, default: null },
  selectedId: { type: String, default: null },
  onAirId: { type: String, default: null },
  inFrameIds: { type: Array, default: () => [] },
  strictGroups: { type: Boolean, default: false },
})
const emit = defineEmits(['pick', 'group', 'status'])

const query = ref('')
const filter = ref('all')
const field = ref(null)

const counts = computed(() => countsOf(props.participants, props.riderStatus))

const marked = rider => props.riderStatus[rider.id] === DNS
const away = rider => isNoShow(rider, props.riderStatus)

// Фильтры — не разрезы вида, а задачи, которые оператор закрывает по ходу
// дня. Ноль в счётчике означает, что задача закрыта; чип с нулём гаснет,
// но не исчезает — пропадающие кнопки заставляют искать их заново.
const SETS = {
  all: list => list,
  // Ехавших нет, и неявка не отмечена: либо ещё не стартовал, либо о нём
  // забыли. К концу дня этот чип — список потерянных.
  noresult: list => list.filter(r => bestOf(r) === null && !marked(r)),
  ungrouped: (list, self) => list.filter(r => !groupsOf(r, self.awardGroups, self.riderGroups).length),
  noshow: list => list.filter(r => away(r)),
  // Отмечен, а время пришло. Строка и так жёлтая, но при составе в полсотни
  // человек её ещё надо найти.
  conflict: list => list.filter(r => marked(r) && !away(r)),
  group: (list, self) => (self.awardSubject
    ? ridersOfGroup(list, self.awardSubject, self.awardGroups, self.riderGroups)
    : list),
}

const chips = computed(() => [
  { key: 'all', name: 'все', count: counts.value.declared },
  { key: 'noresult', name: 'без результата', count: SETS.noresult(props.participants).length },
  { key: 'ungrouped', name: 'вне групп', count: SETS.ungrouped(props.participants, props).length },
  { key: 'noshow', name: 'неявки', count: counts.value.noShow },
  ...(counts.value.conflicts
    ? [{ key: 'conflict', name: 'отмечены, но едут', count: counts.value.conflicts, warn: true }]
    : []),
  ...(props.awardSubject
    ? [{ key: 'group', name: props.awardSubject, count: SETS.group(props.participants, props).length }]
    : []),
])

// Выбранной группы может не стать: оператор сменил её в блоке награждения
// или сбросил вовсе. Оставленный фильтр показывал бы весь состав под видом
// группы — молча и без единого признака.
watch(() => props.awardSubject, (subject) => {
  if (!subject && filter.value === 'group') filter.value = 'all'
})

// Противоречия разрешились — фильтр разрешать больше нечего.
watch(() => counts.value.conflicts, (n) => {
  if (!n && filter.value === 'conflict') filter.value = 'all'
})

// Поиск идёт и по ФИО: у части участников номера не проставлены,
// и безномерного райдера иначе в эфир не вызвать.
const shown = computed(() => {
  const list = (SETS[filter.value] ?? SETS.all)(props.participants, props)

  const q = query.value.trim().toLowerCase()
  if (!q) return list

  return list.filter(p =>
    p.fio.toLowerCase().includes(q)
    || String(p.number ?? '').includes(q)
    || (p.sportClass || '').toLowerCase().includes(q)
    || (p.city || '').toLowerCase().includes(q),
  )
})

defineExpose({ focusSearch: () => field.value?.focus() })
</script>

<template>
  <div class="panel">
    <div class="top">
      <h3>
        Участники
        <span class="counts">
          {{ counts.declared }} заявлено
          <template v-if="counts.noShow"> · {{ counts.competing }} едут · {{ counts.noShow }} не приехало</template>
        </span>
      </h3>

      <input
        ref="field"
        v-model="query"
        class="input search"
        placeholder="поиск: ФИО, номер, класс, город"
      />
    </div>

    <div class="filters">
      <button
        v-for="chip in chips"
        :key="chip.key"
        class="fchip"
        :class="{ on: filter === chip.key, warn: chip.warn, empty: !chip.count }"
        @click="filter = chip.key"
      >{{ chip.name }}<i>{{ chip.count }}</i></button>
    </div>

    <!-- Состав группы награждения приходит отсортированным по времени —
         в том самом порядке, в котором пойдёт церемония. Классы его бы
         перемешали, поэтому здесь список плоский. -->
    <ParticipantList
      :participants="shown"
      :grouped="filter !== 'group'"
      :rider-status="riderStatus"
      :award-groups="awardGroups"
      :rider-groups="riderGroups"
      :selected-id="selectedId"
      :on-air-id="onAirId"
      :in-frame-ids="inFrameIds"
      :strict-groups="strictGroups"
      @pick="emit('pick', $event)"
      @group="emit('group', $event)"
      @status="emit('status', $event)"
    />
  </div>
</template>

<style scoped>
/* Панель отдана списку целиком: своих полей у неё нет, поля держат шапка
   и сам список — иначе прокрутка обрывалась бы, не доезжая до края. */
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.top {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px 0;
}

.top h3 { margin: 0; flex: none; }
.counts { display: block; margin-top: 3px; font-size: 11px; letter-spacing: 0; text-transform: none; color: var(--ink-dim); }
.search { flex: 1; padding: 8px 12px; font-size: 14px; }

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 16px 12px;
}

.fchip {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 5px 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.06);
  color: var(--ink-dim);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}

.fchip:hover { background: rgba(255, 255, 255, 0.14); }
.fchip i { font-style: normal; font-size: 11px; font-variant-numeric: tabular-nums; opacity: 0.65; }

.fchip.on {
  background: var(--accent);
  border-color: transparent;
  color: #0a0d12;
  font-weight: 620;
}

/* Пустой фильтр гасим, но оставляем на месте: исчезающие кнопки заставляют
   искать их заново ровно тогда, когда счётчик снова станет ненулевым. */
.fchip.empty { opacity: 0.4; }

.fchip.warn {
  border-color: rgba(255, 214, 10, 0.45);
  background: rgba(255, 214, 10, 0.14);
  color: var(--warn);
  opacity: 1;
}

.fchip.warn.on { background: var(--warn); color: #0a0d12; }
</style>
