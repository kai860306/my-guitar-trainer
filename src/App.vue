<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import Fretboard from './components/Fretboard.vue';
import {
  NOTE_NAMES,
  CHORD_MODES,
  PROGRESSION_PRESETS,
  getDynamicCagedForm,
  resolveCagedChordVoicing
} from './utils/musicTheory.js';

import {
  generateCagedScaleSequence,
  validateCagedScales,
  getCagedScaleBounds
} from './utils/cagedScales.js';
import { AudioEngine } from './utils/audioEngine.js';

// ===============================
// 預設設定
// ===============================
// 這些值會在瀏覽器沒有保存設定時使用。
// 若使用者已經改過設定，會優先讀取 localStorage 裡保存的值。
const DEFAULT_KEY_ROOT = 0; // 0=C, 1=C#, 2=D ... 11=B
const DEFAULT_PROGRESSION_NAME = 'I - IV - V';
const DEFAULT_STAGE = 1;

// 預設 BPM。
// 第一次開啟或沒有瀏覽器保存設定時，會使用這個速度。
const DEFAULT_BPM = 85;

// BPM 可調範圍。
// UI 按鈕與 localStorage 讀取時都會用這個範圍做限制。
const MIN_BPM = 40;
const MAX_BPM = 240;

// 預設左右手模式。
// false = 右手模式，true = 左手模式。
const DEFAULT_IS_LEFT_HANDED = false;

// 畫面初始顯示用。
// 若之後有保存設定，onMounted 時會依照保存的和弦進行重新覆蓋。
const currentChord = ref('I');
const nextChord = ref('IV');

// 基礎設定狀態
const keyRoot = ref(DEFAULT_KEY_ROOT);
const selectedProgressionName = ref(DEFAULT_PROGRESSION_NAME);
const selectedStage = ref(DEFAULT_STAGE);

const generateId = () => Math.random().toString(36).substr(2, 9);
const customProgressionArray = ref([]);
// 可用和弦庫 (依性質分類，方便日後擴充)
const chordLibrary = [
  { label: '順階三和弦', chords: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] },
  { label: '順階七和弦', chords: ['IM7', 'iim7', 'iiim7', 'IVM7', 'V7', 'vim7', 'viim7b5'] },
  { label: '調外 / 借用和弦', chords: ['bIII', 'bVI', 'bVII', 'vii°7'] }
];
const activeGap = ref(null);
const isCustomProgMode = ref(false);

// 統一的指針拖曳狀態 (同時支援滑鼠與觸控)
const progContainerRef = ref(null);
const dragState = ref(null);
const DRAG_THRESHOLD = 6;

const bpm = ref(DEFAULT_BPM);
const isLeftHanded = ref(DEFAULT_IS_LEFT_HANDED);

// 自訂訓練音序器狀態
const isCustomSequenceMode = ref(false);
const customSequenceInput = ref('L5, L6, 1, 2, L7, 1');

// 運行與 UI 切換狀態
const isTrainingActive = ref(false); // 點擊 Start 切換至極簡運動 UI
const isPlaying = ref(false);

// 來自音訊引擎的即時時序同步訊號
const currentPhase = ref('prep'); // prep, train, predict
// 訓練最開始的「導入預告期」：第一個和弦在 prep 播放前，先走 4 拍 predict，
// 此期間僅節拍器 + 第一個和弦置中閃爍，不刮弦也不顯示「→ 下一個和弦」。
const isIntroPredict = ref(false);
// 是否仍未走過「第一個和弦的第一次 chordStart」：
// 用來避免導入預告期推進的 globalBeat 讓第一輪被誤判為「已完成一輪」而推進把位。
const isFirstChordStart = ref(true);
const localBeat4 = ref(0);

const currentChordIdx = ref(0);
const activeNoteTarget = ref(null);

let trainerAudio = null;

// ===============================
// 瀏覽器本機設定保存
// ===============================
// 靜態網站也可以使用 localStorage。
// 它會把設定保存到目前瀏覽器裡，不需要後端、不需要資料庫。
// 注意：
// - 同一個瀏覽器、同一個網域會保留設定。
// - 無痕模式、清除網站資料、換瀏覽器時，設定會消失。
// - localStorage 不能保存函式，只適合保存 JSON 化的設定資料。
const SETTINGS_STORAGE_KEY = 'caged-guitar-trainer-settings-v1';

const getDefaultSettings = () => ({
  keyRoot: DEFAULT_KEY_ROOT,
  selectedProgressionName: DEFAULT_PROGRESSION_NAME,
  customProgressionArray: [],
  isCustomProgMode: false,
  bpm: DEFAULT_BPM,
  selectedStage: DEFAULT_STAGE,
  isLeftHanded: DEFAULT_IS_LEFT_HANDED,
  isCustomSequenceMode: false,
  customSequenceInput: 'L5, L6, 1, 2, L7, 1'
});

