<script setup>
import { computed } from 'vue'
import { bestOf, groupByClass } from '../shared/format.js'
import { groupsOf, primaryGroup, nextGroups } from '../shared/awardGroups.js'
import { DNS, isNoShow } from '../shared/riderStatus.js'

const props = defineProps({
  participants: { type: Array, required: true },
  riderStatus: { type: Object, default: () => ({}) },
  awardGroups: { type: Array, default: () => [] },
  riderGroups: { type: Object, default: () => ({}) },
  selectedId: { type: String, default: null },
  onAirId: { type: String, default: null },

  // Кого держит кадр: текущий заезд и висящий хайлайт. Отметить их сервер
  // не даст — кнопка гасится здесь, чтобы отказ не выглядел как поломка.
  inFrameIds: { type: Array, default: () => [] },
  strictGroups: { type: Boolean, default: false },

  // Порядок, в котором приехал список, иногда важнее классов: состав группы
  // награждения отсортирован по времени, и разложить его по классам значит
  // разрушить ровно тот порядок, ради которого его и открыли.
  grouped: { type: Boolean, default: true },
})
const emit = defineEmits(['pick', 'group', 'status'])

const noShowIn = riders => riders.filter(rider => isNoShow(rider, props.riderStatus)).length

// Секции по классам, а не по группам награждения: список читают вместе
// со стартовым протоколом, а он идёт по классам. Порядок внутри класса —
// протокольный, groupByClass его сохраняет.
const sections = computed(() => (props.grouped
  ? groupByClass(props.participants).map(section => ({ ...section, noShow: noShowIn(section.riders) }))
  : [{ sportClass: null, riders: props.participants, noShow: noShowIn(props.participants) }]))

const groupsFor = rider => groupsOf(rider, props.awardGroups, props.riderGroups)

// Бейдж показывает одну группу — ту же, что уедет в кадр рядом с карточкой
// заезда (порядок конфига, а не кликов). Остальные видно точкой и в меню:
// на 92 px второе имя всё равно не читалось бы.
const badgeOf = rider => primaryGroup(rider, props.awardGroups, props.riderGroups)

// Пункт меню подписывается «класс», если группу даёт класс участника.
// Без подписи оператор не отличит унаследованную отметку от поставленной
// руками и, сняв её, молча выбьет человека из зачёта, который тот и так
// проходит.
const byClass = rider => groupsOf(rider, props.awardGroups, {})

const isManual = rider => Array.isArray(props.riderGroups[rider.id])

const marked = rider => props.riderStatus[rider.id] === DNS
const away = rider => isNoShow(rider, props.riderStatus)

// Кадр держит участника: отметить его сервер не даст, пока в эфир не уйдёт
// другой. Пока результата нет — а в первую попытку его и не бывает, — отметка
// вынула бы его из состава сцен, и карточка погасла бы прямо во время заезда.
const held = rider => props.inFrameIds.includes(rider.id)

// Отметка стоит, а время пришло: человек всё-таки проехал. Строку показываем
// жёлтым, но из кадра его не убираем — протокол сильнее утренней отметки.
const conflict = rider => marked(rider) && !away(rider)

// Что означает клик — решает nextGroups в shared: это единственный
// производитель payload для setRiderGroup, и проверять его нужно тестами,
// а не глазами в эфире.
function toggle(rider, name) {
  emit('group', {
    participantId: rider.id,
    groups: nextGroups(groupsFor(rider), name, props.strictGroups),
  })
}

// Не то же самое, что снять все отметки: сброс возвращает участника
// к группе по классу, пустой список означает «вне зачёта».
const reset = rider => emit('group', { participantId: rider.id, groups: null })

// Явку переключают одним кликом и без подтверждения: отметок единицы,
// ставят их утром по бумажному списку, и тем же кликом отменяют.
const toggleStatus = rider => emit('status', {
  participantId: rider.id,
  status: marked(rider) ? null : DNS,
})

