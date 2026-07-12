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
  // ===== 順階三和弦（大調基礎） =====
  'I':    { offset: 0,  mode: [0, 2, 4, 5, 7, 9, 11], family: 'major', label: 'maj', modeName: 'Ionian' },
  'ii':   { offset: 2,  mode: [0, 2, 3, 5, 7, 9, 10], family: 'minor', label: 'm',   modeName: 'Dorian' },
  'iii':  { offset: 4,  mode: [0, 1, 3, 5, 7, 8, 10], family: 'minor', label: 'm',   modeName: 'Phrygian' },
  'IV':   { offset: 5,  mode: [0, 2, 4, 6, 7, 9, 11], family: 'major', label: 'maj', modeName: 'Lydian' },
  'V':    { offset: 7,  mode: [0, 2, 4, 5, 7, 9, 10], family: 'major', label: 'maj', modeName: 'Mixolydian' },
  'vi':   { offset: 9,  mode: [0, 2, 3, 5, 7, 8, 10], family: 'minor', label: 'm',   modeName: 'Aeolian' },
  'vii°': { offset: 11, mode: [0, 1, 3, 5, 6, 8, 10], family: 'dim',   label: 'dim', modeName: 'Locrian' },

  // ===== 順階七和弦（大調基礎） =====
  'IM7':     { offset: 0,  mode: [0, 2, 4, 5, 7, 9, 11], family: 'major', label: 'maj7', modeName: 'Ionian' },
  'iim7':    { offset: 2,  mode: [0, 2, 3, 5, 7, 9, 10], family: 'minor', label: 'm7',   modeName: 'Dorian' },
  'iiim7':   { offset: 4,  mode: [0, 1, 3, 5, 7, 8, 10], family: 'minor', label: 'm7',   modeName: 'Phrygian' },
  'IVM7':    { offset: 5,  mode: [0, 2, 4, 6, 7, 9, 11], family: 'major', label: 'maj7', modeName: 'Lydian' },
  'V7':      { offset: 7,  mode: [0, 2, 4, 5, 7, 9, 10], family: 'dom',   label: '7',    modeName: 'Mixolydian' },
  'vim7':    { offset: 9,  mode: [0, 2, 3, 5, 7, 8, 10], family: 'minor', label: 'm7',   modeName: 'Aeolian' },
  'viim7b5': { offset: 11, mode: [0, 1, 3, 5, 6, 8, 10], family: 'dim',   label: 'm7♭5', modeName: 'Locrian' },

  // ===== 同主調三和弦（以 C 大調為例，就是 C 小調自然音階的三和弦） =====
  'i':    { offset: 0,  mode: [0, 2, 3, 5, 7, 8, 10], family: 'minor', label: 'm',   modeName: 'Aeolian (同主調 i)' },
  'ii°':  { offset: 2,  mode: [0, 1, 3, 5, 6, 8, 10], family: 'dim',   label: 'dim', modeName: 'Locrian (同主調 ii°)' },
  'bIII': { offset: 3,  mode: [0, 2, 4, 5, 7, 9, 11], family: 'major', label: 'maj', modeName: 'Ionian (同主調 ♭III)' },
  'iv':   { offset: 5,  mode: [0, 2, 3, 5, 7, 9, 10], family: 'minor', label: 'm',   modeName: 'Dorian (同主調 iv)' },
  'v':    { offset: 7,  mode: [0, 1, 3, 5, 7, 8, 10], family: 'minor', label: 'm',   modeName: 'Phrygian (同主調 v)' },
  'bVI':  { offset: 8,  mode: [0, 2, 4, 6, 7, 9, 11], family: 'major', label: 'maj', modeName: 'Lydian (同主調 ♭VI)' },
  'bVII': { offset: 10, mode: [0, 2, 4, 5, 7, 9, 10], family: 'major', label: 'maj', modeName: 'Mixolydian (同主調 ♭VII)' },

  // ===== 同主調七和弦（同主調自然小調的四和音） =====
  'im7':     { offset: 0,  mode: [0, 2, 3, 5, 7, 8, 10], family: 'minor', label: 'm7',   modeName: 'Aeolian (同主調 im7)' },
  'iim7b5':  { offset: 2,  mode: [0, 1, 3, 5, 6, 8, 10], family: 'dim',   label: 'm7♭5', modeName: 'Locrian (同主調 iim7♭5)' },
  'bIIIM7':  { offset: 3,  mode: [0, 2, 4, 5, 7, 9, 11], family: 'major', label: 'maj7', modeName: 'Ionian (同主調 ♭IIIM7)' },
  'ivm7':    { offset: 5,  mode: [0, 2, 3, 5, 7, 9, 10], family: 'minor', label: 'm7',   modeName: 'Dorian (同主調 ivm7)' },
  'vm7':     { offset: 7,  mode: [0, 1, 3, 5, 7, 8, 10], family: 'minor', label: 'm7',   modeName: 'Phrygian (同主調 vm7)' },
  'bVIM7':   { offset: 8,  mode: [0, 2, 4, 6, 7, 9, 11], family: 'major', label: 'maj7', modeName: 'Lydian (同主調 ♭VIM7)' },
  'bVII7':   { offset: 10, mode: [0, 2, 4, 5, 7, 9, 10], family: 'dom',   label: '7',    modeName: 'Mixolydian (同主調 ♭VII7)' },

  // ===== 副屬七和弦（Secondary Dominant） =====
  // 以 C 大調為例：V7/ii = A7，V7/V = D7。
  'V7/ii':  { offset: 9,  mode: [0, 2, 4, 5, 7, 9, 10], family: 'dom', label: '7', modeName: 'Mixolydian (副屬七 V7/ii)' },
  'V7/iii': { offset: 11, mode: [0, 2, 4, 5, 7, 9, 10], family: 'dom', label: '7', modeName: 'Mixolydian (副屬七 V7/iii)' },
  'V7/IV':  { offset: 0,  mode: [0, 2, 4, 5, 7, 9, 10], family: 'dom', label: '7', modeName: 'Mixolydian (副屬七 V7/IV)' },
  'V7/V':   { offset: 2,  mode: [0, 2, 4, 5, 7, 9, 10], family: 'dom', label: '7', modeName: 'Mixolydian (副屬七 V7/V)' },
  'V7/vi':  { offset: 4,  mode: [0, 2, 4, 5, 7, 9, 10], family: 'dom', label: '7', modeName: 'Mixolydian (副屬七 V7/vi)' },

  // ===== 關聯 II（Related II） =====
  // 目標是小調系和弦時，關聯 II 使用半減七 m7♭5。
  // 例如 C 大調：IIm7b5/ii = Em7♭5 -> V7/ii = A7 -> ii = Dm。
  // 目標是大調系和弦時，關聯 II 使用一般 m7。
  // 例如 C 大調：IIm7/V = Am7 -> V7/V = D7 -> V = G。
  'IIm7b5/ii':  { offset: 4,  mode: [0, 1, 3, 5, 6, 8, 10], family: 'dim',   label: 'm7♭5', modeName: 'Locrian (關聯 IIm7♭5/ii)' },
  'IIm7b5/iii': { offset: 6,  mode: [0, 1, 3, 5, 6, 8, 10], family: 'dim',   label: 'm7♭5', modeName: 'Locrian (關聯 IIm7♭5/iii)' },
  'IIm7/IV':    { offset: 7,  mode: [0, 2, 3, 5, 7, 9, 10], family: 'minor', label: 'm7',   modeName: 'Dorian (關聯 IIm7/IV)' },
  'IIm7/V':     { offset: 9,  mode: [0, 2, 3, 5, 7, 9, 10], family: 'minor', label: 'm7',   modeName: 'Dorian (關聯 IIm7/V)' },
  'IIm7b5/vi':  { offset: 11, mode: [0, 1, 3, 5, 6, 8, 10], family: 'dim',   label: 'm7♭5', modeName: 'Locrian (關聯 IIm7♭5/vi)' },

  // ===== 裏和弦（SubV7 / Tritone Substitute） =====
  // 這裡用 Mixolydian 處理，讓既有 CAGED 音階資料可以直接運作。
  'SubV7/I':   { offset: 1,  mode: [0, 2, 4, 5, 7, 9, 10], family: 'dom', label: '7', modeName: 'Mixolydian (裏和弦 SubV7/I)' },
  'SubV7/ii':  { offset: 3,  mode: [0, 2, 4, 5, 7, 9, 10], family: 'dom', label: '7', modeName: 'Mixolydian (裏和弦 SubV7/ii)' },
  'SubV7/iii': { offset: 5,  mode: [0, 2, 4, 5, 7, 9, 10], family: 'dom', label: '7', modeName: 'Mixolydian (裏和弦 SubV7/iii)' },
  'SubV7/IV':  { offset: 6,  mode: [0, 2, 4, 5, 7, 9, 10], family: 'dom', label: '7', modeName: 'Mixolydian (裏和弦 SubV7/IV)' },
  'SubV7/V':   { offset: 8,  mode: [0, 2, 4, 5, 7, 9, 10], family: 'dom', label: '7', modeName: 'Mixolydian (裏和弦 SubV7/V)' },
  'SubV7/vi':  { offset: 10, mode: [0, 2, 4, 5, 7, 9, 10], family: 'dom', label: '7', modeName: 'Mixolydian (裏和弦 SubV7/vi)' }
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

