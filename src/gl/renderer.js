// Single-WebGL2-context renderer:
// Sky/City + Track/Chevrons + Billboards + 3D Ship + Racing Lyrics + Continuous Beams
// followed by GPU Bloom + 16-tap Vogel-disk Depth of Field in one context.

import {
  createProgram,
  createSceneFBO,
  createSimpleFBO,
  destroyFBO,
  mat4Perspective,
  mat4LookAtBasis,
  mat4FromBasis
} from './glUtils.js';
import {
  SKY_VS, SKY_FS,
  TRACK_VS, TRACK_FS,
  SHIP_VS, SHIP_FS,
  BEAM_VS, BEAM_FS,
  QUAD_VS, QUAD_FS,
  POST_VS, BLOOM_EXTRACT_FS, BLUR_FS, DOF_COMPOSITE_FS
} from './shaders.js';
import {
  buildShipMesh,
  TRACK_MAX_FLOATS, TRACK_FLOATS_PER_VERT, writeTrackGeometry,
  BEAM_MAX_FLOATS, BEAM_FLOATS_PER_VERT, writeBeamGeometry
} from './geometry.js';
import { createBillboardAtlas, createLyricAtlas } from './textures.js';
import { TRACK_HALF_WIDTH, AHEAD_SEGS, SEG_LEN } from '../world/track.js';

