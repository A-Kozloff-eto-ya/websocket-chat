export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'], // ← это уже подключит Tailwind
  nitro: {
    prerender: {
      crawlLinks: false,
      routes: ['/sitemap.xml']
    },
    experimental: {
      websocket: true
    }
  },
  $production: {
    nitro: {
      prerender: {
        crawlLinks: false
      }
    }
  }
})