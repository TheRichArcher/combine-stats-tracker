import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Remove path import if no longer needed
// import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  // Remove resolve configuration
  /*
  resolve: { 
    alias: {
      // Point 'react-select' directly to its entry point in node_modules
      'react-select': path.resolve(__dirname, 'node_modules/react-select'),
    },
  },
  */
}); 