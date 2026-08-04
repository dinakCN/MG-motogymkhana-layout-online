import { defineConfig } from 'vitest/config'

// Отдельный конфиг намеренно: vite.config.js задаёт root: 'app' для сборки
// фронтенда, и Vitest, наследуя его, перестаёт видеть тесты в /test.
export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
  },
})
