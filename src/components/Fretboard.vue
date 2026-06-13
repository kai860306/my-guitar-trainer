<script setup>
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue';
import {
  calculateNote,
  NOTE_NAMES,
  CHORD_MODES,
  getAbsoluteNoteFromToken,
  getIntervalName
} from '../utils/musicTheory.js';

import {
  getCagedScaleBounds
} from '../utils/cagedScales.js';

const props = defineProps({
  keyRoot: Number,
  currentChord: String,
  currentDynamicForm: Object,
  scaleRegionOverride: { type: Object, default: null },
  isLeftHanded: Boolean,
  currentPhase: String,
  activeNoteTarget: Object,
  prepChordVoicingNotes: { type: Array, default: () => [] },

  // 指板音程顯示基準：
  // chord = 從目前和弦根音看音程。
  // key = 從目前 Key 根音看音程。
  intervalDisplayMode: { type: String, default: 'chord' }
});

const totalFrets = 15;
const strings = [0, 1, 2, 3, 4, 5];
const fretMarkers = [3, 5, 7, 9, 12, 15];

// 🎸 每根弦的粗細 (1弦最細 → 6弦最粗)
const stringThickness = [1, 1.5, 2, 2.5, 3, 3.5];

// 📏 各品格寬度比例 (十二平均律)：第 n 品的寬度 ∝ 2^(-(n-1)/12)，
//    亦即每往高把位每格寬度約乘以 0.943874，呈現真實吉他「第一格最寬、越高越窄」。
//    空弦欄 (nut) 固定給一個較窄的比例。
const NUT_FLEX = 0.62;
const fretFlexGrow = (fret) => {
  if (fret === 0) return NUT_FLEX;
  return Math.pow(2, -(fret - 1) / 12);
};
const fretCellStyle = (fret) => ({
  flexGrow: fretFlexGrow(fret),
  flexBasis: 0
});

// 🧠 計算當前和弦的實體根音音高數值
const chordRootAbsoluteNote = computed(() => {
  const conf = CHORD_MODES[props.currentChord];
  if (!conf) return null;
  return (props.keyRoot + conf.offset) % 12;
});

// 🧠 計算目前自訂模式下，正在發聲的絕對音高
const customActiveAbsoluteNote = computed(() => {
  if (props.activeNoteTarget && props.activeNoteTarget.type === 'custom') {
    return getAbsoluteNoteFromToken(props.keyRoot, props.currentChord, props.activeNoteTarget.token);
  }
  return null;
});

// 🔀 依左右手翻轉琴格渲染順序 (文字不翻轉，僅格子順序對調)
const fretsLayout = computed(() => {
  const list = [];
  for (let i = 0; i <= totalFrets; i++) list.push(i);
  return props.isLeftHanded ? list.reverse() : list;
});

// 🕸️ 預先建立完整的指板二維矩陣
const fretboardGrid = computed(() => {
  const rootAbs = chordRootAbsoluteNote.value;
  return strings.map(stringIndex => {
    return fretsLayout.value.map(fret => {
      const note = calculateNote(stringIndex, fret, props.keyRoot);
      let intervalFromChord = 0;
      let intervalFromKeyRoot = 0;
      let isThisNodeInMode = false;

      if (note) {
        intervalFromKeyRoot = (note.absoluteNote - props.keyRoot + 12) % 12;
      }

      if (note && rootAbs !== null) {
        intervalFromChord = (note.absoluteNote - rootAbs + 12) % 12;
        isThisNodeInMode = CHORD_MODES[props.currentChord]?.mode.includes(intervalFromChord) || false;
      }

      return {
        stringIndex,
        fret,
        note,
        intervalFromChord,
        intervalFromKeyRoot,
        isThisNodeInMode
      };
    });
  });
});

const normalizeIntervalLabel = (label) => {
  return String(label || '')
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#');
};

// 🎨 訓練期閃爍用音程色彩
const getIntervalColorClass = (interval, intervalLabel = null) => {
  const label = normalizeIntervalLabel(intervalLabel);

  if (interval === 0 || label === '1') {
    return 'fretboard-note--root-active';
  }

  if (['b3', '3', '5', 'b5'].includes(label) || [3, 4, 6, 7].includes(interval)) {
    return 'fretboard-note--chord-tone';
  }

  if (['b7', '7'].includes(label) || [10, 11].includes(interval)) {
    return 'fretboard-note--seventh';
  }

  return 'fretboard-note--scale-tone';
};

