// The Designers Republic / Wipeout HUD with beat-flashing red-eyed tDR logo,
// track switcher, KPH telemetry, and karaoke strip.

import { TRACKS } from '../audio/tracks.js';
import { introHtml, startIntro, tdrSvg } from './intro.js';

export class Hud {
  constructor(root, callbacks) {
    this.root = root;
    this.cb = callbacks;

    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    const kb = (((nav && nav.decodedBodySize) || document.documentElement.outerHTML.length) / 1024).toFixed(1);
    const beatSegs = Array.from({ length: 16 }, () => '<span class="beat-seg"></span>').join('');
    root.innerHTML = `
      <div class="hz-bar hz-top"></div>
      <div class="hz-bar hz-bot"></div>
      <div class="greetz-bar"><span class="greetz-track">*** GREETZ TO: THE DESIGNERS REPUBLIC // FEISAR // AG-SYS // QIREX // AURICOM // REPUBLIC GRAVITY LEAGUE // THE 64K DEMOSCENE // ALL NIGHT TRACKER CREW ***</span></div>
      <div class="tdr-kana">グラヴィティ・リーグ // 64K</div>
      <div class="hud-top">
        <div class="tdr-corner">
          <div class="tdr-emblem-wrap">
            ${tdrSvg('tdr-logo', 'class="tdr-eye" id="tdrEyeV"', '<text x="58" y="106" text-anchor="middle" fill="#f6f4ef" font-size="8.6" font-weight="900" font-style="italic" letter-spacing="0.4">デザイナーズリパブリック</text>')}
          </div>
          <div class="tdr-meta">
            <div class="tdr-title">tDR // WIPEOUT</div>
            <div class="tdr-sub" id="hudTrackSub">${TRACKS[0].subtitle}</div>
            <div class="tdr-badges">
              <div class="tdr-badge">64K // SINGLE-GL</div>
              <span class="tdr-size">${kb} / 64.0 KB</span>
              <span class="tdr-loop" id="hudLoop">LOOP</span>
              <svg class="tdr-reg" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4.5" fill="none" stroke="#f6f4ef" stroke-width="1.2"/><path d="M8 1v14M1 8h14" stroke="#f6f4ef" stroke-width="1.2"/></svg>
            </div>
          </div>
        </div>

        <div class="controls-bar">
          <button class="btn play-btn" id="btnPlay">PLAY</button>
          <button class="btn" id="btnMute">AUDIO ON</button>
          <input type="range" class="vol-sl" id="hudVol" min="0" max="100" value="84" aria-label="Volume">
          ${TRACKS.map((t, i) => `<button class="btn track-btn${i === 0 ? ' active' : ''}" data-track="${i}">${t.code} ${t.name.split(' ')[0]}</button>`).join('')}
        </div>
      </div>

      <div class="hud-bottom">
        <div class="karaoke-strip">
          <div class="karaoke-label">RACING LYRICS // SYNC</div>
          <div class="karaoke-text" id="hudLyric">SYSTEM READY</div>
          <div class="beat-row"><span class="beat-lap" id="hudLap">LAP 01</span>${beatSegs}</div>
        </div>

        <div class="telemetry-right">
          <div class="speed-box">
            <span class="speed-unit">KPH // PHANTOM</span>
            <span class="section-pill" id="hudSection">STANDBY</span>
          </div>
        </div>
      </div>

      ${introHtml()}
    `;

    this.eyeV = root.querySelector('#tdrEyeV');
    this.secEl = root.querySelector('#hudSection');
    this.subEl = root.querySelector('#hudTrackSub');
    this.lyricEl = root.querySelector('#hudLyric');
    this.lapEl = root.querySelector('#hudLap');
    this.loopEl = root.querySelector('#hudLoop');
    this.beatSegs = [...root.querySelectorAll('.beat-seg')];
    this.playBtn = root.querySelector('#btnPlay');
    this.muteBtn = root.querySelector('#btnMute');
    this.volEl = root.querySelector('#hudVol');
    this.overlay = root.querySelector('#startOverlay');
    startIntro(this.overlay, kb);
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

    this.volEl.addEventListener('input', () => {
      this.cb.onVolume(Number(this.volEl.value) / 100);
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

  setLoop(on) {
    this.loopEl.classList.toggle('on', on);
  }

  setTrackState(idx, playing, muted, vol) {
    const tr = TRACKS[idx];
    this.subEl.textContent = tr.subtitle;
    this.trackBtns.forEach((b, i) => b.classList.toggle('active', i === idx));
    this.playBtn.textContent = playing ? 'PAUSE' : 'PLAY';
    this.playBtn.classList.toggle('playing', playing);
    this.muteBtn.textContent = muted ? 'MUTED' : 'AUDIO ON';
    if (vol !== undefined) this.volEl.value = Math.round((muted ? 0 : vol) * 100);
  }

  update(music, ship) {
    // Only touch SVG DOM when beat-flash state actually changes!
    const flash = music.beatPulse > 0.34 || music.kick > 0.42 || (music.stabPulse || 0) > 0.45 || (music.accentTrigger || 0) > 0.45;
    if (flash !== this._lastFlash) {
      this._lastFlash = flash;
      this.eyeV.classList.toggle('flash', flash);
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