const applySettingsToState = (settings) => {
  const defaults = getDefaultSettings();
  const safeSettings = {
    ...defaults,
    ...(settings && typeof settings === 'object' ? settings : {})
  };

  keyRoot.value = Number.isInteger(safeSettings.keyRoot)
    ? Math.min(11, Math.max(0, safeSettings.keyRoot))
    : defaults.keyRoot;

  selectedProgressionName.value = PROGRESSION_PRESETS[safeSettings.selectedProgressionName]
    ? safeSettings.selectedProgressionName
    : defaults.selectedProgressionName;

  customProgressionArray.value = Array.isArray(safeSettings.customProgressionArray)
    ? safeSettings.customProgressionArray
        .filter(item => item && typeof item.value === 'string' && CHORD_MODES[item.value])
        .map(item => ({
          id: typeof item.id === 'string' ? item.id : generateId(),
          value: item.value
        }))
    : defaults.customProgressionArray;

  isCustomProgMode.value = Boolean(safeSettings.isCustomProgMode);

  // 自訂進行模式但沒有任何和弦時，避免訓練變成空進行。
  if (isCustomProgMode.value && customProgressionArray.value.length === 0) {
    isCustomProgMode.value = false;
  }

  bpm.value = Number.isFinite(Number(safeSettings.bpm))
    ? Math.min(MAX_BPM, Math.max(MIN_BPM, Number(safeSettings.bpm)))
    : defaults.bpm;

  selectedStage.value = Number.isInteger(Number(safeSettings.selectedStage))
    ? Math.min(5, Math.max(1, Number(safeSettings.selectedStage)))
    : defaults.selectedStage;

  isLeftHanded.value = Boolean(safeSettings.isLeftHanded);
  isCustomSequenceMode.value = Boolean(safeSettings.isCustomSequenceMode);

  customSequenceInput.value = typeof safeSettings.customSequenceInput === 'string'
    ? safeSettings.customSequenceInput
    : defaults.customSequenceInput;
};

const loadSavedSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);

    // 沒有保存資料時，套用預設值：
    // 和弦進行 = I - IV - V
    // Stage = 1
    if (!raw) {
      applySettingsToState(getDefaultSettings());
      return;
    }

    applySettingsToState(JSON.parse(raw));
  } catch (error) {
    console.warn('讀取本機設定失敗，改用預設設定：', error);
    applySettingsToState(getDefaultSettings());
  }
};

const saveSettings = () => {
  try {
    const settings = {
      keyRoot: keyRoot.value,
      selectedProgressionName: selectedProgressionName.value,
      customProgressionArray: customProgressionArray.value,
      isCustomProgMode: isCustomProgMode.value,
      bpm: bpm.value,
      selectedStage: selectedStage.value,
      isLeftHanded: isLeftHanded.value,
      isCustomSequenceMode: isCustomSequenceMode.value,
      customSequenceInput: customSequenceInput.value
    };

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    // Safari 私密模式或瀏覽器限制儲存時可能失敗。
    // 失敗時不影響訓練功能，只是不保存設定。
    console.warn('保存本機設定失敗：', error);
  }
};

const syncDisplayedChordFromSettings = () => {
  const progArray = getActiveProgression();

  currentChord.value = progArray[0] || 'I';
  nextChord.value = progArray.length > 1 ? progArray[1] : currentChord.value;
  currentChordIdx.value = 0;
};

onMounted(() => {
  // 先讀取瀏覽器保存設定。
  // 如果沒有保存資料，會自動使用：
  // - 和弦進行：I - IV - V
  // - Stage：Stage 1
  loadSavedSettings();
  syncDisplayedChordFromSettings();

  trainerAudio = new AudioEngine();
  syncEngineParams();

  // 開發時檢查 CAGED_SCALES 是否完整建立 35 個 forms。
  const scaleErrors = validateCagedScales();
  if (scaleErrors.length > 0) {
    console.warn('CAGED_SCALES 資料檢查發現問題：', scaleErrors);
  }

  document.addEventListener('fullscreenchange', syncFullscreenState);
  document.addEventListener('webkitfullscreenchange', syncFullscreenState);
});

// 🖥️ 全螢幕顯示
const isFullscreen = ref(false);

const syncFullscreenState = () => {
  isFullscreen.value = !!(document.fullscreenElement || document.webkitFullscreenElement);
};

const toggleFullscreen = async () => {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  } catch (e) {
    // 部分行動瀏覽器 (如 iOS Safari) 不支援 Fullscreen API，
    // 已透過 meta 標籤提供「加入主畫面」全螢幕的後備方案。
    console.warn('Fullscreen API 不被支援：', e);
  }
};

// 解析和弦進行級數
const getActiveProgression = () => {
  if (!isCustomProgMode.value) {
    return PROGRESSION_PRESETS[selectedProgressionName.value];
  }
  return customProgressionArray.value.length > 0 
    ? customProgressionArray.value.map(c => typeof c === 'string' ? c : c.value) 
    : ['I'];
};

// 依指針位置計算插入縫隙索引
const updateActiveGap = (clientX) => {
  const container = progContainerRef.value;
  if (!container) { activeGap.value = null; return; }
  const cards = Array.from(container.querySelectorAll('[data-prog-card]'))
    .filter(c => !c.classList.contains('list-leave-active'));
  if (cards.length === 0) { activeGap.value = 0; return; }
  let targetIndex = cards.length;
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect();
    const cardCenter = rect.left + rect.width / 2;
    if (clientX < cardCenter) { targetIndex = i; break; }
  }
  activeGap.value = targetIndex;
};

