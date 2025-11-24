import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Fix for TS2580: Cannot find name 'process'
declare const process: any;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env.API_KEY for the app
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Prevent "process is not defined" error if libraries try to access process.env generically
      'process.env': {}
    }
  };
});