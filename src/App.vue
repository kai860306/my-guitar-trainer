<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import Fretboard from './components/Fretboard.vue';
import {
  NOTE_NAMES,
  CHORD_MODES,
  PROGRESSION_PRESETS,
  getDynamicCagedForm,
  resolveCagedChordVoicing,
  generateTriadProgressionVoicings,
  TRIAD_STRING_SETS
} from './utils/musicTheory.js';

import {
  generateCagedScaleSequence,
  validateCagedScales,
  getCagedScaleBounds,
  TRAINING_STAGE_MODES
} from './utils/cagedScales.js';
import { AudioEngine } from './utils/audioEngine.js';

// ===============================
// 預設設定
// ===============================
// 這些值會在瀏覽器沒有保存設定時使用。
// 若使用者已經改過設定，會優先讀取 localStorage 裡保存的值。
const DEFAULT_KEY_ROOT = 0; // 0=C, 1=C#, 2=D ... 11=B
const DEFAULT_PROGRESSION_NAME = 'I - IV - V';
const DEFAULT_TRAINING_STAGE_MODE = 'chord';
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

// 預設指板音程顯示基準。
// chord = 從目前和弦根音看音程。
// key = 從目前 Key 根音看音程。
const DEFAULT_INTERVAL_DISPLAY_MODE = 'chord';

// 預設 Train phase 音生成引擎。
// stage  = 階梯爬升解鎖（chord / scale 的 stageMode）
// custom = 自訂音序器
// triad  = 三和弦琶音（連續三弦組）
const DEFAULT_TRAINING_INPUT_MODE = 'stage';
const TRAINING_INPUT_MODES = ['stage', 'custom', 'triad'];

// 三和弦模式的連續三弦組（TRIAD_STRING_SETS 的 key）。
const TRIAD_STRING_SET_KEYS = Object.keys(TRIAD_STRING_SETS);
const DEFAULT_TRIAD_STRING_SET = '2-4';

// 三和弦 Train 爬音方向。ascending = 低音→高音；descending = 高音→低音。
const TRIAD_DIRECTIONS = ['ascending', 'descending'];
const DEFAULT_TRIAD_DIRECTION = 'ascending';

// 畫面初始顯示用。
// 若之後有保存設定，onMounted 時會依照保存的和弦進行重新覆蓋。
const currentChord = ref('I');
const nextChord = ref('IV');

// 基礎設定狀態
const keyRoot = ref(DEFAULT_KEY_ROOT);
// 目前選取的進行 id（內建 seed 為 'preset:<名稱>'，自訂為隨機碼）。onMounted 會依保存設定覆蓋。
const selectedProgressionName = ref('preset:' + DEFAULT_PROGRESSION_NAME);
const selectedTrainingStageMode = ref(DEFAULT_TRAINING_STAGE_MODE);
const selectedStage = ref(DEFAULT_STAGE);

const generateId = () => Math.random().toString(36).substr(2, 9);
const customProgressionArray = ref([]);
// 可用和弦庫（依性質分類，方便日後擴充）
const chordLibrary = [
  { label: '順階三和弦', chords: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] },
  { label: '順階七和弦', chords: ['IM7', 'iim7', 'iiim7', 'IVM7', 'V7', 'vim7', 'viim7b5'] },
  { label: '同主調三和弦', chords: ['i', 'ii°', 'bIII', 'iv', 'v', 'bVI', 'bVII'] },
  { label: '同主調七和弦', chords: ['im7', 'iim7b5', 'bIIIM7', 'ivm7', 'vm7', 'bVIM7', 'bVII7'] },
  { label: '副屬七和弦', chords: ['V7/ii', 'V7/iii', 'V7/IV', 'V7/V', 'V7/vi'] },
  { label: '關聯 II', chords: ['IIm7b5/ii', 'IIm7b5/iii', 'IIm7/IV', 'IIm7/V', 'IIm7b5/vi'] },
  { label: '裏和弦（SubV7）', chords: ['SubV7/I', 'SubV7/ii', 'SubV7/iii', 'SubV7/IV', 'SubV7/V', 'SubV7/vi'] }
];
const activeGap = ref(null);
const isCustomProgMode = ref(false);

// 選擇清單的「管理模式」：開啟時卡片顯示大顆的編輯 / 刪除按鈕。不需持久化。
const isManagingProgList = ref(false);

// 和弦進行清單（內建與自訂統一管理）。每筆結構：{ id, name, chords: ['I','IV','V'] }
//   - id     : 選取用 key。內建 seed 項目用穩定字串 'preset:<名稱>'；使用者新增用 generateId() 隨機碼。
//   - name   : 由 chords 自動產生的顯示名稱（如 'I - IV - vi'）。
//   - chords : 羅馬級數 token 陣列，皆為 CHORD_MODES 的 key。
// 內建 PROGRESSION_PRESETS 只作為「第一次載入」的 seed 來源；seed 後清單完全由使用者管理（可選/可編/可刪）。
const savedProgressions = ref([]);

// 內建進行 seed 的預設選取 id。
const DEFAULT_PROGRESSION_ID = 'preset:' + DEFAULT_PROGRESSION_NAME;

// 目前正在「重新編輯」的進行 id；null 代表 builder 內容尚未對應任何一筆（存檔時視為新增）。
const editingProgId = ref(null);

// 由內建 preset 產生 seed 清單（每個 preset 一筆，id 用穩定字串）。
const seedProgressions = () =>
  Object.entries(PROGRESSION_PRESETS).map(([name, chords]) => ({
    id: 'preset:' + name,
    name,
    chords: [...chords]
  }));

