// src/utils/cagedScales.js

import {
  CHORD_MODES,
  STRING_OPENS,
  INTERVAL_TO_SEMITONE,
  getRootFret
} from './musicTheory.js';

/**
 * 內部音高排序用的弦高。
 * string: 1=最細弦，6=最粗弦。
 */
const STRING_PITCH_SCORES = {
  1: 64,
  2: 59,
  3: 55,
  4: 50,
  5: 45,
  6: 40
};

/**
 * 7 個 church modes 的音程語義。
 * 注意：這裡保留 #4 / b5、6 / b6、7 / b7 的語義差異，
 * 不再只靠半音數反推顯示文字。
 */
export const MODE_DEFINITIONS = {
  ionian: {
    label: 'Ionian',
    intervals: [
      { interval: '1', semitone: 0 },
      { interval: '2', semitone: 2 },
      { interval: '3', semitone: 4 },
      { interval: '4', semitone: 5 },
      { interval: '5', semitone: 7 },
      { interval: '6', semitone: 9 },
      { interval: '7', semitone: 11 }
    ]
  },

  dorian: {
    label: 'Dorian',
    intervals: [
      { interval: '1', semitone: 0 },
      { interval: '2', semitone: 2 },
      { interval: 'b3', semitone: 3 },
      { interval: '4', semitone: 5 },
      { interval: '5', semitone: 7 },
      { interval: '6', semitone: 9 },
      { interval: 'b7', semitone: 10 }
    ]
  },

  phrygian: {
    label: 'Phrygian',
    intervals: [
      { interval: '1', semitone: 0 },
      { interval: 'b2', semitone: 1 },
      { interval: 'b3', semitone: 3 },
      { interval: '4', semitone: 5 },
      { interval: '5', semitone: 7 },
      { interval: 'b6', semitone: 8 },
      { interval: 'b7', semitone: 10 }
    ]
  },

  lydian: {
    label: 'Lydian',
    intervals: [
      { interval: '1', semitone: 0 },
      { interval: '2', semitone: 2 },
      { interval: '3', semitone: 4 },
      { interval: '#4', semitone: 6 },
      { interval: '5', semitone: 7 },
      { interval: '6', semitone: 9 },
      { interval: '7', semitone: 11 }
    ]
  },

  mixolydian: {
    label: 'Mixolydian',
    intervals: [
      { interval: '1', semitone: 0 },
      { interval: '2', semitone: 2 },
      { interval: '3', semitone: 4 },
      { interval: '4', semitone: 5 },
      { interval: '5', semitone: 7 },
      { interval: '6', semitone: 9 },
      { interval: 'b7', semitone: 10 }
    ]
  },

  aeolian: {
    label: 'Aeolian',
    intervals: [
      { interval: '1', semitone: 0 },
      { interval: '2', semitone: 2 },
      { interval: 'b3', semitone: 3 },
      { interval: '4', semitone: 5 },
      { interval: '5', semitone: 7 },
      { interval: 'b6', semitone: 8 },
      { interval: 'b7', semitone: 10 }
    ]
  },

  locrian: {
    label: 'Locrian',
    intervals: [
      { interval: '1', semitone: 0 },
      { interval: 'b2', semitone: 1 },
      { interval: 'b3', semitone: 3 },
      { interval: '4', semitone: 5 },
      { interval: 'b5', semitone: 6 },
      { interval: 'b6', semitone: 8 },
      { interval: 'b7', semitone: 10 }
    ]
  }
};

/**
 * Train Phase 的階段模式定義。
 *
 * chord：和弦基礎。每個 Stage 以三和弦為核心，只加入指定色彩音。
 * scale：音階基礎。先掌握大小三和弦，再進入五聲音階，最後解鎖完整調式。
 *
 * 注意：9th / 11th / 13th 在 CAGED_SCALES 內分別以 2 / 4 / 6 顯示。
 * 若該調式實際是 b2、#4、b6，resolveStageIntervals() 會保留符合該調式的版本。
 */
