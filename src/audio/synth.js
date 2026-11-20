// Five-Rack Zero-Overlap Web Audio API Synthesizer + Articulated Phoneme Vocoder:
// 01 ZERO FRICTION    : Neuro-Wobble 24dB/oct 1/8t-LFO talking bass, 5-voice stadium Supersaws,
//                       ±12c dual-saw arps, 808 breakbeat drums, 6-band pulse cyber-vocoder.
// 02 OVERDRIVE        : Palm-muted distorted metal rhythm guitar chugs (4x12 cab), hard-clipped
//                       saw + 40-80Hz sub-sine (-6dB duck), industrial anvil + pitch-drop stabs,
//                       deep baritone ring-mod metal vocoder & screaming metal lead guitar.
// 03 TRACKER PROTOCOL : 32nd-note YM2612 FM arps (index 4.0), dry 25%-duty pulse + YM2612 FM
//                       slap-bass (zero reverb), 90s arcade orchestra hits, 16-bit PCM drums,
//                       hyper-bright soprano Vocaloid chip vocals (3-part chorus harmony).
// 04 VECTOR MATRIX    : Resonant TB-303 (Q 12-16.5, 200Hz-6kHz, accents & slides), 90s Detroit
//                       minor-9th FM rave stabs, 6-osc TR-909 metallic ride + 909 kicks/claps/hats,
//                       woody FM rave lead, glitch-stuttered 32nd-note chordal vocal chops.
// 05 ANTI-GRAV DRIFT  : Deep ~45Hz 1/4-note pumping sub-sine, 7-detuned-saw 0.2Hz-LFO pad into
//                       2.5s gated stereo reverb, Juno/DX7 chorus Rhodes ballad keys, 707 kick/
//                       rimshots/gated snare, articulated 3-part harmonized pop-retrowave vocals
//                       (1/8d delay) + velvety 80s synth-sax turnaround fills.

import { TRACKS } from './tracks.js';

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function makeTubeCurve(amount = 3.5) {
  const n = 512;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh((x + 0.04 * x * x) * amount) / Math.tanh(amount);
  }
  return curve;
}

function makeHardClipCurve(drive = 9.5) {
  const n = 512;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    const v = x * drive;
    curve[i] = Math.max(-0.92, Math.min(0.92, v / (1 + 0.12 * Math.abs(v))));
  }
  return curve;
}

function makePrng(seed = 1337) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
}

function makeGatedHallIR(ctx, duration = 2.5) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * duration);
  const buf = ctx.createBuffer(2, len, rate);
  const rnd = makePrng(4096);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lp1 = 0, lp2 = 0;
    for (let i = 0; i < len; i++) {
      const p = i / len;
      const env = p < 0.35 ? Math.pow(1 - p * 0.45, 1.2) : Math.pow(1 - p, 2.4) * 1.15;
      const raw = rnd() * env;
      lp1 = lp1 * 0.65 + raw * 0.35;
      lp2 = lp2 * 0.58 + lp1 * 0.42;
      data[i] = lp2;
    }
  }
  return buf;
}

