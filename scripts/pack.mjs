// Zero-dependency 64K bundler, JS+GLSL minifier & Base122+deflate-raw self-extracting HTML packer.
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
  'src/ui/intro.js',
  'src/ui/hud.js',
  'src/main.js'
];

function stripModuleSyntax(code) {
  return code
    .replace(/\/\*DEV_START\*\/[\s\S]*?\/\*DEV_END\*\//g, '')
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*export\s+(?=(?:const|let|var|function|class)\b)/gm, '');
}

// Minify GLSL 300 es source inside `#version 300 es` template literals while preserving preprocessor lines
function minifyGlsl(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const lines = noBlock.split(/\r?\n/);
  const out = [];
  for (let line of lines) {
    line = line.replace(/\/\/.*$/, '').trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      if (out.length && !out[out.length - 1].endsWith('\n')) out.push('\n');
      out.push(line + '\n');
    } else {
      const compact = line
        .replace(/\s+/g, ' ')
        .replace(/\s*([(){}[\],;?:=!&|^*/%<>])\s*/g, '$1')
        .replace(/([^+\s])\s*\+\s*([^+\s])/g, '$1+$2')
        .replace(/([^-\s])\s*-\s*([^-\s])/g, '$1-$2');
      out.push(compact);
    }
  }
  return out.join('');
}

const REGEX_PREV_KW = new Set([
  'return', 'case', 'throw', 'in', 'of', 'typeof', 'void',
  'delete', 'new', 'yield', 'await', 'else', 'do'
]);
const REGEX_PREV_CH = new Set('([,{;:=!&|?+-*%^~<>');
const NO_SPACE_AROUND = new Set('()[]{},;?:=&|*^%<>!');

function isIdentChar(ch) {
  const c = ch.charCodeAt(0);
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36;
}