// 和弦實戰 form 定義。
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

  // 7th 和弦：每個 CAGED 型固定一個按法（依使用者提供的指板圖）。
  // 已移除省略 / shell 等替代 voicing；每個 form 只有單一 voicing。
  maj7: {
    C: [
      { id: 'maj7-C', name: 'maj7 C 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: -1, interval: '3' },
        { string: 3, offset: -3, interval: '5' },
        { string: 2, offset: -3, interval: '7' },
        { string: 1, offset: -3, interval: '3' }
      ]}
    ],
    A: [
      { id: 'maj7-A', name: 'maj7 A 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 2, interval: '5' },
        { string: 3, offset: 1, interval: '7' },
        { string: 2, offset: 2, interval: '3' },
        { string: 1, offset: 0, interval: '5' }
      ]}
    ],
    G: [
      { id: 'maj7-G', name: 'maj7 G 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, mute: true },
        { string: 4, offset: -3, interval: '5' },
        { string: 3, offset: -3, interval: '1' },
        { string: 2, offset: -3, interval: '3' },
        { string: 1, offset: -1, interval: '7' }
      ]}
    ],
    E: [
      { id: 'maj7-E', name: 'maj7 E 型', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, mute: true },
        { string: 4, offset: 1, interval: '7' },
        { string: 3, offset: 1, interval: '3' },
        { string: 2, offset: 0, interval: '5' },
        { string: 1, mute: true }
      ]}
    ],
    D: [
      { id: 'maj7-D', name: 'maj7 D 型', tags: ['full'], strings: [
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
      { id: 'dom7-C', name: '7 C 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: -1, interval: '3' },
        { string: 3, offset: 0, interval: 'b7' },
        { string: 2, offset: -2, interval: '1' },
        { string: 1, offset: -3, interval: '3' }
      ]}
    ],
    A: [
      { id: 'dom7-A', name: '7 A 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 2, interval: '5' },
        { string: 3, offset: 0, interval: 'b7' },
        { string: 2, offset: 2, interval: '3' },
        { string: 1, offset: 0, interval: '5' }
      ]}
    ],
    G: [
      { id: 'dom7-G', name: '7 G 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, mute: true },
        { string: 4, offset: -3, interval: '5' },
        { string: 3, offset: -3, interval: '1' },
        { string: 2, offset: -3, interval: '3' },
        { string: 1, offset: -2, interval: 'b7' }
      ]}
    ],
    E: [
      { id: 'dom7-E', name: '7 E 型', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: 2, interval: '5' },
        { string: 4, offset: 0, interval: 'b7' },
        { string: 3, offset: 1, interval: '3' },
        { string: 2, offset: 0, interval: '5' },
        { string: 1, offset: 0, interval: '1' }
      ]}
    ],
    D: [
      { id: 'dom7-D', name: '7 D 型', tags: ['full'], strings: [
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
      { id: 'm7-C', name: 'm7 C 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: -2, interval: 'b3' },
        { string: 3, offset: 0, interval: 'b7' },
        { string: 2, offset: 1, interval: 'b3' },
        { string: 1, mute: true }
      ]}
    ],
    A: [
      { id: 'm7-A', name: 'm7 A 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 2, interval: '5' },
        { string: 3, offset: 0, interval: 'b7' },
        { string: 2, offset: 1, interval: 'b3' },
        { string: 1, offset: 0, interval: '5' }
      ]}
    ],
    G: [
      { id: 'm7-G', name: 'm7 G 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, mute: true },
        { string: 4, offset: -3, interval: '5' },
        { string: 3, offset: -3, interval: '1' },
        { string: 2, offset: -4, interval: 'b3' },
        { string: 1, offset: -2, interval: 'b7' }
      ]}
    ],
    E: [
      { id: 'm7-E', name: 'm7 E 型', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: 2, interval: '5' },
        { string: 4, offset: 0, interval: 'b7' },
        { string: 3, offset: 0, interval: 'b3' },
        { string: 2, offset: 0, interval: '5' },
        { string: 1, offset: 0, interval: '1' }
      ]}
    ],
    D: [
      { id: 'm7-D', name: 'm7 D 型', tags: ['full'], strings: [
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
      { id: 'm7b5-C', name: 'm7♭5 C 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: -2, interval: 'b3' },
        { string: 3, offset: 0, interval: 'b7' },
        { string: 2, offset: -2, interval: '1' },
        { string: 1, offset: -1, interval: 'b5' }
      ]}
    ],
    A: [
      { id: 'm7b5-A', name: 'm7♭5 A 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 1, interval: 'b5' },
        { string: 3, offset: 0, interval: 'b7' },
        { string: 2, offset: 1, interval: 'b3' },
        { string: 1, mute: true }
      ]}
    ],
    G: [
      { id: 'm7b5-G', name: 'm7♭5 G 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, mute: true },
        { string: 4, offset: -4, interval: 'b5' },
        { string: 3, offset: -3, interval: '1' },
        { string: 2, offset: -4, interval: 'b3' },
        { string: 1, offset: -2, interval: 'b7' }
      ]}
    ],
    E: [
      { id: 'm7b5-E', name: 'm7♭5 E 型', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: 'b7' },
        { string: 3, offset: 0, interval: 'b3' },
        { string: 2, offset: -1, interval: 'b5' },
        { string: 1, mute: true }
      ]}
    ],
    D: [
      { id: 'm7b5-D', name: 'm7♭5 D 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: '1' },
        { string: 3, offset: 1, interval: 'b5' },
        { string: 2, offset: 1, interval: 'b7' },
        { string: 1, offset: 1, interval: 'b3' }
      ]}
    ]
  },

  // dim 三和弦（R, b3, b5）：每個 CAGED 型單一按法，依 dim7 指板圖去掉 6th 推得。
  dim: {
    C: [
      { id: 'dim-C', name: 'dim C 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 1, interval: 'b5' },
        { string: 3, mute: true },
        { string: 2, offset: 1, interval: 'b3' },
        { string: 1, offset: -1, interval: 'b5' }
      ]}
    ],
    A: [
      { id: 'dim-A', name: 'dim A 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 1, interval: 'b5' },
        { string: 3, offset: 2, interval: '1' },
        { string: 2, offset: 1, interval: 'b3' },
        { string: 1, mute: true }
      ]}
    ],
    G: [
      { id: 'dim-G', name: 'dim G 型', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, mute: true },
        { string: 4, mute: true },
        { string: 3, offset: 0, interval: 'b3' },
        { string: 2, offset: -1, interval: 'b5' },
        { string: 1, offset: 0, interval: '1' }
      ]}
    ],
    E: [
      { id: 'dim-E', name: 'dim E 型', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: 1, interval: 'b5' },
        { string: 4, offset: 2, interval: '1' },
        { string: 3, offset: 0, interval: 'b3' },
        { string: 2, mute: true },
        { string: 1, mute: true }
      ]}
    ],
    D: [
      { id: 'dim-D', name: 'dim D 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: '1' },
        { string: 3, offset: 1, interval: 'b5' },
        { string: 2, offset: 3, interval: '1' },
        { string: 1, offset: 1, interval: 'b3' }
      ]}
    ]
  },

  // dim7 減七和弦（R, b3, b5, 6 ＝ bb7）：每個 CAGED 型單一按法，依使用者提供的指板圖。
  // 音程表無 bb7，故第 4 音以相同音高（9 半音）的 '6' 表示。
  dim7: {
    C: [
      { id: 'dim7-C', name: 'dim7 C 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 1, interval: 'b5' },
        { string: 3, offset: -1, interval: '6' },
        { string: 2, offset: 1, interval: 'b3' },
        { string: 1, offset: -1, interval: 'b5' }
      ]}
    ],
    A: [
      { id: 'dim7-A', name: 'dim7 A 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, offset: 0, interval: '1' },
        { string: 4, offset: 1, interval: 'b5' },
        { string: 3, mute: true },
        { string: 2, offset: 1, interval: 'b3' },
        { string: 1, offset: 2, interval: '6' }
      ]}
    ],
    G: [
      { id: 'dim7-G', name: 'dim7 G 型', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, mute: true },
        { string: 4, offset: -1, interval: '6' },
        { string: 3, offset: 0, interval: 'b3' },
        { string: 2, offset: -1, interval: 'b5' },
        { string: 1, offset: 0, interval: '1' }
      ]}
    ],
    E: [
      { id: 'dim7-E', name: 'dim7 E 型', tags: ['full'], strings: [
        { string: 6, offset: 0, interval: '1' },
        { string: 5, offset: 1, interval: 'b5' },
        { string: 4, offset: 2, interval: '1' },
        { string: 3, offset: 0, interval: 'b3' },
        { string: 2, offset: 2, interval: '6' },
        { string: 1, offset: 0, interval: '1' }
      ]}
    ],
    D: [
      { id: 'dim7-D', name: 'dim7 D 型', tags: ['full'], strings: [
        { string: 6, mute: true },
        { string: 5, mute: true },
        { string: 4, offset: 0, interval: '1' },
        { string: 3, offset: 1, interval: 'b5' },
        { string: 2, offset: 0, interval: '6' },
        { string: 1, offset: 1, interval: 'b3' }
      ]}
    ]
  }
};

