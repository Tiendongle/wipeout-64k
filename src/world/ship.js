// Autonomous Wipeout craft with strong ground-effect underpressure,
// thrust-based close-to-far speed surge, and continuous twin thruster beam trails.

export class Ship {
  constructor() {
    // Relative distance ahead of camera along track spline
    // Spans close hero view (~11) to far down-track surge (~62)
    this.relS = 14.0;
    this.relVel = 0.0;
    this.thrust = 0.25;

    // Lateral racing line (-1..1 of usable lane width)
    this.lat = 0.0;
    this.latVel = 0.0;

    // Ground-effect hover clearance (tight, low-pressure hug over bumps)
    this.hoverH = 0.82;
    this.hoverVel = 0.0;

    // Orientation smoothing
    this.roll = 0.0;
    this.pitchOffset = 0.0;

    // Current world-space transform (relative to camera origin)
    this.worldS = 14.0;
    this.pos = [0, 0, -14];
    this.right = [1, 0, 0];
    this.up = [0, 1, 0];
    this.forward = [0, 0, -1];

    // Display KPH telemetry
    this.kph = 580;

    // Continuous thruster beam trail length (world units behind ship)
    this.beamLength = 12.0;
    this.beamIntensity = 0.6;

    // Reusable sample objects (zero per-frame allocations!)
    this._sample = {};
    this._lookSample = {};
    this._prevSlope = 0;
    this._lastKickId = 0;
    this._lastDropId = 0;
  }

  update(dt, track, music, nowSec) {
    // 1. Crisp, elastic beat-locked surge physics!
    // Base resting distance stays comfortably close so the camera always catches up.
    const restS = 11.0 + music.energy * 6.5 + (music.isDrop ? 3.5 : 0.0);

    // Discrete kick-drum thrust impulse boosted by Track 1 FFT bassEnergy!
    if (music.kickId !== this._lastKickId) {
      this._lastKickId = music.kickId;
      const kickPush = 18.0 + music.energy * 26.0 + (music.bassEnergy || 0) * 14.0 + (music.isDrop ? 12.0 : 0.0);
      this.relVel = Math.min(95.0, this.relVel + kickPush);
      this.thrust = Math.min(1.90, Math.max(this.thrust, 0.75 + music.energy * 0.75 + (music.subBassPunch || 0) * 0.35));
    }

    // Big DROP impact: dramatic full-track afterburner launch (close -> far ~58u),
    // then the camera smoothly reels the craft back over ~2 seconds!
    if (music.dropId !== this._lastDropId) {
      this._lastDropId = music.dropId;
      this.relVel = Math.max(this.relVel, 128.0);
      this.thrust = 2.0;
    }

    // Thruster visual glow decays crisply between beats so each beat flashes cleanly
    const baseThrust = 0.16 + music.energy * 0.36 + (music.isRoll ? 0.35 : 0.0);
    this.thrust += (baseThrust - this.thrust) * Math.min(1, dt * 6.5);

    // Elastic camera catch-up spring (strong enough that the camera ALWAYS catches up!)
    const springK = 5.4;
    const dragC = 3.7;
    const accel = -springK * (this.relS - restS) - dragC * this.relVel;
    this.relVel += accel * dt;
    this.relS += this.relVel * dt;

    // Clamp to Wipeout close-to-far range (10 = close hero view, 62 = far drop peak)
    if (this.relS < 10.0) {
      this.relS = 10.0;
      if (this.relVel < 0) this.relVel *= -0.15;
    } else if (this.relS > 62.0) {
      this.relS = 62.0;
      if (this.relVel > 0) this.relVel *= 0.1;
    }

    this.worldS = track.dist + this.relS;
    const frame = track.sampleAt(this.worldS, this._sample);

    // 2. Autonomous racing line: hugs inside apex of curves + subtle organic weave
    const lookAhead = track.sampleAt(this.worldS + 26.0, this._lookSample);
    const apexTarget = Math.max(-3.6, Math.min(3.6, lookAhead.curv * 290.0)) +
      Math.sin(nowSec * 0.75) * 0.85;
    const latForce = (apexTarget - this.lat) * 8.5 - this.latVel * 4.8;
    this.latVel += latForce * dt;
    this.lat += this.latVel * dt;

    // 3. Strong underpressure / ground-effect suspension over bumps & hills
    // High stiffness + strong damping keeps hover tightly glued to track surface
    const slopeDelta = (frame.pitch - this._prevSlope) / Math.max(0.008, dt);
    this._prevSlope = frame.pitch;
    const bumpCompression = Math.max(-0.16, Math.min(0.16, -slopeDelta * 0.04));
    const antiGravFloat = music.mode === 'retrowave' ? ((music.subBassEnvelope || 0) * 0.12) : 0.0;
    const targetH = 0.78 + bumpCompression + antiGravFloat + Math.sin(nowSec * 22.0) * 0.018;
    const hForce = (targetH - this.hoverH) * 85.0 - this.hoverVel * 16.0;
    this.hoverVel += hForce * dt;
    this.hoverH = Math.max(0.56, Math.min(1.02, this.hoverH + this.hoverVel * dt));

    // 4. Roll into corners & lateral velocity; pitch tightly hugs track slope
    const targetRoll = -frame.curv * 42.0 - this.latVel * 0.09;
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 8.0);
    // Tiny nose-down under hard thrust, nose-level at cruise
    const targetPitchOff = -Math.max(0, this.relVel) * 0.0022;
    this.pitchOffset += (targetPitchOff - this.pitchOffset) * Math.min(1, dt * 10.0);

