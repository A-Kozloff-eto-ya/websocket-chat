export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'], // ← это уже подключит Tailwind
  router: {
    options: {
      hashMode: false,
      sensitive: false,
      strict: false,
    }
  },
  // ssr: false,
  nitro: {
    experimental: {
      websocket: true
    }
  }
})