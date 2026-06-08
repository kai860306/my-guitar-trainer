// src/utils/musicTheory.js

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const STRING_OPENS = [4, 11, 7, 2, 9, 4]; // 1弦到6弦空弦音高

// 順階級數對應的半音偏移量與調式公式 (相對於主調根音)
//
// 【資料模型設計】每個和弦字卡用一個統一結構描述，方便日後無限擴充：
//   - offset   : 和弦根音相對於主調 Key 的半音距離 (0~11)
//   - mode     : 該和弦對應的 7 音調式音階 (相對於「和弦根音」)，
//                決定指板上哪些音會亮起、自訂音序器的調式映射、以及音程著色
//   - family   : 'major' | 'minor' | 'dim' | 'dom'，用來判斷大/小調體系與階梯模式取音
//   - label    : 顯示用的和弦性質文字 (maj / m / 7 / m7 / m7♭5 / dim7 ...)
//   - modeName : 顯示用的調式名稱 (Ionian / Dorian ...)
//
// 想新增字卡時，只要在對應的分類區塊加一筆即可，三大引擎 (指板/音訊/爬音) 會自動支援。
export const CHORD_MODES = {
  // ===== 順階三和弦 (大小調基礎) =====
  'I':    { offset: 0,  mode: [0, 2, 4, 5, 7, 9, 11], family: 'major', label: 'maj', modeName: 'Ionian' },
  'ii':   { offset: 2,  mode: [0, 2, 3, 5, 7, 9, 10], family: 'minor', label: 'm',   modeName: 'Dorian' },
  'iii':  { offset: 4,  mode: [0, 1, 3, 5, 7, 8, 10], family: 'minor', label: 'm',   modeName: 'Phrygian' },
  'IV':   { offset: 5,  mode: [0, 2, 4, 6, 7, 9, 11], family: 'major', label: 'maj', modeName: 'Lydian' },
  'V':    { offset: 7,  mode: [0, 2, 4, 5, 7, 9, 10], family: 'major', label: 'maj', modeName: 'Mixolydian' },
  'vi':   { offset: 9,  mode: [0, 2, 3, 5, 7, 8, 10], family: 'minor', label: 'm',   modeName: 'Aeolian' },
  'vii°': { offset: 11, mode: [0, 1, 3, 5, 6, 8, 10], family: 'dim',   label: 'dim', modeName: 'Locrian' },

  // ===== 順階七和弦 (七度色彩，搭配三和弦使用) =====
  'IM7':     { offset: 0,  mode: [0, 2, 4, 5, 7, 9, 11], family: 'major', label: 'maj7', modeName: 'Ionian' },
  'iim7':    { offset: 2,  mode: [0, 2, 3, 5, 7, 9, 10], family: 'minor', label: 'm7',   modeName: 'Dorian' },
  'iiim7':   { offset: 4,  mode: [0, 1, 3, 5, 7, 8, 10], family: 'minor', label: 'm7',   modeName: 'Phrygian' },
  'IVM7':    { offset: 5,  mode: [0, 2, 4, 6, 7, 9, 11], family: 'major', label: 'maj7', modeName: 'Lydian' },
  'V7':      { offset: 7,  mode: [0, 2, 4, 5, 7, 9, 10], family: 'dom',   label: '7',    modeName: 'Mixolydian' },
  'vim7':    { offset: 9,  mode: [0, 2, 3, 5, 7, 8, 10], family: 'minor', label: 'm7',   modeName: 'Aeolian' },
  'viim7b5': { offset: 11, mode: [0, 1, 3, 5, 6, 8, 10], family: 'dim',   label: 'm7♭5', modeName: 'Locrian' },

  // ===== 調外 / 借用和弦 (Modal Interchange，根音在調外) =====
  'bIII': { offset: 3,  mode: [0, 2, 4, 5, 7, 9, 11],    family: 'major', label: 'maj',  modeName: 'Ionian (♭III)' },
  'bVI':  { offset: 8,  mode: [0, 2, 4, 5, 7, 9, 11],    family: 'major', label: 'maj',  modeName: 'Ionian (♭VI)' },
  'bVII': { offset: 10, mode: [0, 2, 4, 5, 7, 9, 10],    family: 'dom',   label: '7',    modeName: 'Mixolydian (♭VII)' },
  'vii°7':{ offset: 11, mode: [0, 2, 3, 5, 6, 8, 9, 11], family: 'dim',   label: 'dim7', modeName: 'Diminished' }
};

