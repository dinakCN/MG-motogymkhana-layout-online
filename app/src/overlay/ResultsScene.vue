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

// Число колонок подбирается измерением, а не формулой от количества строк:
// высота зависит от длины имён, числа групп и переносов, и любая формула
// промахивается. Пробуем 1 → 2 → 3 и останавливаемся на первой, где
// контент помещается в кадр целиком.
//
// Прокрутка — страховка последнего уровня: включается, только если не
// хватило и трёх колонок. Оператор в этом решении не участвует.
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

watch(() => props.state.participants.length, measure, { immediate: true })

function attemptCell(rider, n) {
  const attempt = rider.attempts?.find(a => a.n === n)
  if (!attempt?.time) return { time: '—', penalty: null }
  return { time: attempt.time, penalty: attempt.penalty || null }
}
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
        <section v-for="group in groups" :key="group.sportClass" class="group">
          <!-- Подписи колонок живут в шапке класса: так они выровнены над
               своими колонками и не съедают отдельную строку высоты. -->
          <h2 :class="`color-${group.classColor}`">
            <span class="cls">{{ group.sportClass }}</span>
            <span class="cap">Поп. 1</span>
            <span class="cap">Поп. 2</span>
            <span class="cap">Лучшее</span>
          </h2>

          <TransitionGroup name="row" tag="div">
            <div v-for="rider in group.riders" :key="rider.id" class="row">
              <span class="place tabular">{{ rider.placeInClass ?? '—' }}</span>
              <span class="num tabular">{{ rider.number ?? '—' }}</span>
              <span class="name">{{ rider.fio }}</span>
              <span
                v-for="n in [1, 2]"
                :key="n"
                class="time tabular"
              >{{ attemptCell(rider, n).time }}<i
                v-if="attemptCell(rider, n).penalty"
                class="pen"
              >+{{ attemptCell(rider, n).penalty }}</i></span>
              <span class="best tabular">{{ bestOf(rider) ?? '—' }}</span>
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
  /* Плотная подложка: 47 строк поверх светлого асфальта нечитаемы,
     а проверить освещение на площадке будет негде. */
  background: linear-gradient(160deg, #0d1117 0%, #161b22 100%);
  padding: 32px 48px;
  display: flex;
  flex-direction: column;
}

header { position: relative; margin-bottom: 24px; }
h1 { font-size: 34px; font-weight: 700; letter-spacing: -0.01em; }

.body { flex: 1; overflow: hidden; }

/* Только когда список едет: строки на кромках растворяются вместо резкого
   обреза. Без прокрутки маска не нужна и не гасит верхнюю строку. */
.body.masked {
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

/* Класс никогда не разрывается между колонками — браузер разливает
   и балансирует группы сам, без алгоритма на нашей стороне. */
.group { break-inside: avoid; margin-bottom: 20px; }

h2 {
  display: grid;
  grid-template-columns: 34px 44px 1fr 104px 104px 104px;
  gap: 10px;
  align-items: baseline;
  font-size: 20px;
  font-weight: 700;
  padding-bottom: 6px;
  margin-bottom: 8px;
  border-bottom: 2px solid currentColor;
}

.cls { grid-column: 1 / 4; }

.cap {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: right;
  color: var(--muted);
}

.color-blue { color: var(--class-blue); }
.color-green { color: var(--class-green); }
.color-yellow { color: var(--class-yellow); }
.color-white { color: var(--class-white); }
.color-unknown { color: var(--class-unknown); }

.row {
  display: grid;
  grid-template-columns: 34px 44px 1fr 104px 104px 104px;
  gap: 10px;
  align-items: baseline;
  padding: 7px 0;
  border-bottom: 1px solid var(--line);
  font-size: 21px;
}

.place { color: var(--accent); font-weight: 700; }
.num { color: var(--muted); }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* nowrap обязателен: без него штраф уезжает на вторую строку
   и строки начинают скакать по высоте. */
.time { color: var(--muted); text-align: right; white-space: nowrap; }

.pen {
  font-size: 14px;
  font-style: normal;
  color: var(--accent);
  margin-left: 5px;
}

.best { font-weight: 700; text-align: right; }
</style>
