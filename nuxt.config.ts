// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/google-fonts'
  ],
  googleFonts: {
    families: {
      Roboto: [400, 500, 700]
    }
  },
  runtimeConfig: {
    public: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    }
  },
  app: {
    head: {
      title: 'Seattle Pathfinding',
      meta: [
        { name: 'description', content: 'Find routes between locations in Seattle using A* algorithm' }
      ],
      script: [
        // Google Maps will be loaded dynamically in the component
      ]
    }
  }
})