import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(async () => {
  const tailwindcss = await import('@tailwindcss/vite').then(m => m.default);
  
  return {
    plugins: [react(), tailwindcss()],
  };
});