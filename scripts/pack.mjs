// Zero-dependency 64K bundler & gzip self-extracting HTML packer.
// Keeps the unpacked src/ clean & readable while packing dist/wipeout-64k.html well under 64 KB.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT_FILE = path.join(DIST, 'wipeout-64k.html');
const LIMIT = 65536; // 64 KB strict budget

// Topological order of ES modules
const MODULES = [
  'src/audio/tracks.js',
  'src/audio/synth.js',
  'src/world/track.js',
  'src/world/ship.js',
  'src/gl/glUtils.js',
  'src/gl/shaders.js',
  'src/gl/geometry.js',
  'src/gl/textures.js',
  'src/gl/renderer.js',
  'src/ui/hud.js',
  'src/main.js'
];

function stripModuleSyntax(code) {
  // Remove single-line and multi-line import statements, and strip leading `export ` keywords
  return code
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*export\s+(?=(?:const|let|var|function|class)\b)/gm, '');
}

function lightMinifyJs(code) {
  // Strip // line comments outside strings/template literals safely (simple line-based for clean source)
  return code
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\n\s*\n+/g, '\n')
    .replace(/^[ \t]+/gm, '')
    .trim();
}

function lightMinifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .trim();
}

const css = lightMinifyCss(fs.readFileSync(path.join(ROOT, 'src/style.css'), 'utf8'));

let bundledJs = '"use strict";\n';
for (const rel of MODULES) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  bundledJs += lightMinifyJs(stripModuleSyntax(raw)) + '\n';
}

// Validate bundled JS syntax before compressing
new Function(bundledJs);

const innerPayload = JSON.stringify({ c: css, j: bundledJs });
const gz = zlib.gzipSync(Buffer.from(innerPayload, 'utf8'), { level: 9 });
const b64 = gz.toString('base64');

// Tiny self-extracting HTML shell using native browser DecompressionStream('gzip')
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>tDR // WIPEOUT-64K</title></head><body><canvas id="gl"></canvas><div id="hud"></div><script>(async()=>{const b=Uint8Array.from(atob("${b64}"),c=>c.charCodeAt(0));const s=new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip")));const d=await s.json();const st=document.createElement("style");st.textContent=d.c;document.head.appendChild(st);(0,eval)(d.j)})()</script></body></html>`;

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUT_FILE, html, 'utf8');

const size = Buffer.byteLength(html, 'utf8');
const pct = ((size / LIMIT) * 100).toFixed(1);
console.log(`Packed -> ${OUT_FILE}`);
console.log(`Raw JS+CSS: ${Buffer.byteLength(innerPayload, 'utf8')} bytes`);
console.log(`Packed HTML: ${size} / ${LIMIT} bytes (${pct}% of 64 KB budget)`);

if (size > LIMIT) {
  console.error(`ERROR: Packed artifact exceeded 64 KB limit by ${size - LIMIT} bytes!`);
  process.exit(1);
}