const formatIntervalLabel = (label) => {
  if (!label) return '';
  return String(label)
    .replace(/b/g, '♭')
    .replace(/#/g, '♯');
};

const isKeyIntervalMode = computed(() => props.intervalDisplayMode === 'key');

const getDisplayIntervalInfo = (cell) => {
  // 從 Key 看音程時，直接以目前 keyRoot 作為 1。
  // 這裡使用 I 的拼法作為大調 Key 內的基準顯示。
  if (isKeyIntervalMode.value) {
    const label = getIntervalName(cell.intervalFromKeyRoot, 'I');
    return {
      interval: cell.intervalFromKeyRoot,
      label
    };
  }

  // 從 Chord 看音程時，訓練音優先沿用 CAGED 資料內的語義音程。
  // 這可以保留 #4 / b5、6 / b6、7 / b7 這類調式差異。
  if (isActiveNote(cell) && props.activeNoteTarget?.intervalLabel) {
    return {
      interval: cell.intervalFromChord,
      label: props.activeNoteTarget.intervalLabel
    };
  }

  return {
    interval: cell.intervalFromChord,
    label: getIntervalName(cell.intervalFromChord, props.currentChord)
  };
};

const getDisplayIntervalLabel = (cell) => {
  return formatIntervalLabel(getDisplayIntervalInfo(cell).label);
};

const getDisplayIntervalColorClass = (cell) => {
  const info = getDisplayIntervalInfo(cell);
  return getIntervalColorClass(info.interval, info.label);
};

const getPrepGhostIntervalLabel = (cell) => {
  const ghostNote = getPrepGhostNote(cell);
  if (!ghostNote) return '';

  // 從 Key 看時，Prep 的灰色和弦音也改成 Key 基準。
  if (isKeyIntervalMode.value) {
    return formatIntervalLabel(getIntervalName(cell.intervalFromKeyRoot, 'I'));
  }

  // 從 Chord 看時，保留 voicing 資料裡的和弦功能音。
  return formatIntervalLabel(ghostNote.interval) ||
    getIntervalName(ghostNote.intervalFromChordRoot, props.currentChord);
};

// 判斷某個音是否為當前正在閃爍的 active note
const isActiveNote = (cell) => {
  if (!props.activeNoteTarget) return false;
  if (props.activeNoteTarget.type === 'default') {
    return props.activeNoteTarget.stringIndex === cell.stringIndex && props.activeNoteTarget.fret === cell.fret;
  }
  if (props.activeNoteTarget.type === 'custom') {
    return cell.note.absoluteNote === customActiveAbsoluteNote.value;
  }
  return false;
};

// Prep 階段暫時顯示的灰色 CAGED 和弦フォーム音符
const getPrepGhostNote = (cell) => {
  if (props.currentPhase !== 'prep') return null;
  return props.prepChordVoicingNotes.find(note =>
    note.stringIndex === cell.stringIndex && note.fret === cell.fret
  ) || null;
};

// 🪧 計算當前 CAGED 把位的「最大寬度長方形」音階區間 (取所有弦的最小~最大琴格)
//    刻意不沿著各弦的鋸齒邊界畫凸凹形狀，而是用一個齊整的長方形框住整個把位。
const scaleBounds = computed(() => {
  return getCagedScaleBounds(
    props.currentChord,
    props.currentDynamicForm,
    totalFrets
  );
});

const scaleRegionBox = computed(() => {
  // 優先使用上層傳入的「整組和弦進行」統一把位邊界 (所有和弦的 min～max)。
  if (props.scaleRegionOverride) {
    return {
      minFret: props.scaleRegionOverride.minFret,
      maxFret: props.scaleRegionOverride.maxFret
    };
  }
  if (!scaleBounds.value) return null;

  return {
    minFret: scaleBounds.value.minFret,
    maxFret: scaleBounds.value.maxFret
  };
});

// 🪧 為長方形區間內的琴格產生「虛線 + 半透明」標示用的 class
//    只在長方形四個外邊畫出虛線，圍出齊整的矩形把位。
const scaleRegionClasses = (cell) => {
  const box = scaleRegionBox.value;
  if (!box) return null;
  if (cell.fret < box.minFret || cell.fret > box.maxFret) return null;
  const topOut = cell.stringIndex === 0; // 1弦 (最上方)
  const bottomOut = cell.stringIndex === 5; // 6弦 (最下方)
  const lowerFretOut = cell.fret === box.minFret; // 琴頭(nut)側
  const higherFretOut = cell.fret === box.maxFret; // 琴橋側
  // 左手模式時琴頸方向左右相反，需對調左右邊界
  const leftOut = props.isLeftHanded ? higherFretOut : lowerFretOut;
  const rightOut = props.isLeftHanded ? lowerFretOut : higherFretOut;
  return {
    'fretboard-cell--scale-region': true,
    'region-edge-top': topOut,
    'region-edge-bottom': bottomOut,
    'region-edge-left': leftOut,
    'region-edge-right': rightOut
  };
};

// 📐 指板整體等比例縮放。
//    重點：不要再把指板高度強制拉滿 placeholder，否則 iPhone 橫向時
//    圓形、方形、琴格數字會因為高度被壓縮而變形或跑位。
//    這裡改成：在可用區域內，以固定長寬比放入最大的指板。
const fretboardScrollEl = ref(null);
const fretboardFitStyle = ref({});

// 指板整體的目標長寬比。
// 數字越大，指板越扁長；數字越小，指板越高。
// iPhone 橫向若仍覺得太高，可試 4.5；若覺得太扁，可試 3.9。
const FRETBOARD_ASPECT_RATIO = 4.25;

let resizeObserver = null;
let orientationTimer = null;

const updateFretboardFit = () => {
  const el = fretboardScrollEl.value;
  if (!el) return;

  const availableWidth = el.clientWidth;
  const availableHeight = el.clientHeight;

  if (!availableWidth || !availableHeight) return;

  // 先假設吃滿寬度，再檢查高度是否放得下。
  let width = availableWidth;
  let height = width / FRETBOARD_ASPECT_RATIO;

  // 如果高度超出，就改由高度反推寬度，維持長寬比。
  if (height > availableHeight) {
    height = availableHeight;
    width = height * FRETBOARD_ASPECT_RATIO;
  }

  // 音符與數字尺寸跟著「縮放後的指板高度」走，
  // 這樣圓形與方形會維持正確比例，不會被 row 高度壓扁。
  const noteSize = Math.max(13, Math.min(32, height * 0.095));
  const numberSize = Math.max(9, Math.min(14, height * 0.045));
  const numberMargin = Math.max(2, Math.min(10, height * 0.025));

  fretboardFitStyle.value = {
    width: `${width}px`,
    height: `${height}px`,
    '--fretboard-note-size': `${noteSize}px`,
    '--fretboard-number-size': `${numberSize}px`,
    '--fretboard-number-margin': `${numberMargin}px`
  };
};

const handleOrientationChange = () => {
  // iOS Safari 橫直切換後，clientWidth / clientHeight 會晚一點穩定。
  window.clearTimeout(orientationTimer);
  orientationTimer = window.setTimeout(updateFretboardFit, 120);
};

onMounted(() => {
  nextTick(updateFretboardFit);

  if (typeof ResizeObserver !== 'undefined' && fretboardScrollEl.value) {
    resizeObserver = new ResizeObserver(updateFretboardFit);
    resizeObserver.observe(fretboardScrollEl.value);
  }

  window.addEventListener('resize', updateFretboardFit);
  window.addEventListener('orientationchange', handleOrientationChange);
});

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
  window.clearTimeout(orientationTimer);
  window.removeEventListener('resize', updateFretboardFit);
  window.removeEventListener('orientationchange', handleOrientationChange);
});
</script>