export const TRAINING_STAGE_MODES = Object.freeze({
  chord: {
    label: '和弦基礎',
    subtitle: 'Triad → 7th / 9th / 11th / 13th',
    stageCount: 5,
    descriptions: {
      1: { title: '三和弦', detail: 'Major：1, 3, 5 / Minor：1, ♭3, 5' },
      2: { title: '三和弦 + 7th', detail: '在三和弦上加入 7 或 ♭7 的色彩' },
      3: { title: '三和弦 + 9th', detail: '在三和弦上加入 9th；Phrygian / Locrian 會使用 ♭9' },
      4: { title: '三和弦 + 11th', detail: '在三和弦上加入 11th；Lydian 會使用 #11' },
      5: { title: '三和弦 + 13th', detail: '在三和弦上加入 13th；小調色彩會依調式保留 6 或 ♭6' }
    }
  },

  scale: {
    label: '音階基礎',
    subtitle: 'Triad → Pentatonic → Mode Scale',
    stageCount: 3,
    descriptions: {
      1: { title: '大小三和弦', detail: 'Major Triad：1, 3, 5 / Minor Triad：1, ♭3, 5' },
      2: { title: '大小五聲音階', detail: 'Major Pentatonic：1, 2, 3, 5, 6 / Minor Pentatonic：1, ♭3, 4, 5, ♭7' },
      3: { title: '調式音階', detail: '解鎖目前和弦對應的完整 Mode Scale' }
    }
  }
});

export const TRAINING_STAGES = Object.freeze({
  chord: {
    major: {
      1: ['1', '3', '5'],
      2: ['1', '3', '5', '7', 'b7'],
      3: ['1', '3', '5', '2', 'b2'],
      4: ['1', '3', '5', '4', '#4'],
      5: ['1', '3', '5', '6', 'b6']
    },

    minor: {
      1: ['1', 'b3', '5'],
      2: ['1', 'b3', '5', 'b7', '7'],
      3: ['1', 'b3', '5', '2', 'b2'],
      4: ['1', 'b3', '5', '4', '#4'],
      5: ['1', 'b3', '5', '6', 'b6']
    },

    dim: {
      1: ['1', 'b3', 'b5'],
      2: ['1', 'b3', 'b5', 'b7', '7'],
      3: ['1', 'b3', 'b5', '2', 'b2'],
      4: ['1', 'b3', 'b5', '4', '#4'],
      5: ['1', 'b3', 'b5', '6', 'b6']
    }
  },

  scale: {
    major: {
      1: ['1', '3', '5'],
      2: ['1', '2', '3', '5', '6'],
      3: 'fullScale'
    },

    minor: {
      1: ['1', 'b3', '5'],
      2: ['1', 'b3', '4', '5', 'b7'],
      3: 'fullScale'
    },

    dim: {
      1: ['1', 'b3', 'b5'],
      2: ['1', 'b3', '4', 'b5', 'b7'],
      3: 'fullScale'
    }
  }
});

/**
 * CAGED 音階型的生成。
 *
 * 以前是把 35 型 × 十幾個音全部手寫，但每個音的內容（弦、品格、音程）
 * 都能由「form 幾何 ＋ 調式」唯一決定，因此改成用演算法生成。
 *
 * 手寫保留的只有各 form 的幾何（CAGED_FORM_GEOMETRY）。
 * offset 以 rootFret 為基準；generateCagedScaleSequence() 會用 rootFret + offset
 * 換算成實際品格（這點與以前相同）。
 *
 * 不變條件：同一個絕對音高不放在多條弦上（不製造同音異弦）。
 * 由 dedup 對所有 mode 在結構上保證。
 */

// 各 CAGED form 的幾何。
// - rootString : 根音 '1' 落在 offset 0 的那條弦（1=最細, 6=最粗）。
// - windows[弦] : 該弦採用的 rootFret 基準 offset 範圍 [min, max]。
// 7 個 mode 共用。窗外 / 調式外的音在生成時會自然被排除，所以窗可以取寬一點。
const CAGED_FORM_GEOMETRY = {
  C: { rootString: 5, windows: { 1: [-3, 1], 2: [-3, 1], 3: [-4, 0], 4: [-3, 1], 5: [-3, 1], 6: [-3, 1] } },
  A: { rootString: 5, windows: { 1: [-1, 3], 2: [0, 4],  3: [-1, 3], 4: [-1, 3], 5: [-1, 3], 6: [-1, 3] } },
  G: { rootString: 6, windows: { 1: [-3, 1], 2: [-3, 1], 3: [-4, 0], 4: [-4, 0], 5: [-3, 1], 6: [-3, 1] } },
  E: { rootString: 6, windows: { 1: [-1, 3], 2: [-1, 3], 3: [-1, 3], 4: [-1, 3], 5: [-1, 3], 6: [-1, 3] } },
  D: { rootString: 4, windows: { 1: [0, 4],  2: [0, 4],  3: [-1, 3], 4: [-1, 3], 5: [-1, 3], 6: [0, 4]  } }
};