// 依 chords 自動產生顯示名稱（以 ' - ' 相連）。去重已保證相同 chords 不會重覆存入，故不需後綴。
const progName = (chords) => chords.join(' - ') || 'Empty';

// 兩組級數是否完全相同（長度與逐項）。
const sameChords = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// 自訂音序器預設值與可用音程字卡。
// 這裡沿用原本手輸入音序器的 token 規則：1-7 是順階度數，L1-L7 是低八度順階度數。
const DEFAULT_CUSTOM_SEQUENCE = ['L5', 'L6', '1', '2', 'L7', '1'];
const sequenceLibrary = [
  { label: '低音順階度數', tokens: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] },
  { label: '順階度數', tokens: ['1', '2', '3', '4', '5', '6', '7'] },
  { label: '高音順階度數', tokens: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'] }
];
const sequenceTokenSet = new Set(sequenceLibrary.flatMap(group => group.tokens));
const isValidSequenceToken = (token) => sequenceTokenSet.has(token);
const createSequenceCards = (tokens = DEFAULT_CUSTOM_SEQUENCE) => {
  return tokens
    .filter(isValidSequenceToken)
    .map(value => ({ id: generateId(), value }));
};

// 統一的指針拖曳狀態 (同時支援滑鼠與觸控)
const progContainerRef = ref(null);
const sequenceContainerRef = ref(null);
const activeSequenceGap = ref(null);
const dragState = ref(null);
const DRAG_THRESHOLD = 6;

const bpm = ref(DEFAULT_BPM);
const isLeftHanded = ref(DEFAULT_IS_LEFT_HANDED);

// 指板上的音程顯示方式。
// chord：例如在 V 和弦上，G 會顯示 1。
// key：例如在 C Key 裡，G 會顯示 5。
const intervalDisplayMode = ref(DEFAULT_INTERVAL_DISPLAY_MODE);

// Train phase 音生成引擎選擇：'stage' | 'custom' | 'triad'
const trainingInputMode = ref(DEFAULT_TRAINING_INPUT_MODE);
const customSequenceArray = ref(createSequenceCards());

// 三和弦模式選擇的連續三弦組。
const selectedTriadStringSet = ref(DEFAULT_TRIAD_STRING_SET);

// 三和弦模式的爬音方向（'ascending' | 'descending'）。
const selectedTriadDirection = ref(DEFAULT_TRIAD_DIRECTION);

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
  selectedProgressionName: DEFAULT_PROGRESSION_ID,
  savedProgressions: seedProgressions(),
  bpm: DEFAULT_BPM,
  selectedTrainingStageMode: DEFAULT_TRAINING_STAGE_MODE,
  selectedStage: DEFAULT_STAGE,
  isLeftHanded: DEFAULT_IS_LEFT_HANDED,
  intervalDisplayMode: DEFAULT_INTERVAL_DISPLAY_MODE,
  trainingInputMode: DEFAULT_TRAINING_INPUT_MODE,
  selectedTriadStringSet: DEFAULT_TRIAD_STRING_SET,
  selectedTriadDirection: DEFAULT_TRIAD_DIRECTION,
  customSequenceArray: createSequenceCards()
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

  // 先還原進行清單，selectedProgressionName 的驗證才能認得清單裡的 id。
  // 逐筆驗證：chords 非空且皆為存在的級數；id / name 缺則補上。
  const validateProgList = (list) => list
    .filter(p => p && Array.isArray(p.chords) && p.chords.length > 0
      && p.chords.every(c => typeof c === 'string' && CHORD_MODES[c]))
    .map(p => ({
      id: typeof p.id === 'string' && p.id ? p.id : generateId(),
      chords: [...p.chords],
      name: typeof p.name === 'string' && p.name ? p.name : progName(p.chords)
    }));

  if (Array.isArray(safeSettings.savedProgressions)) {
    // 有新版欄位：直接採用（即使過濾後為空，也尊重使用者把清單刪光）。
    savedProgressions.value = validateProgList(safeSettings.savedProgressions);
  } else {
    // 首次載入 / v1 舊資料遷移：seed 內建 + 併入舊 userProgressions（隨機 id）。
    const legacy = Array.isArray(safeSettings.userProgressions)
      ? validateProgList(safeSettings.userProgressions).map(p => ({ ...p, id: generateId() }))
      : [];
    savedProgressions.value = [...seedProgressions(), ...legacy];
  }

  // 選取遷移：命中 id 直接用；否則命中 v1 的 preset 名稱 → 映射 'preset:名稱'；
  // 再否則回退預設 id；若連預設 id 都不存在（被刪光）→ 取剩餘第一筆。
  const savedProgIds = new Set(savedProgressions.value.map(p => p.id));
  const wanted = safeSettings.selectedProgressionName;
  let resolvedProgId = null;
  if (savedProgIds.has(wanted)) {
    resolvedProgId = wanted;
  } else if (PROGRESSION_PRESETS[wanted] && savedProgIds.has('preset:' + wanted)) {
    resolvedProgId = 'preset:' + wanted;
  }
  if (!resolvedProgId) {
    resolvedProgId = savedProgIds.has(DEFAULT_PROGRESSION_ID)
      ? DEFAULT_PROGRESSION_ID
      : (savedProgressions.value[0]?.id || DEFAULT_PROGRESSION_ID);
  }
  selectedProgressionName.value = resolvedProgId;

  // builder 為暫時的編輯子頁，不從保存還原：重整後一律停在和弦清單、不保留半成品。
  isCustomProgMode.value = false;
  editingProgId.value = null;
  customProgressionArray.value = [];

  bpm.value = Number.isFinite(Number(safeSettings.bpm))
    ? Math.min(MAX_BPM, Math.max(MIN_BPM, Number(safeSettings.bpm)))
    : defaults.bpm;

  selectedTrainingStageMode.value = TRAINING_STAGE_MODES[safeSettings.selectedTrainingStageMode]
    ? safeSettings.selectedTrainingStageMode
    : defaults.selectedTrainingStageMode;

  const maxStage = TRAINING_STAGE_MODES[selectedTrainingStageMode.value]?.stageCount || 5;
  selectedStage.value = Number.isInteger(Number(safeSettings.selectedStage))
    ? Math.min(maxStage, Math.max(1, Number(safeSettings.selectedStage)))
    : defaults.selectedStage;

  isLeftHanded.value = Boolean(safeSettings.isLeftHanded);

  // 舊版 localStorage 沒有這個欄位時，會自動回到 chord 顯示。
  intervalDisplayMode.value = safeSettings.intervalDisplayMode === 'key'
    ? 'key'
    : 'chord';

  // Train phase 引擎模式。
  // 後方互換：舊版只有 isCustomSequenceMode(bool)，沒有 trainingInputMode 欄位時，
  //          true → 'custom'，false → 'stage'。
  if (TRAINING_INPUT_MODES.includes(safeSettings.trainingInputMode)) {
    trainingInputMode.value = safeSettings.trainingInputMode;
  } else {
    trainingInputMode.value = safeSettings.isCustomSequenceMode ? 'custom' : DEFAULT_TRAINING_INPUT_MODE;
  }

  selectedTriadStringSet.value = TRIAD_STRING_SET_KEYS.includes(safeSettings.selectedTriadStringSet)
    ? safeSettings.selectedTriadStringSet
    : defaults.selectedTriadStringSet;

  selectedTriadDirection.value = TRIAD_DIRECTIONS.includes(safeSettings.selectedTriadDirection)
    ? safeSettings.selectedTriadDirection
    : defaults.selectedTriadDirection;

  customSequenceArray.value = Array.isArray(safeSettings.customSequenceArray)
    ? safeSettings.customSequenceArray
        .filter(item => item && typeof item.value === 'string' && isValidSequenceToken(item.value))
        .map(item => ({
          id: typeof item.id === 'string' ? item.id : generateId(),
          value: item.value
        }))
    : defaults.customSequenceArray;

  // 自訂音序器如果被清空，保留空狀態，讓畫面明確提示使用者拖曳音程加入。
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
      savedProgressions: savedProgressions.value,
      bpm: bpm.value,
      selectedTrainingStageMode: selectedTrainingStageMode.value,
      selectedStage: selectedStage.value,
      isLeftHanded: isLeftHanded.value,
      intervalDisplayMode: intervalDisplayMode.value,
      trainingInputMode: trainingInputMode.value,
      selectedTriadStringSet: selectedTriadStringSet.value,
      selectedTriadDirection: selectedTriadDirection.value,
      customSequenceArray: customSequenceArray.value
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