// Safe zero-dependency character-by-character JS + embedded-GLSL minifier
function minifyJs(code) {
  const tokens = []; // { type: 'code'|'str'|'tpl'|'re'|'nl'|'sp'|'punc'|'id', val }
  const len = code.length;
  let i = 0;
  let prevSig = ''; // last non-whitespace token value
  let prevType = '';

  const pushTok = (type, val) => {
    tokens.push({ type, val });
    if (type !== 'sp' && type !== 'nl') {
      prevSig = val;
      prevType = type;
    }
  };

  while (i < len) {
    const ch = code[i];
    const next = code[i + 1] || '';

    // Line comment
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < len && code[i] !== '\n') i++;
      continue;
    }

    // Block comment
    if (ch === '/' && next === '*') {
      let hasNl = false;
      i += 2;
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] === '\n') hasNl = true;
        i++;
      }
      i += 2;
      pushTok(hasNl ? 'nl' : 'sp', hasNl ? '\n' : ' ');
      continue;
    }

    // Single or double quoted string
    if (ch === "'" || ch === '"') {
      let s = ch;
      i++;
      while (i < len) {
        const c = code[i++];
        s += c;
        if (c === '\\' && i < len) s += code[i++];
        else if (c === ch) break;
      }
      pushTok('str', s);
      continue;
    }

    // Template literal (tracks ${...} nesting; minifies pure GLSL shaders!)
    if (ch === '`') {
      let s = '`';
      let hasExpr = false;
      let depth = 0;
      i++;
      while (i < len) {
        const c = code[i++];
        if (depth === 0) {
          if (c === '\\' && i < len) {
            s += c + code[i++];
          } else if (c === '$' && code[i] === '{') {
            hasExpr = true;
            depth = 1;
            s += '${';
            i++;
          } else if (c === '`') {
            s += '`';
            break;
          } else {
            s += c;
          }
        } else {
          if (c === "'" || c === '"') {
            s += c;
            while (i < len) {
              const sc = code[i++];
              s += sc;
              if (sc === '\\' && i < len) s += code[i++];
              else if (sc === c) break;
            }
          } else {
            if (c === '{') depth++;
            else if (c === '}') depth--;
            s += c;
          }
        }
      }
      if (!hasExpr && s.startsWith('`#version 300 es')) {
        s = '`' + minifyGlsl(s.slice(1, -1)) + '`';
      } else if (s.includes('<div') || s.includes('<svg')) {
        s = s.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\n\s+/g, ' ');
      }
      pushTok('tpl', s);
      continue;
    }

    // Regex literal vs division operator
    if (ch === '/') {
      const canBeRegex =
        !prevSig ||
        (prevType === 'punc' && REGEX_PREV_CH.has(prevSig)) ||
        (prevType === 'id' && REGEX_PREV_KW.has(prevSig));
      if (canBeRegex) {
        let r = '/';
        let inClass = false;
        i++;
        while (i < len) {
          const c = code[i++];
          r += c;
          if (c === '\\' && i < len) r += code[i++];
          else if (c === '[') inClass = true;
          else if (c === ']') inClass = false;
          else if (c === '/' && !inClass) break;
        }
        while (i < len && /[a-z]/i.test(code[i])) r += code[i++];
        pushTok('re', r);
        continue;
      }
    }

    // Newlines
    if (ch === '\n' || ch === '\r') {
      while (i < len && (code[i] === '\n' || code[i] === '\r' || code[i] === ' ' || code[i] === '\t')) i++;
      pushTok('nl', '\n');
      continue;
    }

    // Horizontal whitespace
    if (ch === ' ' || ch === '\t') {
      while (i < len && (code[i] === ' ' || code[i] === '\t')) i++;
      pushTok('sp', ' ');
      continue;
    }

    // Identifier / number
    if (isIdentChar(ch)) {
      let id = ch;
      i++;
      while (i < len && isIdentChar(code[i])) id += code[i++];
      pushTok('id', id);
      continue;
    }

    // Single punctuator / operator character
    pushTok('punc', ch);
    i++;
  }

  // Re-emit tokens, dropping redundant spaces & safe newlines
  let out = '';
  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t];
    if (tok.type === 'sp') {
      const prev = tokens[t - 1];
      const nxt = tokens[t + 1];
      if (!prev || !nxt || prev.type === 'nl' || nxt.type === 'nl') continue;
      // Preserve space between adjacent identifiers/numbers, or +/+ and -/-, or / followed by / or *
      const a = prev.val[prev.val.length - 1];
      const b = nxt.val[0];
      if (prev.type === 'id' && nxt.type === 'id') { out += ' '; continue; }
      if ((a === '+' && b === '+') || (a === '-' && b === '-')) { out += ' '; continue; }
      if (a === '/' && (b === '/' || b === '*')) { out += ' '; continue; }
      if (prev.type === 'id' && nxt.type === 're') { out += ' '; continue; }
      if (prev.type === 'punc' && NO_SPACE_AROUND.has(a)) continue;
      if (nxt.type === 'punc' && NO_SPACE_AROUND.has(b)) continue;
      if (a === '+' || a === '-' || a === '/' || b === '+' || b === '-' || b === '/') continue;
      out += ' ';
    } else if (tok.type === 'nl') {
      const prev = tokens[t - 1];
      const nxt = tokens[t + 1];
      if (!prev || !nxt || prev.type === 'nl') continue;
      const a = prev.val[prev.val.length - 1];
      const b = nxt.val[0];
      // Safe to omit newline after { , ; ( [ or before } ) ]
      if ((prev.type === 'punc' && '{,;(['.includes(a)) || (nxt.type === 'punc' && '})]'.includes(b))) {
        continue;
      }
      if (!out.endsWith('\n')) out += '\n';
    } else {
      out += tok.val;
    }
  }
  return out.trim();
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>~])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

// Base122 UTF-8 Zero-Waste Encoder (8/7 = 1.143x overhead vs Base64's 1.333x!)
// Escapes 7 unsafe 7-bit bytes by packing 2 chunks into one 2-byte UTF-8 char (U+00C0..U+0446).
const BASE122_ILL = [0, 10, 13, 34, 38, 60, 92]; // \0 \n \r " & < \
const BASE122_OFF = 192; // U+00C0..U+0446: 100% printable 2-byte UTF-8, zero C1 controls!