const CAGED_FORM_ORDER = ['C', 'A', 'G', 'E', 'D'];

// note.id 用的音程 token（沿用以前的 id 命名方式）。
const INTERVAL_ID_TOKEN = {
  '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
  'b2': 'flat2', 'b3': 'flat3', 'b5': 'flat5', 'b6': 'flat6', 'b7': 'flat7', '#4': 'sharp4'
};

const offsetToken = offset => (offset >= 0 ? `p${offset}` : `m${-offset}`);

// form 內的絕對音高（開放弦分數 + offset）。用於偵測同音異弦與排序。
const shapeAbsolutePitch = note => STRING_PITCH_SCORES[note.string] + note.offset;

/**
 * path override（選用）。
 * 只有想覆寫生成練習順序的 form，才需要寫 [noteId, ...]。
 * 例：PATH_OVERRIDES.ionian = { C: ['s5-p0-1', ...] }
 */
const PATH_OVERRIDES = {};

/**
 * 同音異弦的取捨。
 * 當同一個絕對音高出現在 2 條弦上時，決定保留哪一條。
 * 只有三全音會同時出現在兩條弦（#4 / b5）。為配合以前的手寫配置，
 * #4 保留在細弦（弦號較小），b5 保留在粗弦（弦號較大）。
 * 其他音程本來就不會重複，所以用預設（優先細弦）即可。
 */
function preferCandidateString(candidate, existing) {
  if (candidate.interval === 'b5') return candidate.string > existing.string;
  return candidate.string < existing.string;
}

/**
 * 練習 path 的預設生成。
 * 把音依絕對音高排序，從根音出發「上行→最高音→下行→最低音→回到根音」。
 */
function buildDefaultPath(sortedNotes, rootString) {
  if (sortedNotes.length === 0) return [];

  let rootIndex = sortedNotes.findIndex(note => note.string === rootString && note.offset === 0);
  if (rootIndex === -1) rootIndex = 0;

  const ids = sortedNotes.map(note => note.id);
  const ascendFromRoot = ids.slice(rootIndex);                 // 根音 → 最高音
  const descendToBottom = ids.slice(0, ids.length - 1).reverse(); // 最高音的下一個 → 最低音
  const ascendBackToRoot = ids.slice(1, rootIndex + 1);        // 最低音的上一個 → 根音

  return [...ascendFromRoot, ...descendToBottom, ...ascendBackToRoot];
}

/**
 * 由 (modeKey, formName) 生成一個 CAGED 音階型。
 * 回傳的形狀與以前的 makeStaticScaleShape 相容（下游 consumer 不需變動）。
 */