// 音程名稱與半音數的對照表。
// CAGED_SCALE 與 CAGED_CHORD_VOICINGS 都共用這份表。
export const INTERVAL_TO_SEMITONE = {
  '1': 0,
  'b2': 1,
  '2': 2,
  'b3': 3,
  '3': 4,
  '4': 5,
  '#4': 6,
  'b5': 6,
  '5': 7,
  '#5': 8,
  'b6': 8,
  '6': 9,
  'b7': 10,
  '7': 11
};

// 將目前 CHORD_MODES 的 label 轉成 voicing library 使用的性質 key。
export const CHORD_LABEL_TO_QUALITY = {
  'maj': 'maj',
  'm': 'min',
  'maj7': 'maj7',
  'm7': 'm7',
  '7': 'dom7',
  'm7♭5': 'm7b5',
  'dim': 'dim',
  'dim7': 'dim7'
};

// 和弦實戰フォーム定義。
// string 使用吉他手習慣的弦號：1=最細弦，6=最粗弦。
// offset 是「目前 CAGED form 的 rootFret」加減幾格；因此可直接轉調。
// interval 是該音從和弦根音看的功能音。若要增加按法，只要在對應 quality/form 陣列追加一筆。
export const CAGED_CHORD_VOICINGS = {
  maj: {
    C: [
      { id: 'maj-C-full', name: 'C form major 完整三和弦', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: -1, interval: '3' },
        { string: 3, offset: -3, interval: '5' },
        { string: 2, offset: -2, interval: '1' },
        { string: 1, offset: -3, interval: '3' }
      ]}
    ],
    A: [
      { id: 'maj-A-full', name: 'A form major 完整三和弦', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 2, interval: '5' },
        { string: 3, offset: 2, interval: '1' },
        { string: 2, offset: 2, interval: '3' },
        { string: 1, offset: 0, interval: '5' }
      ]}
    ],
    G: [
      { id: 'maj-G-full', name: 'G form major 完整三和弦', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: -1, interval: '3' },
        { string: 4, offset: -3, interval: '5' },
        { string: 3, offset: -3, interval: '1' },
        { string: 2, offset: -3, interval: '3' },
        { string: 1, offset: 0, interval: '1' }
      ]}
    ],
    E: [
      { id: 'maj-E-full', name: 'E form major 完整三和弦', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: 2, interval: '5' },
        { string: 4, offset: 2, interval: '1' },
        { string: 3, offset: 1, interval: '3' },
        { string: 2, offset: 0, interval: '5' },
        { string: 1, offset: 0, interval: '1' }
      ]}
    ],
    D: [
      { id: 'maj-D-full', name: 'D form major 完整三和弦', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: '1' },
        { string: 3, offset: 2, interval: '5' },
        { string: 2, offset: 3, interval: '1' },
        { string: 1, offset: 2, interval: '3' }
      ]}
    ]
  },

  min: {
    C: [
      { id: 'min-C-compact', name: 'C form minor 省略高音弦', tags: ['compact'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: -2, interval: 'b3' },
        { string: 3, offset: -3, interval: '5' },
        { string: 2, offset: -2, interval: '1' },
        { string: 1, mute: true }
      ]}
    ],
    A: [
      { id: 'min-A-full', name: 'A form minor 完整三和弦', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 2, interval: '5' },
        { string: 3, offset: 2, interval: '1' },
        { string: 2, offset: 1, interval: 'b3' },
        { string: 1, offset: 0, interval: '5' }
      ]}
    ],
    G: [
      { id: 'min-G-full', name: 'G form minor 完整三和弦', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: -2, interval: 'b3' },
        { string: 4, offset: -3, interval: '5' },
        { string: 3, offset: -3, interval: '1' },
        { string: 2, offset: 0, interval: '5' },
        { string: 1, offset: 0, interval: '1' }
      ]}
    ],
    E: [
      { id: 'min-E-full', name: 'E form minor 完整三和弦', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: 2, interval: '5' },
        { string: 4, offset: 2, interval: '1' },
        { string: 3, offset: 0, interval: 'b3' },
        { string: 2, offset: 0, interval: '5' },
        { string: 1, offset: 0, interval: '1' }
      ]}
    ],
    D: [
      { id: 'min-D-full', name: 'D form minor 完整三和弦', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: '1' },
        { string: 3, offset: 2, interval: '5' },
        { string: 2, offset: 3, interval: '1' },
        { string: 1, offset: 1, interval: 'b3' }
      ]}
    ]
  },

  maj7: {
    C: [
      { id: 'maj7-C-full', name: 'C form maj7 含 5 度', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: -1, interval: '3' },
        { string: 3, offset: -3, interval: '5' },
        { string: 2, offset: -3, interval: '7' },
        { string: 1, offset: -3, interval: '3' }
      ]},
      { id: 'maj7-C-omit5', name: 'C form maj7 省略 5 度', tags: ['omit5', 'compact'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: -1, interval: '3' },
        { string: 3, mute: true },
        { string: 2, offset: -3, interval: '7' },
        { string: 1, offset: -3, interval: '3' }
      ]}
    ],
    A: [
      { id: 'maj7-A-full', name: 'A form maj7 含 5 度', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 2, interval: '5' },
        { string: 3, offset: 1, interval: '7' },
        { string: 2, offset: 2, interval: '3' },
        { string: 1, offset: 0, interval: '5' }
      ]}
    ],
    G: [
      { id: 'maj7-G-compact', name: 'G form maj7 精簡按法', tags: ['compact'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, mute: true },
        { string: 4, offset: 1, interval: '7' },
        { string: 3, offset: 1, interval: '3' },
        { string: 2, offset: 0, interval: '5' },
        { string: 1, offset: -1, interval: '7' }
      ]}
    ],
    E: [
      { id: 'maj7-E-full', name: 'E form maj7 含 5 度', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: 2, interval: '5' },
        { string: 4, offset: 1, interval: '7' },
        { string: 3, offset: 1, interval: '3' },
        { string: 2, offset: 0, interval: '5' },
        { string: 1, offset: 0, interval: '1' }
      ]},
      { id: 'maj7-E-omit5', name: 'E form maj7 省略 5 度', tags: ['omit5', 'compact'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, mute: true },
        { string: 4, offset: 1, interval: '7' },
        { string: 3, offset: 1, interval: '3' },
        { string: 2, mute: true },
        { string: 1, offset: 0, interval: '1' }
      ]}
    ],
    D: [
      { id: 'maj7-D-full', name: 'D form maj7 含 5 度', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: '1' },
        { string: 3, offset: 2, interval: '5' },
        { string: 2, offset: 2, interval: '7' },
        { string: 1, offset: 2, interval: '3' }
      ]}
    ]
  },

  dom7: {
    C: [
      { id: 'dom7-C-full', name: 'C form 7 含 5 度', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: -1, interval: '3' },
        { string: 3, offset: 0, interval: 'b7' },
        { string: 2, offset: -2, interval: '1' },
        { string: 1, offset: -3, interval: '3' }
      ]}
    ],
    A: [
      { id: 'dom7-A-full', name: 'A form 7 含 5 度', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 2, interval: '5' },
        { string: 3, offset: 0, interval: 'b7' },
        { string: 2, offset: 2, interval: '3' },
        { string: 1, offset: 0, interval: '5' }
      ]}
    ],
    G: [
      { id: 'dom7-G-full', name: 'G form 7 含 5 度', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: -1, interval: '3' },
        { string: 4, offset: -3, interval: '5' },
        { string: 3, offset: -3, interval: '1' },
        { string: 2, offset: -3, interval: '3' },
        { string: 1, offset: -2, interval: 'b7' }
      ]}
    ],
    E: [
      { id: 'dom7-E-full', name: 'E form 7 含 5 度', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: 2, interval: '5' },
        { string: 4, offset: 0, interval: 'b7' },
        { string: 3, offset: 1, interval: '3' },
        { string: 2, offset: 0, interval: '5' },
        { string: 1, offset: 0, interval: '1' }
      ]},
      { id: 'dom7-E-shell', name: 'E form 7 省略 5 度 shell', tags: ['omit5', 'shell'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: 'b7' },
        { string: 3, offset: 1, interval: '3' },
        { string: 2, mute: true },
        { string: 1, mute: true }
      ]}
    ],
    D: [
      { id: 'dom7-D-full', name: 'D form 7 含 5 度', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: '1' },
        { string: 3, offset: 2, interval: '5' },
        { string: 2, offset: 1, interval: 'b7' },
        { string: 1, offset: 2, interval: '3' }
      ]}
    ]
  },

  m7: {
    C: [
      { id: 'm7-C-full', name: 'C form m7 含 5 度', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: -2, interval: 'b3' },
        { string: 3, offset: 0, interval: 'b7' },
        { string: 2, offset: -2, interval: '1' },
        { string: 1, mute: true }
      ]}
    ],
    A: [
      { id: 'm7-A-full', name: 'A form m7 含 5 度', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 2, interval: '5' },
        { string: 3, offset: 0, interval: 'b7' },
        { string: 2, offset: 1, interval: 'b3' },
        { string: 1, offset: 0, interval: '5' }
      ]}
    ],
    G: [
      { id: 'm7-G-full', name: 'G form m7 含 5 度', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: 'b7' },
        { string: 3, offset: 0, interval: 'b3' },
        { string: 2, offset: 0, interval: '5' },
        { string: 1, offset: 0, interval: '1' }
      ]}
    ],
    E: [
      { id: 'm7-E-full', name: 'E form m7 含 5 度', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: 2, interval: '5' },
        { string: 4, offset: 0, interval: 'b7' },
        { string: 3, offset: 0, interval: 'b3' },
        { string: 2, offset: 0, interval: '5' },
        { string: 1, offset: 0, interval: '1' }
      ]},
      { id: 'm7-E-shell', name: 'E form m7 省略 5 度 shell', tags: ['omit5', 'shell'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: 'b7' },
        { string: 3, offset: 0, interval: 'b3' },
        { string: 2, mute: true },
        { string: 1, mute: true }
      ]}
    ],
    D: [
      { id: 'm7-D-full', name: 'D form m7 含 5 度', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: '1' },
        { string: 3, offset: 2, interval: '5' },
        { string: 2, offset: 1, interval: 'b7' },
        { string: 1, offset: 1, interval: 'b3' }
      ]}
    ]
  },

  m7b5: {
    C: [
      { id: 'm7b5-C-full', name: 'C form m7b5 含 b5', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 1, interval: 'b5' },
        { string: 3, offset: 0, interval: 'b7' },
        { string: 2, offset: 1, interval: 'b3' },
        { string: 1, mute: true }
      ]}
    ],
    A: [
      { id: 'm7b5-A-full', name: 'A form m7b5 含 b5', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 1, interval: 'b5' },
        { string: 3, offset: 0, interval: 'b7' },
        { string: 2, offset: 1, interval: 'b3' },
        { string: 1, mute: true }
      ]}
    ],
    G: [
      { id: 'm7b5-G-compact', name: 'G form m7b5 精簡按法', tags: ['compact'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: 'b7' },
        { string: 3, offset: 0, interval: 'b3' },
        { string: 2, offset: -1, interval: 'b5' },
        { string: 1, mute: true }
      ]}
    ],
    E: [
      { id: 'm7b5-E-compact', name: 'E form m7b5 精簡按法', tags: ['compact'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: 1, interval: 'b5' },
        { string: 4, offset: 0, interval: 'b7' },
        { string: 3, offset: 0, interval: 'b3' },
        { string: 2, mute: true },
        { string: 1, mute: true }
      ]}
    ],
    D: [
      { id: 'm7b5-D-full', name: 'D form m7b5 含 b5', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: '1' },
        { string: 3, offset: 1, interval: 'b5' },
        { string: 2, offset: 1, interval: 'b7' },
        { string: 1, offset: 1, interval: 'b3' }
      ]}
    ]
  },

  dim: {
    C: [
      { id: 'dim-C-triad', name: 'C form dim 三和弦', tags: ['compact'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 1, interval: 'b5' },
        { string: 3, mute: true },
        { string: 2, offset: 1, interval: 'b3' },
        { string: 1, mute: true }
      ]}
    ],
    A: [
      { id: 'dim-A-triad', name: 'A form dim 三和弦', tags: ['compact'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 1, interval: 'b5' },
        { string: 3, offset: 2, interval: '1' },
        { string: 2, offset: 1, interval: 'b3' },
        { string: 1, mute: true }
      ]}
    ],
    G: [
      { id: 'dim-G-triad', name: 'G form dim 三和弦', tags: ['compact'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: -2, interval: 'b3' },
        { string: 4, mute: true },
        { string: 3, mute: true },
        { string: 2, offset: -1, interval: 'b5' },
        { string: 1, offset: 0, interval: '1' }
      ]}
    ],
    E: [
      { id: 'dim-E-triad', name: 'E form dim 三和弦', tags: ['compact'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: 1, interval: 'b5' },
        { string: 4, mute: true },
        { string: 3, offset: 0, interval: 'b3' },
        { string: 2, mute: true },
        { string: 1, offset: 0, interval: '1' }
      ]}
    ],
    D: [
      { id: 'dim-D-triad', name: 'D form dim 三和弦', tags: ['compact'], strings: [
        { string: 6, mute: true },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: '1' },
        { string: 3, offset: 1, interval: 'b5' },
        { string: 2, mute: true },
        { string: 1, offset: 1, interval: 'b3' }
      ]}
    ]
  }
};

