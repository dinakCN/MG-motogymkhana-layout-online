<script setup>
import { computed } from 'vue'
import { bestOf } from '../shared/format.js'
import { groupOf, ridersOfGroup } from '../shared/awardGroups.js'

const props = defineProps({
  participants: { type: Array, required: true },
  query: { type: String, default: '' },
  selectedId: { type: String, default: null },
  awardGroups: { type: Array, default: () => [] },
  riderGroups: { type: Object, default: () => ({}) },
  groupFilter: { type: String, default: null },
})
const emit = defineEmits(['pick', 'group'])

// Фильтр по группе идёт раньше поиска: перед награждением нужен состав
// одной группы, отсортированный по времени, а не вся таблица этапа.
const base = computed(() => (props.groupFilter
  ? ridersOfGroup(props.participants, props.groupFilter, props.awardGroups, props.riderGroups)
  : props.participants))

// Поиск идёт и по ФИО: у части участников номера не проставлены,
// и безномерного райдера иначе в эфир не вызвать.
const filtered = computed(() => {
  const q = props.query.trim().toLowerCase()
  if (!q) return base.value

  return base.value.filter(p =>
    p.fio.toLowerCase().includes(q)
    || String(p.number ?? '').includes(q)
    || (p.sportClass || '').toLowerCase().includes(q)
    || (p.city || '').toLowerCase().includes(q),
  )
})

// Первый пункт снимает ручную пометку, то есть возвращает группу по классу.
// Подписывать его текущей группой нельзя: у помеченного участника оба пункта
// назывались бы одинаково, и оператор, выбрав верхний, молча выбил бы
// человека из SB перед его церемонией.
function byClass(rider) {
  return groupOf(rider, props.awardGroups, {})
}
</script>

<template>
  <div class="list">
    <div
      v-for="rider in filtered"
      :key="rider.id"
      class="item"
      :class="{ selected: rider.id === selectedId }"
      @click="emit('pick', rider)"
    >
      <span class="cls">{{ rider.sportClass || '—' }}</span>

      <!-- Нативный select: выпадающее меню и работа с клавиатуры достаются
           даром. Цветом отмечена ручная пометка — её видно до церемонии.
           @click.stop, чтобы выбор группы не считался выделением строки.
           blur() после emit — иначе фокус остаётся в селекте: цифры 1-6
           перестают переключать сцену, «/» не уходит в номер заезда, а
           стрелки вверх-вниз в закрытом select тихо меняют группу участника. -->
      <select
        class="grp"
        :class="{ manual: riderGroups[rider.id] }"
        :value="riderGroups[rider.id] ?? ''"
        @click.stop
        @change="emit('group', { participantId: rider.id, group: $event.target.value || null }); $event.target.blur()"
      >
        <option value="">по классу · {{ byClass(rider) ?? 'вне групп' }}</option>
        <option v-for="g in awardGroups" :key="g.name" :value="g.name">{{ g.name }}</option>
      </select>

      <span class="num tabular">{{ rider.number ?? '—' }}</span>
      <span class="fio">{{ rider.fio }}</span>
      <span class="city">{{ rider.city }}</span>
      <span class="best tabular">{{ bestOf(rider) ?? '—' }}</span>
    </div>

    <p v-if="!filtered.length" class="empty">Никого не нашлось</p>
  </div>
</template>

<style scoped>
.list { overflow-y: auto; height: 100%; padding: 6px; }

.item {
  display: grid;
  grid-template-columns: 42px 96px 38px 1fr 108px 88px;
  gap: 8px;
  align-items: center;
  padding: 9px 10px;
  border-radius: var(--r-md);
  font-size: 14px;
  cursor: pointer;
  transition: background 140ms ease;
}

.item:hover { background: rgba(255, 255, 255, 0.07); }

.item.selected {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px rgba(255, 159, 10, 0.35);
}

.cls {
  justify-self: start;
  font-size: 12px;
  font-weight: 640;
  color: var(--accent);
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: var(--accent-soft);
}

.grp {
  font-size: 11px;
  font-family: inherit;
  color: var(--ink-dim);
  background: rgba(255, 255, 255, 0.06);
  border: 0;
  border-radius: var(--r-pill);
  padding: 3px 6px;
  cursor: pointer;
  max-width: 96px;
}

.grp.manual { color: var(--accent); background: var(--accent-soft); }

.num { color: var(--ink-faint); }
.fio { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.city { color: var(--ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.best { text-align: right; font-weight: 560; }

.empty { padding: 22px; color: var(--ink-faint); font-size: 14px; }

.list::-webkit-scrollbar { width: 10px; }
.list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.14);
  border-radius: var(--r-pill);
  border: 3px solid transparent;
  background-clip: content-box;
}
</style>
