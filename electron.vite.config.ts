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
      outDir: 'dist/preload',
      rollupOptions: {
        external: ['electron'],
        output: {
          format: 'cjs',
          entryFileNames: '[name].js'
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    input: 'src/renderer/index.html',
    build: {
      outDir: 'dist/renderer'
    },
    plugins: [react()]
  }
})
