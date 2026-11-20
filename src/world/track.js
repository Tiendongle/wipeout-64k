// True 3D Wipeout spline track with mouse-shaped oncoming curves (zero warping)
// and rolling hills loosely synced to music energy.

export const SEG_LEN = 3.0;
export const BEHIND_SEGS = 8;
export const AHEAD_SEGS = 128;
export const TOTAL_SEGS = BEHIND_SEGS + AHEAD_SEGS;
export const TRACK_HALF_WIDTH = 9.2;

export class Track {
  constructor() {
    this.dist = 0;
    this.speed = 115; // world units / sec (fast Wipeout feel)
    this.worldYaw = 0;

    this.mouseTarget = 0; // -1..1 from pointer X
    this.mouseSmooth = 0;
    this.hillEnergy = 0.5;
    this.hillPhase = 0;
    this.acidDrive = 0;
    this.camShakeX = 0;
    this.camShakeY = 0;
    this.camDrift = 0;

    // Immutable per-segment curvature & elevation keyed by integer segId
    this._segData = new Map();
    this._maxGenerated = -999999;

    // Pre-allocated frame samples for current render frame (relative to camera origin)
    this.samples = new Array(TOTAL_SEGS + 1);
    for (let i = 0; i <= TOTAL_SEGS; i++) {
      this.samples[i] = {
        s: 0,
        x: 0, y: 0, z: 0,
        fx: 0, fy: 0, fz: -1,
        rx: 1, ry: 0, rz: 0,
        ux: 0, uy: 1, uz: 0,
        yaw: 0,
        pitch: 0,
        bank: 0,
        curv: 0
      };
    }

    this.baseSeg = 0;
    this.camPos = { x: 0, y: 0, z: 0 };
    this.camForward = { x: 0, y: 0, z: -1 };
    this.camUp = { x: 0, y: 1, z: 0 };
    this.camRight = { x: 1, y: 0, z: 0 };
    this.camPitch = 0;
    this.camBank = 0;
    this._camSample = {};
    this._lookSample = {};

    this._ensureGenerated(0);
    this._rebuildSamples();
  }

  setMouseX(normX) {
    // normX in [-1, 1]
    this.mouseTarget = Math.max(-1, Math.min(1, normX));
  }

  _getSeg(id) {
    let d = this._segData.get(id);
    if (d) return d;
    const prev = this._segData.get(id - 1) || { curv: 0, y: 0, slope: 0 };

    // Mouse shapes oncoming curvature smoothly, combined with organic S-curves
    // + Track 4 acid cutoff curvature modulation (immutable once generated!)
    const acidWave = this.acidDrive * 0.0042 * Math.sin(id * 0.078);
    const organic =
      0.0036 * Math.sin(id * 0.043) +
      0.0024 * Math.sin(id * 0.017 + 1.4) + acidWave;
    const targetCurv = this.mouseSmooth * 0.0135 + organic;
    // Clothoid-like smoothing so turns enter and exit gracefully
    const curv = prev.curv + (targetCurv - prev.curv) * 0.14;

    // Rolling hills loosely driven by music energy
    const amp = 11.0 + this.hillEnergy * 16.0;
    const rawY =
      Math.sin(id * 0.052 + 0.3) * amp +
      Math.sin(id * 0.023 - 0.8) * (amp * 0.65) +
      Math.cos(id * 0.095) * (amp * 0.22);
    // Smooth height so hill changes never kink when energy shifts
    const y = prev.y + (rawY - prev.y) * 0.22;

    d = { curv, y };
    this._segData.set(id, d);
    return d;
  }

  _ensureGenerated(baseSeg) {
    const start = baseSeg - BEHIND_SEGS - 2;
    const end = baseSeg + AHEAD_SEGS + 4;
    const from = Math.max(start, this._maxGenerated + 1);
    for (let id = from; id <= end; id++) {
      this._getSeg(id);
    }
    if (end > this._maxGenerated) this._maxGenerated = end;

    // Prune old segments far behind camera
    const pruneBefore = baseSeg - BEHIND_SEGS - 20;
    if (this._segData.size > 400) {
      for (const key of this._segData.keys()) {
        if (key < pruneBefore) this._segData.delete(key);
      }
    }
  }