function encodeBase122(buf) {
  const chunks = [];
  let bitBuf = 0, bitCount = 0;
  for (let i = 0; i < buf.length; i++) {
    bitBuf = (bitBuf << 8) | buf[i];
    bitCount += 8;
    while (bitCount >= 7) {
      chunks.push((bitBuf >> (bitCount - 7)) & 127);
      bitCount -= 7;
    }
  }
  if (bitCount > 0) chunks.push((bitBuf << (7 - bitCount)) & 127);

  let out = '';
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const k = BASE122_ILL.indexOf(c);
    if (k === -1) {
      out += String.fromCharCode(c);
    } else if (i + 1 < chunks.length) {
      out += String.fromCharCode(BASE122_OFF + (k << 7) + chunks[++i]);
    } else {
      out += String.fromCharCode(BASE122_OFF + (7 << 7) + k);
    }
  }
  return out;
}

function decodeBase122(S) {
  const I = BASE122_ILL, o = [];
  let b = 0, n = 0;
  const p = v => { b = b << 7 | v; n += 7; if (n >= 8) o.push(b >> (n -= 8) & 255); };
  for (let i = 0; i < S.length; i++) {
    const c = S.charCodeAt(i);
    if (c < 128) p(c);
    else {
      const v = c - BASE122_OFF, k = v >> 7;
      if (k > 6) p(I[v & 7]);
      else { p(I[k]); p(v & 127); }
    }
  }
  return Buffer.from(o);
}

// --- Build & Bundle ---
const css = minifyCss(fs.readFileSync(path.join(ROOT, 'src/style.css'), 'utf8'));

let bundledJs = '"use strict";\n';
for (const rel of MODULES) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  bundledJs += minifyJs(stripModuleSyntax(raw)) + '\n';
}

// Validate minified bundled JS syntax before compressing
new Function(bundledJs);

if (css.includes('\x00') || bundledJs.includes('\x00')) {
  throw new Error('Unexpected NUL byte in CSS or JS payload!');
}

const innerPayload = bundledJs + '\x00' + css;
const deflated = zlib.deflateRawSync(Buffer.from(innerPayload, 'utf8'), { level: 9 });
const encoded = encodeBase122(deflated);

// Verify Base122 round-trip integrity on every single build!
const verified = decodeBase122(encoded);
if (Buffer.compare(verified, deflated) !== 0) {
  throw new Error(`Base122 round-trip mismatch! expected ${deflated.length} bytes, got ${verified.length}`);
}

// Self-extracting HTML shell using Base122 + native browser DecompressionStream('deflate-raw')
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><title>tDR // WIPEOUT-64K</title></head><body><canvas id="gl"></canvas><div id="hud"></div><script>(async()=>{const S="${encoded}",I=[0,10,13,34,38,60,92],o=[];let b=0,n=0,p=v=>{b=b<<7|v;n+=7;if(n>=8)o.push(b>>(n-=8)&255)};for(let i=0;i<S.length;i++){const c=S.charCodeAt(i);if(c<128)p(c);else{const v=c-192,k=v>>7;k>6?p(I[v&7]):(p(I[k]),p(v&127))}}const t=await new Response(new Blob([new Uint8Array(o)]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text(),x=t.indexOf("\\0"),st=document.createElement("style");st.textContent=t.slice(x+1);document.head.appendChild(st);(0,eval)(t.slice(0,x))})()</script></body></html>`;

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUT_FILE, html, 'utf8');

const size = Buffer.byteLength(html, 'utf8');
const pct = ((size / LIMIT) * 100).toFixed(1);
console.log(`Packed -> ${OUT_FILE}`);
console.log(`Minified JS+CSS: ${Buffer.byteLength(innerPayload, 'utf8')} bytes`);
console.log(`Deflate-raw:     ${deflated.length} bytes`);
console.log(`Base122 payload: ${Buffer.byteLength(encoded, 'utf8')} bytes (${(Buffer.byteLength(encoded, 'utf8') / deflated.length).toFixed(3)}x)`);
console.log(`Packed HTML:     ${size} / ${LIMIT} bytes (${pct}% of 64 KB budget, ${LIMIT - size} bytes free)`);

if (size > LIMIT) {
  console.error(`ERROR: Packed artifact exceeded 64 KB limit by ${size - LIMIT} bytes!`);
  process.exit(1);
}