<template>
  <div class="fretboard-container">
    
    <div class="fretboard-scroll" ref="fretboardScrollEl">
      <div class="fretboard-inner" :style="fretboardFitStyle">
        
        <!-- 指板主體 -->
        <div class="fretboard-body">

          <!-- 指板標示點 (Inlays) -->
          <div class="fretboard-inlays">
            <div 
              v-for="fret in fretsLayout" 
              :key="'inlay-'+fret" 
              class="fretboard-inlay-column"
              :class="{ 'fretboard-inlay-column--nut': fret === 0 }"
              :style="fretCellStyle(fret)"
            >
              <template v-if="fret !== 0 && fretMarkers.includes(fret)">
                <template v-if="fret === 12">
                  <div class="fretboard-inlay-dot fretboard-inlay-dot--upper"></div>
                  <div class="fretboard-inlay-dot fretboard-inlay-dot--lower"></div>
                </template>
                <div v-else class="fretboard-inlay-dot"></div>
              </template>
            </div>
          </div>

          <!-- 弦與音符 -->
          <div 
            v-for="(stringRow, sIdx) in fretboardGrid" 
            :key="sIdx" 
            class="fretboard-string-row"
          >
            <!-- 弦線本體 (粗細區分) -->
            <div 
              class="fretboard-string-wire" 
              :style="{ height: stringThickness[sIdx] + 'px' }"
            ></div>

            <!-- 各琴格的音符 -->
            <div 
              v-for="cell in stringRow" 
              :key="cell.fret" 
              class="fretboard-cell"
              :class="[
                {
                  'fretboard-cell--nut': cell.fret === 0,
                  'fretboard-cell--left-handed': props.isLeftHanded
                },
                scaleRegionClasses(cell)
              ]"
              :style="fretCellStyle(cell.fret)"
            >
              <!-- 低品格側邊界：右手模式畫左邊，左手模式畫右邊 -->
              <div
                v-if="cell.fret !== 0"
                class="fretboard-fret-wire fretboard-fret-wire--low"
              ></div>

              <!-- 最高顯示 fret 的高品格側邊界：補出 15 / 16 外側線，16 本身仍不顯示 -->
              <div
                v-if="cell.fret === totalFrets"
                class="fretboard-fret-wire fretboard-fret-wire--high"
              ></div>

              <!-- 音符顯示邏輯：只常駐顯示 key 正方形，其餘音只在播放到時亮起 -->
              <div v-if="isActiveNote(cell) || cell.note.isKeyRoot || getPrepGhostNote(cell)">
                
                <!-- ===== Train 階段：閃爍正在發聲的音 ===== -->
                <div v-if="props.currentPhase === 'train'">
                  <!-- 正在閃爍的 active note (播放到對應音時才亮起) -->
                  <div 
                    v-if="isActiveNote(cell)"
                    class="fretboard-note fretboard-note--active flex items-center justify-center"
                    :class="[
                      cell.note.isKeyRoot ? 'fretboard-note--square' : 'fretboard-note--circle',
                      getDisplayIntervalColorClass(cell),
                      props.activeNoteTarget?.type === 'custom' ? 'fretboard-note--custom-ring' : 'fretboard-note--bounce'
                    ]"
                  >
                    <span class="text-[0.65rem] font-black leading-none tracking-tighter">
                      {{ getDisplayIntervalLabel(cell) }}
                    </span>
                  </div>

                  <!-- key 根音正方形 (常駐顯示) -->
                  <div 
                    v-else-if="cell.note.isKeyRoot"
                    class="fretboard-note fretboard-note--dim fretboard-note--square"
                  ></div>
                </div>

                <!-- ===== Prep / Predict 階段：Prep 顯示灰色 CAGED 和弦フォーム，其餘只顯示 key 正方形 ===== -->
                <div v-else>
                  <div 
                    v-if="getPrepGhostNote(cell)"
                    class="fretboard-note fretboard-note--ghost-chord"
                    :class="cell.note.isKeyRoot ? 'fretboard-note--square' : 'fretboard-note--circle'"
                  >
                    <span class="text-[0.65rem] font-black leading-none tracking-tighter">
                      {{ getPrepGhostIntervalLabel(cell) }}
                    </span>
                  </div>

                  <div 
                    v-else-if="cell.note.isKeyRoot"
                    class="fretboard-note fretboard-note--dim fretboard-note--square"
                  ></div>
                </div>

              </div>
              
              <!-- 非調內音：不顯示 -->
              <div v-else class="fretboard-note-placeholder"></div>
            </div>
          </div>
        </div>

        <!-- 琴格編號列 -->
        <div class="fretboard-fret-numbers">
          <div 
            v-for="fret in fretsLayout" 
            :key="'num-'+fret" 
            class="fretboard-fret-number"
            :class="{ 'fretboard-fret-number--nut': fret === 0 }"
            :style="fretCellStyle(fret)"
          >
            <span :class="{ 'fretboard-fret-number--marker': fretMarkers.includes(fret) }">
              {{ fret === 0 ? '空' : fret }}
            </span>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* ============================================
   指板容器
   ============================================ */
