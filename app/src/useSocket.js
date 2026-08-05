import { ref, onMounted, onUnmounted } from 'vue'

export function useSocket() {
  const state = ref(null)
  const connected = ref(false)
  let socket = null
  let retryTimer = null
  let disposed = false

  function connect() {
    if (disposed) return

    const url = `ws://${window.location.host}`
    socket = new WebSocket(url)

    socket.addEventListener('open', () => { connected.value = true })

    // Битое сообщение не должно валить обработчик: следом за ним идут
    // нормальные обновления состояния, и приём обязан их пережить.
    socket.addEventListener('message', (event) => {
      let message
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }
      if (message?.type === 'state' && message.payload) state.value = message.payload

      // Показания таймера приходят отдельно и втрое чаще состояния. Кладём
      // их внутрь того же объекта, а не рядом: источник правды остаётся
      // один, и разойтись показаниям с остальным кадром негде. Точечная
      // запись поля будит только тех, кто читает timer, — таблица
      // результатов на этом не перерисовывается.
      if (message?.type === 'timer' && state.value) state.value.timer = message.payload
    })

    // Переподключение обязательно: OBS может пересоздать источник,
    // а эфир идёт часами — ручной перезапуск страницы недопустим.
    socket.addEventListener('close', () => {
      connected.value = false
      if (!disposed) retryTimer = setTimeout(connect, 2000)
    })

    socket.addEventListener('error', () => socket.close())
  }

  function send(type, payload) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, payload }))
    }
  }

  onMounted(connect)
  onUnmounted(() => {
    // Без флага close() ниже сам же назначил бы новое переподключение,
    // и закрытая страница продолжала бы стучаться в сервер.
    disposed = true
    clearTimeout(retryTimer)
    socket?.close()
  })

  return { state, connected, send }
}
