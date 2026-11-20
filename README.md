# tDR // WIPEOUT-64K

**Title:** tDR // WIPEOUT-64K  
**Link:** https://tiendongle.github.io/wipeout-64k/  
**One-liner:** Zero-dependency `< 64 KB` interactive 3D WebGL2 & procedural Web Audio API Wipeout/demoscene racing visualizer with 8 synthesized vocal/cracktro tracks and smash-through holographic karaoke lyrics.  
**Built With:** Vanilla JavaScript (ES Modules), WebGL2 (GLSL 300 es, custom bloom, radial speed blur & SDF HUD), Web Audio API (5-rack procedural synthesizer & articulated formant vocoder), SVG/CSS3 (The Designers Republic poster HUD & cracktro intro), and a custom Node.js `deflate-raw` + Base122 self-extracting 64K HTML packer.

---

Interactive karaoke audio-reactive 3D visualizer inspired by **The Designers Republic**, **Wipeout 2097**, and early-2000s **64k demoscene** craft — packed into a single self-extracting `< 64 KB` HTML file ([dist/wipeout-64k.html](dist/wipeout-64k.html)).

## Architecture
- **Single WebGL2 Context** (`src/gl/renderer.js`, `src/gl/shaders.js`): Renders the 3D ray-projected Wipeout sunset sky & distant city skyline, striped racing track with 3-tier staggered speed boost pads (Blue / Green / Red) and jump chasms, trackside billboards, 3D anti-grav wedge craft with twin thruster beams, smash-through 3D holographic karaoke lyric banners (shattering on impact into 48 tumbling voxel tiles), quarter-res anamorphic bloom, cascaded radial zoom blur, GPU slice glitch, and a 4-digit 7-segment SDF KPH speed readout with GPU multiply blending.
- **tDR Poster + Cracktro Intro & HUD** (`src/ui/intro.js`, `src/ui/hud.js`, `src/style.css`): Translucent dark-glass Wipeout 2097 / tDR poster overlay framing the live attract-mode flight, modular SVG `wipEout 64K` stencil logotype with laser draw-in, block-ASCII spectrum & telemetry deck, duo-tone sine-wave scroller, and Ken Burns bloom burn-in launch transition.
- **Track & Physics** (`src/world/track.js`, `src/world/ship.js`): Mouse/touch X shapes oncoming track curvature smoothly; the ship autonomously banks and homes onto staggered speed boost pads with quadratic `v²` aerodynamic ground-effect downforce and elastic beat-locked kick/drop surges.
- **8-Track Procedural Web Audio Synthesizer & Articulated Formant Vocoder** (`src/audio/synth.js`, `src/audio/tracks.js`):
  1. **`01 ZERO FRICTION`** (`150 BPM`, Breakbeat / Neuro-Wobble Synthwave) — 808 sub-kicks, breakbeat snares, 24 dB/oct 1/8t-LFO talking bass, 5-voice stadium Supersaws, `±12c` dual-saw arps, 6-band pulse cyber-vocoder.
  2. **`02 OVERDRIVE`** (`145 BPM`, Heavy Metal / Industrial Darksynth) — palm-muted 4x12 metal guitar chugs, hard-clipping saw + sub-sine, industrial anvil & pitch-drop brass stabs, baritone metal vocoder & screaming guitar lead.
  3. **`03 TRACKER PROTOCOL`** (`160 BPM`, 16-Bit YM2612 Cracktro / J-Core) — 32nd-note YM2612 FM arps, dry 25%-duty pulse + FM slap bass, 90s arcade orchestra hits, 3-part harmonized soprano chip vocals.
  4. **`04 VECTOR MATRIX`** (`155 BPM`, Acid Techno) — screaming resonant TB-303 (`Q: 12–16.5`, accents & slides), Detroit minor-9th FM rave stabs, 6-osc TR-909 metallic ride, woody FM rave lead & 32nd-note stutter vocal chops.
  5. **`05 ANTI-GRAV DRIFT`** (`105 BPM`, Atmospheric Retrowave) — `~45 Hz` pumping sub-sine, 7-saw `0.2 Hz`-LFO pad into gated hall reverb, Juno/DX7 chorus Rhodes keys, 3-part harmonized pop-retrowave vocals & synth-sax fills.
  6. **`06 REPUBLIC GRAVITY`** (`128 BPM`, Electro Cracktro) — classic demoscene cracktro synth rack with pre-drop silence cutouts and breakdown chimes.
  7. **`07 NEON DESCENT`** (`140 BPM`, Driving Cracktro) — high-tempo arpeggiated cracktro sequence.
  8. **`08 GRAVITY WELL`** (`112 BPM`, Hypnotic Cracktro) — deep half-time demoscene cracktro groove.
- **64 KB Packed Artifact** (`scripts/pack.mjs`): State-machine JS/GLSL/CSS minifier + Zopfli-style `deflate-raw` + Base122 UTF-8 packer keeping `dist/wipeout-64k.html` strictly `< 65,536` bytes.

## Commands
```bash
npm run pack   # Build self-contained <64 KB dist/wipeout-64k.html
npm run dev    # Start local server at http://127.0.0.1:4173
```

## Controls
- **Mouse / Touch X**: Shape the oncoming track curves
- **Space**: Play / Pause synth
- **1 – 8**: Switch song tracks
- **L**: Toggle single-track loop vs. auto-playlist
- **G**: Trigger GPU slice glitch
- **M**: Mute / Unmute audio
