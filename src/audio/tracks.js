// Five completely distinct genre-authentic racing tracks recreated procedurally
// from the Google Flow reference tracks (zero MP4s, 100% Web Audio API):
// 01 ZERO FRICTION    (150 BPM Breakbeat / Neuro-Wobble Synthwave)
// 02 OVERDRIVE        (145 BPM Heavy Metal / Industrial Darksynth)
// 03 TRACKER PROTOCOL (160 BPM 16-Bit YM2612 Demoscene Cracktro / J-Core)
// 04 VECTOR MATRIX    (155 BPM Resonant TB-303 Acid Techno + 90s Rave Stabs)
// 05 ANTI-GRAV DRIFT  (105 BPM Atmospheric Retrowave + 3-Part Harmonized Vocals)
//
// Phrase event format: [step(0..127), semi, durSteps, slide, vowel?, cons?]
//   cons: 0=none, 1=sibilant(S/Z/F), 2=plosive(T/K/D/P) for articulated vocoder syllables!

const P = s => [...s].map(c => c === '-' ? -1 : +c);

// Split a timed lyric line into crisp 1-2 word 3D holographic chunks (<= 13 chars)
export function splitLyricChunks(line) {
  const words = line.toUpperCase().replace(/[(),]/g, '').split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    if (i + 1 < words.length && words[i].length + 1 + words[i + 1].length <= 13) {
      out.push(words[i] + ' ' + words[i + 1]);
      i++;
    } else {
      out.push(words[i]);
    }
  }
  return out.length ? out : [line.toUpperCase()];
}

// Evenly distribute string lines across [startSec, startSec + totalDur]
function E(startSec, totalDur, lines) {
  const d = +(totalDur / lines.length).toFixed(2);
  return lines.map((l, i) => [+(startSec + i * d).toFixed(2), d, l]);
}

// Repeat a timed lyric block proportionally across [startSec, startSec + totalDur]
function R(startSec, totalDur, block) {
  let sum = 0;
  for (const b of block) sum += b[1];
  const scale = sum > 0 ? totalDur / sum : 1;
  let cur = startSec;
  return block.map(b => {
    const d = +(b[1] * scale).toFixed(2);
    const e = [+cur.toFixed(2), d, b[2]];
    cur += d;
    return e;
  });
}

const T1_CH = [
  [27, 3, 'SYSTEM OVERVOLTAGE'],
  [30, 3, 'CYBERNETIC SPEED LOCK'],
  [33, 3, 'REDLINE THE REACTOR'],
  [36, 3, 'TICKING DOWN THE GRID CLOCK'],
  [39, 3, 'SHIFT INTO THE MAINFRAME'],
  [42, 3, 'VECTOR RAYS ALIGN'],
  [45, 2, 'OVERDRIVE (OVERDRIVE)'],
  [47, 1, 'CROSSING THROUGH THE FINISH LINE']
];
const T1_V1 = [
  [52, 4, 'GRID LINE RENDER ON THE VECTOR SCREEN'],
  [56, 4, 'CURRENT SURGING THROUGH THE MAIN MACHINE'],
  [60, 4, 'MAGNETIC LEVITATION LOCKED IN PLACE'],
  [64, 4, 'DIGITAL PHANTOM IN AN ENDLESS SPACE'],
  [68, 2, 'CAPACITOR BURNING AT MAXIMUM LOAD'],
  [70, 2, 'TRACING THE EDGE OF THE WIREFRAME ROAD']
];
const T2_CH = [
  'HIGH VOLTAGE, HEAVY LEAD',
  'BURYING THE METER IN THE RED',
  'PUSHING PAST THE APEX NOW',
  'RUNNING HOT, NO BACKING DOWN'
];