const onDragPointerMove = (e) => {
  const st = dragState.value;
  if (!st || e.pointerId !== st.pointerId) return;
  st.x = e.clientX;
  st.y = e.clientY;
  if (!st.dragging) {
    if (Math.hypot(e.clientX - st.startX, e.clientY - st.startY) < DRAG_THRESHOLD) return;
    st.dragging = true;
  }
  e.preventDefault();
  updateActiveGap(e.clientX);
};

const onDragPointerUp = () => {
  const st = dragState.value;
  window.removeEventListener('pointermove', onDragPointerMove);
  window.removeEventListener('pointerup', onDragPointerUp);
  window.removeEventListener('pointercancel', onDragPointerUp);
  if (!st) return;

  if (st.dragging) {
    const targetIndex = activeGap.value !== null ? activeGap.value : customProgressionArray.value.length;
    if (st.source === 'library') {
      customProgressionArray.value.splice(targetIndex, 0, { id: generateId(), value: st.item });
      dragState.value = null;
      activeGap.value = null;
      syncEngineParams();
      return;
    } else if (st.source === 'progression') {
      const oldIdx = st.item;
      const needMove = oldIdx !== targetIndex && oldIdx + 1 !== targetIndex;
      const adjusted = targetIndex > oldIdx ? targetIndex - 1 : targetIndex;
      dragState.value = null;
      activeGap.value = null;
      // 不論順序有無改變，都把被拖曳的字卡「換上全新的 id」後重新插入。
      // 拖曳期間該字卡為 display:none 而失去版面座標，若直接還原，
      // TransitionGroup 會誤判其移動前座標為 (0,0) 而觸發從左上角飛入的 FLIP。
      // 換新 id → Vue 視為全新進場 (enter)，套用 .list-enter 原地淡入縮放動畫，
      // 徹底避開破圖；其餘被擠開的字卡仍保有座標，照常以 .list-move 平滑滑動。
      const finalIdx = needMove ? adjusted : oldIdx;
      const chordObj = customProgressionArray.value[oldIdx];
      customProgressionArray.value.splice(oldIdx, 1);
      customProgressionArray.value.splice(finalIdx, 0, { id: generateId(), value: chordObj.value });
      syncEngineParams();
      return;
    }
  } else {
    // 未超過拖曳門檻 → 視為點擊：library 新增 / progression 移除
    if (st.source === 'library') {
      addChord(st.item);
    } else if (st.source === 'progression') {
      removeChord(st.item);
    }
  }

  dragState.value = null;
  activeGap.value = null;
};

const startDrag = (e, item, source) => {
  // 滑鼠僅響應左鍵；觸控/筆皆可
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  dragState.value = {
    item,
    source,
    label: source === 'library' ? item : customProgressionArray.value[item].value,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    x: e.clientX,
    y: e.clientY,
    dragging: false
  };
  window.addEventListener('pointermove', onDragPointerMove, { passive: false });
  window.addEventListener('pointerup', onDragPointerUp);
  window.addEventListener('pointercancel', onDragPointerUp);
};

const addChord = (chordValue) => {
  customProgressionArray.value.push({ id: generateId(), value: chordValue });
  syncEngineParams();
};

const removeChord = (index) => {
  customProgressionArray.value.splice(index, 1);
  syncEngineParams();
};

// 解析自訂音序代號
const getCustomSequenceTokens = () => {
  return customSequenceInput.value.split(',').map(s => s.trim());
};

const cagedCycle = ref(0);

const currentDynamicForm = computed(() => {
  return getDynamicCagedForm(currentChord.value, keyRoot.value, cagedCycle.value);
});

const minFret = computed(() => currentDynamicForm.value ? currentDynamicForm.value.min : 0);
const maxFret = computed(() => currentDynamicForm.value ? currentDynamicForm.value.max : 4);
const currentFormName = computed(() => currentDynamicForm.value ? currentDynamicForm.value.name : 'C');

// ✨ 下一個和弦黑/紅閃爍的週期與 BPM 同步：一拍一次完整的黑紅循環
const flashStyle = computed(() => ({
  animationDuration: (60 / bpm.value) + 's'
}));

// 🎵 訓練頁面顯示用的當前和弦進行清單 (供高亮目前和弦)
const activeProgressionList = computed(() => getActiveProgression());

// 🎯 指板視覺專用的把位：預告期 (predict) 時提前切換到「下一個目標和弦」的 CAGED 把位，
//          讓音階虛線半透明長方形提前導航使用者下一個要找音的區間。
const displayDynamicForm = computed(() => {
  // 導入預告期接的是第一個和弦本身的 prep，因此把位維持第一個和弦，不提前切到下一個。
  if (isIntroPredict.value) {
    return currentDynamicForm.value;
  }
  if (isPlaying.value && currentPhase.value === 'predict') {
    const progArray = getActiveProgression();
    const nextIdx = (currentChordIdx.value + 1) % progArray.length;
    // 若下一個和弦回到進行的第 0 項 (整輪結束)，把位會推進一個 cycle。
    const nextCycle = cagedCycle.value + (nextIdx === 0 ? 1 : 0);
    const form = getDynamicCagedForm(nextChord.value, keyRoot.value, nextCycle);
    if (form) return form;
  }
  return currentDynamicForm.value;
});

