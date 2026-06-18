import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    target: 'node22',
    rollupOptions: {
      external: ['electron'],
      input: {
        preload: 'src/preload.ts',
      },
      output: {
        format: 'cjs',
      },
    },
  },
});
