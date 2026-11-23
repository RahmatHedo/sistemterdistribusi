import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Tidak perlu proxy karena frontend langsung mengarah ke Nginx (port 80)
  },
});
