import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'OILGUARD_');
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: { '/api': env.OILGUARD_DEV_API || 'http://127.0.0.1:3333' },
    },
    build: { sourcemap: false },
  };
});
