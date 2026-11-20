# Wipeout-64K — Project Memory & Context Reference

> **Purpose**: Compact, living project reference to keep context lightweight across sessions. Update this file whenever architecture, features, or constraints change.
> **Last Updated**: 2026-11-20 (HEAD `9db11ad`)

---

## 1. Project Overview & Hard Constraints
- **Workspace**: `f:\Development\wipeout-64k`
- **GitHub Repo**: `https://github.com/Tiendongle/wipeout-64k` (`origin/main`)
- **Live GitHub Pages**: `https://tiendongle.github.io/wipeout-64k/` (auto-deploys via `.github/workflows/pages.yml` running `node scripts/pack.mjs` on Node 22)
- **Local Dev Server**: `node f:/Development/wipeout-64k/scripts/dev-server.mjs` → `http://127.0.0.1:4173/dist/wipeout-64k.html`
- **Hard Constraints**:
  - **100% Zero-Dependency** runtime AND build/packer (`scripts/pack.mjs` uses only Node built-ins).
  - **Strict 64 KB Budget**: `dist/wipeout-64k.html` must stay `< 65,536` bytes.
    - Current size: **`65,518 / 65,536` bytes** (`100.0%`, **18 bytes free**).
  - **Performance**: Single WebGL2 context, zero per-frame allocations, locked 60–75+ FPS on desktop & mobile.

---

