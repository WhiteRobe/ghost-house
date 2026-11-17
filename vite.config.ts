import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [preact(), cloudflare({ configPath: process.env.WRANGLER_CONFIG || './wrangler.jsonc' })],
  build: { target: 'es2022', chunkSizeWarningLimit: 600 },
});
