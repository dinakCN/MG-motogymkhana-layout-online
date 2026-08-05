<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { groupByClass, bestOf, attemptLabel, isDnf, isScratched, NO_RESULT_LABELS } from '../shared/format.js'
import { sectionsOfGroups } from '../shared/awardGroups.js'
import LogoBug from './LogoBug.vue'

const props = defineProps({ state: { type: Object, required: true } })

// Разрезов у таблицы два, и это не оформление, а разный ответ на вопрос
// «кто выиграл». По классам места считает сайт, и таблица сходится с
// протоколом строка в строку. По группам награждения места считаем мы:
// в «Любителях» D2 и D3 едут в одном зачёте, и первое место там одно —
// именно по этой таблице через час вручат медали.
const byGroup = computed(() => Boolean(props.state.resultsByGroup))

// Оба разреза приведены к одной форме, поэтому разметка ниже одна. Отличий
// ровно два: откуда взялись секции и показан ли класс в строке — под
// заголовком класса он подразумевается, а внутри группы уже нет.
const sections = computed(() => (byGroup.value
  ? sectionsOfGroups(
    props.state.participants, props.state.awardGroups ?? [], props.state.riderGroups ?? {},
  ).map(({ name, riders }) => ({ title: name, pill: 'award', riders }))

  : groupByClass(props.state.participants).map(({ sportClass, classColor, riders }) => ({
    title: sportClass,
    pill: classTint(classColor),
    // Место в классе считает сайт — спорить с официальным протоколом
    // в прямом эфире нельзя.
    riders: riders.map(rider => ({ rider, place: rider.placeInClass })),
  }))
))

// Цвет класса приходит с сайта и у безклассовых пуст. Без подстановки
// пилюля осталась бы прозрачной, а текст на ней — тёмным по тёмному,
// то есть невидимым.
function classTint(classColor) {
  return `color-${classColor || 'unknown'}`
}

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

// Пересчитываем и когда меняется число секций: организаторы могут проставить
// класс участнику, который шёл без класса, — участников столько же, а секций
// на одну больше, и высота контента вырастает. Смена разреза меняет её тем
// более: семь классов и три группы — разная высота при тех же людях.
watch(
  () => [props.state.participants.length, sections.value.length, byGroup.value].join(':'),
  measure,
  { immediate: true },
)

// Строки готовятся один раз на приход данных, а не пересчитываются
// в шаблоне на каждое обращение к ячейке.
const rows = computed(() => sections.value.map(section => ({
  ...section,
  riders: section.riders.map(({ rider, place }) => ({
    rider,
    place,
    // Пустой класс бывает у тех, кто попал во «Вне групп»: бейджа у них
    // нет вовсе — пустая цветная пилюля выглядела бы как потерянные данные.
    tag: rider.sportClass ? classTint(rider.classColor) : null,
    attempts: [1, 2].map((n) => {
      const attempt = rider.attempts?.find(a => a.n === n)
      if (!attempt?.time) return { time: '—', penalty: null, dnf: false, scratched: false }

      // У незачтённой попытки штраф не показываем: «сход +4» читалось бы
      // как результат с добавкой, а у заваленного заезда штраф уже ничего
      // не меняет.
      const dnf = isDnf(attempt.time)
      const scratched = isScratched(attempt)

      return {
        time: attemptLabel(attempt),
        penalty: scratched ? null : (attempt.penalty || null),
        dnf,
        scratched: scratched && !dnf,
      }
    }),
    best: bestOf(rider) ?? '—',
    dnf: NO_RESULT_LABELS.includes(bestOf(rider)),
  })),
})))
</script>

