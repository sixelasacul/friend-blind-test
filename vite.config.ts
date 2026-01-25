import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    devtools(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true
    }),
    viteReact({
      babel: {
        plugins: ['babel-plugin-react-compiler']
      }
    }),
    tailwindcss()
  ],
  resolve: {
    alias: {
      // '@': fileURLToPath(new URL('./src', import.meta.url))
      '@/convex': path.resolve(__dirname, './convex/_generated/'),
      '@': path.resolve(__dirname, './src')
    }
  }
})
