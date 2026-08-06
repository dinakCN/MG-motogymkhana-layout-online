import { computed } from 'vue'
import { competing } from '../shared/riderStatus.js'

// Состояние, каким его видят сцены: тот же объект, но без тех, кто не приехал.
//
// Вычитание живёт здесь, а не в каждой сцене: итоговая таблица, топ-3 рядом
// с карточкой заезда и подиум считают места по одному составу, и разъехавшись,
// они дали бы разные ответы на вопрос «кто выиграл».
//
// Подменяем поле, а не пересобираем объект. Копия через spread прочитала бы
// все поля разом, в том числе timer, — а показания прибора приезжают три раза
// в секунду (см. useSocket.js) и кладутся в состояние точечной записью именно
// ради того, чтобы таблица на них не перерисовывалась. Посредник сохраняет
// это разделение: сцена, читающая timer, обновляется от таймера, а читающая
// participants — только когда изменился состав или отметки явки.
export function sceneStateOf(state) {
  const roster = computed(() => competing(
    state.value?.participants ?? [], state.value?.riderStatus ?? {},
  ))

  return computed(() => (state.value
    ? new Proxy(state.value, {
      get: (target, key) => (key === 'participants' ? roster.value : target[key]),
    })
    : null))
}
