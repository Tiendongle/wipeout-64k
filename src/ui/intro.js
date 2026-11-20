// Wipeout 2097 / tDR poster-style cracktro intro layered transparently over the live 3D scene:
// Custom modular SVG wipEout 64K logotype, oversized edge-cropped tDR emblem, SVG+ASCII radial
// targeting reticle, block-ASCII spectrum/telemetry matrix, duo-tone proportionally kerned
// scroller, angled tDR bar dock, and cohesive WebGL shader + split-panel launch transition.

const GLY = '!<>-_\\/[]{}=+*^?#%01ABCDEFGHJKLMNPQRSTUVWXYZ';
const BARS = '▁▂▃▄▅▆▇█';
const SCROLL_SEGS = [
  ['*** WIPEOUT-64K *** ', 1],
  ['CRACKED & CODED BY tDR ', 0],
  ['// 100% PROCEDURAL WEBGL2 + WEB AUDIO ', 1],
  ['// ZERO EXTERNAL ASSETS ', 0],
  ['// 8 LIVE SYNTH RACKS ', 1],
  ['// GREETZ: FEISAR · AG-SYS · AURICOM · QIREX · PIRANHA · 64K DEMOSCENE ', 0],
  ['// WORK BUY CONSUME DIE ', 1]
];

// Shared red-eyed tDR emblem SVG (reused by both intro poster and HUD corner!)
export const tdrSvg = (cls, eyeAttr, kana = '') => `<svg class="${cls}" viewBox="0 0 120 108" aria-label="The Designers Republic">` +
  (kana ? '<defs><filter id="inFx" x="-30%" y="-35%" width="160%" height="170%" color-interpolation-filters="sRGB"><feGaussianBlur id="inStreak" in="SourceGraphic" stdDeviation="16 1.4" result="st"/><feGaussianBlur in="SourceGraphic" stdDeviation="4.5 4.5" result="bl"/><feMerge><feMergeNode in="st"/><feMergeNode in="bl"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' : '') +
  '<circle cx="101" cy="18" r="11" fill="none" stroke="#f6f4ef" stroke-width="2.2"/>' +
  '<text x="101" y="22.5" text-anchor="middle" fill="#f6f4ef" font-size="11.5" font-weight="800">DR</text>' +
  '<path d="M24,62 L24,33 Q24,14 43,14 L73,14 Q92,14 92,33 L92,62 L75,62 L75,31 L41,31 L41,62 Z" fill="#f6f4ef"/>' +
  `<polygon ${eyeAttr} points="41,31 53,31 58,41 63,31 75,31 64,49 52,49"/>` +
  '<path d="M44,48 L52,48 L52,55 L64,55 L64,48 L72,48 L72,62 L44,62 Z" fill="#f6f4ef"/>' +
  '<rect x="14" y="66" width="88" height="14" fill="#f6f4ef"/>' +
  '<polygon points="34,80 48,80 39,94 23,94" fill="#f6f4ef"/>' +
  `<polygon points="68,80 82,80 93,94 77,94" fill="#f6f4ef"/>${kana}</svg>`;
const TDR_BIG_SVG = tdrSvg('in-tdr-big', 'fill="#ff1e56"');

const WO_PATH = 'M8,28H26V68Q26,74 32,74H44V28H62V74H74Q80,74 80,68V28H98V70Q98,90 78,90H28Q8,90 8,70ZM112,8H132V20H112ZM112,28H132V90H112ZM146,28H166V114H146ZM172,28H208Q228,28 228,48V70Q228,90 208,90H172V74H204Q210,74 210,68V50Q210,44 204,44H172ZM242,46Q242,28 262,28H314V44H264Q260,44 260,48V50H242ZM258,52H310V66H258ZM242,68H260V70Q260,74 264,74H314V90H262Q242,90 242,72ZM328,48Q328,28 348,28H392Q412,28 412,48V70Q412,90 392,90H348Q328,90 328,70ZM346,48V70Q346,74 352,74H388Q394,74 394,70V48Q394,44 388,44H352Q346,44 346,48ZM426,28H446V68Q446,74 452,74H484Q490,74 490,68V28H510V70Q510,90 490,90H446Q426,90 426,70ZM526,10H546V68Q546,74 552,74H576V90H546Q526,90 526,70ZM552,28H578V42H552ZM590,28H602V66H590ZM590,76H602V90H590Z';
const NUM_PATH = 'M466,80L480,68H530V82H486L482,86V92H522L532,102V122L520,134H478L466,122ZM482,106V118L486,120H512L516,118V106L512,104H486ZM544,68H560V96H584V68H600V134H584V110H544ZM614,68H630V94L656,68H678L648,98L680,134H658L630,104V134H614Z';

