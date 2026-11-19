# tDR // WIPEOUT-64K

Interactive karaoke audio-reactive 3D visualizer inspired by **The Designers Republic**, **Wipeout**, and early-2000s **64k demoscene** craft.

- **Live Demo (GitHub Pages)**: https://tiendongle.github.io/wipeout-64k/ (serves the packed `< 64 KB` [dist/wipeout-64k.html](dist/wipeout-64k.html))

## Architecture
- **Single WebGL2 Context** (`src/gl/renderer.js`, `src/gl/shaders.js`): Renders the true 3D ray-projected Wipeout pink sunset sky & distant city skyline (zero curve warping), striped racing track + chevron barriers + glowing rails + ground-effect ship contact shadow, trackside billboards, redesigned 3D Wipeout wedge craft, 3D racing karaoke lyric banners, and continuous twin thruster beams into one MRT framebuffer (color + linear depth), followed by 2-pass half-res GPU bloom and full-res 16-tap Vogel-disk Depth of Field.
- **Track & Physics** (`src/world/track.js`, `src/world/ship.js`): Mouse/touch X shapes oncoming track curvature smoothly without warping existing geometry; rolling hills track music energy; the ship drives autonomously with strong ground-effect underpressure and elastic beat-locked kick/drop surges.
- **5-Engine Procedural Web Audio Synthesizer & Visual Sync Hooks** (`src/audio/synth.js`, `src/audio/tracks.js`):
  1. **`01 ZERO FRICTION`** (`150 BPM`, Breakbeat Synthwave) — 808 sub-kicks (`150→45 Hz`), breakbeat snares, 24 dB/oct 1/8t-LFO saw bass, `±12c` dual-saw arps, pulse formant vocal stabs (`bassEnergy`, `kickTrigger`, `leadFrequency`).
  2. **`02 OVERDRIVE`** (`145 BPM`, Heavy Industrial Darksynth) — hard-clipping saw + `40–80 Hz` sub-sine, `-6 dB` beat sidechain, distorted pitch-drop square brass stabs, ring-modulated robotic vocals (`subBassPunch`, `stabTriggers`).
  3. **`03 TRACKER PROTOCOL`** (`160 BPM`, 16-Bit Demoscene Cracktro) — 32nd-note YM2612 FM arps (index `4.0`), dry 25%-duty pulse bass, 16-bit PCM drums, formant square chip leads (`onStep(bar, note)` → retro wireframe track grid & CRT raster scanlines).
  4. **`04 VECTOR MATRIX`** (`155 BPM`, Acid Techno) — resonant TB-303 (`Q: 12–16`, `200 Hz–6 kHz` sweep, accents & slides), 909 kick/open-hats/claps, pitch-shifted formant vocal chops (`filterCutoffNormalized`, `accentTrigger` → curvature drive & radial speed blur).
  5. **`05 ANTI-GRAV DRIFT`** (`105 BPM`, Atmospheric Retrowave) — `~45 Hz` sidechained sub-sine, 7-detuned-saw pad with `0.2 Hz` LFO & `2.5s` gated stereo reverb, 707 kick/rimshots + gated 80s snare, airy sine-carrier vocal lead with dotted-8th delay (`padLFO`, `subBassEnvelope`).
- **64 KB Packed Artifact** (`scripts/pack.mjs`): Keeps `src/` unpacked and readable while packing `dist/wipeout-64k.html` strictly under 65,536 bytes (`~49 KB`).

## Commands
```bash
npm run pack   # Build self-contained <64 KB dist/wipeout-64k.html
npm run dev    # Start local server at http://127.0.0.1:4173
```

## Controls
- **Mouse / Touch X**: Shape the oncoming track curves
- **Space**: Play / Pause synth
- **1 – 5**: Switch song tracks
- **M**: Mute / Unmute audio
