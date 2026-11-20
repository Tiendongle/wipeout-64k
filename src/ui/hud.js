// The Designers Republic / Wipeout HUD with beat-flashing red-eyed tDR logo,
// track switcher, KPH telemetry, and karaoke strip.

import { TRACKS } from '../audio/tracks.js';

export class Hud {
  constructor(root, callbacks) {
    this.root = root;
    this.cb = callbacks;

    const kb = (document.documentElement.outerHTML.length / 1024).toFixed(1);
    const beatSegs = Array.from({ length: 16 }, () => '<span class="beat-seg"></span>').join('');
    root.innerHTML = `
      <div class="hz-bar hz-top"></div>
      <div class="hz-bar hz-bot"></div>
      <div class="tdr-kana">グラヴィティ・リーグ // 64K</div>
      <div class="hud-top">
        <div class="tdr-corner">
          <div class="tdr-emblem-wrap">
            <svg class="tdr-logo" viewBox="0 0 120 108" aria-label="The Designers Republic">
              <circle cx="101" cy="18" r="11" fill="none" stroke="#f6f4ef" stroke-width="2.2"/>
              <text x="101" y="22.5" text-anchor="middle" fill="#f6f4ef" font-size="11.5" font-weight="800" font-family="Bahnschrift,Arial,sans-serif">DR</text>
              <!-- Outer white arch -->
              <path d="M24,62 L24,33 Q24,14 43,14 L73,14 Q92,14 92,33 L92,62 L75,62 L75,31 L41,31 L41,62 Z" fill="#f6f4ef"/>
              <!-- Iconic red V-eyes visor (flashes on beat) -->
              <polygon class="tdr-eye" id="tdrEyeV" points="41,31 53,31 58,41 63,31 75,31 64,49 52,49"/>
              <!-- Inner white U chin/mouth -->
              <path d="M44,48 L52,48 L52,55 L64,55 L64,48 L72,48 L72,62 L44,62 Z" fill="#f6f4ef"/>
              <!-- Wide horizontal bar -->
              <rect x="14" y="66" width="88" height="14" fill="#f6f4ef"/>
              <!-- Two splayed legs -->
              <polygon points="34,80 48,80 39,94 23,94" fill="#f6f4ef"/>
              <polygon points="68,80 82,80 93,94 77,94" fill="#f6f4ef"/>
              <!-- Katakana: デザイナーズリパブリック -->
              <text x="58" y="106" text-anchor="middle" fill="#f6f4ef" font-size="8.6" font-weight="900" font-style="italic" letter-spacing="0.4">デザイナーズリパブリック</text>
            </svg>
          </div>
          <div class="tdr-meta">
            <div class="tdr-title">tDR // WIPEOUT</div>
            <div class="tdr-sub" id="hudTrackSub">${TRACKS[0].subtitle}</div>
            <div class="tdr-badges">
              <div class="tdr-badge">64K // SINGLE-GL</div>
              <span class="tdr-size">${kb} / 64.0 KB</span>
              <svg class="tdr-reg" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4.5" fill="none" stroke="#f6f4ef" stroke-width="1.2"/><path d="M8 1v14M1 8h14" stroke="#f6f4ef" stroke-width="1.2"/></svg>
            </div>
          </div>
        </div>

        <div class="telemetry-right">
          <div class="speed-box">
            <div class="speed-num" id="hudKph">580</div>
            <div class="speed-unit">KPH // PHANTOM</div>
          </div>
          <div class="section-pill" id="hudSection">STANDBY</div>
        </div>
      </div>

      <div class="hud-bottom">
        <div class="controls-bar">
          <button class="btn play-btn" id="btnPlay">PLAY</button>
          <button class="btn" id="btnMute">AUDIO ON</button>
          ${TRACKS.map((t, i) => `<button class="btn track-btn${i === 0 ? ' active' : ''}" data-track="${i}">${t.code} ${t.name.split(' ')[0]}</button>`).join('')}
        </div>
        <div class="karaoke-strip">
          <div class="karaoke-label">RACING LYRICS // SYNC</div>
          <div class="karaoke-text" id="hudLyric">SYSTEM READY</div>
          <div class="beat-row"><span class="beat-lap" id="hudLap">LAP 01</span>${beatSegs}</div>
        </div>
      </div>

      <div class="start-overlay" id="startOverlay">
        <div class="start-card">
          <div class="start-kicker">THE DESIGNERS REPUBLIC // 64K DEMOSCENE</div>
          <div class="start-h1">WIPEOUT-64K</div>
          <pre class="start-nfo">SIZE .... ${kb} / 64.0 KB  |  ASSETS .. NONE
AUDIO ... 8 TRACKS / 6 SYNTH RACKS (LIVE)
KEYS .... 1-8 TRACKS  |  M MUTE  |  G GLITCH</pre>
          <div class="start-desc">
            MOVE MOUSE OR DRAG TOUCH LEFT / RIGHT TO SHAPE THE ONCOMING TRACK.<br>
            THE CRAFT DRIVES AUTONOMOUSLY WITH GROUND-EFFECT &amp; THRUST SURGE.
          </div>
          <button class="btn start-go" id="btnStart">ENGAGE SYNTH &amp; THRUST</button>
        </div>
      </div>
    `;

    this.eyeV = root.querySelector('#tdrEyeV');
    this.kphEl = root.querySelector('#hudKph');
    this.secEl = root.querySelector('#hudSection');
    this.subEl = root.querySelector('#hudTrackSub');
    this.lyricEl = root.querySelector('#hudLyric');
    this.lapEl = root.querySelector('#hudLap');
    this.beatSegs = [...root.querySelectorAll('.beat-seg')];
    this.playBtn = root.querySelector('#btnPlay');
    this.muteBtn = root.querySelector('#btnMute');
    this.overlay = root.querySelector('#startOverlay');
    this.trackBtns = [...root.querySelectorAll('.track-btn')];

    root.querySelector('#btnStart').addEventListener('click', () => {
      this.overlay.classList.add('hidden');
      this.cb.onStart();
    });

    this.playBtn.addEventListener('click', () => {
      this.overlay.classList.add('hidden');
      this.cb.onTogglePlay();
    });

    this.muteBtn.addEventListener('click', () => {
      this.cb.onToggleMute();
    });

    this.trackBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.overlay.classList.add('hidden');
        this.cb.onSelectTrack(Number(btn.dataset.track));
      });
    });

    this._lastKph = -1;
    this._lastSec = '';
    this._lastLyric = '';
    this._lastFlash = false;
    this._lastBar = -1;
    this._lastLap = -1;
  }

  setTrackState(idx, playing, muted) {
    const tr = TRACKS[idx];
    this.subEl.textContent = tr.subtitle;
    this.trackBtns.forEach((b, i) => b.classList.toggle('active', i === idx));
    this.playBtn.textContent = playing ? 'PAUSE' : 'PLAY';
    this.playBtn.classList.toggle('playing', playing);
    this.muteBtn.textContent = muted ? 'MUTED' : 'AUDIO ON';
  }

  update(music, ship) {
    // Only touch SVG DOM when beat-flash state actually changes!
    const flash = music.beatPulse > 0.34 || music.kick > 0.42 || (music.stabPulse || 0) > 0.45 || (music.accentTrigger || 0) > 0.45;
    if (flash !== this._lastFlash) {
      this._lastFlash = flash;
      this.eyeV.classList.toggle('flash', flash);
    }

    const kph = Math.round(ship.kph);
    if (Math.abs(kph - this._lastKph) >= 2) {
      this._lastKph = kph;
      this.kphEl.textContent = String(kph).padStart(3, '0');
    }

    if (music.sectionName !== this._lastSec) {
      this._lastSec = music.sectionName;
      this.secEl.textContent = music.sectionName;
    }

    if (music.lyric && music.lyric !== this._lastLyric) {
      this._lastLyric = music.lyric;
      this.lyricEl.textContent = music.lyric;
    }

    const bar = music.stepBar || 0;
    const seg = bar % 16;
    if (seg !== this._lastBar) {
      this._lastBar = seg;
      for (let i = 0; i < 16; i++) this.beatSegs[i].classList.toggle('on', i <= seg);
    }
    const lap = Math.floor(bar / 16) + 1;
    if (lap !== this._lastLap) {
      this._lastLap = lap;
      this.lapEl.textContent = 'LAP ' + String(lap).padStart(2, '0');
    }
  }
}
