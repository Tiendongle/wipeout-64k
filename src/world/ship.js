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

    // Sustained high-speed camera catch-up state (0 = normal elastic gap, 1 = camera locked in slipstream!)
    this.surgeHold = 0.0;
    this.catchUp = 0.0;

    // Reusable sample objects (zero per-frame allocations!)
    this._sample = {};
    this._lookSample = {};
    this._prevSlope = 0;
    this._lastKickId = 0;
    this._lastDropId = 0;
  }

  update(dt, track, music, nowSec) {
    // 1. Crisp elastic surge physics with sustained-surge camera catch-up!
    // When high speed / far surge is sustained, the camera guns its chase velocity to reel
    // the craft right back into tight, immersive hero framing behind the twin plasma exhausts!
    const sustainedHigh = this.relS > 17.0 || (music.energy > 0.72 && (music.isDrop || music.energy > 0.82));
    if (sustainedHigh) {
      this.surgeHold = Math.min(2.6, this.surgeHold + dt * (this.relS > 22.0 ? 1.45 : 0.85));
    } else {
      this.surgeHold = Math.max(0.0, this.surgeHold - dt * 1.15);
    }
    // Smoothly engage camera catch-up after ~0.45s of sustained surge
    const targetCatch = Math.max(0.0, Math.min(1.0, (this.surgeHold - 0.45) / 1.15));
    this.catchUp += (targetCatch - this.catchUp) * Math.min(1, dt * 3.2);

    // Rest distance pulls right back into immersive close range (~12.2u) once camera catches up!
    const rawRest = 11.2 + music.energy * 5.2 + (music.isDrop ? 3.2 : 0.0);
    const restS = rawRest + (12.2 - rawRest) * (this.catchUp * 0.82);

    // Discrete kick-drum thrust impulse — tapered when ship is already far ahead so rapid
    // 150-160 BPM beats punch crisply without pinning the craft far away forever!
    if (music.kickId !== this._lastKickId) {
      this._lastKickId = music.kickId;
      const distDamp = Math.max(0.26, 1.0 - Math.max(0.0, this.relS - 13.5) / 20.0);
      const catchDamp = 1.0 - this.catchUp * 0.42;
      const kickPush = (16.0 + music.energy * 22.0 + (music.bassEnergy || 0) * 12.0 + (music.isDrop ? 10.0 : 0.0)) * distDamp * catchDamp;
      this.relVel = Math.min(82.0, this.relVel + kickPush);
      this.thrust = Math.min(1.90, Math.max(this.thrust, 0.75 + music.energy * 0.75 + (music.subBassPunch || 0) * 0.35));
    }

    // Big DROP impact: dramatic initial afterburner launch, then camera accelerates to catch up!
    if (music.dropId !== this._lastDropId) {
      this._lastDropId = music.dropId;
      this.surgeHold = 0.0; // allow fresh dramatic separation before camera catches up!
      this.catchUp *= 0.25;
      this.relVel = Math.max(this.relVel, 108.0);
      this.thrust = 2.0;
    }

    // Thruster visual glow decays crisply between beats so each beat flashes cleanly
    const baseThrust = 0.16 + music.energy * 0.36 + (music.isRoll ? 0.35 : 0.0) + this.catchUp * 0.28;
    this.thrust += (baseThrust - this.thrust) * Math.min(1, dt * 6.5);

    // Elastic camera catch-up spring: tightens dramatically as catchUp engages so camera reels ship back!
    const springK = 5.8 + this.catchUp * 11.5;
    const dragC = 4.0 + this.catchUp * 3.4;
    const accel = -springK * (this.relS - restS) - dragC * this.relVel;
    this.relVel += accel * dt;
    this.relS += this.relVel * dt;

    // Clamp to Wipeout close-to-far range (10 = tight hero view, 48 = peak drop separation)
    if (this.relS < 10.0) {
      this.relS = 10.0;
      if (this.relVel < 0) this.relVel *= -0.15;
    } else if (this.relS > 48.0) {
      this.relS = 48.0;
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

    // 5. Continuous thruster beam length & intensity (stays blazing bright even after camera catches up!)
    const speedFactor = Math.max(0, (this.relS - 10.0) / 42.0);
    const velBoost = Math.max(0, this.relVel * 0.65);
    const subScale = (music.subBassPunch || 0) * 14.0;
    const targetBeamLen = 6.5 + speedFactor * 34.0 + this.catchUp * 16.0 + velBoost + this.thrust * 13.0 + subScale;
    const beamRate = targetBeamLen > this.beamLength ? 16.0 : 6.0;
    this.beamLength += (targetBeamLen - this.beamLength) * Math.min(1, dt * beamRate);
    this.beamIntensity = Math.min(2.25, 0.45 + this.thrust * 0.78 + speedFactor * 0.40 + this.catchUp * 0.32 + (music.subBassPunch || 0) * 0.42);

    // Telemetry KPH (stays screaming high during sustained catch-up chase!)
    const targetKph = 440 + (track.speed - 96) * 4.5 + speedFactor * 280 + this.catchUp * 185 + Math.max(0, this.relVel) * 8.5 + music.kick * 45;
    this.kph += (targetKph - this.kph) * Math.min(1, dt * 9.0);
  }
}
