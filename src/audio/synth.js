// Five-Engine Web Audio API Synthesizer & Real-Time Visual Telemetry Suite:
// 01 ZERO FRICTION    : Breakbeat drums (808 kick 150->45Hz), 24dB/oct 1/8t-LFO saw bass,
//                       ±12c dual-saw arps, pulse formant vocoder stabs (500/1200/2800Hz).
// 02 OVERDRIVE        : Hard-clipping distorted saw + 40-80Hz sub-sine, 4x4 industrial kick
//                       (-6dB sidechain), distorted pitch-drop square stabs, ring-mod vocals.
// 03 TRACKER PROTOCOL : 32nd-note YM2612 FM arps (square+sine, index 4.0), dry 25%-duty
//                       8-bit pulse bass (zero reverb), 16-bit PCM drums, chip formant lead.
// 04 VECTOR MATRIX    : Resonant TB-303 (Q 12-18, 200Hz-6kHz sweep, accents & slides),
//                       909 kick/open-hat/offbeat-claps, pitch-shifted formant vocal chops.
// 05 ANTI-GRAV DRIFT  : Deep ~45Hz sub-sine (1/4-note pump), 7-detuned-saw pad with 0.2Hz
//                       LFO & 2.5s gated stereo reverb, airy sine-carrier vocal + 1/8d delay,
//                       707 kick/rimshots & gated 80s snare.

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

function makeHardClipCurve(drive = 9.0) {
  const n = 512;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    // Aggressive hard-clipping curve with tiny knee to prevent aliasing harshness
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

// 2.5s Warm Stereo Gated-Hall Reverb IR (rich lush bloom -> smooth gated decay)
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
      // Lush 80s gated envelope: stays rich early, then curves smoothly down by 2.5s
      const env = p < 0.35 ? Math.pow(1 - p * 0.45, 1.2) : Math.pow(1 - p, 2.4) * 1.15;
      const raw = rnd() * env;
      lp1 = lp1 * 0.65 + raw * 0.35;
      lp2 = lp2 * 0.58 + lp1 * 0.42;
      data[i] = lp2;
    }
  }
  return buf;
}