// Меню закрыли — снимаем фокус с кнопки: иначе Enter и пробел снова
// откроют его, а не уйдут туда, куда метил оператор.
function onMenuToggle(event) {
  if (event.newState === 'closed') document.activeElement?.blur?.()
}
</script>

<template>
  <div class="list">
    <div class="head">
      <span></span>
      <span>кл</span>
      <span>№</span>
      <span>участник</span>
      <span>город</span>
      <span>группа</span>
      <span class="right">лучшее</span>
      <span></span>
    </div>

    <section v-for="section in sections" :key="section.sportClass ?? 'все'">
      <h4 v-if="section.sportClass" class="sec">
        {{ section.sportClass }}
        <i>{{ section.riders.length }}</i>
        <b v-if="section.noShow">не приехало {{ section.noShow }}</b>
      </h4>

      <div
        v-for="rider in section.riders"
        :key="rider.id"
        class="item"
        :class="{ selected: rider.id === selectedId, away: away(rider), conflict: conflict(rider) }"
        @click="emit('pick', rider)"
      >
        <!-- Кого только что выводили — вопрос, который оператор задаёт себе
             весь день. Ответ уже лежит в состоянии, показать его стоит
             одной точкой. -->
        <span class="air" :class="{ on: rider.id === onAirId }"></span>

        <span class="cls">{{ rider.sportClass || '—' }}</span>
        <span class="num tabular">{{ rider.number ?? '—' }}</span>
        <span class="fio">{{ rider.fio }}</span>
        <span class="city">{{ rider.city }}</span>

        <!-- Групп у участника может быть несколько, поэтому вместо select —
             бейдж и меню с галочками. Меню нативное (popover), а не
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
            class="chip"
            :class="{
              manual: isManual(rider),
              none: !groupsFor(rider).length,
              warn: strictGroups && groupsFor(rider).length > 1,
            }"
            :style="{ anchorName: `--grp-${rider.id}` }"
            :popovertarget="`grp-${rider.id}`"
          >
            <span class="name">{{ badgeOf(rider) ?? 'вне групп' }}</span>
            <i v-if="groupsFor(rider).length > 1" class="more">+{{ groupsFor(rider).length - 1 }}</i>
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

        <span class="best tabular" :class="{ off: away(rider) }">
          {{ away(rider) ? 'не явился' : (bestOf(rider) ?? '—') }}
        </span>

        <!-- Явка отдельной кнопкой, а не пунктом меню: перед заездами по
             списку проходят один раз и сверху вниз, и лишний клик на каждом
             человеке здесь дороже лишней колонки. -->
        <button
          class="att"
          :class="{ off: marked(rider) }"
          :disabled="held(rider)"
          :title="held(rider)
            ? 'сейчас в кадре — сначала выведите другого'
            : (marked(rider) ? 'отмечен неявившимся — вернуть в состав' : 'отметить: не приехал')"
          @click.stop="toggleStatus(rider)"
        >{{ marked(rider) ? '✕' : '✓' }}</button>
      </div>
    </section>

    <p v-if="!participants.length" class="empty">Никого не нашлось</p>
  </div>
</template>

<style scoped>
/* Сетка объявлена один раз: шапка колонок и строки обязаны стоять по одним
   вертикалям, а два места с одинаковым списком колонок разъехались бы при
   первой правке ширины. */
.list {
  --cols: 10px 38px 34px 1fr 96px 92px 84px 30px;
  overflow-y: auto;
  height: 100%;
  padding: 0 6px 6px;
}

.head, .item {
  display: grid;
  grid-template-columns: var(--cols);
  gap: 8px;
  align-items: center;
}

/* Подписей колонок раньше не было вовсе, и оператор угадывал, что перед ним.
   Липкая шапка держит их на месте при прокрутке. */