function wipeoutSvg() {
  return `<svg class="in-wosvg" viewBox="0 0 700 142" aria-label="wipEout 64K">
    <g transform="translate(18,0) skewX(-13)">
      <path d="${WO_PATH}" fill="#ff1e56" transform="translate(-5,3)"/>
      <path d="${WO_PATH}" fill="#00f0ff" transform="translate(5,-2)"/>
      <path class="in-womain" d="${WO_PATH}" fill="#f6f4ef" fill-rule="evenodd" stroke="#ffffff" stroke-width="1.5"/>
      <path d="${NUM_PATH}" fill="#0a0a10" transform="translate(5,5)"/>
      <path class="in-nummain" d="${NUM_PATH}" fill="#ff5a00" fill-rule="evenodd" stroke="#ffb800" stroke-width="2"/>
    </g>
  </svg>`;
}

function reticleSvg() {
  let rays = '';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x1 = (200 + Math.cos(a) * 26).toFixed(1), y1 = (200 + Math.sin(a) * 26).toFixed(1);
    const x2 = (200 + Math.cos(a) * 195).toFixed(1), y2 = (200 + Math.sin(a) * 195).toFixed(1);
    rays += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${i % 4 ? '#f6f4ef' : '#00f0ff'}" stroke-opacity="${i % 4 ? 0.14 : 0.35}" stroke-width="1"/>`;
  }
  return `<svg class="in-retsvg" viewBox="0 0 400 400" aria-hidden="true">${rays}
    <circle cx="200" cy="200" r="26" fill="none" stroke="#00f0ff" stroke-opacity="0.65" stroke-width="1.2"/>
    <circle class="in-rot1" cx="200" cy="200" r="68" fill="none" stroke="#f6f4ef" stroke-opacity="0.4" stroke-width="1.2" stroke-dasharray="28 14 8 14"/>
    <circle class="in-rot2" cx="200" cy="200" r="126" fill="none" stroke="#ff1e56" stroke-opacity="0.45" stroke-width="1.4" stroke-dasharray="48 22 12 22"/>
    <circle cx="200" cy="200" r="176" fill="none" stroke="#ffb800" stroke-opacity="0.22" stroke-width="1" stroke-dasharray="6 10"/>
  </svg>`;
}

export function introHtml() {
  return `
    <div class="start-overlay" id="startOverlay">
      <div class="in-reticle">${reticleSvg()}<div class="in-rettxt" id="inRetTxt"></div></div>
      <div class="in-stripes" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      ${TDR_BIG_SVG}
      <div class="in-head">
        <div class="in-spec"><b>2097 // 64K</b> DIGITAL // <span id="inSpec"></span></div>
        ${wipeoutSvg()}
        <div class="in-tag"><span id="inTag"></span><i></i><em>PHANTOM // 8-TRACK SYNTH</em></div>
      </div>
      <div class="in-deck">
        <div class="in-dhead"><span>SYS.TELEMETRY // F3600</span><span id="inHex">0x64K0</span></div>
        <pre class="in-ascii" id="inAscii"></pre>
        <pre class="start-nfo" id="inNfo"></pre>
        <button class="btn start-go" id="btnStart">ENGAGE SYNTH &amp; THRUST</button>
        <div class="in-hint">[PRESS SPACE OR CLICK TO LAUNCH]</div>
      </div>
      <canvas class="in-scroll" id="inScroll"></canvas>
      <div class="in-foot">
        <div class="in-tab">ワイプアウト <b>64K</b> <em>反重力リーグ</em></div>
        <div class="in-bars" aria-hidden="true">
          <i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i>
          <span class="in-btxt">F3600 // ANTI-GRAVITY RACING LEAGUE</span>
          <i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i><i class="b5"></i>
          <em class="in-bkana">反重力</em>
        </div>
        <div class="in-bar"><span class="in-ctr" id="inCtr">0000000</span><span class="in-pills"><i></i><i></i><i></i><i></i></span><span class="in-url" id="inUrl"></span></div>
      </div>
    </div>`;
}

