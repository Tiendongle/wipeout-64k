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

    // Immutable per-segment curvature, elevation & gap flag keyed by integer segId
    this._segData = new Map();
    this._maxGenerated = -999999;
    this._yOffset = 0;

    // Beat-synced world-space Speed Pads & Disconnected Track Jumps
    this.speedPads = [];
    this.jumps = [];

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
        curv: 0,
        gap: 0
      };
    }

    this.baseSeg = 0;
    this.camTrackY = 0;
    this.camPos = { x: 0, y: 0, z: 0 };
    this.camForward = { x: 0, y: 0, z: -1 };
    this.camUp = { x: 0, y: 1, z: 0 };
    this.camRight = { x: 1, y: 0, z: 0 };
    this.camPitch = 0;
    this.camBank = 0;
    this._camSample = {};
    this._lookSample = {};
    this._camSurf = { y: 0, slope: 0, hasRoad: 1 };
    this._camLift = 0;
    this._lookLift = 0;
    this._targetShipClearance = 0;
    this._dt = 0.016;

    this._ensureGenerated(0);
    this._rebuildSamples();
  }

  setMouseX(normX) {
    // normX in [-1, 1]
    this.mouseTarget = Math.max(-1, Math.min(1, normX));
  }

  setShipClearance(clearance) {
    this._targetShipClearance = Math.max(0, clearance);
  }

  isInGap(worldS) {
    for (let i = 0; i < this.jumps.length; i++) {
      const j = this.jumps[i];
      if (worldS >= j.launchS - 6.0 && worldS <= j.landS + 6.0) return true;
    }
    return false;
  }

  // Smooth C1 road presence weight (1 = solid road, 0 = inside chasm, smooth 6u transitions at lips!)
  getRoadWeight(worldS) {
    let w = 1.0;
    for (let i = 0; i < this.jumps.length; i++) {
      const j = this.jumps[i];
      if (worldS > j.launchS - 6.0 && worldS < j.landS + 6.0) {
        const enter = Math.max(0, Math.min(1, (j.launchS - worldS) / 6.0));
        const exit = Math.max(0, Math.min(1, (worldS - j.landS) / 6.0));
        const t = Math.max(enter, exit);
        const sm = t * t * (3.0 - 2.0 * t);
        if (sm < w) w = sm;
      }
    }
    return w;
  }

  // True persistent world-space track surface height, tangent slope (dy/ds), solid-road & launch-ramp flags
  getSurfaceAt(worldS, out) {
    const fSeg = worldS / SEG_LEN;
    const i0 = Math.floor(fSeg);
    const frac = fSeg - i0;
    const s0 = this._getSeg(i0);
    const s1 = this._getSeg(i0 + 1);
    out.y = s0.y + (s1.y - s0.y) * frac;
    out.slope = (s1.y - s0.y) / SEG_LEN;
    out.hasRoad = (s0.gap || s1.gap) ? 0 : 1;
    out.isRamp = (s0.ramp || s1.ramp) ? 1 : 0;
    return out;
  }

  spawnSpeedPad(worldS, isLaunch = 0) {
    if (!isLaunch && this.isInGap(worldS)) return;
    for (let i = 0; i < this.speedPads.length; i++) {
      if (Math.abs(this.speedPads[i].s - worldS) < 15.0) return;
    }
    this.speedPads.push({
      s: worldS,
      halfLen: isLaunch ? 9.0 : 4.8,
      flash: 0.0,
      kind: isLaunch ? 1.0 : 0.0,
      hit: false
    });
    if (this.speedPads.length > 24) this.speedPads.shift();
  }

  scheduleJump(targetWorldS, isMega = 0) {
    // Place jump safely past _maxGenerated so ramp, chasm, and lower deck bake immutably beyond horizon fog!
    const rampLen = isMega ? 14 : 12;
    const minStart = this._maxGenerated + rampLen + 4;
    const startSeg = Math.max(minStart, Math.round(targetWorldS / SEG_LEN));
    for (let i = 0; i < this.jumps.length; i++) {
      if (Math.abs(this.jumps[i].startSeg - startSeg) < 90) return null;
    }
    // Crisp Wipeout skyway gaps tuned for weighty gravity (g = 135) & sloped landing catch ramp!
    const gapSegs = isMega ? 32 : 24; // 96u chasm for BIG DROP, 72u chasm for chorus jump
    const endSeg = startSeg + gapSegs;
    const dropY = isMega ? -15.0 : -11.0;
    const launchS = startSeg * SEG_LEN;
    const landS = endSeg * SEG_LEN;
    const jump = {
      startSeg, endSeg, rampLen,
      launchS, landS,
      dropY,
      launchY: 0,
      appliedOffset: false,
      isMega: isMega ? 1 : 0
    };
    this.jumps.push(jump);
    if (this.jumps.length > 6) this.jumps.shift();

    // Place a blazing full-width launch boost pad right on the ski-jump lip!
    this.spawnSpeedPad((startSeg - 3.0) * SEG_LEN, 1);
    return jump;
  }

  updatePads(dt, shipWorldS) {
    let hitType = 0;
    for (let i = this.speedPads.length - 1; i >= 0; i--) {
      const p = this.speedPads[i];
      if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 3.4);
      if (!p.hit && shipWorldS >= p.s - 3.5 && shipWorldS <= p.s + 11.0) {
        p.hit = true;
        p.flash = 1.0;
        hitType = Math.max(hitType, p.kind > 0.5 ? 2 : 1);
      }
      if (p.s < this.dist - 24.0) {
        this.speedPads.splice(i, 1);
      }
    }
    // Prune completed jumps far behind camera (after flare zone!)
    for (let i = this.jumps.length - 1; i >= 0; i--) {
      if (this.jumps[i].landS < this.dist - 120.0) {
        this.jumps.splice(i, 1);
      }
    }
    return hitType;
  }

  _getSeg(id) {
    let d = this._segData.get(id);
    if (d) return d;
    const prev = this._segData.get(id - 1) || { curv: 0, y: 0, baseY: 0, gap: 0, ramp: 0 };

    // Check if segment belongs to an immutable disconnected track jump (including 14-seg sloped catch runway)!
    let activeJump = null;
    for (let i = 0; i < this.jumps.length; i++) {
      const j = this.jumps[i];
      if (id >= j.startSeg - j.rampLen && id <= j.endSeg + 14) {
        activeJump = j;
        break;
      }
    }

    const acidWave = this.acidDrive * 0.0042 * Math.sin(id * 0.078);
    const organic =
      0.0036 * Math.sin(id * 0.043) +
      0.0024 * Math.sin(id * 0.017 + 1.4) + acidWave;
    const targetCurv = (activeJump && id > activeJump.startSeg - 4)
      ? (this.mouseSmooth * 0.004 + organic * 0.35) // straighter sightline across the disconnected chasm!
      : (this.mouseSmooth * 0.0135 + organic);
    const curv = prev.curv + (targetCurv - prev.curv) * 0.14;

    const amp = 11.0 + this.hillEnergy * 16.0;
    const rawY =
      Math.sin(id * 0.052 + 0.3) * amp +
      Math.sin(id * 0.023 - 0.8) * (amp * 0.65) +
      Math.cos(id * 0.095) * (amp * 0.22) + this._yOffset;
    // Damp underlying hill slope during a jump ramp so crest + ramp never double-stack into a floaty launch!
    const hillBlend = (activeJump && id <= activeJump.startSeg) ? 0.08 : 0.22;
    const baseY = prev.baseY + (rawY - prev.baseY) * hillBlend;
    let y = baseY;
    let gap = 0;
    let ramp = 0;

    if (activeJump) {
      if (id <= activeJump.startSeg) {
        // Non-compounding smooth ski-jump ramp (exact +3.2u / +4.8u lift — never compounds into a wall!)
        ramp = 1;
        const u = (id - (activeJump.startSeg - activeJump.rampLen)) / activeJump.rampLen;
        const lift = u * u * (activeJump.isMega ? 4.8 : 3.2);
        y = baseY + lift;
        if (id === activeJump.startSeg) activeJump.launchY = y;
      } else if (id < activeJump.endSeg) {
        // Disconnected open-sky chasm: hide road geometry while descending smoothly toward lower landing deck!
        gap = 1;
        const u = (id - activeJump.startSeg) / (activeJump.endSeg - activeJump.startSeg);
        y = activeJump.launchY + activeJump.dropY * (u * u * (3 - 2 * u));
      } else if (id === activeJump.endSeg) {
        // Landing lip: adopt dropped elevation cleanly, followed by a gentle downward ski-jump catch slope!
        const catchDrop = activeJump.isMega ? -3.6 : -2.4;
        if (!activeJump.appliedOffset) {
          this._yOffset += activeJump.dropY + catchDrop;
          activeJump.appliedOffset = true;
        }
        y = activeJump.launchY + activeJump.dropY;
      } else {
        // Downward-sloped ski-jump landing catch runway (curves smoothly from tangent descent to level!)
        const catchDrop = activeJump.isMega ? -3.6 : -2.4;
        const landY = activeJump.launchY + activeJump.dropY;
        const t = (id - activeJump.endSeg) / 14.0;
        const catchY = landY + catchDrop * (1.0 - (1.0 - t) * (1.0 - t));
        y = catchY + (baseY - catchY) * (t * t * t);
      }
    }

    d = { curv, y, baseY: gap ? y : (activeJump && id > activeJump.endSeg ? y : baseY), gap, ramp };
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

  update(dt, music, catchUp = 0) {
    this._dt = dt;
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

    // Dynamic Wipeout track pace: camera accelerates forward into slipstream when catchUp engages!
    const targetSpeed = 96 + music.energy * 74 + (music.isDrop ? 18 : 0) + catchUp * 34 + music.kick * 6 + (music.bassEnergy || 0) * 8;
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
    this.camTrackY = camTrackY;
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
      sample.gap = sd.gap || 0;

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
      sample.gap = sd.gap || 0;
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

    // Update camera frame tracking the real physics-simulated ship height (no canned jump curves!)
    const camFrame = this.sampleAt(this.dist, this._camSample);
    const lookFrame = this.sampleAt(this.dist + 28.0, this._lookSample);
    const camLat = this.camShakeX + this.camDrift * 0.45;
    const camUpOff = 4.4 + this.camShakeY + this.camDrift * 0.18;
    const shipAir = Math.max(0, this._targetShipClearance - 0.84);
    // Keep chase camera planted with the craft (no lingering high float after landing!)
    const targetCamLift = shipAir * 0.56;
    const targetLookLift = shipAir * 0.72;
    this._camLift += (targetCamLift - this._camLift) * Math.min(1, this._dt * (targetCamLift > this._camLift ? 14.0 : 11.5));
    this._lookLift += (targetLookLift - this._lookLift) * Math.min(1, this._dt * (targetLookLift > this._lookLift ? 14.0 : 11.5));
    this.camPos.x = camFrame.x + camFrame.ux * camUpOff + camFrame.rx * camLat;
    this.camPos.y = camFrame.y + camFrame.uy * camUpOff + camFrame.ry * camLat + this._camLift;
    this.camPos.z = camFrame.z + camFrame.uz * camUpOff + camFrame.rz * camLat;

    // Keep the airborne craft cleanly centered across crests, ramps, and landings!
    let lx = (lookFrame.x + lookFrame.ux * 2.2) - this.camPos.x;
    let ly = (lookFrame.y + lookFrame.uy * 2.2 + this._lookLift) - this.camPos.y;
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
