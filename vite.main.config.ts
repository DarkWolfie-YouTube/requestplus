import { defineConfig } from 'vite';
import copy from 'rollup-plugin-copy';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron'],
      input: {
        main: 'src/main.ts',
        websocket: 'src/websocket.ts', // Add this
        authManager: 'src/authmanager.ts',
        gtsHandler: 'src/gtsHandler.ts',
        amHandler: 'src/amhandler.ts',
        websocketweb: 'src/websocketweb.ts',
        logger: 'src/logger.ts',
        queueHandler: 'src/queueHandler.ts',
        apiHandler: 'src/apiHandler.ts',
        settingsHandler: 'src/settingsHandler.ts',
        updateChecker: 'src/updateChecker.ts',
        ytManager: 'src/ytManager.ts',
        playbackHandler: 'src/playbackHandler.ts',
        packageInfo: 'package.json',
        preload: 'src/preload.ts',
        index: 'index.html'
      },
      output: {
        format: 'cjs'
      }
    }
  }, plugins: [
    copy({
      targets: [
        { src: 'src/assets/**/*', dest: '.vite/build/assets' },
        { src: 'src/views/**/*', dest: '.vite/build/views' }
      ],
      hook: 'writeBundle'
    })
  ]
})