export default defineNuxtConfig({
  devtools: { enabled: true },
  
  modules: ['@nuxtjs/tailwindcss'],
  router: {
    options: {
      hashMode: false,
      sensitive: false,
      strict: false,
    }
  },
  runtimeConfig: {
    password: ''
  },
  // ssr: false,
  nitro: {
    experimental: {
      websocket: true
    }
  }
})