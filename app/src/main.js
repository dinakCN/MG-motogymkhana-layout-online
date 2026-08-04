import { createApp } from 'vue'

const isControl = window.location.pathname.startsWith('/control')

const load = isControl
  ? () => import('./control/ControlRoot.vue')
  : () => import('./overlay/OverlayRoot.vue')

load().then(({ default: Root }) => createApp(Root).mount('#app'))
