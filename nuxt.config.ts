export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'], // ← это уже подключит Tailwind
  nitro: {
    experimental: {
      websocket: true
    }
  }
})