// dim7 先沿用 diminished triad。日後若要加入完整減七音，只要新增 dim7 專屬按法即可。
CAGED_CHORD_VOICINGS.dim7 = CAGED_CHORD_VOICINGS.dim;

export function getChordQualityKey(chordDegreeStr) {
  const chordConfig = CHORD_MODES[chordDegreeStr];
  if (!chordConfig) return null;
  return CHORD_LABEL_TO_QUALITY[chordConfig.label] || null;
}

/**
 * 將資料定義式 CAGED 和弦フォーム轉成指板與音訊引擎共用的 note object。
 */
export function resolveCagedChordVoicing(keyRoot, chordDegreeStr, formObj, options = {}) {
  const chordConfig = CHORD_MODES[chordDegreeStr];
  if (!chordConfig || !formObj) return [];

  const qualityKey = options.qualityKey || getChordQualityKey(chordDegreeStr);
  const variants = CAGED_CHORD_VOICINGS[qualityKey]?.[formObj.name] || [];
  if (variants.length === 0) return [];

  const preferredTags = options.preferredTags || [];
  const variantId = options.variantId || null;
  const selectedVariant =
    (variantId ? variants.find(v => v.id === variantId) : null) ||
    (preferredTags.length > 0 ? variants.find(v => preferredTags.every(tag => v.tags?.includes(tag))) : null) ||
    variants[0];

  const chordRootAbs = (keyRoot + chordConfig.offset) % 12;
  const rootFret = getRootFret(formObj);
  const stringPitches = [64, 59, 55, 50, 45, 40];

  return selectedVariant.strings
    .filter(item => !item.mute)
    .map(item => {
      // item.string: 1=最細弦, 6=最粗弦。內部 stringIndex 也是 0=1弦, 5=6弦。
      const stringIndex = item.string - 1;
      const fret = rootFret + item.offset;
      const intervalFromChordRoot = INTERVAL_TO_SEMITONE[item.interval];
      const absoluteNote = (STRING_OPENS[stringIndex] + fret + 120) % 12;
      const expectedAbsoluteNote = (chordRootAbs + intervalFromChordRoot) % 12;

      return {
        stringIndex,
        string: item.string,
        fret,
        absoluteNote,
        interval: item.interval,
        intervalFromChordRoot,
        pitchScore: stringPitches[stringIndex] + fret,
        voicingId: selectedVariant.id,
        voicingName: selectedVariant.name,
        isValidVoicingNote: absoluteNote === expectedAbsoluteNote
      };
    })
    .filter(note => note.fret >= 0 && note.fret <= 17);
}