## 2. Architecture & Module Map
Bundled in topological order by [scripts/pack.mjs](file:///f:/Development/wipeout-64k/scripts/pack.mjs) (state-machine JS+GLSL minifier + `deflate-raw` + Base122 UTF-8 self-extracting HTML):

| File | Responsibility |
| :--- | :--- |
| `src/audio/tracks.js` | 8 procedural tracks (`TRACKS`), `P()` pattern strings, `splitLyricChunks()`, `E()`/`R()` timed-lyric helpers, and full timestamped lyrics for Tracks 01–05. |
| `src/audio/synth.js` | `SynthEngine` — pure Web Audio API 5-rack genre synthesizer + articulated phoneme vocoder (Tracks 01–05), exact cracktro step scheduler `_scheduleCracktroStep()` (Tracks 06–08), circular event queue `_evQ`, elapsed-time lyric scheduler, and real-time FFT/sub-bass telemetry. `renderOffline()` is wrapped in `/*DEV_START*/.../*DEV_END*/` and stripped from the 64K build. |
| `src/world/track.js` | Procedural 3D spline track with mouse/touch steering, kick-synced horizontally staggered & variable-width speed pads (`w` in `0.20..0.72`, `u` clamped to `±(0.76 - w)`) in 3 boost tiers (`0`=Blue slowest, `1`=Green faster, `2`=Red fastest), disconnected jump chasms, and crest-free 52-segment jump landing/stabilization runway (`_yOffset` exact re-anchor). |
| `src/world/ship.js` | Autonomous ground-effect anti-grav craft with thrust surge, banking, launch arcs, **speed-pad lateral homing steering** (lines up and hits every upcoming staggered speed pad within 92u), and **quadratic aerodynamic downforce** (`(effSpeed / 120)²`) over non-ramp solid road so crests stay planted at high speed. |
| `src/gl/glUtils.js` | Minimal WebGL2 shader/FBO/matrix helpers (unused helpers pruned). |
| `src/gl/shaders.js` | All GLSL 300 es shaders: track/sky/cityscape, ship/thrusters, RGB-channel holographic karaoke lyrics (`QUAD_FS` with `uLyricMode`), additive sparks, selective neon-biased bloom extract/blur, and cascaded radial zoom blur + GPU `G`-key slice glitch + **4-digit WebGL2 `sdKph` 7-segment capsule SDF speed readout (`0..9999 KPH`)** with true GPU multiply interior, glowing hollow neon rim, bloom halo, and radial speed-blur trail. |
| `src/gl/geometry.js` | Procedural craft mesh & track geometry builders. |
| `src/gl/textures.js` | Procedural billboard atlas (`createBillboardAtlas`) + high-contrast RGB-channel lyric atlas (`createLyricAtlas`, `320×112` cells, 8 cols when >32 chunks: `B`=dark outer casing, `R`=neon outline, `G`=solid fill core). |
| `src/gl/renderer.js` | Single-context WebGL2 renderer: scene FBO + quarter-res bloom FBOs, smooth rolling-baseline `_baseKph` radial blur ramp (+ subtle floor >780 KPH), 256-quad dynamic buffer, 96-spark pool, and **48-tile (`12×4`) voxel smash-through lyric shatter** flying into the camera. |
| `src/ui/intro.js` | Translucent dark-glass Wipeout 2097 / tDR poster + cracktro intro overlay (`introHtml`, `startIntro`): custom modular SVG `wipEout 64K` capsule-stencil logotype with duo-tone chromatic layers & laser draw-in, oversized top-left tDR emblem cropped slightly outside the frame, SVG+ASCII radial targeting reticle over the live 3D vanishing point, 20-band block-ASCII (`▁▂▃▄▅▆▇█` / `█░`) spectrum & telemetry matrix (`34 chars` max), compact `36-char` typewriter `.NFO`, proportionally kerned duo-tone sine scroller, angled `-32deg` tDR bottom bar dock, 7-digit counter, periodic 10s slice-glitch burst, staggered entrance animations (`@keyframes inIn`), and Ken Burns glitch-out + bloom burn-in launch transition (`renderer.triggerLaunch()`). |
| `src/ui/hud.js` | The Designers Republic (tDR) HUD: unboxed larger top-left tDR SVG emblem + metadata blended (`mix-blend-mode: hard-light` / `multiply`) with uncropped chromatic glitch animation, top-right unboxed outlined sound/track controls (`mix-blend-mode: screen`) with `#hudVol` volume slider, bottom-left `#hudLyric` + `LAP` bar, and bottom-right flush cyan/red `KPH // PHANTOM` + `#hudSection` box beneath the WebGL2 `sdKph` speed readout. |
| `src/style.css` | Full responsive desktop + mobile (`viewport-fit=cover` + `safe-area-inset-*`) styling with dedicated 18px bottom `.greetz-bar` lane, 8px clearance below `.hud-bottom`, and unified dark-glass tDR poster intro styles (hiding `.hud-top`/`.hud-bottom` while `#startOverlay` is open). |
| `src/main.js` | Entry point wiring `SynthEngine`, `Track`, `Ship`, `Renderer`, `Hud`, keyboard (`1–8`, `Space`, `M`, `G`, `L`), pointer/touch controls, and `window.__WIPEOUT` debug hooks. |

---

## 3. Music & Karaoke System (8 Tracks)
- **Auto-Playlist**: Tracks auto-advance via `synth.onTrackEnd` unless `L` (`loopTrack`) is toggled on.
- **Tracks 01–05 (Full Timed Lyrics + Chunked 3D Banners)**:
  - Each track defines `trackDur` and `timedLyrics: [[startSec, durSec, text], ...]`.
  - `_getTrackTotalBars()` extends playback to cover the full ~157–175 s timeline; `#hudLyric` shows the full line at exact `[startSec, startSec + durSec]` (clearing to `—` in gaps), while `splitLyricChunks()` spawns 1–2 word 3D holographic banners spaced across each line's duration.
  1. `01 ZERO FRICTION` — 150 BPM Breakbeat / Neuro-Wobble Synthwave (`169s`, 42 lines, 44 atlas chunks)
  2. `02 OVERDRIVE` — 145 BPM Heavy Metal / Industrial Darksynth (`157s`, 36 lines, 79 atlas chunks)
  3. `03 TRACKER PROTOCOL` — 160 BPM 16-Bit YM2612 Cracktro / J-Core (`170s`, 15 lines, 24 atlas chunks)
  4. `04 VECTOR MATRIX` — 155 BPM Resonant TB-303 Acid Techno (`175s`, 10 lines, 21 atlas chunks)
  5. `05 ANTI-GRAV DRIFT` — 105 BPM Atmospheric Retrowave (`174s`, 22 lines, 38 atlas chunks)
- **Tracks 06–08 (Exact Cracktro Mode — `mode: 'cracktro'`)**:
  - Driven by `_scheduleCracktroStep()` with pre-drop 2-step silence cutout + white drop flash, breakdown chimes, and word-array `tr.lyrics`:
  6. `06 REPUBLIC GRAVITY` — 128 BPM Electro Cracktro
  7. `07 NEON DESCENT` — 140 BPM Driving Cracktro
  8. `08 GRAVITY WELL` — 112 BPM Hypnotic Cracktro

---

## 4. Visuals & Physics Highlights
- **3D Smash-Through Lyrics**:
  - Centered across the racing lane (`lat = -1.4 / 0 / +1.4`, `height = 3.25`), giant `9.8 × 3.45` half-extents.
  - Distant (`>76` units): crisp dark-cased hollow neon outline (bloom-safe `1.04×` / `1.08×` multipliers).
  - Approaching (`76 → 20` units): sweeps left-to-right filling in right before impact.
  - Impact (`l.s <= ship.worldS + 3.5`): triggers a 24-spark burst off the ship's nose and shatters into **48 (`12×4`) tumbling voxel tiles** hurtling backward into and past the camera lens.
- **Track & Ship Physics**:
  - Jump landings use a guaranteed crest-free 52-segment catch/flat/re-anchor runway.
  - Quadratic `v²` ground-effect downforce keeps the craft hugged to non-ramp crests at high speeds.
  - Temporary trackside pylon beacons were removed (`f6a36cf`) — open slot for a future replacement feature.

---

## 5. Build, Verification & Known Gotchas
- **Pack command**: `node f:/Development/wipeout-64k/scripts/pack.mjs` (validates JS syntax via `new Function`, Base122 round-trip, and `< 65,536` B limit).
- **Windows PowerShell**: Use `;` (not `&&`) to chain commands.
- **CSS Minifier Gotcha**: Never strip spaces around `+` in `minifyCss()` (`scripts/pack.mjs`), or `calc(X + env(...))` becomes invalid CSS and gets dropped by browsers!
- **Git Push in Sandbox**: `git add`/`commit` run sandboxed; `git push origin main` requires `BypassSandbox: true` if sandbox DNS blocks GitHub.
- **Browser Verification**: `webview_browser` runs without `page.evaluate`; verify via live reload, keyboard shortcuts (`1–8`, `L`, `G`, `M`), DOM bounds, console error check, and screenshots.

---

## 6. Recent Commit Log
- `9db11ad` — Upgrade lyric smash-through to 48 tumbling voxel tiles flying into camera
- `3c59a5d` — Add smash-through 4-shard 3D lyric shatter, delayed fill-in & larger track text
- `822a154` — Fix HUD/ticker overlap (`calc()` minifier) & boost 3D lyric size and outline fill-in
- `6abc498` — Add full timestamped karaoke lyrics for Tracks 01–05
- `cb7e523` — Scale ground-effect downforce quadratically with speed (`v²`) over non-ramp crests
- `bb6643f` — Exact cracktro scheduler (Tracks 06–08), RGB karaoke lyrics, auto-playlist + `L` loop, drop flash, greetz & crest downforce
- `f6a36cf` — Remove trackside pylon beacons and HUD toggle
- `988b69f` — Guarantee crest-free jump landing & stabilization runway