<template>
  <div class="results">
    <header>
      <h1>{{ state.eventTitle }}</h1>
      <LogoBug flow :src="state.logoMarkUrl" />
    </header>

    <div ref="body" class="body" :class="{ masked: needsScroll }">
      <div
        ref="grid"
        class="grid"
        :class="{ scrolling: needsScroll, 'by-group': byGroup }"
        :style="{ '--shift': `${shift}px`, '--duration': `${duration}s` }"
      >
        <section v-for="section in rows" :key="section.title" class="group surface">
          <!-- Подписи колонок живут в шапке секции: так они выровнены над
               своими колонками и не съедают отдельную строку высоты. -->
          <h2>
            <span class="cls" :class="section.pill">{{ section.title }}</span>
            <span class="cap">Поп. 1</span>
            <span class="cap">Поп. 2</span>
            <span class="cap">Лучшее</span>
          </h2>

          <TransitionGroup name="row" tag="div">
            <div
              v-for="row in section.riders"
              :key="row.rider.id"
              class="row"
              :class="{ leader: row.place === 1 }"
            >
              <span
                class="place tabular"
                :class="{ empty: row.place == null }"
              >{{ row.place ?? '—' }}</span>
              <!-- Внутри группы едут разные классы, и без бейджа непонятно,
                   кого именно обошёл лидер. -->
              <span v-if="byGroup" class="tag" :class="row.tag">{{ row.rider.sportClass }}</span>
              <span class="num tabular">{{ row.rider.number ?? '—' }}</span>
              <span class="name">{{ row.rider.fio }}</span>
              <span
                v-for="(attempt, i) in row.attempts"
                :key="i"
                class="time tabular"
                :class="{ dnf: attempt.dnf, scratched: attempt.scratched }"
              >{{ attempt.time }}<i v-if="attempt.penalty" class="pen">+{{ attempt.penalty }}</i></span>
              <span class="best tabular" :class="{ dnf: row.dnf }">{{ row.best }}</span>
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

/* Заголовок и жучок стоят в одном ряду, а не наложены друг на друга: высота
   шапки берётся от плитки жучка, и таблица начинается заведомо ниже её.
   Так шапку колонок первой группы нечем накрыть, чем бы ни оказался логотип.
   Плитка выросла до --band-h, шапка выросла вместе с ней, и недостающая
   высота ушла в прокрутку — measure() считает её от факта, а не от числа
   в стилях, поэтому подстраиваться руками здесь нечему. */
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 26px;
}

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

/* Сетка колонок объявлена один раз и здесь: шапка секции и строки обязаны
   стоять по одним и тем же вертикалям, а в разрезе по группам к ним
   добавляется бейдж класса. Два места с одинаковым списком колонок
   разъехались бы при первой же правке ширины. */
.grid {
  --cols: 38px 46px 1fr 108px 108px 112px;
  column-count: 2;
  column-gap: 48px;
}

.grid.by-group { --cols: 38px 42px 46px 1fr 108px 108px 112px; }

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
  grid-template-columns: var(--cols);
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}

/* Буква класса — цветная пилюля, а не подчёркнутый заголовок: цвет на
   сайте не различает D1–D4, поэтому буква обязана быть заметной. Бейдж
   в строке живёт по тем же правилам, поэтому общее у них — здесь. */
.cls, .tag {
  border-radius: var(--r-pill);
  font-weight: 700;
  color: #0a0d12;
}

/* Отсчёт справа: три последние колонки — времена, и заголовок занимает
   всё, что до них, в обоих разрезах. */
.cls {
  grid-column: 1 / -4;
  justify-self: start;
  font-size: 17px;
  letter-spacing: 0.01em;
  padding: 4px 14px;
}

/* Имя группы своего цвета не имеет: цвет на сайте раздан классам, а группа
   их объединяет. Нейтральная пилюля вместо выдуманного цвета — иначе
   «Любители» в кадре спорили бы с бейджами D2 и D3 внутри себя. */
.cls.award {
  background: rgba(255, 255, 255, 0.12);
  color: var(--ink);
  text-transform: uppercase;
  font-size: 15px;
  letter-spacing: 0.07em;
}

/* Бейдж класса в строке — тот же язык цвета, что и заголовок, только тише:
   он подпись к фамилии, а не заголовок секции. */
.tag {
  justify-self: start;
  font-size: 12px;
  letter-spacing: 0.01em;
  padding: 2px 7px;
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
  grid-template-columns: var(--cols);
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

/* Заваленная попытка зачёркнута — тем же языком, что и в протоколе:
   заезд был, время намерено, но в зачёт не идёт. */
.time.scratched {
  text-decoration: line-through;
  text-decoration-color: var(--danger);
  text-decoration-thickness: 2px;
  color: var(--ink-faint);
}

/* Сход — не результат, поэтому и выглядит иначе: приглушённый курсив,
   а не цифры в том же ряду с временами. */
.time.dnf, .best.dnf {
  font-size: 16px;
  font-style: italic;
  font-weight: 450;
  color: var(--ink-faint);
}

.pen {
  font-size: 13px;
  font-style: normal;
  font-weight: 600;
  color: var(--accent);
  margin-left: 5px;
}

.best { font-weight: 700; text-align: right; }
</style>
