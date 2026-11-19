// Procedural GPU texture atlases baked once onto WebGL2 textures
// (zero per-frame Canvas2D overhead for smooth mobile performance).

const BILLBOARD_DESIGNS = [
  { bg: '#0c0c14', fg: '#ffffff', acc: '#ff1e56', title: 'AG-SYS',   sub: 'ANTI-GRAV SYSTEMS // 2097' },
  { bg: '#f6f4ef', fg: '#0a0a12', acc: '#00d8ff', title: 'FEISAR',   sub: 'EURO RESEARCH DIVISION' },
  { bg: '#ff1e56', fg: '#ffffff', acc: '#ffb800', title: 'tDR//64K', sub: 'THE DESIGNERS REPUBLIC' },
  { bg: '#101424', fg: '#00f0ff', acc: '#ff5ca8', title: 'QIREX',    sub: 'HEAVY VECTOR THRUST' },
  { bg: '#ffb800', fg: '#0a0a12', acc: '#ff1e56', title: 'CAUTION',  sub: 'HIGH UNDERPRESSURE ZONE' },
  { bg: '#0e0a18', fg: '#f6f4ef', acc: '#00f0ff', title: 'AURICOM',  sub: 'PHANTOM CLASS CIRCUIT' },
  { bg: '#f6f4ef', fg: '#ff1e56', acc: '#0a0a12', title: 'VECTOR',   sub: 'ZERO FRICTION AERODYNAMICS' },
  { bg: '#160b24', fg: '#ffb800', acc: '#00f0ff', title: '2097',     sub: 'HYPER-DRIVE TELEMETRY' }
];

export function createBillboardAtlas(gl) {
  const cols = 2, rows = 4;
  const cellW = 512, cellH = 256;
  const c = document.createElement('canvas');
  c.width = cols * cellW;
  c.height = rows * cellH;
  const ctx = c.getContext('2d');

  BILLBOARD_DESIGNS.forEach((d, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = col * cellW;
    const y = row * cellH;

    // Base fill
    ctx.fillStyle = d.bg;
    ctx.fillRect(x, y, cellW, cellH);

    // Bold diagonal tDR graphic block
    ctx.fillStyle = d.acc;
    ctx.beginPath();
    ctx.moveTo(x + cellW - 110, y);
    ctx.lineTo(x + cellW, y);
    ctx.lineTo(x + cellW, y + cellH);
    ctx.lineTo(x + cellW - 170, y + cellH);
    ctx.closePath();
    ctx.fill();

    // Hazard stripe bar on left
    ctx.fillStyle = d.acc;
    ctx.fillRect(x + 12, y + 12, 18, cellH - 24);

    // Geometric arrow / chevron icon
    ctx.fillStyle = d.fg;
    ctx.beginPath();
    ctx.moveTo(x + cellW - 85, y + 54);
    ctx.lineTo(x + cellW - 35, y + 128);
    ctx.lineTo(x + cellW - 85, y + 202);
    ctx.lineTo(x + cellW - 110, y + 202);
    ctx.lineTo(x + cellW - 60, y + 128);
    ctx.lineTo(x + cellW - 110, y + 54);
    ctx.closePath();
    ctx.fill();

    // Main Wipeout / tDR bold italic typography
    ctx.fillStyle = d.fg;
    ctx.font = 'italic 900 76px Eurostile, Bahnschrift, Impact, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.title, x + 46, y + 108);

    // Subtitle + barcode strip
    ctx.fillStyle = d.acc;
    ctx.font = '800 20px Bahnschrift, monospace';
    ctx.fillText(d.sub, x + 48, y + 178);

    // Crisp outer border
    ctx.strokeStyle = d.fg;
    ctx.lineWidth = 8;
    ctx.strokeRect(x + 4, y + 4, cellW - 8, cellH - 8);

    // Mini warez/tDR barcode
    ctx.fillStyle = d.fg;
    for (let b = 0; b < 18; b++) {
      const bw = (b * 7 + idx) % 3 === 0 ? 5 : 2;
      ctx.fillRect(x + 48 + b * 9, y + 206, bw, 22);
    }
  });

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return { tex, cols, rows, count: BILLBOARD_DESIGNS.length };
}

// Bake all unique karaoke words for a track into one GPU texture atlas
export function createLyricAtlas(gl, words, accentHex) {
  const unique = [...new Set(words)];
  const cols = 4;
  const rows = Math.max(4, Math.ceil(unique.length / cols));
  const cellW = 256;
  const cellH = 96;

  const c = document.createElement('canvas');
  c.width = cols * cellW;
  c.height = rows * cellH;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  const map = new Map();

  unique.forEach((word, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW;
    const y = row * cellH;

    // Sleek translucent Wipeout holo-plate behind racing word
    ctx.fillStyle = 'rgba(10, 10, 20, 0.72)';
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 10);
    ctx.lineTo(x + cellW - 8, y + 10);
    ctx.lineTo(x + cellW - 22, y + cellH - 10);
    ctx.lineTo(x + 4, y + cellH - 10);
    ctx.closePath();
    ctx.fill();

    // Left neon tab
    ctx.fillStyle = accentHex;
    ctx.fillRect(x + 12, y + 14, 8, cellH - 28);

    // Border outline
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Bold racing text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = word.length > 9 ? 30 : word.length > 6 ? 38 : 44;
    ctx.font = `italic 900 ${fontSize}px Eurostile, Bahnschrift, Impact, sans-serif`;
    ctx.fillText(word, x + cellW * 0.52, y + cellH * 0.52);

    map.set(word, {
      u0: col / cols,
      v0: row / rows,
      u1: (col + 1) / cols,
      v1: (row + 1) / rows
    });
  });

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return { tex, map };
}
