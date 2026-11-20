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
  const rOff = hw + 0.15;
  const rThick = 0.24;

  function putQuad(
    ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz,
    nx, ny, nz, ua, va, ub, vb, uc, vc, ud, vd, mat
  ) {
    out[o++] = ax; out[o++] = ay; out[o++] = az; out[o++] = nx; out[o++] = ny; out[o++] = nz; out[o++] = ua; out[o++] = va; out[o++] = mat;
    out[o++] = bx; out[o++] = by; out[o++] = bz; out[o++] = nx; out[o++] = ny; out[o++] = nz; out[o++] = ub; out[o++] = vb; out[o++] = mat;
    out[o++] = cx; out[o++] = cy; out[o++] = cz; out[o++] = nx; out[o++] = ny; out[o++] = nz; out[o++] = uc; out[o++] = vc; out[o++] = mat;
    out[o++] = ax; out[o++] = ay; out[o++] = az; out[o++] = nx; out[o++] = ny; out[o++] = nz; out[o++] = ua; out[o++] = va; out[o++] = mat;
    out[o++] = cx; out[o++] = cy; out[o++] = cz; out[o++] = nx; out[o++] = ny; out[o++] = nz; out[o++] = uc; out[o++] = vc; out[o++] = mat;
    out[o++] = dx; out[o++] = dy; out[o++] = dz; out[o++] = nx; out[o++] = ny; out[o++] = nz; out[o++] = ud; out[o++] = vd; out[o++] = mat;
  }

  for (let i = 0; i < TOTAL_SEGS; i++) {
    const p0 = track.samples[i];
    const p1 = track.samples[i + 1];

    // Disconnected track chasm: skip geometry inside gaps & draw crisp bridge end-caps at lips!
    if (p0.gap || p1.gap) {
      if (!p0.gap && p1.gap && o + 54 <= out.length) {
        // Launch lip glowing edge face (front of disconnected ramp!)
        const lx0 = p0.x - p0.rx * hw, ly0 = p0.y - p0.ry * hw, lz0 = p0.z - p0.rz * hw;
        const rx0 = p0.x + p0.rx * hw, ry0 = p0.y + p0.ry * hw, rz0 = p0.z + p0.rz * hw;
        const dH = 1.8;
        putQuad(
          lx0, ly0, lz0, rx0, ry0, rz0,
          rx0 - p0.ux * dH, ry0 - p0.uy * dH, rz0 - p0.uz * dH,
          lx0 - p0.ux * dH, ly0 - p0.uy * dH, lz0 - p0.uz * dH,
          p0.fx, p0.fy, p0.fz, 0, p0.s, 1, p0.s, 1, p0.s, 0, p0.s, 2
        );
      } else if (p0.gap && !p1.gap && o + 54 <= out.length) {
        // Landing deck glowing front face facing the airborne pilot across the chasm!
        const lx1 = p1.x - p1.rx * hw, ly1 = p1.y - p1.ry * hw, lz1 = p1.z - p1.rz * hw;
        const rx1 = p1.x + p1.rx * hw, ry1 = p1.y + p1.ry * hw, rz1 = p1.z + p1.rz * hw;
        const dH = 2.4;
        putQuad(
          rx1, ry1, rz1, lx1, ly1, lz1,
          lx1 - p1.ux * dH, ly1 - p1.uy * dH, lz1 - p1.uz * dH,
          rx1 - p1.ux * dH, ry1 - p1.uy * dH, rz1 - p1.uz * dH,
          -p1.fx, -p1.fy, -p1.fz, 0, p1.s, 1, p1.s, 1, p1.s, 0, p1.s, 2
        );
      }
      continue;
    }

    const s0 = p0.s, s1 = p1.s;

    // Road surface (-hw .. +hw) — zero allocations!
    const r0Lx = p0.x - p0.rx * hw, r0Ly = p0.y - p0.ry * hw, r0Lz = p0.z - p0.rz * hw;
    const r0Rx = p0.x + p0.rx * hw, r0Ry = p0.y + p0.ry * hw, r0Rz = p0.z + p0.rz * hw;
    const r1Rx = p1.x + p1.rx * hw, r1Ry = p1.y + p1.ry * hw, r1Rz = p1.z + p1.rz * hw;
    const r1Lx = p1.x - p1.rx * hw, r1Ly = p1.y - p1.ry * hw, r1Lz = p1.z - p1.rz * hw;

    putQuad(r0Lx, r0Ly, r0Lz, r0Rx, r0Ry, r0Rz, r1Rx, r1Ry, r1Rz, r1Lx, r1Ly, r1Lz, p0.ux, p0.uy, p0.uz, -1, s0, 1, s0, 1, s1, -1, s1, 0);

    // Left chevron barrier wall
    const lw0Tx = p0.x - p0.rx * wallOut + p0.ux * wallH;
    const lw0Ty = p0.y - p0.ry * wallOut + p0.uy * wallH;
    const lw0Tz = p0.z - p0.rz * wallOut + p0.uz * wallH;
    const lw1Tx = p1.x - p1.rx * wallOut + p1.ux * wallH;
    const lw1Ty = p1.y - p1.ry * wallOut + p1.uy * wallH;
    const lw1Tz = p1.z - p1.rz * wallOut + p1.uz * wallH;
    putQuad(r0Lx, r0Ly, r0Lz, r1Lx, r1Ly, r1Lz, lw1Tx, lw1Ty, lw1Tz, lw0Tx, lw0Ty, lw0Tz, p0.rx, p0.ry, p0.rz, 0, s0, 0, s1, 1, s1, 1, s0, 1);

    // Right chevron barrier wall
    const rw0Tx = p0.x + p0.rx * wallOut + p0.ux * wallH;
    const rw0Ty = p0.y + p0.ry * wallOut + p0.uy * wallH;
    const rw0Tz = p0.z + p0.rz * wallOut + p0.uz * wallH;
    const rw1Tx = p1.x + p1.rx * wallOut + p1.ux * wallH;
    const rw1Ty = p1.y + p1.ry * wallOut + p1.uy * wallH;
    const rw1Tz = p1.z + p1.rz * wallOut + p1.uz * wallH;
    putQuad(r1Rx, r1Ry, r1Rz, r0Rx, r0Ry, r0Rz, rw0Tx, rw0Ty, rw0Tz, rw1Tx, rw1Ty, rw1Tz, -p0.rx, -p0.ry, -p0.rz, 0, s1, 0, s0, 1, s0, 1, s1, 1);

    // Left glowing rail
    const lb0x = p0.x - p0.rx * rOff + p0.ux * railH, lb0y = p0.y - p0.ry * rOff + p0.uy * railH, lb0z = p0.z - p0.rz * rOff + p0.uz * railH;
    const lb1x = p1.x - p1.rx * rOff + p1.ux * railH, lb1y = p1.y - p1.ry * rOff + p1.uy * railH, lb1z = p1.z - p1.rz * rOff + p1.uz * railH;
    putQuad(lb0x, lb0y, lb0z, lb1x, lb1y, lb1z, lb1x + p1.ux * rThick, lb1y + p1.uy * rThick, lb1z + p1.uz * rThick, lb0x + p0.ux * rThick, lb0y + p0.uy * rThick, lb0z + p0.uz * rThick, p0.rx, p0.ry, p0.rz, 0, s0, 0, s1, 1, s1, 1, s0, 2);

    // Right glowing rail
    const rb0x = p0.x + p0.rx * rOff + p0.ux * railH, rb0y = p0.y + p0.ry * rOff + p0.uy * railH, rb0z = p0.z + p0.rz * rOff + p0.uz * railH;
    const rb1x = p1.x + p1.rx * rOff + p1.ux * railH, rb1y = p1.y + p1.ry * rOff + p1.uy * railH, rb1z = p1.z + p1.rz * rOff + p1.uz * railH;
    putQuad(rb1x, rb1y, rb1z, rb0x, rb0y, rb0z, rb0x + p0.ux * rThick, rb0y + p0.uy * rThick, rb0z + p0.uz * rThick, rb1x + p1.ux * rThick, rb1y + p1.uy * rThick, rb1z + p1.uz * rThick, -p0.rx, -p0.ry, -p0.rz, 0, s1, 0, s0, 1, s0, 1, s1, 2);
  }
  return o / TRACK_FLOATS_PER_VERT;
}