// Exact 25%-duty pulse wave via Lanczos-smoothed Fourier series (crisp & alias-free!)
function makePulseWave(ctx, duty = 0.25, harmonics = 28) {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let k = 1; k <= harmonics; k++) {
    const sigma = Math.sin((k * Math.PI) / harmonics) / ((k * Math.PI) / harmonics);
    imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * sigma;
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

const VOWEL_FORMANTS = {
  AH: [710, 1120, 2450],
  OO: [330, 870, 2240],
  OH: [520, 860, 2380],
  EE: [300, 2200, 2900]
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
    this.acidSatBus = null;
    this.noiseBuf = null;
    this.crushNoiseBuf = null;
    this.pulse25Wave = null;

    this.trackIndex = 0;
    this.playing = false;
    this.muted = false;
    this._offline = false;

    this.step = 0;
    this.nextStepTime = 0;
    this.timerId = null;
    this.startTime = 0;

    // Comprehensive real-time telemetry & all 5 track Visual Sync Hooks!
    this.telemetry = {
      beatPhase: 0,
      beatPulse: 0,
      kick: 0,
      kickId: 0,
      kickTrigger: 0,           // Track 1 hook
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
      // Track 1 (Zero Friction): FFT bass energy, kick trigger, lead frequency
      bassEnergy: 0,
      leadFrequency: 0,
      leadFreqNorm: 0,
      // Track 2 (Overdrive): Sub-bass peak punch & brass stab triggers
      subBassPunch: 0,
      stabTriggers: 0,
      stabPulse: 0,
      // Track 3 (Tracker Protocol): Step-sequencer tick & retro CRT raster hook
      stepTick: 0,
      stepBar: 0,
      stepNote: 0,
      rasterMode: 0,
      // Track 4 (Vector Matrix): Normalized 303 cutoff & accent trigger
      filterCutoffNormalized: 0,
      accentTrigger: 0,
      accentCount: 0,
      // Track 5 (Anti-Grav Drift): 0.2 Hz pad LFO & 1/4-note sub-bass envelope
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

    // Public callbacks for external visual sync bindings
    this.onLyric = null;
    this.onStep = null; // Track 3 visual sync hook: onStep(bar, note)
  }

  get track() {
    return TRACKS[this.trackIndex];
  }

  _ensureContext(customCtx = null) {
    if (this.ctx && !customCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = customCtx || new AC();

    // Buses: pumpBus (sidechained), dryBus (zero-reverb tracker bass & drums) -> mixBus
    this.pumpBus = this.ctx.createGain();
    this.pumpBus.gain.value = 1.0;

    this.dryBus = this.ctx.createGain();
    this.dryBus.gain.value = 1.0;

    this.mixBus = this.ctx.createGain();
    this.mixBus.gain.value = 0.66;

    // Master Warmth EQ (protects ears against harshness on darksynth/acid/chiptune!)
    const eqLow = this.ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 88;
    eqLow.gain.value = 2.0;

    const eqDip = this.ctx.createBiquadFilter();
    eqDip.type = 'peaking';
    eqDip.frequency.value = 3200;
    eqDip.Q.value = 0.85;
    eqDip.gain.value = -2.4;

    const eqAir = this.ctx.createBiquadFilter();
    eqAir.type = 'lowpass';
    eqAir.frequency.value = 11200;
    eqAir.Q.value = 0.5;

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

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.84;

    this.pumpBus.connect(this.mixBus);
    this.dryBus.connect(this.mixBus);
    this.mixBus.connect(eqLow);
    eqLow.connect(eqDip);
    eqDip.connect(eqAir);
    eqAir.connect(this.comp);
    this.comp.connect(this.limiter);
    this.limiter.connect(this.master);
    this.master.connect(this.ctx.destination);

    // Real-Time FFT & Sub-Bass Peak Analysers (live contexts only)
    this.subTapBus = this.ctx.createGain();
    this.subTapBus.gain.value = 1.0;
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

    // 2.5s Warm Stereo Gated Hall Reverb (LP 3.0kHz -> never harsh static!) -> pumpBus
    this.reverbIn = this.ctx.createGain();
    this.reverbIn.gain.value = 0.34;
    const conv = this.ctx.createConvolver();
    conv.buffer = makeGatedHallIR(this.ctx, 2.5);
    const revHp = this.ctx.createBiquadFilter();
    revHp.type = 'highpass';
    revHp.frequency.value = 210;
    const revLp = this.ctx.createBiquadFilter();
    revLp.type = 'lowpass';
    revLp.frequency.value = 3000;
    this.reverbIn.connect(conv);
    conv.connect(revHp);
    revHp.connect(revLp);
    revLp.connect(this.pumpBus);

    // Stereo Ping-Pong Dotted-8th Delay Bus
    const dTime = (60 / this.track.bpm) * 0.75;
    this.delayIn = this.ctx.createGain();
    this.delayIn.gain.value = 0.28;
    this.delayL = this.ctx.createDelay(1.5);
    this.delayR = this.ctx.createDelay(1.5);
    this.delayL.delayTime.value = dTime;
    this.delayR.delayTime.value = dTime * 0.5;

    const dLp = this.ctx.createBiquadFilter();
    dLp.type = 'lowpass';
    dLp.frequency.value = 2400;
    const dHp = this.ctx.createBiquadFilter();
    dHp.type = 'highpass';
    dHp.frequency.value = 250;
    const dFb = this.ctx.createGain();
    dFb.gain.value = 0.36;

    const panL = this.ctx.createStereoPanner();
    const panR = this.ctx.createStereoPanner();
    panL.pan.value = -0.68;
    panR.pan.value = 0.68;

    this.delayIn.connect(this.delayL);
    this.delayL.connect(panL);
    this.delayL.connect(this.delayR);
    this.delayR.connect(panR);
    this.delayR.connect(dLp);
    dLp.connect(dHp);
    dHp.connect(dFb);
    dFb.connect(this.delayL);
    panL.connect(this.mixBus);
    panR.connect(this.mixBus);

    // Track 2 Heavy Darksynth Hard-Clipping Distortion Pedal Bus -> pumpBus
    this.darkDistBus = this.ctx.createBiquadFilter();
    this.darkDistBus.type = 'lowpass';
    this.darkDistBus.frequency.value = 2100;
    const hardClip = this.ctx.createWaveShaper();
    hardClip.curve = makeHardClipCurve(9.5);
    hardClip.oversample = '2x';
    const dCabLp = this.ctx.createBiquadFilter();
    dCabLp.type = 'lowpass';
    dCabLp.frequency.value = 2450;
    dCabLp.Q.value = 0.75;
    const dOut = this.ctx.createGain();
    dOut.gain.value = 0.42;
    this.darkDistBus.connect(hardClip);
    hardClip.connect(dCabLp);
    dCabLp.connect(dOut);
    dOut.connect(this.pumpBus);

    // Track 4 TB-303 Warm Analog Overdrive Bus (tames Q=12..18 peaks into syrupy squelch!)
    this.acidSatBus = this.ctx.createWaveShaper();
    this.acidSatBus.curve = makeTubeCurve(2.6);
    this.acidSatBus.oversample = '2x';
    const aLp = this.ctx.createBiquadFilter();
    aLp.type = 'lowpass';
    aLp.frequency.value = 5400;
    const aOut = this.ctx.createGain();
    aOut.gain.value = 0.76;
    this.acidSatBus.connect(aLp);
    aLp.connect(aOut);
    aOut.connect(this.pumpBus);
    aOut.connect(this.delayIn);

    // Custom 25% duty-cycle pulse wave (Tracker bass & vocoder carriers!)
    this.pulse25Wave = makePulseWave(this.ctx, 0.25, 28);

    // Deterministic white noise & 10x decimated lo-fi crushed noise buffers
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    this.crushNoiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const nData = this.noiseBuf.getChannelData(0);
    const cData = this.crushNoiseBuf.getChannelData(0);
    const rnd = makePrng(9001);
    let held = 0;
    for (let i = 0; i < len; i++) {
      const v = rnd();
      nData[i] = v;
      if (i % 10 === 0) held = Math.round(v * 4) / 4; // low-bitrate decimated burst!
      cData[i] = held;
    }
  }

  _applyTrackBusParams(t) {
    if (this.delayL && this.delayR) {
      const dTime = (60 / this.track.bpm) * 0.75; // dotted-8th
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

  start(trackIdx = this.trackIndex) {
    this._ensureContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.trackIndex = trackIdx;
    this.playing = true;
    this._offline = false;
    this.step = 0;
    this._lyricIndex = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.startTime = this.nextStepTime;
    this.telemetry.bpm = this.track.bpm;
    this.telemetry.mode = this.track.mode;
    this.telemetry.rasterMode = this.track.mode === 'tracker' ? 1.0 : 0.0;
    this._applyTrackBusParams(this.ctx.currentTime);

    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => this._scheduler(), 22);
  }

  stop() {
    this.playing = false;
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
    const lookahead = 0.12;
    const stepDur = 60 / this.track.bpm / 4;
    while (this.nextStepTime < this.ctx.currentTime + lookahead) {
      this._scheduleStep(this.step, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.step++;
    }
  }

  _triggerSidechain(t, stepDur, depth, beats = 0.45) {
    const g = this.pumpBus.gain;
    const recDur = Math.min(stepDur * 4 * beats, stepDur * 3.6);
    g.setValueAtTime(1.0, t);
    g.linearRampToValueAtTime(depth, t + 0.010);
    g.exponentialRampToValueAtTime(1.0, t + Math.max(0.06, recDur));
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
    const nextVowel = tr.vowels[(chordIdx + 1) % tr.vowels.length];

    this._sectionName = sec.name;
    this._sectionEnergy = sec.energy;
    this._sectionRoll = sec.roll;
    this._sectionDrop = sec.drop;

    if (s16 % 4 === 0) this._lastBeatTime = t;

    // Track 3 Visual Sync Hook: onStep(bar, note) fired cleanly in sync with audio!
    if (!this._offline) {
      const delayMs = Math.max(0, (t - this.ctx.currentTime) * 1000);
      const stepNote = chord.a[s16 % 4];
      setTimeout(() => {
        if (!this.playing) return;
        this.telemetry.stepTick++;
        this.telemetry.stepBar = bar;
        this.telemetry.stepNote = stepNote;
        if (this.onStep) this.onStep(bar, stepNote, s16);
      }, delayMs);
    }

    if (sec.roll && barInSec === 0 && s16 === 0) {
      this._playRiser(t, stepDur * 16 * sec.bars * 0.90);
    }

    if (sec.drop && barInSec === 0 && s16 === 0) {
      this._playCrash(t, 0.28);
      this._playSubDrop(t, 0.34);
      this._lastDropTime = t;
      if (!this._offline) {
        const delayMs = Math.max(0, (t - this.ctx.currentTime) * 1000);
        setTimeout(() => { if (this.playing) this.telemetry.dropId++; }, delayMs);
      }
    }

    if (!this._offline && s16 % 8 === 0 && tr.lyrics.length > 0) {
      const word = tr.lyrics[this._lyricIndex % tr.lyrics.length];
      this._lyricIndex++;
      const delayMs = Math.max(0, (t - this.ctx.currentTime) * 1000);
      setTimeout(() => {
        if (!this.playing) return;
        this.telemetry.lyric = word;
        this.telemetry.lyricId++;
        if (this.onLyric) this.onLyric(word, sec.energy);
      }, delayMs);
    }

    // Per-bar Pads (Track 5 uses true 7-detuned-saw pad with slow 0.2Hz LFO!)
    if (s16 === 0 && sec.pad > 0) {
      const padRoot = mode === 'acid' ? tr.root + 24 : tr.root + 12;
      const freqs = chord.p.map(n => midiToFreq(padRoot + n));
      if (mode === 'retrowave') {
        this._playSevenSawPad(t, stepDur * 16.8, freqs, sec.pad * 0.048, sec.filter);
      } else {
        this._playStereoPad(t, stepDur * 16.6, freqs, sec.pad * 0.056, 540 + sec.filter * 880);
      }
    }

    // Track 5 lush airy choir bed on breakdown / drop
    if (mode === 'retrowave' && s16 === 0 && (sec.drop || sec.energy < 0.25)) {
      const f1 = midiToFreq(tr.root + 12 + chord.p[chord.p.length - 1]);
      const f2 = midiToFreq(tr.root + 12 + chord.p[1]);
      this._playAirySineVocal(t, stepDur * 16.2, f1, 0.14, vowel, nextVowel, 0, false);
      this._playAirySineVocal(t, stepDur * 16.2, f2, 0.10, vowel, nextVowel, 0, false);
    }

    // Descending transition fills on beat 4 of section end bars
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
      // Heavy 1/4-note pump on Retrowave (beats=0.88), -6dB every beat on Darksynth (0.50)
      const pumpLen = mode === 'retrowave' ? 0.88 : (mode === 'darksynth' ? 0.62 : 0.45);
      this._triggerSidechain(t, stepDur, tr.patch.pump || 0.45, pumpLen);
      this._lastKickTime = t;
      if (!this._offline) {
        const delayMs = Math.max(0, (t - this.ctx.currentTime) * 1000);
        setTimeout(() => { if (this.playing) this.telemetry.kickId++; }, delayMs);
      }
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

    // --- MODE-SPECIFIC BASS & ACID ENGINES ---
    if (mode === 'acid') {
      if (sec.acid > 0) {
        const pat = tr.acidPats[patIdx];
        const cell = pat[s16];
        if (cell) {
          const [semi, acc, slide] = cell;
          // Dynamic 200Hz -> 6kHz sweep across phrase & section energy!
          const sweepLfo = 0.5 + 0.5 * Math.sin(step * 0.055);
          const normCut = Math.min(1, Math.max(0, 0.10 + sec.filter * 0.58 + sweepLfo * 0.28 + (sec.roll ? progress * 0.25 : 0)));
          this._lastAcidCutoffNorm = normCut;
          const freq = midiToFreq(chord.b + semi);
          this._playAcid303(t, stepDur * (slide ? 1.18 : 0.86), freq, sec.acid, normCut, acc, slide, sec.drop);
          if (acc) {
            this._lastAccentTime = t;
            if (!this._offline) {
              const delayMs = Math.max(0, (t - this.ctx.currentTime) * 1000);
              setTimeout(() => { if (this.playing) this.telemetry.accentCount++; }, delayMs);
            }
            // Staccato pitch-shifted formant vocal chop triggered on acid accents!
            if (sec.chop > 0 && s16 % 4 === 0) {
              const chopFreq = midiToFreq(tr.root + 24 + semi);
              this._playAcidVocalChop(t, stepDur * 1.35, chopFreq, sec.chop * 0.30, vowel);
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
          this._playBreakBass(t, stepDur * 1.15, freq, bassGain * 1.22, sec.filter, tr.bpm);
        } else if (mode === 'darksynth') {
          const subFreq = midiToFreq(chord.b); // exact 40-80Hz sub-sine!
          const midFreq = midiToFreq(chord.b + 12 + off); // distorted saw 1 oct up!
          this._playDarkBass(t, stepDur * 0.92, subFreq, midFreq, bassGain, sec.filter);
        } else if (mode === 'tracker') {
          const freq = midiToFreq(chord.b + off);
          this._playChipBass(t, stepDur * 0.85, freq, bassGain * 1.28);
        } else if (mode === 'retrowave') {
          const subFreq = midiToFreq(chord.b + (code === 2 ? 7 : 0)); // ~45Hz sub-sine!
          this._playSubSine45(t, stepDur * 3.85, subFreq, bassGain * 0.92);
        }
      }
    }

    // --- MODE-SPECIFIC ARPS ---
    if (sec.arp > 0 && tr.arpPats) {
      const arpPat = tr.arpPats[patIdx];
      const idx = arpPat[s16];
      if (idx >= 0) {
        const arpBase = mode === 'acid' ? tr.root + 24 : tr.root + 12;
        if (mode === 'tracker') {
          // Fast 32nd-note YM2612 FM arpeggio (2 notes per 16th step, FM index = 4.0!)
          const idx2 = arpPat[(s16 + 1) % 16];
          const sA = chord.a[idx % 4] + (idx >= 4 ? 12 : 0);
          const sB = chord.a[(idx2 >= 0 ? idx2 : idx) % 4] + (idx2 >= 4 ? 12 : 0);
          this._playYm2612Arp(t, stepDur * 0.48, midiToFreq(arpBase + sA), sec.arp * 0.118, -0.35);
          this._playYm2612Arp(t + stepDur * 0.5, stepDur * 0.48, midiToFreq(arpBase + sB), sec.arp * 0.112, 0.35);
        } else if (mode === 'breakbeat') {
          const semi = chord.a[idx % 4] + (idx >= 4 ? 12 : 0);
          const freq = midiToFreq(arpBase + semi);
          this._playDualSawArp(t, stepDur * 0.90, freq, sec.arp * 0.082, 1100 + sec.filter * 1900, s16 % 2 ? 0.35 : -0.35);
        } else {
          const semi = chord.a[idx % 4] + (idx >= 4 ? 12 : 0);
          const freq = midiToFreq(arpBase + semi);
          const cut = 950 + sec.filter * 1750;
          this._playWarmArp(t, stepDur * 0.90, freq, sec.arp * 0.095, cut, s16 % 2 ? 0.32 : -0.32, mode === 'retrowave');
        }
      }
    }

    // --- TRACK 2 STACCATO DISTORTED SQUARE BRASS STABS (+ PITCH DROP) ---
    if (mode === 'darksynth' && sec.stab > 0 && tr.stabPat && tr.stabPat[s16]) {
      const freqs = chord.p.map(n => midiToFreq(tr.root + 12 + n));
      this._playDarkBrassStab(t, stepDur * 1.45, freqs, sec.stab * 0.145);
      this._lastStabTime = t;
      if (!this._offline) {
        const delayMs = Math.max(0, (t - this.ctx.currentTime) * 1000);
        setTimeout(() => { if (this.playing) this.telemetry.stabTriggers++; }, delayMs);
      }
    }

    // --- TRACK 1 & 2 ROBOTIC VOCAL STABS ---
    if (sec.vStab > 0 && tr.vStabPat && tr.vStabPat[s16]) {
      if (mode === 'breakbeat') {
        const f = midiToFreq(tr.root + 12 + chord.a[0]);
        this._playCyberVocoderStab(t, stepDur * 1.9, f, sec.vStab * 0.35);
      } else if (mode === 'darksynth') {
        const f = midiToFreq(tr.root + 12 + chord.p[0]);
        this._playRingModVocal(t, stepDur * 1.6, f, sec.vStab * 0.28);
      }
    }

    // --- 8-BAR COMPOSED MELODIES & CLIMAX SOLOS ---
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
          this._playModeLead(mode, t, dur, freq, slide, vowel, nextVowel, sec.filter, sec.drop);

          // Update leadFrequency visual sync hook (Track 1)
          if (!this._offline) {
            const delayMs = Math.max(0, (t - this.ctx.currentTime) * 1000);
            setTimeout(() => {
              if (!this.playing) return;
              this.telemetry.leadFrequency = freq;
              this.telemetry.leadFreqNorm = Math.max(0, Math.min(1, (midi - 52) / 30));
            }, delayMs);
          }
          break;
        }
      }
    }
  }

  // =========================================================================
  // DRUM ENGINES (808 Breakbeat, Industrial, 16-bit PCM, 909, 707)
  // =========================================================================

  _playModeKick(mode, t, gain) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    if (mode === 'breakbeat') {
      // 808 Sub-Kick gliding 150Hz -> 45Hz
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.062);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.24);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.95 * gain, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    } else if (mode === 'darksynth') {
      // Heavy Industrial Short-Decay Kick
      osc.type = 'sine';
      osc.frequency.setValueAtTime(175, t);
      osc.frequency.exponentialRampToValueAtTime(44, t + 0.042);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.98 * gain, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.165);
    } else if (mode === 'tracker') {
      // Short 8/16-bit Square-Wave Click Kick (dry & punchy!)
      osc.type = 'square';
      osc.frequency.setValueAtTime(215, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.032);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1100, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.76 * gain, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.105);
      osc.connect(lp); lp.connect(g);
      g.connect(this.dryBus); g.connect(this.subTapBus);
      osc.start(t); osc.stop(t + 0.11);
      return;
    } else if (mode === 'acid') {
      // Driving 909 Techno Kick
      osc.type = 'sine';
      osc.frequency.setValueAtTime(165, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.048);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.96 * gain, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
    } else {
      // Soft 707-style Electronic Kick (Anti-Grav Drift)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(128, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.052);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.84 * gain, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.21);
    }

    osc.connect(g);
    g.connect(this.dryBus);
    g.connect(this.subTapBus);
    osc.start(t);
    osc.stop(t + 0.26);

    // Subtle crisp beater click (except soft 707)
    if (mode !== 'retrowave') {
      const clk = this.ctx.createOscillator();
      const cg = this.ctx.createGain();
      clk.type = 'triangle';
      clk.frequency.setValueAtTime(mode === 'darksynth' ? 320 : 250, t);
      clk.frequency.exponentialRampToValueAtTime(65, t + 0.014);
      cg.gain.setValueAtTime(0.24 * gain, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
      clk.connect(cg); cg.connect(this.dryBus);
      clk.start(t); clk.stop(t + 0.02);
    }
  }

  _playModeSnare(mode, t, gain, val = 1) {
    // Track 5 rimshot (val === 2)
    if (mode === 'retrowave' && val === 2) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(460, t);
      o.frequency.exponentialRampToValueAtTime(290, t + 0.022);
      g.gain.setValueAtTime(0.24 * gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
      o.connect(g); g.connect(this.dryBus); g.connect(this.reverbIn);
      o.start(t); o.stop(t + 0.036);
      return;
    }

    // Track 4 909 handclap (val 1 = beat 2/4, val 2 = accent off-beat clap)
    if (mode === 'acid') {
      const cGain = (val === 2 ? 0.34 : 0.42) * gain;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1450, t);
      bp.Q.value = 1.1;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(4800, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      // Classic 909 triple-burst clap envelope!
      g.gain.linearRampToValueAtTime(cGain, t + 0.002);
      g.gain.linearRampToValueAtTime(cGain * 0.15, t + 0.010);
      g.gain.linearRampToValueAtTime(cGain * 0.92, t + 0.013);
      g.gain.linearRampToValueAtTime(cGain * 0.18, t + 0.021);
      g.gain.linearRampToValueAtTime(cGain, t + 0.024);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      src.connect(bp); bp.connect(lp); lp.connect(g);
      g.connect(this.dryBus); g.connect(this.reverbIn);
      src.start(t); src.stop(t + 0.16);
      return;
    }

    const isGhost = val === 2;
    const gScale = isGhost ? 0.38 : 1.0;

    // Noise burst snare (crushed PCM noise for Track 3 tracker!)
    const src = this.ctx.createBufferSource();
    src.buffer = mode === 'tracker' ? this.crushNoiseBuf : this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(mode === 'breakbeat' ? 1850 : (mode === 'tracker' ? 2100 : 1420), t);
    bp.Q.value = mode === 'breakbeat' ? 0.85 : 0.65;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(mode === 'retrowave' ? 4500 : 5200, t);

    const g = this.ctx.createGain();
    const dur = mode === 'retrowave' ? 0.22 : (mode === 'breakbeat' || mode === 'tracker' ? 0.12 : 0.16);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.42 * gain * gScale, t + 0.003);
    if (mode === 'retrowave') {
      g.gain.linearRampToValueAtTime(0.30 * gain * gScale, t + 0.14);
    }
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(bp); bp.connect(lp); lp.connect(g);
    g.connect(this.dryBus);
    if (mode !== 'tracker') g.connect(this.reverbIn);
    src.start(t); src.stop(t + dur + 0.02);

    // Snare tonal body
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(mode === 'breakbeat' ? 225 : 196, t);
    osc.frequency.exponentialRampToValueAtTime(118, t + 0.065);
    og.gain.setValueAtTime(0.32 * gain * gScale, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
    osc.connect(og); og.connect(this.dryBus);
    osc.start(t); osc.stop(t + 0.09);
  }

  _playModeHat(mode, t, secHat, hVal) {
    const src = this.ctx.createBufferSource();
    src.buffer = mode === 'tracker' ? this.crushNoiseBuf : this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    const isOpen = hVal === 2;
    const isGhost = hVal === 3;
    bp.frequency.setValueAtTime(mode === 'acid' && isOpen ? 6900 : 8200, t);
    bp.Q.value = mode === 'acid' && isOpen ? 0.9 : 1.2;

    const baseG = isOpen ? (mode === 'acid' ? 0.145 : 0.095) : (isGhost ? 0.032 : 0.062);
    const dur = isOpen ? (mode === 'acid' ? 0.145 : 0.092) : 0.024;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(baseG * secHat, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(bp); bp.connect(g); g.connect(this.dryBus);
    src.start(t); src.stop(t + dur + 0.01);
  }

  _playTom(t, startFreq, gain, dry = false) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = dry ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.46, t + 0.18);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain * (dry ? 0.55 : 1.0), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    osc.connect(g); g.connect(this.dryBus);
    if (!dry) g.connect(this.reverbIn);
    osc.start(t); osc.stop(t + 0.21);
  }

  _playSubDrop(t, gain) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(84, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.72);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.78);
    osc.connect(g); g.connect(this.dryBus); g.connect(this.subTapBus);
    osc.start(t); osc.stop(t + 0.80);
  }

  _playRiser(t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.4;
    bp.frequency.setValueAtTime(280, t);
    bp.frequency.exponentialRampToValueAtTime(3600, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.003, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.92);
    g.gain.linearRampToValueAtTime(0.001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.reverbIn);
    src.start(t); src.stop(t + dur + 0.02);
  }

  _playCrash(t, gain) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(4800, t);
    bp.Q.value = 0.65;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.25);
    src.connect(bp); bp.connect(g); g.connect(this.dryBus); g.connect(this.reverbIn);
    src.start(t); src.stop(t + 1.30);
  }

  // =========================================================================
  // TRACK 01 (ZERO FRICTION): 24dB/oct 1/8t-LFO Saw Bass, ±12c Dual Saw Arp,
  //                           Pulse Formant Vocoder Stabs (500/1200/2800Hz)
  // =========================================================================

  _playBreakBass(t, dur, freq, gain, filterAmt, bpm) {
    // Monophonic sawtooth + warm sub through CASCADED 24dB/oct LPF (180Hz -> 2.5kHz) + 1/8t LFO!
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(freq * 0.5, t);
    const subG = this.ctx.createGain();
    subG.gain.value = 0.55;

    // Two cascaded 12dB/oct LPFs = steep 24dB/oct analog filter!
    const f1 = this.ctx.createBiquadFilter();
    const f2 = this.ctx.createBiquadFilter();
    const peakCut = 900 + filterAmt * 1600; // up to 2.5kHz
    for (const f of [f1, f2]) {
      f.type = 'lowpass';
      f.Q.value = 2.0;
      f.frequency.setValueAtTime(180, t);
      f.frequency.exponentialRampToValueAtTime(peakCut, t + 0.014);
      f.frequency.exponentialRampToValueAtTime(240, t + dur);
    }

    // 1/8t synced LFO modulating the 24dB/oct cutoff for kinetic breakbeat drive!
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.setValueAtTime((bpm / 60) * 3.0, t); // exact 1/8t triplet rate!
    lfoG.gain.setValueAtTime(340 * filterAmt, t);
    lfo.connect(lfoG);
    lfoG.connect(f1.frequency);
    lfoG.connect(f2.frequency);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(f1); sub.connect(subG); subG.connect(f1);
    f1.connect(f2); f2.connect(g);
    g.connect(this.pumpBus); g.connect(this.subTapBus);

    lfo.start(t); osc.start(t); sub.start(t);
    lfo.stop(t + dur + 0.02); osc.stop(t + dur + 0.02); sub.stop(t + dur + 0.02);
  }

  _playDualSawArp(t, dur, freq, gain, cutoff, panVal) {
    // Dual detuned saw oscillators (+/- 12 cents) with stereo chorus & ping-pong delay!
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth';
    o1.frequency.setValueAtTime(freq, t);
    o2.frequency.setValueAtTime(freq, t);
    o1.detune.setValueAtTime(-12, t);
    o2.detune.setValueAtTime(12, t);

    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.Q.value = 1.6;
    const top = Math.min(2800, cutoff);
    flt.frequency.setValueAtTime(top, t);
    flt.frequency.exponentialRampToValueAtTime(360, t + Math.min(dur, 0.09));

    const pan = this.ctx.createStereoPanner();
    pan.pan.value = panVal;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(pan);
    pan.connect(this.mixBus); pan.connect(this.delayIn); pan.connect(this.reverbIn);
    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
  }

  _playCyberVocoderStab(t, dur, freq, gain) {
    // Pulse-wave carrier into 3 formant bandpasses at 500Hz, 1.2kHz, 2.8kHz!
    const osc = this.ctx.createOscillator();
    osc.setPeriodicWave(this.pulse25Wave);
    osc.frequency.setValueAtTime(freq, t);

    const outG = this.ctx.createGain();
    outG.gain.setValueAtTime(0.001, t);
    outG.gain.linearRampToValueAtTime(gain, t + 0.012);
    outG.gain.exponentialRampToValueAtTime(0.001, t + dur);

    const formants = [500, 1200, 2800];
    const weights = [0.78, 0.58, 0.28];
    for (let i = 0; i < 3; i++) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(formants[i], t);
      bp.Q.value = 4.6;
      const wg = this.ctx.createGain();
      wg.gain.value = weights[i];
      osc.connect(bp); bp.connect(wg); wg.connect(outG);
    }

    outG.connect(this.mixBus); outG.connect(this.delayIn); outG.connect(this.reverbIn);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  // =========================================================================
  // TRACK 02 (OVERDRIVE): Hard-Clipped Saw + 40-80Hz Sub-Sine, Distorted
  //                       Pitch-Drop Square Stabs, Ring-Modulated Vocals
  // =========================================================================

  _playDarkBass(t, dur, subFreq, midFreq, gain, filterAmt) {
    // 1. Clean 40-80Hz sub-sine foundation (drives subBassPunch peak meter!)
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(subFreq, t);
    const subG = this.ctx.createGain();
    subG.gain.setValueAtTime(0.001, t);
    subG.gain.linearRampToValueAtTime(gain * 0.92, t + 0.005);
    subG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    sub.connect(subG);
    subG.connect(this.pumpBus);
    subG.connect(this.subTapBus);
    sub.start(t); sub.stop(t + dur + 0.02);

    // 2. Aggressive hard-clipping distorted sawtooth mid-bass!
    const saw = this.ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(midFreq, t);
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.Q.value = 2.4;
    flt.frequency.setValueAtTime(600 + filterAmt * 1300, t);
    flt.frequency.exponentialRampToValueAtTime(260, t + dur);
    const mG = this.ctx.createGain();
    mG.gain.setValueAtTime(0.001, t);
    mG.gain.linearRampToValueAtTime(gain * 0.78, t + 0.004);
    mG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    saw.connect(flt); flt.connect(mG); mG.connect(this.darkDistBus);
    saw.start(t); saw.stop(t + dur + 0.02);
  }

  _playDarkBrassStab(t, dur, freqs, gain) {
    // Staccato detuned square waves through distortion pedal + pitch-bend drop envelope!
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.010);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(this.darkDistBus);
    g.connect(this.reverbIn);

    for (const f of freqs) {
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      o1.type = 'square'; o2.type = 'square';
      // Aggressive pitch-bend drop envelope!
      o1.frequency.setValueAtTime(f * 1.07, t);
      o1.frequency.exponentialRampToValueAtTime(f, t + 0.045);
      o1.frequency.exponentialRampToValueAtTime(f * 0.94, t + dur);
      o2.frequency.setValueAtTime(f * 1.07, t);
      o2.frequency.exponentialRampToValueAtTime(f, t + 0.045);
      o2.frequency.exponentialRampToValueAtTime(f * 0.94, t + dur);
      o1.detune.setValueAtTime(-10, t);
      o2.detune.setValueAtTime(10, t);
      o1.connect(g); o2.connect(g);
      o1.start(t); o2.start(t);
      o1.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
    }
  }

  _playRingModVocal(t, dur, freq, gain) {
    // Ring-modulated pulse wave carrier MULTIPLIED by low-bitrate crushed noise burst!
    const car = this.ctx.createOscillator();
    car.setPeriodicWave(this.pulse25Wave);
    car.frequency.setValueAtTime(freq, t);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.crushNoiseBuf;

    // Ring modulation via GainNode whose gain is modulated by crushed noise!
    const ring = this.ctx.createGain();
    ring.gain.setValueAtTime(0.0, t);
    const modDepth = this.ctx.createGain();
    modDepth.gain.value = 1.0;
    noise.connect(modDepth);
    modDepth.connect(ring.gain);

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1150, t);
    bp.Q.value = 2.0;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    car.connect(ring); ring.connect(bp); bp.connect(env);
    env.connect(this.mixBus); env.connect(this.reverbIn);
    car.start(t); noise.start(t);
    car.stop(t + dur + 0.02); noise.stop(t + dur + 0.02);
  }

  // =========================================================================
  // TRACK 03 (TRACKER PROTOCOL): YM2612 32nd FM Arp (index 4.0), Dry 25%
  //                              Pulse Bass, Formant-Filtered Square Chip Lead
  // =========================================================================

  _playYm2612Arp(t, dur, freq, gain, panVal) {
    // Authentic YM2612 32nd-note FM arpeggio: square carrier + sine modulator, FM index 4.0!
    const car = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modG = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    const pan = this.ctx.createStereoPanner();
    const outG = this.ctx.createGain();

    car.type = 'square';
    mod.type = 'sine';
    car.frequency.setValueAtTime(freq, t);
    mod.frequency.setValueAtTime(freq * 2.0, t);
    // Exact FM index 4.0 on attack decaying swiftly for metallic Genesis glass sparkle!
    modG.gain.setValueAtTime(freq * 4.0, t);
    modG.gain.exponentialRampToValueAtTime(Math.max(10, freq * 0.4), t + dur);

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4800, t);
    pan.pan.value = panVal;

    outG.gain.setValueAtTime(0.001, t);
    outG.gain.linearRampToValueAtTime(gain, t + 0.002);
    outG.gain.exponentialRampToValueAtTime(0.001, t + dur);

    mod.connect(modG); modG.connect(car.frequency);
    car.connect(lp); lp.connect(outG); outG.connect(pan);
    pan.connect(this.dryBus); pan.connect(this.delayIn);
    car.start(t); mod.start(t);
    car.stop(t + dur + 0.01); mod.stop(t + dur + 0.01);
  }

  _playChipBass(t, dur, freq, gain) {
    // Punchy 8-bit 25%-duty pulse wave bass with ZERO REVERB for crisp tracker definition!
    const osc = this.ctx.createOscillator();
    osc.setPeriodicWave(this.pulse25Wave);
    osc.frequency.setValueAtTime(freq, t);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1650, t);
    lp.frequency.exponentialRampToValueAtTime(420, t + dur);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(lp); lp.connect(g);
    g.connect(this.dryBus); // ZERO reverb!
    g.connect(this.subTapBus);
    osc.start(t); osc.stop(t + dur + 0.01);
  }

  _playChipVocalLead(t, dur, freq, gain, vowelA, vowelB) {
    // Formant-filtered square wave playing melodious robotic 8-bit chip melodies!
    const fA = VOWEL_FORMANTS[vowelA] || VOWEL_FORMANTS.EE;
    const fB = VOWEL_FORMANTS[vowelB] || VOWEL_FORMANTS.AH;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t);

    // Classic fast 8-bit tracker vibrato (7.2 Hz)
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.setValueAtTime(7.2, t);
    lfoG.gain.setValueAtTime(0, t);
    lfoG.gain.linearRampToValueAtTime(freq * 0.009, t + 0.14);
    lfo.connect(lfoG); lfoG.connect(osc.frequency);

    const preLp = this.ctx.createBiquadFilter();
    preLp.type = 'lowpass';
    preLp.frequency.setValueAtTime(3600, t);
    osc.connect(preLp);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.008);
    env.gain.linearRampToValueAtTime(gain * 0.85, t + dur * 0.78);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    // Blend crisp formant-filtered robotic voice + clean 8-bit square definition
    const drySq = this.ctx.createGain();
    drySq.gain.value = 0.24;
    preLp.connect(drySq); drySq.connect(env);

    const weights = [0.68, 0.56, 0.28];
    for (let i = 0; i < 3; i++) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 3.8;
      bp.frequency.setValueAtTime(fA[i], t);
      bp.frequency.exponentialRampToValueAtTime(fB[i], t + dur * 0.85);
      const wg = this.ctx.createGain();
      wg.gain.value = weights[i];
      preLp.connect(bp); bp.connect(wg); wg.connect(env);
    }

    env.connect(this.dryBus); env.connect(this.delayIn);
    lfo.start(t); osc.start(t);
    lfo.stop(t + dur + 0.02); osc.stop(t + dur + 0.02);
  }

  // =========================================================================
  // TRACK 04 (VECTOR MATRIX): Resonant TB-303 Acid (Q 12-18, 200Hz-6kHz,
  //                           Accents & Slides) + Pitch-Shifted Vocal Chops
  // =========================================================================

  _playAcid303(t, dur, freq, secGain, normCut, accent, slide, isDrop) {
    const osc = this.ctx.createOscillator();
    osc.type = isDrop ? 'square' : 'sawtooth';

    // Authentic TB-303 slide/portamento glide between notes!
    const startF = (slide && Math.abs(freq - this._lastAcidFreq) < freq * 2.2)
      ? this._lastAcidFreq : freq;
    this._lastAcidFreq = freq;
    osc.frequency.setValueAtTime(startF, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq, t + 0.048);

    // High-resonance TB-303 LP filter (Q: 12 normal, 16 on accent!), 200Hz -> 6kHz sweep!
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.Q.setValueAtTime(accent ? 15.5 : 12.2, t);
    const baseCut = 200 + normCut * 2600;
    const envPeak = Math.min(6000, baseCut + (accent ? 3200 : 1400));
    flt.frequency.setValueAtTime(envPeak, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(200, baseCut * 0.55), t + (accent ? 0.14 : 0.11));

    // Compensate resonance peak gain cleanly so it squelches hard with ZERO clipping!
    const g = this.ctx.createGain();
    const amp = secGain * (accent ? 0.34 : 0.24);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(flt); flt.connect(g);
    g.connect(this.acidSatBus);
    g.connect(this.subTapBus);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  _playAcidVocalChop(t, dur, freq, gain, vowel) {
    // Staccato pitch-shifted formant vocal chop triggered on acid accents!
    const fV = VOWEL_FORMANTS[vowel] || VOWEL_FORMANTS.AH;
    const osc = this.ctx.createOscillator();
    osc.setPeriodicWave(this.pulse25Wave);
    osc.frequency.setValueAtTime(freq * 1.12, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.03);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    // Pitch-shifted formants (+22% formant shift for robotic cyber chop character!)
    const weights = [0.72, 0.56, 0.25];
    for (let i = 0; i < 3; i++) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 4.5;
      bp.frequency.setValueAtTime(Math.min(3600, fV[i] * 1.22), t);
      const wg = this.ctx.createGain();
      wg.gain.value = weights[i];
      osc.connect(bp); bp.connect(wg); wg.connect(env);
    }

    env.connect(this.mixBus); env.connect(this.delayIn); env.connect(this.reverbIn);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  // =========================================================================
  // TRACK 05 (ANTI-GRAV DRIFT): Deep ~45Hz Sub-Sine, 7-Detuned-Saw 0.2Hz-LFO
  //                             Pad, Airy Sine-Carrier Formant Vocoded Lead
  // =========================================================================

  _playSubSine45(t, dur, freq, gain) {
    // Deep ~45Hz sub-sine foundation with heavy 1/4-note pump via pumpBus!
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    const warm = this.ctx.createOscillator();
    warm.type = 'triangle';
    warm.frequency.setValueAtTime(freq * 2.0, t);
    const wG = this.ctx.createGain();
    wG.gain.value = 0.14;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.015);
    g.gain.linearRampToValueAtTime(gain * 0.88, t + dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(g); warm.connect(wG); wG.connect(g);
    g.connect(this.pumpBus);
    g.connect(this.subTapBus);
    osc.start(t); warm.start(t);
    osc.stop(t + dur + 0.03); warm.stop(t + dur + 0.03);
  }

  _playSevenSawPad(t, dur, freqs, gain, filterAmt) {
    // Warm, wide analog pad: 7 detuned saw waves routed through a slow 0.2Hz LFO filter sweep & 2.5s gated reverb!
    const detunes = [-18, -11, -5, 0, 5, 11, 18];
    const pans    = [-0.82, -0.56, -0.28, 0.0, 0.28, 0.56, 0.82];

    const fltL = this.ctx.createBiquadFilter();
    const fltR = this.ctx.createBiquadFilter();
    const baseCut = 640 + filterAmt * 840;
    for (const flt of [fltL, fltR]) {
      flt.type = 'lowpass';
      flt.Q.value = 0.9;
      flt.frequency.setValueAtTime(baseCut, t);
    }

    // Slow 0.2 Hz LFO sweeping the 7-saw pad filter organically!
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.setValueAtTime(0.2, t);
    lfoG.gain.setValueAtTime(340, t);
    lfo.connect(lfoG);
    lfoG.connect(fltL.frequency);
    lfoG.connect(fltR.frequency);

    const gL = this.ctx.createGain();
    const gR = this.ctx.createGain();
    const pL = this.ctx.createStereoPanner();
    const pR = this.ctx.createStereoPanner();
    pL.pan.value = -0.82; pR.pan.value = 0.82;

    for (const g of [gL, gR]) {
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(gain, t + Math.min(0.45, dur * 0.25));
      g.gain.linearRampToValueAtTime(gain * 0.86, t + dur * 0.78);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    }

    fltL.connect(gL); gL.connect(pL); pL.connect(this.pumpBus); pL.connect(this.reverbIn);
    fltR.connect(gR); gR.connect(pR); pR.connect(this.pumpBus); pR.connect(this.reverbIn);

    // 7 detuned sawtooth oscillators per bar distributed across the chord tones!
    for (let i = 0; i < 7; i++) {
      const f = freqs[i % freqs.length];
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.detune.setValueAtTime(detunes[i], t);
      o.connect(pans[i] <= 0 ? fltL : fltR);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }

  _playAirySineVocal(t, dur, freq, gain, vowelA, vowelB, slide, isLead) {
    // Soft, airy vocoded synth lead using sine-carrier (+ soft breath air) formant filter & 1/8d stereo delay!
    const fA = VOWEL_FORMANTS[vowelA] || VOWEL_FORMANTS.OO;
    const fB = VOWEL_FORMANTS[vowelB] || VOWEL_FORMANTS.AH;

    const car = this.ctx.createOscillator();
    const harm = this.ctx.createOscillator();
    car.type = 'sine';
    harm.type = 'triangle';

    const startF = (isLead && slide > 0 && Math.abs(freq - this._lastVocalFreq) < freq * 0.5)
      ? this._lastVocalFreq : freq;
    if (isLead) this._lastVocalFreq = freq;
    const glideT = isLead && slide > 0 ? 0.075 : 0.012;

    car.frequency.setValueAtTime(startF, t);
    car.frequency.exponentialRampToValueAtTime(freq, t + glideT);
    harm.frequency.setValueAtTime(startF * 2.0, t);
    harm.frequency.exponentialRampToValueAtTime(freq * 2.0, t + glideT);

    // Gentle singing vibrato
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.setValueAtTime(5.1, t);
    lfoG.gain.setValueAtTime(0, t);
    lfoG.gain.linearRampToValueAtTime(freq * (isLead ? 0.010 : 0.005), t + 0.25);
    lfo.connect(lfoG); lfoG.connect(car.frequency); lfoG.connect(harm.frequency);

    const srcMix = this.ctx.createGain();
    srcMix.gain.value = 1.0;
    const harmG = this.ctx.createGain();
    harmG.gain.value = 0.35;
    car.connect(srcMix);
    harm.connect(harmG); harmG.connect(srcMix);

    // Soft airy breath layer into formant bank
    const airSrc = this.ctx.createBufferSource();
    airSrc.buffer = this.noiseBuf;
    const airBp = this.ctx.createBiquadFilter();
    airBp.type = 'bandpass';
    airBp.frequency.setValueAtTime(2400, t);
    airBp.Q.value = 1.1;
    const airG = this.ctx.createGain();
    airG.gain.value = isLead ? 0.14 : 0.09;
    airSrc.connect(airBp); airBp.connect(airG); airG.connect(srcMix);

    const env = this.ctx.createGain();
    const atk = isLead ? 0.075 : Math.min(0.45, dur * 0.25);
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(gain, t + atk);
    env.gain.linearRampToValueAtTime(gain * 0.85, t + dur * 0.74);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    // Pure warm sine core + 3 parallel formant filters
    const sineCore = this.ctx.createGain();
    sineCore.gain.value = 0.38;
    car.connect(sineCore); sineCore.connect(env);

    const weights = [0.76, 0.56, 0.26];
    for (let i = 0; i < 3; i++) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = isLead ? 3.4 : 2.8;
      bp.frequency.setValueAtTime(fA[i], t);
      bp.frequency.exponentialRampToValueAtTime(fB[i], t + dur * 0.85);
      const wg = this.ctx.createGain();
      wg.gain.value = weights[i];
      srcMix.connect(bp); bp.connect(wg); wg.connect(env);
    }

    env.connect(isLead ? this.mixBus : this.pumpBus);
    env.connect(this.reverbIn);
    if (isLead) env.connect(this.delayIn); // 1/8d dotted stereo delay!

    lfo.start(t); car.start(t); harm.start(t); airSrc.start(t);
    lfo.stop(t + dur + 0.05); car.stop(t + dur + 0.05); harm.stop(t + dur + 0.05); airSrc.stop(t + dur + 0.05);
  }

  // =========================================================================
  // SHARED WARM PADS, ARPS & MODE LEADS
  // =========================================================================

  _playStereoPad(t, dur, freqs, gain, cutoff) {
    const fltL = this.ctx.createBiquadFilter();
    const fltR = this.ctx.createBiquadFilter();
    const lowC = Math.max(420, cutoff * 0.65);
    const highC = Math.min(1580, cutoff * 1.15);
    for (const flt of [fltL, fltR]) {
      flt.type = 'lowpass';
      flt.Q.value = 0.75;
      flt.frequency.setValueAtTime(lowC, t);
      flt.frequency.linearRampToValueAtTime(highC, t + dur * 0.5);
      flt.frequency.linearRampToValueAtTime(lowC, t + dur);
    }
    const gL = this.ctx.createGain(), gR = this.ctx.createGain();
    const pL = this.ctx.createStereoPanner(), pR = this.ctx.createStereoPanner();
    pL.pan.value = -0.76; pR.pan.value = 0.76;
    for (const g of [gL, gR]) {
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(gain * 0.65, t + Math.min(0.28, dur * 0.22));
      g.gain.linearRampToValueAtTime(gain * 0.54, t + dur * 0.78);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    }
    fltL.connect(gL); gL.connect(pL); pL.connect(this.pumpBus); pL.connect(this.reverbIn);
    fltR.connect(gR); gR.connect(pR); pR.connect(this.pumpBus); pR.connect(this.reverbIn);
    for (const f of freqs) {
      const o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'sawtooth';
      o1.frequency.setValueAtTime(f * 0.996, t);
      o2.frequency.setValueAtTime(f * 1.004, t);
      o1.connect(fltL); o2.connect(fltR);
      o1.start(t); o2.start(t);
      o1.stop(t + dur + 0.04); o2.stop(t + dur + 0.04);
    }
  }

  _playWarmArp(t, dur, freq, gain, cutoff, panVal, bellStyle = false) {
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = panVal;
    pan.connect(this.mixBus); pan.connect(this.delayIn); pan.connect(this.reverbIn);

    if (bellStyle) {
      const car = this.ctx.createOscillator(), mod = this.ctx.createOscillator();
      const modG = this.ctx.createGain(), g = this.ctx.createGain();
      car.type = 'sine'; mod.type = 'sine';
      car.frequency.setValueAtTime(freq, t);
      mod.frequency.setValueAtTime(freq * 3.0, t);
      modG.gain.setValueAtTime(freq * 0.9, t);
      modG.gain.exponentialRampToValueAtTime(0.5, t + 0.11);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      mod.connect(modG); modG.connect(car.frequency); car.connect(g); g.connect(pan);
      car.start(t); mod.start(t);
      car.stop(t + dur + 0.02); mod.stop(t + dur + 0.02);
      return;
    }

    const o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'triangle';
    o1.frequency.setValueAtTime(freq, t);
    o2.frequency.setValueAtTime(freq * 1.003, t);
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.Q.value = 1.6;
    flt.frequency.setValueAtTime(Math.min(2650, cutoff), t);
    flt.frequency.exponentialRampToValueAtTime(340, t + Math.min(dur, 0.095));
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(pan);
    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
  }

  _playModeLead(mode, t, dur, freq, slide, vowelA, vowelB, filterAmt, isDrop) {
    if (mode === 'tracker') {
      this._playChipVocalLead(t, dur, freq, 0.30, vowelA, vowelB);
      return;
    }
    if (mode === 'retrowave') {
      this._playAirySineVocal(t, dur, freq, 0.38, vowelA, vowelB, slide, true);
      if (isDrop) {
        this._playDualSawLead(t, dur, freq * 2.0, 0.062, 1950, slide);
      }
      return;
    }
    if (mode === 'darksynth') {
      // Aggressive darksynth lead through warm distorted edge!
      this._playDualSawLead(t, dur, freq, 0.14, 1550 + filterAmt * 1200, slide, true);
      return;
    }
    // Track 1 (Zero Friction) & Track 4 (Vector Matrix): ±12c dual detuned saw lead
    this._playDualSawLead(t, dur, freq, 0.135, 1450 + filterAmt * 1450, slide, false);
  }

  _playDualSawLead(t, dur, freq, gain, cutoff, slide = 0, darkEdge = false) {
    const o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = darkEdge ? 'square' : 'sawtooth';

    const startF = (slide > 0 && Math.abs(freq - this._lastLeadFreq) < freq * 0.5)
      ? this._lastLeadFreq : freq;
    this._lastLeadFreq = freq;
    const glideT = slide > 0 ? 0.048 : 0.008;

    o1.frequency.setValueAtTime(startF, t);
    o1.frequency.exponentialRampToValueAtTime(freq, t + glideT);
    o2.frequency.setValueAtTime(startF, t);
    o2.frequency.exponentialRampToValueAtTime(freq, t + glideT);
    o1.detune.setValueAtTime(-12, t);
    o2.detune.setValueAtTime(12, t);

    const lfo = this.ctx.createOscillator(), lfoG = this.ctx.createGain();
    lfo.frequency.setValueAtTime(5.5, t);
    lfoG.gain.setValueAtTime(0, t);
    lfoG.gain.linearRampToValueAtTime(freq * 0.007, t + 0.18);
    lfo.connect(lfoG); lfoG.connect(o1.frequency); lfoG.connect(o2.frequency);

    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.Q.value = 1.6;
    const top = Math.min(2700, cutoff);
    flt.frequency.setValueAtTime(top, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(760, top * 0.48), t + dur);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.018);
    g.gain.linearRampToValueAtTime(gain * 0.80, t + dur * 0.72);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    o1.connect(flt); o2.connect(flt); flt.connect(g);
    g.connect(this.mixBus); g.connect(this.delayIn); g.connect(this.reverbIn);
    lfo.start(t); o1.start(t); o2.start(t);
    lfo.stop(t + dur + 0.03); o1.stop(t + dur + 0.03); o2.stop(t + dur + 0.03);
  }

  // =========================================================================
  // REAL-TIME AUDIO TELEMETRY & VISUAL SYNC HOOKS UPDATE
  // =========================================================================

  update(dt, nowSec) {
    const tel = this.telemetry;
    tel.mode = this.track.mode;
    tel.rasterMode = this.track.mode === 'tracker' ? 1.0 : 0.0;

    // Track 5 continuous 0.2 Hz LFO value (always smooth 0..1)
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

    // Track 4: Smooth normalized TB-303 cutoff hook (0..1)
    tel.filterCutoffNormalized += (this._lastAcidCutoffNorm - tel.filterCutoffNormalized) * Math.min(1, dt * 10.0);

    // Track 5: 1/4-note pumping sub-bass envelope (ducks on beat, blooms cleanly!)
    tel.subBassEnvelope = Math.min(1, Math.max(0, 1.0 - Math.exp(-tel.beatPhase * 5.2)));

    // Track 1: Real-time FFT low-band bassEnergy (20..220Hz bins)
    if (this.fftAnalyser && this._fftData) {
      this.fftAnalyser.getByteFrequencyData(this._fftData);
      let sum = 0;
      for (let i = 0; i < 6; i++) sum += this._fftData[i];
      const rawBass = Math.min(1, (sum / (6 * 255)) * 1.45);
      tel.bassEnergy += (rawBass - tel.bassEnergy) * Math.min(1, dt * 16.0);
    } else {
      tel.bassEnergy = tel.kick;
    }

    // Track 2: Real-time Sub-Bass Peak Meter (subBassPunch 0..1)
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
