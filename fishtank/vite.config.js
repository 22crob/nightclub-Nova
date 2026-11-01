import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes one self-contained dist/index.html: all the art is
// drawn in code, so the game is a single file you can double-click to play.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: 'dist', assetsInlineLimit: Number.MAX_SAFE_INTEGER, chunkSizeWarningLimit: 10000 },
});
