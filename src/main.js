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

const hud = new Hud(hudRoot, {
  onStart: () => {
    synth.start(synth.trackIndex);
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted);
  },
  onTogglePlay: () => {
    synth.toggle();
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted);
  },
  onToggleMute: () => {
    synth.setMuted(!synth.muted);
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted);
  },
  onSelectTrack: (idx) => {
    loadTrackVisuals(idx);
    synth.setTrack(idx);
    if (!synth.playing) synth.start(idx);
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted);
  }
});

// Mouse / touch X shapes the oncoming track curvature smoothly (zero warping!)
function handlePointer(clientX) {
  const norm = (clientX / Math.max(1, window.innerWidth)) * 2 - 1;
  track.setMouseX(norm);
}

window.addEventListener('pointermove', (e) => handlePointer(e.clientX), { passive: true });
window.addEventListener('pointerdown', (e) => handlePointer(e.clientX), { passive: true });
window.addEventListener('resize', () => renderer.resize(), { passive: true });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    hud.overlay.classList.add('hidden');
    synth.toggle();
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted);
  } else if (e.key >= '1' && e.key <= String(TRACKS.length)) {
    const idx = Number(e.key) - 1;
    hud.overlay.classList.add('hidden');
    loadTrackVisuals(idx);
    synth.setTrack(idx);
    if (!synth.playing) synth.start(idx);
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted);
  } else if (e.key === 'm' || e.key === 'M') {
    synth.setMuted(!synth.muted);
    hud.setTrackState(synth.trackIndex, synth.playing, synth.muted);
  }
});

// Expose clean debug/visual-sync hook API for all 5 tracks
window.__WIPEOUT = {
  synth,
  track,
  ship,
  renderer,
  hud,
  hooks: synth.telemetry
};

// Idle demo lyric spawner when audio hasn't started yet so the scene is alive immediately
let idleLyricTimer = 0;
let idleWordIdx = 0;

let lastMs = performance.now();
function frame(nowMs) {
  const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastMs) * 0.001));
  lastMs = nowMs;
  const nowSec = nowMs * 0.001;

  const music = synth.update(dt, nowSec);

  if (!synth.playing) {
    idleLyricTimer += dt;
    if (idleLyricTimer > 1.35) {
      idleLyricTimer = 0;
      const words = TRACKS[synth.trackIndex].lyrics;
      renderer.spawnLyric(words[idleWordIdx++ % words.length], track.dist, 0.55);
    }
  }

  track.update(dt, music);
  ship.update(dt, track, music, nowSec);
  renderer.render(track, ship, music, TRACKS[synth.trackIndex], dt, nowSec);
  hud.update(music, ship);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
