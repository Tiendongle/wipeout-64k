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

    // Active racing 3D lyric words flying along the track
    this.activeLyrics = [];
    this._lyricLaneToggle = 0;

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

    // Track 3 onStep pulse decay state
    this.stepPulse = 0;

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
    const dprCap = this.isMobile ? 1.5 : 2.0;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const w = Math.max(2, Math.floor(window.innerWidth * dpr));
    const h = Math.max(2, Math.floor(window.innerHeight * dpr));
    if (w === this.width && h === this.height && this.sceneFbo) return;

    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;

    destroyFBO(gl, this.sceneFbo);
    destroyFBO(gl, this.bloomFboA);
    destroyFBO(gl, this.bloomFboB);

    this.sceneFbo = createSceneFBO(gl, w, h);
    const bw = Math.max(2, w >> 1);
    const bh = Math.max(2, h >> 1);
    this.bloomFboA = createSimpleFBO(gl, bw, bh);
    this.bloomFboB = createSimpleFBO(gl, bw, bh);

    mat4Perspective(this.projMat, FOV_RAD, w / h, 0.5, MAX_DEPTH + 40);
  }

  _pushQuad(buf, offset, c, right, up, halfW, halfH, u0, v0, u1, v1, glow) {
    // 4 corners: bottom-left, bottom-right, top-right, top-left
    const blx = c[0] - right[0] * halfW - up[0] * halfH;
    const bly = c[1] - right[1] * halfW - up[1] * halfH;
    const blz = c[2] - right[2] * halfW - up[2] * halfH;

    const brx = c[0] + right[0] * halfW - up[0] * halfH;
    const bry = c[1] + right[1] * halfW - up[1] * halfH;
    const brz = c[2] + right[2] * halfW - up[2] * halfH;

    const trx = c[0] + right[0] * halfW + up[0] * halfH;
    const try_ = c[1] + right[1] * halfW + up[1] * halfH;
    const trz = c[2] + right[2] * halfW + up[2] * halfH;

    const tlx = c[0] - right[0] * halfW + up[0] * halfH;
    const tly = c[1] - right[1] * halfW + up[1] * halfH;
    const tlz = c[2] - right[2] * halfW + up[2] * halfH;

    let o = offset;
    const put = (x, y, z, u, v) => {
      buf[o++] = x; buf[o++] = y; buf[o++] = z;
      buf[o++] = u; buf[o++] = v; buf[o++] = glow;
    };
    // Canvas Y=0 is top, so top corners get v0, bottom corners get v1
    put(blx, bly, blz, u0, v1);
    put(brx, bry, brz, u1, v1);
    put(trx, try_, trz, u1, v0);

    put(blx, bly, blz, u0, v1);
    put(trx, try_, trz, u1, v0);
    put(tlx, tly, tlz, u0, v0);
    return o;
  }

  _buildBillboards(track) {
    const spacing = 36.0;
    const minS = track.dist + 4.0;
    const maxS = track.dist + AHEAD_SEGS * SEG_LEN - 12.0;
    const firstIdx = Math.ceil(minS / spacing);
    const lastIdx = Math.floor(maxS / spacing);

    const { cols, rows, count } = this.billboardAtlas;
    let o = 0;
    const fr = this._tmpSample;

    for (let idx = firstIdx; idx <= lastIdx; idx++) {
      if (o + 36 > this.quadBuf.length) break;
      const worldS = idx * spacing;
      track.sampleAt(worldS, fr);

      const designIdx = ((idx % count) + count) % count;
      const col = designIdx % cols;
      const row = Math.floor(designIdx / cols);
      const u0 = col / cols, u1 = (col + 1) / cols;
      const v0 = row / rows, v1 = (row + 1) / rows;

      // Every 5th billboard is an overhead Wipeout arch gantry; others alternate L/R sides
      if (idx % 5 === 0) {
        const cx = fr.x + fr.ux * 9.8;
        const cy = fr.y + fr.uy * 9.8;
        const cz = fr.z + fr.uz * 9.8;
        o = this._pushQuad(
          this.quadBuf, o,
          [cx, cy, cz],
          [fr.rx, fr.ry, fr.rz],
          [fr.ux, fr.uy, fr.uz],
          9.6, 2.35,
          u0, v0, u1, v1, 0.12
        );
      } else {
        const side = (idx % 2 === 0) ? -1 : 1;
        const offsetOut = TRACK_HALF_WIDTH + 4.4;
        const cx = fr.x + fr.rx * (side * offsetOut) + fr.ux * 4.2;
        const cy = fr.y + fr.ry * (side * offsetOut) + fr.uy * 4.2;
        const cz = fr.z + fr.rz * (side * offsetOut) + fr.uz * 4.2;
        // Slight inward toe-in angle so billboards face the oncoming pilot
        const toe = side * 0.28;
        const ct = Math.cos(toe), st = Math.sin(toe);
        const rx = fr.rx * ct - fr.fx * st;
        const ry = fr.ry * ct - fr.fy * st;
        const rz = fr.rz * ct - fr.fz * st;

        o = this._pushQuad(
          this.quadBuf, o,
          [cx, cy, cz],
          [rx, ry, rz],
          [fr.ux, fr.uy, fr.uz],
          4.8, 2.4,
          u0, v0, u1, v1, 0.08
        );
      }
    }
    return o / 6;
  }

  _buildLyrics(track, ship, dt) {
    if (!this.lyricAtlas) return 0;
    let o = 0;
    const fr = this._tmpSample;

    // Update & prune racing lyric words
    for (let i = this.activeLyrics.length - 1; i >= 0; i--) {
      const l = this.activeLyrics[i];
      l.s += track.speed * l.speedRatio * dt;
      if (l.s < track.dist - 6.0) {
        this.activeLyrics.splice(i, 1);
      }
    }

    // Sort back-to-front by worldS for clean alpha blending
    this.activeLyrics.sort((a, b) => b.s - a.s);

    for (const l of this.activeLyrics) {
      if (o + 36 > this.quadBuf.length) break;
      const uv = this.lyricAtlas.map.get(l.word);
      if (!uv) continue;
      if (l.s > track.dist + AHEAD_SEGS * SEG_LEN - 10) continue;

      track.sampleAt(l.s, fr);
      const cx = fr.x + fr.rx * l.lat + fr.ux * l.height;
      const cy = fr.y + fr.ry * l.lat + fr.uy * l.height;
      const cz = fr.z + fr.rz * l.lat + fr.uz * l.height;

      // Flash bright neon as the racing word passes the ship's surge zone
      const distToShip = Math.abs(l.s - ship.worldS);
      const glow = Math.max(0.15, Math.exp(-distToShip * 0.045) * 1.15);

      o = this._pushQuad(
        this.quadBuf, o,
        [cx, cy, cz],
        [fr.rx, fr.ry, fr.rz],
        [fr.ux, fr.uy, fr.uz],
        4.6, 1.72,
        uv.u0, uv.v0, uv.u1, uv.v1,
        glow
      );
    }
    return o / 6;
  }

  render(track, ship, music, trackMeta, dt, nowSec) {
    const gl = this.gl;
    this.resize();

    mat4LookAtBasis(this.viewMat, track.camPos, track.camRight, track.camUp, track.camForward);
    mat4FromBasis(this.shipModelMat, ship.pos, ship.right, ship.up, ship.forward, 1.0);

    // Compute exact view-space distance of the ship for dynamic DoF focus!
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

    // 1A. Sky + Distant City Skyline (true 3D ray, zero curve warping)
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.useProgram(this.skyProg);
    gl.uniform1f(gl.getUniformLocation(this.skyProg, 'uAspect'), this.width / this.height);
    gl.uniform1f(gl.getUniformLocation(this.skyProg, 'uTanHalfFov'), Math.tan(FOV_RAD * 0.5));
    gl.uniform1f(gl.getUniformLocation(this.skyProg, 'uWorldYaw'), track.worldYaw);
    gl.uniform3f(gl.getUniformLocation(this.skyProg, 'uCamRight'), track.camRight.x, track.camRight.y, track.camRight.z);
    gl.uniform3f(gl.getUniformLocation(this.skyProg, 'uCamUp'), track.camUp.x, track.camUp.y, track.camUp.z);
    gl.uniform3f(gl.getUniformLocation(this.skyProg, 'uCamForward'), track.camForward.x, track.camForward.y, track.camForward.z);
    gl.uniform1f(gl.getUniformLocation(this.skyProg, 'uBeat'), music.beatPulse);
    gl.uniform1f(gl.getUniformLocation(this.skyProg, 'uTime'), nowSec);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    this.stepPulse = Math.max(0, this.stepPulse - dt * 10.0);

    // 1B. 3D Track + Chevron Barriers + Glowing Rails
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    const trackVertCount = writeTrackGeometry(track, this.trackBuf);
    gl.useProgram(this.trackProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.trackProg, 'uView'), false, this.viewMat);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.trackProg, 'uProj'), false, this.projMat);
    gl.uniform1f(gl.getUniformLocation(this.trackProg, 'uBeat'), music.beatPulse);
    gl.uniform3fv(gl.getUniformLocation(this.trackProg, 'uAccent'), beamCol);
    gl.uniform1f(gl.getUniformLocation(this.trackProg, 'uMaxDepth'), MAX_DEPTH);
    gl.uniform3fv(gl.getUniformLocation(this.trackProg, 'uShipPos'), ship.pos);
    const stabFlash = Math.min(1.5, (music.stabPulse || 0) + (music.accentTrigger || 0) * 0.9);
    gl.uniform1f(gl.getUniformLocation(this.trackProg, 'uStabFlash'), stabFlash);
    gl.uniform1f(gl.getUniformLocation(this.trackProg, 'uRasterMode'), music.rasterMode || 0);
    gl.uniform1f(gl.getUniformLocation(this.trackProg, 'uStepPulse'), this.stepPulse);
    gl.bindVertexArray(this.trackVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trackVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.trackBuf.subarray(0, trackVertCount * TRACK_FLOATS_PER_VERT));
    gl.drawArrays(gl.TRIANGLES, 0, trackVertCount);

    // 1C. 3D Trackside Billboards (exact worldS speed match + GPU DoF)
    const bbVertCount = this._buildBillboards(track);
    if (bbVertCount > 0) {
      gl.useProgram(this.quadProg);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.quadProg, 'uView'), false, this.viewMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.quadProg, 'uProj'), false, this.projMat);
      gl.uniform1f(gl.getUniformLocation(this.quadProg, 'uMaxDepth'), MAX_DEPTH);
      gl.uniform1f(gl.getUniformLocation(this.quadProg, 'uAlphaCut'), 0.5);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.billboardAtlas.tex);
      gl.uniform1i(gl.getUniformLocation(this.quadProg, 'uTex'), 0);
      gl.bindVertexArray(this.quadVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.quadBuf.subarray(0, bbVertCount * 6));
      gl.drawArrays(gl.TRIANGLES, 0, bbVertCount);
    }

    // 1D. 3D Wipeout Craft
    gl.useProgram(this.shipProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.shipProg, 'uModel'), false, this.shipModelMat);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.shipProg, 'uView'), false, this.viewMat);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.shipProg, 'uProj'), false, this.projMat);
    gl.uniform3f(gl.getUniformLocation(this.shipProg, 'uCamPos'), track.camPos.x, track.camPos.y, track.camPos.z);
    gl.uniform3fv(gl.getUniformLocation(this.shipProg, 'uBeamColor'), beamCol);
    gl.uniform1f(gl.getUniformLocation(this.shipProg, 'uThrust'), ship.thrust);
    gl.uniform1f(gl.getUniformLocation(this.shipProg, 'uMaxDepth'), MAX_DEPTH);
    gl.bindVertexArray(this.shipVao);
    gl.drawArrays(gl.TRIANGLES, 0, this.shipVertCount);

    // 1E. 3D Racing Karaoke Lyric Banners (alpha blended, GPU DoF depth written)
    const lyricVertCount = this._buildLyrics(track, ship, dt);
    if (lyricVertCount > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(this.quadProg);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.quadProg, 'uView'), false, this.viewMat);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.quadProg, 'uProj'), false, this.projMat);
      gl.uniform1f(gl.getUniformLocation(this.quadProg, 'uMaxDepth'), MAX_DEPTH);
      gl.uniform1f(gl.getUniformLocation(this.quadProg, 'uAlphaCut'), 0.05);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.lyricAtlas.tex);
      gl.uniform1i(gl.getUniformLocation(this.quadProg, 'uTex'), 0);
      gl.bindVertexArray(this.quadVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.quadBuf.subarray(0, lyricVertCount * 6));
      gl.drawArrays(gl.TRIANGLES, 0, lyricVertCount);
    }

    // 1F. Continuous Bright Twin Thruster Beams (additive glow ribbons along spline)
    const beamVertCount = writeBeamGeometry(track, ship, this.beamBuf);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    // Only write additive glow into COLOR_ATTACHMENT0 (keep underlying depth intact for DoF)
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
    gl.useProgram(this.beamProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.beamProg, 'uView'), false, this.viewMat);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.beamProg, 'uProj'), false, this.projMat);
    gl.uniform3fv(gl.getUniformLocation(this.beamProg, 'uBeamColor'), beamCol);
    gl.uniform1f(gl.getUniformLocation(this.beamProg, 'uIntensity'), ship.beamIntensity);
    gl.uniform1f(gl.getUniformLocation(this.beamProg, 'uTime'), nowSec);
    gl.uniform1f(gl.getUniformLocation(this.beamProg, 'uMaxDepth'), MAX_DEPTH);
    gl.bindVertexArray(this.beamVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.beamVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.beamBuf.subarray(0, beamVertCount * BEAM_FLOATS_PER_VERT));
    gl.drawArrays(gl.TRIANGLES, 0, beamVertCount);

    // =========================================================================
    // PASS 2: Half-Res Bloom Extract & Separable Gaussian Blur
    // =========================================================================
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVao);

    // 2A. Extract bright highlights
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFboA.fbo);
    gl.viewport(0, 0, this.bloomFboA.w, this.bloomFboA.h);
    gl.useProgram(this.bloomExtProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFbo.colorTex);
    gl.uniform1i(gl.getUniformLocation(this.bloomExtProg, 'uScene'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2B. Two-iteration Separable Gaussian Blur (tight glow + wider luminous halo)
    gl.useProgram(this.blurProg);
    gl.uniform1i(gl.getUniformLocation(this.blurProg, 'uTex'), 0);
    for (const spread of [1.6, 3.4]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFboB.fbo);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomFboA.tex);
      gl.uniform2f(gl.getUniformLocation(this.blurProg, 'uDir'), spread / this.bloomFboA.w, 0.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFboA.fbo);
      gl.bindTexture(gl.TEXTURE_2D, this.bloomFboB.tex);
      gl.uniform2f(gl.getUniformLocation(this.blurProg, 'uDir'), 0.0, spread / this.bloomFboA.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // =========================================================================
    // PASS 3: Full-Res 16-Tap Vogel-Disk Depth of Field + Bloom Composite
    // =========================================================================
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.dofProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFbo.colorTex);
    gl.uniform1i(gl.getUniformLocation(this.dofProg, 'uScene'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFbo.depthInfoTex);
    gl.uniform1i(gl.getUniformLocation(this.dofProg, 'uDepth'), 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomFboA.tex);
    gl.uniform1i(gl.getUniformLocation(this.dofProg, 'uBloom'), 2);

    gl.uniform2f(gl.getUniformLocation(this.dofProg, 'uTexel'), 1.0 / this.width, 1.0 / this.height);
    gl.uniform1f(gl.getUniformLocation(this.dofProg, 'uFocusDepth'), focusDepth);
    const dofAmt = music.mode === 'retrowave' ? (0.76 + (music.padLFO || 0.5) * 0.16) : 0.82;
    gl.uniform1f(gl.getUniformLocation(this.dofProg, 'uDofStrength'), dofAmt);
    const bloomAmt = 0.56 + music.kick * 0.14 + (music.dropFlash || 0) * 0.22 +
      (music.stabPulse || 0) * 0.18 + (music.accentTrigger || 0) * 0.16 +
      (music.mode === 'retrowave' ? (music.subBassEnvelope || 0) * 0.12 : 0);
    gl.uniform1f(gl.getUniformLocation(this.dofProg, 'uBloomStrength'), bloomAmt);
    const speedBlur = music.mode === 'acid'
      ? Math.min(1.0, (music.filterCutoffNormalized || 0) * 0.65 + (music.accentTrigger || 0) * 0.45)
      : Math.min(0.65, (music.bassEnergy || 0) * 0.35 + (music.dropFlash || 0) * 0.35);
    gl.uniform1f(gl.getUniformLocation(this.dofProg, 'uSpeedBlur'), speedBlur);
    gl.uniform1f(gl.getUniformLocation(this.dofProg, 'uRasterMode'), music.rasterMode || 0);
    gl.uniform1f(gl.getUniformLocation(this.dofProg, 'uStepPulse'), this.stepPulse);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
