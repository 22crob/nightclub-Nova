// Turns dist/index.html into dist/artifact.html for publishing as a claude.ai
// Artifact, whose host supplies its own <!doctype>/<html>/<head>/<body>
// wrapper: strips those tags and keeps everything inside them. The bigger
// sprites stay as .png files beside it in dist-artifact/, published with it
// (npm run build:artifact also writes dist-artifact/files.json, the Artifact
// tool's `files` map for them).
import fs from 'node:fs';

const html = fs.readFileSync('dist-artifact/index.html', 'utf8');
const out = html
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?html[^>]*>/gi, '')
  .replace(/<\/?head>/gi, '')
  .replace(/<\/?body>/gi, '')
  .replace(/<meta charset="UTF-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .trim();
fs.writeFileSync('dist-artifact/artifact.html', out + '\n');
const files = fs.readdirSync('dist-artifact').filter((f) => f.endsWith('.png'));
fs.writeFileSync('dist-artifact/files.json', JSON.stringify(Object.fromEntries(files.map((f) => [f, `game/dist-artifact/${f}`])), null, 1));
console.log(`${files.length} sprite files beside it (dist-artifact/files.json)`);
console.log(`dist-artifact/artifact.html (${(out.length / 1e6).toFixed(1)} MB)`);
