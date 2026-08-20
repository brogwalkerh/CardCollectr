import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    // Dev-mode stand-in for the Vercel function in api/archidekt/[...path].ts:
    // forwards /api/archidekt/* to archidekt.com with the polite User-Agent,
    // so `npm run dev` can collect decks without deploying anything.
    proxy: {
      '/api/archidekt': {
        target: 'https://archidekt.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/archidekt/, '/api'),
        headers: {
          'User-Agent':
            'CardCollectr-DeckCollector/0.1 (browser collector, vite dev proxy; contact: brogwalkerh@gmail.com)',
        },
      },
    },
  },
})