const MAX_DEPTH = 410.0;
const FOV_RAD = (64 * Math.PI) / 180;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      powerPreference: 'high-performance'
    });
    if (!gl) throw new Error('WebGL2 is required');
    this.gl = gl;

    this.width = 1;
    this.height = 1;
    this.isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    // Compile all shaders in this single WebGL2 context
    this.skyProg = createProgram(gl, SKY_VS, SKY_FS);
    this.trackProg = createProgram(gl, TRACK_VS, TRACK_FS);
    this.shipProg = createProgram(gl, SHIP_VS, SHIP_FS);
    this.beamProg = createProgram(gl, BEAM_VS, BEAM_FS);
    this.quadProg = createProgram(gl, QUAD_VS, QUAD_FS);
    this.bloomExtProg = createProgram(gl, POST_VS, BLOOM_EXTRACT_FS);
    this.blurProg = createProgram(gl, POST_VS, BLUR_FS);
    this.dofProg = createProgram(gl, POST_VS, DOF_COMPOSITE_FS);

    // Cache ALL uniform locations ONCE (eliminates ~50 gl.getUniformLocation calls per frame!)
    const loc = (p, names) => {
      const m = {};
      for (const n of names) m[n] = gl.getUniformLocation(p, n);
      return m;
    };
    this.u = {
      sky: loc(this.skyProg, ['uAspect', 'uTanHalfFov', 'uWorldYaw', 'uCamRight', 'uCamUp', 'uCamForward', 'uBeat', 'uTime']),
      track: loc(this.trackProg, ['uView', 'uProj', 'uBeat', 'uAccent', 'uMaxDepth', 'uShipPos', 'uStabFlash', 'uRasterMode', 'uStepPulse', 'uTime', 'uPads[0]']),
      quad: loc(this.quadProg, ['uView', 'uProj', 'uMaxDepth', 'uAlphaCut', 'uTex']),
      ship: loc(this.shipProg, ['uModel', 'uView', 'uProj', 'uCamPos', 'uBeamColor', 'uThrust', 'uMaxDepth']),
      beam: loc(this.beamProg, ['uView', 'uProj', 'uBeamColor', 'uIntensity', 'uTime', 'uMaxDepth']),
      bloomExt: loc(this.bloomExtProg, ['uScene']),
      blur: loc(this.blurProg, ['uTex', 'uDir']),
      dof: loc(this.dofProg, ['uScene', 'uDepth', 'uBloom', 'uTexel', 'uFocusDepth', 'uDofStrength', 'uBloomStrength', 'uSpeedBlur', 'uRasterMode', 'uStepPulse', 'uTime', 'uAccent'])
    };
    this._tanHalfFov = Math.tan(FOV_RAD * 0.5);
    this._padData = new Float32Array(32);

    // Empty VAO for fullscreen triangle passes
    this.emptyVao = gl.createVertexArray();

    // --- Ship static VAO/VBO ---
    const shipVerts = buildShipMesh();
    this.shipVertCount = shipVerts.length / 10;
    this.shipVao = gl.createVertexArray();
    this.shipVbo = gl.createBuffer();
    gl.bindVertexArray(this.shipVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shipVbo);
    gl.bufferData(gl.ARRAY_BUFFER, shipVerts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 40, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 40, 36);

    // --- Track dynamic VAO/VBO ---
    this.trackBuf = new Float32Array(TRACK_MAX_FLOATS);
    this.trackVao = gl.createVertexArray();
    this.trackVbo = gl.createBuffer();
    gl.bindVertexArray(this.trackVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trackVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.trackBuf.byteLength, gl.DYNAMIC_DRAW);
    const tStride = TRACK_FLOATS_PER_VERT * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, tStride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, tStride, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, tStride, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, tStride, 32);

    // --- Continuous Thruster Beams dynamic VAO/VBO ---
    this.beamBuf = new Float32Array(BEAM_MAX_FLOATS);
    this.beamVao = gl.createVertexArray();
    this.beamVbo = gl.createBuffer();
    gl.bindVertexArray(this.beamVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.beamVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.beamBuf.byteLength, gl.DYNAMIC_DRAW);
    const bStride = BEAM_FLOATS_PER_VERT * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, bStride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, bStride, 12);

    // --- Dynamic Quads VAO/VBO (shared for billboards & racing lyric banners) ---
    // Format: [x, y, z, u, v, glow] (6 floats per vert, up to 120 quads)
    this.quadBuf = new Float32Array(120 * 6 * 6);
    this.quadVao = gl.createVertexArray();
    this.quadVbo = gl.createBuffer();
    gl.bindVertexArray(this.quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.quadBuf.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 20);
    gl.bindVertexArray(null);

    // Pre-baked GPU textures
    this.billboardAtlas = createBillboardAtlas(gl);
    this.lyricAtlas = null;

    // Active racing 3D lyric words & snare/stab-synced billboards flying along the track
    this.activeLyrics = [];
    this._lyricLaneToggle = 0;
    this.billboards = [];
    this._bbSideToggle = 0;
    this._bbDesignIdx = 0;

    // Matrices
    this.projMat = new Float32Array(16);
    this.viewMat = new Float32Array(16);
    this.shipModelMat = new Float32Array(16);

    // FBOs
    this.sceneFbo = null;
    this.bloomFboA = null;
    this.bloomFboB = null;

    // Reusable sample scratch
    this._tmpSample = {};

    // Track 3 onStep pulse decay state & smoothed speed-surge filter
    this.stepPulse = 0;
    this._speedFilter = 0;

    this.resize();
  }

  triggerStepPulse() {
    this.stepPulse = 1.0;
  }

  setTrackLyrics(words, accentHex) {
    const gl = this.gl;
    if (this.lyricAtlas && this.lyricAtlas.tex) {
      gl.deleteTexture(this.lyricAtlas.tex);
    }
    this.lyricAtlas = createLyricAtlas(gl, words, accentHex);
    this.activeLyrics.length = 0;
  }

  spawnLyric(word, trackDist, energy) {
    if (!this.lyricAtlas || !this.lyricAtlas.map.has(word)) return;
    const lanePick = this._lyricLaneToggle++ % 3;
    // Alternate left, overhead-center, right racing lanes
    const lat = lanePick === 0 ? -5.8 : lanePick === 1 ? 0.0 : 5.8;
    const height = lanePick === 1 ? 5.6 : 3.4;
    this.activeLyrics.push({
      word,
      s: trackDist + 210.0,
      lat,
      height,
      speedRatio: 0.26 + energy * 0.14, // flies forward along track as if racing
      bornEnergy: energy
    });
    if (this.activeLyrics.length > 18) {
      this.activeLyrics.shift();
    }
  }

  resize() {
    const gl = this.gl;
    const dprCap = this.isMobile ? 1.25 : 1.5;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    let w = Math.max(2, Math.floor(window.innerWidth * dpr));
    let h = Math.max(2, Math.floor(window.innerHeight * dpr));
    // Cap internal fillrate at ~1080p pixel budget so 4K/Retina screens stay locked at 60-120 FPS
    const maxPixels = this.isMobile ? 1100000 : 2073600;
    if (w * h > maxPixels) {
      const s = Math.sqrt(maxPixels / (w * h));
      w = Math.max(2, Math.floor(w * s));
      h = Math.max(2, Math.floor(h * s));
    }
    if (w === this.width && h === this.height && this.sceneFbo) return;

    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;

    destroyFBO(gl, this.sceneFbo);
    destroyFBO(gl, this.bloomFboA);
    destroyFBO(gl, this.bloomFboB);

    this.sceneFbo = createSceneFBO(gl, w, h);
    // Quarter-res bloom FBOs: 4x faster GPU bandwidth & smoother halo!
    const bw = Math.max(2, w >> 2);
    const bh = Math.max(2, h >> 2);
    this.bloomFboA = createSimpleFBO(gl, bw, bh);
    this.bloomFboB = createSimpleFBO(gl, bw, bh);

    mat4Perspective(this.projMat, FOV_RAD, w / h, 0.5, MAX_DEPTH + 40);
  }

  _pushQuad(buf, o, cx, cy, cz, rx, ry, rz, ux, uy, uz, halfW, halfH, u0, v0, u1, v1, glow) {
    const rwx = rx * halfW, rwy = ry * halfW, rwz = rz * halfW;
    const uhx = ux * halfH, uhy = uy * halfH, uhz = uz * halfH;

    const blx = cx - rwx - uhx, bly = cy - rwy - uhy, blz = cz - rwz - uhz;
    const brx = cx + rwx - uhx, bry = cy + rwy - uhy, brz = cz + rwz - uhz;
    const trx = cx + rwx + uhx, try_ = cy + rwy + uhy, trz = cz + rwz + uhz;
    const tlx = cx - rwx + uhx, tly = cy - rwy + uhy, tlz = cz - rwz + uhz;

    buf[o++] = blx; buf[o++] = bly; buf[o++] = blz; buf[o++] = u0; buf[o++] = v1; buf[o++] = glow;
    buf[o++] = brx; buf[o++] = bry; buf[o++] = brz; buf[o++] = u1; buf[o++] = v1; buf[o++] = glow;
    buf[o++] = trx; buf[o++] = try_; buf[o++] = trz; buf[o++] = u1; buf[o++] = v0; buf[o++] = glow;
    buf[o++] = blx; buf[o++] = bly; buf[o++] = blz; buf[o++] = u0; buf[o++] = v1; buf[o++] = glow;
    buf[o++] = trx; buf[o++] = try_; buf[o++] = trz; buf[o++] = u1; buf[o++] = v0; buf[o++] = glow;
    buf[o++] = tlx; buf[o++] = tly; buf[o++] = tlz; buf[o++] = u0; buf[o++] = v0; buf[o++] = glow;
    return o;
  }

  spawnBillboard(worldS, isGantry = 0) {
    // Avoid overlapping two billboards on top of each other
    for (let i = 0; i < this.billboards.length; i++) {
      if (Math.abs(this.billboards[i].s - worldS) < 16.0) return;
    }
    const side = (this._bbSideToggle++ % 2 === 0) ? -1 : 1;
    const designIdx = this._bbDesignIdx++ % this.billboardAtlas.count;
    this.billboards.push({ s: worldS, gantry: isGantry ? 1 : 0, side, designIdx });
    if (this.billboards.length > 26) this.billboards.shift();
  }

  _buildBillboards(track, ship, music) {
    const minS = track.dist - 8.0;
    const maxS = track.dist + AHEAD_SEGS * SEG_LEN - 12.0;
    const { cols, rows } = this.billboardAtlas;
    let o = 0;
    const fr = this._tmpSample;

    // Snare / backbeat / stab neon glow sync (distinct rhythmic channel from kick Speed Pads!)
    const beatGlow = (music.snare || 0) * 0.62 + (music.stabPulse || 0) * 0.82 + (music.accentTrigger || 0) * 0.72;

    for (let i = this.billboards.length - 1; i >= 0; i--) {
      if (this.billboards[i].s < minS) this.billboards.splice(i, 1);
    }

    for (let i = 0; i < this.billboards.length; i++) {
      const bb = this.billboards[i];
      if (bb.s > maxS) continue;
      if (o + 36 > this.quadBuf.length) break;
      track.sampleAt(bb.s, fr);

      const col = bb.designIdx % cols;
      const row = Math.floor(bb.designIdx / cols);
      const u0 = col / cols, u1 = (col + 1) / cols;
      const v0 = row / rows, v1 = (row + 1) / rows;

      // Bright pass-by surge right as the craft rockets past on the snare/stab beat!
      const passGlow = Math.exp(-Math.abs(bb.s - ship.worldS) * 0.055) * 0.92;
      const glow = (bb.gantry ? 0.14 : 0.08) + beatGlow + passGlow;

      if (bb.gantry) {
        o = this._pushQuad(
          this.quadBuf, o,
          fr.x + fr.ux * 9.8, fr.y + fr.uy * 9.8, fr.z + fr.uz * 9.8,
          fr.rx, fr.ry, fr.rz, fr.ux, fr.uy, fr.uz,
          9.6, 2.35, u0, v0, u1, v1, glow
        );
      } else {
        const side = bb.side;
        const offsetOut = side * (TRACK_HALF_WIDTH + 4.4);
        const toe = side * 0.28;
        const ct = Math.cos(toe), st = Math.sin(toe);
        o = this._pushQuad(
          this.quadBuf, o,
          fr.x + fr.rx * offsetOut + fr.ux * 4.2,
          fr.y + fr.ry * offsetOut + fr.uy * 4.2,
          fr.z + fr.rz * offsetOut + fr.uz * 4.2,
          fr.rx * ct - fr.fx * st, fr.ry * ct - fr.fy * st, fr.rz * ct - fr.fz * st,
          fr.ux, fr.uy, fr.uz,
          4.8, 2.4, u0, v0, u1, v1, glow
        );
      }
    }
    return o / 6;
  }

  _buildLyrics(track, ship, dt) {
    if (!this.lyricAtlas) return 0;
    let o = 0;
    const fr = this._tmpSample;

    for (let i = this.activeLyrics.length - 1; i >= 0; i--) {
      const l = this.activeLyrics[i];
      l.s += track.speed * l.speedRatio * dt;
      if (l.s < track.dist - 6.0) {
        this.activeLyrics.splice(i, 1);
      }
    }

    if (this.activeLyrics.length > 1) {
      this.activeLyrics.sort((a, b) => b.s - a.s);
    }

    for (let i = 0; i < this.activeLyrics.length; i++) {
      const l = this.activeLyrics[i];
      if (o + 36 > this.quadBuf.length) break;
      const uv = this.lyricAtlas.map.get(l.word);
      if (!uv) continue;
      if (l.s > track.dist + AHEAD_SEGS * SEG_LEN - 10) continue;

      track.sampleAt(l.s, fr);
      const distToShip = Math.abs(l.s - ship.worldS);
      const glow = Math.max(0.15, Math.exp(-distToShip * 0.045) * 1.15);

      o = this._pushQuad(
        this.quadBuf, o,
        fr.x + fr.rx * l.lat + fr.ux * l.height,
        fr.y + fr.ry * l.lat + fr.uy * l.height,
        fr.z + fr.rz * l.lat + fr.uz * l.height,
        fr.rx, fr.ry, fr.rz, fr.ux, fr.uy, fr.uz,
        4.6, 1.72, uv.u0, uv.v0, uv.u1, uv.v1, glow
      );
    }
    return o / 6;
  }

  render(track, ship, music, trackMeta, dt, nowSec) {
    const gl = this.gl;
    const U = this.u;

    // True vehicle speed & forward-surge intensity (drives warp-FOV, radial speed filter & neon bloom!)
    const speedNorm = Math.max(0, Math.min(1, (ship.kph - 560) / 620));
    const surgeKick = Math.max(0, Math.min(1,
      Math.max(0, ship.relVel) / 66 +
      Math.max(0, ship.thrust - 0.62) * 0.42 +
      (ship.catchUp || 0) * 0.34
    ));
    const modeBoost = music.mode === 'acid'
      ? (music.filterCutoffNormalized || 0) * 0.24 + (music.accentTrigger || 0) * 0.20
      : (music.dropFlash || 0) * 0.26 + (music.bassEnergy || 0) * 0.10;
    const targetSpeedFilter = Math.min(1.25, speedNorm * 0.66 + surgeKick * 0.56 + modeBoost);
    const sfRate = targetSpeedFilter > this._speedFilter ? 13.0 : 4.2;
    this._speedFilter += (targetSpeedFilter - this._speedFilter) * Math.min(1, dt * sfRate);

    // Dynamic warp-FOV: widens smoothly (64° -> ~73.5°) with camera catch-up & live surge speed!
    const dynFov = FOV_RAD + (ship.catchUp || 0) * 0.115 + this._speedFilter * 0.048;
    const tanHalfFov = Math.tan(dynFov * 0.5);
    mat4Perspective(this.projMat, dynFov, this.width / this.height, 0.5, MAX_DEPTH + 40);

    mat4LookAtBasis(this.viewMat, track.camPos, track.camRight, track.camUp, track.camForward);
    mat4FromBasis(this.shipModelMat, ship.pos, ship.right, ship.up, ship.forward, 1.0);

    const dx = ship.pos[0] - track.camPos.x;
    const dy = ship.pos[1] - track.camPos.y;
    const dz = ship.pos[2] - track.camPos.z;
    const shipViewZ = Math.max(2.0, dx * track.camForward.x + dy * track.camForward.y + dz * track.camForward.z);
    const focusDepth = Math.min(0.95, shipViewZ / MAX_DEPTH);

    const beamCol = trackMeta.beamColor || [0.15, 0.85, 1.0];

    // =========================================================================
    // PASS 1: Main 3D Scene into MRT FBO (Color + Linear View Depth)
    // =========================================================================
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.depthMask(true);
    gl.colorMask(true, true, true, true);
    gl.clearColor(0.98, 0.66, 0.72, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 1A. Sky + Distant City Skyline
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.useProgram(this.skyProg);
    gl.uniform1f(U.sky.uAspect, this.width / this.height);
    gl.uniform1f(U.sky.uTanHalfFov, tanHalfFov);
    gl.uniform1f(U.sky.uWorldYaw, track.worldYaw);
    gl.uniform3f(U.sky.uCamRight, track.camRight.x, track.camRight.y, track.camRight.z);
    gl.uniform3f(U.sky.uCamUp, track.camUp.x, track.camUp.y, track.camUp.z);
    gl.uniform3f(U.sky.uCamForward, track.camForward.x, track.camForward.y, track.camForward.z);
    gl.uniform1f(U.sky.uBeat, music.beatPulse);
    gl.uniform1f(U.sky.uTime, nowSec);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    this.stepPulse = Math.max(0, this.stepPulse - dt * 10.0);

    // 1B. 3D Track + Chevron Barriers + Glowing Rails
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    const trackVertCount = writeTrackGeometry(track, this.trackBuf);
    gl.useProgram(this.trackProg);
    gl.uniformMatrix4fv(U.track.uView, false, this.viewMat);
    gl.uniformMatrix4fv(U.track.uProj, false, this.projMat);
    gl.uniform1f(U.track.uBeat, music.beatPulse);
    gl.uniform3fv(U.track.uAccent, beamCol);
    gl.uniform1f(U.track.uMaxDepth, MAX_DEPTH);
    gl.uniform3fv(U.track.uShipPos, ship.pos);
    const stabFlash = Math.min(1.5, (music.stabPulse || 0) + (music.accentTrigger || 0) * 0.9);
    gl.uniform1f(U.track.uStabFlash, stabFlash);
    gl.uniform1f(U.track.uRasterMode, music.rasterMode || 0);
    gl.uniform1f(U.track.uStepPulse, this.stepPulse);
    gl.uniform1f(U.track.uTime, nowSec);
    // Pack up to 8 visible beat-synced speed pads into zero-alloc Float32Array uniform!
    this._padData.fill(0);
    let pCount = 0;
    for (let i = 0; i < track.speedPads.length && pCount < 8; i++) {
      const p = track.speedPads[i];
      if (p.s >= track.dist - 12.0 && p.s <= track.dist + AHEAD_SEGS * SEG_LEN) {
        const base = pCount * 4;
        this._padData[base] = p.s;
        this._padData[base + 1] = p.halfLen;
        this._padData[base + 2] = p.flash;
        this._padData[base + 3] = p.kind;
        pCount++;
      }
    }
    gl.uniform4fv(U.track['uPads[0]'], this._padData);
    gl.bindVertexArray(this.trackVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trackVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.trackBuf.subarray(0, trackVertCount * TRACK_FLOATS_PER_VERT));
    gl.drawArrays(gl.TRIANGLES, 0, trackVertCount);

    // 1C. 3D Snare/Stab-Synced Trackside Billboards & Arch Gantries
    const bbVertCount = this._buildBillboards(track, ship, music);
    if (bbVertCount > 0) {
      gl.useProgram(this.quadProg);
      gl.uniformMatrix4fv(U.quad.uView, false, this.viewMat);
      gl.uniformMatrix4fv(U.quad.uProj, false, this.projMat);
      gl.uniform1f(U.quad.uMaxDepth, MAX_DEPTH);
      gl.uniform1f(U.quad.uAlphaCut, 0.5);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.billboardAtlas.tex);
      gl.uniform1i(U.quad.uTex, 0);
      gl.bindVertexArray(this.quadVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.quadBuf.subarray(0, bbVertCount * 6));
      gl.drawArrays(gl.TRIANGLES, 0, bbVertCount);
    }

    // 1D. 3D Wipeout Craft
    gl.useProgram(this.shipProg);
    gl.uniformMatrix4fv(U.ship.uModel, false, this.shipModelMat);
    gl.uniformMatrix4fv(U.ship.uView, false, this.viewMat);
    gl.uniformMatrix4fv(U.ship.uProj, false, this.projMat);
    gl.uniform3f(U.ship.uCamPos, track.camPos.x, track.camPos.y, track.camPos.z);
    gl.uniform3fv(U.ship.uBeamColor, beamCol);
    gl.uniform1f(U.ship.uThrust, ship.thrust);
    gl.uniform1f(U.ship.uMaxDepth, MAX_DEPTH);
    gl.bindVertexArray(this.shipVao);
    gl.drawArrays(gl.TRIANGLES, 0, this.shipVertCount);

    // 1E. 3D Racing Karaoke Lyric Banners
    const lyricVertCount = this._buildLyrics(track, ship, dt);
    if (lyricVertCount > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(this.quadProg);
      gl.uniformMatrix4fv(U.quad.uView, false, this.viewMat);
      gl.uniformMatrix4fv(U.quad.uProj, false, this.projMat);
      gl.uniform1f(U.quad.uMaxDepth, MAX_DEPTH);
      gl.uniform1f(U.quad.uAlphaCut, 0.05);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.lyricAtlas.tex);
      gl.uniform1i(U.quad.uTex, 0);
      gl.bindVertexArray(this.quadVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.quadBuf.subarray(0, lyricVertCount * 6));
      gl.drawArrays(gl.TRIANGLES, 0, lyricVertCount);
    }

    // 1F. Continuous Bright Twin Thruster Beams
    const beamVertCount = writeBeamGeometry(track, ship, this.beamBuf);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
    gl.useProgram(this.beamProg);
    gl.uniformMatrix4fv(U.beam.uView, false, this.viewMat);
    gl.uniformMatrix4fv(U.beam.uProj, false, this.projMat);
    gl.uniform3fv(U.beam.uBeamColor, beamCol);
    gl.uniform1f(U.beam.uIntensity, ship.beamIntensity);
    gl.uniform1f(U.beam.uTime, nowSec);
    gl.uniform1f(U.beam.uMaxDepth, MAX_DEPTH);
    gl.bindVertexArray(this.beamVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.beamVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.beamBuf.subarray(0, beamVertCount * BEAM_FLOATS_PER_VERT));
    gl.drawArrays(gl.TRIANGLES, 0, beamVertCount);

    // =========================================================================
    // PASS 2: Quarter-Res Bloom Extract & Separable Gaussian Blur
    // =========================================================================
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVao);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFboA.fbo);
    gl.viewport(0, 0, this.bloomFboA.w, this.bloomFboA.h);
    gl.useProgram(this.bloomExtProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFbo.colorTex);
    gl.uniform1i(U.bloomExt.uScene, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(this.blurProg);
    gl.uniform1i(U.blur.uTex, 0);
    const invBw = 1.0 / this.bloomFboA.w;
    const invBh = 1.0 / this.bloomFboA.h;
    for (let p = 0; p < 2; p++) {
      // Subtle anamorphic horizontal lens-glow stretch (1.5x wider horizontally than vertically!)
      const spreadX = p === 0 ? 1.85 : 4.20;
      const spreadY = p === 0 ? 1.25 : 2.80;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFboB.fbo);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomFboA.tex);
      gl.uniform2f(U.blur.uDir, spreadX * invBw, 0.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFboA.fbo);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomFboB.tex);
      gl.uniform2f(U.blur.uDir, 0.0, spreadY * invBh);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // =========================================================================
    // PASS 3: Full-Res 12-Tap Precomputed Vogel-Disk Depth of Field + Bloom
    // =========================================================================
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.dofProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFbo.colorTex);
    gl.uniform1i(U.dof.uScene, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFbo.depthInfoTex);
    gl.uniform1i(U.dof.uDepth, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomFboA.tex);
    gl.uniform1i(U.dof.uBloom, 2);

    gl.uniform2f(U.dof.uTexel, 1.0 / this.width, 1.0 / this.height);
    gl.uniform1f(U.dof.uFocusDepth, focusDepth);
    const dofAmt = music.mode === 'retrowave' ? (0.76 + (music.padLFO || 0.5) * 0.16) : 0.82;
    gl.uniform1f(U.dof.uDofStrength, dofAmt);
    const bloomAmt = 0.78 + music.kick * 0.18 + (music.dropFlash || 0) * 0.28 +
      (music.stabPulse || 0) * 0.20 + (music.accentTrigger || 0) * 0.18 +
      this._speedFilter * 0.22 + Math.max(0, ship.thrust - 0.55) * 0.16 +
      (music.mode === 'retrowave' ? (music.subBassEnvelope || 0) * 0.16 : 0);
    gl.uniform1f(U.dof.uBloomStrength, bloomAmt);
    gl.uniform1f(U.dof.uSpeedBlur, this._speedFilter);
    gl.uniform1f(U.dof.uRasterMode, music.rasterMode || 0);
    gl.uniform1f(U.dof.uStepPulse, this.stepPulse);
    gl.uniform1f(U.dof.uTime, nowSec);
    gl.uniform3fv(U.dof.uAccent, beamCol);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