// 清單「id → 級數陣列」查找表。
const allProgressions = computed(() => {
  const map = {};
  savedProgressions.value.forEach(p => { map[p.id] = p.chords; });
  return map;
});

// 「選擇清單」按鈕格要顯示的項目。
const progressionListEntries = computed(() =>
  savedProgressions.value.map(p => ({ key: p.id, name: p.name }))
);

// 解析和弦進行級數。
// 訓練一律使用「和弦清單中選中的那筆」；builder（customProgressionArray）只是編輯緩衝，不直接播放。
const getActiveProgression = () => {
  return allProgressions.value[selectedProgressionName.value]
    || savedProgressions.value[0]?.chords
    || ['I'];
};

// 依指針位置計算插入縫隙索引
const updateActiveGapByConfig = (clientX, containerRef, gapRef, cardSelector) => {
  const container = containerRef.value;
  if (!container) { gapRef.value = null; return; }

  const cards = Array.from(container.querySelectorAll(cardSelector))
    .filter(c => !c.classList.contains('list-leave-active'));

  if (cards.length === 0) { gapRef.value = 0; return; }

  let targetIndex = cards.length;
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect();
    const cardCenter = rect.left + rect.width / 2;
    if (clientX < cardCenter) { targetIndex = i; break; }
  }
  gapRef.value = targetIndex;
};

const updateActiveGap = (clientX) => {
  updateActiveGapByConfig(clientX, progContainerRef, activeGap, '[data-prog-card]');
};

const updateActiveSequenceGap = (clientX) => {
  updateActiveGapByConfig(clientX, sequenceContainerRef, activeSequenceGap, '[data-sequence-card]');
};

const resetDragState = () => {
  dragState.value = null;
  activeGap.value = null;
  activeSequenceGap.value = null;
};

const isProgressionDragSource = (source) => {
  return source === 'library' || source === 'progression';
};

const isSequenceDragSource = (source) => {
  return source === 'sequenceLibrary' || source === 'sequence';
};

const moveCardInArray = (arrayRef, oldIdx, targetIndex) => {
  const needMove = oldIdx !== targetIndex && oldIdx + 1 !== targetIndex;
  const adjusted = targetIndex > oldIdx ? targetIndex - 1 : targetIndex;

  // 不論順序有無改變，都把被拖曳的字卡「換上全新的 id」後重新插入。
  // 拖曳期間該字卡為 display:none 而失去版面座標，若直接還原，
  // TransitionGroup 會誤判其移動前座標為 (0,0) 而觸發從左上角飛入的 FLIP。
  // 換新 id → Vue 視為全新進場 (enter)，套用 .list-enter 原地淡入縮放動畫，
  // 徹底避開破圖；其餘被擠開的字卡仍保有座標，照常以 .list-move 平滑滑動。
  const finalIdx = needMove ? adjusted : oldIdx;
  const cardObj = arrayRef.value[oldIdx];
  arrayRef.value.splice(oldIdx, 1);
  arrayRef.value.splice(finalIdx, 0, { id: generateId(), value: cardObj.value });
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

  if (isProgressionDragSource(st.source)) {
    updateActiveGap(e.clientX);
  } else if (isSequenceDragSource(st.source)) {
    updateActiveSequenceGap(e.clientX);
  }
};