export const TRACKS = [
  // =========================================================================
  // 01 // ZERO FRICTION — Breakbeat / Neuro-Wobble Synthwave (150 BPM, D min)
  // =========================================================================
  {
    id: 'zero-friction',
    code: '01',
    name: 'ZERO FRICTION',
    subtitle: 'BREAKBEAT SYNTHWAVE // 150 BPM',
    mode: 'breakbeat',
    bpm: 150,
    root: 38, // D2
    leadOct: 12,
    soloOct: 12,
    accentColor: '#00f0ff',
    beamColor: [0.05, 0.92, 1.0],
    patch: { pump: 0.42, revSend: 0.36, delaySend: 0.32 },
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
    kicks: [
      P('1000001000100000'),
      P('1001001000100100'),
      P('1000000000100000')
    ],
    snares: [
      P('0000100000001002'),
      P('0000100202001002'),
      P('0000000010000000')
    ],
    hats: [
      P('1313132313131321'),
      P('1131132111311321')
    ],
    // Neuro/Breakbeat wobble bass trigger pattern (0=root, 1=+12, 2=+7, 3=wobble growl)
    bassPats: [
      P('0-30-01-0-32-010'),
      P('3--10-303--10230')
    ],
    arpPats: [
      P('0123432102343210'),
      P('3210234321023432')
    ],
    // Stadium supersaw chord gate rhythm on pre-drop & drop
    chordPat: P('1001001000100000'),
    // Articulated cyber-vocoder syllable hooks ("ZE-RO FRIC-TION / COME A-LIVE / SPEED DROP!")
    vStabPat: P('1000001000100000'),
    // 8-bar articulated cyber-vocoder melody (with consonants & vowels!)
    melA: [
      [0,12,4,0,'EE',1], [4,15,2,0,'OH',2], [6,14,4,1,'IH',1], [10,12,4,0,'AH',2],
      [16,19,6,1,'EE',1], [22,17,2,0,'AH',0], [24,15,6,1,'OH',2],
      [32,17,4,0,'EE',1], [36,19,4,1,'AH',2], [40,22,6,1,'AI',1],
      [48,19,6,1,'OH',2], [56,17,4,1,'EE',1], [60,14,4,0,'AH',0],
      [64,15,4,0,'EE',1], [68,19,4,1,'OH',2], [72,24,6,1,'AI',1],
      [80,22,4,1,'OH',2], [84,20,4,1,'AH',0], [88,19,4,1,'EE',1], [92,17,4,0,'OH',2],
      [96,15,6,1,'AI',1], [104,19,4,1,'EE',2], [108,17,4,0,'AH',0],
      [112,19,10,1,'OH',1]
    ],
    // 8-bar soaring cyber-anthem + talking wobble drop lead
    solo: [
      [0,24,6,0,'EE',1], [6,22,2,1,'OH',2], [8,19,4,0,'AH',1], [12,22,4,1,'EE',2],
      [16,20,6,0,'AI',1], [22,19,2,1,'OH',0], [24,15,6,0,'AH',2],
      [32,19,4,0,'EE',1], [36,22,4,1,'OH',2], [40,24,6,1,'AI',1],
      [48,26,6,0,'EE',2], [56,24,4,1,'OH',0], [60,22,4,0,'AH',1],
      [64,27,6,1,'EE',1], [70,26,2,1,'OH',2], [72,24,6,1,'AI',1],
      [80,22,4,0,'AH',2], [84,20,4,1,'OH',0], [88,17,6,1,'EE',1],
      [96,19,4,0,'AI',2], [100,20,4,1,'OH',0], [104,24,6,1,'EE',1],
      [112,22,10,1,'AH',2]
    ],
    vowels: ['EE', 'OH', 'AI', 'AH'],
    sections: [
      { bars: 4, chordOff: 0, name: 'KINETIC',    energy: 0.45, drumSet: 0, kick: 0.90, snare: 0.72, hat: 0.80, bass: 0.85, arp: 0.90, chord: 0.50, lead: 0, solo: 0, vStab: 0.85, pad: 0.70, filter: 0.56, roll: 0, drop: 0, tomFill: 1, lateKick: 1 },
      { bars: 8, chordOff: 0, name: 'ALIVE',      energy: 0.82, drumSet: 0, kick: 1.00, snare: 1.00, hat: 0.95, bass: 1.00, arp: 0.90, chord: 0.88, lead: 1, solo: 0, vStab: 0.80, pad: 0.78, filter: 0.86, roll: 0, drop: 0, tomFill: 1 },
      { bars: 4, chordOff: 0, name: 'PRESSURE',   energy: 0.22, drumSet: 2, kick: 0.00, snare: 0.45, hat: 0.35, bass: 0.35, arp: 0.95, chord: 0.70, lead: 0, solo: 0, vStab: 0.95, pad: 1.00, filter: 0.36, roll: 0, drop: 0, tomFill: 0 },
      { bars: 4, chordOff: 4, name: 'IGNITE',     energy: 0.90, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, bass: 1.00, arp: 1.00, chord: 0.95, lead: 0, solo: 0, vStab: 0.95, pad: 0.88, filter: 0.95, roll: 1, drop: 0, tomFill: 1 },
      { bars: 8, chordOff: 0, name: 'SPEED DROP', energy: 1.00, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, bass: 1.00, arp: 0.95, chord: 1.00, lead: 0, solo: 1, vStab: 1.00, pad: 0.85, filter: 1.00, roll: 0, drop: 1, tomFill: 1 }
    ],
    trackDur: 169,
    timedLyrics: [
      [6, 6, 'SYSTEM CHECK'],
      [12, 6, 'ANTI-GRAV ENGAGE'],
      [18, 3, 'ZERO GROUND'],
      [21, 3, 'ZERO DRAG'],
      ...T1_CH,
      ...T1_V1,
      ...R(72, 24, T1_CH),
      ...R(96, 24, T1_V1),
      ...R(120, 24, T1_CH.slice(0, 6)),
      [144, 6, 'OVERDRIVE'],
      [150, 6, 'ZERO GROUND'],
      [156, 6, 'ZERO DRAG'],
      [162, 7, 'CROSSING THROUGH THE FINISH LINE']
    ],
    lyrics: []
  },

  // =========================================================================
  // 02 // OVERDRIVE — Heavy Metal / Industrial Darksynth (145 BPM, E minor)
  // =========================================================================
  {
    id: 'overdrive',
    code: '02',
    name: 'OVERDRIVE',
    subtitle: 'INDUSTRIAL DARKSYNTH // 145 BPM',
    mode: 'darksynth',
    bpm: 145,
    root: 40, // E2 (baritone vocal sits in true low male register E2..E3!)
    leadOct: 0,  // deep menacing baritone industrial vocal register!
    soloOct: 12, // screaming heavy-metal lead guitar + baritone shouts on drop!
    accentColor: '#ff1e42',
    beamColor: [1.0, 0.16, 0.28],
    patch: { pump: 0.50, revSend: 0.28, delaySend: 0.20 },
    chords: [
      { b: 28, p: [0, 7, 12, 15],  a: [0, 7, 12, 15] },
      { b: 28, p: [0, 3, 7, 12],   a: [0, 3, 7, 12] },
      { b: 36, p: [-4, 0, 3, 8],   a: [8, 12, 15, 19] },
      { b: 38, p: [-2, 2, 5, 10],  a: [10, 14, 17, 22] },
      { b: 28, p: [0, 7, 12, 15],  a: [0, 7, 12, 15] },
      { b: 36, p: [-4, 0, 3, 8],   a: [8, 12, 15, 19] },
      { b: 33, p: [0, 5, 8, 12],   a: [5, 12, 15, 17] },
      { b: 35, p: [2, 7, 10, 14],  a: [7, 10, 14, 19] }
    ],
    kicks: [
      P('1000100010001000'),
      P('1000100010101000'),
      P('1000000010000000')
    ],
    snares: [
      P('0000100000001000'),
      P('0000100000001010'),
      P('0000000000001000')
    ],
    hats: [
      P('1010102010101021'),
      P('1313132113131321')
    ],
    bassPats: [
      P('0000001000000200'),
      P('0010000200101020')
    ],
    // Palm-muted heavy metal power-chord chug rhythm! (1=tight chug, 2=open roaring accent!)
    chugPat: P('2112112121112121'),
    stabPat: P('1001001000001000'),
    vStabPat: P('0000100000001010'),
    // 8-bar menacing baritone industrial vocal chant ("RED-LINE / HIGH VOL-TAGE / O-VER-DRIVE!")
    melA: [
      [0,12,4,0,'EH',2], [4,12,2,0,'AI',2], [6,15,4,0,'AH',2], [10,14,4,0,'OH',1],
      [16,12,6,0,'OH',2], [24,10,4,0,'AH',1], [28,12,4,0,'EH',2],
      [32,15,6,0,'AI',2], [38,14,2,0,'OH',1], [40,12,6,0,'AH',2],
      [48,14,6,0,'OH',2], [56,12,4,0,'EE',1], [60,10,4,0,'AH',2],
      [64,12,4,0,'OH',2], [68,15,4,0,'AI',1], [72,19,6,0,'AH',2],
      [80,20,6,0,'OH',2], [86,19,2,0,'EH',1], [88,15,6,0,'AH',2],
      [96,17,6,0,'EE',1], [104,15,4,0,'OH',2], [108,14,4,0,'AH',2],
      [112,19,10,0,'AI',2]
    ],
    // 8-bar screaming high-gain metal lead guitar + anvil industrial climax!
    solo: [
      [0,24,4,0], [4,24,2,0], [6,22,2,1], [8,19,6,2],
      [16,19,4,0], [20,22,4,1], [24,24,6,2],
      [32,20,6,0], [38,19,2,1], [40,15,6,0],
      [48,22,6,2], [56,19,4,1], [60,17,4,0],
      [64,24,4,0], [68,26,4,1], [72,27,6,2],
      [80,24,4,0], [84,20,4,1], [88,19,6,0],
      [96,20,4,0], [100,22,4,1], [104,24,6,1],
      [112,26,10,2]
    ],
    vowels: ['AH', 'OH', 'EH', 'AI'],
    sections: [
      { bars: 4, chordOff: 0, name: 'REDLINE',      energy: 0.52, drumSet: 0, kick: 1.00, snare: 0.00, hat: 0.70, bass: 0.90, chug: 0.85, stab: 0.85, lead: 0, solo: 0, vStab: 0.75, pad: 0.55, filter: 0.62, roll: 0, drop: 0, tomFill: 1, lateKick: 0 },
      { bars: 8, chordOff: 0, name: 'HIGH VOLTAGE', energy: 0.86, drumSet: 0, kick: 1.00, snare: 1.00, hat: 0.95, bass: 1.00, chug: 1.00, stab: 0.95, lead: 1, solo: 0, vStab: 0.85, pad: 0.65, filter: 0.88, roll: 0, drop: 0, tomFill: 1 },
      { bars: 4, chordOff: 0, name: 'CLEAR MIND',   energy: 0.18, drumSet: 2, kick: 0.00, snare: 0.00, hat: 0.30, bass: 0.42, chug: 0.25, stab: 0.00, lead: 0, solo: 0, vStab: 0.65, pad: 1.00, filter: 0.32, roll: 0, drop: 0, tomFill: 0 },
      { bars: 4, chordOff: 4, name: 'APEX BUILD',   energy: 0.92, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, bass: 1.00, chug: 1.00, stab: 1.00, lead: 0, solo: 0, vStab: 0.90, pad: 0.75, filter: 0.95, roll: 1, drop: 0, tomFill: 1 },
      { bars: 8, chordOff: 0, name: 'OVERDRIVE',    energy: 1.00, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, bass: 1.00, chug: 1.00, stab: 1.00, lead: 0, solo: 1, vStab: 1.00, pad: 0.80, filter: 1.00, roll: 0, drop: 1, tomFill: 1 }
    ],
    trackDur: 157,
    timedLyrics: [
      [0, 4, 'REDLINE'],
      [4, 4, 'HIT THE GAS'],
      [18, 3, 'PHOSPHOR FLICKERING ON CHROME'],
      [21, 4, 'THREE HUNDRED ON THE TACTICAL ZONE'],
      [25, 3, 'ASPHALT HUMMING IN THE DARK'],
      [28, 4, 'FUEL BURNING DOWN TO THE SPARK'],
      [32, 3, 'NO ROOM LEFT FOR MISTAKES'],
      [35, 3, 'CUTTING OFF THE STATIC AND THE BREAKS'],
      [38, 3, "I DON'T NEED YOUR TOXIC NOISE"],
      [41, 4, "I'M BREAKING FREE FROM EMPTY TOYS"],
      ...E(45, 7, [
        'HEART RATE SPIKING TO THE CEILING',
        'LOSS OF CONTROL IS A DANGEROUS FEELING',
        'HANDS ON THE WHEEL, EYES ON THE LINE',
        'STEPPING THROUGH THE SHIFT IN TIME'
      ]),
      ...E(52, 28, [
        ...T2_CH,
        'HIGH VOLTAGE, ZERO FRICTION',
        'SPEED IS THE ULTIMATE ADDICTION',
        'OVERDRIVE',
        'TAKE CONTROL'
      ]),
      ...E(90, 20, [
        'CARBON FIBER, PURE REACTION',
        'TIRES FIGHTING FOR THE TRACTION',
        'LEFT THE DRAMA IN THE DUST',
        'IRON DISCIPLINE AND TRUST',
        'ZERO NOISE, CLEAR MIND',
        'LEAVE THE WRECKAGE FAR BEHIND'
      ]),
      ...E(130, 27, [
        ...T2_CH,
        'REDLINE',
        'GRID LOCK BROKEN',
        'FULL THROTTLE',
        'OVERDRIVE'
      ])
    ],
    lyrics: []
  },

  // =========================================================================
  // 03 // TRACKER PROTOCOL — 16-Bit YM2612 Cracktro / J-Core (160 BPM, D Maj)
  // =========================================================================
  {
    id: 'tracker-protocol',
    code: '03',
    name: 'TRACKER PROTOCOL',
    subtitle: '16-BIT CRACKTRO // 160 BPM',
    mode: 'tracker',
    bpm: 160,
    root: 38, // D2 (dry 25% pulse + YM2612 slap bass; bright soprano Vocaloid chip vocals!)
    leadOct: 12,
    soloOct: 12,
    accentColor: '#ffe600',
    beamColor: [1.0, 0.90, 0.12],
    patch: { pump: 0.76, revSend: 0.12, delaySend: 0.16 },
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
    kicks: [
      P('1000100010001000'),
      P('1001001010001010'),
      P('1000000010000000')
    ],
    snares: [
      P('0000100000001000'),
      P('0000100100001011'),
      P('0000000010000000')
    ],
    hats: [
      P('1010102010101020'),
      P('1313132313131321')
    ],
    // Funky bouncing YM2612 slap + 25%-pulse octave tracker bass!
    bassPats: [
      P('0101012101010121'),
      P('0010010200101210')
    ],
    arpPats: [
      P('0123432101234321'),
      P('0213243102134321')
    ],
    // 90s Sega Arcade Orchestra/Brass stab hits!
    stabPat: P('1000001000010000'),
    // 8-bar hyper-catchy J-Core / Vocaloid chip vocal melody (with bouncy syllables!)
    melA: [
      [0,16,3,0,'EE',2], [3,19,3,0,'AH',2], [6,16,2,0,'EE',1], [8,12,4,0,'OH',2], [12,14,4,0,'AH',2],
      [16,19,3,0,'EE',2], [19,16,3,0,'OO',2], [22,14,2,0,'AH',1], [24,11,4,0,'EE',2], [28,14,4,0,'OH',2],
      [32,16,3,0,'AI',2], [35,19,3,0,'EE',1], [38,21,2,0,'AH',2], [40,24,4,0,'EE',2], [44,21,4,0,'OH',0],
      [48,19,4,0,'AH',2], [52,16,4,0,'EE',1], [56,14,6,0,'OH',2],
      [64,16,3,0,'EE',2], [67,19,3,0,'AH',2], [70,21,2,0,'EE',1], [72,24,4,0,'AI',2], [76,21,4,0,'OH',0],
      [80,23,3,0,'EE',2], [83,21,3,0,'AH',1], [86,19,2,0,'OO',2], [88,16,4,0,'EE',2], [92,19,4,0,'AH',0],
      [96,24,4,0,'AI',2], [100,21,4,0,'EE',1], [104,19,4,0,'AH',2], [108,16,4,0,'OH',0],
      [112,19,8,0,'EE',2], [120,21,4,0,'AH',1], [124,23,4,0,'EE',2]
    ],
    // 8-bar 3-part harmonized hyper-kawaii chip vocal climax!
    solo: [
      [0,24,2,0,'EE',2], [2,21,2,0,'AH',2], [4,19,2,0,'EE',1], [6,21,2,0,'OH',2], [8,24,4,0,'AI',2], [12,26,4,0,'EE',2],
      [16,23,2,0,'AH',2], [18,21,2,0,'EE',1], [20,19,2,0,'OH',2], [22,21,2,0,'AH',2], [24,23,4,0,'EE',2], [28,26,4,0,'AI',0],
      [32,28,4,0,'EE',2], [36,26,2,0,'AH',1], [38,24,2,0,'OH',2], [40,21,4,0,'EE',2], [44,19,4,0,'AH',0],
      [48,23,4,0,'AI',2], [52,21,2,0,'EE',1], [54,19,2,0,'OH',2], [56,16,6,0,'AH',2],
      [64,24,2,0,'EE',2], [66,26,2,0,'AH',2], [68,28,4,0,'AI',2], [72,26,2,0,'EE',1], [74,24,2,0,'OH',2], [76,21,4,0,'AH',0],
      [80,23,2,0,'EE',2], [82,26,2,0,'AH',1], [84,28,4,0,'EE',2], [88,26,4,0,'OH',0], [92,23,4,0,'AH',2],
      [96,24,4,0,'AI',2], [100,28,4,0,'EE',2], [104,26,4,0,'AH',1], [108,24,4,0,'OH',0],
      [112,26,8,0,'EE',2], [120,23,4,0,'AH',2], [124,21,4,0,'EE',1]
    ],
    vowels: ['EE', 'AH', 'AI', 'OH'],
    sections: [
      { bars: 4, chordOff: 0, name: 'BOOT SEQ',    energy: 0.48, drumSet: 0, kick: 0.95, snare: 0.55, hat: 0.78, bass: 0.95, arp: 1.00, stab: 0.75, lead: 0, solo: 0, pad: 0.25, filter: 0.75, roll: 0, drop: 0, tomFill: 1, lateKick: 1 },
      { bars: 8, chordOff: 0, name: 'VECTOR RUN',  energy: 0.86, drumSet: 0, kick: 1.00, snare: 1.00, hat: 0.95, bass: 1.00, arp: 1.00, stab: 0.92, lead: 1, solo: 0, pad: 0.35, filter: 0.92, roll: 0, drop: 0, tomFill: 1 },
      { bars: 4, chordOff: 0, name: 'ALIGNMENT',   energy: 0.28, drumSet: 2, kick: 0.00, snare: 0.42, hat: 0.40, bass: 0.50, arp: 1.00, stab: 0.55, lead: 0, solo: 0, pad: 0.55, filter: 0.55, roll: 0, drop: 0, tomFill: 0 },
      { bars: 4, chordOff: 4, name: 'FULL SPEED',  energy: 0.92, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, bass: 1.00, arp: 1.00, stab: 1.00, lead: 0, solo: 0, pad: 0.45, filter: 0.98, roll: 1, drop: 0, tomFill: 1 },
      { bars: 8, chordOff: 0, name: 'FRAME CLEAR', energy: 1.00, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, bass: 1.00, arp: 1.00, stab: 1.00, lead: 0, solo: 1, pad: 0.50, filter: 1.00, roll: 0, drop: 1, tomFill: 1 }
    ],
    trackDur: 170,
    timedLyrics: [
      [0, 12, 'GENERATING VECTOR FRAMES'],
      [12, 12, 'MATRIX GRID ONLINE'],
      [24, 12, 'TRACKER PROTOCOL ACTIVE'],
      [36, 6, 'RENDER THE MATRIX IN FULL SPEED'],
      [42, 6, 'RENDER THE MATRIX IN FULL SPEED'],
      [48, 12, 'PROCESSING LINES AND POINTS'],
      [60, 12, 'CALCULATING THE PIXEL DEPTH'],
      [72, 12, 'TRACKER PROTOCOL ACTIVE'],
      [84, 12, 'RENDER THE MATRIX IN FULL SPEED'],
      [96, 12, 'VECTOR MATRIX RENDERING'],
      [108, 12, 'EXECUTE THE SUB-ROUTINE'],
      [120, 12, 'TRACKER PROTOCOL ACTIVE'],
      [132, 12, 'RENDER THE MATRIX IN FULL SPEED'],
      [144, 12, 'FRAME BUFFER CLEARED'],
      [156, 14, 'MATRIX POWER DOWN']
    ],
    lyrics: []
  },

  // =========================================================================
  // 04 // VECTOR MATRIX — Liquid TB-303 Acid Techno + 90s Rave Stabs (155 BPM)
  // =========================================================================
  {
    id: 'vector-matrix',
    code: '04',
    name: 'VECTOR MATRIX',
    subtitle: 'TB-303 ACID TECHNO // 155 BPM',
    mode: 'acid',
    bpm: 155,
    root: 33, // A1 = 55 Hz
    leadOct: 24,
    soloOct: 12,
    accentColor: '#39ff14',
    beamColor: [0.22, 1.0, 0.35],
    patch: { pump: 0.46, revSend: 0.28, delaySend: 0.32 },
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
    kicks: [
      P('1000100010001000'),
      P('1000100010001010'),
      P('1000000010000000')
    ],
    snares: [
      P('0000100000001000'),
      P('0000102000001020'),
      P('0000000010000000')
    ],
    hats: [
      P('1020102010201020'),
      P('1323132313231321')
    ],
    // 90s Detroit/Wipeout Minor-9th metallic FM rave stab rhythm!
    stabPat: P('1000001000000010'),
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
      P('0123210123432123'),
      P('4321012343210234')
    ],
    // Classic 90s rave lead riff (metallic FM-organ rave lead, NOT sawtooth!)
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
    vowels: ['AH', 'EE', 'OH', 'AI'],
    sections: [
      { bars: 4, chordOff: 0, name: 'ACID BOOT',  energy: 0.46, drumSet: 0, kick: 1.00, snare: 0.55, hat: 0.85, acid: 0.90, stab: 0.70, ride: 0, lead: 0, solo: 0, chop: 0.65, pad: 0.30, filter: 0.35, roll: 0, drop: 0, tomFill: 1, lateKick: 0 },
      { bars: 8, chordOff: 0, name: 'SQUELCH',    energy: 0.84, drumSet: 0, kick: 1.00, snare: 1.00, hat: 1.00, acid: 1.00, stab: 0.92, ride: 0.55, lead: 1, solo: 0, chop: 0.90, pad: 0.35, filter: 0.72, roll: 0, drop: 0, tomFill: 1 },
      { bars: 4, chordOff: 0, name: 'RESONANCE',  energy: 0.24, drumSet: 2, kick: 0.00, snare: 0.00, hat: 0.40, acid: 1.00, stab: 0.85, ride: 0, lead: 0, solo: 0, chop: 0.95, pad: 0.65, filter: 0.55, roll: 0, drop: 0, tomFill: 0 },
      { bars: 4, chordOff: 4, name: 'ACID SURGE', energy: 0.92, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, acid: 1.00, stab: 1.00, ride: 0.80, lead: 0, solo: 0, chop: 1.00, pad: 0.45, filter: 0.94, roll: 1, drop: 0, tomFill: 1 },
      { bars: 8, chordOff: 0, name: 'VECTOR MAX', energy: 1.00, drumSet: 1, kick: 1.00, snare: 1.00, hat: 1.00, acid: 1.00, stab: 1.00, ride: 1.00, lead: 0, solo: 1, chop: 1.00, pad: 0.50, filter: 1.00, roll: 0, drop: 1, tomFill: 1 }
    ],
    trackDur: 175,
    timedLyrics: [
      [24.8, 12.2, 'ZERO FRICTION KINETIC DRIVE'],
      [37.0, 12.5, 'FEEL THE SYSTEM COME ALIVE'],
      [49.5, 6.2, 'SPEED IS RISING, FRICTION DIES'],
      [55.7, 6.2, 'CYBER POWER OPEN WIDE'],
      [61.9, 16.1, 'ZERO FRICTION, SPEED DROP'],
      [78.0, 21.1, 'NEVER SLOW DOWN, NEVER STOP'],
      [99.1, 12.4, 'KINETIC VELOCITY REACHING THE PEAK'],
      [111.5, 12.4, 'ZERO FRICTION IS THE POWER WE SEEK'],
      [123.9, 25.5, 'ZERO FRICTION, SPEED DROP'],
      [149.4, 25.6, 'NEVER SLOW DOWN, NEVER STOP']
    ],
    lyrics: []
  },

  // =========================================================================
  // 05 // ANTI-GRAV DRIFT — Lush Atmospheric Retrowave Ballad (105 BPM, F# m)
  // =========================================================================
  {
    id: 'anti-grav-drift',
    code: '05',
    name: 'ANTI-GRAV DRIFT',
    subtitle: 'ATMOSPHERIC RETROWAVE // 105 BPM',
    mode: 'retrowave',
    bpm: 105,
    root: 42, // F#2 (~45Hz sub-sine F#1=46.2Hz; lush harmonized vocals F#3..F#4!)
    leadOct: 0,
    soloOct: 0,
    accentColor: '#ff5ca8',
    beamColor: [1.0, 0.52, 0.88],
    patch: { pump: 0.34, revSend: 0.64, delaySend: 0.36 },
    chords: [
      { b: 30, p: [0, 3, 7, 12],   a: [0, 7, 12, 15] },
      { b: 38, p: [-4, 0, 3, 7],   a: [8, 12, 15, 19] },
      { b: 33, p: [3, 7, 10, 15],  a: [3, 7, 10, 15] },
      { b: 28, p: [-2, 2, 5, 10],  a: [10, 14, 17, 19] },
      { b: 30, p: [0, 3, 7, 12],   a: [0, 7, 12, 15] },
      { b: 38, p: [-4, 0, 3, 7],   a: [8, 12, 15, 19] },
      { b: 35, p: [0, 5, 8, 12],   a: [5, 12, 15, 17] },
      { b: 37, p: [2, 5, 7, 10],   a: [7, 10, 14, 19] }
    ],
    kicks: [
      P('1000100010001000'),
      P('1000100010101000'),
      P('1000000000000000')
    ],
    snares: [
      P('0000100200201002'),
      P('0020100200201020'),
      P('0000000200001000')
    ],
    hats: [
      P('1010102010101020'),
      P('1313132313131321')
    ],
    bassPats: [
      P('0---0---0---0---'),
      P('0---0---0---0-2-')
    ],
    arpPats: [
      P('0123210101234321'),
      P('2101234321012321')
    ],
    // 8-bar articulated floating vocal verse ("Float-ing in the ne-on light / Ci-ty streets be-low to-night...")
    melA: [
      [0,15,6,0,'OH',1], [6,14,2,1,'EE',0], [8,12,8,1,'AI',1],
      [16,15,6,0,'EE',1], [22,19,6,1,'OH',2], [28,15,4,1,'AI',1],
      [32,15,6,0,'AH',2], [38,17,2,1,'EE',0], [40,19,8,1,'OH',1],
      [48,14,10,1,'OO',2], [60,12,4,0,'AH',1],
      [64,15,6,0,'OO',1], [70,17,2,0,'EE',0], [72,19,8,1,'AH',2],
      [80,20,6,1,'AI',1], [86,19,2,0,'OH',0], [88,15,8,1,'EE',1],
      [96,17,6,0,'OH',2], [102,15,2,1,'AH',0], [104,12,8,1,'OO',1],
      [112,14,8,1,'EE',1], [120,15,6,1,'AI',2]
    ],
    // 8-bar soaring 3-part harmonized vocal chorus ("Drift a-way on ne-on streams / Liv-ing in fu-tu-ris-tic dreams!")
    solo: [
      [0,19,6,0,'IH',2], [6,22,4,1,'AH',1], [10,24,6,1,'EE',0],
      [16,20,6,1,'OH',1], [22,19,4,1,'EE',2], [26,15,6,0,'AH',1],
      [32,22,6,0,'EE',1], [38,24,4,1,'OO',2], [42,22,6,1,'EE',0],
      [48,19,8,1,'OH',1], [58,17,2,0,'AH',0], [60,19,4,1,'AI',2],
      [64,24,6,0,'AI',1], [70,22,4,1,'OH',2], [74,19,6,1,'EE',1],
      [80,20,6,1,'AH',0], [86,22,2,0,'EE',1], [88,24,8,1,'OH',2],
      [96,22,6,0,'AI',1], [102,20,2,1,'OH',0], [104,19,4,1,'EE',2], [108,17,4,0,'AH',1],
      [112,19,12,1,'AI',1]
    ],
    vowels: ['OO', 'AH', 'OH', 'AI'],
    sections: [
      { bars: 4, chordOff: 0, name: 'NEON LIGHT',  energy: 0.30, drumSet: 0, kick: 0.85, snare: 0.50, hat: 0.50, bass: 0.85, ep: 1.00, arp: 0.72, lead: 0, solo: 0, pad: 1.00, filter: 0.52, roll: 0, drop: 0, tomFill: 1, lateKick: 1 },
      { bars: 8, chordOff: 0, name: 'WEIGHTLESS',  energy: 0.72, drumSet: 0, kick: 1.00, snare: 1.00, hat: 0.85, bass: 1.00, ep: 0.95, arp: 0.80, lead: 1, solo: 0, pad: 1.00, filter: 0.82, roll: 0, drop: 0, tomFill: 1 },
      { bars: 4, chordOff: 0, name: 'BEYOND',      energy: 0.16, drumSet: 2, kick: 0.00, snare: 0.35, hat: 0.25, bass: 0.45, ep: 1.00, arp: 0.85, lead: 0, solo: 0, pad: 1.00, filter: 0.38, roll: 0, drop: 0, tomFill: 0 },
      { bars: 4, chordOff: 4, name: 'ASCENT',      energy: 0.80, drumSet: 1, kick: 1.00, snare: 0.95, hat: 0.90, bass: 0.95, ep: 0.90, arp: 0.90, lead: 0, solo: 0, pad: 1.00, filter: 0.92, roll: 1, drop: 0, tomFill: 1 },
      { bars: 8, chordOff: 0, name: 'NEON STREAM', energy: 0.98, drumSet: 1, kick: 1.00, snare: 1.00, hat: 0.95, bass: 1.00, ep: 0.85, arp: 0.85, lead: 0, solo: 1, pad: 1.00, filter: 1.00, roll: 0, drop: 1, tomFill: 1 }
    ],
    trackDur: 174,
    timedLyrics: [
      [0, 7.5, 'FLOATING IN THE NEON LIGHT'],
      [7.5, 7.5, 'CITY STREETS BELOW TONIGHT'],
      [15, 7.5, 'ANTI-GRAVITY TAKES CONTROL'],
      [22.5, 7.5, 'CYBER WAVES INSIDE MY SOUL'],
      [30, 7.5, 'CRUISING THROUGH THE GLOWING GRID'],
      [37.5, 7.5, 'HIGHER THAN WE EVER DID'],
      [45, 7.5, 'DRIFT AWAY ON NEON STREAMS'],
      [52.5, 7.5, 'LIVING IN FUTURISTIC DREAMS'],
      [60, 5, 'WEIGHTLESS GLIDE INTO THE DARK'],
      [65, 10, 'ELECTRIC SKY, A GLOWING SPARK'],
      ...E(75, 60, [
        'FLOATING IN THE NEON LIGHT',
        'CITY STREETS BELOW TONIGHT',
        'ANTI-GRAVITY TAKES CONTROL',
        'CYBER WAVES INSIDE MY SOUL',
        'DRIFT AWAY ON NEON STREAMS',
        'LIVING IN FUTURISTIC DREAMS'
      ]),
      ...E(135, 39, [
        'LOST IN SPACE, WE FLOAT AWAY',
        'BEYOND THE NIGHT, INTO THE DAY',
        'DRIFT AWAY ON NEON STREAMS',
        'LIVING IN FUTURISTIC DREAMS',
        'FADE INTO THE STARRY NIGHT',
        'ANTI-GRAVITY, ETERNAL LIGHT'
      ])
    ],
    lyrics: []
  },

  // =========================================================================
  // 06 // REPUBLIC GRAVITY — 2002 Electro-House Cracktro (128 BPM, A minor)
  // =========================================================================
  {
    id: 'gravity-league',
    code: '06',
    name: 'REPUBLIC GRAVITY',
    subtitle: 'ELECTRO CRACKTRO // 128 BPM',
    mode: 'cracktro',
    bpm: 128,
    root: 33, // A1
    accentColor: '#ff5a00',
    beamColor: [1.0, 0.42, 0.08],
    patch: { pump: 0.52, revSend: 0.24, delaySend: 0.22 },
    ch: [[57,60,64], [53,57,60], [60,64,67], [55,59,62]],
    pe: [69,72,74,76,79,81],
    sec: 'DDDDDDDDDDDDDDDD',
    lyrics: [
      'WELCOME TO', 'REPUBLIC', 'OF SPEED', 'NEON IN',
      'THE VEINS', 'GRAVITY', 'IS FREE', 'RELEASE',
      'THE BRAKES', 'REWRITE', 'THE TRACK', 'FASTER THAN',
      'PICTURES', 'FASTER THAN', 'SOUND', 'CRACK THE',
      'SIGNAL', 'TURN IT UP', 'GREETINGS', 'FUTURE'
    ]
  },

  // =========================================================================
  // 07 // NEON DESCENT — High-Speed Euphoric Cracktro (140 BPM, E minor)
  // =========================================================================
  {
    id: 'neon-descent',
    code: '07',
    name: 'NEON DESCENT',
    subtitle: 'EUPHORIC CRACKTRO // 140 BPM',
    mode: 'cracktro',
    bpm: 140,
    root: 40, // E2
    accentColor: '#7c4dff',
    beamColor: [0.58, 0.36, 1.0],
    patch: { pump: 0.48, revSend: 0.32, delaySend: 0.28 },
    ch: [[64,67,71], [60,64,67], [67,71,74], [62,66,69]],
    pe: [64,67,69,71,74,76],
    sec: 'iiiibbbbDDDDDDDDmmmmbbbbDDDDDDDDoooo',
    lyrics: [
      'FEEL THE', 'PRESSURE', 'RISING', 'THREE TWO',
      'ONE', 'DROP INTO', 'THE NEON', 'EVERY LIGHT',
      'A LANE', 'FASTER THAN', 'FALLING RAIN', 'HOLD YOUR',
      'BREATH', 'BEFORE THE', 'STORM', 'LOCK IN',
      'BREAK THE', 'SPEED OF', 'SOUND', 'WE ARE THE',
      'SIGNAL', 'WE ARE THE', 'FIRE'
    ]
  },

  // =========================================================================
  // 08 // GRAVITY WELL — Deep Hypnotic Slow-Burn Cracktro (112 BPM, D minor)
  // =========================================================================
  {
    id: 'gravity-well',
    code: '08',
    name: 'GRAVITY WELL',
    subtitle: 'HYPNOTIC CRACKTRO // 112 BPM',
    mode: 'cracktro',
    bpm: 112,
    root: 38, // D2
    accentColor: '#00e5a8',
    beamColor: [0.05, 0.94, 0.72],
    patch: { pump: 0.42, revSend: 0.42, delaySend: 0.32 },
    ch: [[62,65,69], [58,62,65], [65,69,72], [60,64,67]],
    pe: [62,65,67,69,72,74],
    sec: 'iiiiiiiibbbbbbbbDDDDDDDDmmmmmmmmbbbbDDDDDDDDDDDDoooo',
    lyrics: [
      'SLOW AND', 'STEADY NOW', 'THE ENGINES', 'HUM',
      'FEEL IT', 'BUILD', 'PULSE BY', 'PULSE',
      'CLIMBING', 'THROUGH THE', 'DARK', 'GRAVITY',
      'LET GO', 'FLYING LOW', 'ELECTRIC', 'GROUND',
      'DRIFTING', 'NOW', 'HEAR IT', 'RISE',
      'HOLD THE', 'LINE', 'FOREVER', 'TONIGHT'
    ]
  }
];

// Auto-populate unique 3D atlas lyric chunks for tracks with timestamped lyrics
for (const tr of TRACKS) {
  if (tr.timedLyrics) {
    const s = new Set();
    for (const e of tr.timedLyrics) for (const c of splitLyricChunks(e[2])) s.add(c);
    tr.lyrics = [...s];
  }
}