export function getChordQualityKey(chordDegreeStr) {
  const chordConfig = CHORD_MODES[chordDegreeStr];
  if (!chordConfig) return null;
  return CHORD_LABEL_TO_QUALITY[chordConfig.label] || null;
}

/**
 * 將資料定義式 CAGED 和弦 form 轉成指板與音訊引擎共用的 note object。
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

// ===== 三和弦（Triad）練習模式 =====
//
// 連續三弦組合，值為「低音弦→高音弦」的 stringIndex（0=1弦最細, 5=6弦最粗）。
// 同一組相鄰弦中，越粗的弦（弦號越大 / stringIndex 越大）音越低，因此低音在前。
export const TRIAD_STRING_SETS = {
  '1-3': [2, 1, 0], // 弦 3,2,1
  '2-4': [3, 2, 1], // 弦 4,3,2
  '3-5': [4, 3, 2], // 弦 5,4,3
  '4-6': [5, 4, 3]  // 弦 6,5,4
};

// 各弦帶八度資訊的絕對音高分數（開放弦），index = stringIndex。
// 與 resolveCagedChordVoicing 內的 stringPitches 一致 (E4=64 ... E2=40)。
const TRIAD_STRING_PITCH_SCORES = [64, 59, 55, 50, 45, 40];

// family → 三和弦音程（dom 視為 major，與 cagedScales 的 getTrainingFamily 一致）。
const TRIAD_INTERVALS_BY_FAMILY = {
  major: ['1', '3', '5'],
  minor: ['1', 'b3', '5'],
  dim:   ['1', 'b3', 'b5']
};

// 相鄰三弦上「可實際按壓」的 close-voiced 三和弦，最大琴格跨度。
// 用來排除「低音壓在極低把位、把高音硬疊到很高格」而產生的誇張跨度 voicing
// （例如低音開放弦 + 高音第 9~10 格），改用其它轉回形。
const MAX_TRIAD_SPAN = 5;

// 進行中「盡量不要連續使用同一個轉回形」的柔性懲罰（以琴格移動量為單位）。
// 加在 voice leading 分數上：若候選的轉回形與前一個和弦相同就加此值，
// 使演算法偏好換轉回形；但若同轉回形的把位明顯更近（差距大於此值）仍會沿用，
// 因此是「盡量」而非硬性限制。數值越大越傾向每個和弦都換轉回形。
const SAME_INVERSION_PENALTY = 4;

const triadAbsPitch = (stringIndex, fret) => TRIAD_STRING_PITCH_SCORES[stringIndex] + fret;

// 在指定弦上，找出音高等級為 pc 且絕對音高 > thresholdAbs 的最小琴格。
const triadFretAbove = (pc, stringIndex, thresholdAbs) => {
  let fret = (((pc - STRING_OPENS[stringIndex]) % 12) + 12) % 12;
  while (triadAbsPitch(stringIndex, fret) <= thresholdAbs) fret += 12;
  return fret;
};

// 建立一個 close-voiced 三和弦：低音弦放 tones[0]，往高音弦依序疊上比前一個弦音更高的最近音。
// bassMinFret 決定整個把位落點（用來產生不同八度的候選）。回傳 3 個 note 物件或 null（超出指板）。
const buildTriadVoicing = (invTones, strings, bassMinFret, chordRootAbs, maxFret) => {
  const [s0, s1, s2] = strings;

  let f0 = (((invTones[0].pc - STRING_OPENS[s0]) % 12) + 12) % 12;
  while (f0 < bassMinFret) f0 += 12;
  const a0 = triadAbsPitch(s0, f0);

  const f1 = triadFretAbove(invTones[1].pc, s1, a0);
  const a1 = triadAbsPitch(s1, f1);

  const f2 = triadFretAbove(invTones[2].pc, s2, a1);

  const frets = [f0, f1, f2];
  if (frets.some(f => f < 0 || f > maxFret)) return null;

  return strings.map((stringIndex, i) => {
    const fret = frets[i];
    const intervalLabel = invTones[i].interval;
    const intervalFromChordRoot = INTERVAL_TO_SEMITONE[intervalLabel];
    const absoluteNote = (STRING_OPENS[stringIndex] + fret + 120) % 12;
    return {
      stringIndex,
      string: stringIndex + 1,
      fret,
      absoluteNote,
      interval: intervalLabel,
      intervalFromChordRoot,
      pitchScore: triadAbsPitch(stringIndex, fret),
      intervalLabel,
      isValidVoicingNote: absoluteNote === (chordRootAbs + intervalFromChordRoot) % 12
    };
  });
};

/**
 * 為整組和弦進行產生「連續三弦組」上的三和弦轉回形序列。
 *
 * 以貪婪法逐一決定每個和弦的轉回形，讓每次和弦切換的琴格移動量最小
 * （聲部進行 / voice leading）。第一個和弦取最低且最緊湊的把位。
 *
 * @param {number} keyRoot            主調根音 pitch class (0-11)
 * @param {string[]} progressionArray 羅馬級數字串陣列 (CHORD_MODES 的 key)
 * @param {string} stringSet          TRIAD_STRING_SETS 的 key ('1-3' | '2-4' | '3-5' | '4-6')
 * @param {object} [options]          { maxFret = 15, cycle = 0 }
 *                                     cycle：本輪把位階梯的索引。第一個和弦會依把位由低到高
 *                                     取第 cycle 個候選，讓每完成一輪就往高把位推進（循環）。
 * @returns {Array<{ degree, notes }>} 每個和弦一項，notes 為 3 個 note 物件（低音弦→高音弦）
 */