    // Build ship world basis from track frame + local roll + tiny pitchOffset
    const cr = Math.cos(this.roll);
    const sr = Math.sin(this.roll);

    let rx = frame.rx * cr + frame.ux * sr;
    let ry = frame.ry * cr + frame.uy * sr;
    let rz = frame.rz * cr + frame.uz * sr;

    let ux = frame.ux * cr - frame.rx * sr;
    let uy = frame.uy * cr - frame.ry * sr;
    let uz = frame.uz * cr - frame.rz * sr;

    const cp = Math.cos(this.pitchOffset);
    const sp = Math.sin(this.pitchOffset);
    const fx = frame.fx * cp + ux * sp;
    const fy = frame.fy * cp + uy * sp;
    const fz = frame.fz * cp + uz * sp;

    const nux = ux * cp - frame.fx * sp;
    const nuy = uy * cp - frame.fy * sp;
    const nuz = uz * cp - frame.fz * sp;

    this.right[0] = rx; this.right[1] = ry; this.right[2] = rz;
    this.up[0] = nux; this.up[1] = nuy; this.up[2] = nuz;
    this.forward[0] = fx; this.forward[1] = fy; this.forward[2] = fz;

    this.pos[0] = frame.x + frame.rx * this.lat + frame.ux * this.hoverH;
    this.pos[1] = frame.y + frame.ry * this.lat + frame.uy * this.hoverH;
    this.pos[2] = frame.z + frame.rz * this.lat + frame.uz * this.hoverH;

    // 5. Continuous thruster beam length & intensity (Track 2 subBassPunch drives exhaust scale!)
    const speedFactor = Math.max(0, (this.relS - 10.0) / 56.0);
    const velBoost = Math.max(0, this.relVel * 0.65);
    const subScale = (music.subBassPunch || 0) * 14.0;
    const targetBeamLen = 6.5 + speedFactor * 36.0 + velBoost + this.thrust * 13.0 + subScale;
    const beamRate = targetBeamLen > this.beamLength ? 16.0 : 6.0;
    this.beamLength += (targetBeamLen - this.beamLength) * Math.min(1, dt * beamRate);
    this.beamIntensity = Math.min(2.25, 0.45 + this.thrust * 0.78 + speedFactor * 0.45 + (music.subBassPunch || 0) * 0.42);

    // Telemetry KPH (wide dynamic range: ~440 KPH in breakdown -> ~1280 KPH on drops + beat pulses)
    const targetKph = 440 + (track.speed - 92) * 4.4 + speedFactor * 360 + Math.max(0, this.relVel) * 9.0 + music.kick * 48;
    this.kph += (targetKph - this.kph) * Math.min(1, dt * 9.0);
  }
}