// 指板把位邊界：不再對「同一輪和弦進行」中的每個和弦各畫各的邊界，
// 而是取整組和弦進行內所有和弦的最小～最大琴格，畫成同一個齊整的長方形把位。
// 指板總格數需與 Fretboard 內的 totalFrets 一致。
const FRETBOARD_TOTAL_FRETS = 15;

const computeProgressionScaleRegion = (cycle) => {
  const progArray = getActiveProgression();
  let minFret = Infinity;
  let maxFret = -Infinity;
  for (const chord of progArray) {
    const form = getDynamicCagedForm(chord, keyRoot.value, cycle);
    const bounds = getCagedScaleBounds(chord, form, FRETBOARD_TOTAL_FRETS);
    if (!bounds) continue;
    minFret = Math.min(minFret, bounds.minFret);
    maxFret = Math.max(maxFret, bounds.maxFret);
  }
  if (minFret === Infinity || maxFret === -Infinity) return null;
  return { minFret, maxFret };
};

const displayScaleRegion = computed(() => {
  // 預告期 (predict) 且下一個和弦回到進行第 0 項時，整輪結束、把位推進一個 cycle，
  //   提前切換到下一輪進行的整組邊界 (與 displayDynamicForm 的推進邏輯一致)。
  let cycle = cagedCycle.value;
  if (!isIntroPredict.value && isPlaying.value && currentPhase.value === 'predict') {
    const progArray = getActiveProgression();
    const nextIdx = (currentChordIdx.value + 1) % progArray.length;
    if (nextIdx === 0) cycle = cagedCycle.value + 1;
  }
  return computeProgressionScaleRegion(cycle);
});

// 🎸 Prep 階段顯示與播放用的資料定義式 CAGED 和弦フォーム
const prepChordVoicingNotes = computed(() => {
  if (!currentDynamicForm.value) return [];
  return resolveCagedChordVoicing(keyRoot.value, currentChord.value, currentDynamicForm.value);
});

// 🔄 同步前端面板參數至音訊引擎
const syncEngineParams = () => {
  if (!trainerAudio) return;
  const prog = getActiveProgression();
  const progArray = getActiveProgression();
  const customTokens = getCustomSequenceTokens();
  
  // 生成當前自動爬音序列
  const activeChord = isPlaying.value ? currentChord.value : progArray[0];
  // 把位必須與 activeChord 相符；未播放時 currentDynamicForm 仍是舊和弦 (如初始 vi)，
  // 不能直接拿來算，否則會產生「和弦對不上把位」的錯誤爬音 (第一次開始播 vi 的 bug)。
  const activeForm = isPlaying.value
    ? currentDynamicForm.value
    : getDynamicCagedForm(activeChord, keyRoot.value, cagedCycle.value);
  const cagedSeq = generateCagedScaleSequence(
    keyRoot.value,
    activeChord,
    activeForm,
    selectedStage.value,
    false
  );

  const prepVoicingNotes = resolveCagedChordVoicing(keyRoot.value, activeChord, activeForm);
  
  trainerAudio.setBPM(bpm.value);
  trainerAudio.updateParams(
    progArray,
    selectedStage.value,
    false,
    isCustomSequenceMode.value,
    customTokens,
    cagedSeq,
    keyRoot.value,
    prepVoicingNotes,
    cagedCycle.value
  );
};

// 監聽設定狀態：
// 1. 保存到瀏覽器 localStorage。
// 2. 同步到音訊引擎。
// 注意：cagedCycle 是訓練進行中的暫時狀態，不需要保存。
watch([
  keyRoot,
  selectedProgressionName,
  customProgressionArray,
  isCustomProgMode,
  bpm,
  selectedStage,
  isLeftHanded,
  isCustomSequenceMode,
  customSequenceInput
], () => {
  saveSettings();
  syncEngineParams();
}, { deep: true });

// cagedCycle 只影響播放中的 CAGED 把位推進，不應該寫入 localStorage。
watch(cagedCycle, () => {
  syncEngineParams();
});