// Continuous twin thruster beams: 2 engines x 2 crossed ribbons x 24 steps x 6 verts x 5 floats
export const BEAM_STEPS = 24;
export const BEAM_FLOATS_PER_VERT = 5;
export const BEAM_MAX_FLOATS = 2 * 2 * BEAM_STEPS * 6 * BEAM_FLOATS_PER_VERT;

// Pre-allocated zero-GC scratch buffers for writeBeamGeometry
const _bPts = new Float32Array((BEAM_STEPS + 1) * 3);
const _bRig = new Float32Array((BEAM_STEPS + 1) * 3);
const _bUps = new Float32Array((BEAM_STEPS + 1) * 3);
const _bTmp = {};

export function writeBeamGeometry(track, ship, out) {
  let o = 0;
  const len = ship.beamLength;
  const baseWidth = Math.min(0.95, 0.48 + ship.thrust * 0.24);
  const engineUp = 0.12;
  const engineBack = 2.38;

  for (let sIdx = 0; sIdx < 2; sIdx++) {
    const engineLat = (sIdx === 0 ? -0.58 : 0.58);
    const lat = ship.lat + engineLat;
    const baseH = Math.min(0.88, Math.max(0.36, ship.hoverH)) + engineUp;

    for (let i = 0; i <= BEAM_STEPS; i++) {
      const t = i / BEAM_STEPS;
      const s = ship.worldS - engineBack - t * len;
      const fr = track.sampleAt(s, _bTmp);
      // Trace the ship's recorded world-space flight path, clamped strictly ABOVE solid road so beams NEVER clip the map!
      const wakeRelY = ship.sampleWakeWorldY(s) - track.camTrackY + engineUp;
      const roadFloorY = fr.y + fr.ry * lat + fr.uy * (0.48 + engineUp);

      const shipWeight = (1 - t) * (1 - t) * Math.sqrt(1 - t);
      let px = fr.x + fr.rx * lat + fr.ux * baseH;
      let py = wakeRelY + fr.ry * lat;
      if (!track.isInGap(s) && py < roadFloorY) py = roadFloorY;
      // Only prevent tail from arcing over the camera lens when actually near the camera plane!
      if (fr.z > -7.0 && py > track.camPos.y - 0.35) py = track.camPos.y - 0.35;
      let pz = fr.z + fr.rz * lat + fr.uz * baseH;

      if (i === 0) {
        px = ship.pos[0] + ship.right[0] * engineLat + ship.up[0] * engineUp - ship.forward[0] * engineBack;
        py = ship.pos[1] + ship.right[1] * engineLat + ship.up[1] * engineUp - ship.forward[1] * engineBack;
        pz = ship.pos[2] + ship.right[2] * engineLat + ship.up[2] * engineUp - ship.forward[2] * engineBack;
      } else if (shipWeight > 0.01) {
        const dBack = engineBack + t * len;
        const sx = ship.pos[0] + ship.right[0] * engineLat + ship.up[0] * engineUp - ship.forward[0] * dBack;
        let sy = ship.pos[1] + ship.right[1] * engineLat + ship.up[1] * engineUp - ship.forward[1] * dBack;
        if (!track.isInGap(s) && sy < roadFloorY) sy = roadFloorY;
        const sz = ship.pos[2] + ship.right[2] * engineLat + ship.up[2] * engineUp - ship.forward[2] * dBack;
        const w = shipWeight * 0.5;
        px += (sx - px) * w;
        py += (sy - py) * w;
        pz += (sz - pz) * w;
      }

      const b = i * 3;
      _bPts[b] = px; _bPts[b + 1] = py; _bPts[b + 2] = pz;
      _bRig[b] = fr.rx; _bRig[b + 1] = fr.ry; _bRig[b + 2] = fr.rz;
      _bUps[b] = fr.ux; _bUps[b + 1] = fr.uy; _bUps[b + 2] = fr.uz;
    }

    for (let orient = 0; orient < 2; orient++) {
      const ax = orient === 0 ? _bRig : _bUps;
      for (let i = 0; i < BEAM_STEPS; i++) {
        const t0 = i / BEAM_STEPS;
        const t1 = (i + 1) / BEAM_STEPS;
        const w0 = baseWidth * (1.0 - t0 * 0.72);
        const w1 = baseWidth * (1.0 - t1 * 0.72);

        const b0 = i * 3, b1 = b0 + 3;
        const p0x = _bPts[b0], p0y = _bPts[b0 + 1], p0z = _bPts[b0 + 2];
        const p1x = _bPts[b1], p1y = _bPts[b1 + 1], p1z = _bPts[b1 + 2];
        const a0x = ax[b0] * w0, a0y = ax[b0 + 1] * w0, a0z = ax[b0 + 2] * w0;
        const a1x = ax[b1] * w1, a1y = ax[b1 + 1] * w1, a1z = ax[b1 + 2] * w1;

        const l0x = p0x - a0x, l0y = p0y - a0y, l0z = p0z - a0z;
        const r0x = p0x + a0x, r0y = p0y + a0y, r0z = p0z + a0z;
        const l1x = p1x - a1x, l1y = p1y - a1y, l1z = p1z - a1z;
        const r1x = p1x + a1x, r1y = p1y + a1y, r1z = p1z + a1z;

        out[o++] = l0x; out[o++] = l0y; out[o++] = l0z; out[o++] = t0; out[o++] = -1;
        out[o++] = r0x; out[o++] = r0y; out[o++] = r0z; out[o++] = t0; out[o++] =  1;
        out[o++] = r1x; out[o++] = r1y; out[o++] = r1z; out[o++] = t1; out[o++] =  1;
        out[o++] = l0x; out[o++] = l0y; out[o++] = l0z; out[o++] = t0; out[o++] = -1;
        out[o++] = r1x; out[o++] = r1y; out[o++] = r1z; out[o++] = t1; out[o++] =  1;
        out[o++] = l1x; out[o++] = l1y; out[o++] = l1z; out[o++] = t1; out[o++] = -1;
      }
    }
  }

  return o / BEAM_FLOATS_PER_VERT;
}
