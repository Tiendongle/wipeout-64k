// Procedural 3D geometry builders for the Wipeout ship, spline track + chevron barriers,
// and continuous twin thruster beams.

import { TOTAL_SEGS, TRACK_HALF_WIDTH } from '../world/track.js';

// Build sleek Wipeout craft inspired by reference art (long razor-sharp black needle nose,
// diagonal black/white wedge hull, rear-set stealth canopy, downward-swept anhedral rear fins,
// wide sculpted rear engine shroud with twin glowing plasma exhausts).
// Vertex format: [x, y, z, nx, ny, nz, r, g, b, emissive] (10 floats per vertex)
export function buildShipMesh() {
  const verts = [];

  function pushTri(a, b, c, col, emissive = 0) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const p of [a, b, c]) {
      verts.push(p[0], p[1], p[2], nx, ny, nz, col[0], col[1], col[2], emissive);
    }
  }

  function pushQuad(a, b, c, d, col, emissive = 0) {
    pushTri(a, b, c, col, emissive);
    pushTri(a, c, d, col, emissive);
  }

  const W  = [0.95, 0.95, 0.97];  // crisp Wipeout white rear hull
  const W2 = [0.82, 0.84, 0.88];  // cool light-grey armor bevel
  const B  = [0.07, 0.08, 0.11];  // deep matte carbon black (front spear & belly)
  const G  = [0.22, 0.24, 0.30];  // mechanical dark gunmetal (rear shroud/vents)
  const R  = [0.98, 0.14, 0.28];  // tDR hot red graphic accent
  const C  = [0.04, 0.06, 0.11];  // stealth canopy glass
  const E  = [1.00, 1.00, 1.00];  // glowing plasma engine core (emissive = 1)

  // --- 1. Rear & Mid White Sculpted Fuselage (z = +2.25 back to z = -1.25 split) ---
  const rTL = [-0.96, 0.50, 2.15];
  const rTR = [ 0.96, 0.50, 2.15];
  const rML = [-1.32, 0.14, 2.22];
  const rMR = [ 1.32, 0.14, 2.22];
  const rBL = [-1.05, -0.22, 2.10];
  const rBR = [ 1.05, -0.22, 2.10];

  const mTL = [-0.66, 0.64, 0.35];
  const mTR = [ 0.66, 0.64, 0.35];
  const mML = [-1.18, 0.18, 0.20];
  const mMR = [ 1.18, 0.18, 0.20];
  const mBL = [-0.82, -0.24, 0.20];
  const mBR = [ 0.82, -0.24, 0.20];

  // Diagonal livery split bulkhead (white rear meets matte-black needle nose)
  const sTL = [-0.46, 0.44, -1.25];
  const sTR = [ 0.46, 0.44, -1.25];
  const sML = [-0.74, 0.14, -1.15];
  const sMR = [ 0.74, 0.14, -1.15];
  const sBL = [-0.48, -0.18, -1.05];
  const sBR = [ 0.48, -0.18, -1.05];

  // Top white deck & angled shoulder facets
  pushQuad(rTL, rTR, mTR, mTL, W);
  pushQuad(mTL, mTR, sTR, sTL, W);
  pushQuad(rML, rTL, mTL, mML, W2);
  pushQuad(mML, mTL, sTL, sML, W2);
  pushQuad(rTR, rMR, mMR, mTR, W2);
  pushQuad(mTR, mMR, sMR, sTR, W2);

  // Lower black chines & belly
  pushQuad(rBL, rML, mML, mBL, B);
  pushQuad(mBL, mML, sML, sBL, B);
  pushQuad(rMR, rBR, mBR, mMR, B);
  pushQuad(mMR, mBR, sBR, sMR, B);
  pushQuad(rBR, rBL, mBL, mBR, B);
  pushQuad(mBR, mBL, sBL, sBR, B);

  // Rear armored transom & recessed engine bay
  pushQuad(rBL, rBR, rMR, rML, G);
  pushQuad(rML, rMR, rTR, rTL, G);

  // --- 2. Long Razor-Sharp Black Needle Nose (z = -1.25 to -4.85, ref Image 2) ---
  const nTL = [-0.14, 0.26, -4.75];
  const nTR = [ 0.14, 0.26, -4.75];
  const nBL = [-0.18, 0.08, -4.55];
  const nBR = [ 0.18, 0.08, -4.55];
  const noseTip = [0.0, 0.17, -4.95];

  // Black spear upper, sides, and underside
  pushQuad(sTL, sTR, nTR, nTL, B);
  pushQuad(sML, sTL, nTL, nBL, B);
  pushQuad(sTR, sMR, nBR, nTR, B);
  pushQuad(sBL, sML, nBL, nBL, B);
  pushQuad(sMR, sBR, nBR, nBR, B);
  pushQuad(sBR, sBL, nBL, nBR, B);
  // Crisp white nose tip trim (matches Image 2 nose accent)
  pushTri(nTL, nTR, noseTip, W);
  pushTri(nBR, nBL, noseTip, B);
  pushTri(nBL, nTL, noseTip, W);
  pushTri(nTR, nBR, noseTip, W);

  // Bold white/red livery stripe panels on black front shoulders (katakana-inspired accent)
  for (const s of [-1, 1]) {
    const a = [s * 0.62, 0.25, -1.65];
    const b = [s * 0.42, 0.28, -2.55];
    const c = [s * 0.36, 0.15, -2.55];
    const d = [s * 0.56, 0.12, -1.65];
    if (s > 0) pushQuad(a, b, c, d, W);
    else pushQuad(b, a, d, c, W);
  }

  // --- 3. Wide Sculpted Rear Side Pods & Downward-Swept Anhedral Fins (ref Images 2 & 3) ---
  for (const s of [-1, 1]) {
    const pFront = [s * 0.92, 0.16, -0.35];
    const pMidIn = [s * 1.24, 0.22, 1.35];
    const pRearIn = [s * 1.28, 0.20, 2.30];
    const pRearBot = [s * 1.12, -0.22, 2.20];

    // Swept outward & slightly DOWNWARD (anhedral predator wing stance!)
    const wOutF = [s * 2.15, 0.02, 1.15];
    const wOutR = [s * 2.48, -0.18, 2.28];
    const wDrop = [s * 2.32, -0.58, 2.42]; // downward-canted fin tip (Image 2)

    if (s > 0) {
      pushQuad(pFront, wOutF, wOutR, pRearIn, W);
      pushQuad(pRearIn, wOutR, wOutF, pRearBot, B);
      pushTri(pFront, pMidIn, wOutF, W2);
      // Downward-swept rear stabilizer blade
      pushTri(wOutF, wDrop, wOutR, W);
      pushTri(wOutR, wDrop, wOutF, B);
      // Red tDR racing badge accent on rear wing
      pushTri([s * 1.48, 0.14, 1.55], [s * 1.98, 0.02, 1.75], [s * 1.88, -0.02, 2.18], R);
    } else {
      pushQuad(pFront, pRearIn, wOutR, wOutF, W);
      pushQuad(pRearBot, wOutF, wOutR, pRearIn, B);
      pushTri(pFront, wOutF, pMidIn, W2);
      pushTri(wOutF, wOutR, wDrop, W);
      pushTri(wOutR, wOutF, wDrop, B);
      pushTri([s * 1.48, 0.14, 1.55], [s * 1.88, -0.02, 2.18], [s * 1.98, 0.02, 1.75], R);
    }
  }

  // --- 4. Ventral Black Belly Stabilizer Fin (ref Image 2) ---
  const vF = [0, -0.22, 0.15];
  const vB = [0, -0.58, 1.10];
  const vR = [0, -0.22, 1.55];
  pushTri(vF, vB, vR, B);
  pushTri(vF, vR, vB, B);

  // --- 5. Rear-Set Low Stealth Cockpit Canopy & Dorsal Spine (ref Images 2 & 3) ---
  const cF = [0, 0.56, -0.85];
  const cML = [-0.40, 0.90, 0.55];
  const cMR = [ 0.40, 0.90, 0.55];
  const cRL = [-0.46, 0.78, 1.55];
  const cRR = [ 0.46, 0.78, 1.55];
  const cBaseL = [-0.56, 0.56, 0.45];
  const cBaseR = [ 0.56, 0.56, 0.45];

  pushTri(cF, cMR, cML, C);
  pushQuad(cML, cMR, cRR, cRL, C);
  pushTri(cF, cML, cBaseL, B);
  pushTri(cF, cBaseR, cMR, B);
  // Sculpted dark dorsal spine fairing behind canopy
  pushQuad(cRL, cRR, [0.58, 0.50, 2.25], [-0.58, 0.50, 2.25], B);
  // Subtle red airbrake strip on rear spine
  pushQuad([-0.30, 0.66, 1.75], [0.30, 0.66, 1.75], [0.36, 0.56, 2.12], [-0.36, 0.56, 2.12], R);

  // --- 6. Wide Sculpted Twin Rear Engine Nozzles & Luminous Core (ref Image 3) ---
  for (const s of [-1, 1]) {
    const cx = s * 0.58;
    const cy = 0.12;
    const zF = 1.85;
    const zR = 2.38;
    const rad = 0.34;
    const sides = 10;

    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const x0 = cx + Math.cos(a0) * rad;
      const y0 = cy + Math.sin(a0) * rad;
      const x1 = cx + Math.cos(a1) * rad;
      const y1 = cy + Math.sin(a1) * rad;

      // Armored gunmetal cowling
      pushQuad([x0, y0, zF], [x1, y1, zF], [x1, y1, zR], [x0, y0, zR], G);
      // Super-bright glowing rear plasma exhaust disc (emissive = 1)
      pushTri([cx, cy, zR + 0.02], [x0, y0, zR + 0.01], [x1, y1, zR + 0.01], E, 1.0);
    }
  }

  return new Float32Array(verts);
}

