<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { groupByClass, bestOf } from '../shared/format.js'
import LogoBug from './LogoBug.vue'

const props = defineProps({ state: { type: Object, required: true } })

const groups = computed(() => groupByClass(props.state.participants))

const body = ref(null)
const grid = ref(null)
const needsScroll = ref(false)
const shift = ref(0)
const duration = ref(30)

// Скорость прокрутки в пикселях в секунду. Задаёт время чтения строки
// и не зависит от числа участников: чем длиннее список, тем дольше проход.
const SCROLL_SPEED = 45

const settle = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Колонок всегда две: при составе до 80 человек «подобрать столько колонок,
// чтобы всё влезло» означало бы строку высотой около 10 пикселей — на
// телевизоре нечитаемо. Вместо этого недостающая высота отдаётся прокрутке.
//
// Замер один и с паузой: TransitionGroup анимирует переезд строк 400 мс,
// и раньше этого срока высота контента ещё «плывёт».
async function measure() {
  await nextTick()
  await settle(500)

  if (!grid.value || !body.value) return

  const overflow = grid.value.scrollHeight - body.value.clientHeight
  needsScroll.value = overflow > 4
  shift.value = Math.max(overflow, 0)
  duration.value = Math.max(Math.round(shift.value / SCROLL_SPEED), 20)
}

// Пересчитываем и когда меняется число групп: организаторы могут проставить
// класс участнику, который шёл без класса, — участников столько же, а групп
// на одну больше, и высота контента вырастает.
watch(
  () => [props.state.participants.length, groups.value.length].join(':'),
  measure,
  { immediate: true },
)

// Строки готовятся один раз на приход данных, а не пересчитываются
// в шаблоне на каждое обращение к ячейке.
const rows = computed(() => groups.value.map(group => ({
  ...group,
  riders: group.riders.map(rider => ({
    rider,
    attempts: [1, 2].map((n) => {
      const attempt = rider.attempts?.find(a => a.n === n)
      return attempt?.time
        ? { time: attempt.time, penalty: attempt.penalty || null }
        : { time: '—', penalty: null }
    }),
    best: bestOf(rider) ?? '—',
  })),
})))
</script>

<template>
  <div class="results">
    <header>
      <h1>{{ state.eventTitle }}</h1>
      <LogoBug :src="state.logoUrl" />
    </header>

    <div ref="body" class="body" :class="{ masked: needsScroll }">
      <div
        ref="grid"
        class="grid"
        :class="{ scrolling: needsScroll }"
        :style="{ '--shift': `${shift}px`, '--duration': `${duration}s` }"
      >
        <section v-for="group in rows" :key="group.sportClass" class="group surface">
          <!-- Подписи колонок живут в шапке класса: так они выровнены над
               своими колонками и не съедают отдельную строку высоты. -->
          <h2>
            <span class="cls" :class="`color-${group.classColor}`">{{ group.sportClass }}</span>
            <span class="cap">Поп. 1</span>
            <span class="cap">Поп. 2</span>
            <span class="cap">Лучшее</span>
          </h2>

          <TransitionGroup name="row" tag="div">
            <div
              v-for="row in group.riders"
              :key="row.rider.id"
              class="row"
              :class="{ leader: row.rider.placeInClass === 1 }"
            >
              <span
                class="place tabular"
                :class="{ empty: row.rider.placeInClass == null }"
              >{{ row.rider.placeInClass ?? '—' }}</span>
              <span class="num tabular">{{ row.rider.number ?? '—' }}</span>
              <span class="name">{{ row.rider.fio }}</span>
              <span
                v-for="(attempt, i) in row.attempts"
                :key="i"
                class="time tabular"
              >{{ attempt.time }}<i v-if="attempt.penalty" class="pen">+{{ attempt.penalty }}</i></span>
              <span class="best tabular">{{ row.best }}</span>
            </div>
          </TransitionGroup>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.results {
  width: 100%;
  height: 100%;
  /* Плотная подложка: десятки строк поверх светлого асфальта нечитаемы,
     а проверить освещение на площадке будет негде. Мягкое тёплое свечение
     сверху не даёт фону читаться как плоская заливка. */
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(255, 159, 10, 0.13) 0%, transparent 60%),
    linear-gradient(170deg, #10141a 0%, #0a0d12 100%);
  padding: 36px 52px;
  display: flex;
  flex-direction: column;
}

