// Five genre-distinct high-craft racing tracks recreated from the Google Flow reference audio:
// 01 ZERO FRICTION    (150 BPM Breakbeat Synthwave)
// 02 OVERDRIVE        (145 BPM Heavy Industrial Darksynth)
// 03 TRACKER PROTOCOL (160 BPM 16-Bit Demoscene Cracktro / YM2612 Chiptune)
// 04 VECTOR MATRIX    (155 BPM Resonant TB-303 Acid Techno)
// 05 ANTI-GRAV DRIFT  (105 BPM Atmospheric Retrowave)
//
// Each track has 100% diatonic, cluster-free 8-bar voice-led chord tables:
//   b = exact bass MIDI root, p = 4-note pad/stab voicing, a = 4-note arp chord tones
// And expressive 8-bar (128-step) sparse phrase arrays: [step, semi, durSteps, slide].

export const TRACKS = [
  // =========================================================================
  // 01 // ZERO FRICTION — High-Velocity Breakbeat Synthwave (150 BPM, D minor)
  // =========================================================================
  {
    id: 'zero-friction',
    code: '01',
    name: 'ZERO FRICTION',
    subtitle: 'BREAKBEAT SYNTHWAVE // 150 BPM',
    mode: 'breakbeat',
    bpm: 150,
    root: 38, // D2 (pads +12 -> D3, leads +12 -> D4..D5)
    leadOct: 12,
    soloOct: 12,
    accentColor: '#00f0ff',
    beamColor: [0.05, 0.92, 1.0],
    patch: { pump: 0.44, revSend: 0.36, delaySend: 0.30 },
    // D natural minor: Dm -> Bb -> C -> Am7 -> Dm -> Gm -> Bb -> C
    chords: [
      { b: 38, p: [0, 3, 7, 12],   a: [0, 7, 12, 15] },
      { b: 34, p: [-4, 0, 3, 8],   a: [8, 12, 15, 19] },
      { b: 36, p: [-2, 2, 5, 10],  a: [10, 14, 17, 19] },
      { b: 33, p: [2, 5, 7, 10],   a: [7, 10, 14, 19] },
      { b: 38, p: [0, 3, 7, 12],   a: [0, 7, 12, 15] },
      { b: 43, p: [0, 5, 8, 12],   a: [5, 12, 15, 17] },
      { b: 34, p: [-4, 0, 3, 8],   a: [8, 12, 15, 19] },
      { b: 36, p: [-2, 2, 5, 10],  a: [10, 14, 17, 22] }
    ],
    // Syncopated high-velocity breakbeat drum patterns
    kicks: [
      [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
      [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,1,0,0],
      [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0]
    ],
    snares: [
      [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,2], // 2 = ghost breakbeat snare!
      [0,0,0,0, 1,0,0,2, 0,2,0,0, 1,0,0,2],
      [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0]
    ],
    hats: [
      [1,3,1,3, 1,3,2,3, 1,3,1,3, 1,3,2,1],
      [1,1,3,1, 1,3,2,1, 1,1,3,1, 1,3,2,1]
    ],
    // Driving breakbeat saw bass (0=root, 1=+12 oct, 2=+7 fifth, -1=rest)
    bassPats: [
      [0,-1,0,0, -1,0,1,-1, 0,-1,0,2, -1,0,1,0],
      [0,0,-1,1, 0,-1,2,0, 0,0,-1,1, 0,2,1,0]
    ],
    // Rapid 16th-note dual-detuned saw arpeggios
    arpPats: [
      [0,1,2,3, 4,3,2,1, 0,2,3,4, 3,2,1,0],
      [3,2,1,0, 2,3,4,3, 2,1,0,2, 3,4,3,2]
    ],
    // Cybernetic formant vocal stab trigger mask (on key beats!)
    vStabPat: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
    // 8-bar kinetic breakbeat synth hook ("Zero friction kinetic drive / Feel the system come alive!")
    melA: [
      [0,12,4,0], [4,15,2,0], [6,14,4,1], [10,12,4,0],
      [16,19,6,1], [22,17,2,0], [24,15,6,1],
      [32,17,4,0], [36,19,4,1], [40,22,6,1],
      [48,19,6,1], [56,17,4,1], [60,14,4,0],
      [64,15,4,0], [68,19,4,1], [72,24,6,1],
      [80,22,4,1], [84,20,4,1], [88,19,4,1], [92,17,4,0],
      [96,15,6,1], [104,19,4,1], [108,17,4,0],
      [112,19,10,1]
    ],
    // 8-bar soaring speed-drop climax melody!
    solo: [
      [0,24,6,0], [6,22,2,1], [8,19,4,0], [12,22,4,1],
      [16,20,6,0], [22,19,2,1], [24,15,6,0],
      [32,19,4,0], [36,22,4,1], [40,24,6,1],
      [48,26,6,0], [56,24,4,1], [60,22,4,0],
      [64,27,6,1], [70,26,2,1], [72,24,6,1],
      [80,22,4,0], [84,20,4,1], [88,17,6,1],
      [96,19,4,0], [100,20,4,1], [104,24,6,1],
      [112,22,10,1]
    ],
    vowels: ['EE', 'AH', 'OH', 'EE'],
    sections: [
      { bars: 4, chordOff: 0, name: 'KINETIC',    energy: 0.45, drumSet: 0, kick: 0.90, snare: 0.70, hat: 0.80, bass: 0.80, arp: 0.95, lead: 0, solo: 0, vStab: 0.85, pad: 0.75, filter: 0.56, roll: 0, drop: 0, tomFill: 1, lateKick: 1 },
      { bars: 8, chordOff: 0, name: 'ALIVE',      energy: 0.82, drumSet: 0, kick: 1.00, snare: 1.00, hat: 0.95, bass: 1.00, arp: 0.95, lead: 1, solo: 0, vStab: 0.75, pad: 0.82, filter: 0.86, roll: 0, drop: 0, tomFill: 1 },
      { bars: 4, chordOff: 0, name: 'PRESSURE',   energy: 0.22, drumSet: 2, kick: 0.00, snare: 0.45, hat: 0.35, bass: 0.35, arp: 1.00, lead: 0, solo: 0, vStab: 0.95, pad: 1.00, filter: 0.36, roll: 0, drop: 0, tomFill: 0 },
      { bars: 4, chordOff: 4, name: 'IGNITE',     energy: 0.90, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, bass: 1.00, arp: 1.00, lead: 0, solo: 0, vStab: 0.90, pad: 0.90, filter: 0.95, roll: 1, drop: 0, tomFill: 1 },
      { bars: 8, chordOff: 0, name: 'SPEED DROP', energy: 1.00, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, bass: 1.00, arp: 1.00, lead: 0, solo: 1, vStab: 1.00, pad: 0.90, filter: 1.00, roll: 0, drop: 1, tomFill: 1 }
    ],
    lyrics: [
      'ZERO', 'FRICTION', 'KINETIC', 'DRIVE',
      'FEEL THE', 'SYSTEM', 'COME ALIVE', 'SPEED IS',
      'RISING', 'FRICTION', 'DIES', 'CYBER',
      'POWER', 'OPEN WIDE', 'SPEED', 'DROP',
      'KINETIC', 'VELOCITY', 'NEVER', 'STOP'
    ]
  },

  // =========================================================================
  // 02 // OVERDRIVE — Heavy Industrial Darksynth (145 BPM, E minor)
  // =========================================================================
  {
    id: 'overdrive',
    code: '02',
    name: 'OVERDRIVE',
    subtitle: 'HEAVY DARKSYNTH // 145 BPM',
    mode: 'darksynth',
    bpm: 145,
    root: 40, // E2 (sub-sine plays 28..38 = 41..73Hz; distorted saw plays 40..50!)
    leadOct: 12,
    soloOct: 12,
    accentColor: '#ff1e42',
    beamColor: [1.0, 0.16, 0.28],
    patch: { pump: 0.50, revSend: 0.30, delaySend: 0.22 }, // -6dB = 0.50 ducking on every beat!
    // Menacing E minor darksynth progression: Em -> Em -> C -> D -> Em -> C -> Am -> B5/Bm
    chords: [
      { b: 28, p: [0, 7, 12, 15],  a: [0, 7, 12, 15] },  // E1 = 41.2 Hz
      { b: 28, p: [0, 3, 7, 12],   a: [0, 3, 7, 12] },   // E1 = 41.2 Hz
      { b: 36, p: [-4, 0, 3, 8],   a: [8, 12, 15, 19] }, // C2 = 65.4 Hz
      { b: 38, p: [-2, 2, 5, 10],  a: [10, 14, 17, 22] },// D2 = 73.4 Hz
      { b: 28, p: [0, 7, 12, 15],  a: [0, 7, 12, 15] },  // E1 = 41.2 Hz
      { b: 36, p: [-4, 0, 3, 8],   a: [8, 12, 15, 19] }, // C2 = 65.4 Hz
      { b: 33, p: [0, 5, 8, 12],   a: [5, 12, 15, 17] }, // A1 = 55.0 Hz
      { b: 35, p: [2, 7, 10, 14],  a: [7, 10, 14, 19] }  // B1 = 61.7 Hz
    ],
    // Relentless 4-on-the-floor heavy industrial stomp!
    kicks: [
      [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      [1,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,0,0],
      [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0]
    ],
    snares: [
      [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0]
    ],
    hats: [
      [1,0,1,0, 1,0,2,0, 1,0,1,0, 1,0,2,1],
      [1,3,1,3, 1,3,2,1, 1,3,1,3, 1,3,2,1]
    ],
    // Aggressive rolling distorted sawtooth + sub-sine bassline
    bassPats: [
      [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,2,0,0],
      [0,0,1,0, 0,0,0,2, 0,0,1,0, 1,0,2,0]
    ],
    arpPats: [
      [0,1,2,1, 0,1,3,2, 0,1,2,1, 3,2,1,0],
      [0,2,1,3, 0,2,4,3, 0,2,1,3, 4,3,2,1]
    ],
    // Staccato pitch-drop industrial brass stab rhythm + ring-mod robotic vocal triggers
    stabPat:  [1,0,0,1, 0,0,1,0, 0,0,0,0, 1,0,0,0],
    vStabPat: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0],
    // 8-bar aggressive darksynth anthem riff ("Redline! High voltage heavy lead!")
    melA: [
      [0,12,4,0], [4,12,2,0], [6,15,4,0], [10,14,4,0],
      [16,12,6,0], [24,10,4,0], [28,12,4,0],
      [32,15,6,0], [38,14,2,0], [40,12,6,0],
      [48,14,6,0], [56,12,4,0], [60,10,4,0],
      [64,12,4,0], [68,15,4,0], [72,19,6,0],
      [80,20,6,0], [86,19,2,0], [88,15,6,0],
      [96,17,6,0], [104,15,4,0], [108,14,4,0],
      [112,19,10,0]
    ],
    // 8-bar screaming heavy darksynth overdrive climax!
    solo: [
      [0,24,4,0], [4,24,2,0], [6,22,2,0], [8,19,6,0],
      [16,19,4,0], [20,22,4,0], [24,24,6,0],
      [32,20,6,0], [38,19,2,0], [40,15,6,0],
      [48,22,6,0], [56,19,4,0], [60,17,4,0],
      [64,24,4,0], [68,26,4,0], [72,27,6,0],
      [80,24,4,0], [84,20,4,0], [88,19,6,0],
      [96,20,4,0], [100,22,4,0], [104,24,6,0],
      [112,26,10,0]
    ],
    vowels: ['AH', 'OH', 'EE', 'AH'],
    sections: [
      { bars: 4, chordOff: 0, name: 'REDLINE',      energy: 0.50, drumSet: 0, kick: 1.00, snare: 0.00, hat: 0.70, bass: 0.90, arp: 0.70, stab: 0.85, lead: 0, solo: 0, vStab: 0.70, pad: 0.65, filter: 0.58, roll: 0, drop: 0, tomFill: 1, lateKick: 0 },
      { bars: 8, chordOff: 0, name: 'HIGH VOLTAGE', energy: 0.86, drumSet: 0, kick: 1.00, snare: 1.00, hat: 0.95, bass: 1.00, arp: 0.85, stab: 0.95, lead: 1, solo: 0, vStab: 0.85, pad: 0.72, filter: 0.88, roll: 0, drop: 0, tomFill: 1 },
      { bars: 4, chordOff: 0, name: 'CLEAR MIND',   energy: 0.18, drumSet: 2, kick: 0.00, snare: 0.00, hat: 0.30, bass: 0.40, arp: 0.85, stab: 0.00, lead: 0, solo: 0, vStab: 0.65, pad: 1.00, filter: 0.30, roll: 0, drop: 0, tomFill: 0 },
      { bars: 4, chordOff: 4, name: 'APEX BUILD',   energy: 0.92, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, bass: 1.00, arp: 0.95, stab: 1.00, lead: 0, solo: 0, vStab: 0.90, pad: 0.80, filter: 0.95, roll: 1, drop: 0, tomFill: 1 },
      { bars: 8, chordOff: 0, name: 'OVERDRIVE',    energy: 1.00, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, bass: 1.00, arp: 0.95, stab: 1.00, lead: 0, solo: 1, vStab: 1.00, pad: 0.85, filter: 1.00, roll: 0, drop: 1, tomFill: 1 }
    ],
    lyrics: [
      'REDLINE', 'HIT THE GAS', 'HIGH', 'VOLTAGE',
      'HEAVY LEAD', 'BURY THE', 'METER', 'IN THE RED',
      'PAST THE', 'APEX NOW', 'SPEED IS', 'ADDICTION',
      'OVERDRIVE', 'TAKE', 'CONTROL', 'GRIDLOCK',
      'BROKEN', 'FULL', 'THROTTLE'
    ]
  },

  // =========================================================================
  // 03 // TRACKER PROTOCOL — 16-Bit Demoscene Cracktro (160 BPM, D Major)
  // =========================================================================
  {
    id: 'tracker-protocol',
    code: '03',
    name: 'TRACKER PROTOCOL',
    subtitle: '16-BIT CRACKTRO // 160 BPM',
    mode: 'tracker',
    bpm: 160,
    root: 38, // D2 (dry 25% pulse bass 35..45; YM2612 FM arps +12; chip vocal lead +12!)
    leadOct: 12,
    soloOct: 12,
    accentColor: '#ffe600',
    beamColor: [1.0, 0.90, 0.12],
    patch: { pump: 0.72, revSend: 0.14, delaySend: 0.18 }, // Crisp dry tracker punch!
    // Euphoric 16-bit cracktro D Major progression: Gmaj7 -> A -> Bm7 -> F#m7 -> Gmaj7 -> A -> D -> A
    chords: [
      { b: 43, p: [-7, -3, 0, 4],  a: [5, 9, 12, 16] },
      { b: 45, p: [-5, -1, 2, 7],  a: [7, 11, 14, 19] },
      { b: 35, p: [-3, 0, 4, 7],   a: [9, 12, 16, 19] },
      { b: 42, p: [-1, 2, 4, 7],   a: [4, 7, 11, 16] },
      { b: 43, p: [-7, -3, 0, 4],  a: [5, 9, 12, 16] },
      { b: 45, p: [-5, -1, 2, 7],  a: [7, 11, 14, 19] },
      { b: 38, p: [0, 4, 7, 11],   a: [0, 4, 7, 12] },
      { b: 45, p: [-5, -1, 2, 7],  a: [7, 11, 14, 19] }
    ],
    // Snappy 160 BPM 16-bit tracker break/dance drums
    kicks: [
      [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      [1,0,0,1, 0,0,1,0, 1,0,0,0, 1,0,1,0],
      [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0]
    ],
    snares: [
      [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,1,1],
      [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0]
    ],
    hats: [
      [1,0,1,0, 1,0,2,0, 1,0,1,0, 1,0,2,0],
      [1,3,1,3, 1,3,2,3, 1,3,1,3, 1,3,2,1]
    ],
    // Ultra-crisp dry 25%-duty 8-bit octave-bouncing tracker bass!
    bassPats: [
      [0,1,0,1, 0,1,2,1, 0,1,0,1, 0,1,2,1],
      [0,0,1,0, 0,1,0,2, 0,0,1,0, 1,2,1,0]
    ],
    // 32nd-note YM2612 FM arpeggio chord-tone cycles (each 16th fires 2×32nd notes!)
    arpPats: [
      [0,1,2,3, 4,3,2,1, 0,1,2,3, 4,3,2,1],
      [0,2,1,3, 2,4,3,1, 0,2,1,3, 4,3,2,1]
    ],
    // 8-bar hyper-melodic bouncing 8-bit formant-square chip lead (Audio #3 & #1 joy!)
    melA: [
      [0,16,3,0], [3,19,3,0], [6,16,2,0], [8,12,4,0], [12,14,4,0],
      [16,19,3,0], [19,16,3,0], [22,14,2,0], [24,11,4,0], [28,14,4,0],
      [32,16,3,0], [35,19,3,0], [38,21,2,0], [40,24,4,0], [44,21,4,0],
      [48,19,4,0], [52,16,4,0], [56,14,6,0],
      [64,16,3,0], [67,19,3,0], [70,21,2,0], [72,24,4,0], [76,21,4,0],
      [80,23,3,0], [83,21,3,0], [86,19,2,0], [88,16,4,0], [92,19,4,0],
      [96,24,4,0], [100,21,4,0], [104,19,4,0], [108,16,4,0],
      [112,19,8,0], [120,21,4,0], [124,23,4,0]
    ],
    // 8-bar blistering euphoric cracktro climax chip solo!
    solo: [
      [0,24,2,0], [2,21,2,0], [4,19,2,0], [6,21,2,0], [8,24,4,0], [12,26,4,0],
      [16,23,2,0], [18,21,2,0], [20,19,2,0], [22,21,2,0], [24,23,4,0], [28,26,4,0],
      [32,28,4,0], [36,26,2,0], [38,24,2,0], [40,21,4,0], [44,19,4,0],
      [48,23,4,0], [52,21,2,0], [54,19,2,0], [56,16,6,0],
      [64,24,2,0], [66,26,2,0], [68,28,4,0], [72,26,2,0], [74,24,2,0], [76,21,4,0],
      [80,23,2,0], [82,26,2,0], [84,28,4,0], [88,26,4,0], [92,23,4,0],
      [96,24,4,0], [100,28,4,0], [104,26,4,0], [108,24,4,0],
      [112,26,8,0], [120,23,4,0], [124,21,4,0]
    ],
    vowels: ['EE', 'AH', 'EE', 'OH'],
    sections: [
      { bars: 4, chordOff: 0, name: 'BOOT SEQ',    energy: 0.48, drumSet: 0, kick: 0.95, snare: 0.50, hat: 0.75, bass: 0.90, arp: 1.00, lead: 0, solo: 0, pad: 0.45, filter: 0.72, roll: 0, drop: 0, tomFill: 1, lateKick: 1 },
      { bars: 8, chordOff: 0, name: 'VECTOR RUN',  energy: 0.86, drumSet: 0, kick: 1.00, snare: 1.00, hat: 0.95, bass: 1.00, arp: 1.00, lead: 1, solo: 0, pad: 0.55, filter: 0.92, roll: 0, drop: 0, tomFill: 1 },
      { bars: 4, chordOff: 0, name: 'ALIGNMENT',   energy: 0.28, drumSet: 2, kick: 0.00, snare: 0.40, hat: 0.40, bass: 0.45, arp: 1.00, lead: 0, solo: 0, pad: 0.75, filter: 0.55, roll: 0, drop: 0, tomFill: 0 },
      { bars: 4, chordOff: 4, name: 'FULL SPEED',  energy: 0.92, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, bass: 1.00, arp: 1.00, lead: 0, solo: 0, pad: 0.65, filter: 0.98, roll: 1, drop: 0, tomFill: 1 },
      { bars: 8, chordOff: 0, name: 'FRAME CLEAR', energy: 1.00, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, bass: 1.00, arp: 1.00, lead: 0, solo: 1, pad: 0.70, filter: 1.00, roll: 0, drop: 1, tomFill: 1 }
    ],
    lyrics: [
      'GENERATING', 'VECTOR', 'FRAMES', 'PROCESSING',
      'ALIGNMENT', 'POINTS', 'MATRIX', 'FULL SPEED',
      'WIREFRAME', 'LIGHT', 'ANTI-GRAV', 'ENGAGE',
      'MAGNETIC', 'PULSE', 'FRAME', 'BUFFER', 'CLEAR'
    ]
  },

  // =========================================================================
  // 04 // VECTOR MATRIX — Intense Resonant Acid Techno (155 BPM, A minor)
  // =========================================================================
  {
    id: 'vector-matrix',
    code: '04',
    name: 'VECTOR MATRIX',
    subtitle: 'TB-303 ACID TECHNO // 155 BPM',
    mode: 'acid',
    bpm: 155,
    root: 33, // A1 = 55 Hz (TB-303 acid sweet spot A1..A3!)
    leadOct: 24,
    soloOct: 12, // keeps climax rave counter-lead warm & powerful (A3..E5), never shrill!
    accentColor: '#39ff14',
    beamColor: [0.22, 1.0, 0.35],
    patch: { pump: 0.46, revSend: 0.28, delaySend: 0.30 },
    // Hypnotic A minor Acid Techno cycle: Am -> Am -> F -> G -> Am -> Am -> Dm -> Em
    chords: [
      { b: 33, p: [0, 3, 7, 12],   a: [0, 7, 12, 15] },
      { b: 33, p: [0, 7, 10, 15],  a: [0, 3, 7, 10] },
      { b: 41, p: [-4, 0, 3, 8],   a: [8, 12, 15, 19] },
      { b: 43, p: [-2, 2, 5, 10],  a: [10, 14, 17, 19] },
      { b: 33, p: [0, 3, 7, 12],   a: [0, 7, 12, 15] },
      { b: 33, p: [0, 7, 10, 15],  a: [0, 3, 7, 10] },
      { b: 38, p: [0, 5, 8, 12],   a: [5, 12, 15, 17] },
      { b: 40, p: [2, 5, 7, 10],   a: [7, 10, 14, 19] }
    ],
    // Driving 909 4-on-the-floor kick + accented offbeat claps + sizzling 909 open hi-hats!
    kicks: [
      [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0],
      [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0]
    ],
    snares: [
      [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], // 909 clap on 2 & 4 + offbeat accents!
      [0,0,0,0, 1,0,2,0, 0,0,0,0, 1,0,2,0], // 2 = offbeat accent clap!
      [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0]
    ],
    hats: [
      [1,0,2,0, 1,0,2,0, 1,0,2,0, 1,0,2,0], // classic 909 open hat on EVERY "&" offbeat!
      [1,3,2,3, 1,3,2,3, 1,3,2,3, 1,3,2,1]
    ],
    // Authentic 16-step TB-303 Acid patterns: [semiOffsetFromChordBass, accent(0/1), slide(0/1)] or null
    acidPats: [
      [
        [0,1,0], [0,0,0], [12,0,1], [0,0,0],
        [3,1,0], [0,0,0], [7,0,1],  [10,0,0],
        [0,1,0], [12,0,1],[15,1,0], [12,0,0],
        [7,0,1], [10,1,0],[7,0,0],  [3,0,1]
      ],
      [
        [0,1,0], [12,0,1],[0,0,0],  [10,1,0],
        [12,0,1],[15,1,0],[12,0,0], [7,0,1],
        [0,1,0], [3,0,0], [7,1,0],  [12,0,1],
        [15,1,0],[12,0,1],[10,0,0], [7,1,0]
      ]
    ],
    arpPats: [
      [0,1,2,3, 2,1,0,1, 2,3,4,3, 2,1,2,3],
      [4,3,2,1, 0,1,2,3, 4,3,2,1, 0,2,3,4]
    ],
    // Hypnotic rave synth counter-hook layered on drops
    melA: [
      [0,12,6,0], [8,15,6,1],
      [16,12,8,0], [28,10,4,0],
      [32,15,6,0], [40,19,6,1],
      [48,17,8,1], [60,14,4,0],
      [64,19,6,0], [72,22,6,1],
      [80,24,8,1], [92,22,4,0],
      [96,20,6,0], [104,19,6,1],
      [112,19,10,1]
    ],
    solo: [
      [0,24,4,0], [6,22,2,1], [8,19,4,0], [12,24,4,1],
      [16,22,4,0], [22,19,2,1], [24,15,6,0],
      [32,20,4,0], [36,24,4,1], [40,27,6,1],
      [48,26,6,0], [56,22,4,1], [60,19,4,0],
      [64,24,4,0], [68,27,4,1], [72,31,6,1],
      [80,27,4,0], [84,24,4,1], [88,22,6,0],
      [96,20,4,0], [100,24,4,1], [104,26,6,1],
      [112,26,10,1]
    ],
    vowels: ['AH', 'EE', 'OH', 'OO'],
    sections: [
      { bars: 4, chordOff: 0, name: 'ACID BOOT',  energy: 0.46, drumSet: 0, kick: 1.00, snare: 0.50, hat: 0.85, acid: 0.85, arp: 0.45, lead: 0, solo: 0, chop: 0.55, pad: 0.40, filter: 0.35, roll: 0, drop: 0, tomFill: 1, lateKick: 0 },
      { bars: 8, chordOff: 0, name: 'SQUELCH',    energy: 0.84, drumSet: 0, kick: 1.00, snare: 1.00, hat: 1.00, acid: 1.00, arp: 0.65, lead: 1, solo: 0, chop: 0.85, pad: 0.50, filter: 0.72, roll: 0, drop: 0, tomFill: 1 },
      { bars: 4, chordOff: 0, name: 'RESONANCE',  energy: 0.24, drumSet: 2, kick: 0.00, snare: 0.00, hat: 0.40, acid: 1.00, arp: 0.75, lead: 0, solo: 0, chop: 0.90, pad: 0.80, filter: 0.55, roll: 0, drop: 0, tomFill: 0 },
      { bars: 4, chordOff: 4, name: 'ACID SURGE', energy: 0.92, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, acid: 1.00, arp: 0.85, lead: 0, solo: 0, chop: 0.95, pad: 0.65, filter: 0.94, roll: 1, drop: 0, tomFill: 1 },
      { bars: 8, chordOff: 0, name: 'VECTOR MAX', energy: 1.00, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, acid: 1.00, arp: 0.85, lead: 0, solo: 1, chop: 1.00, pad: 0.70, filter: 1.00, roll: 0, drop: 1, tomFill: 1 }
    ],
    lyrics: [
      'VECTOR', 'MATRIX', 'ACID', 'PROTOCOL',
      'RESONANCE', 'LOCKED', 'SLIDE', 'ACCENT',
      'OVERRIDE', 'HYPER', 'GRID', 'WIREFRAME',
      'SURGE', 'MAXIMUM', 'VELOCITY'
    ]
  },

  // =========================================================================
  // 05 // ANTI-GRAV DRIFT — Smooth Atmospheric Retrowave (105 BPM, F# minor)
  // =========================================================================
  {
    id: 'anti-grav-drift',
    code: '05',
    name: 'ANTI-GRAV DRIFT',
    subtitle: 'ATMOSPHERIC RETROWAVE // 105 BPM',
    mode: 'retrowave',
    bpm: 105,
    root: 42, // F#2 (sub-sine F#1=46.2Hz right at 45Hz sweet spot; airy vocal F#3..F#4!)
    leadOct: 0,
    soloOct: 0,
    accentColor: '#ff5ca8',
    beamColor: [1.0, 0.52, 0.88],
    patch: { pump: 0.34, revSend: 0.64, delaySend: 0.36 }, // Heavy 1/4-note pumping + lush 2.5s gated reverb!
    // Lush F# natural minor: F#m -> D -> A -> E -> F#m -> D -> Bm -> C#m7
    chords: [
      { b: 30, p: [0, 3, 7, 12],   a: [0, 7, 12, 15] },  // F#1 = 46.2 Hz (~45 Hz sub-sine!)
      { b: 38, p: [-4, 0, 3, 7],   a: [8, 12, 15, 19] }, // D2  = 73.4 Hz (Dmaj7)
      { b: 33, p: [3, 7, 10, 15],  a: [3, 7, 10, 15] },  // A1  = 55.0 Hz
      { b: 28, p: [-2, 2, 5, 10],  a: [10, 14, 17, 19] },// E1  = 41.2 Hz
      { b: 30, p: [0, 3, 7, 12],   a: [0, 7, 12, 15] },  // F#1 = 46.2 Hz
      { b: 38, p: [-4, 0, 3, 7],   a: [8, 12, 15, 19] }, // D2  = 73.4 Hz
      { b: 35, p: [0, 5, 8, 12],   a: [5, 12, 15, 17] }, // B1  = 61.7 Hz
      { b: 37, p: [2, 5, 7, 10],   a: [7, 10, 14, 19] }  // C#2 = 69.3 Hz
    ],
    // Soft 707-style electronic kick + gated 80s snare + retro 707 rimshots!
    kicks: [
      [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      [1,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,0,0],
      [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
    ],
    snares: [
      [0,0,0,0, 1,0,0,2, 0,0,2,0, 1,0,0,2], // 1 = gated 80s snare, 2 = 707 rimshot!
      [0,0,2,0, 1,0,0,2, 0,0,2,0, 1,0,2,0],
      [0,0,0,0, 0,0,0,2, 0,0,0,0, 1,0,0,0]
    ],
    hats: [
      [1,0,1,0, 1,0,2,0, 1,0,1,0, 1,0,2,0],
      [1,3,1,0, 1,3,2,0, 1,3,1,0, 1,3,2,1]
    ],
    // Sustained 45Hz sub-sine bass pumping cleanly on every quarter note!
    bassPats: [
      [0,-1,-1,-1, 0,-1,-1,-1, 0,-1,-1,-1, 0,-1,-1,-1],
      [0,-1,-1,-1, 0,-1,-1,-1, 0,-1,-1,-1, 0,-1,2,-1]
    ],
    arpPats: [
      [0,1,2,3, 2,1,0,1, 0,1,2,3, 4,3,2,1],
      [2,1,0,1, 2,3,4,3, 2,1,0,1, 2,3,2,1]
    ],
    // 8-bar floating airy sine-carrier vocoded synth melody ("Floating in the neon light / City streets below tonight...")
    melA: [
      [0,15,6,0], [6,14,2,1], [8,12,8,1],
      [16,15,6,0], [22,19,6,1], [28,15,4,1],
      [32,15,6,0], [38,17,2,1], [40,19,8,1],
      [48,14,10,1], [60,12,4,0],
      [64,15,6,0], [70,17,2,0], [72,19,8,1],
      [80,20,6,1], [86,19,2,0], [88,15,8,1],
      [96,17,6,0], [102,15,2,1], [104,12,8,1],
      [112,14,8,1], [120,15,6,1]
    ],
    // 8-bar soaring emotional chorus ("Drift away on neon streams / Living in futuristic dreams!")
    solo: [
      [0,19,6,0], [6,22,4,1], [10,24,6,1],
      [16,20,6,1], [22,19,4,1], [26,15,6,0],
      [32,22,6,0], [38,24,4,1], [42,22,6,1],
      [48,19,8,1], [58,17,2,0], [60,19,4,1],
      [64,24,6,0], [70,22,4,1], [74,19,6,1],
      [80,20,6,1], [86,22,2,0], [88,24,8,1],
      [96,22,6,0], [102,20,2,1], [104,19,4,1], [108,17,4,0],
      [112,19,12,1]
    ],
    vowels: ['OO', 'AH', 'OH', 'AH'],
    sections: [
      { bars: 4, chordOff: 0, name: 'NEON LIGHT',  energy: 0.30, drumSet: 0, kick: 0.85, snare: 0.50, hat: 0.50, bass: 0.85, arp: 0.80, lead: 0, solo: 0, pad: 1.00, filter: 0.52, roll: 0, drop: 0, tomFill: 1, lateKick: 1 },
      { bars: 8, chordOff: 0, name: 'WEIGHTLESS',  energy: 0.72, drumSet: 0, kick: 1.00, snare: 1.00, hat: 0.85, bass: 1.00, arp: 0.85, lead: 1, solo: 0, pad: 1.00, filter: 0.82, roll: 0, drop: 0, tomFill: 1 },
      { bars: 4, chordOff: 0, name: 'BEYOND',      energy: 0.16, drumSet: 2, kick: 0.00, snare: 0.35, hat: 0.25, bass: 0.45, arp: 0.90, lead: 0, solo: 0, pad: 1.00, filter: 0.38, roll: 0, drop: 0, tomFill: 0 },
      { bars: 4, chordOff: 4, name: 'ASCENT',      energy: 0.80, drumSet: 1, kick: 1.00, snare: 0.95, hat: 0.90, bass: 0.95, arp: 0.95, lead: 0, solo: 0, pad: 1.00, filter: 0.92, roll: 1, drop: 0, tomFill: 1 },
      { bars: 8, chordOff: 0, name: 'NEON STREAM', energy: 0.98, drumSet: 1, kick: 1.00, snare: 1.00, hat: 0.95, bass: 1.00, arp: 0.90, lead: 0, solo: 1, pad: 1.00, filter: 1.00, roll: 0, drop: 1, tomFill: 1 }
    ],
    lyrics: [
      'FLOATING', 'IN THE', 'NEON LIGHT', 'CITY',
      'STREETS', 'TONIGHT', 'ANTI-GRAV', 'TAKES',
      'CONTROL', 'CRUISING', 'GLOWING', 'GRID',
      'DRIFT AWAY', 'NEON', 'STREAMS', 'FUTURISTIC',
      'DREAMS', 'BEYOND', 'THE NIGHT', 'ETERNAL', 'LIGHT'
    ]
  }
];