  update(dt, music) {
    // Smooth mouse steering input (Track 5 padLFO modulates smooth drift damping!)
    const steerDamp = music.mode === 'retrowave' ? (2.6 + (music.padLFO || 0.5) * 2.2) : 4.2;
    this.mouseSmooth += (this.mouseTarget - this.mouseSmooth) * Math.min(1, dt * steerDamp);

    // Track 4 visual sync hook: filterCutoffNormalized + accentTrigger -> oncoming curvature energy
    const targetAcid = music.mode === 'acid'
      ? (music.filterCutoffNormalized || 0) * 0.75 + (music.accentTrigger || 0) * 0.45
      : 0;
    this.acidDrive += (targetAcid - this.acidDrive) * Math.min(1, dt * 6.0);

    // Smooth, low-frequency suspension punch on kick/drop (replaces high-freq 20Hz jitter that looked like stutter!)
    const targetDip = (music.kickTrigger || 0) * 0.055 + (music.stabPulse || 0) * 0.030;
    this.camShakeY += (-targetDip - this.camShakeY) * Math.min(1, dt * 14.0);
    const targetSway = Math.sin(this.dist * 0.035) * ((music.bassEnergy || 0) * 0.045);
    this.camShakeX += (targetSway - this.camShakeX) * Math.min(1, dt * 6.0);
    // Track 5 padLFO & subBassEnvelope smooth atmospheric camera drift
    this.camDrift = music.mode === 'retrowave'
      ? ((music.padLFO || 0.5) - 0.5) * 0.9 + ((music.subBassEnvelope || 0) - 0.5) * 0.25
      : 0;

    // Loose music sync for hill amplitude (slowly tracks energy)
    this.hillEnergy += (music.energy - this.hillEnergy) * Math.min(1, dt * 0.65);

    // Dynamic Wipeout track pace: smooth velocity curve (ship surge handles discrete beat punch!)
    const targetSpeed = 96 + music.energy * 74 + (music.isDrop ? 18 : 0) + music.kick * 6 + (music.bassEnergy || 0) * 8;
    const speedRate = targetSpeed > this.speed ? 4.2 : 2.2;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * speedRate);

    const ds = this.speed * dt;
    const curSeg = this._getSeg(Math.floor(this.dist / SEG_LEN));
    this.worldYaw += curSeg.curv * ds;
    this.dist += ds;