.fretboard-container {
  width: 100%;
  max-width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(24, 24, 27, 0.6);
  padding: clamp(0.25rem, 1.2dvh, 1.5rem);
  border-radius: 1.5rem;
  border: 1px solid rgb(39, 39, 42);
  backdrop-filter: blur(16px);
  overflow: hidden;
}

.fretboard-scroll {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 橫向且高度受限時，收斂指板容器留白並縮短弦距 / 音符，
   讓自動縮放以「寬度」為準，使指板能延伸至整個可用寬度。 */
@media (orientation: landscape) and (max-height: 600px) {
  .fretboard-container {
    padding: 0.3rem 0.2rem;
    border-radius: 1rem;
  }
}

@media (orientation: landscape) and (max-height: 430px) {
  .fretboard-container {
    padding: 0.2rem 0.15rem;
    border-radius: 0.85rem;
  }

  .fretboard-note--active {
    transform: scale(1.06);
  }

  @keyframes noteBounce {
    0% { transform: scale(0.86); opacity: 0.6; }
    50% { transform: scale(1.12); }
    100% { transform: scale(1.06); opacity: 1; }
  }
}

.fretboard-inner {
  max-width: 100%;
  max-height: 100%;
  min-width: 0;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;

  /* JS 計算前的 fallback。實際尺寸會由 fretboardFitStyle 覆蓋。 */
  width: 100%;
  aspect-ratio: 4.25 / 1;

  --fretboard-note-size: 18px;
  --fretboard-number-size: 11px;
  --fretboard-number-margin: 4px;
}

/* ============================================
   指板主體 (木板效果)
   ============================================ */
.fretboard-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  background: linear-gradient(180deg, #1a1510 0%, #2a2018 50%, #1a1510 100%);
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}

/* ============================================
   弦列 (每根弦的行)
   ============================================ */
.fretboard-string-row {
  flex: 1 1 0;
  min-height: 0;
  height: auto;
  display: flex;
  align-items: center;
  position: relative;
  overflow: visible;
  /* 不加 border-bottom，讓弦之間不要有分隔線。 */
}

/* ============================================
   弦線本體 — 金屬質感，粗細不同
   ============================================ */
.fretboard-string-wire {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  background: linear-gradient(
    180deg,
    rgba(200, 190, 170, 0.7) 0%,
    rgba(160, 150, 130, 0.9) 50%,
    rgba(120, 110, 90, 0.7) 100%
  );
  z-index: 1;
  border-radius: 1px;
  box-shadow: 0 0 2px rgba(200, 190, 170, 0.3);
}

/* ============================================
   琴格 (Cell)
   ============================================ */
.fretboard-cell {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 10;
  transition: background-color 0.2s;
}

.fretboard-cell--nut {
  border-right: 4px solid rgb(113, 113, 122);
  background: rgba(24, 24, 27, 0.9);
}

/* 左手模式時，空弦欄在右側；nut 粗線要畫在 0 / 1 之間 */
.fretboard-cell--left-handed.fretboard-cell--nut {
  border-right: 0;
  border-left: 4px solid rgb(113, 113, 122);
}

.fretboard-cell--in-range {
  background: transparent;
}

/* ============================================
   音階把位區間標示 (虛線 + 半透明)
   讓使用者一眼看出當前和弦行進該在哪個格區間找音階
   ============================================ */
.fretboard-cell--scale-region {
  background: rgba(52, 211, 153, 0.07);
}

/* 只在區間外緣畫出虛線，內側格不畫，藉此圍出整個 CAGED 把位形狀 */
.fretboard-cell--scale-region::after {
  content: '';
  position: absolute;
  inset: 3px;
  pointer-events: none;
  border: 0 dashed rgba(52, 211, 153, 0.55);
  z-index: 2;
}

.region-edge-top::after { border-top-width: 1.5px; }
.region-edge-bottom::after { border-bottom-width: 1.5px; }
.region-edge-left::after { border-left-width: 1.5px; }
.region-edge-right::after { border-right-width: 1.5px; }

/* ============================================
   琴格分隔線 (Fret Wire) — 只有垂直的金屬線
   ============================================ */
.fretboard-fret-wire {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(
    180deg,
    rgba(180, 170, 150, 0.2) 0%,
    rgba(180, 170, 150, 0.6) 50%,
    rgba(180, 170, 150, 0.2) 100%
  );
  z-index: 0;
}

/* 低品格側邊界：右手模式時在 cell 左邊 */
.fretboard-fret-wire--low {
  left: 0;
}

/* 低品格側邊界：左手模式時在 cell 右邊 */
.fretboard-cell--left-handed .fretboard-fret-wire--low {
  left: auto;
  right: 0;
}

/* 高品格側邊界：右手模式時補在最高 fret 的右邊，也就是 15 / 16 */
.fretboard-fret-wire--high {
  right: 0;
}

/* 高品格側邊界：左手模式時補在最高 fret 的左邊，也就是 15 / 16 */
.fretboard-cell--left-handed .fretboard-fret-wire--high {
  right: auto;
  left: 0;
}

/* ============================================
   指板標示點 (Inlays)
   ============================================ */
.fretboard-inlays {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  pointer-events: none;
  z-index: 0;
}

.fretboard-inlay-column {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.fretboard-inlay-column--nut {
  position: relative;
}

.fretboard-inlay-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(200, 190, 170, 0.35) 0%, rgba(160, 150, 130, 0.15) 100%);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
}

