import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/.pnpm/ethers@')) return 'wallet-write';
          if (id.includes('/node_modules/.pnpm/react-router')) return 'router';
          if (
            id.includes('/node_modules/.pnpm/react@') ||
            id.includes('/node_modules/.pnpm/react-dom@')
          )
            return 'react';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