    this.baseSeg = Math.floor(this.dist / SEG_LEN);
    this._ensureGenerated(this.baseSeg);
    this._rebuildSamples();
  }

  _rebuildSamples() {
    const base = this.baseSeg;
    const frac = (this.dist - base * SEG_LEN) / SEG_LEN;

    // Interpolate camera's reference elevation at exact dist
    const s0 = this._getSeg(base);
    const s1 = this._getSeg(base + 1);
    const camTrackY = s0.y + (s1.y - s0.y) * frac;
    const camCurv = s0.curv + (s1.curv - s0.curv) * frac;

    // Anchor node index corresponding to baseSeg is BEHIND_SEGS.
    // Integrate forward from camera (dist) and backward from camera so camera sits cleanly at (0,0,0) heading -Z.
    const anchor = BEHIND_SEGS;

    // Forward from exact camera position
    let yaw = -camCurv * frac * SEG_LEN;
    let x = 0;
    let z = frac * SEG_LEN;

    for (let i = anchor; i <= TOTAL_SEGS; i++) {
      const segId = base + (i - anchor);
      const sd = this._getSeg(segId);
      const sample = this.samples[i];
      sample.s = segId * SEG_LEN;
      sample.x = x;
      sample.y = sd.y - camTrackY;
      sample.z = z;
      sample.yaw = yaw;
      sample.curv = sd.curv;
      sample.bank = -sd.curv * 26.0; // bank into turns

      const midYaw = yaw + sd.curv * SEG_LEN * 0.5;
      x += Math.sin(midYaw) * SEG_LEN;
      z -= Math.cos(midYaw) * SEG_LEN;
      yaw += sd.curv * SEG_LEN;
    }

    // Backward behind camera
    yaw = -camCurv * frac * SEG_LEN;
    x = 0;
    z = frac * SEG_LEN;
    for (let i = anchor - 1; i >= 0; i--) {
      const segId = base + (i - anchor);
      const sd = this._getSeg(segId);
      const midYaw = yaw - sd.curv * SEG_LEN * 0.5;
      x -= Math.sin(midYaw) * SEG_LEN;
      z += Math.cos(midYaw) * SEG_LEN;
      yaw -= sd.curv * SEG_LEN;

      const sample = this.samples[i];
      sample.s = segId * SEG_LEN;
      sample.x = x;
      sample.y = sd.y - camTrackY;
      sample.z = z;
      sample.yaw = yaw;
      sample.curv = sd.curv;
      sample.bank = -sd.curv * 26.0;
    }

    // Compute smooth tangent (forward), right, and banked up vectors for every sample
    for (let i = 0; i <= TOTAL_SEGS; i++) {
      const prev = this.samples[Math.max(0, i - 1)];
      const next = this.samples[Math.min(TOTAL_SEGS, i + 1)];
      let fx = next.x - prev.x;
      let fy = next.y - prev.y;
      let fz = next.z - prev.z;
      const fl = Math.hypot(fx, fy, fz) || 1;
      fx /= fl; fy /= fl; fz /= fl;

      // Horizontal right perpendicular to forward & world Y
      let rx = -fz;
      let ry = 0;
      let rz = fx;
      const rl = Math.hypot(rx, rz) || 1;
      rx /= rl; rz /= rl;

      // Unbanked up = right x forward
      let ux = ry * fz - rz * fy;
      let uy = rz * fx - rx * fz;
      let uz = rx * fy - ry * fx;

      // Apply track bank around forward axis
      const b = this.samples[i].bank;
      const cb = Math.cos(b);
      const sb = Math.sin(b);

      const brx = rx * cb + ux * sb;
      const bry = ry * cb + uy * sb;
      const brz = rz * cb + uz * sb;

      const bux = ux * cb - rx * sb;
      const buy = uy * cb - ry * sb;
      const buz = uz * cb - rz * sb;

      const sm = this.samples[i];
      sm.fx = fx; sm.fy = fy; sm.fz = fz;
      sm.rx = brx; sm.ry = bry; sm.rz = brz;
      sm.ux = bux; sm.uy = buy; sm.uz = buz;
      sm.pitch = Math.asin(Math.max(-0.9, Math.min(0.9, fy)));
    }

    // Update camera frame (zero per-frame object allocations!)
    const camFrame = this.sampleAt(this.dist, this._camSample);
    const lookFrame = this.sampleAt(this.dist + 28.0, this._lookSample);
    const camLat = this.camShakeX + this.camDrift * 0.45;
    const camUpOff = 4.4 + this.camShakeY + this.camDrift * 0.18;
    this.camPos.x = camFrame.x + camFrame.ux * camUpOff + camFrame.rx * camLat;
    this.camPos.y = camFrame.y + camFrame.uy * camUpOff + camFrame.ry * camLat;
    this.camPos.z = camFrame.z + camFrame.uz * camUpOff + camFrame.rz * camLat;

    let lx = (lookFrame.x + lookFrame.ux * 2.2) - this.camPos.x;
    let ly = (lookFrame.y + lookFrame.uy * 2.2) - this.camPos.y;
    let lz = (lookFrame.z + lookFrame.uz * 2.2) - this.camPos.z;
    const ll = Math.hypot(lx, ly, lz) || 1;
    this.camForward.x = lx / ll;
    this.camForward.y = ly / ll;
    this.camForward.z = lz / ll;

    // Camera banks gently (35% of track bank) for visceral Wipeout feel
    const cb = Math.cos(camFrame.bank * 0.35);
    const sb = Math.sin(camFrame.bank * 0.35);
    const worldUpX = sb;
    const worldUpY = cb;
    const worldUpZ = 0;

    // right = forward x worldUp
    let rx = this.camForward.y * worldUpZ - this.camForward.z * worldUpY;
    let ry = this.camForward.z * worldUpX - this.camForward.x * worldUpZ;
    let rz = this.camForward.x * worldUpY - this.camForward.y * worldUpX;
    const rl = Math.hypot(rx, ry, rz) || 1;
    this.camRight.x = rx / rl;
    this.camRight.y = ry / rl;
    this.camRight.z = rz / rl;

    // up = right x forward
    this.camUp.x = this.camRight.y * this.camForward.z - this.camRight.z * this.camForward.y;
    this.camUp.y = this.camRight.z * this.camForward.x - this.camRight.x * this.camForward.z;
    this.camUp.z = this.camRight.x * this.camForward.y - this.camRight.y * this.camForward.x;

    this.camPitch = Math.asin(Math.max(-0.9, Math.min(0.9, this.camForward.y)));
    this.camBank = camFrame.bank * 0.35;
  }

  sampleAt(worldS, out = {}) {
    const startS = this.samples[0].s;
    const fIdx = (worldS - startS) / SEG_LEN;
    const i0 = Math.max(0, Math.min(TOTAL_SEGS - 1, Math.floor(fIdx)));
    const i1 = i0 + 1;
    const t = Math.max(0, Math.min(1, fIdx - i0));
    const a = this.samples[i0];
    const b = this.samples[i1];

    out.s = worldS;
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
    out.fx = a.fx + (b.fx - a.fx) * t;
    out.fy = a.fy + (b.fy - a.fy) * t;
    out.fz = a.fz + (b.fz - a.fz) * t;
    const fl = Math.hypot(out.fx, out.fy, out.fz) || 1;
    out.fx /= fl; out.fy /= fl; out.fz /= fl;

    out.rx = a.rx + (b.rx - a.rx) * t;
    out.ry = a.ry + (b.ry - a.ry) * t;
    out.rz = a.rz + (b.rz - a.rz) * t;
    const rl = Math.hypot(out.rx, out.ry, out.rz) || 1;
    out.rx /= rl; out.ry /= rl; out.rz /= rl;

    out.ux = a.ux + (b.ux - a.ux) * t;
    out.uy = a.uy + (b.uy - a.uy) * t;
    out.uz = a.uz + (b.uz - a.uz) * t;
    const ul = Math.hypot(out.ux, out.uy, out.uz) || 1;
    out.ux /= ul; out.uy /= ul; out.uz /= ul;

    out.curv = a.curv + (b.curv - a.curv) * t;
    out.bank = a.bank + (b.bank - a.bank) * t;
    out.pitch = a.pitch + (b.pitch - a.pitch) * t;
    return out;
  }
}