export function generateTriadProgressionVoicings(keyRoot, progressionArray, stringSet, options = {}) {
  const maxFret = Number.isFinite(options.maxFret) ? options.maxFret : 15;
  const cycle = Number.isInteger(options.cycle) ? options.cycle : 0;
  const strings = TRIAD_STRING_SETS[stringSet] || TRIAD_STRING_SETS['2-4'];

  const result = [];
  let prevNotes = null;
  let prevInv = null; // 前一個和弦採用的轉回形（0=root / 1=3rd / 2=5th 在低音）。

  for (const degree of progressionArray || []) {
    const chordConfig = CHORD_MODES[degree];
    if (!chordConfig) {
      result.push({ degree, notes: [] });
      continue;
    }

    const chordRootAbs = (keyRoot + chordConfig.offset) % 12;
    const family = chordConfig.family === 'dom' ? 'major' : chordConfig.family;
    const intervals = TRIAD_INTERVALS_BY_FAMILY[family] || TRIAD_INTERVALS_BY_FAMILY.major;

    // 三個構成音的 pitch class + interval 標籤。
    const tones = intervals.map(interval => ({
      interval,
      pc: (chordRootAbs + INTERVAL_TO_SEMITONE[interval]) % 12
    }));

    // 3 個轉回形（低音是 root / 3rd / 5th）× 每個轉回形取兩個八度落點作為候選。
    // 每個候選記住自己的轉回形 inv，供「避免連續同轉回形」的懲罰使用。
    const candidates = [];
    for (let inv = 0; inv < 3; inv++) {
      const invTones = [tones[inv % 3], tones[(inv + 1) % 3], tones[(inv + 2) % 3]];
      const bassBase = (((invTones[0].pc - STRING_OPENS[strings[0]]) % 12) + 12) % 12;
      for (const bassMinFret of [bassBase, bassBase + 12]) {
        if (bassMinFret > maxFret) continue;
        const notes = buildTriadVoicing(invTones, strings, bassMinFret, chordRootAbs, maxFret);
        if (notes) candidates.push({ notes, inv });
      }
    }

    if (candidates.length === 0) {
      result.push({ degree, notes: [] });
      continue;
    }

    // 先排除跨度過大的誇張 voicing；若全部都過大（極少見）才退回原始候選，避免產生空和弦。
    const spanOf = (notes) => Math.max(...notes.map(n => n.fret)) - Math.min(...notes.map(n => n.fret));
    const compact = candidates.filter(cand => spanOf(cand.notes) <= MAX_TRIAD_SPAN);
    const pool = compact.length > 0 ? compact : candidates;

    let best;
    if (!prevNotes) {
      // 本輪的錨點和弦：候選依把位由低到高排成階梯，取第 cycle 個（循環），
      // 讓每完成一輪進行就往高把位推進，行為與 CAGED 自動循環一致。
      const ladder = [...pool].sort((a, b) => {
        const aMin = Math.min(...a.notes.map(n => n.fret));
        const bMin = Math.min(...b.notes.map(n => n.fret));
        if (aMin !== bMin) return aMin - bMin;
        const aSum = a.notes.reduce((s, n) => s + n.fret, 0);
        const bSum = b.notes.reduce((s, n) => s + n.fret, 0);
        return aSum - bSum;
      });
      best = ladder[((cycle % ladder.length) + ladder.length) % ladder.length];
    } else {
      // 後續和弦：與前一個和弦同弦位的琴格移動總和最小 + 些微跨度懲罰，
      // 並對「與前一個和弦相同的轉回形」加上柔性懲罰，盡量不要連續用同一個轉回形。
      let bestScore = Infinity;
      for (const cand of pool) {
        const move = cand.notes.reduce((sum, n, i) => sum + Math.abs(n.fret - prevNotes[i].fret), 0);
        const span = spanOf(cand.notes);
        const sameInversionPenalty = cand.inv === prevInv ? SAME_INVERSION_PENALTY : 0;
        const score = move + span * 0.25 + sameInversionPenalty;
        if (score < bestScore) {
          bestScore = score;
          best = cand;
        }
      }
    }

    result.push({ degree, notes: best.notes });
    prevNotes = best.notes;
    prevInv = best.inv;
  }

  return result;
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
  const rawToken = String(token || '').trim();
  const prefix = rawToken.charAt(0).toUpperCase();

  // L = 低八度、H = 高八度、無前綴 = 中央音域。
  const hasOctavePrefix = prefix === 'L' || prefix === 'H';
  const degreeText = hasOctavePrefix ? rawToken.slice(1) : rawToken;
  const degreeNum = parseInt(degreeText, 10);

  if (!Number.isFinite(degreeNum) || degreeNum < 1) return null;

  // 將度數 1-7 映射到調式陣列索引 0-6。
  // 超過 7 時仍保留循環映射，方便日後擴充。
  const modeIndex = (degreeNum - 1) % 7;
  const semitoneOffset = chordConfig.mode[modeIndex];

  if (semitoneOffset === undefined) return null;

  // 先把音名固定在 0-11，再依 L/H 套用八度位移。
  // AudioEngine 會用這個數值直接換算頻率，所以 H 會真的變高八度。
  const pitchClass = (chordRootAbs + semitoneOffset + 120) % 12;
  const octaveOffset = prefix === 'L' ? -12 : prefix === 'H' ? 12 : 0;

  return pitchClass + octaveOffset;
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