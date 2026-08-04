import { ref, onMounted, onUnmounted } from 'vue'

export function useSocket() {
  const state = ref(null)
  const connected = ref(false)
  let socket = null
  let retryTimer = null

  function connect() {
    const url = `ws://${window.location.host}`
    socket = new WebSocket(url)

    socket.addEventListener('open', () => { connected.value = true })

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'state') state.value = message.payload
    })

    // Переподключение обязательно: OBS может пересоздать источник,
    // а эфир идёт часами — ручной перезапуск страницы недопустим.
    socket.addEventListener('close', () => {
      connected.value = false
      retryTimer = setTimeout(connect, 2000)
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
    clearTimeout(retryTimer)
    socket?.close()
  })

  return { state, connected, send }
}