.fretboard-inlay-dot--upper {
  position: absolute;
  top: 30%;
  transform: translateY(-50%);
}

.fretboard-inlay-dot--lower {
  position: absolute;
  bottom: 30%;
  transform: translateY(50%);
}

/* ============================================
   音符基底
   ============================================ */
.fretboard-note {
  width: var(--fretboard-note-size);
  height: var(--fretboard-note-size);
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 20;
  transition: all 0.07s ease;
}

.fretboard-note--square {
  border-radius: 4px;
}

.fretboard-note--circle {
  border-radius: 50%;
}

.fretboard-note-placeholder {
  width: var(--fretboard-note-size);
  height: var(--fretboard-note-size);
  flex: 0 0 auto;
}

.fretboard-note span {
  font-size: calc(var(--fretboard-note-size) * 0.36);
}

/* ============================================
   音符狀態 — 灰色靜默 (無音名)
   ============================================ */
.fretboard-note--muted {
  background: rgb(63, 63, 70);
  border: 1px solid rgb(82, 82, 91);
}

.fretboard-note--dim {
  background: rgb(39, 39, 42);
  border: 1px solid rgb(63, 63, 70);
}

/* Prep 階段的 CAGED 和弦形狀提示：灰色圓點 */
.fretboard-note--ghost-chord {
  background: rgba(161, 161, 170, 0.58);
  border: 1px solid rgba(212, 212, 216, 0.85);
  color: rgb(24, 24, 27);
  box-shadow: 0 0 10px rgba(161, 161, 170, 0.38);
}