// 啟動訓練
const handleTogglePlay = () => {
  if (!trainerAudio) return;
  
  // 點擊開始時，直接切換到極簡運動佈局
  if (!isTrainingActive.value) {
    isTrainingActive.value = true;
  }

  // 由停止狀態重新開始時，先把和弦顯示與把位狀態歸位到進行的第 0 項，
  // 確保第一拍顯示與聲音都對應正確的起始和弦 (避免殘留初始 vi)。
  if (!isPlaying.value) {
    cagedCycle.value = 0;
    const progArray = getActiveProgression();
    currentChord.value = progArray[0];
    nextChord.value = progArray.length > 1 ? progArray[1] : progArray[0];
    currentChordIdx.value = 0;
    // 開始的第一段是導入預告期 (predict)：立即進入 predict 狀態，
    // 避免第一個 intro tick 到達前，指板因 prep 狀態瞬間畫出和弦音。
    currentPhase.value = 'predict';
    isIntroPredict.value = true;
    isFirstChordStart.value = true;
    localBeat4.value = 0;
  }

  syncEngineParams();
  const playingState = trainerAudio.toggle();
  isPlaying.value = playingState;

  if (playingState) {
    // 訂閱硬體時鐘回呼
    trainerAudio.onBeatTrigger = (tickData) => {
      currentPhase.value = tickData.phase;
      isIntroPredict.value = !!tickData.isIntroPredict;
      localBeat4.value = tickData.localBeat4;
      currentChord.value = tickData.currentChord;
      nextChord.value = tickData.nextChord;
      currentChordIdx.value = tickData.currentChordIdx;
      activeNoteTarget.value = tickData.activeNoteTarget;

      // 當和弦輪轉時，重新計算下一輪的預設爬音序列
      if (tickData.isChordStart || tickData.isRoundEnd) {
        
        // 【修正邏輯】當一個完整的進行輪迴結束，回到第 0 個和弦的第一拍時，才將把位推進。
        // 不能用 globalBeat，因為導入預告期會多推進 4 拍，會讓第一輪被誤判。
        if (tickData.isChordStart && tickData.currentChordIdx === 0) {
          if (isFirstChordStart.value) {
            isFirstChordStart.value = false;
          } else {
            cagedCycle.value++;
          }
        }

        syncEngineParams();
      }
    };
  } else {
    // 停止時歸位
    currentPhase.value = 'prep';
    isIntroPredict.value = false;
    localBeat4.value = 0;
    activeNoteTarget.value = null;
  }
};

// 退出訓練畫面
const exitTraining = () => {
  if (isPlaying.value) {
    trainerAudio.toggle();
    isPlaying.value = false;
  }
  isTrainingActive.value = false;
  
  // 重置進度與 UI 狀態
  cagedCycle.value = 0;
  localBeat4.value = 0;
  currentPhase.value = 'prep';
  isIntroPredict.value = false;
  isFirstChordStart.value = true;
  
  const progArray = getActiveProgression();
  currentChord.value = progArray[0];
  nextChord.value = progArray.length > 1 ? progArray[1] : progArray[0];
  
  if (trainerAudio) {
    trainerAudio.currentChordIdx = 0;
    trainerAudio.currentGlobalBeat = 0;
    trainerAudio.currentChordBeat = 0;
    trainerAudio.currentCagedCycle = 0;
  }
};
</script>