const onDragPointerUp = () => {
  const st = dragState.value;
  window.removeEventListener('pointermove', onDragPointerMove);
  window.removeEventListener('pointerup', onDragPointerUp);
  window.removeEventListener('pointercancel', onDragPointerUp);
  if (!st) return;

  if (st.dragging) {
    if (st.source === 'library') {
      const targetIndex = activeGap.value !== null ? activeGap.value : customProgressionArray.value.length;
      customProgressionArray.value.splice(targetIndex, 0, { id: generateId(), value: st.item });
      resetDragState();
      syncEngineParams();
      return;
    }

    if (st.source === 'progression') {
      const targetIndex = activeGap.value !== null ? activeGap.value : customProgressionArray.value.length;
      moveCardInArray(customProgressionArray, st.item, targetIndex);
      resetDragState();
      syncEngineParams();
      return;
    }

    if (st.source === 'sequenceLibrary') {
      const targetIndex = activeSequenceGap.value !== null ? activeSequenceGap.value : customSequenceArray.value.length;
      customSequenceArray.value.splice(targetIndex, 0, { id: generateId(), value: st.item });
      resetDragState();
      syncEngineParams();
      return;
    }

    if (st.source === 'sequence') {
      const targetIndex = activeSequenceGap.value !== null ? activeSequenceGap.value : customSequenceArray.value.length;
      moveCardInArray(customSequenceArray, st.item, targetIndex);
      resetDragState();
      syncEngineParams();
      return;
    }
  } else {
    // 未超過拖曳門檻 → 視為點擊：library 新增 / 已選字卡移除。
    if (st.source === 'library') {
      addChord(st.item);
    } else if (st.source === 'progression') {
      removeChord(st.item);
    } else if (st.source === 'sequenceLibrary') {
      addSequenceToken(st.item);
    } else if (st.source === 'sequence') {
      removeSequenceToken(st.item);
    }
  }

  resetDragState();
};

const getDragLabel = (item, source) => {
  if (source === 'library' || source === 'sequenceLibrary') return item;
  if (source === 'progression') return customProgressionArray.value[item]?.value || '';
  if (source === 'sequence') return customSequenceArray.value[item]?.value || '';
  return '';
};

