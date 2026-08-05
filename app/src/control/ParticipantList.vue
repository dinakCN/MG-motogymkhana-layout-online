<script setup>
import { computed } from 'vue'
import { bestOf } from '../shared/format.js'
import { groupsOf, ridersOfGroup } from '../shared/awardGroups.js'

const props = defineProps({
  participants: { type: Array, required: true },
  query: { type: String, default: '' },
  selectedId: { type: String, default: null },
  awardGroups: { type: Array, default: () => [] },
  riderGroups: { type: Object, default: () => ({}) },
  groupFilter: { type: String, default: null },
  strictGroups: { type: Boolean, default: false },
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

const groupsFor = rider => groupsOf(rider, props.awardGroups, props.riderGroups)

// Пункт меню подписывается «класс», если группу даёт класс участника.
// Без подписи оператор не отличит унаследованную отметку от поставленной
// руками и, сняв её, молча выбьет человека из зачёта, который тот и так
// проходит.
const byClass = rider => groupsOf(rider, props.awardGroups, {})

const isManual = rider => Array.isArray(props.riderGroups[rider.id])

function toggle(rider, name) {
  const current = groupsFor(rider)
  const has = current.includes(name)

  // Жёсткое разделение переносит участника, мягкое добавляет зачёт: одна
  // галочка не должна отнимать группу по классу, иначе человек тихо
  // выпадет из церемонии, к которой уже готов. Повторный клик снимает
  // отметку в обоих режимах — без этого «вне зачёта» было бы недостижимо
  // в жёстком, хотя сервер такую пометку принимает.
  const next = props.strictGroups
    ? (has ? [] : [name])
    : (has ? current.filter(n => n !== name) : [...current, name])

  emit('group', { participantId: rider.id, groups: next })
}

// Не то же самое, что снять все отметки: сброс возвращает участника
// к группе по классу, пустой список означает «вне зачёта».
const reset = rider => emit('group', { participantId: rider.id, groups: null })

// Меню закрыли — снимаем фокус с кнопки: иначе Enter и пробел снова
// откроют его, а не уйдут туда, куда метил оператор.
function onMenuToggle(event) {
  if (event.newState === 'closed') document.activeElement?.blur?.()
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

      <!-- Групп у участника может быть несколько, поэтому вместо select —
           бейджи и меню с галочками. Меню нативное (popover), а не
           абсолютный блок: список скроллится с overflow-y, и меню внутри
           него обрезалось бы по краю панели. Popover рисуется в top-layer,
           а закрытие по Esc и по клику мимо достаётся даром.
           @click.stop, чтобы работа с группами не считалась выделением
           строки: клик по строке означает ровно одно — выбрать райдера. -->
      <div class="grp" @click.stop>
        <!-- Якорь именуется по участнику: popover живёт в top-layer и без
             привязки всплыл бы в середине экрана, далеко от строки,
             по которой щёлкнули. -->
        <button
          class="chips"
          :class="{ manual: isManual(rider) }"
          :style="{ anchorName: `--grp-${rider.id}` }"
          :popovertarget="`grp-${rider.id}`"
        >
          <span v-for="name in groupsFor(rider).slice(0, 2)" :key="name" class="chip">{{ name }}</span>
          <span v-if="groupsFor(rider).length > 2" class="chip">+{{ groupsFor(rider).length - 2 }}</span>
          <span v-if="!groupsFor(rider).length" class="chip none">вне групп</span>
          <span class="caret">▾</span>
        </button>

        <div
          :id="`grp-${rider.id}`"
          popover
          class="menu"
          :style="{ positionAnchor: `--grp-${rider.id}` }"
          @toggle="onMenuToggle"
        >
          <p v-if="strictGroups" class="mode">только одна группа</p>
          <button
            v-for="g in awardGroups"
            :key="g.name"
            class="opt"
            :class="{ on: groupsFor(rider).includes(g.name) }"
            @click="toggle(rider, g.name)"
          >
            <span class="mark">{{ groupsFor(rider).includes(g.name) ? '✓' : '' }}</span>
            <span class="name">{{ g.name }}</span>
            <span v-if="byClass(rider).includes(g.name)" class="hint">класс</span>
          </button>
          <button class="reset" @click="reset(rider)">сбросить к классу</button>
        </div>
      </div>

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
  grid-template-columns: 42px 176px 38px 1fr 108px 88px;
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

.grp { min-width: 0; }

.chips {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 3px 6px;
  border: 0;
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.06);
  color: var(--ink-dim);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  overflow: hidden;
}

.chips.manual { color: var(--accent); background: var(--accent-soft); }
.chip { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chip.none { color: var(--ink-faint); }
.caret { margin-left: auto; opacity: 0.6; }

.menu {
  position: absolute;
  /* Под кнопкой, выровнено по её левому краю. Внизу списка меню туда
     не помещается — уходит вверх, а не за край экрана. */
  position-area: block-end span-inline-end;
  position-try-fallbacks: block-start span-inline-end;
  margin: 4px 0;
  min-width: 200px;
  padding: 6px;
  border: 0;
  border-radius: var(--r-md);
  background: #1c1c1e;
  color: var(--ink);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
}

.mode { margin: 2px 8px 6px; font-size: 11px; color: var(--ink-faint); }

.opt {
  display: grid;
  grid-template-columns: 14px 1fr auto;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--r-md);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.opt:hover { background: rgba(255, 255, 255, 0.08); }
.opt.on .name { color: var(--accent); }
.mark { color: var(--accent); }
.hint { font-size: 11px; color: var(--ink-faint); }

.reset {
  width: 100%;
  margin-top: 4px;
  padding: 7px 8px 3px;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  color: var(--ink-faint);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.reset:hover { color: var(--ink); }

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
