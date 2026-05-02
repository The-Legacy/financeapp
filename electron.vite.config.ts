import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    entry: 'src/main/index.ts',
    build: {
      outDir: 'dist/main'
    }
  },
  preload: {
    input: 'src/preload/index.ts',
    build: {
      outDir: 'dist/preload'
    },
    vite: {
      build: {
        rollupOptions: {
          external: ['electron']
        }
      }
    }
  },
  renderer: {
    root: '.',
    input: 'src/renderer/index.html',
    build: {
      outDir: 'dist/renderer'
    },
    plugins: [react()]
  }
})