export function startIntro(ov, kb) {
  const $ = (id) => ov.querySelector('#' + id);
  const asc = $('inAscii'), hexEl = $('inHex'), retTxt = $('inRetTxt'), nfo = $('inNfo'), ctr = $('inCtr');
  const streakEl = document.getElementById('inStreak');
  const cv = $('inScroll'), cx2 = cv.getContext('2d');
  // Compact 36-char max width so NFO never overflows .in-deck on any viewport
  const nfoText = `SIZE ... ${kb} / 64.0 KB | ASSETS: 0\nAUDIO .. 8 LIVE SYNTH RACKS (AUTO)\nKEYS ... 1-8 TRACK | L LOOP | G GLT`;
  const t0 = performance.now() * 0.001;
  let lastAsc = 0, lastCtr = 0, glitchUntil = 0, nextGlitch = t0 + 9.5;

  // Scramble-decode jobs: [el, target, startSec, durSec]
  const jobs = [];
  const scramble = (el, txt, delay, dur) => jobs.push([el, txt, performance.now() * 0.001 + delay, dur]);
  const intro = (isLoop) => {
    scramble($('inTag'), 'ACCELERATED ADRENALIN RUSH -', 0.45, 1.05);
    scramble($('inSpec'), 'ANTI-GRAVITY RACING LEAGUE // F3600', 0.15, 1.1);
    $('inUrl').textContent = isLoop ? '008:wipeout64k.tdr' : '008:wipeout64k.tdr/boot';
    scramble($('inUrl'), 'www.wipeout64k.tdr/2097', 1.1, 1.0);
  };
  intro(false);

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(2, cv.clientWidth * dpr);
    cv.height = Math.max(2, cv.clientHeight * dpr);
    cx2.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const bar = (frac) => {
    const n = Math.max(1, Math.min(10, Math.round(frac * 10)));
    return '█'.repeat(n) + '░'.repeat(10 - n);
  };

  const drawAscii = (t) => {
    // 20-band block-ASCII spectrum wave + dual tDR vector bar gauges (34 chars max width!)
    let eq = '';
    for (let i = 0; i < 20; i++) {
      const v = 0.5 + 0.48 * Math.sin(t * 5.2 + i * 0.55) * Math.cos(t * 2.7 - i * 0.3);
      eq += BARS[Math.max(0, Math.min(7, (v * 8) | 0))];
    }
    const th = 0.78 + 0.2 * Math.sin(t * 4.1);
    const ag = 0.72 + 0.24 * Math.cos(t * 3.1);
    asc.textContent = [
      `SPECTRUM [${eq}]`,
      `THRUST   [${bar(th)}] ${(th * 100) | 0}%`,
      `AERO-G   [${bar(ag)}] LOCK`
    ].join('\n');
    hexEl.textContent = '0x' + (((t * 1400) & 0xffff) | 0x1000).toString(16).toUpperCase();
    const az = (62 + Math.sin(t * 1.4) * 0.9).toFixed(1).padStart(5, '0');
    const el = (38 + Math.cos(t * 1.1) * 0.6).toFixed(1).padStart(5, '0');
    retTxt.textContent = `AZ:${az} // EL:${el} // LOCK:PHANTOM // VEC:OK`;
  };

  const drawScroller = (t) => {
    const w = cv.clientWidth, h = cv.clientHeight;
    cx2.clearRect(0, 0, w, h);
    const fs = Math.max(15, Math.min(22, Math.round(h * 0.52)));
    cx2.font = `italic 900 ${fs}px Eurostile, Bahnschrift, 'Segoe UI', sans-serif`;
    if ('letterSpacing' in cx2) cx2.letterSpacing = '2.5px';
    cx2.textBaseline = 'middle';

    // Measure natural proportional widths of each phrase segment for true kerning
    const segW = SCROLL_SEGS.map(([s]) => cx2.measureText(s).width + 6);
    let totalW = 0;
    for (const sw of segW) totalW += sw;
    if (totalW < 10) return;

    let x = -(((t - t0) * 165) % totalW);
    const cy = h * 0.52;
    // High-speed neon slipstream laser streaks shooting across the scroller canvas
    cx2.save();
    for (let s = 0; s < 5; s++) {
      const sx = ((w * 1.4) - (((t * (520 + s * 140)) + s * 230) % (w * 1.5)));
      const sy = 4 + ((s * 13) % Math.max(8, h - 8));
      const swLen = 55 + (s * 28);
      cx2.fillStyle = s & 1 ? 'rgba(0,240,255,0.55)' : 'rgba(255,30,86,0.55)';
      cx2.fillRect(sx, sy, swLen, 1.6);
    }
    cx2.shadowBlur = 12;
    while (x < w + 40) {
      for (let i = 0; i < SCROLL_SEGS.length; i++) {
        const [txt, isAccent] = SCROLL_SEGS[i];
        const sw = segW[i];
        if (x + sw > -20 && x < w + 20) {
          const y = cy + Math.sin((x + t * 180) * 0.008) * (h * 0.14);
          // Anamorphic bloom glow + duo-tone chromatic shadow + crisp paper/amber primary fill
          cx2.shadowColor = isAccent ? '#00f0ff' : '#ff1e56';
          cx2.fillStyle = isAccent ? '#00f0ff' : '#ff1e56';
          cx2.fillText(txt, x - 2.5, y + 1.5);
          cx2.fillStyle = isAccent ? '#ffb800' : '#f6f4ef';
          cx2.fillText(txt, x, y);
        }
        x += sw;
      }
    }
    cx2.restore();
  };

  const loop = () => {
    const now = performance.now() * 0.001;
    if (ov.classList.contains('hidden') && now - (ov._hideT || 0) > 0.6) {
      window.removeEventListener('resize', resize);
      return;
    }
    if (ov.classList.contains('hidden') && !ov._hideT) {
      ov._hideT = now;
    }
    const t = now;

    // Pulse the GPU SVG anamorphic speed-streak + bloom filter across all UI elements (surges on launch!)
    if (streakEl) {
      const launchMult = ov._hideT ? Math.min(4.0, 1 + (now - ov._hideT) * 8) : 1;
      const sx = ((14 + Math.sin(t * 5.5) * 6 + (glitchUntil ? 18 : 0)) * launchMult).toFixed(1);
      streakEl.setAttribute('stdDeviation', `${sx} 1.5`);
    }

    if (t - lastAsc > 0.05) {
      lastAsc = t;
      drawAscii(t);
    }
    drawScroller(t);

    // Scramble-decode text jobs
    for (let i = jobs.length - 1; i >= 0; i--) {
      const [el, txt, s, d] = jobs[i];
      if (t < s) continue;
      const p = Math.min(1, (t - s) / d);
      const n = Math.floor(p * txt.length);
      let str = txt.slice(0, n);
      for (let k = n; k < txt.length; k++) str += txt[k] === ' ' ? ' ' : GLY[(Math.random() * GLY.length) | 0];
      el.textContent = str;
      if (p >= 1) jobs.splice(i, 1);
    }

    // Typewriter NFO
    const nc = Math.min(nfoText.length, Math.max(0, Math.floor((t - t0 - 0.5) * 75)));
    nfo.textContent = nfoText.slice(0, nc) + ((t * 2.5) % 1 < 0.55 ? '\u2588' : ' ');

    // Rapid 7-digit telemetry counter
    if (t - lastCtr > 0.06) {
      lastCtr = t;
      ctr.textContent = String((Math.random() * 1e7) | 0).padStart(7, '0');
    }

    // Periodic slice-glitch burst + re-decode
    if (t > nextGlitch) {
      nextGlitch = t + 10;
      glitchUntil = t + 0.45;
      ov.classList.add('in-glitch');
      intro(true);
    }
    if (glitchUntil && t > glitchUntil) {
      glitchUntil = 0;
      ov.classList.remove('in-glitch');
    }

    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