// Track vertex format: [x, y, z, nx, ny, nz, u, v, mat] (9 floats)
// Per segment quad count:
// 1 road quad + 2 barrier wall quads (L/R) + 2 glowing rail quads (L/R) = 5 quads = 30 verts per segment.
export const TRACK_VERTS_PER_SEG = 30;
export const TRACK_FLOATS_PER_VERT = 9;
export const TRACK_MAX_FLOATS = TOTAL_SEGS * TRACK_VERTS_PER_SEG * TRACK_FLOATS_PER_VERT;

export function writeTrackGeometry(track, out) {
  let o = 0;
  const hw = TRACK_HALF_WIDTH;
  const railH = 0.95;
  const wallH = 1.65;
  const wallOut = hw + 0.55;

  function putV(x, y, z, nx, ny, nz, u, v, mat) {
    out[o++] = x; out[o++] = y; out[o++] = z;
    out[o++] = nx; out[o++] = ny; out[o++] = nz;
    out[o++] = u; out[o++] = v; out[o++] = mat;
  }

  function putQuad(a, b, c, d, nx, ny, nz, ua, va, ub, vb, uc, vc, ud, vd, mat) {
    putV(a[0], a[1], a[2], nx, ny, nz, ua, va, mat);
    putV(b[0], b[1], b[2], nx, ny, nz, ub, vb, mat);
    putV(c[0], c[1], c[2], nx, ny, nz, uc, vc, mat);
    putV(a[0], a[1], a[2], nx, ny, nz, ua, va, mat);
    putV(c[0], c[1], c[2], nx, ny, nz, uc, vc, mat);
    putV(d[0], d[1], d[2], nx, ny, nz, ud, vd, mat);
  }

  for (let i = 0; i < TOTAL_SEGS; i++) {
    const p0 = track.samples[i];
    const p1 = track.samples[i + 1];

    // Road surface (-hw .. +hw)
    const r0L = [p0.x - p0.rx * hw, p0.y - p0.ry * hw, p0.z - p0.rz * hw];
    const r0R = [p0.x + p0.rx * hw, p0.y + p0.ry * hw, p0.z + p0.rz * hw];
    const r1R = [p1.x + p1.rx * hw, p1.y + p1.ry * hw, p1.z + p1.rz * hw];
    const r1L = [p1.x - p1.rx * hw, p1.y - p1.ry * hw, p1.z - p1.rz * hw];

    putQuad(r0L, r0R, r1R, r1L, p0.ux, p0.uy, p0.uz, -1, p0.s, 1, p0.s, 1, p1.s, -1, p1.s, 0);

    // Left chevron barrier wall (angled slightly outward like Wipeout)
    const lw0B = r0L;
    const lw1B = r1L;
    const lw0T = [p0.x - p0.rx * wallOut + p0.ux * wallH, p0.y - p0.ry * wallOut + p0.uy * wallH, p0.z - p0.rz * wallOut + p0.uz * wallH];
    const lw1T = [p1.x - p1.rx * wallOut + p1.ux * wallH, p1.y - p1.ry * wallOut + p1.uy * wallH, p1.z - p1.rz * wallOut + p1.uz * wallH];
    putQuad(lw0B, lw1B, lw1T, lw0T, p0.rx, p0.ry, p0.rz, 0, p0.s, 0, p1.s, 1, p1.s, 1, p0.s, 1);

    // Right chevron barrier wall
    const rw0B = r0R;
    const rw1B = r1R;
    const rw0T = [p0.x + p0.rx * wallOut + p0.ux * wallH, p0.y + p0.ry * wallOut + p0.uy * wallH, p0.z + p0.rz * wallOut + p0.uz * wallH];
    const rw1T = [p1.x + p1.rx * wallOut + p1.ux * wallH, p1.y + p1.ry * wallOut + p1.uy * wallH, p1.z + p1.rz * wallOut + p1.uz * wallH];
    putQuad(rw1B, rw0B, rw0T, rw1T, -p0.rx, -p0.ry, -p0.rz, 0, p1.s, 0, p0.s, 1, p0.s, 1, p1.s, 1);

    // Left & Right glowing anti-grav rails floating slightly above barriers
    const rOff = hw + 0.15;
    const rThick = 0.24;
    for (const side of [-1, 1]) {
      const b0 = [p0.x + p0.rx * (side * rOff) + p0.ux * railH, p0.y + p0.ry * (side * rOff) + p0.uy * railH, p0.z + p0.rz * (side * rOff) + p0.uz * railH];
      const b1 = [p1.x + p1.rx * (side * rOff) + p1.ux * railH, p1.y + p1.ry * (side * rOff) + p1.uy * railH, p1.z + p1.rz * (side * rOff) + p1.uz * railH];
      const t0 = [b0[0] + p0.ux * rThick, b0[1] + p0.uy * rThick, b0[2] + p0.uz * rThick];
      const t1 = [b1[0] + p1.ux * rThick, b1[1] + p1.uy * rThick, b1[2] + p1.uz * rThick];
      if (side < 0) {
        putQuad(b0, b1, t1, t0, p0.rx, p0.ry, p0.rz, 0, p0.s, 0, p1.s, 1, p1.s, 1, p0.s, 2);
      } else {
        putQuad(b1, b0, t0, t1, -p0.rx, -p0.ry, -p0.rz, 0, p1.s, 0, p0.s, 1, p0.s, 1, p1.s, 2);
      }
    }
  }
  return o / TRACK_FLOATS_PER_VERT;
}