export function getRootFret(formObj) {
  if (!formObj) return 0;
  if (formObj.name === 'C') return formObj.min + 3;
  if (formObj.name === 'A') return formObj.min;
  if (formObj.name === 'G') return formObj.min + 3;
  if (formObj.name === 'E') return formObj.min;
  if (formObj.name === 'D') return formObj.min + 1;
  return 0;
}

export const PROGRESSION_PRESETS = {
  'I - IV - V': ['I', 'IV', 'V'],
  'ii - V - I': ['ii', 'V', 'I'],
  'vi - IV - I - V': ['vi', 'IV', 'I', 'V'],
  'I - vi - ii - V': ['I', 'vi', 'ii', 'V']
};

/**
 * 計算單一琴格的基礎樂理資訊
 */
export function calculateNote(stringIndex, fret, keyRoot) {
  const openNote = STRING_OPENS[stringIndex];
  const absoluteNote = (openNote + fret) % 12;
  const isKeyRoot = absoluteNote === keyRoot;
  const intervalFromKeyRoot = (absoluteNote - keyRoot + 12) % 12;
  const isInScale = [0, 2, 4, 5, 7, 9, 11].includes(intervalFromKeyRoot);

  return {
    noteName: NOTE_NAMES[absoluteNote],
    absoluteNote,
    isKeyRoot,
    isInScale
  };
}