<template>
  <div
    class="min-h-[100dvh] bg-black text-white font-sans selection:bg-emerald-500 selection:text-black"
    :class="isTrainingActive ? 'h-[100dvh] overflow-hidden' : 'p-4'"
  >

    <!-- 拖曳中跟隨指針的浮動字卡 (滑鼠 + 觸控通用) -->
    <div 
      v-if="dragState && dragState.dragging"
      class="drag-ghost"
      :style="{ left: dragState.x + 'px', top: dragState.y + 'px' }"
    >
      {{ dragState.label }}
    </div>
    
    <div v-if="!isTrainingActive" class="max-w-3xl mx-auto space-y-6 pt-4 pb-12">
      
      <div class="flex justify-between items-center border-b border-zinc-800 pb-4">
        <h1 class="text-2xl font-black text-emerald-400 tracking-wider">⚡ CAGED 有氧吉他特訓核心</h1>
        <div class="flex gap-2">
          <button 
            @click="toggleFullscreen"
            class="px-4 py-2 text-xs font-bold rounded-lg border transition-all bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
            :title="isFullscreen ? '退出全螢幕' : '全螢幕顯示'"
          >
            {{ isFullscreen ? '🗗 退出全螢幕' : '⛶ 全螢幕' }}
          </button>
          <button 
            @click="isLeftHanded = !isLeftHanded"
            class="px-4 py-2 text-xs font-bold rounded-lg border transition-all"
            :class="isLeftHanded ? 'bg-amber-500 border-amber-400 text-black' : 'bg-zinc-900 border-zinc-700 text-zinc-400'"
          >
            {{ isLeftHanded ? '左手模式 (琴頭向右)' : '右手模式 (琴頭向左)' }}
          </button>
        </div>
      </div>

      <div class="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800 space-y-3">
        <h3 class="text-sm font-bold text-zinc-400 tracking-wide">1. 主調 Key 選擇</h3>
        <div class="grid grid-cols-6 gap-2">
          <button 
            v-for="(name, idx) in NOTE_NAMES" :key="name"
            @click="keyRoot = idx"
            class="py-2.5 rounded-xl font-bold text-sm transition-all border"
            :class="keyRoot === idx ? 'bg-emerald-500 border-emerald-400 text-black shadow-lg scale-105' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'"
          >
            {{ name }}
          </button>
        </div>
      </div>

      <div class="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800 space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-sm font-bold text-zinc-400 tracking-wide">2. 和弦進行 Progression</h3>
          <div class="flex gap-2 text-xs">
            <button @click="isCustomProgMode = false" class="px-3 py-1 rounded" :class="!isCustomProgMode ? 'bg-zinc-700 text-white' : 'text-zinc-500'">內建清單</button>
            <button @click="isCustomProgMode = true" class="px-3 py-1 rounded" :class="isCustomProgMode ? 'bg-zinc-700 text-white' : 'text-zinc-500'">自由自訂</button>
          </div>
        </div>
        
        <div v-if="!isCustomProgMode" class="grid grid-cols-3 gap-3">
          <button 
            v-for="(_, name) in PROGRESSION_PRESETS" :key="name"
            @click="selectedProgressionName = name"
            class="p-4 rounded-xl font-bold text-center border transition-all text-sm"
            :class="selectedProgressionName === name && !isCustomProgMode ? 'bg-zinc-200 text-black border-white' : 'bg-zinc-950 border-zinc-850 text-zinc-400'"
          >
            {{ name }}
          </button>
        </div>
        <div v-else class="space-y-3">
          <!-- 已選和弦 (Drop Zone) -->
          <div ref="progContainerRef">
            <transition-group 
              name="list"
              tag="div"
              class="flex flex-wrap gap-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl min-h-[5rem] items-center relative transition-all"
            >
              <div v-if="customProgressionArray.length === 0" key="empty-msg" class="text-zinc-500 text-sm w-full text-center absolute left-0 pointer-events-none">請拖曳下方和弦加入</div>
              <div 
                v-for="(chordObj, index) in customProgressionArray" 
                :key="chordObj.id"
                data-prog-card
                @pointerdown="startDrag($event, index, 'progression')"
                class="px-4 py-2 font-bold cursor-grab active:cursor-grabbing transition-all shadow-sm relative flex items-center justify-center rounded-lg border touch-none select-none bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                :class="[
                  activeGap === index ? 'ml-6 before:content-[\'\'] before:absolute before:-left-5 before:top-1/2 before:-translate-y-1/2 before:h-8 before:w-1.5 before:bg-emerald-400 before:rounded-full' : '',
                  index === customProgressionArray.length - 1 && activeGap === customProgressionArray.length ? 'mr-6 after:content-[\'\'] after:absolute after:-right-5 after:top-1/2 after:-translate-y-1/2 after:h-8 after:w-1.5 after:bg-emerald-400 after:rounded-full' : '',
                  dragState && dragState.source === 'progression' && dragState.item === index && dragState.dragging ? 'prog-card-hidden' : '',
                  dragState && dragState.dragging ? '' : 'hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50'
                ]"
                title="點擊移除，拖放到縫隙中插入"
              >
                {{ chordObj.value }}
              </div>
            </transition-group>
          </div>
          
          <!-- 可用和弦庫 (依性質分類) -->
          <div class="space-y-3">
            <div v-for="group in chordLibrary" :key="group.label" class="space-y-1.5">
              <div class="text-[0.7rem] font-bold text-zinc-500 tracking-wide uppercase">{{ group.label }}</div>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="chord in group.chords"
                  :key="'lib-' + chord"
                  @pointerdown="startDrag($event, chord, 'library')"
                  class="px-4 py-2 bg-zinc-900 text-zinc-300 border border-zinc-700 rounded-lg font-bold cursor-grab active:cursor-grabbing hover:bg-zinc-700 hover:text-white transition-colors touch-none select-none"
                  title="點擊或拖曳加入進行"
                >
                  {{ chord }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800 flex flex-col justify-between">
        <h3 class="text-sm font-bold text-zinc-400 tracking-wide mb-2">3. 訓練速度 (BPM)</h3>
        <div class="flex items-center gap-4">
          <button @click="bpm = Math.max(MIN_BPM, bpm - 5)" class="w-12 h-12 bg-zinc-950 border border-zinc-800 rounded-xl font-black text-xl hover:border-zinc-700">-</button>
          <div class="flex-1 text-center font-black text-3xl text-zinc-100">{{ bpm }} <span class="text-xs font-normal text-zinc-500">BPM</span></div>
          <button @click="bpm = Math.min(MAX_BPM, bpm + 5)" class="w-12 h-12 bg-zinc-950 border border-zinc-800 rounded-xl font-black text-xl hover:border-zinc-700">+</button>
        </div>
      </div>

      <div class="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800 space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-sm font-bold text-zinc-400 tracking-wide">4. 音程特訓模式演算法</h3>
          <div class="flex gap-2 text-xs">
            <button @click="isCustomSequenceMode = false" class="px-3 py-1 rounded" :class="!isCustomSequenceMode ? 'bg-zinc-700 text-white' : 'text-zinc-500'">階梯爬升解鎖</button>
            <button @click="isCustomSequenceMode = true" class="px-3 py-1 rounded" :class="isCustomSequenceMode ? 'bg-zinc-700 text-white' : 'text-zinc-500'">自訂音序器</button>
          </div>
        </div>

        <div v-if="!isCustomSequenceMode" class="space-y-2">
          <div class="grid grid-cols-5 gap-2">
            <button 
              v-for="s in [1,2,3,4,5]" :key="s"
              @click="selectedStage = s"
              class="py-3 rounded-xl border font-bold text-sm transition-all"
              :class="selectedStage === s ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-black' : 'bg-zinc-950 border-zinc-850 text-zinc-500'"
            >
              Stage {{ s }}
            </button>
          </div>
          <div class="text-xs text-zinc-500 text-center pt-1 leading-relaxed">
            <p v-if="selectedStage === 1"><span class="font-bold text-emerald-400">【三和弦】</span> 大調(1, 3, 5) / 小調(1, ♭3, 5)</p>
            <p v-else-if="selectedStage === 2"><span class="font-bold text-emerald-400">【增加音】</span> 大調(+2度) / 小調(+4度)</p>
            <p v-else-if="selectedStage === 3"><span class="font-bold text-emerald-400">【五聲音階】</span> 大調(1, 2, 3, 5, 6) / 小調(1, ♭3, 4, 5, ♭7)</p>
            <p v-else-if="selectedStage === 4"><span class="font-bold text-emerald-400">【七度色彩】</span> 五聲 + 大/小七度</p>
            <p v-else><span class="font-bold text-emerald-400">【自然音階】</span> 解鎖該把位調式全自然音</p>
          </div>
        </div>

        <div v-else class="space-y-2">
          <input 
            type="text" v-model="customSequenceInput"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-center font-mono font-bold text-amber-400 text-lg focus:outline-none focus:border-amber-500"
            placeholder="輸入相對級數，如: L5, L6, 1, 2, L7, 1"
          />
          <p class="text-xs text-zinc-500 text-center">
            💡 支援 <span class="text-zinc-300">1-7</span> 代表順階度數，前綴 <span class="text-zinc-300">L</span> 代表低音。後台會依據當前和弦自動切換調式（Mode）防跑調。
          </p>
        </div>
      </div>



      <button 
        @click="handleTogglePlay"
        class="w-full py-5 bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xl rounded-2xl transition-all active:scale-95 shadow-[0_4px_20px_rgba(52,211,153,0.3)] cursor-pointer text-center"
      >
        進入有氧特訓模式 START 🚀
      </button>
    </div>

    <div v-else class="training-screen flex flex-col w-full max-w-none mx-auto">

      <div class="train-header text-center py-6 flex flex-col items-center justify-center relative">
        <div class="train-dots flex gap-4 mb-4">
          <div 
            v-for="b in [0, 1, 2, 3]" :key="b"
            class="w-4 h-4 rounded-full border transition-all duration-75"
            :class="[
              localBeat4 === b 
                ? (b === 0 ? 'bg-red-500 border-red-400 scale-125 shadow-[0_0_12px_rgba(239,68,68,0.8)]' : 'bg-amber-400 border-amber-300 scale-110 shadow-[0_0_10px_rgba(251,191,36,0.8)]')
                : 'bg-zinc-950 border-zinc-800'
            ]"
          ></div>
        </div>

        <!-- 所選和弦進行：高亮目前所在的和弦 -->
        <div class="train-prog flex flex-wrap gap-2 justify-center mb-5">
          <template v-for="(chord, idx) in activeProgressionList" :key="idx">
            <span 
              class="px-3 py-1.5 rounded-lg font-black text-base sm:text-lg border transition-all duration-150"
              :class="idx === currentChordIdx 
                ? 'bg-red-500/20 border-red-400 text-red-400 scale-110 shadow-[0_0_12px_rgba(239,68,68,0.5)]' 
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'"
            >
              {{ chord }}
            </span>
            <span v-if="idx < activeProgressionList.length - 1" class="text-zinc-700 font-black self-center">›</span>
          </template>
        </div>

        <div class="relative w-full flex items-center justify-center">
          <!-- 當前和弦永遠置中；非預告期時奇數拍縮小、其餘維持正常大小，預告期維持原尺寸 -->
          <h1 
            class="chord-big relative text-7xl sm:text-8xl md:text-9xl font-black text-red-500 tracking-widest transition-transform duration-200 ease-out" 
            :class="[
              currentPhase === 'predict' ? 'scale-100' : (localBeat4 % 2 === 1 ? 'scale-90' : 'scale-100'),
              isIntroPredict ? 'chord-flash' : ''
            ]"
            :style="isIntroPredict ? flashStyle : {}"
          >
            {{ currentChord }}
            <!-- 預告期：箭頭 + 下一個和弦，緊鄰當前和弦右側 (當前和弦仍置中)。
                 導入預告期 (isIntroPredict) 只讓第一個和弦置中閃爍，不顯示下一個和弦。 -->
            <span 
              v-if="currentPhase === 'predict' && !isIntroPredict"
              class="absolute left-full top-1/2 -translate-y-1/2 ml-3 sm:ml-5 flex items-center gap-3 sm:gap-5 whitespace-nowrap"
            >
              <span class="font-black text-zinc-500 leading-none" style="font-size: 0.6em;">→</span>
              <span class="font-black tracking-widest chord-flash leading-none" :style="flashStyle">
                {{ nextChord }}
              </span>
            </span>
          </h1>
        </div>
        <p class="train-subtitle text-xl text-zinc-400 font-medium mt-1">
          {{ NOTE_NAMES[(keyRoot + CHORD_MODES[currentChord]?.offset) % 12] }} {{ CHORD_MODES[currentChord]?.label }} 和弦時間 
          <span class="text-zinc-600 text-sm ml-2">({{ CHORD_MODES[currentChord]?.modeName }} Mode)</span>
        </p>
      </div>

      <!-- 和弦時間下一列：左側為退出特訓 (較小、不常用)，右側為目前把位。 -->
      <div class="train-controls flex items-center justify-between gap-2 w-full px-1">
        <div class="flex items-center gap-2">
          <button
            @click="exitTraining"
            class="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 font-bold rounded-lg text-zinc-500 text-xs transition-all cursor-pointer"
          >
            ✕ 退出特訓
          </button>
        </div>
        <div class="flex items-center text-zinc-400 font-bold text-xs sm:text-sm whitespace-nowrap">
          目前把位:<span class="text-emerald-400 ml-1.5 text-base sm:text-lg">{{ currentFormName }} 型</span>
        </div>
      </div>

      <div class="train-fretboard-wrap w-full">
        <Fretboard 
          :keyRoot="keyRoot" 
          :currentChord="currentChord" 
          :scaleRegionOverride="displayScaleRegion"
          :currentDynamicForm="displayDynamicForm" 
          :isLeftHanded="isLeftHanded"
          :currentPhase="currentPhase"
          :activeNoteTarget="activeNoteTarget"
          :prepChordVoicingNotes="prepChordVoicingNotes"
        />
      </div>

    </div>

  </div>
