// src/utils/musicTheory.js

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const STRING_OPENS = [4, 11, 7, 2, 9, 4]; // 1弦到6弦空弦音高

// 順階級數對應的半音偏移量與調式公式 (相對於主調根音)
export const CHORD_MODES = {
  'I': { offset: 0, mode: [0, 2, 4, 5, 7, 9, 11], alias: ['Δ', 'M', 'maj'] },
  'ii': { offset: 2, mode: [0, 2, 3, 5, 7, 9, 10], alias: ['m', 'm7'] },
  'iii': { offset: 4, mode: [0, 1, 3, 5, 7, 8, 10], alias: ['m', 'm7'] },
  'IV': { offset: 5, mode: [0, 2, 4, 6, 7, 9, 11], alias: ['Δ', 'M', 'maj'] },
  'V': { offset: 7, mode: [0, 2, 4, 5, 7, 9, 10], alias: ['7'] },
  'vi': { offset: 9, mode: [0, 2, 3, 5, 7, 8, 10], alias: ['m', 'm7'] },
  'vii°': { offset: 11, mode: [0, 1, 3, 5, 6, 8, 10], alias: ['dim', 'm7b5'] }
};

// 嚴謹的 CAGED 各弦實體邊界字典（相對於該把位和弦根音的琴格距離）
// 保證音階無重複音、不漏音，涵蓋完整的指型邊界
export const CAGED_STRING_BOUNDARIES = {
  'C': { rootString: 5, bounds: { 6: [-3, 0], 5: [-3, 0], 4: [-3, 0], 3: [-3, -1], 2: [-3, 0], 1: [-3, 0] } },
  'A': { rootString: 5, bounds: { 6: [0, 2], 5: [-1, 2], 4: [-1, 2], 3: [-1, 2], 2: [0, 3], 1: [0, 2] } },
  'G': { rootString: 6, bounds: { 6: [-3, 0], 5: [-3, 0], 4: [-3, -1], 3: [-4, -1], 2: [-3, 0], 1: [-3, 0] } },
  'E': { rootString: 6, bounds: { 6: [-1, 2], 5: [-1, 2], 4: [-1, 2], 3: [-1, 2], 2: [0, 2], 1: [-1, 2] } },
  'D': { rootString: 4, bounds: { 6: [0, 3], 5: [0, 2], 4: [-1, 2], 3: [-1, 2], 2: [0, 3], 1: [0, 3] } }
};

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
      if (minFret >= 0 && maxFret <= 17 && rFret < 12) {
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
 * 【預設模式自動導航】生成指定 CAGED 邊界內，從最低根音出發、攻頂、折返解決的音序陣列
 */
export function generateCagedSequence(keyRoot, chordDegreeStr, formObj, stage, allowOpen) {
  const chordConfig = CHORD_MODES[chordDegreeStr];
  const chordRootAbs = (keyRoot + chordConfig.offset) % 12;
  
  // 判斷該和弦是否為小調體系 (包含 m, m7)
  const isMinor = chordConfig.alias.includes('m');
  
  // 階段過濾器 (Stage 1-5)
  let allowedIntervals = [0, 2, 4, 5, 7, 9, 11]; // 預設大調全音階
  if (isMinor) {
    // 小調體系：1, b3(3), 4(5), 5(7), b6(8), b7(10), 2(2)
    // 註：不同 Mode 可能稍有不同，但大體上五聲音階與三和弦是固定的
    if (stage === 1) allowedIntervals = [0, 3, 7]; // 1, b3, 5
    else if (stage === 2) allowedIntervals = [0, 3, 5, 7]; // 1, b3, 4, 5
    else if (stage === 3) allowedIntervals = [0, 3, 5, 7, 10]; // 1, b3, 4, 5, b7
    else if (stage === 4) allowedIntervals = [0, 2, 3, 5, 7, 10]; // 1, 2, b3, 4, 5, b7
    else allowedIntervals = [0, 2, 3, 5, 7, 8, 10]; // Aeolian default (1, 2, b3, 4, 5, b6, b7)
    // 若為 Dorian, Phrygian 稍有不同，但我們使用 chordConfig.mode.includes 進行第二層過濾，
    // 這裡的 allowedIntervals 只要涵蓋該 stage 需要的音即可。
    // 為了安全起見，將小調常見音程全部列入，靠 chordConfig.mode 把關。
    if (stage === 5) allowedIntervals = [0, 1, 2, 3, 5, 7, 8, 9, 10]; // 涵蓋所有可能的小調變體
  } else {
    // 大調體系
    if (stage === 1) allowedIntervals = [0, 4, 7]; // 1, 3, 5
    else if (stage === 2) allowedIntervals = [0, 2, 4, 7]; // 1, 2, 3, 5
    else if (stage === 3) allowedIntervals = [0, 2, 4, 7, 9]; // 1, 2, 3, 5, 6
    else if (stage === 4) allowedIntervals = [0, 2, 4, 7, 9, 10, 11]; // 1, 2, 3, 5, 6, 7 (涵蓋 b7/7)
    else allowedIntervals = [0, 2, 4, 5, 6, 7, 9, 10, 11]; // 涵蓋 Lydian/Mixolydian 變體
  }

  let notesInBounds = [];
  
  // 估算吉他弦的絕對音高權重，用於進行高低排序
  const stringPitches = [64, 59, 55, 50, 45, 40]; 

  if (!formObj) return [];
  const rootFret = getRootFret(formObj);
  const boundaries = CAGED_STRING_BOUNDARIES[formObj.name].bounds;

  for (let s = 5; s >= 0; s--) { // 從 6 弦往 1 弦搜集
    const stringNum = s + 1;
    const [minOffset, maxOffset] = boundaries[stringNum];
    const stringMin = rootFret + minOffset;
    const stringMax = rootFret + maxOffset;

    for (let f = 0; f <= 17; f++) {
      const isInsideBoundary = (f >= stringMin && f <= stringMax);
      const isOpenAllowed = (f === 0 && allowOpen);
      if (!isInsideBoundary && !isOpenAllowed) continue;

      const noteInfo = calculateNote(s, f, keyRoot);
      const intervalFromChordRoot = (noteInfo.absoluteNote - chordRootAbs + 12) % 12;
      
      if (chordConfig.mode.includes(intervalFromChordRoot)) {
        if (stage < 3 && !allowedIntervals.includes(intervalFromChordRoot)) continue;
        
        notesInBounds.push({
          stringIndex: s,
          fret: f,
          absoluteNote: noteInfo.absoluteNote,
          intervalFromChordRoot,
          pitchScore: stringPitches[s] + f
        });
      }
    }
  }

  // 依音高排序
  notesInBounds.sort((a, b) => a.pitchScore - b.pitchScore);
  if (notesInBounds.length === 0) return [];

  // 尋找把位內最低的「和弦根音」作為出發起點
  let startIdx = notesInBounds.findIndex(n => n.absoluteNote === chordRootAbs);
  if (startIdx === -1) startIdx = 0;

  let finalSequence = [];
  
  // 1. 向上爬升：從起點根音一路往上爬到最高音
  for (let i = startIdx; i < notesInBounds.length; i++) {
    finalSequence.push(notesInBounds[i]);
  }
  
  // 2. 向下折返：從最高音的下一個音開始，往下跨過根音走到最低音
  for (let i = notesInBounds.length - 2; i >= 0; i--) {
    finalSequence.push(notesInBounds[i]);
  }
  
  // 3. 回歸根音：從最低音的下一個音開始，往上走回起點根音
  for (let i = 1; i <= startIdx; i++) {
    finalSequence.push(notesInBounds[i]);
  }

  return finalSequence;
}

/**
 * 【顯示映射】將半音程距離轉換為對應的文字音程（如 1, b3, 3, 5 等），用於 UI 顯示
 */
export function getIntervalName(interval, chordDegreeStr) {
  if (interval === 0) return '1';
  
  const chordConfig = CHORD_MODES[chordDegreeStr];
  const isMinor = chordConfig ? chordConfig.alias.includes('m') : false;

  const mapping = {
    1: isMinor ? '♭2' : '♭2',
    2: '2',
    3: '♭3',
    4: '3',
    5: '4',
    6: '♭5',
    7: '5',
    8: isMinor ? '♭6' : '♯5',
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
  const isMinor = chordConfig.alias.includes('m');
  
  // 建立大約在 C3 (130Hz) 附近的和弦配置 (Root, 5th, Octave, 3rd)
  // 基底 A2 = 110Hz。C3 = A2 + 3 個半音
  return [
    110 * Math.pow(2, (chordRootAbs + 3) / 12),
    110 * Math.pow(2, (chordRootAbs + 3 + 7) / 12),
    110 * Math.pow(2, (chordRootAbs + 3 + 12) / 12),
    110 * Math.pow(2, (chordRootAbs + 3 + 12 + (isMinor ? 3 : 4)) / 12)
  ];
}