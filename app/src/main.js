import { createApp } from 'vue'

const isControl = window.location.pathname.startsWith('/control')

// Оверлей, открытый как превью в пульте, отключает анимации: смена сцены
// там должна быть мгновенной, а не плавной. Правила — в style.css.
if (new URLSearchParams(window.location.search).has('preview')) {
  document.documentElement.classList.add('preview')
}

const load = isControl
  ? () => import('./control/ControlRoot.vue')
  : () => import('./overlay/OverlayRoot.vue')

load().then(({ default: Root }) => createApp(Root).mount('#app'))