const startDrag = (e, item, source) => {
  // 滑鼠僅響應左鍵；觸控/筆皆可。
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  activeGap.value = null;
  activeSequenceGap.value = null;
  dragState.value = {
    item,
    source,
    label: getDragLabel(item, source),
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

// 開啟 builder 子頁建立新進行（由「＋ 新增進行」仮卡片觸發）。
const openNewProg = () => {
  customProgressionArray.value = [];
  editingProgId.value = null;
  isCustomProgMode.value = true;
};

// 取消 / 破棄 builder 編輯，回到清單（不寫入 savedProgressions，故編輯既有筆時原資料不變）。
const cancelProgEdit = () => {
  isCustomProgMode.value = false;
  editingProgId.value = null;
  customProgressionArray.value = [];
};

// 把目前 builder 內容「保存」為新的一筆，或「更新」正在編輯的那筆。
const saveCurrentProgToList = () => {
  const chords = customProgressionArray.value.map(c => c.value);
  if (chords.length === 0) return;

  let savedId = editingProgId.value;
  if (savedId) {
    // 更新正在編輯的那筆。
    const entry = savedProgressions.value.find(p => p.id === savedId);
    if (entry) {
      entry.chords = chords;
      entry.name = progName(chords);
    }
  } else {
    // 新增前先去重：清單中已有相同進行就不新增，直接選中既有那筆。
    const dup = savedProgressions.value.find(p => sameChords(p.chords, chords));
    if (dup) {
      savedId = dup.id;
    } else {
      savedId = generateId();
      savedProgressions.value.push({ id: savedId, name: progName(chords), chords });
    }
  }

  // 存完切回清單並選中剛存 / 剛更新 / 既有的那筆，給即時回饋。
  selectedProgressionName.value = savedId;
  editingProgId.value = null;
  isCustomProgMode.value = false;
};

// 把某筆進行載回 builder 重新編輯（內建 seed 項目同樣可編）。
const editProg = (entry) => {
  customProgressionArray.value = entry.chords.map(v => ({ id: generateId(), value: v }));
  editingProgId.value = entry.id;
  isCustomProgMode.value = true;
};

// 刪除某筆進行。
const deleteProg = (id) => {
  savedProgressions.value = savedProgressions.value.filter(p => p.id !== id);
  if (selectedProgressionName.value === id) {
    // 選中的被刪 → 跳到剩餘第一筆，沒有就回退預設 id。
    selectedProgressionName.value = savedProgressions.value[0]?.id || DEFAULT_PROGRESSION_ID;
  }
  if (editingProgId.value === id) {
    editingProgId.value = null;
  }
};

const addSequenceToken = (tokenValue) => {
  if (!isValidSequenceToken(tokenValue)) return;
  customSequenceArray.value.push({ id: generateId(), value: tokenValue });
  syncEngineParams();
};

const removeSequenceToken = (index) => {
  customSequenceArray.value.splice(index, 1);
  syncEngineParams();
};

// 解析自訂音序字卡。
// 後面的 AudioEngine 仍然收到原本的 token 陣列，因此音高映射演算法不需要重寫。
const getCustomSequenceTokens = () => {
  return customSequenceArray.value
    .map(item => typeof item === 'string' ? item : item.value)
    .filter(isValidSequenceToken);
};

const cagedCycle = ref(0);

const currentDynamicForm = computed(() => {
  return getDynamicCagedForm(currentChord.value, keyRoot.value, cagedCycle.value);
});

const minFret = computed(() => currentDynamicForm.value ? currentDynamicForm.value.min : 0);
const maxFret = computed(() => currentDynamicForm.value ? currentDynamicForm.value.max : 4);
const currentFormName = computed(() => currentDynamicForm.value ? currentDynamicForm.value.name : 'C');

// 訓練畫面「目前把位」標籤：三和弦模式顯示弦組，其餘顯示 CAGED form。
const currentPositionLabel = computed(() =>
  isTriadMode.value ? `${selectedTriadStringSet.value} 弦三和弦` : `${currentFormName.value} 型`
);

// ✨ 下一個和弦黑/紅閃爍的週期與 BPM 同步：一拍一次完整的黑紅循環
const flashStyle = computed(() => ({
  animationDuration: (60 / bpm.value) + 's'
}));

// 🎵 訓練頁面顯示用的當前和弦進行清單 (供高亮目前和弦)
const activeProgressionList = computed(() => getActiveProgression());

// 🎯 音程特訓 Stage 模式：和弦基礎 / 音階基礎。
const activeTrainingStageConfig = computed(() => {
  return TRAINING_STAGE_MODES[selectedTrainingStageMode.value] || TRAINING_STAGE_MODES.chord;
});

const activeTrainingStageNumbers = computed(() => {
  return Array.from({ length: activeTrainingStageConfig.value.stageCount }, (_, index) => index + 1);
});

const currentTrainingStageDescription = computed(() => {
  return activeTrainingStageConfig.value.descriptions[selectedStage.value] || {
    title: '自動模式',
    detail: '依目前選擇的演算法產生訓練音程序列'
  };
});

const setTrainingStageMode = (modeKey) => {
  if (!TRAINING_STAGE_MODES[modeKey]) return;
  selectedTrainingStageMode.value = modeKey;

  const maxStage = TRAINING_STAGE_MODES[modeKey].stageCount;
  selectedStage.value = Math.min(maxStage, Math.max(1, Number(selectedStage.value) || 1));
};

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

// ===== 三和弦模式 =====
const isTriadMode = computed(() => trainingInputMode.value === 'triad');

// 指定 cycle 的整組和弦進行三和弦轉回形序列（最小移動 voice leading）。
// cycle 隨每輪進行遞增，讓整組把位往高處階梯推進（與 CAGED 自動循環一致）。
const computeTriadVoicings = (cycle) => {
  if (!isTriadMode.value) return [];
  return generateTriadProgressionVoicings(
    keyRoot.value,
    getActiveProgression(),
    selectedTriadStringSet.value,
    { maxFret: FRETBOARD_TOTAL_FRETS, cycle }
  );
};

// 目前 cycle 的三和弦序列（供指板 ghost dots 使用）。
const triadProgressionVoicings = computed(() => computeTriadVoicings(cagedCycle.value));

// 目前顯示中的和弦在三和弦序列裡的 index（未播放時固定第 0 項）。
const triadCurrentIndex = computed(() => {
  const voicings = triadProgressionVoicings.value;
  if (!voicings.length) return 0;
  const idx = isPlaying.value ? currentChordIdx.value : 0;
  return ((idx % voicings.length) + voicings.length) % voicings.length;
});

// 整組和弦進行在指定 cycle 的統一把位邊界：取所有和弦三和弦的最小～最大琴格，
// 上下各留 1 格，用同一個綠色虛線矩形框住「這一輪」的整組三和弦。
const computeTriadRegionForCycle = (cycle) => {
  const voicings = computeTriadVoicings(cycle);
  let minFret = Infinity;
  let maxFret = -Infinity;
  for (const v of voicings) {
    for (const n of (v.notes || [])) {
      minFret = Math.min(minFret, n.fret);
      maxFret = Math.max(maxFret, n.fret);
    }
  }
  if (minFret === Infinity || maxFret === -Infinity) return null;
  // 只框住選定的三弦：弦方向也限制在該弦組的 stringIndex 範圍。
  const stringIdxs = TRIAD_STRING_SETS[selectedTriadStringSet.value] || [];
  return {
    minFret: Math.max(0, minFret - 1),
    maxFret: Math.min(FRETBOARD_TOTAL_FRETS, maxFret + 1),
    minStringIndex: stringIdxs.length ? Math.min(...stringIdxs) : 0,
    maxStringIndex: stringIdxs.length ? Math.max(...stringIdxs) : 5
  };
};

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
  // 三和弦模式：用「整組和弦進行」在同一 cycle 的統一琴格邊界框住這一輪的三和弦；
  //            預告期若下一個和弦回到第 0 項（整輪結束），提前切到下一輪（更高把位）的邊界。
  if (isTriadMode.value) {
    let triadCycle = cagedCycle.value;
    if (!isIntroPredict.value && isPlaying.value && currentPhase.value === 'predict') {
      const progArray = getActiveProgression();
      const nextIdx = (currentChordIdx.value + 1) % progArray.length;
      if (nextIdx === 0) triadCycle = cagedCycle.value + 1;
    }
    return computeTriadRegionForCycle(triadCycle);
  }
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

// 🎸 Prep 階段顯示與播放用的和弦 voicing（指板 ghost dots + 刷弦來源）。
const prepChordVoicingNotes = computed(() => {
  if (isTriadMode.value) {
    return triadProgressionVoicings.value[triadCurrentIndex.value]?.notes || [];
  }
  if (!currentDynamicForm.value) return [];
  return resolveCagedChordVoicing(keyRoot.value, currentChord.value, currentDynamicForm.value);
});

// 🔄 同步前端面板參數至音訊引擎
const syncEngineParams = () => {
  if (!trainerAudio) return;
  const progArray = getActiveProgression();
  const customTokens = getCustomSequenceTokens();
  const isCustom = trainingInputMode.value === 'custom';
  const triadMode = trainingInputMode.value === 'triad';

  let cagedSeq;
  let prepVoicingNotes;

  if (triadMode) {
    // 三和弦模式：prep 刷弦 = 三和弦 3 音；train 爬音 = 同 3 音依音高昇冪。
    const idx = isPlaying.value ? currentChordIdx.value : 0;
    const voicings = triadProgressionVoicings.value;
    const safeIdx = voicings.length
      ? ((idx % voicings.length) + voicings.length) % voicings.length
      : 0;
    const notes = voicings[safeIdx]?.notes || [];
    prepVoicingNotes = notes;
    const descending = selectedTriadDirection.value === 'descending';
    cagedSeq = [...notes].sort((a, b) => descending ? b.pitchScore - a.pitchScore : a.pitchScore - b.pitchScore);
  } else {
    // 生成當前自動爬音序列
    const activeChord = isPlaying.value ? currentChord.value : progArray[0];
    // 把位必須與 activeChord 相符；未播放時 currentDynamicForm 仍是舊和弦 (如初始 vi)，
    // 不能直接拿來算，否則會產生「和弦對不上把位」的錯誤爬音 (第一次開始播 vi 的 bug)。
    const activeForm = isPlaying.value
      ? currentDynamicForm.value
      : getDynamicCagedForm(activeChord, keyRoot.value, cagedCycle.value);
    cagedSeq = generateCagedScaleSequence(
      keyRoot.value,
      activeChord,
      activeForm,
      selectedStage.value,
      selectedTrainingStageMode.value,
      false
    );
    prepVoicingNotes = resolveCagedChordVoicing(keyRoot.value, activeChord, activeForm);
  }

  trainerAudio.setBPM(bpm.value);
  trainerAudio.updateParams(
    progArray,
    selectedStage.value,
    false,
    isCustom,
    customTokens,
    cagedSeq,
    keyRoot.value,
    prepVoicingNotes,
    cagedCycle.value,
    triadMode,
    selectedTriadStringSet.value,
    selectedTriadDirection.value
  );
};

// 監聽設定狀態：
// 1. 保存到瀏覽器 localStorage。
// 2. 同步到音訊引擎。
// 注意：cagedCycle 是訓練進行中的暫時狀態，不需要保存。
watch([
  keyRoot,
  selectedProgressionName,
  savedProgressions,
  bpm,
  selectedTrainingStageMode,
  selectedStage,
  isLeftHanded,
  intervalDisplayMode,
  trainingInputMode,
  selectedTriadStringSet,
  selectedTriadDirection,
  customSequenceArray
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
  // builder 子頁開啟中、或清單為空時，不允許開始訓練。
  if (isCustomProgMode.value || savedProgressions.value.length === 0) return;

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
          <h3 class="text-sm font-bold text-zinc-400 tracking-wide">
            2. 和弦進行 Progression
            <span v-if="isCustomProgMode" class="text-emerald-400">— {{ editingProgId ? '編輯和弦進行' : '新增和弦進行' }}</span>
          </h3>
          <div v-if="!isCustomProgMode" class="flex gap-2 text-xs items-center">
            <button @click="isManagingProgList = false" class="px-3 py-1 rounded" :class="!isManagingProgList ? 'bg-zinc-700 text-white' : 'text-zinc-500'">和弦清單</button>
            <button @click="isManagingProgList = true" class="px-3 py-1 rounded" :class="isManagingProgList ? 'bg-zinc-700 text-white' : 'text-zinc-500'">管理</button>
          </div>
        </div>

        <div v-if="!isCustomProgMode">
          <!-- 管理分頁且清單為空時的提示 -->
          <div v-if="isManagingProgList && progressionListEntries.length === 0" class="text-zinc-500 text-sm text-center py-6">
            清單為空，請切到「和弦清單」按「＋ 新增進行」建立。
          </div>
          <div v-else class="grid grid-cols-3 gap-3">
            <div
              v-for="entry in progressionListEntries" :key="entry.key"
              class="rounded-xl border border-zinc-800 transition-all overflow-hidden flex flex-col"
              :class="selectedProgressionName === entry.key
                ? 'bg-emerald-500 text-black shadow-lg'
                : 'bg-zinc-950 text-zinc-400 hover:border-zinc-700'"
            >
              <button
                @click="selectedProgressionName = entry.key"
                class="flex-1 w-full p-4 font-bold text-center text-sm break-words cursor-pointer flex items-center justify-center"
              >
                {{ entry.name }}
              </button>
              <!-- 管理模式：大顆的編輯 / 刪除。綠色只在上方進行名稱，這條 bar 固定暗底 -->
              <div v-if="isManagingProgList" class="flex border-t border-zinc-700 text-xs font-bold bg-zinc-950">
                <button
                  @click.stop="editProg(savedProgressions.find(p => p.id === entry.key))"
                  class="flex-1 py-2 text-zinc-400 hover:bg-emerald-500/20 hover:text-emerald-400"
                >編輯</button>
                <button
                  @click.stop="deleteProg(entry.key)"
                  class="flex-1 py-2 border-l border-zinc-700 text-zinc-400 hover:bg-red-500/30 hover:text-red-400"
                >刪除</button>
              </div>
            </div>

            <!-- ＋ 新增進行 仮卡片（僅和弦清單分頁）：點擊切到 builder 子頁建立新進行 -->
            <button
              v-if="!isManagingProgList"
              @click="openNewProg"
              title="新增進行"
              class="rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:border-emerald-500/60 hover:text-emerald-400 transition-all p-4 flex items-center justify-center min-h-[3.5rem]"
            >
              <span class="text-2xl leading-none">＋</span>
            </button>
          </div>
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

          <!-- 保存 / 取消：回到和弦清單 -->
          <div class="flex items-center gap-3">
            <button
              @click="saveCurrentProgToList"
              :disabled="customProgressionArray.length === 0"
              class="px-4 py-2 bg-emerald-500 border border-emerald-400 rounded-xl font-bold text-sm text-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              保存
            </button>
            <button
              @click="cancelProgEdit"
              class="px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl font-bold text-sm text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-colors"
            >
              取消
            </button>
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
          <input
            type="range"
            :min="MIN_BPM" :max="MAX_BPM" step="5"
            v-model.number="bpm"
            class="flex-1 h-2 accent-emerald-400 cursor-pointer"
          />
          <div class="w-24 text-right font-black text-3xl text-zinc-100 tabular-nums">{{ bpm }} <span class="text-xs font-normal text-zinc-500">BPM</span></div>
        </div>
      </div>

      <div class="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800 space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-sm font-bold text-zinc-400 tracking-wide">4. 音程特訓模式演算法</h3>
          <div class="flex gap-2 text-xs">
            <button @click="trainingInputMode = 'stage'" class="px-3 py-1 rounded" :class="trainingInputMode === 'stage' ? 'bg-zinc-700 text-white' : 'text-zinc-500'">階梯爬升解鎖</button>
            <button @click="trainingInputMode = 'custom'" class="px-3 py-1 rounded" :class="trainingInputMode === 'custom' ? 'bg-zinc-700 text-white' : 'text-zinc-500'">自訂音序器</button>
            <button @click="trainingInputMode = 'triad'" class="px-3 py-1 rounded" :class="trainingInputMode === 'triad' ? 'bg-zinc-700 text-white' : 'text-zinc-500'">三和弦琶音</button>
          </div>
        </div>

        <div v-if="trainingInputMode === 'stage'" class="space-y-3">
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="(modeConfig, modeKey) in TRAINING_STAGE_MODES"
              :key="modeKey"
              @click="setTrainingStageMode(modeKey)"
              class="p-3 rounded-xl border text-left transition-all"
              :class="selectedTrainingStageMode === modeKey ? 'bg-emerald-500 border-emerald-400 text-black shadow-lg' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'"
            >
              <div class="font-black text-sm">{{ modeConfig.label }}</div>
              <div class="text-[0.65rem] opacity-70 mt-1 leading-snug">{{ modeConfig.subtitle }}</div>
            </button>
          </div>

          <div class="grid gap-2" :class="selectedTrainingStageMode === 'scale' ? 'grid-cols-3' : 'grid-cols-5'">
            <button
              v-for="s in activeTrainingStageNumbers"
              :key="selectedTrainingStageMode + '-stage-' + s"
              @click="selectedStage = s"
              class="py-3 rounded-xl border font-bold text-sm transition-all"
              :class="selectedStage === s ? 'bg-emerald-500 border-emerald-400 text-black font-black shadow-lg' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'"
            >
              Stage {{ s }}
            </button>
          </div>

          <div class="text-xs text-zinc-500 text-center pt-1 leading-relaxed">
            <p>
              <span class="font-bold text-emerald-400">【{{ currentTrainingStageDescription.title }}】</span>
              {{ currentTrainingStageDescription.detail }}
            </p>
          </div>
        </div>

        <div v-else-if="trainingInputMode === 'custom'" class="space-y-3">
          <!-- 已選音程序列 (Drop Zone) -->
          <div ref="sequenceContainerRef">
            <transition-group 
              name="list"
              tag="div"
              class="flex flex-wrap gap-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl min-h-[5rem] items-center relative transition-all"
            >
              <div v-if="customSequenceArray.length === 0" key="empty-sequence-msg" class="text-zinc-500 text-sm w-full text-center absolute left-0 pointer-events-none">請拖曳下方音程加入</div>
              <div 
                v-for="(tokenObj, index) in customSequenceArray"
                :key="tokenObj.id"
                data-sequence-card
                @pointerdown="startDrag($event, index, 'sequence')"
                class="px-4 py-2 font-mono font-black cursor-grab active:cursor-grabbing transition-all shadow-sm relative flex items-center justify-center rounded-lg border touch-none select-none bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                :class="[
                  activeSequenceGap === index ? 'ml-6 before:content-[\'\'] before:absolute before:-left-5 before:top-1/2 before:-translate-y-1/2 before:h-8 before:w-1.5 before:bg-emerald-400 before:rounded-full' : '',
                  index === customSequenceArray.length - 1 && activeSequenceGap === customSequenceArray.length ? 'mr-6 after:content-[\'\'] after:absolute after:-right-5 after:top-1/2 after:-translate-y-1/2 after:h-8 after:w-1.5 after:bg-emerald-400 after:rounded-full' : '',
                  dragState && dragState.source === 'sequence' && dragState.item === index && dragState.dragging ? 'prog-card-hidden' : '',
                  dragState && dragState.dragging ? '' : 'hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50'
                ]"
                title="點擊移除，拖放到縫隙中插入"
              >
                {{ tokenObj.value }}
              </div>
            </transition-group>
          </div>

          <!-- 可用音程庫 -->
          <div class="space-y-3">
            <div v-for="group in sequenceLibrary" :key="group.label" class="space-y-1.5">
              <div class="text-[0.7rem] font-bold text-zinc-500 tracking-wide uppercase">{{ group.label }}</div>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="token in group.tokens"
                  :key="'seq-lib-' + token"
                  @pointerdown="startDrag($event, token, 'sequenceLibrary')"
                  class="px-4 py-2 bg-zinc-900 text-zinc-300 border border-zinc-700 rounded-lg font-mono font-bold cursor-grab active:cursor-grabbing hover:bg-zinc-700 hover:text-white transition-colors touch-none select-none"
                  title="點擊或拖曳加入音序"
                >
                  {{ token }}
                </div>
              </div>
            </div>
          </div>

          <p class="text-xs text-zinc-500 text-center leading-relaxed">
            💡 支援 <span class="text-zinc-300">1-7</span> 代表順階度數，前綴 <span class="text-zinc-300">L</span> 代表低音，前綴 <span class="text-zinc-300">H</span> 代表高音。後台會依據當前和弦自動切換調式（Mode）防跑調。
          </p>
        </div>

        <div v-else class="space-y-3">
          <div class="text-[0.7rem] font-bold text-zinc-500 tracking-wide uppercase">連續三弦組</div>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="setKey in TRIAD_STRING_SET_KEYS"
              :key="'triad-set-' + setKey"
              @click="selectedTriadStringSet = setKey"
              class="py-3 rounded-xl border font-bold text-sm transition-all"
              :class="selectedTriadStringSet === setKey ? 'bg-emerald-500 border-emerald-400 text-black font-black shadow-lg' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'"
            >
              {{ setKey }} 弦
            </button>
          </div>

          <div class="text-[0.7rem] font-bold text-zinc-500 tracking-wide uppercase">爬音方向</div>
          <div class="grid grid-cols-2 gap-2">
            <button
              @click="selectedTriadDirection = 'ascending'"
              class="py-3 rounded-xl border font-bold text-sm transition-all"
              :class="selectedTriadDirection === 'ascending' ? 'bg-emerald-500 border-emerald-400 text-black font-black shadow-lg' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'"
            >
              上升 ↑（低→高）
            </button>
            <button
              @click="selectedTriadDirection = 'descending'"
              class="py-3 rounded-xl border font-bold text-sm transition-all"
              :class="selectedTriadDirection === 'descending' ? 'bg-emerald-500 border-emerald-400 text-black font-black shadow-lg' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'"
            >
              下降 ↓（高→低）
            </button>
          </div>

          <p class="text-xs text-zinc-500 text-center leading-relaxed">
            🎸 在選定的相鄰三弦上，用三和弦（Triad）彈奏上方的和弦進行。後台會依和弦性質（大 / 小 / 減）自動挑選轉回形，讓每次換和弦的<span class="text-zinc-300">琴格移動量最小</span>（Voice Leading）。Prep 刷三和弦，Train 依所選方向（上升 低→高 / 下降 高→低）逐音爬升。
          </p>
        </div>
      </div>



      <button
        @click="handleTogglePlay"
        :disabled="isCustomProgMode || savedProgressions.length === 0"
        class="w-full py-5 bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xl rounded-2xl transition-all active:scale-95 shadow-[0_4px_20px_rgba(52,211,153,0.3)] cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
      >
        {{ isCustomProgMode ? '請先保存或取消編輯中的進行'
          : savedProgressions.length === 0 ? '請先新增一組和弦進行'
          : '進入有氧特訓模式 START 🚀' }}
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

      <!-- 和弦時間下一列：退出特訓、音程顯示基準、目前把位。 -->
      <div class="train-controls flex flex-wrap items-center justify-between gap-2 w-full px-1">
        <div class="flex items-center gap-2">
          <button
            @click="exitTraining"
            class="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 font-bold rounded-lg text-zinc-500 text-xs transition-all cursor-pointer"
          >
            ✕ 退出特訓
          </button>
        </div>

        <div class="flex items-center gap-1 bg-zinc-950/80 border border-zinc-800 rounded-xl p-1">
          <span class="px-2 text-[0.7rem] font-bold text-zinc-500 whitespace-nowrap">音程顯示</span>
          <button
            @click="intervalDisplayMode = 'chord'"
            class="px-3 py-1.5 rounded-lg text-xs font-black transition-all"
            :class="intervalDisplayMode === 'chord'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/70'
              : 'text-zinc-500 border border-transparent hover:text-zinc-300'"
          >
            從 Chord
          </button>
          <button
            @click="intervalDisplayMode = 'key'"
            class="px-3 py-1.5 rounded-lg text-xs font-black transition-all"
            :class="intervalDisplayMode === 'key'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-400/70'
              : 'text-zinc-500 border border-transparent hover:text-zinc-300'"
          >
            從 Key
          </button>
        </div>

        <div class="flex items-center text-zinc-400 font-bold text-xs sm:text-sm whitespace-nowrap">
          目前把位:<span class="text-emerald-400 ml-1.5 text-base sm:text-lg">{{ currentPositionLabel }}</span>
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
          :intervalDisplayMode="intervalDisplayMode"
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