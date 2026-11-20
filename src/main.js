// Main entry point: wires Web Audio synth, 3D spline track, ground-effect ship,
// single-WebGL2-context renderer, and tDR HUD.

import { TRACKS } from './audio/tracks.js';
import { SynthEngine } from './audio/synth.js';
import { Track } from './world/track.js';
import { Ship } from './world/ship.js';
import { Renderer } from './gl/renderer.js';
import { Hud } from './ui/hud.js';

const canvas = document.getElementById('gl');
const hudRoot = document.getElementById('hud');

const synth = new SynthEngine();
const track = new Track();
const ship = new Ship();
const renderer = new Renderer(canvas);

function loadTrackVisuals(idx) {
  const tr = TRACKS[idx];
  renderer.setTrackLyrics(tr.lyrics, tr.accentColor);
}
loadTrackVisuals(0);

synth.onLyric = (word, energy) => {
  renderer.spawnLyric(word, track.dist, energy);
};

// Track 3 visual sync hook: frame-accurate step callback drives retro vector raster pulse!
synth.onStep = () => {
  if (synth.telemetry.rasterMode > 0.5) {
    renderer.triggerStepPulse();
  }
};

// Spatial rhythm synchronization:
// - Speed Pads on track = KICK beats (ship crosses pad right on beat -> surges forward!)
// - Trackside Billboards & Arch Gantries = SNARE / CLAP backbeats & STABS
// - Disconnected Track Jump / Drop = BIG DROPS & high-energy chorus entries!
function predictTrackSpeed(energy, isDrop) {
  const target = 96 + energy * 74 + (isDrop ? 18 : 0) + ship.catchUp * 34;
  return track.speed * 0.62 + target * 0.38;
}

synth.onSpeedPad = (dtAhead, isDrop, energy) => {
  const worldS = ship.worldS + predictTrackSpeed(energy, isDrop) * dtAhead;
  track.spawnSpeedPad(worldS, 0, isDrop ? 1.0 : energy);
};

synth.onBillboard = (dtAhead, isGantry, energy) => {
  const worldS = ship.worldS + predictTrackSpeed(energy, 0) * dtAhead;
  if (!track.isInGap(worldS)) {
    renderer.spawnBillboard(worldS, isGantry);
  }
};

synth.onJump = (dtAhead, isMega, energy) => {
  const worldS = ship.worldS + predictTrackSpeed(energy, isMega) * dtAhead;
  const j = track.scheduleJump(worldS, isMega);
  if (j) {
    // Frame the landing runway touchdown zone with an iconic Wipeout overhead arch gantry!
    renderer.spawnBillboard(j.landS + 34.0, 1);
  }
};

synth.onTrackEnd = () => {
  const next = (synth.trackIndex + 1) % TRACKS.length;
  loadTrackVisuals(next);
  synth.setTrack(next);
  hud.setTrackState(synth.trackIndex, synth.playing, synth.muted);
};

// Seed initial attract-mode speed pads & billboards ahead before audio starts
for (let i = 1; i <= 6; i++) {
  track.spawnSpeedPad(ship.worldS + i * 58, 0);
  renderer.spawnBillboard(ship.worldS + i * 58 - 26, i % 3 === 0 ? 1 : 0);
}

function triggerIntroLaunch() {
  renderer.introMode = false;
  renderer.triggerLaunch();
  ship.padBurst = 2;
  ship.surgeVel = Math.max(ship.surgeVel || 0, 58);
}

const hud = new Hud(hudRoot, {
  onStart: () => {
    triggerIntroLaunch();
    synth.start(synth.trackIndex);
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted);
  },
  onTogglePlay: () => {
    triggerIntroLaunch();
    synth.toggle();
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted);
  },
  onToggleMute: () => {
    synth.setMuted(!synth.muted);
    if (!synth.muted && synth.volume < 0.05) synth.setVolume(0.84);
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted, synth.volume);
  },
  onVolume: (v) => {
    synth.setVolume(v);
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted);
  },
  onSelectTrack: (idx) => {
    triggerIntroLaunch();
    loadTrackVisuals(idx);
    synth.setTrack(idx);
    if (!synth.playing) synth.start(idx);
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted);
  }
});

// Mouse & mobile touch X shape the oncoming track curvature smoothly (zero warping!)
function handlePointer(clientX) {
  const norm = (clientX / Math.max(1, window.innerWidth)) * 2 - 1;
  track.setMouseX(norm);
}

function isHudButton(e) {
  return !!(e.target && e.target.closest && e.target.closest('button,input'));
}

window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' && isHudButton(e)) return;
  handlePointer(e.clientX);
}, { passive: true });

window.addEventListener('pointerdown', (e) => {
  if (isHudButton(e)) return;
  handlePointer(e.clientX);
}, { passive: true });

// Dedicated touchstart/touchmove/touchend for rock-solid iOS Safari & Android Chrome steering
canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length > 0) {
    e.preventDefault();
    handlePointer(e.touches[0].clientX);
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length > 0) {
    e.preventDefault();
    handlePointer(e.touches[0].clientX);
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  if (e.touches.length === 0) track.setMouseX(0);
}, { passive: true });