function buildCagedScaleShape(modeKey, formName) {
  const geometry = CAGED_FORM_GEOMETRY[formName];
  const modeDef = MODE_DEFINITIONS[modeKey];
  const rootOpen = STRING_OPENS[geometry.rootString - 1];

  // 1. 對每條弦、每個音程，列出落在窗內的 offset。
  //    offset ≡ (rootOpen − openString + semitone) (mod 12)。rootFret 在此會相互抵消。
  const candidates = [];
  for (let string = 1; string <= 6; string++) {
    const window = geometry.windows[string];
    if (!window) continue;
    const [minOffset, maxOffset] = window;
    const open = STRING_OPENS[string - 1];

    for (const { interval, semitone } of modeDef.intervals) {
      const base = (((rootOpen - open + semitone) % 12) + 12) % 12;
      for (const offset of [base - 12, base, base + 12]) {
        if (offset >= minOffset && offset <= maxOffset) {
          candidates.push({ string, offset, interval });
        }
      }
    }
  }

  // 2. 排除同音異弦（每個絕對音高只留 1 條弦）。
  const byAbsolutePitch = new Map();
  for (const note of candidates) {
    const pitch = shapeAbsolutePitch(note);
    const existing = byAbsolutePitch.get(pitch);
    if (!existing || preferCandidateString(note, existing)) {
      byAbsolutePitch.set(pitch, note);
    }
  }

  // 3. 依絕對音高排序，並產生 id。
  const notes = [...byAbsolutePitch.values()]
    .sort((a, b) => shapeAbsolutePitch(a) - shapeAbsolutePitch(b))
    .map(note => ({
      id: `s${note.string}-${offsetToken(note.offset)}-${INTERVAL_ID_TOKEN[note.interval]}`,
      string: note.string,
      offset: note.offset,
      interval: note.interval
    }));

  // 4. path（若有 override 則優先使用）。
  const path = PATH_OVERRIDES[modeKey]?.[formName] || buildDefaultPath(notes, geometry.rootString);

  return {
    id: `${modeKey}-${formName}`,
    name: `${modeDef.label} ${formName} form`,
    modeKey,
    notes,
    path
  };
}

/**
 * 已生成的 CAGED 音階型。 [modeKey][formName] = shape。
 * 與以前手寫的 CAGED_SCALES 具有相同結構與相同的公開欄位。
 */
export const CAGED_SCALES = {};
for (const modeKey of Object.keys(MODE_DEFINITIONS)) {
  CAGED_SCALES[modeKey] = {};
  for (const formName of CAGED_FORM_ORDER) {
    CAGED_SCALES[modeKey][formName] = buildCagedScaleShape(modeKey, formName);
  }
}

function getModeKeyFromModeArray(modeArray) {
  if (!Array.isArray(modeArray)) return null;

  const normalizedInput = [...modeArray].sort((a, b) => a - b).join(',');

  for (const [modeKey, modeDef] of Object.entries(MODE_DEFINITIONS)) {
    const normalizedMode = modeDef.intervals
      .map(item => item.semitone)
      .sort((a, b) => a - b)
      .join(',');

    if (normalizedInput === normalizedMode) return modeKey;
  }

  return null;
}

/**
 * 從 CHORD_MODES.modeName 判斷要使用哪個調式。
 * 調外借用和弦如 Ionian (♭III) 也會正確落到 ionian。
 */
export function getModeKey(modeName = '') {
  const normalized = String(modeName).toLowerCase();

  if (normalized.includes('ionian')) return 'ionian';
  if (normalized.includes('dorian')) return 'dorian';
  if (normalized.includes('phrygian')) return 'phrygian';
  if (normalized.includes('lydian')) return 'lydian';
  if (normalized.includes('mixolydian')) return 'mixolydian';
  if (normalized.includes('aeolian')) return 'aeolian';
  if (normalized.includes('locrian')) return 'locrian';

  return null;
}

export function getModeKeyForChord(chordDegreeStr) {
  const chordConfig = CHORD_MODES[chordDegreeStr];
  if (!chordConfig) return null;

  const modeKeyFromName = getModeKey(chordConfig.modeName);
  if (modeKeyFromName) return modeKeyFromName;

  const modeKeyFromArray = getModeKeyFromModeArray(chordConfig.mode);
  if (modeKeyFromArray) return modeKeyFromArray;

  // 減和弦類的 8 音音階暫時落到 locrian 的 CAGED 音階，避免 UI / 音訊中斷。
  if (chordConfig.family === 'dim') return 'locrian';
  if (chordConfig.family === 'minor') return 'aeolian';

  return 'ionian';
}

export function resolveCagedScaleShape(chordDegreeStr, formObj) {
  if (!formObj) return null;

  const modeKey = getModeKeyForChord(chordDegreeStr);
  if (!modeKey) return null;

  return CAGED_SCALES[modeKey]?.[formObj.name] || null;
}

function getTrainingFamily(chordConfig) {
  if (!chordConfig) return 'major';
  if (chordConfig.family === 'dom') return 'major';
  if (chordConfig.family === 'dim') return 'dim';
  if (chordConfig.family === 'minor') return 'minor';
  return 'major';
}