// Continuous twin thruster beams: 2 engines x 2 crossed ribbons x 24 steps x 6 verts x 5 floats
export const BEAM_STEPS = 24;
export const BEAM_FLOATS_PER_VERT = 5;
export const BEAM_MAX_FLOATS = 2 * 2 * BEAM_STEPS * 6 * BEAM_FLOATS_PER_VERT;

export function writeBeamGeometry(track, ship, out) {
  let o = 0;
  const len = ship.beamLength;
  // Wide blazing plume right out of the rear engine bay (scales with beat/thrust like Wipeout!)
  const baseWidth = 0.52 + ship.thrust * 0.34;
  const tmpA = {};
  const tmpB = {};

  function putV(x, y, z, u, v) {
    out[o++] = x; out[o++] = y; out[o++] = z;
    out[o++] = u; out[o++] = v;
  }

  // Left (-0.58) and Right (+0.58) twin engines
  for (const side of [-1, 1]) {
    const engineLat = side * 0.58;
    const engineUp = 0.12;
    const engineBack = 2.38;

    // Precompute spine points following the exact track curve behind the ship
    const pts = [];
    const rights = [];
    const ups = [];
    for (let i = 0; i <= BEAM_STEPS; i++) {
      const t = i / BEAM_STEPS;
      const s = ship.worldS - engineBack - t * len;
      const fr = track.sampleAt(s, i % 2 === 0 ? tmpA : tmpB);

      // Blend from exact ship engine nozzle at t=0 smoothly onto track-following wake
      const shipWeight = Math.pow(1 - t, 2.5);
      const lat = ship.lat + engineLat;
      const h = ship.hoverH + engineUp;

      let px = fr.x + fr.rx * lat + fr.ux * h;
      let py = fr.y + fr.ry * lat + fr.uy * h;
      let pz = fr.z + fr.rz * lat + fr.uz * h;

      if (i === 0) {
        // Exact engine nozzle position in world space
        px = ship.pos[0] + ship.right[0] * engineLat + ship.up[0] * engineUp - ship.forward[0] * engineBack;
        py = ship.pos[1] + ship.right[1] * engineLat + ship.up[1] * engineUp - ship.forward[1] * engineBack;
        pz = ship.pos[2] + ship.right[2] * engineLat + ship.up[2] * engineUp - ship.forward[2] * engineBack;
      } else if (shipWeight > 0.01) {
        const sx = ship.pos[0] + ship.right[0] * engineLat + ship.up[0] * engineUp - ship.forward[0] * (engineBack + t * len);
        const sy = ship.pos[1] + ship.right[1] * engineLat + ship.up[1] * engineUp - ship.forward[1] * (engineBack + t * len);
        const sz = ship.pos[2] + ship.right[2] * engineLat + ship.up[2] * engineUp - ship.forward[2] * (engineBack + t * len);
        px = px + (sx - px) * shipWeight * 0.5;
        py = py + (sy - py) * shipWeight * 0.5;
        pz = pz + (sz - pz) * shipWeight * 0.5;
      }

      pts.push([px, py, pz]);
      rights.push([fr.rx, fr.ry, fr.rz]);
      ups.push([fr.ux, fr.uy, fr.uz]);
    }

    // Two crossed ribbons (horizontal + vertical) for full 3D volume from any angle
    for (let orient = 0; orient < 2; orient++) {
      for (let i = 0; i < BEAM_STEPS; i++) {
        const t0 = i / BEAM_STEPS;
        const t1 = (i + 1) / BEAM_STEPS;
        const w0 = baseWidth * (1.0 - t0 * 0.72);
        const w1 = baseWidth * (1.0 - t1 * 0.72);

        const p0 = pts[i], p1 = pts[i + 1];
        const a0 = orient === 0 ? rights[i] : ups[i];
        const a1 = orient === 0 ? rights[i + 1] : ups[i + 1];

        const l0x = p0[0] - a0[0] * w0, l0y = p0[1] - a0[1] * w0, l0z = p0[2] - a0[2] * w0;
        const r0x = p0[0] + a0[0] * w0, r0y = p0[1] + a0[1] * w0, r0z = p0[2] + a0[2] * w0;
        const l1x = p1[0] - a1[0] * w1, l1y = p1[1] - a1[1] * w1, l1z = p1[2] - a1[2] * w1;
        const r1x = p1[0] + a1[0] * w1, r1y = p1[1] + a1[1] * w1, r1z = p1[2] + a1[2] * w1;

        putV(l0x, l0y, l0z, t0, -1);
        putV(r0x, r0y, r0z, t0,  1);
        putV(r1x, r1y, r1z, t1,  1);

        putV(l0x, l0y, l0z, t0, -1);
        putV(r1x, r1y, r1z, t1,  1);
        putV(l1x, l1y, l1z, t1, -1);
      }
    }
  }

  return o / BEAM_FLOATS_PER_VERT;
}