/**
 * 【高階調式自動映射】將使用者輸入的相對音程代號（如 L5, 1, 3）轉化為絕對音高數值
 */
export function getAbsoluteNoteFromToken(keyRoot, chordDegreeStr, token) {
  const chordConfig = CHORD_MODES[chordDegreeStr];
  if (!chordConfig) return null;

  const chordRootAbs = (keyRoot + chordConfig.offset) % 12;
  
  let isLow = token.startsWith('L');
  let degreeNum = parseInt(isLow ? token.substring(1) : token, 10);
  
  // 將度數 1-7 映射到調式陣列索引 0-6
  let modeIndex = (degreeNum - 1) % 7;
  let semitoneOffset = chordConfig.mode[modeIndex];
  
  if (isLow) {
    semitoneOffset -= 12; // 低音降八度
  }
  
  return (chordRootAbs + semitoneOffset + 24) % 12;
}

/**
 * 取得特定根音所有可能的 CAGED 把位邊界 (0~17格)
 */
export function getAllFormsForRoot(rootAbs) {
  let f_6 = (rootAbs - 4 + 12) % 12;
  let f_5 = (rootAbs - 9 + 12) % 12;
  let f_4 = (rootAbs - 2 + 12) % 12;

  const forms = [];
  const addForm = (name, baseMin, baseMax) => {
    // 建立包含跨八度的多個可能區間
    [baseMin, baseMin + 12, baseMin - 12].forEach((minFret, i) => {
      const maxFret = [baseMax, baseMax + 12, baseMax - 12][i];
      const rFret = getRootFret({ name, min: minFret });
      if (minFret >= 0 && maxFret <= 15 && rFret <= 14) {
        forms.push({ name, min: minFret, max: maxFret, center: (minFret + maxFret) / 2 });
      }
    });
  };

  // 定義各指型相對於弦上根音的合理音階延伸範圍
  addForm('C', f_5 - 3, f_5 + 1);
  addForm('A', f_5, f_5 + 3);
  addForm('G', f_6 - 3, f_6 + 1);
  addForm('E', f_6, f_6 + 3);
  addForm('D', f_4 - 1, f_4 + 3);

  // 依照指板中心點由低至高排序
  return forms.sort((a, b) => a.center - b.center);
}