header { position: relative; margin-bottom: 26px; }

h1 {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.body { flex: 1; overflow: hidden; }

/* Только когда список едет: строки на кромках растворяются вместо резкого
   обреза. Без прокрутки маска не нужна и не гасит верхнюю строку. */
/* Префикс обязателен: OBS рендерит источник через CEF, и версия Chromium
   там может быть старше настольного браузера. */
.body.masked {
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 40px,
    #000 calc(100% - 40px),
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 40px,
    #000 calc(100% - 40px),
    transparent 100%
  );
}

.grid {
  column-count: 2;
  column-gap: 48px;
}

/* Ход прокрутки — ровно недостающая высота, посчитанная в measure().
   alternate возвращает список наверх тем же плавным движением, без рывка
   в начало. Паузы на краях дают дочитать первые и последние строки. */
.grid.scrolling {
  animation: creep var(--duration) ease-in-out infinite alternate;
}

@keyframes creep {
  0%, 12%   { transform: translateY(0); }
  88%, 100% { transform: translateY(calc(-1 * var(--shift))); }
}

/* Каждый класс — отдельная стеклянная плашка. Класс никогда не рвётся
   между колонками: браузер разливает и балансирует группы сам. */
.group {
  break-inside: avoid;
  margin-bottom: 18px;
  padding: 14px 18px 10px;
  border-radius: var(--r-lg);
}

h2 {
  display: grid;
  grid-template-columns: 38px 46px 1fr 108px 108px 112px;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}

/* Буква класса — цветная пилюля, а не подчёркнутый заголовок: цвет на
   сайте не различает D1–D4, поэтому буква обязана быть заметной. */
.cls {
  grid-column: 1 / 4;
  justify-self: start;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.01em;
  padding: 4px 14px;
  border-radius: var(--r-pill);
  color: #0a0d12;
}

.cap {
  font-size: 11px;
  font-weight: 590;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: right;
  color: var(--ink-faint);
}

.color-blue { background: var(--class-blue); color: #fff; }
.color-green { background: var(--class-green); }
.color-yellow { background: var(--class-yellow); }
.color-white { background: var(--class-white); }
.color-unknown { background: var(--class-unknown); color: #fff; }

.row {
  display: grid;
  grid-template-columns: 38px 46px 1fr 108px 108px 112px;
  gap: 10px;
  align-items: baseline;
  padding: 8px 10px;
  margin: 0 -10px;
  border-radius: var(--r-sm);
  font-size: 21px;
  font-weight: 450;
}

/* Лидер отмечен затухающим бликом от левого края, а не сплошной заливкой:
   в классе из одного участника заливка красила бы всю плашку и давила. */
.row.leader {
  background: linear-gradient(90deg, rgba(255, 159, 10, 0.15) 0%, transparent 55%);
  box-shadow: inset 2px 0 0 var(--accent);
}

.place { color: var(--accent); font-weight: 700; }

/* До появления результатов мест нет у всех сразу — акцентный цвет
   превратил бы колонку прочерков в шум. */
.place.empty { color: var(--ink-faint); font-weight: 450; }
.num { color: var(--ink-faint); }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* nowrap обязателен: без него штраф уезжает на вторую строку
   и строки начинают скакать по высоте. */
.time { color: var(--ink-dim); text-align: right; white-space: nowrap; }

.pen {
  font-size: 13px;
  font-style: normal;
  font-weight: 600;
  color: var(--accent);
  margin-left: 5px;
}

.best { font-weight: 700; text-align: right; }
</style>
