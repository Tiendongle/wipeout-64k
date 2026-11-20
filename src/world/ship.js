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

    // True Newtonian world-space vertical physics (weighty gravity + one-sided progressive air-cushion!)
    this.hoverH = 0.84;
    this.worldY = 0.84;
    this.vy = 0.0;
    this._yInit = false;

    // Orientation smoothing
    this.roll = 0.0;
    this.pitchOffset = 0.0;
    this.pitchSmooth = 0.0;

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
    this.padBurst = 0;

    // Real physics flight-path wake history (48 samples, zero allocations!)
    this.inAir = 0;
    this._surf = { y: 0, slope: 0, hasRoad: 1, isRamp: 0 };
    this._noseSurf = { y: 0, slope: 0, hasRoad: 1, isRamp: 0 };
    this._wakeCap = 64;
    this._wakeS = new Float32Array(64);
    this._wakeY = new Float32Array(64);
    this._wakeHead = 0;
    this._wakeCount = 0;
    this._lastWakeS = -999;

    // Reusable sample objects (zero per-frame allocations!)
    this._sample = {};
    this._lookSample = {};
    this._lastKickId = 0;
    this._lastDropId = 0;
  }

  sampleWakeWorldY(s) {
    if (this._wakeCount < 1) return this.worldY;
    // Anchor directly to live (this.worldS, this.worldY) so i=0 -> i=1 has ZERO seam or lag!
    let prevS = this.worldS;
    let prevY = this.worldY;
    if (s >= prevS) return prevY;
    const cap = this._wakeCap;
    let idx = (this._wakeHead - 1 + cap) % cap;
    for (let k = 0; k < this._wakeCount; k++) {
      const curS = this._wakeS[idx];
      const curY = this._wakeY[idx];
      if (s >= curS) {
        const span = Math.max(0.001, prevS - curS);
        const t = (s - curS) / span;
        return curY + (prevY - curY) * t;
      }
      prevS = curS;
      prevY = curY;
      idx = (idx - 1 + cap) % cap;
    }
    return prevY;
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
    this.padBurst = padHit;
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
      this.padBurst = 2;
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

    // 3. Weighty Newtonian vertical physics:
    // - Nose-ahead surface sampling prevents the 4.95u needle nose & ventral fin from clipping into ramps!
    // - Heavy gravity (135) with ZERO upward floatiness + progressive descent-only shock absorber for silky landings!
    const surf = track.getSurfaceAt(this.worldS, this._surf);
    const noseSurf = track.getSurfaceAt(this.worldS + 4.8, this._noseSurf);
    const effSpeed = track.speed + Math.max(0, this.relVel);
    // Use the full rising nose-ahead height when climbing a ramp so the 4.95u nose NEVER clips the deck!
    const effGroundY = (surf.hasRoad && noseSurf.hasRoad && noseSurf.y > surf.y)
      ? Math.max(surf.y, noseSurf.y - 0.12)
      : surf.y;
    const effSlope = (surf.hasRoad && noseSurf.hasRoad && noseSurf.slope > surf.slope)
      ? (surf.slope * 0.55 + noseSurf.slope * 0.45)
      : surf.slope;

    if (!this._yInit) {
      this._yInit = true;
      this.worldY = effGroundY + 0.84;
      this.vy = effSlope * effSpeed;
    }

    const GRAVITY = 152.0; // crisp, weighty Wipeout gravity — eliminates crest-jump floatiness!
    const antiGravFloat = music.mode === 'retrowave' ? ((music.subBassEnvelope || 0) * 0.10) : 0.0;
    const restH = 0.84 + antiGravFloat + Math.sin(nowSec * 16.0) * 0.012;
    const roadVy = effSlope * effSpeed;
    const vRatio = effSpeed / 120.0;
    const aeroQuad = vRatio * vRatio; // True aerodynamic v^2 quadratic downforce!

    // 4 substeps for rock-solid progressive magnetic cushion stability
    const subDt = dt * 0.25;
    for (let step = 0; step < 4; step++) {
      const clearance = this.worldY - effGroundY;
      let ay = -GRAVITY - (this.vy > 0 ? this.vy * 0.08 : 0);

      if (surf.hasRoad) {
        const relVy = this.vy - roadVy;
        if (clearance <= restH) {
          // Firm, well-damped magnetic air-bed floor (absorbs compression without jarring hard-stops!)
          const pen = restH - clearance;
          ay += GRAVITY + pen * (155.0 + pen * 205.0) - relVy * 18.0;
        } else if (clearance < 1.85 && relVy < -3.5) {
          // Descent-ONLY progressive hydraulic shock absorber (zero float on climb, silky landing catch!)
          const c = 1.0 - (clearance - restH) / (1.85 - restH);
          ay += (-relVy) * (13.5 * c * c);
        } else if (clearance < 3.20 && !surf.isRamp && !noseSurf.isRamp) {
          // Quadratic (v^2) ground-effect aerodynamic downforce matches crest centripetal lift (k * v^2)!
          const s = 1.0 - (clearance - restH) / (3.20 - restH);
          ay -= (48.0 + 112.0 * s) * aeroQuad;
        }
      }

      this.vy += ay * subDt;
      // Aerodynamic downforce cap keeps normal crests glued while preserving full skyway ramp launches!
      const onRamp = surf.isRamp || noseSurf.isRamp;
      const maxUpVy = surf.hasRoad ? (onRamp ? 21.0 : 4.5) : 23.0;
      if (this.vy > maxUpVy) this.vy = maxUpVy;
      this.worldY += this.vy * subDt;

      // Soft belly clearance floor (0.60 clears the -0.58 ventral fin & anhedral tips -> zero tarmac clipping!)
      if (surf.hasRoad && this.worldY < effGroundY + 0.60) {
        this.worldY = effGroundY + 0.60;
        if (this.vy < roadVy) this.vy = roadVy + (this.vy - roadVy) * 0.15;
      }
    }

    const clearance = this.worldY - surf.y;
    this.hoverH = clearance;
    this.inAir = (!surf.hasRoad || clearance > 1.45) ? 1 : 0;

    // Record TRUE persistent worldY densely (every 1.2u) so thruster trails hug hill crests cleanly!
    if (this.worldS - this._lastWakeS >= 1.2) {
      this._lastWakeS = this.worldS;
      this._wakeS[this._wakeHead] = this.worldS;
      this._wakeY[this._wakeHead] = this.worldY;
      this._wakeHead = (this._wakeHead + 1) % this._wakeCap;
      if (this._wakeCount < this._wakeCap) this._wakeCount++;
    }

    // 4. Roll into corners; pre-pitch smoothly into approaching ramps + velocity-vector pitch when airborne!
    const targetRoll = -frame.curv * 42.0 - this.latVel * 0.09;
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 8.5);
    const flightPitch = Math.atan2(this.vy, Math.max(70.0, effSpeed));
    const roadPitch = Math.atan(effSlope);
    const targetAbsPitch = (this.inAir ? flightPitch : (roadPitch * 0.78 + flightPitch * 0.22)) - Math.max(0, this.relVel) * 0.0014;
    this.pitchSmooth += (targetAbsPitch - this.pitchSmooth) * Math.min(1, dt * (this.inAir ? 9.5 : 13.5));
    this.pitchOffset = Math.max(-0.34, Math.min(0.34, this.pitchSmooth - frame.pitch));

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

    const baseH = Math.min(0.84, Math.max(0.60, this.hoverH));
    const extraAir = Math.max(0, this.hoverH - 0.84);
    this.pos[0] = frame.x + frame.rx * this.lat + frame.ux * baseH;
    this.pos[1] = frame.y + frame.ry * this.lat + frame.uy * baseH + extraAir;
    this.pos[2] = frame.z + frame.rz * this.lat + frame.uz * baseH;

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
