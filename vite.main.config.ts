import { defineConfig } from 'vite';
import copy from 'rollup-plugin-copy';
import * as path from 'node:path';

const releaseChannel = process.env.REQUESTPLUS_RELEASE_BRANCH || 'stable';
if (!/^[a-z0-9][a-z0-9-]{0,29}$/.test(releaseChannel)) {
  throw new Error('REQUESTPLUS_RELEASE_BRANCH must contain lowercase letters, numbers, or hyphens');
}

const nodeBuiltins = [
  'fs',
  'path',
  'crypto',
  'child_process',
  'events',
  'os',
  'node:assert',
  'node:child_process',
  'node:crypto',
  'node:events',
  'node:fs',
  'node:os',
  'node:path',
  'node:timers/promises',
  'node:util',
];

// https://vitejs.dev/config
export default defineConfig({
  define: {
    __REQUESTPLUS_RELEASE_CHANNEL__: JSON.stringify(releaseChannel),
  },
  build: {
    target: 'node22',
    rollupOptions: {
      external: (id) => {
        if (id === 'electron' || nodeBuiltins.includes(id)) return true;
        if (id.startsWith('.') || id.startsWith('src/') || path.isAbsolute(id)) return false;
        return true;
      },
      input: {
        main: 'src/main.ts',
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