</template>

<style scoped>
/* 拖曳中跟隨指針的浮動字卡 */
.drag-ghost {
  position: fixed;
  z-index: 9999;
  transform: translate(-50%, -50%) scale(1.1);
  pointer-events: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 700;
  background: rgba(16, 185, 129, 0.25);
  color: rgb(52, 211, 153);
  border: 1px solid rgba(16, 185, 129, 0.6);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}

/* 拖拉字卡的動畫過場效果 */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}

/* 拖曳重排時，原位置的來源字卡完全隱藏 (不再以半透明留下空殼) */
.prog-card-hidden {
  display: none !important;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: scale(0.6) translateY(-10px);
}

/* 確保移動時位置絕對，才能讓其他元素正確滑動填補空缺 */
.list-leave-active {
  position: absolute;
}

/* 預告期下一個和弦：高頻率黑/紅雙色閃爍 */
@keyframes chordFlash {
  0%, 49% {
    color: #ef4444;
    text-shadow: 0 0 25px rgba(239, 68, 68, 0.9);
  }
  50%, 100% {
    color: #0a0a0a;
    text-shadow: none;
  }
}

.chord-flash {
  animation: chordFlash 0.22s steps(1, end) infinite;
  will-change: color;
}

/* ============================================
   特訓畫面：固定為一個視窗高，內部以 flex 分配，
   確保 PC / iPad 橫屏 / iPhone 橫屏 皆「不需上下捲動」即可看到所有元素。
   ============================================ */