.head {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 8px 10px 6px;
  background: rgba(20, 24, 30, 0.92);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  font-size: 10px;
  font-weight: 590;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

.head .right { text-align: right; }

/* Заголовок класса тоже липкий, но ниже шапки: прокручивая длинный список,
   оператор обязан видеть, чей класс сейчас перед ним.
   Держим его тонким намеренно: классов на этапе восемь, и каждый лишний
   пиксель заголовка — это минус строка списка, ради которой всё затевалось.
   Сам класс продублирован бейджем в строке, здесь он только разделитель
   со счётчиком. */
.sec {
  position: sticky;
  top: 27px;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  padding: 5px 10px 2px;
  background: rgba(20, 24, 30, 0.92);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  font-size: 10px;
  font-weight: 640;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--accent);
}

.sec i { font-style: normal; font-weight: 500; color: var(--ink-faint); }
.sec b { margin-left: auto; font-weight: 500; font-size: 10px; color: var(--ink-faint); text-transform: none; letter-spacing: 0; }

.item {
  padding: 8px 10px;
  border-radius: var(--r-md);
  font-size: 14px;
  cursor: pointer;
  transition: background 140ms ease, opacity 140ms ease;
}

.item:hover { background: rgba(255, 255, 255, 0.07); }

.item.selected {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px rgba(255, 159, 10, 0.35);
}

/* Неявившийся остаётся на своём месте в списке: уехав вниз, он сбил бы
   оператору проход по стартовому листу. Приглушение говорит то же самое
   и не переставляет строки. */
.item.away { opacity: 0.42; }

/* Отметка стоит, а результат пришёл. Молчать нельзя: человек едет в кадре,
   и оператор должен либо снять отметку, либо понять, что она ошибочна. */
.item.conflict { box-shadow: inset 0 0 0 1px rgba(255, 214, 10, 0.5); }

/* Точка «в кадре» видна боковым зрением и не занимает колонку целиком:
   в эфире оператор смотрит на площадку, а не в пульт. */
.air { width: 6px; height: 6px; border-radius: 50%; justify-self: center; }
.air.on { background: var(--danger); box-shadow: 0 0 8px rgba(255, 69, 58, 0.8); }

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

.chip {
  display: flex;
  align-items: center;
  gap: 3px;
  width: 100%;
  padding: 3px 7px;
  border: 0;
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.06);
  color: var(--ink-dim);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  overflow: hidden;
}

.chip .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip.manual { color: var(--accent); background: var(--accent-soft); }
.chip.none .name { color: var(--ink-faint); }

/* Жёсткое разделение включили, когда человек уже в двух группах: состояние
   не чинится само, но и потеряться участник не должен. */
.chip.warn { box-shadow: inset 0 0 0 1px #ffd60a; }
.more { font-style: normal; font-size: 10px; opacity: 0.7; }
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

/* «не явился» — не результат, поэтому и выглядит иначе: тем же приглушённым
   курсивом, что сход в кадре. */
.best.off { font-size: 12px; font-style: italic; font-weight: 450; color: var(--ink-faint); }

/* Кнопка явки стоит в каждой строке, поэтому в покое она молчит: двадцать
   зелёных галочек подряд читались бы как предупреждение обо всём разом.
   Цвет появляется под курсором и остаётся у отмеченных. */
.att {
  width: 26px;
  height: 26px;
  justify-self: end;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  background: transparent;
  color: var(--ink-faint);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}

.att:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); color: var(--ok); }
.att:disabled { opacity: 0.3; cursor: not-allowed; }
.att.off { color: var(--danger); border-color: rgba(255, 69, 58, 0.4); background: rgba(255, 69, 58, 0.12); }
.att:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.empty { padding: 22px; color: var(--ink-faint); font-size: 14px; }

.list::-webkit-scrollbar { width: 10px; }
.list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.14);
  border-radius: var(--r-pill);
  border: 3px solid transparent;
  background-clip: content-box;
}
</style>