export function resolveStageIntervals(chordConfig, scaleShape, stage, stageMode = 'chord') {
  const safeStageMode = TRAINING_STAGES[stageMode] ? stageMode : 'chord';
  const stageNumber = Number(stage);
  const modeConfig = TRAINING_STAGE_MODES[safeStageMode] || TRAINING_STAGE_MODES.chord;

  if (!chordConfig || !scaleShape) return 'fullScale';
  if (!Number.isFinite(stageNumber) || stageNumber < 1 || stageNumber > modeConfig.stageCount) {
    return 'fullScale';
  }

  const family = getTrainingFamily(chordConfig);
  const stageDef = TRAINING_STAGES[safeStageMode]?.[family]?.[stageNumber] || 'fullScale';

  if (stageDef === 'fullScale') return 'fullScale';

  // 只保留目前調式真的存在的音程。
  // 例如 Ionian 沒有 b7，Mixolydian 沒有 7，Lydian 沒有自然 4。
  const modeIntervals = new Set(
    MODE_DEFINITIONS[scaleShape.modeKey].intervals.map(item => item.interval)
  );

  return stageDef.filter(interval => modeIntervals.has(interval));
}

/**
 * Train Phase 用的序列產生器。
 *
 * 注意：
 * - CAGED_SCALES 現在是靜態資料。
 * - 實際播放順序完全依照 scaleShape.path。
 * - 你只要改某個型裡面的 path，就能改變該型的練習走向。
 */
export function generateCagedScaleSequence(
  keyRoot,
  chordDegreeStr,
  formObj,
  stage,
  stageMode = 'chord',
  allowOpen = false
) {
  const chordConfig = CHORD_MODES[chordDegreeStr];
  const scaleShape = resolveCagedScaleShape(chordDegreeStr, formObj);

  if (!chordConfig || !scaleShape || !formObj) return [];

  const allowedIntervals = resolveStageIntervals(chordConfig, scaleShape, stage, stageMode);
  const rootFret = getRootFret(formObj);
  const noteById = new Map(scaleShape.notes.map(note => [note.id, note]));

  return scaleShape.path
    .map(id => noteById.get(id))
    .filter(Boolean)
    .filter(note => {
      return allowedIntervals === 'fullScale' || allowedIntervals.includes(note.interval);
    })
    // Stage 過濾後，如果同一條弦、同一個 offset 連續出現，就只保留一次。
    // 這可以避免折返點在 Stage 1 / 2 / 3 被過濾後，同一音連續播放兩次。
    .filter((note, index, notes) => {
      if (index === 0) return true;

      const previousNote = notes[index - 1];
      return !(
        previousNote.string === note.string &&
        previousNote.offset === note.offset
      );
    })
    .map(note => {
      const stringIndex = note.string - 1;
      const fret = rootFret + note.offset;
      const intervalFromChordRoot = INTERVAL_TO_SEMITONE[note.interval];
      const absoluteNote = (STRING_OPENS[stringIndex] + fret + 120) % 12;

      return {
        stringIndex,
        string: note.string,
        fret,
        absoluteNote,
        interval: note.interval,
        intervalLabel: note.interval,
        intervalFromChordRoot,
        pitchScore: STRING_PITCH_SCORES[note.string] + fret,
        scaleShapeId: scaleShape.id,
        scaleShapeName: scaleShape.name,
        isOpenStringFromScale: fret === 0
      };
    })
    .filter(note => {
      if (note.fret < 0 || note.fret > 17) return false;
      if (note.fret === 0 && !allowOpen) {
        // 如果這個空弦是 CAGED shape 本身落在 0 格，仍然允許。
        // 這裡保留 allowOpen 參數，之後若要嚴格禁止開放弦可再收緊。
        return true;
      }
      return true;
    });
}

/**
 * 從 CAGED_SCALES 的 notes 推導把位邊界。
 * Fretboard 不需要另外維護 CAGED_STRING_BOUNDARIES。
 */
