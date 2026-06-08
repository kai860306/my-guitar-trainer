<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
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
  allowOpenStrings: Boolean
});

const totalFrets = 15;
const strings = [0, 1, 2, 3, 4, 5];
const fretMarkers = [3, 5, 7, 9, 12, 15];

// 🎸 每根弦的粗細 (1弦最細 → 6弦最粗)
const stringThickness = [1, 1.5, 2, 2.5, 3, 3.5];

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
      let isThisNodeInMode = false;

      if (note && rootAbs !== null) {
        intervalFromChord = (note.absoluteNote - rootAbs + 12) % 12;
        isThisNodeInMode = CHORD_MODES[props.currentChord]?.mode.includes(intervalFromChord) || false;
      }

      return {
        stringIndex,
        fret,
        note,
        intervalFromChord,
        isThisNodeInMode
      };
    });
  });
});

// 🎨 訓練期閃爍用音程色彩
const getIntervalColorClass = (interval, intervalLabel = null) => {
  const label = intervalLabel || '';

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

const getDisplayIntervalLabel = (cell) => {
  if (isActiveNote(cell) && props.activeNoteTarget?.intervalLabel) {
    return formatIntervalLabel(props.activeNoteTarget.intervalLabel);
  }

  return getIntervalName(cell.intervalFromChord, props.currentChord);
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

// 📐 依容器寬度自動縮放指板，避免在小螢幕被裁切 / 需橫向捲動
const scrollEl = ref(null);
const innerEl = ref(null);
const fitScale = ref(1);
let resizeObserver = null;

const updateFit = () => {
  if (!scrollEl.value || !innerEl.value) return;
  const available = scrollEl.value.clientWidth;
  const natural = innerEl.value.offsetWidth || 1;
  const scale = available < natural ? available / natural : 1;
  fitScale.value = scale;
  // 同步縮放後的高度，移除底部多餘空白
  scrollEl.value.style.height = (innerEl.value.offsetHeight * scale) + 'px';
};

onMounted(() => {
  updateFit();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateFit);
    if (scrollEl.value) resizeObserver.observe(scrollEl.value);
  }
  window.addEventListener('resize', updateFit);
});

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
  window.removeEventListener('resize', updateFit);
});
</script>

<template>
  <div class="fretboard-container">
    
    <div class="fretboard-scroll" ref="scrollEl">
      <div class="fretboard-inner" ref="innerEl" :style="{ transform: 'scale(' + fitScale + ')', transformOrigin: 'top left' }">
        
        <!-- 指板主體 -->
        <div class="fretboard-body">

          <!-- 指板標示點 (Inlays) -->
          <div class="fretboard-inlays">
            <div 
              v-for="fret in fretsLayout" 
              :key="'inlay-'+fret" 
              class="fretboard-inlay-column"
              :class="{ 'fretboard-inlay-column--nut': fret === 0 }"
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
              :class="[{ 'fretboard-cell--nut': cell.fret === 0 }, scaleRegionClasses(cell)]"
            >
              <!-- 琴格分隔線 (fret wire) — 僅垂直線 -->
              <div v-if="cell.fret !== 0" class="fretboard-fret-wire"></div>

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
                      getIntervalColorClass(cell.intervalFromChord),
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
                      {{ formatIntervalLabel(getPrepGhostNote(cell).interval) || getIntervalName(getPrepGhostNote(cell).intervalFromChordRoot, props.currentChord) }}
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
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(24, 24, 27, 0.6);
  padding: 1.5rem;
  border-radius: 1.5rem;
  border: 1px solid rgb(39, 39, 42);
  backdrop-filter: blur(16px);
}

.fretboard-scroll {
  width: 100%;
  overflow: hidden;
  padding-bottom: 0.5rem;
  user-select: none;
}

.fretboard-inner {
  min-width: 850px;
  position: relative;
}

/* ============================================
   指板主體 (木板效果)
   ============================================ */
.fretboard-body {
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
  height: 3.5rem;
  display: flex;
  align-items: center;
  position: relative;
  /* 不加 border-bottom — 弦之間不要有分隔線 */
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
  max-width: 55px;
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
  left: 0;
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
  max-width: 55px;
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
  width: 2rem;
  height: 2rem;
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
  width: 2rem;
  height: 2rem;
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
  display: flex;
  margin-top: 0.75rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: rgb(113, 113, 122);
  position: relative;
}

.fretboard-fret-number {
  flex: 1;
  text-align: center;
}

.fretboard-fret-number--nut {
  max-width: 55px;
}

.fretboard-fret-number--marker {
  color: rgb(228, 228, 231);
  font-size: 1rem;
  font-weight: 900;
  border-bottom: 1px solid rgb(52, 211, 153);
  padding-bottom: 2px;
}
</style>