/* ============================================
   和弦根音 (紅色，不改變形狀)
   ============================================ */
.fretboard-note--chord-root {
  background: rgb(220, 38, 38);
  border: 1px solid rgb(248, 113, 113);
  box-shadow: 0 0 12px rgba(220, 38, 38, 0.7);
}

/* ============================================
   訓練期 Active Note — 色彩美學閃爍
   ============================================ */
.fretboard-note--active {
  transform: scale(1.15);
}

.fretboard-note--bounce {
  animation: noteBounce 0.3s ease-out;
}

.fretboard-note--custom-ring {
  box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.8) !important;
}

/* 根音 (紅) */
.fretboard-note--root-active {
  background: rgb(239, 68, 68);
  border: 1px solid rgb(248, 113, 113);
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.9);
}

/* 三五度 (藍) */
.fretboard-note--chord-tone {
  background: rgb(59, 130, 246);
  border: 1px solid rgb(96, 165, 250);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.7);
}

/* 七度 (紫) */
.fretboard-note--seventh {
  background: rgb(147, 51, 234);
  border: 1px solid rgb(192, 132, 252);
  box-shadow: 0 0 12px rgba(147, 51, 234, 0.7);
}

/* 其餘音階 (綠) */
.fretboard-note--scale-tone {
  background: rgb(16, 185, 129);
  border: 1px solid rgb(52, 211, 153);
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.7);
}

/* ============================================
   彈跳動畫
   ============================================ */
@keyframes noteBounce {
  0% { transform: scale(0.8); opacity: 0.6; }
  50% { transform: scale(1.25); }
  100% { transform: scale(1.15); opacity: 1; }
}

/* ============================================
   琴格編號列
   ============================================ */
.fretboard-fret-numbers {
  flex: 0 0 auto;
  display: flex;
  width: 100%;
  margin-top: var(--fretboard-number-margin);
  font-size: var(--fretboard-number-size);
  line-height: 1;
  font-weight: 700;
  color: rgb(161, 161, 170);
  position: relative;
  z-index: 30;
}

.fretboard-fret-number {
  flex: 1;
  text-align: center;
}

.fretboard-fret-number--marker {
  color: rgb(228, 228, 231);
  font-size: 1.12em;
  font-weight: 900;
  border-bottom: 1px solid rgb(52, 211, 153);
  padding-bottom: 2px;
}
</style>