export function getCagedScaleBounds(chordDegreeStr, formObj, totalFrets = 17) {
  const scaleShape = resolveCagedScaleShape(chordDegreeStr, formObj);
  if (!scaleShape || !formObj) return null;

  const rootFret = getRootFret(formObj);
  const bounds = {};
  let minFret = Infinity;
  let maxFret = -Infinity;

  for (const note of scaleShape.notes) {
    const fret = rootFret + note.offset;
    if (fret < 0 || fret > totalFrets) continue;

    if (!bounds[note.string]) {
      bounds[note.string] = [fret, fret];
    } else {
      bounds[note.string][0] = Math.min(bounds[note.string][0], fret);
      bounds[note.string][1] = Math.max(bounds[note.string][1], fret);
    }

    minFret = Math.min(minFret, fret);
    maxFret = Math.max(maxFret, fret);
  }

  if (minFret === Infinity || maxFret === -Infinity) return null;

  return {
    bounds,
    minFret,
    maxFret,
    scaleShape
  };
}

/**
 * 開發時用的資料檢查。
 * 可以在 App.vue onMounted() 內呼叫，確認生成結果是否正確。
 *
 * 為了防止生成邏輯的回歸，除了存在性檢查之外，也一併檢算：
 * - 每個音的實際音高是否與 interval 一致（幾何 ↔ 音程的一致性）
 * - 是否沒有相同絕對音高落在多條弦（同音異弦為零）
 */
export function validateCagedScales() {
  const errors = [];
  let shapeCount = 0;

  for (const [modeKey, forms] of Object.entries(CAGED_SCALES)) {
    const requiredIntervals = MODE_DEFINITIONS[modeKey].intervals.map(item => item.interval);

    for (const [formName, shape] of Object.entries(forms)) {
      shapeCount++;

      if (!shape) {
        errors.push(`${modeKey}.${formName} 沒有建立 shape`);
        continue;
      }

      const noteIds = new Set(shape.notes.map(note => note.id));
      const presentIntervals = new Set(shape.notes.map(note => note.interval));

      for (const interval of requiredIntervals) {
        if (!presentIntervals.has(interval)) {
          errors.push(`${modeKey}.${formName} 缺少音程 ${interval}`);
        }
      }

      for (const pathId of shape.path) {
        if (!noteIds.has(pathId)) {
          errors.push(`${modeKey}.${formName} 的 path 包含不存在的 note id: ${pathId}`);
        }
      }

      for (const note of shape.notes) {
        if (INTERVAL_TO_SEMITONE[note.interval] === undefined) {
          errors.push(`${modeKey}.${formName} 有未知音程: ${note.interval}`);
        }
      }

      // --- 音高一致：以根音為基準，檢查各音的實際音程是否與 interval 相符 ---
      const rootNote = shape.notes.find(note => note.interval === '1' && note.offset === 0)
        || shape.notes.find(note => note.interval === '1');
      if (!rootNote) {
        errors.push(`${modeKey}.${formName} 沒有根音 '1'`);
      } else {
        const rootPitchClass = (STRING_OPENS[rootNote.string - 1] + rootNote.offset + 1200) % 12;
        for (const note of shape.notes) {
          const expectedSemitone = INTERVAL_TO_SEMITONE[note.interval];
          if (expectedSemitone === undefined) continue;
          const actualSemitone = ((STRING_OPENS[note.string - 1] + note.offset - rootPitchClass) % 12 + 12) % 12;
          if (actualSemitone !== expectedSemitone) {
            errors.push(`${modeKey}.${formName} 的 ${note.id}：實際音程 ${actualSemitone} 與 interval ${note.interval}(${expectedSemitone}) 不一致`);
          }
        }
      }

      // --- 同音異弦為零：相同絕對音高不得出現在 2 條以上的弦 ---
      const seenPitch = new Map();
      for (const note of shape.notes) {
        const pitch = STRING_PITCH_SCORES[note.string] + note.offset;
        if (seenPitch.has(pitch)) {
          errors.push(`${modeKey}.${formName}：同音異弦 ${seenPitch.get(pitch)} 與 ${note.id} 為相同絕對音高`);
        } else {
          seenPitch.set(pitch, note.id);
        }
      }
    }
  }

  if (shapeCount !== 35) {
    errors.push(`CAGED_SCALES 應該有 35 個型，但目前是 ${shapeCount} 個`);
  }

  return errors;
}