canvas.addEventListener('touchcancel', () => track.setMouseX(0), { passive: true });
window.addEventListener('resize', () => renderer.resize(), { passive: true });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!hud.overlay.classList.contains('hidden')) triggerIntroLaunch();
    hud.overlay.classList.add('hidden');
    synth.toggle();
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted);
  } else if (e.key >= '1' && e.key <= String(TRACKS.length)) {
    const idx = Number(e.key) - 1;
    if (!hud.overlay.classList.contains('hidden')) triggerIntroLaunch();
    hud.overlay.classList.add('hidden');
    loadTrackVisuals(idx);
    synth.setTrack(idx);
    if (!synth.playing) synth.start(idx);
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted);
  } else if (e.key === 'm' || e.key === 'M') {
    synth.setMuted(!synth.muted);
    if (!synth.muted && synth.volume < 0.05) synth.setVolume(0.84);
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted, synth.volume);
  } else if (e.key === 'g' || e.key === 'G') {
    renderer.glitchOn = !renderer.glitchOn;
  } else if (e.key === 'l' || e.key === 'L') {
    synth.loopTrack = !synth.loopTrack;
    hud.setLoop(synth.loopTrack);
  }
});

/*DEV_START*/
// Lightweight frame-time telemetry for verifying smooth stutter-free performance
const perf = {
  frames: 0,
  jankCount: 0,
  avgMs: 16.6,
  maxMs: 0,
  fps: 60,
  _ring: new Float32Array(120),
  _idx: 0,
  reset() {
    this.frames = 0; this.jankCount = 0; this.maxMs = 0; this._idx = 0;
  }
};

// Expose clean debug/visual-sync hook API for all 5 tracks
window.__WIPEOUT = {
  synth,
  track,
  ship,
  renderer,
  hud,
  perf,
  hooks: synth.telemetry
};
/*DEV_END*/

// Idle demo spawner when audio hasn't started yet so the scene is alive immediately
let idleLyricTimer = 0;
let idleWordIdx = 0;
let idleBeatTimer = 0;
let idleBeatIdx = 0;

let lastMs = performance.now();
function frame(nowMs) {
  const rawMs = nowMs - lastMs;
  lastMs = nowMs;
  const dt = Math.min(0.05, Math.max(0.001, rawMs * 0.001));
  const nowSec = nowMs * 0.001;

  /*DEV_START*/
  if (rawMs > 0 && rawMs < 250) {
    perf._ring[perf._idx] = rawMs;
    perf._idx = (perf._idx + 1) % 120;
    perf.frames++;
    if (rawMs > 34) perf.jankCount++;
    if (perf.frames > 10 && rawMs > perf.maxMs) perf.maxMs = rawMs;
    if ((perf.frames & 15) === 0) {
      const n = Math.min(perf.frames, 120);
      let sum = 0;
      for (let i = 0; i < n; i++) sum += perf._ring[i];
      perf.avgMs = +(sum / n).toFixed(2);
      perf.fps = +(1000 / Math.max(1, perf.avgMs)).toFixed(1);
      if (location.hash === '#perf') {
        document.title = `FPS:${perf.fps} AVG:${perf.avgMs}ms MAX:${perf.maxMs.toFixed(1)}ms JANK:${perf.jankCount}/${perf.frames} RES:${renderer.width}x${renderer.height}`;
      }
    }
  }
  /*DEV_END*/

  const music = synth.update(dt, nowSec);

  if (!synth.playing) {
    // High-velocity attract-mode overdrive while intro poster is active!
    if (renderer.introMode) {
      music.energy = 0.88 + 0.12 * Math.sin(nowSec * 2.2);
      music.kick = Math.pow(Math.max(0, Math.sin(nowSec * Math.PI * 2.4)), 6.0);
      music.beatPulse = Math.max(music.beatPulse, music.kick);
    }
    idleLyricTimer += dt;
    if (idleLyricTimer > 1.35) {
      idleLyricTimer = 0;
      const words = TRACKS[synth.trackIndex].lyrics;
      renderer.spawnLyric(words[idleWordIdx++ % words.length], track.dist, 0.85);
    }
    idleBeatTimer += dt;
    if (idleBeatTimer > 0.52) {
      idleBeatTimer = 0;
      const bi = idleBeatIdx++;
      if (bi % 2 === 0) {
        track.spawnSpeedPad(ship.worldS + 260, 0);
        if (renderer.introMode && bi % 4 === 0) {
          ship.padBurst = 1;
          ship.surgeVel = Math.max(ship.surgeVel || 0, 34);
        }
      } else {
        renderer.spawnBillboard(ship.worldS + 265, bi % 6 === 1 ? 1 : 0);
      }
    }
  }

  track.setShipClearance(ship.hoverH);
  track.update(dt, music, ship.catchUp);
  ship.update(dt, track, music, nowSec);
  renderer.render(track, ship, music, TRACKS[synth.trackIndex], dt, nowSec);
  hud.update(music, ship);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
