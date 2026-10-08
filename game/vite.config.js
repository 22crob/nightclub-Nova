import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces one self-contained dist/index.html (code and
// sprites inlined), so the game can be opened by double-clicking it or
// shared as a single file.
//
// ARTIFACT=1 (npm run build:artifact) builds the copy for the play link into
// dist-artifact/ instead: only small sprites are inlined, the bigger ones
// are separate files published next to the page, which keeps the page small
// enough for public sharing.
const artifact = !!process.env.ARTIFACT;

// Each build's id, baked into the page and written to version.json beside it,
// so a copy left open on a phone can tell a newer one is out (scene/appUpdate.js).
const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    viteSingleFile(),
    {
      name: 'version-file',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
      },
    },
    // viteSingleFile inlines every asset; for the play link only small ones.
    artifact && {
      name: 'artifact-sprite-files',
      enforce: 'post',
      config(config) {
        // Guest sheets and seats (already uploaded with the link) are files;
        // everything else, small or new, goes in the page.
        config.build.assetsInlineLimit = (file, content) => !(content.length >= 5000 && /patrons\/|seat_/.test(file));
      },
    },
  ].filter(Boolean),
  build: {
    outDir: artifact ? 'dist-artifact' : 'dist',
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    chunkSizeWarningLimit: 10000,
  },
});