function makePulseWave(ctx, duty = 0.25, harmonics = 28) {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let k = 1; k <= harmonics; k++) {
    const sigma = Math.sin((k * Math.PI) / harmonics) / ((k * Math.PI) / harmonics);
    imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * sigma;
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

// Articulated Vowel & Diphthong Formant Trajectories [startF1..F3, endF1..F3]
const PHONEMES = {
  AH: [[720, 1120, 2450], [690, 1100, 2420]],
  OH: [[510, 840, 2360],  [360, 820, 2260]],
  OO: [[320, 860, 2220],  [300, 800, 2180]],
  EE: [[290, 2250, 2950], [280, 2320, 3000]],
  EH: [[560, 1820, 2550], [490, 1920, 2600]],
  IH: [[410, 2000, 2650], [360, 2100, 2720]],
  AI: [[740, 1220, 2480], [340, 2180, 2880]] // "eye / drive / light / alive" diphthong!
};

export class SynthEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.mixBus = null;
    this.pumpBus = null;
    this.dryBus = null;
    this.subTapBus = null;
    this.subAnalyser = null;
    this.fftAnalyser = null;
    this._fftData = null;
    this._subTimeData = null;

    this.comp = null;
    this.limiter = null;
    this.reverbIn = null;
    this.delayIn = null;
    this.delayL = null;
    this.delayR = null;
    this.darkDistBus = null;
    this.metalAmpBus = null;
    this.acidSatBus = null;
    this.noiseBuf = null;
    this.crushNoiseBuf = null;
    this.ride909Buf = null;
    this.pulse25Wave = null;
    this.pulse15Wave = null;

    // Zero-allocation circular event queue (replaces per-step setTimeout storm!)
    this._evCap = 256;
    this._evQ = new Array(256);
    for (let i = 0; i < 256; i++) this._evQ[i] = { t: 0, kind: 0, a: 0, b: 0, c: 0 };
    this._evHead = 0;
    this._evTail = 0;
    this._lastPadStep = -99;
    this._lastBbStep = -99;

    this.trackIndex = 0;
    this.playing = false;
    this.muted = false;
    this._offline = false;

    this.step = 0;
    this.nextStepTime = 0;
    this.timerId = null;
    this.startTime = 0;

    this.telemetry = {
      beatPhase: 0,
      beatPulse: 0,
      kick: 0,
      kickId: 0,
      kickTrigger: 0,
      snare: 0,
      dropFlash: 0,
      dropId: 0,
      energy: 0.24,
      isDrop: 0,
      isRoll: 0,
      sectionName: 'STANDBY',
      lyric: '',
      lyricId: 0,
      bpm: TRACKS[0].bpm,
      mode: TRACKS[0].mode,
      bassEnergy: 0,
      leadFrequency: 0,
      leadFreqNorm: 0,
      subBassPunch: 0,
      stabTriggers: 0,
      stabPulse: 0,
      stepTick: 0,
      stepBar: 0,
      stepNote: 0,
      rasterMode: 0,
      filterCutoffNormalized: 0,
      accentTrigger: 0,
      accentCount: 0,
      padLFO: 0.5,
      subBassEnvelope: 0
    };

    this._lastKickTime = -10;
    this._lastSnareTime = -10;
    this._lastBeatTime = -10;
    this._lastDropTime = -10;
    this._lastStabTime = -10;
    this._lastAccentTime = -10;
    this._lastLeadFreq = 330;
    this._lastVocalFreq = 260;
    this._lastAcidFreq = 110;
    this._lastAcidCutoffNorm = 0.25;
    this._sectionEnergy = 0.24;
    this._sectionName = 'STANDBY';
    this._sectionRoll = 0;
    this._sectionDrop = 0;
    this._lyricIndex = 0;

    this.onLyric = null;
    this.onStep = null;
    this.onSpeedPad = null;
    this.onBillboard = null;
    this.onJump = null;
  }

  get track() {
    return TRACKS[this.trackIndex];
  }

  _ensureContext(customCtx = null) {
    if (this.ctx && !customCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = customCtx || new AC();

    this.pumpBus = this._gain(1.0);
    this.dryBus = this._gain(1.0);
    this.mixBus = this._gain(0.65);

    // Master Warmth EQ (protects ears across all 5 distinct genres!)
    const eqLow = this._flt('lowshelf', 88, 0, 0, 2.0);
    const eqDip = this._flt('peaking', 3250, 0.85, 0, -2.3);
    const eqAir = this._flt('lowpass', 11400, 0.5);

    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -13.5;
    this.comp.knee.value = 16;
    this.comp.ratio.value = 3.2;
    this.comp.attack.value = 0.010;
    this.comp.release.value = 0.16;

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1.5;
    this.limiter.knee.value = 2.0;
    this.limiter.ratio.value = 18.0;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.070;

    this.master = this._gain(this.muted ? 0 : 0.84);

    this.pumpBus.connect(this.mixBus);
    this.dryBus.connect(this.mixBus);
    this.mixBus.connect(eqLow);
    eqLow.connect(eqDip);
    eqDip.connect(eqAir);
    eqAir.connect(this.comp);
    this.comp.connect(this.limiter);
    this.limiter.connect(this.master);
    this.master.connect(this.ctx.destination);

    // Real-Time FFT & Sub-Bass Peak Analysers
    this.subTapBus = this._gain(1.0);
    if (!this._offline && typeof this.ctx.createAnalyser === 'function') {
      this.fftAnalyser = this.ctx.createAnalyser();
      this.fftAnalyser.fftSize = 256;
      this.fftAnalyser.smoothingTimeConstant = 0.72;
      this.mixBus.connect(this.fftAnalyser);
      this._fftData = new Uint8Array(this.fftAnalyser.frequencyBinCount);

      this.subAnalyser = this.ctx.createAnalyser();
      this.subAnalyser.fftSize = 256;
      this.subTapBus.connect(this.subAnalyser);
      this._subTimeData = new Float32Array(this.subAnalyser.fftSize);
    }

    // 1.85s Warm Stereo Gated Hall Reverb -> pumpBus (lightweight stereo FFT!)
    this.reverbIn = this._gain(0.34);
    const conv = this.ctx.createConvolver();
    conv.buffer = makeGatedHallIR(this.ctx, 1.85);
    const revHp = this._flt('highpass', 210);
    const revLp = this._flt('lowpass', 3100);
    this.reverbIn.connect(conv); conv.connect(revHp); revHp.connect(revLp); revLp.connect(this.pumpBus);

    // Stereo Ping-Pong Dotted-8th Delay Bus
    const dTime = (60 / this.track.bpm) * 0.75;
    this.delayIn = this._gain(0.28);
    this.delayL = this.ctx.createDelay(1.5);
    this.delayR = this.ctx.createDelay(1.5);
    this.delayL.delayTime.value = dTime;
    this.delayR.delayTime.value = dTime * 0.5;
    const dLp = this._flt('lowpass', 2500);
    const dHp = this._flt('highpass', 240);
    const dFb = this._gain(0.36);
    const panL = this._pan(-0.68);
    const panR = this._pan(0.68);
    this.delayIn.connect(this.delayL);
    this.delayL.connect(panL); this.delayL.connect(this.delayR);
    this.delayR.connect(panR); this.delayR.connect(dLp);
    dLp.connect(dHp); dHp.connect(dFb); dFb.connect(this.delayL);
    panL.connect(this.mixBus); panR.connect(this.mixBus);

    // Track 2 Heavy Darksynth Hard-Clipping Bass/Stab Pedal -> pumpBus
    this.darkDistBus = this._flt('lowpass', 2100);
    const hardClip = this.ctx.createWaveShaper();
    hardClip.curve = makeHardClipCurve(9.5); hardClip.oversample = 'none';
    const dCabLp = this._flt('lowpass', 2500);
    const dOut = this._gain(0.40);
    this.darkDistBus.connect(hardClip); hardClip.connect(dCabLp); dCabLp.connect(dOut); dOut.connect(this.pumpBus);

    // Track 2 Dedicated High-Gain 4x12 Metal Guitar Amp & Cabinet Sim (mid-scoop + presence!)
    this.metalAmpBus = this._flt('highpass', 115);
    const mPreLp = this._flt('lowpass', 2250);
    const mDrive = this.ctx.createWaveShaper(); mDrive.curve = makeHardClipCurve(9.0); mDrive.oversample = 'none';
    const mScoop = this._flt('peaking', 520, 0.9, 0, -4.2);
    const mPres = this._flt('peaking', 2050, 1.0, 0, 3.0);
    const mCab = this._flt('lowpass', 3200, 0.7);
    const mOut = this._gain(0.54);
    const mPanL = this._pan(-0.68);
    const mPanR = this._pan(0.68);
    const mDly = this.ctx.createDelay(0.05); mDly.delayTime.value = 0.013;
    this.metalAmpBus.connect(mPreLp); mPreLp.connect(mDrive); mDrive.connect(mScoop);
    mScoop.connect(mPres); mPres.connect(mCab); mCab.connect(mOut);
    mOut.connect(mPanL); mOut.connect(mDly); mDly.connect(mPanR);
    mPanL.connect(this.pumpBus); mPanR.connect(this.pumpBus);

    // Track 4 TB-303 Warm Analog Overdrive Bus (club low-mid weight + diode saturation!)
    this.acidSatBus = this.ctx.createWaveShaper();
    this.acidSatBus.curve = makeTubeCurve(3.0); this.acidSatBus.oversample = 'none';
    const aLow = this._flt('lowshelf', 180, 0, 0, 2.4);
    const aLp = this._flt('lowpass', 5400);
    const aOut = this._gain(0.80);
    this.acidSatBus.connect(aLow); aLow.connect(aLp); aLp.connect(aOut); aOut.connect(this.pumpBus); aOut.connect(this.delayIn);

    // Custom Pulse Waves: 25% (Tracker 8-bit bass) & 15% (Glottal vocal carrier!)
    this.pulse25Wave = makePulseWave(this.ctx, 0.25, 28);
    this.pulse15Wave = makePulseWave(this.ctx, 0.15, 32);

    // White noise, 10x decimated lo-fi crushed noise, and pre-baked 6-osc TR-909 metallic ride!
    const sr = this.ctx.sampleRate;
    const len = sr * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, sr);
    this.crushNoiseBuf = this.ctx.createBuffer(1, len, sr);
    const nData = this.noiseBuf.getChannelData(0);
    const cData = this.crushNoiseBuf.getChannelData(0);
    const rnd = makePrng(9001);
    let held = 0;
    for (let i = 0; i < len; i++) {
      const v = rnd();
      nData[i] = v;
      if (i % 10 === 0) held = Math.round(v * 4) / 4;
      cData[i] = held;
    }

    const rLen = Math.floor(sr * 0.22);
    this.ride909Buf = this.ctx.createBuffer(1, rLen, sr);
    const rData = this.ride909Buf.getChannelData(0);
    const rFreqs = [305, 452, 540, 622, 810, 1020];
    for (let i = 0; i < rLen; i++) {
      const tSec = i / sr;
      let s = 0;
      for (let k = 0; k < 6; k++) s += Math.sin(2 * Math.PI * rFreqs[k] * tSec) >= 0 ? 1 : -1;
      rData[i] = (s / 6) * Math.exp(-tSec * 22.0);
    }
  }

  _applyTrackBusParams(t) {
    if (this.delayL && this.delayR) {
      const dTime = (60 / this.track.bpm) * 0.75;
      this.delayL.delayTime.setValueAtTime(dTime, t);
      this.delayR.delayTime.setValueAtTime(dTime * 0.5, t);
    }
    if (this.reverbIn) {
      this.reverbIn.gain.setValueAtTime((this.track.patch.revSend || 0.35) * 0.85, t);
    }
    if (this.delayIn) {
      this.delayIn.gain.setValueAtTime(this.track.patch.delaySend || 0.26, t);
    }
  }

  _pushEv(time, kind, a = 0, b = 0, c = 0) {
    if (this._offline) return;
    const nextTail = (this._evTail + 1) % this._evCap;
    if (nextTail === this._evHead) this._evHead = (this._evHead + 1) % this._evCap;
    const slot = this._evQ[this._evTail];
    slot.t = time; slot.kind = kind; slot.a = a; slot.b = b; slot.c = c;
    this._evTail = nextTail;
  }

  _drainEvents(now) {
    while (this._evHead !== this._evTail) {
      const ev = this._evQ[this._evHead];
      if (ev.t > now) break;
      this._evHead = (this._evHead + 1) % this._evCap;
      if (ev.kind === 1) {
        this.telemetry.stepTick++;
        this.telemetry.stepBar = ev.a;
        this.telemetry.stepNote = ev.b;
        if (this.onStep) this.onStep(ev.a, ev.b, ev.c);
      } else if (ev.kind === 2) {
        this.telemetry.dropId++;
      } else if (ev.kind === 3) {
        this.telemetry.lyric = ev.a;
        this.telemetry.lyricId++;
        if (this.onLyric) this.onLyric(ev.a, ev.b);
      } else if (ev.kind === 4) {
        this.telemetry.kickId++;
      } else if (ev.kind === 5) {
        this.telemetry.accentCount++;
      } else if (ev.kind === 6) {
        this.telemetry.stabTriggers++;
      } else if (ev.kind === 7) {
        this.telemetry.leadFrequency = ev.a;
        this.telemetry.leadFreqNorm = ev.b;
      } else if (ev.kind === 8) {
        if (this.onSpeedPad) this.onSpeedPad(ev.a, ev.b, ev.c);
      } else if (ev.kind === 9) {
        if (this.onBillboard) this.onBillboard(ev.a, ev.b, ev.c);
      } else if (ev.kind === 10) {
        if (this.onJump) this.onJump(ev.a, ev.b, ev.c);
      }
    }
  }

  _inspectFuture(fStep, stepDur, emitTime, dtAhead, checkPads, checkBb, checkJump) {
    const tr = this.track;
    const fBar = Math.floor(fStep / 16);
    const fs16 = fStep % 16;
    const { sec, barInSec } = this._getSectionAtBar(fBar);
    const isTomFill = sec.tomFill && barInSec === sec.bars - 1 && fs16 >= 12;
    const introEarly = sec.lateKick && barInSec < 2;
    const dSet = (barInSec % 4 === 3 && sec.drumSet === 0) ? 1 : sec.drumSet;
    const kickPat = tr.kicks[dSet] || tr.kicks[0];
    const snarePat = tr.snares[dSet] || tr.snares[0];

    // Check if this exact step is a major section drop / big beat drop (triggers disconnected track jump!)
    let isJumpBeat = 0;
    if (barInSec === 0 && fs16 === 0 && fBar > 0) {
      if (sec.drop) {
        isJumpBeat = 2; // MEGA-DROP disconnected track chasm!
      } else if (sec.energy >= 0.80) {
        const prev = this._getSectionAtBar(fBar - 1).sec;
        if (prev.energy <= 0.55) isJumpBeat = 1; // High-energy chorus entry air-gap!
      }
    }

    if (checkJump && isJumpBeat > 0) {
      this._pushEv(emitTime, 10, dtAhead, isJumpBeat === 2 ? 1 : 0, sec.energy);
    }

    // Beat-synced Speed Pads aligned to KICK hits!
    if (checkPads && !isTomFill && !introEarly && !isJumpBeat && kickPat[fs16] && sec.kick > 0) {
      if (fStep - this._lastPadStep >= 3) {
        this._lastPadStep = fStep;
        this._pushEv(emitTime, 8, dtAhead, sec.drop ? 1 : 0, sec.energy);
      }
    }

    // Billboards aligned to a DIFFERENT part of the beat: SNARE / CLAP backbeats & heavy STABS!
    if (checkBb && !isTomFill && !introEarly) {
      const isSnare = sec.snare > 0 && snarePat[fs16] === 1;
      const isGantryHit = (sec.stab > 0 && tr.stabPat && tr.stabPat[fs16] && fs16 === 0) ||
        (sec.chord > 0 && tr.chordPat && tr.chordPat[fs16] && fs16 === 0) ||
        (tr.mode === 'retrowave' && sec.ep > 0 && fs16 === 0 && barInSec % 2 === 0);
      if ((isSnare || isGantryHit) && fStep - this._lastBbStep >= 4) {
        this._lastBbStep = fStep;
        this._pushEv(emitTime, 9, dtAhead, isGantryHit ? 1 : 0, sec.energy);
      }
    }
  }

  start(trackIdx = this.trackIndex) {
    this._ensureContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.trackIndex = trackIdx;
    this.playing = true;
    this._offline = false;
    this.step = 0;
    this._lyricIndex = 0;
    this._evHead = 0;
    this._evTail = 0;
    this._lastPadStep = -99;
    this._lastBbStep = -99;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.startTime = this.nextStepTime;
    // Pre-populate upcoming speed pads & snare/stab billboards already visible down-track on start!
    const stepDur0 = 60 / this.track.bpm / 4;
    const padLead0 = Math.max(8, Math.round(1.55 / stepDur0));
    const bbLead0 = Math.max(8, Math.round(1.70 / stepDur0));
    const maxPre = Math.max(padLead0, bbLead0);
    for (let k = 2; k < maxPre; k++) {
      this._inspectFuture(k, stepDur0, this.startTime, k * stepDur0, k < padLead0, k < bbLead0, false);
    }
    this.telemetry.bpm = this.track.bpm;
    this.telemetry.mode = this.track.mode;
    this.telemetry.rasterMode = this.track.mode === 'tracker' ? 1.0 : 0.0;
    if (this.pumpBus && this.ctx) {
      this.pumpBus.gain.cancelScheduledValues(this.ctx.currentTime);
      this.pumpBus.gain.setValueAtTime(1.0, this.ctx.currentTime);
    }
    this._applyTrackBusParams(this.ctx.currentTime);

    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => this._scheduler(), 32);
  }

  stop() {
    this.playing = false;
    this._evHead = 0;
    this._evTail = 0;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this._sectionName = 'PAUSED';
    this._sectionEnergy = 0.16;
    this._sectionDrop = 0;
    this._sectionRoll = 0;
  }

  toggle() {
    if (this.playing) this.stop();
    else this.start(this.trackIndex);
    return this.playing;
  }

  setTrack(idx) {
    this.trackIndex = (idx + TRACKS.length) % TRACKS.length;
    this.telemetry.bpm = this.track.bpm;
    this.telemetry.mode = this.track.mode;
    this.telemetry.rasterMode = this.track.mode === 'tracker' ? 1.0 : 0.0;
    if (this.playing) this.start(this.trackIndex);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.84, this.ctx.currentTime, 0.02);
    }
  }

  /*DEV_START*/
  async renderOffline(trackIdx = 0, startBar = 0, numBars = 6, sampleRate = 44100) {
    const tr = TRACKS[trackIdx];
    const stepDur = 60 / tr.bpm / 4;
    const totalSteps = numBars * 16;
    const totalSec = totalSteps * stepDur + 1.5;
    const offCtx = new OfflineAudioContext(2, Math.ceil(totalSec * sampleRate), sampleRate);

    const eng = new SynthEngine();
    eng.trackIndex = trackIdx;
    eng._offline = true;
    eng._ensureContext(offCtx);
    eng._applyTrackBusParams(0);

    const startStep = startBar * 16;
    for (let i = 0; i < totalSteps; i++) {
      eng._scheduleStep(startStep + i, 0.04 + i * stepDur, stepDur);
    }
    return offCtx.startRendering();
  }
  /*DEV_END*/

  _getSectionAtBar(bar) {
    const secs = this.track.sections;
    let totalBars = 0;
    for (const s of secs) totalBars += s.bars;
    let b = bar % totalBars;
    for (const s of secs) {
      if (b < s.bars) return { sec: s, barInSec: b, progress: b / s.bars };
      b -= s.bars;
    }
    return { sec: secs[0], barInSec: 0, progress: 0 };
  }

  _scheduler() {
    if (!this.playing || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Guard against tab-backgrounding catch-up bursts (prevents stacked stutter storms!)
    if (this.nextStepTime < now - 0.06) {
      this.nextStepTime = now + 0.02;
    }
    const lookahead = 0.17;
    const stepDur = 60 / this.track.bpm / 4;
    while (this.nextStepTime < now + lookahead) {
      this._scheduleStep(this.step, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.step++;
    }
  }

  _triggerSidechain(t, stepDur, depth, beats = 0.45) {
    // Glitch-free sidechain using cancelScheduledValues + setTargetAtTime (never collides on syncopated double-kicks!)
    const g = this.pumpBus.gain;
    const recDur = Math.min(stepDur * 4 * beats, stepDur * 3.2);
    g.cancelScheduledValues(t);
    g.setTargetAtTime(depth, t, 0.005);
    g.setTargetAtTime(1.0, t + 0.022, Math.max(0.032, recDur * 0.34));
  }

  _scheduleStep(step, t, stepDur) {
    const tr = this.track;
    const mode = tr.mode;
    const bar = Math.floor(step / 16);
    const s16 = step % 16;
    const { sec, barInSec, progress } = this._getSectionAtBar(bar);

    const chordIdx = ((sec.chordOff || 0) + barInSec) % tr.chords.length;
    const chord = tr.chords[chordIdx];
    const patIdx = Math.floor(barInSec / 2) % 2;
    const phraseStep = (barInSec % 8) * 16 + s16;
    const vowel = tr.vowels[chordIdx % tr.vowels.length];

    this._sectionName = sec.name;
    this._sectionEnergy = sec.energy;
    this._sectionRoll = sec.roll;
    this._sectionDrop = sec.drop;

    if (s16 % 4 === 0) this._lastBeatTime = t;

    if (!this._offline) {
      this._pushEv(t, 1, bar, chord.a[s16 % 4], s16);
      // Lookahead spatial rhythm cues for speed pads (kick), billboards (snare/stab), and jumps (big drops)!
      const padLead = Math.max(8, Math.round(1.55 / stepDur));
      const bbLead = Math.max(8, Math.round(1.70 / stepDur));
      const jumpLead = Math.max(16, Math.round(3.35 / stepDur));
      this._inspectFuture(step + padLead, stepDur, t, padLead * stepDur, true, false, false);
      this._inspectFuture(step + bbLead, stepDur, t, bbLead * stepDur, false, true, false);
      this._inspectFuture(step + jumpLead, stepDur, t, jumpLead * stepDur, false, false, true);
    }

    if (sec.roll && barInSec === 0 && s16 === 0) {
      this._playRiser(t, stepDur * 16 * sec.bars * 0.90);
    }

    if (sec.drop && barInSec === 0 && s16 === 0) {
      this._playCrash(t, 0.28);
      this._playSubDrop(t, 0.34);
      this._lastDropTime = t;
      this._pushEv(t, 2);
    }

    if (!this._offline && s16 % 8 === 0 && tr.lyrics.length > 0) {
      const word = tr.lyrics[this._lyricIndex % tr.lyrics.length];
      this._lyricIndex++;
      this._pushEv(t, 3, word, sec.energy);
    }

    // --- PER-BAR PADS & ATMOSPHERES (Track-Exclusive!) ---
    if (s16 === 0 && sec.pad > 0) {
      const padRoot = mode === 'acid' ? tr.root + 24 : tr.root + 12;
      const freqs = chord.p.map(n => midiToFreq(padRoot + n));
      if (mode === 'retrowave') {
        this._playSevenSawPad(t, stepDur * 16.8, freqs, sec.pad * 0.052, sec.filter);
      } else if (mode === 'darksynth') {
        // Dark brooding industrial drone + metallic anvil clang on drop/verse bar 0!
        this._playDarkDronePad(t, stepDur * 16.6, freqs, sec.pad * 0.048, 420 + sec.filter * 520);
        if (barInSec % 2 === 0 && sec.energy > 0.4) this._playAnvilClang(t, 0.14 * sec.energy);
      } else if (mode === 'tracker') {
        // Crisp 8-bit triangle hollow pad (zero generic sawtooth!)
        this._playChipTriPad(t, stepDur * 16.2, freqs, sec.pad * 0.045);
      } else if (mode === 'acid') {
        this._playDarkDronePad(t, stepDur * 16.4, freqs, sec.pad * 0.040, 480 + sec.filter * 600);
      } else {
        this._playDarkDronePad(t, stepDur * 16.4, freqs, sec.pad * 0.050, 560 + sec.filter * 800);
      }
    }

    // Track 5: Lush Juno/DX7 Chorus Rhodes Electric Piano ballad chords + Sax turnaround fill!
    if (mode === 'retrowave') {
      if (sec.ep > 0 && (s16 === 0 || s16 === 6 || s16 === 10)) {
        const freqs = chord.p.map(n => midiToFreq(tr.root + 12 + n));
        this._playJunoChorusRhodes(t, stepDur * (s16 === 0 ? 7 : 5), freqs, sec.ep * 0.068);
      }
      // Subtle velvety 80s synth-sax turnaround on bar 3 / bar 7 beat 4!
      if ((barInSec === 3 || barInSec === 7) && (s16 === 10 || s16 === 12 || s16 === 14) && sec.energy > 0.5) {
        const saxNotes = [14, 15, 19];
        const f = midiToFreq(tr.root + 12 + saxNotes[(s16 - 10) / 2]);
        this._playVelvetSax(t, stepDur * 2.2, f, 0.12);
      }
    }

    // Track 1: Stadium 5-Voice Supersaw Gated Chords (matching Audio #4's huge pre-drop/drop!)
    if (mode === 'breakbeat' && sec.chord > 0 && tr.chordPat && tr.chordPat[s16]) {
      const freqs = chord.p.map(n => midiToFreq(tr.root + 12 + n));
      this._playAnthemSupersaw(t, stepDur * 2.2, freqs, sec.chord * 0.042, 1100 + sec.filter * 1700);
    }

    // Track 2: Palm-Muted Heavy Metal Distorted Rhythm Guitar Power Chords (matching Audio #2!)
    if (mode === 'darksynth' && sec.chug > 0 && tr.chugPat) {
      const cVal = tr.chugPat[s16];
      if (cVal > 0) {
        const gRoot = chord.b + 12; // E2..D3 guitar power-chord register!
        this._playChugMetalGuitar(t, stepDur * (cVal === 2 ? 1.42 : 0.76), gRoot, sec.chug * (cVal === 2 ? 0.30 : 0.21), cVal === 2);
      }
    }

    // Track 3: Bright 90s Sega Arcade Orchestra / Synth-Brass Stabs (matching Audio #3 & #1!)
    if (mode === 'tracker' && sec.stab > 0 && tr.stabPat && tr.stabPat[s16]) {
      const freqs = chord.p.map(n => midiToFreq(tr.root + 12 + n));
      this._playEuroArcadeStab(t, stepDur * 1.65, freqs, sec.stab * 0.098);
    }

    // Track 4: Iconic 90s Detroit/Wipeout Minor-9th Metallic FM Rave Chord Stabs + 909 Ride Cymbal!
    if (mode === 'acid') {
      if (sec.stab > 0 && tr.stabPat && tr.stabPat[s16]) {
        const stabBase = tr.root + 24 + (chord.b - 33);
        const freqs = [0, 3, 10, 14].map(iv => midiToFreq(stabBase + iv));
        this._playDetroitRaveStab(t, stepDur * 1.5, freqs, sec.stab * 0.072);
      }
      if (sec.ride > 0 && s16 % 2 === 0) {
        this._playRide909(t, sec.ride * (s16 % 4 === 2 ? 0.088 : 0.050));
      }
    }

    // Transition Tom Fill on beat 4 of section end bars
    const isTomFill = sec.tomFill && barInSec === sec.bars - 1 && s16 >= 12;
    if (isTomFill) {
      const tomFreqs = [225, 178, 138, 102];
      this._playTom(t, tomFreqs[s16 - 12], 0.42, mode === 'tracker');
      if (s16 === 12) this._playModeSnare(mode, t, 0.72, 1);
      return;
    }

    const introEarly = sec.lateKick && barInSec < 2;

    // --- DRUMS ---
    const dSet = (barInSec % 4 === 3 && sec.drumSet === 0) ? 1 : sec.drumSet;
    const kickPat = tr.kicks[dSet] || tr.kicks[0];
    const snarePat = tr.snares[dSet] || tr.snares[0];
    const hatPat = tr.hats[patIdx] || tr.hats[0];

    const playKick = !introEarly && kickPat[s16] && sec.kick > 0;
    if (playKick) {
      const kGain = sec.kick * (0.88 + 0.14 * sec.energy);
      this._playModeKick(mode, t, kGain);
      const pumpLen = mode === 'retrowave' ? 0.88 : (mode === 'darksynth' ? 0.62 : 0.45);
      this._triggerSidechain(t, stepDur, tr.patch.pump || 0.45, pumpLen);
      this._lastKickTime = t;
      this._pushEv(t, 4);
    }

    let snareVal = !introEarly && sec.snare > 0 ? (snarePat[s16] || 0) : 0;
    let snareGain = sec.snare;
    if (sec.roll) {
      const subProg = (barInSec * 16 + s16) / (sec.bars * 16);
      const dens = subProg > 0.72 ? 2 : (subProg > 0.36 ? 4 : 8);
      if (s16 % dens === 0) {
        snareVal = 1;
        snareGain = 0.40 + 0.56 * subProg;
      }
    }
    if (snareVal > 0) {
      this._playModeSnare(mode, t, snareGain, snareVal);
      if (snareVal === 1) this._lastSnareTime = t;
    }

    const hVal = hatPat[s16];
    if (hVal > 0 && sec.hat > 0 && (!introEarly || barInSec === 1)) {
      this._playModeHat(mode, t, sec.hat, hVal);
    }

    // --- TRACK-EXCLUSIVE BASS / ACID ENGINES ---
    if (mode === 'acid') {
      if (sec.acid > 0) {
        const pat = tr.acidPats[patIdx];
        const cell = pat[s16];
        if (cell) {
          const [semi, acc, slide] = cell;
          const sweepLfo = 0.5 + 0.5 * Math.sin(step * 0.055);
          const normCut = Math.min(1, Math.max(0, 0.10 + sec.filter * 0.58 + sweepLfo * 0.28 + (sec.roll ? progress * 0.25 : 0)));
          this._lastAcidCutoffNorm = normCut;
          const freq = midiToFreq(chord.b + semi);
          this._playAcid303(t, stepDur * (slide ? 1.18 : 0.86), freq, sec.acid, normCut, acc, slide, sec.drop);
          if (acc) {
            this._lastAccentTime = t;
            this._pushEv(t, 5);
            // Glitch-stuttered 32nd-note chordal vocal chop on acid accents!
            if (sec.chop > 0 && s16 % 4 === 0) {
              const chopFreq = midiToFreq(tr.root + 24 + semi);
              this._playGlitchVocalChop(t, stepDur * 1.45, chopFreq, sec.chop * 0.42, vowel);
            }
          }
        }
      }
    } else if (sec.bass > 0 && (!introEarly || s16 % 4 === 0)) {
      const bassPat = tr.bassPats[patIdx];
      const code = introEarly ? 0 : bassPat[s16];
      if (code >= 0) {
        const off = code === 1 ? 12 : (code === 2 ? 7 : 0);
        const bassGain = sec.bass * (introEarly ? 0.26 : (0.38 + 0.05 * sec.drop));
        if (mode === 'breakbeat') {
          const freq = midiToFreq(chord.b + off);
          this._playNeuroWobbleBass(t, stepDur * (code === 3 ? 2.15 : 1.15), freq, bassGain * 1.24, sec.filter, tr.bpm, code === 3 || sec.drop);
        } else if (mode === 'darksynth') {
          const subFreq = midiToFreq(chord.b);
          const midFreq = midiToFreq(chord.b + 12 + off);
          this._playDarkBass(t, stepDur * 0.92, subFreq, midFreq, bassGain, sec.filter);
        } else if (mode === 'tracker') {
          const freq = midiToFreq(chord.b + off);
          this._playYm2612SlapBass(t, stepDur * 0.88, freq, bassGain * 1.50, s16 % 4 === 0);
        } else if (mode === 'retrowave') {
          const subFreq = midiToFreq(chord.b + (code === 2 ? 7 : 0));
          this._playSubSine45(t, stepDur * 3.85, subFreq, bassGain * 0.92);
        }
      }
    }

    // --- TRACK-EXCLUSIVE ARPS ---
    if (sec.arp > 0 && tr.arpPats) {
      const arpPat = tr.arpPats[patIdx];
      const idx = arpPat[s16];
      if (idx >= 0) {
        const arpBase = mode === 'acid' ? tr.root + 24 : tr.root + 12;
        if (mode === 'tracker') {
          const idx2 = arpPat[(s16 + 1) % 16];
          const sA = chord.a[idx % 4] + (idx >= 4 ? 12 : 0);
          const sB = chord.a[(idx2 >= 0 ? idx2 : idx) % 4] + (idx2 >= 4 ? 12 : 0);
          this._playYm2612Arp(t, stepDur * 0.48, midiToFreq(arpBase + sA), sec.arp * 0.145, -0.38);
          this._playYm2612Arp(t + stepDur * 0.5, stepDur * 0.48, midiToFreq(arpBase + sB), sec.arp * 0.135, 0.38);
        } else if (mode === 'breakbeat') {
          const semi = chord.a[idx % 4] + (idx >= 4 ? 12 : 0);
          this._playDualSawArp(t, stepDur * 0.90, midiToFreq(arpBase + semi), sec.arp * 0.082, 1100 + sec.filter * 1900, s16 % 2 ? 0.35 : -0.35);
        } else if (mode === 'retrowave') {
          const semi = chord.a[idx % 4] + (idx >= 4 ? 12 : 0);
          this._playGlassBellArp(t, stepDur * 1.05, midiToFreq(arpBase + semi), sec.arp * 0.088, s16 % 2 ? 0.36 : -0.36);
        }
      }
    }

    // --- TRACK 2 STACCATO DISTORTED SQUARE BRASS STABS (+ PITCH DROP) ---
    if (mode === 'darksynth' && sec.stab > 0 && tr.stabPat && tr.stabPat[s16]) {
      const freqs = chord.p.map(n => midiToFreq(tr.root + 12 + n));
      this._playDarkBrassStab(t, stepDur * 1.45, freqs, sec.stab * 0.140);
      this._lastStabTime = t;
      this._pushEv(t, 6);
    }

    // --- TRACK 1 & 2 ROBOTIC VOCAL STABS ---
    if (sec.vStab > 0 && tr.vStabPat && tr.vStabPat[s16]) {
      if (mode === 'breakbeat') {
        const f = midiToFreq(tr.root + 12 + chord.a[0]);
        this._playCyberVocoderStab(t, stepDur * 1.9, f, sec.vStab * 0.36, s16 === 0 ? 1 : 2);
      } else if (mode === 'darksynth') {
        const f = midiToFreq(tr.root + chord.p[0]); // menacing low baritone ring-mod shout!
        this._playRingModVocal(t, stepDur * 1.75, f, sec.vStab * 0.42);
      }
    }

    // --- 8-BAR ARTICULATED MELODIES, VOCODED SINGING & CLIMAX SOLOS ---
    const activeList = sec.solo > 0 ? tr.solo : (sec.lead > 0 ? tr.melA : null);
    if (activeList) {
      const oct = sec.solo > 0 ? (tr.soloOct || 0) : (tr.leadOct || 0);
      for (let i = 0; i < activeList.length; i++) {
        const ev = activeList[i];
        if (ev[0] === phraseStep) {
          const midi = tr.root + oct + ev[1];
          const freq = midiToFreq(midi);
          const dur = stepDur * ev[2] * 0.94;
          const slide = ev[3] || 0;
          const ph = ev[4] || vowel;
          const cons = ev[5] || 0;
          this._playModeLead(mode, t, dur, midi, freq, slide, ph, cons, sec.filter, sec.drop);

          this._pushEv(t, 7, freq, Math.max(0, Math.min(1, (midi - 52) / 30)));
          break;
        }
      }
    }
  }

  // =========================================================================
  // COMPACT WEB AUDIO NODE & ENVELOPE HELPERS
  // =========================================================================

  _osc(type, f, t, stop, det = 0) {
    const o = this.ctx.createOscillator();
    if (typeof type === 'string') o.type = type;
    else o.setPeriodicWave(type);
    o.frequency.setValueAtTime(f, t);
    if (det) o.detune.setValueAtTime(det, t);
    o.start(t);
    o.stop(stop);
    return o;
  }

  _flt(type, f, q = 0, t = 0, gain = 0) {
    const flt = this.ctx.createBiquadFilter();
    flt.type = type;
    if (t) flt.frequency.setValueAtTime(f, t);
    else flt.frequency.value = f;
    if (q) flt.Q.value = q;
    if (gain) flt.gain.value = gain;
    return flt;
  }

  _gain(v = 1) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  _pan(v) {
    const p = this.ctx.createStereoPanner();
    p.pan.value = v;
    return p;
  }

  _env(amp, t, atk, dur, sus = 0, susT = 0.75) {
    const g = this.ctx.createGain();
    if (atk) {
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(amp, t + atk);
    } else {
      g.gain.setValueAtTime(amp, t);
    }
    if (sus) g.gain.linearRampToValueAtTime(amp * sus, t + dur * susT);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    return g;
  }

  _buf(buf, t, stop, loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    if (loop) s.loop = true;
    s.start(t);
    s.stop(stop);
    return s;
  }

  _fm(t, stop, fCar, fMod, modA, modB, modT, carType = 'sine', modType = 'sine') {
    const car = this._osc(carType, fCar, t, stop);
    const mod = this._osc(modType, fMod, t, stop);
    const mg = this.ctx.createGain();
    mg.gain.setValueAtTime(modA, t);
    mg.gain.exponentialRampToValueAtTime(modB, t + modT);
    mod.connect(mg);
    mg.connect(car.frequency);
    return car;
  }

  _formants(src, dest, t, dur, fA, fB, scale, q, weights, maxF = 9999, glideR = 0.82) {
    const srcs = Array.isArray(src) ? src : [src];
    for (let i = 0; i < 3; i++) {
      const bp = this._flt('bandpass', Math.min(maxF, fA[i] * scale), q, t);
      if (fB) bp.frequency.exponentialRampToValueAtTime(Math.min(maxF, fB[i] * scale), t + dur * glideR);
      const wg = this._gain(weights[i]);
      for (const s of srcs) s.connect(bp);
      bp.connect(wg);
      wg.connect(dest);
    }
  }

  // =========================================================================
  // ARTICULATED CONSONANT HELPER (S/Z/F sibilants & T/K/D/P plosives!)
  // =========================================================================

  _playConsonant(t, type, gain, dest) {
    if (!type) return;
    const dur = type === 1 ? 0.042 : 0.018;
    const src = this._buf(this.noiseBuf, t, t + dur + 0.01);
    const bp = this._flt('bandpass', type === 1 ? 4300 : 1900, type === 1 ? 2.2 : 1.4, t);
    const g = this._env(gain * (type === 1 ? 0.34 : 0.45), t, 0.004, dur);
    src.connect(bp); bp.connect(g); g.connect(dest);
  }

  // =========================================================================
  // DRUM & PERCUSSION ENGINES
  // =========================================================================

  _playModeKick(mode, t, gain) {
    if (mode === 'tracker') {
      const osc = this._osc('square', 215, t, t + 0.11);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.032);
      const lp = this._flt('lowpass', 1150, 0, t);
      const g = this._env(0.76 * gain, t, 0.002, 0.105);
      osc.connect(lp); lp.connect(g); g.connect(this.dryBus); g.connect(this.subTapBus);
      return;
    }
    const cfg = mode === 'breakbeat' ? [150, 45, 0.062, 0.95, 0.003, 0.25]
      : mode === 'darksynth' ? [178, 44, 0.040, 0.98, 0.002, 0.165]
      : mode === 'acid' ? [165, 48, 0.048, 0.96, 0.002, 0.19]
      : [128, 48, 0.052, 0.84, 0.004, 0.21];
    const osc = this._osc('sine', cfg[0], t, t + 0.26);
    osc.frequency.exponentialRampToValueAtTime(cfg[1], t + cfg[2]);
    if (mode === 'breakbeat') osc.frequency.exponentialRampToValueAtTime(38, t + 0.24);
    const g = this._env(cfg[3] * gain, t, cfg[4], cfg[5]);
    osc.connect(g); g.connect(this.dryBus); g.connect(this.subTapBus);

    if (mode !== 'retrowave') {
      const clk = this._osc('triangle', mode === 'darksynth' ? 340 : 250, t, t + 0.02);
      clk.frequency.exponentialRampToValueAtTime(65, t + 0.014);
      const cg = this._env(0.24 * gain, t, 0, 0.018);
      clk.connect(cg); cg.connect(this.dryBus);
    }
  }

  _playModeSnare(mode, t, gain, val = 1) {
    if (mode === 'retrowave' && val === 2) {
      const o = this._osc('triangle', 460, t, t + 0.036);
      o.frequency.exponentialRampToValueAtTime(290, t + 0.022);
      const g = this._env(0.24 * gain, t, 0, 0.032);
      o.connect(g); g.connect(this.dryBus); g.connect(this.reverbIn);
      return;
    }

    if (mode === 'acid') {
      const cGain = (val === 2 ? 0.34 : 0.42) * gain;
      const src = this._buf(this.noiseBuf, t, t + 0.16);
      const bp = this._flt('bandpass', 1450, 1.1, t);
      const lp = this._flt('lowpass', 4800, 0, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(cGain, t + 0.002);
      g.gain.linearRampToValueAtTime(cGain * 0.15, t + 0.010);
      g.gain.linearRampToValueAtTime(cGain * 0.92, t + 0.013);
      g.gain.linearRampToValueAtTime(cGain * 0.18, t + 0.021);
      g.gain.linearRampToValueAtTime(cGain, t + 0.024);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      src.connect(bp); bp.connect(lp); lp.connect(g);
      g.connect(this.dryBus); g.connect(this.reverbIn);
      return;
    }

    const gScale = val === 2 ? 0.38 : 1.0;
    const dur = mode === 'retrowave' ? 0.22 : (mode === 'breakbeat' || mode === 'tracker' ? 0.12 : 0.16);
    const src = this._buf(mode === 'tracker' ? this.crushNoiseBuf : this.noiseBuf, t, t + dur + 0.02);
    const bp = this._flt('bandpass', mode === 'breakbeat' ? 1880 : (mode === 'tracker' ? 2150 : 1420), mode === 'breakbeat' ? 0.85 : 0.65, t);
    const lp = this._flt('lowpass', mode === 'retrowave' ? 4500 : 5200, 0, t);
    const amp = (mode === 'retrowave' ? 0.34 : 0.42) * gain * gScale;
    const g = this._env(amp, t, 0.003, dur, mode === 'retrowave' ? (0.24 / 0.34) : 0, 0.14 / 0.22);
    src.connect(bp); bp.connect(lp); lp.connect(g);
    g.connect(this.dryBus);
    if (mode !== 'tracker') g.connect(this.reverbIn);

    const osc = this._osc('triangle', mode === 'breakbeat' ? 225 : 196, t, t + 0.09);
    osc.frequency.exponentialRampToValueAtTime(118, t + 0.065);
    const og = this._env((mode === 'retrowave' ? 0.24 : 0.32) * gain * gScale, t, 0, 0.085);
    osc.connect(og); og.connect(this.dryBus);
  }

  _playModeHat(mode, t, secHat, hVal) {
    const isOpen = hVal === 2, isGhost = hVal === 3;
    const dur = isOpen ? (mode === 'acid' ? 0.145 : 0.092) : 0.024;
    const src = this._buf(mode === 'tracker' ? this.crushNoiseBuf : this.noiseBuf, t, t + dur + 0.01);
    const bp = this._flt('bandpass', mode === 'acid' && isOpen ? 6900 : 8200, mode === 'acid' && isOpen ? 0.9 : 1.2, t);
    const baseG = isOpen ? (mode === 'acid' ? 0.14 : 0.095) : (isGhost ? 0.032 : 0.060);
    const g = this._env(baseG * secHat, t, 0, dur);
    src.connect(bp); bp.connect(g); g.connect(this.dryBus);
  }

  // Track 4 Exclusive: Pre-baked 6-Oscillator Inharmonic TR-909 Metallic Ride Cymbal (1 BufferSource vs 6 oscs!)
  _playRide909(t, gain) {
    const src = this._buf(this.ride909Buf, t, t + 0.20);
    const hp = this._flt('highpass', 6200, 0, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain * 2.2, t);
    src.connect(hp); hp.connect(g); g.connect(this.dryBus);
  }

  // Track 2 Exclusive: Metallic Industrial Anvil Clang!
  _playAnvilClang(t, gain) {
    const hp = this._flt('highpass', 900, 0, t);
    const g = this._env(gain, t, 0.003, 0.42);
    hp.connect(g); g.connect(this.dryBus); g.connect(this.reverbIn);
    for (const r of [1.0, 2.76, 5.40]) this._osc('square', 340 * r, t, t + 0.44).connect(hp);
  }

  _playTom(t, startFreq, gain, dry = false) {
    const osc = this._osc(dry ? 'square' : 'triangle', startFreq, t, t + 0.21);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.46, t + 0.18);
    const g = this._env(gain * (dry ? 0.55 : 1.0), t, 0.004, 0.20);
    osc.connect(g); g.connect(this.dryBus);
    if (!dry) g.connect(this.reverbIn);
  }

  _playSubDrop(t, gain) {
    const osc = this._osc('sine', 84, t, t + 0.80);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.72);
    const g = this._env(gain, t, 0.015, 0.78);
    osc.connect(g); g.connect(this.dryBus); g.connect(this.subTapBus);
  }

  _playRiser(t, dur) {
    const src = this._buf(this.noiseBuf, t, t + dur + 0.02, true);
    const bp = this._flt('bandpass', 280, 2.4, t);
    bp.frequency.exponentialRampToValueAtTime(3600, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.003, t); g.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.92); g.gain.linearRampToValueAtTime(0.001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.reverbIn);
  }

  _playCrash(t, gain) {
    const src = this._buf(this.noiseBuf, t, t + 1.30);
    const bp = this._flt('bandpass', 4800, 0.65, t);
    const g = this._env(gain, t, 0, 1.25);
    src.connect(bp); bp.connect(g); g.connect(this.dryBus); g.connect(this.reverbIn);
  }

  // =========================================================================
  // TRACK 01 RACK (ZERO FRICTION): Neuro-Wobble Talking 24dB/oct Bass,
  // 5-Voice Stadium Supersaw, ±12c Dual-Saw Arp, 6-Band Pulse Cyber-Vocoder
  // =========================================================================

  _playNeuroWobbleBass(t, dur, freq, gain, filterAmt, bpm, isGrowl) {
    const stop = t + dur + 0.02;
    const osc = this._osc('sawtooth', freq, t, stop);
    const sub = this._osc('sine', freq * 0.5, t, stop);
    const subG = this._gain(0.58);

    // Cascaded 24dB/oct LPF (280Hz -> 2.5kHz) + 1/8t synced LFO (clamped strictly >140Hz so cutoff NEVER hits 0Hz!)
    const f1 = this._flt('lowpass', 280, isGrowl ? 2.8 : 1.9, t);
    const f2 = this._flt('lowpass', 280, isGrowl ? 2.8 : 1.9, t);
    const peakCut = 980 + filterAmt * 1520;
    for (const f of [f1, f2]) {
      f.frequency.exponentialRampToValueAtTime(peakCut, t + 0.016);
      f.frequency.exponentialRampToValueAtTime(440, t + dur);
    }

    const lfo = this._osc('sine', (bpm / 60) * 3.0, t, stop); // 1/8t sync!
    const lfoG = this.ctx.createGain();
    lfoG.gain.setValueAtTime((isGrowl ? 260 : 170) * filterAmt, t);
    lfoG.gain.linearRampToValueAtTime(110 * filterAmt, t + dur);
    lfo.connect(lfoG); lfoG.connect(f1.frequency); lfoG.connect(f2.frequency);

    const g = this._env(gain, t, 0.005, dur);
    osc.connect(f1); sub.connect(subG); subG.connect(f1);
    f1.connect(f2); f2.connect(g);

    // Parallel Neuro/Dubstep Double-Formant Talking "YOY/WUB" FM Growl on wobble hits!
    if (isGrowl) {
      const fmCar = this._fm(t, stop, freq, freq * 2.0, freq * 3.2, freq * 0.6, dur, 'sawtooth');
      const fGrowl1 = this._flt('bandpass', 280, 4.6, t);
      fGrowl1.frequency.exponentialRampToValueAtTime(860, t + dur * 0.42);
      fGrowl1.frequency.exponentialRampToValueAtTime(310, t + dur);
      const fGrowl2 = this._flt('bandpass', 920, 4.2, t);
      fGrowl2.frequency.exponentialRampToValueAtTime(2150, t + dur * 0.48);
      fGrowl2.frequency.exponentialRampToValueAtTime(780, t + dur);
      const grG = this._gain(0.62);
      fmCar.connect(fGrowl1); fmCar.connect(fGrowl2);
      fGrowl1.connect(grG); fGrowl2.connect(grG); grG.connect(g);
    }

    g.connect(this.pumpBus); g.connect(this.subTapBus);
  }

  _playAnthemSupersaw(t, dur, freqs, gain, cutoff) {
    // Wide stereo stadium Supersaw chords (3 detuned saws per note -> 40% fewer oscs, same stadium wall!)
    const detunes = [-18, 0, 18];
    const flts = [-0.78, 0.78].map(p => {
      const flt = this._flt('lowpass', Math.min(3100, cutoff), 1.1, t);
      flt.frequency.exponentialRampToValueAtTime(520, t + dur);
      const g = this._env(gain * 1.25, t, 0.012, dur);
      const pan = this._pan(p);
      flt.connect(g); g.connect(pan); pan.connect(this.pumpBus); pan.connect(this.reverbIn);
      return flt;
    });
    for (const f of freqs) {
      for (let i = 0; i < 3; i++) {
        this._osc('sawtooth', f, t, t + dur + 0.02, detunes[i])
          .connect(i === 0 ? flts[0] : (i === 2 ? flts[1] : flts[f % 2 < 1 ? 0 : 1]));
      }
    }
  }

  _playDualSawArp(t, dur, freq, gain, cutoff, panVal) {
    const flt = this._flt('lowpass', Math.min(2800, cutoff), 1.6, t);
    flt.frequency.exponentialRampToValueAtTime(360, t + Math.min(dur, 0.09));
    const pan = this._pan(panVal);
    const g = this._env(gain, t, 0.004, dur);
    this._osc('sawtooth', freq, t, t + dur + 0.02, -12).connect(flt);
    this._osc('sawtooth', freq, t, t + dur + 0.02, 12).connect(flt);
    flt.connect(g); g.connect(pan);
    pan.connect(this.mixBus); pan.connect(this.delayIn); pan.connect(this.reverbIn);
  }

  _playCyberVocoderStab(t, dur, freq, gain, cons = 1) {
    this._playConsonant(t, cons, gain * 0.7, this.mixBus);
    const osc = this._osc(this.pulse15Wave, freq, t, t + dur + 0.02);
    const outG = this._env(gain, t, 0.012, dur);
    this._formants(osc, outG, t, dur, [500, 1200, 2800], null, 1, 4.6, [0.80, 0.62, 0.30]);
    outG.connect(this.mixBus); outG.connect(this.delayIn); outG.connect(this.reverbIn);
  }

  _playCyberVocoderLead(t, dur, freq, gain, slide, phKey, cons) {
    // Articulated Cybernetic Electro-Vocoder singing Track 1's melodies!
    const [fA, fB] = PHONEMES[phKey] || PHONEMES.EE;
    this._playConsonant(t, cons, gain * 0.65, this.mixBus);
    const startF = (slide > 0 && Math.abs(freq - this._lastVocalFreq) < freq * 0.5) ? this._lastVocalFreq : freq;
    this._lastVocalFreq = freq;
    const glideT = slide > 0 ? 0.045 : 0.008;
    const o1 = this._osc(this.pulse15Wave, startF, t, t + dur + 0.03);
    const o2 = this._osc('sawtooth', startF * 0.5, t, t + dur + 0.03);
    o1.frequency.exponentialRampToValueAtTime(freq, t + glideT);
    o2.frequency.exponentialRampToValueAtTime(freq * 0.5, t + glideT);

    const srcMix = this._gain(1.0);
    const subG = this._gain(0.45);
    o1.connect(srcMix); o2.connect(subG); subG.connect(srcMix);

    const env = this._env(gain, t, 0.020, dur, 0.85, 0.72);
    const coreLp = this._flt('lowpass', 2200, 0, t);
    const coreG = this._gain(0.24);
    o1.connect(coreLp); coreLp.connect(coreG); coreG.connect(env);
    this._formants(srcMix, env, t, dur, fA, fB, 1, 4.2, [0.82, 0.66, 0.34]);
    env.connect(this.mixBus); env.connect(this.delayIn); env.connect(this.reverbIn);
  }

  // =========================================================================
  // TRACK 02 RACK (OVERDRIVE): Palm-Muted Metal Power-Chord Guitar Chugs,
  // Hard-Clip Saw+Sub, Distorted Pitch-Drop Stabs, Deep Baritone Metal Vocoder
  // =========================================================================

  _playChugMetalGuitar(t, dur, rootMidi, gain, isOpen) {
    // Palm-muted heavy metal power chord (root + 5th + octave -> 13ms stereo double-tracked 4x12 cab!)
    const notes = [rootMidi, rootMidi + 7, rootMidi + 12];
    const dets = [-5, 5, 0];
    const palmLp = this._flt('lowpass', isOpen ? 3300 : 2300, isOpen ? 1.1 : 2.5, t);
    palmLp.frequency.exponentialRampToValueAtTime(isOpen ? 1500 : 300, t + (isOpen ? dur : 0.072));
    const env = this._env(gain * 1.28, t, 0.003, dur);
    palmLp.connect(env); env.connect(this.metalAmpBus);
    for (let i = 0; i < 3; i++) this._osc('sawtooth', midiToFreq(notes[i]), t, t + dur + 0.02, dets[i]).connect(palmLp);
  }

  _playDarkBass(t, dur, subFreq, midFreq, gain, filterAmt) {
    const sub = this._osc('sine', subFreq, t, t + dur + 0.02);
    const subG = this._env(gain * 0.92, t, 0.005, dur);
    sub.connect(subG); subG.connect(this.pumpBus); subG.connect(this.subTapBus);

    const saw = this._osc('sawtooth', midFreq, t, t + dur + 0.02);
    const flt = this._flt('lowpass', 600 + filterAmt * 1300, 2.4, t);
    flt.frequency.exponentialRampToValueAtTime(260, t + dur);
    const mG = this._env(gain * 0.72, t, 0.004, dur);
    saw.connect(flt); flt.connect(mG); mG.connect(this.darkDistBus);
  }

  _playDarkBrassStab(t, dur, freqs, gain) {
    const g = this._env(gain, t, 0.010, dur);
    g.connect(this.darkDistBus); g.connect(this.reverbIn);
    for (const f of freqs) {
      for (const det of [-10, 10]) {
        const o = this._osc('square', f * 1.07, t, t + dur + 0.02, det);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.045);
        o.frequency.exponentialRampToValueAtTime(f * 0.94, t + dur);
        o.connect(g);
      }
    }
  }

  _playRingModVocal(t, dur, freq, gain) {
    // Clean industrial ring-mod vocal stab (pitched metallic modulator + light grit, no random sputter!)
    this._playConsonant(t, 2, gain * 0.7, this.mixBus);
    const stop = t + dur + 0.02;
    const car = this._osc(this.pulse25Wave, freq, t, stop);
    const mod = this._osc('sine', freq * 1.414, t, stop);
    const noise = this._buf(this.crushNoiseBuf, t, stop);
    const ring = this.ctx.createGain(); ring.gain.setValueAtTime(0.45, t);
    const modDepth = this._gain(0.35), nDepth = this._gain(0.22);
    mod.connect(modDepth); modDepth.connect(ring.gain);
    noise.connect(nDepth); nDepth.connect(ring.gain);
    const bp = this._flt('bandpass', 980, 2.0, t);
    const env = this._env(gain * 0.85, t, 0.012, dur);
    car.connect(ring); ring.connect(bp); bp.connect(env);
    env.connect(this.mixBus); env.connect(this.reverbIn);
  }

  _playBaritoneMetalVocoder(t, dur, freq, gain, phKey, cons) {
    // Deep menacing Baritone Male Industrial Vocoder (82..165Hz + subtle throat grit + 0.84x dark formants!)
    const [fA, fB] = PHONEMES[phKey] || PHONEMES.AH;
    this._playConsonant(t, cons, gain * 0.75, this.mixBus);
    const stop = t + dur + 0.03;
    const o1 = this._osc('sawtooth', freq, t, stop);
    const o2 = this._osc(this.pulse15Wave, freq * 1.006, t, stop);
    const o3 = this._osc(this.pulse15Wave, freq * 2.0, t, stop);
    const o3G = this._gain(0.42);

    // Subtle vocal-fry grit without stuttery AM tremolo!
    const fry = this._osc('sine', 28, t, stop);
    const fryG = this._gain(0.09);
    const fryBus = this.ctx.createGain(); fryBus.gain.setValueAtTime(0.90, t);
    fry.connect(fryG); fryG.connect(fryBus.gain);
    o1.connect(fryBus); o2.connect(fryBus); o3.connect(o3G); o3G.connect(fryBus);

    const env = this._env(gain, t, 0.014, dur, 0.88, 0.72);
    this._formants(fryBus, env, t, dur, fA, fB, 0.84, 4.0, [0.92, 0.72, 0.36]);
    env.connect(this.mixBus); env.connect(this.reverbIn);
  }

  _playScreamingMetalLead(t, dur, freq, gain, slide) {
    let startF = freq, glideT = 0.010;
    if (slide === 2) { startF = freq * 0.944; glideT = 0.070; }
    else if (slide === 1 && Math.abs(freq - this._lastLeadFreq) < freq * 0.5) { startF = this._lastLeadFreq; glideT = 0.040; }
    this._lastLeadFreq = freq;
    const stop = t + dur + 0.03;
    const o1 = this._osc('sawtooth', startF, t, stop);
    const o2 = this._osc('triangle', startF * 1.003, t, stop);
    o1.frequency.exponentialRampToValueAtTime(freq, t + glideT);
    o2.frequency.exponentialRampToValueAtTime(freq * 1.003, t + glideT);
    const lfo = this._osc('sine', 6.0, t, stop);
    const lfoG = this.ctx.createGain();
    lfoG.gain.setValueAtTime(0, t); lfoG.gain.linearRampToValueAtTime(freq * 0.010, t + 0.22);
    lfo.connect(lfoG); lfoG.connect(o1.frequency); lfoG.connect(o2.frequency);
    const env = this._env(gain, t, 0.010, dur);
    o1.connect(env); o2.connect(env);
    env.connect(this.metalAmpBus); env.connect(this.delayIn);
  }

  // =========================================================================
  // TRACK 03 RACK (TRACKER PROTOCOL): YM2612 32nd FM Arps (Index 4.0), Dry 25%
  // Pulse + YM2612 Slap Bass, 90s Arcade Orchestra Stabs, Soprano Chip Vocals
  // =========================================================================

  _playYm2612Arp(t, dur, freq, gain, panVal) {
    const car = this._fm(t, t + dur + 0.01, freq, freq * 2.0, freq * 4.0, Math.max(10, freq * 0.4), dur, 'square');
    const lp = this._flt('lowpass', 4800, 0, t);
    const pan = this._pan(panVal);
    const outG = this._env(gain, t, 0.002, dur);
    car.connect(lp); lp.connect(outG); outG.connect(pan);
    pan.connect(this.dryBus); pan.connect(this.delayIn);
  }

  _playYm2612SlapBass(t, dur, freq, gain, isSlap) {
    // Dry 25%-duty 8-bit pulse wave bass (ZERO reverb) + YM2612 FM slap bark!
    const osc = this._osc(this.pulse25Wave, isSlap ? freq * 1.45 : freq, t, t + dur + 0.01);
    if (isSlap) osc.frequency.exponentialRampToValueAtTime(freq, t + 0.016);
    const lp = this._flt('lowpass', isSlap ? 2400 : 1550, 0, t);
    lp.frequency.exponentialRampToValueAtTime(420, t + dur);
    const g = this._env(gain, t, 0.003, dur);
    osc.connect(lp); lp.connect(g);
    g.connect(this.dryBus); g.connect(this.subTapBus);

    // Sega Genesis 3:1 FM bass slap pop transient on downbeats!
    if (isSlap) {
      const car = this._fm(t, t + 0.07, freq * 2.0, freq * 6.0, freq * 5.0, 1, 0.045);
      const sg = this._env(gain * 0.42, t, 0, 0.065);
      car.connect(sg); sg.connect(this.dryBus);
    }
  }

  _playEuroArcadeStab(t, dur, freqs, gain) {
    // Punchy 90s Sega Arcade Synth-Brass / Orchestra Hit stabs!
    const lp = this._flt('lowpass', 3400, 1.4, t);
    lp.frequency.exponentialRampToValueAtTime(950, t + dur);
    const g = this._env(gain, t, 0.006, dur);
    lp.connect(g); g.connect(this.dryBus); g.connect(this.delayIn);
    for (const f of freqs) this._osc(this.pulse25Wave, f * 2.0, t, t + dur + 0.01).connect(lp);
  }

  _playChipTriPad(t, dur, freqs, gain) {
    const g = this._env(gain, t, 0.08, dur);
    g.connect(this.dryBus);
    for (const f of freqs) this._osc('triangle', f, t, t + dur + 0.02).connect(g);
  }

  _playKawaiiChipVocal(t, dur, freq, gain, phKey, cons, harmony = false) {
    // Hyper-Bright Soprano Vocaloid/J-Core Chip Vocals (1.32x shifted formants + cute chirp onset!)
    const [fA, fB] = PHONEMES[phKey] || PHONEMES.EE;
    this._playConsonant(t, cons, gain * 0.65, this.dryBus);
    const voices = harmony ? [1.0, 0.7937, 0.6674] : [1.0];
    const vScales = harmony ? [0.75, 0.42, 0.36] : [1.0];

    for (let vi = 0; vi < voices.length; vi++) {
      const vf = freq * voices[vi], stop = t + dur + 0.02;
      const osc = this._osc('square', vf * 0.92, t, stop);
      osc.frequency.exponentialRampToValueAtTime(vf, t + 0.018);

      const lfo = this._osc('sine', 7.4, t, stop);
      const lfoG = this.ctx.createGain();
      lfoG.gain.setValueAtTime(0, t); lfoG.gain.linearRampToValueAtTime(vf * 0.009, t + 0.12);
      lfo.connect(lfoG); lfoG.connect(osc.frequency);

      const preLp = this._flt('lowpass', 4200, 0, t);
      osc.connect(preLp);
      const env = this._env(gain * vScales[vi], t, 0.008, dur, 0.84, 0.78);
      const drySq = this._gain(0.22);
      preLp.connect(drySq); drySq.connect(env);
      this._formants(preLp, env, t, dur, fA, fB, 1.32, 4.0, [0.70, 0.60, 0.30], 4200, 0.80);

      const pan = this._pan(vi === 0 ? 0 : (vi === 1 ? -0.45 : 0.45));
      env.connect(pan); pan.connect(this.dryBus); pan.connect(this.delayIn);
    }
  }

  // =========================================================================
  // TRACK 04 RACK (VECTOR MATRIX): Screaming TB-303 Acid, 90s Detroit Minor-9th
  // Metallic FM Rave Stabs, Woody FM Rave Lead, Glitch-Stuttered Vocal Chops
  // =========================================================================

  _playAcid303(t, dur, freq, secGain, normCut, accent, slide, isDrop) {
    const startF = (slide && Math.abs(freq - this._lastAcidFreq) < freq * 2.2) ? this._lastAcidFreq : freq;
    this._lastAcidFreq = freq;
    const osc = this._osc(isDrop ? 'square' : 'sawtooth', startF, t, t + dur + 0.02);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq, t + 0.048);

    const baseCut = 200 + normCut * 2600;
    const flt = this._flt('lowpass', Math.min(6000, baseCut + (accent ? 3200 : 1400)), accent ? 16.0 : 12.2, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(200, baseCut * 0.55), t + (accent ? 0.14 : 0.11));

    const g = this._env(secGain * (accent ? 0.35 : 0.24), t, 0.004, dur);
    osc.connect(flt); flt.connect(g); g.connect(this.acidSatBus); g.connect(this.subTapBus);
  }

  _playDetroitRaveStab(t, dur, freqs, gain) {
    // Classic 90s Wipeout / Detroit Metallic FM Minor-9th Rave Chord Stab into dub delay!
    const hp = this._flt('highpass', 320, 0, t);
    const lp = this._flt('lowpass', 3600, 2.0, t);
    lp.frequency.exponentialRampToValueAtTime(680, t + dur);
    const g = this._env(gain, t, 0.005, dur);
    hp.connect(lp); lp.connect(g); g.connect(this.pumpBus); g.connect(this.delayIn); g.connect(this.reverbIn);
    for (const f of freqs) this._fm(t, t + dur + 0.02, f, f * 3.0, f * 2.4, 1, dur * 0.7).connect(hp);
  }

  _playFmRaveLead(t, dur, freq, gain) {
    // Hollow Woody 2-op FM Rave Organ/Lead (ratio 3.0 — completely distinct from saw leads!)
    const car = this._fm(t, t + dur + 0.02, freq, freq * 3.0, freq * 2.1, freq * 0.35, dur * 0.6);
    const lp = this._flt('lowpass', 3200, 0, t);
    const g = this._env(gain, t, 0.008, dur);
    car.connect(lp); lp.connect(g);
    g.connect(this.mixBus); g.connect(this.delayIn); g.connect(this.reverbIn);
  }

  _playGlitchVocalChop(t, dur, freq, gain, phKey) {
    // 32nd-note Stutter-Gated Chordal Robotic Acid Vocal Chop ("V-V-VEC-TOR!")
    const [fA] = PHONEMES[phKey] || PHONEMES.AH;
    this._playConsonant(t, 1, gain * 0.7, this.mixBus);
    const osc1 = this._osc(this.pulse15Wave, freq * 1.12, t, t + dur + 0.02);
    osc1.frequency.exponentialRampToValueAtTime(freq, t + 0.028);
    const osc2 = this._osc(this.pulse25Wave, freq * 1.5, t, t + dur + 0.02);

    // 32nd-note stutter gate (2 rapid chops inside dur!)
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.005);
    env.gain.linearRampToValueAtTime(0.02, t + dur * 0.40);
    env.gain.linearRampToValueAtTime(gain * 0.92, t + dur * 0.50);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    this._formants([osc1, osc2], env, t, dur, fA, null, 1.24, 4.6, [0.74, 0.58, 0.28], 3800);
    env.connect(this.mixBus); env.connect(this.delayIn); env.connect(this.reverbIn);
  }

  // =========================================================================
  // TRACK 05 RACK (ANTI-GRAV DRIFT): 7-Saw 0.2Hz-LFO Pad, Juno/DX7 Chorus
  // Rhodes Keys, 45Hz Pumping Sub, 3-Part Harmonized Retrowave Vocals, Sax
  // =========================================================================

  _playSubSine45(t, dur, freq, gain) {
    const osc = this._osc('sine', freq, t, t + dur + 0.03);
    const warm = this._osc('triangle', freq * 2.0, t, t + dur + 0.03);
    const wG = this._gain(0.14);
    const g = this._env(gain, t, 0.015, dur, 0.88, 0.85);
    osc.connect(g); warm.connect(wG); wG.connect(g);
    g.connect(this.pumpBus); g.connect(this.subTapBus);
  }

  _playSevenSawPad(t, dur, freqs, gain, filterAmt) {
    const detunes = [-18, -11, -5, 0, 5, 11, 18];
    const pans    = [-0.82, -0.56, -0.28, 0.0, 0.28, 0.56, 0.82];
    const baseCut = 640 + filterAmt * 840, stop = t + dur + 0.05;
    const flts = [-0.82, 0.82].map(p => {
      const flt = this._flt('lowpass', baseCut, 0.9, t);
      const g = this._env(gain, t, Math.min(0.45, dur * 0.25), dur, 0.86, 0.78);
      const pan = this._pan(p);
      flt.connect(g); g.connect(pan); pan.connect(this.pumpBus); pan.connect(this.reverbIn);
      return flt;
    });
    const lfo = this._osc('sine', 0.2, t, stop);
    const lfoG = this.ctx.createGain(); lfoG.gain.setValueAtTime(340, t);
    lfo.connect(lfoG); lfoG.connect(flts[0].frequency); lfoG.connect(flts[1].frequency);
    for (let i = 0; i < 7; i++) {
      this._osc('sawtooth', freqs[i % freqs.length], t, stop, detunes[i]).connect(flts[pans[i] <= 0 ? 0 : 1]);
    }
  }

  _playJunoChorusRhodes(t, dur, freqs, gain) {
    // Lush 80s DX7/Juno Stereo Chorus Electric Piano Ballad Chords!
    const lp = this._flt('lowpass', 3600, 0, t);
    lp.connect(this.pumpBus); lp.connect(this.reverbIn);
    for (let i = 0; i < freqs.length; i++) {
      const f = freqs[i];
      const car = this._fm(t, t + dur + 0.03, f * (1 + (i - 1.5) * 0.0015), f * 7.0, f * 0.78, 0.2, 0.16);
      const outG = this._env(gain, t, 0.009, dur);
      const pan = this._pan((i - 1.5) * 0.36);
      car.connect(outG); outG.connect(pan); pan.connect(lp);
    }
  }

  _playGlassBellArp(t, dur, freq, gain, panVal) {
    const car = this._fm(t, t + dur + 0.02, freq, freq * 3.0, freq * 0.85, 0.5, 0.12);
    const g = this._env(gain, t, 0.004, dur);
    const pan = this._pan(panVal);
    car.connect(g); g.connect(pan);
    pan.connect(this.mixBus); pan.connect(this.delayIn); pan.connect(this.reverbIn);
  }

  _playVelvetSax(t, dur, freq, gain) {
    const o1 = this._osc('sawtooth', freq * 0.96, t, t + dur + 0.03);
    const o2 = this._osc('triangle', freq * 0.96, t, t + dur + 0.03);
    o1.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    o2.frequency.exponentialRampToValueAtTime(freq * 1.003, t + 0.05);
    const flt = this._flt('lowpass', 520, 2.0, t);
    flt.frequency.exponentialRampToValueAtTime(1750, t + 0.10);
    flt.frequency.exponentialRampToValueAtTime(860, t + dur);
    const g = this._env(gain, t, 0.04, dur);
    o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(this.mixBus); g.connect(this.delayIn); g.connect(this.reverbIn);
  }

  _playPopRetrowaveVocal(t, dur, freq, gain, slide, phKey, cons, harmony = false) {
    // Lush Articulated Pop-Retrowave Vocals (sine+tri glottal core + breath air + consonant + diphthong + 3-part chorus!)
    const [fA, fB] = PHONEMES[phKey] || PHONEMES.OH;
    this._playConsonant(t, cons, gain * 0.55, this.mixBus);
    const startF = (slide > 0 && Math.abs(freq - this._lastVocalFreq) < freq * 0.5) ? this._lastVocalFreq : freq;
    this._lastVocalFreq = freq;
    const glideT = slide > 0 ? 0.072 : 0.012;
    const ratios = harmony ? [1.0, 0.8409, 0.6674] : [1.0];
    const scales = harmony ? [0.78, 0.44, 0.36] : [1.0];

    for (let vi = 0; vi < ratios.length; vi++) {
      const vf = freq * ratios[vi], vsf = startF * ratios[vi], stop = t + dur + 0.05;
      const car = this._osc('sine', vsf, t, stop);
      const harm = this._osc('triangle', vsf * 2.0, t, stop);
      car.frequency.exponentialRampToValueAtTime(vf, t + glideT);
      harm.frequency.exponentialRampToValueAtTime(vf * 2.0, t + glideT);

      const lfo = this._osc('sine', 5.2, t, stop);
      const lfoG = this.ctx.createGain();
      lfoG.gain.setValueAtTime(0, t); lfoG.gain.linearRampToValueAtTime(vf * 0.010, t + 0.24);
      lfo.connect(lfoG); lfoG.connect(car.frequency); lfoG.connect(harm.frequency);

      const srcMix = this._gain(1.0);
      const harmG = this._gain(0.38);
      car.connect(srcMix); harm.connect(harmG); harmG.connect(srcMix);

      if (vi === 0) {
        const airSrc = this._buf(this.noiseBuf, t, stop);
        const airBp = this._flt('bandpass', 2450, 1.1, t);
        const airG = this._gain(0.14);
        airSrc.connect(airBp); airBp.connect(airG); airG.connect(srcMix);
      }

      const env = this._env(gain * scales[vi], t, 0.068, dur, 0.85, 0.74);
      const sineCore = this._gain(0.36);
      car.connect(sineCore); sineCore.connect(env);
      this._formants(srcMix, env, t, dur, fA, fB, 1, 3.5, [0.78, 0.58, 0.28], 9999, 0.84);

      const pan = this._pan(vi === 0 ? 0 : (vi === 1 ? -0.52 : 0.52));
      env.connect(pan); pan.connect(this.mixBus); pan.connect(this.reverbIn); pan.connect(this.delayIn);
    }
  }

  _playDarkDronePad(t, dur, freqs, gain, cutoff) {
    const flt = this._flt('lowpass', cutoff * 0.7, 0.8, t);
    flt.frequency.linearRampToValueAtTime(cutoff, t + dur * 0.5);
    flt.frequency.linearRampToValueAtTime(cutoff * 0.7, t + dur);
    const g = this._env(gain, t, 0.25, dur);
    flt.connect(g); g.connect(this.pumpBus); g.connect(this.reverbIn);
    for (const f of freqs) this._osc('sawtooth', f, t, t + dur + 0.04).connect(flt);
  }

  // =========================================================================
  // MODE LEAD DISPATCHER (ZERO SHARED GENERIC PATCHES ACROSS TRACKS!)
  // =========================================================================

  _playModeLead(mode, t, dur, midi, freq, slide, phKey, cons, filterAmt, isDrop) {
    if (mode === 'breakbeat') {
      this._playCyberVocoderLead(t, dur, freq, isDrop ? 0.44 : 0.36, slide, phKey, cons);
    } else if (mode === 'darksynth') {
      if (isDrop) {
        this._playScreamingMetalLead(t, dur, freq, 0.30, slide);
      } else {
        this._playBaritoneMetalVocoder(t, dur, freq, 0.58, phKey, cons);
      }
    } else if (mode === 'tracker') {
      this._playKawaiiChipVocal(t, dur, freq, 0.44, phKey, cons, isDrop > 0);
    } else if (mode === 'acid') {
      this._playFmRaveLead(t, dur, freq, isDrop ? 0.16 : 0.13);
    } else {
      this._playPopRetrowaveVocal(t, dur, freq, 0.47, slide, phKey, cons, isDrop > 0);
    }
  }

  // =========================================================================
  // REAL-TIME AUDIO TELEMETRY & ALL 5 VISUAL SYNC HOOKS
  // =========================================================================

  update(dt, nowSec) {
    const tel = this.telemetry;
    tel.mode = this.track.mode;
    tel.rasterMode = this.track.mode === 'tracker' ? 1.0 : 0.0;
    tel.padLFO = 0.5 + 0.5 * Math.sin(nowSec * Math.PI * 2 * 0.2);

    if (!this.playing || !this.ctx) {
      const idlePhase = (nowSec * 1.6) % 1;
      tel.beatPhase = idlePhase;
      tel.beatPulse = Math.exp(-idlePhase * 8.0);
      tel.kick = tel.beatPulse * 0.3;
      tel.kickTrigger = tel.kick;
      tel.snare = 0;
      tel.dropFlash = 0;
      tel.energy = 0.24 + 0.06 * Math.sin(nowSec * 0.6);
      tel.isDrop = 0;
      tel.isRoll = 0;
      tel.bassEnergy = tel.kick * 0.4;
      tel.subBassPunch = tel.kick * 0.4;
      tel.stabPulse = 0;
      tel.accentTrigger = 0;
      tel.filterCutoffNormalized = 0.25;
      tel.subBassEnvelope = 0.35 + 0.35 * (1 - idlePhase);
      tel.sectionName = this.ctx ? 'PAUSED' : 'STANDBY';
      return tel;
    }

    const t = this.ctx.currentTime;
    this._drainEvents(t);
    const beatDur = 60 / this.track.bpm;
    const elapsed = Math.max(0, t - this.startTime);
    tel.beatPhase = (elapsed / beatDur) % 1;

    const dtBeat = Math.max(0, t - this._lastBeatTime);
    const dtKick = Math.max(0, t - this._lastKickTime);
    const dtSnare = Math.max(0, t - this._lastSnareTime);
    const dtDrop = Math.max(0, t - this._lastDropTime);
    const dtStab = Math.max(0, t - this._lastStabTime);
    const dtAcc = Math.max(0, t - this._lastAccentTime);

    tel.beatPulse = Math.exp(-dtBeat * 12.0);
    tel.kick = Math.exp(-dtKick * 13.0);
    tel.kickTrigger = tel.kick;
    tel.snare = Math.exp(-dtSnare * 10.0);
    tel.dropFlash = Math.exp(-dtDrop * 1.8);
    tel.stabPulse = Math.exp(-dtStab * 11.0);
    tel.accentTrigger = Math.exp(-dtAcc * 14.0);
    tel.filterCutoffNormalized += (this._lastAcidCutoffNorm - tel.filterCutoffNormalized) * Math.min(1, dt * 10.0);
    tel.subBassEnvelope = Math.min(1, Math.max(0, 1.0 - Math.exp(-tel.beatPhase * 5.2)));

    if (this.fftAnalyser && this._fftData) {
      this.fftAnalyser.getByteFrequencyData(this._fftData);
      let sum = 0;
      for (let i = 0; i < 6; i++) sum += this._fftData[i];
      const rawBass = Math.min(1, (sum / (6 * 255)) * 1.45);
      tel.bassEnergy += (rawBass - tel.bassEnergy) * Math.min(1, dt * 16.0);
    } else {
      tel.bassEnergy = tel.kick;
    }

    if (this.subAnalyser && this._subTimeData) {
      this.subAnalyser.getFloatTimeDomainData(this._subTimeData);
      let peak = 0;
      for (let i = 0; i < this._subTimeData.length; i++) {
        const a = Math.abs(this._subTimeData[i]);
        if (a > peak) peak = a;
      }
      const normPeak = Math.min(1, peak * 1.35);
      const pRate = normPeak > tel.subBassPunch ? 28.0 : 8.0;
      tel.subBassPunch += (normPeak - tel.subBassPunch) * Math.min(1, dt * pRate);
    } else {
      tel.subBassPunch = tel.kick;
    }

    const rate = this._sectionEnergy > tel.energy ? 6.5 : 2.8;
    tel.energy += (this._sectionEnergy - tel.energy) * Math.min(1, dt * rate);
    tel.isDrop = this._sectionDrop;
    tel.isRoll = this._sectionRoll;
    tel.sectionName = this._sectionName;
    return tel;
  }
}