/**
 * 根據當前和弦、主調與循環次數，動態計算該使用的 CAGED 把位
 */
export function getDynamicCagedForm(chordDegreeStr, keyRoot, cycle) {
  const chordConfig = CHORD_MODES[chordDegreeStr];
  if (!chordConfig) return null;
  const chordRootAbs = (keyRoot + chordConfig.offset) % 12;

  const forms = getAllFormsForRoot(chordRootAbs);
  if (forms.length === 0) return null;

  // 尋找 cycle 0 基礎把位 (最靠近 0~4 格，中心點大約是 2)
  let baseIndex = 0;
  let minDiff = Infinity;
  for (let i = 0; i < forms.length; i++) {
    const diff = Math.abs(forms[i].center - 2);
    if (diff < minDiff) {
      minDiff = diff;
      baseIndex = i;
    }
  }

  // 隨著 cycle 往高把位推進
  const targetIndex = (baseIndex + cycle) % forms.length;
  return forms[targetIndex];
}

/**
 * 【顯示映射】將半音程距離轉換為對應的文字音程。
 * 注意：Train Phase 的 CAGED_SCALE 會優先使用 note.interval，
 * 這個函式主要留給舊 UI 與 custom mode 使用。
 */
export function getIntervalName(interval, chordDegreeStr) {
  if (interval === 0) return '1';

  const chordConfig = CHORD_MODES[chordDegreeStr];
  const modeName = chordConfig?.modeName || '';

  const isLydian = modeName.includes('Lydian');
  const isFlatSixMode =
    modeName.includes('Aeolian') ||
    modeName.includes('Phrygian') ||
    modeName.includes('Locrian');

  const mapping = {
    1: '♭2',
    2: '2',
    3: '♭3',
    4: '3',
    5: '4',
    6: isLydian ? '♯4' : '♭5',
    7: '5',
    8: isFlatSixMode ? '♭6' : '♯5',
    9: '6',
    10: '♭7',
    11: '7'
  };

  return mapping[interval] || '';
}

/**
 * 取得和弦的基礎組成音高 (Root, 5th, 8va, 10th)，用於 PREP 階段的刷扣合成
 */
export function getChordPitches(keyRoot, chordDegreeStr) {
  const chordConfig = CHORD_MODES[chordDegreeStr];
  const chordRootAbs = (keyRoot + chordConfig.offset) % 12;
  const isMinor = chordConfig.family === 'minor';
  
  // 建立大約在 C3 (130Hz) 附近的和弦配置 (Root, 5th, Octave, 3rd)
  // 基底 A2 = 110Hz。C3 = A2 + 3 個半音
  return [
    110 * Math.pow(2, (chordRootAbs + 3) / 12),
    110 * Math.pow(2, (chordRootAbs + 3 + 7) / 12),
    110 * Math.pow(2, (chordRootAbs + 3 + 12) / 12),
    110 * Math.pow(2, (chordRootAbs + 3 + 12 + (isMinor ? 3 : 4)) / 12)
  ];
}