.training-screen {
  width: 100%;
  max-width: none;
  height: 100dvh;
  overflow: hidden;
  /* 避開 iPhone 瀏海 / 圓角 / Home Indicator 等安全區域。 */
  padding:
    calc(0.75rem + env(safe-area-inset-top))
    calc(1rem + env(safe-area-inset-right))
    calc(0.75rem + env(safe-area-inset-bottom))
    calc(1rem + env(safe-area-inset-left));
  gap: 0.5rem;
}

/* 指板區塊吃掉剩餘高度，並置中；Fretboard 內部會依此可用高度自動縮放。 */
.train-fretboard-wrap {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding-bottom: max(0.15rem, env(safe-area-inset-bottom));
}

/* 和弦時間下一列的控制列：左退出/暫停、右目前把位。 */
.train-controls {
  flex: 0 0 auto;
}

/* 橫向且高度受限 (手機橫屏 / 小平板橫屏)：壓縮上方資訊區與字級，把空間讓給指板。 */
@media (orientation: landscape) and (max-height: 600px) {
  .training-screen {
    padding:
      calc(0.35rem + env(safe-area-inset-top))
      calc(0.25rem + env(safe-area-inset-right))
      calc(0.35rem + env(safe-area-inset-bottom))
      calc(0.25rem + env(safe-area-inset-left));
    gap: 0.25rem;
  }

  .train-header {
    padding-top: 0.1rem !important;
    padding-bottom: 0.1rem !important;
  }

  .train-dots {
    margin-bottom: 0.35rem !important;
    gap: 0.6rem !important;
  }

  .train-prog {
    margin-bottom: 0.4rem !important;
  }

  .chord-big {
    font-size: 3.25rem !important;
    line-height: 1 !important;
  }

  .train-subtitle {
    font-size: 0.8rem !important;
    margin-top: 0.15rem !important;
  }
}

/* 更矮的橫屏 (典型 iPhone 橫屏 ≤ 430px 高)：再進一步收斂，但保留「和弦時間」字樣。 */
@media (orientation: landscape) and (max-height: 430px) {
  .chord-big {
    font-size: 2.5rem !important;
  }
  .train-subtitle {
    font-size: 0.7rem !important;
    margin-top: 0.1rem !important;
  }
}
</style>