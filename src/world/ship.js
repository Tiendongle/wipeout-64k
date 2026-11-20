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

    // Disconnected track jump airborne state
    this.airH = 0.0;
    this.airPitch = 0.0;
    this.inAir = 0;
    this._wasInAir = 0;
    this._airState = { inAir: 0, u: 0, airY: 0, airPitch: 0, isMega: 0 };

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
    const sustainedHigh = this.relS > 17.5 || (music.energy > 0.72 && (music.isDrop || music.energy > 0.82));
    if (sustainedHigh) {
      this.surgeHold = Math.min(4.2, this.surgeHold + dt);
    } else {
      this.surgeHold = Math.max(0.0, this.surgeHold - dt * 1.1);
    }
    // Delay camera catch-up (~1.45s) so the craft pulls away dramatically first, then smoothly reels back in!
    const targetCatch = Math.max(0.0, Math.min(1.0, (this.surgeHold - 1.45) / 1.85));
    this.catchUp += (targetCatch - this.catchUp) * Math.min(1, dt * 2.0);

    // Rest distance pulls right back into immersive close range (~12.4u) once camera catches up!
    const rawRest = 11.4 + music.energy * 5.6 + (music.isDrop ? 3.8 : 0.0);
    const restS = rawRest + (12.4 - rawRest) * (this.catchUp * 0.80);

    // Check physical beat-synced Speed Pad crossings on the track!
    const padHit = track.updatePads(dt, this.worldS);
    const hasKick = music.kickId !== this._lastKickId;
    if (hasKick) this._lastKickId = music.kickId;

    // Check if an unhit speed pad is very close ahead (let the physical pad crossing trigger the surge!)
    let padImminent = false;
    for (let i = 0; i < track.speedPads.length; i++) {
      const dsPad = track.speedPads[i].s - this.worldS;
      if (dsPad > -6.0 && dsPad < 28.0) { padImminent = true; break; }
    }

    // Fire crisp forward surge right as the craft flies over a beat-synced Speed Pad
    // (or on audio kick fallback if no pad is lined up yet during initial 1.5s)
    if (padHit === 2) {
      // MEGA-LAUNCH ramp pad at the lip of a disconnected track drop!
      this.surgeHold = 0.0;
      this.catchUp *= 0.15;
      this.relVel = Math.max(this.relVel, 108.0);
      this.thrust = 2.0;
    } else if (padHit === 1 || (hasKick && !padImminent)) {
      const distDamp = Math.max(0.28, 1.0 - Math.max(0.0, this.relS - 16.0) / 24.0);
      const catchDamp = 1.0 - this.catchUp * 0.44;
      const kickPush = (18.5 + music.energy * 24.0 + (music.bassEnergy || 0) * 12.0 + (music.isDrop ? 11.0 : 0.0)) * distDamp * catchDamp;
      this.relVel = Math.min(90.0, this.relVel + kickPush);
      this.thrust = Math.min(1.95, Math.max(this.thrust, 0.85 + music.energy * 0.78 + (music.subBassPunch || 0) * 0.35));
    }

    // Big DROP impact: ensures explosive afterburner surge right as the beat drops!
    if (music.dropId !== this._lastDropId) {
      this._lastDropId = music.dropId;
      this.surgeHold = 0.0;
      this.catchUp *= 0.15;
      this.relVel = Math.max(this.relVel, 118.0);
      this.thrust = 2.0;
    }

    // Thruster visual glow decays crisply between beats so each beat flashes cleanly
    const baseThrust = 0.16 + music.energy * 0.36 + (music.isRoll ? 0.35 : 0.0) + this.catchUp * 0.28;
    this.thrust += (baseThrust - this.thrust) * Math.min(1, dt * 6.5);

    // Elastic camera catch-up spring: tightens smoothly after the delayed surge hold!
    const springK = 5.4 + this.catchUp * 11.0;
    const dragC = 3.8 + this.catchUp * 3.4;
    const accel = -springK * (this.relS - restS) - dragC * this.relVel;
    this.relVel += accel * dt;
    this.relS += this.relVel * dt;

    // Clamp to Wipeout close-to-far range (10 = tight hero view, 54 = peak drop separation)
    if (this.relS < 10.0) {
      this.relS = 10.0;
      if (this.relVel < 0) this.relVel *= -0.15;
    } else if (this.relS > 54.0) {
      this.relS = 54.0;
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

    // 3. Strong underpressure / ground-effect suspension + ballistic airborne arc over disconnected track jumps!
    const air = track.getAirState(this.worldS, this._airState);
    this.inAir = air.inAir;
    if (this._wasInAir && !this.inAir) {
      // Touchdown onto lower landing deck: crisp ground-effect cushion compression + thruster flare!
      this.hoverVel = -4.2;
      this.thrust = Math.max(this.thrust, 1.55);
    }
    this._wasInAir = this.inAir;
    this.airH += (air.airY - this.airH) * Math.min(1, dt * (this.inAir ? 18.0 : 14.0));
    this.airPitch += (air.airPitch - this.airPitch) * Math.min(1, dt * 10.0);

    const slopeDelta = (frame.pitch - this._prevSlope) / Math.max(0.008, dt);
    this._prevSlope = frame.pitch;
    const bumpCompression = this.inAir ? 0 : Math.max(-0.16, Math.min(0.16, -slopeDelta * 0.04));
    const antiGravFloat = music.mode === 'retrowave' ? ((music.subBassEnvelope || 0) * 0.12) : 0.0;
    const targetH = 0.78 + bumpCompression + antiGravFloat + Math.sin(nowSec * 22.0) * 0.018;
    const hForce = (targetH - this.hoverH) * 85.0 - this.hoverVel * 16.0;
    this.hoverVel += hForce * dt;
    this.hoverH = Math.max(0.46, Math.min(1.06, this.hoverH + this.hoverVel * dt));

    // 4. Roll into corners & lateral velocity; pitch arcs smoothly over disconnected skyway jumps!
    const targetRoll = -frame.curv * 42.0 - this.latVel * 0.09;
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 8.0);
    const targetPitchOff = -Math.max(0, this.relVel) * 0.0022 + this.airPitch;
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

    const totalH = this.hoverH + this.airH;
    this.pos[0] = frame.x + frame.rx * this.lat + frame.ux * totalH;
    this.pos[1] = frame.y + frame.ry * this.lat + frame.uy * totalH;
    this.pos[2] = frame.z + frame.rz * this.lat + frame.uz * totalH;

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
