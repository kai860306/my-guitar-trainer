<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import Fretboard from './components/Fretboard.vue';
import { NOTE_NAMES, CHORD_MODES, PROGRESSION_PRESETS, generateCagedSequence, getDynamicCagedForm } from './utils/musicTheory.js';
import { AudioEngine } from './utils/audioEngine.js';

// 基礎設定狀態
const keyRoot = ref(0); // 0=C
const selectedProgressionName = ref('vi - IV - I - V');

const generateId = () => Math.random().toString(36).substr(2, 9);
const customProgressionArray = ref([]);
const availableChords = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const draggedItem = ref(null);
const activeGap = ref(null);
let isDroppedValid = false;
const isCustomProgMode = ref(false);

const bpm = ref(85);
const allowOpenStrings = ref(true); // 永遠開啟開放弦，不再提供關閉選項
const selectedStage = ref(5); // 階段 1-5
const isLeftHanded = ref(false);

// 自訂訓練音序器狀態
const isCustomSequenceMode = ref(false);
const customSequenceInput = ref('L5, L6, 1, 2, L7, 1');

// 運行與 UI 切換狀態
const isTrainingActive = ref(false); // 點擊 Start 切換至極簡運動 UI
const isPlaying = ref(false);

// 來自音訊引擎的即時時序同步訊號
const currentPhase = ref('prep'); // prep, train, predict
const localBeat4 = ref(0);
const currentChord = ref('vi');
const nextChord = ref('IV');
const activeNoteTarget = ref(null);

let trainerAudio = null;

onMounted(() => {
  trainerAudio = new AudioEngine();
});

// 解析和弦進行級數
const getActiveProgression = () => {
  if (!isCustomProgMode.value) {
    return PROGRESSION_PRESETS[selectedProgressionName.value];
  }
  return customProgressionArray.value.length > 0 
    ? customProgressionArray.value.map(c => typeof c === 'string' ? c : c.value) 
    : ['I'];
};

const handleDragStart = (item, source) => {
  draggedItem.value = { item, source };
  isDroppedValid = false;
};

const handleDrop = () => {
  if (!draggedItem.value) return;
  isDroppedValid = true; // 標記為成功放置
  const { item, source } = draggedItem.value;
  
  if (source === 'library') {
    customProgressionArray.value.push({ id: generateId(), value: item });
  } else if (source === 'progression') {
    // 簡單處理：將拖曳的元素移到最後面
    const oldIdx = item;
    const chordObj = customProgressionArray.value.splice(oldIdx, 1)[0];
    customProgressionArray.value.push(chordObj);
  }
  draggedItem.value = null;
  syncEngineParams();
};

const handleContainerDragOver = (e) => {
  e.preventDefault();
  if (!draggedItem.value) return;

  const container = e.currentTarget;
  // 找出所有的拖曳卡片 (排除過渡中或非目標元素)
  const cards = Array.from(container.children).filter(c => c.hasAttribute('draggable') && !c.classList.contains('list-leave-active'));
  
  if (cards.length === 0) {
    activeGap.value = 0;
    return;
  }

  let targetIndex = cards.length;
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect();
    const cardCenter = rect.left + rect.width / 2;
    if (e.clientX < cardCenter) {
      targetIndex = i;
      break;
    }
  }
  activeGap.value = targetIndex;
};

const handleContainerDragLeave = (e) => {
  // 如果滑鼠離開 container，可以清除提示，但此處為求穩定可保留最後判斷的 gap
};

const handleContainerDrop = (e) => {
  if (!draggedItem.value) return;
  isDroppedValid = true;
  const { item, source } = draggedItem.value;
  const targetIndex = activeGap.value !== null ? activeGap.value : customProgressionArray.value.length;
  
  if (source === 'library') {
    customProgressionArray.value.splice(targetIndex, 0, { id: generateId(), value: item });
  } else if (source === 'progression') {
    const oldIdx = item;
    if (oldIdx !== targetIndex && oldIdx + 1 !== targetIndex) {
      const chordObj = customProgressionArray.value[oldIdx];
      customProgressionArray.value.splice(oldIdx, 1);
      const adjustedTargetIndex = targetIndex > oldIdx ? targetIndex - 1 : targetIndex;
      customProgressionArray.value.splice(adjustedTargetIndex, 0, chordObj);
    }
  }
  draggedItem.value = null;
  activeGap.value = null;
  syncEngineParams();
};

const handleDragEnd = () => {
  draggedItem.value = null;
  activeGap.value = null;
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

// 🔄 同步前端面板參數至音訊引擎
const syncEngineParams = () => {
  if (!trainerAudio) return;
  const prog = getActiveProgression();
  const progArray = getActiveProgression();
  const customTokens = getCustomSequenceTokens();
  
  // 生成當前自動爬音序列
  const activeChord = isPlaying.value ? currentChord.value : progArray[0];
  const cagedSeq = generateCagedSequence(
    keyRoot.value, 
    activeChord, 
    currentDynamicForm.value, 
    selectedStage.value,
    false
  );
  
  trainerAudio.setBPM(bpm.value);
  trainerAudio.updateParams(
    progArray,
    selectedStage.value,
    false,
    isCustomSequenceMode.value,
    customTokens,
    cagedSeq,
    keyRoot.value
  );
};

// 監聽運動狀態，變更時動態補入參數
watch([keyRoot, selectedProgressionName, customProgressionArray, isCustomProgMode, bpm, selectedStage, isCustomSequenceMode, customSequenceInput, cagedCycle], () => {
  syncEngineParams();
}, { deep: true });

// 啟動訓練
const handleTogglePlay = () => {
  if (!trainerAudio) return;
  
  // 點擊開始時，直接切換到極簡運動佈局
  if (!isTrainingActive.value) {
    isTrainingActive.value = true;
  }

  syncEngineParams();
  const playingState = trainerAudio.toggle();
  isPlaying.value = playingState;

  if (playingState) {
    // 訂閱硬體時鐘回呼
    trainerAudio.onBeatTrigger = (tickData) => {
      currentPhase.value = tickData.phase;
      localBeat4.value = tickData.localBeat4;
      currentChord.value = tickData.currentChord;
      nextChord.value = tickData.nextChord;
      activeNoteTarget.value = tickData.activeNoteTarget;

      // 當和弦輪轉時，重新計算下一輪的預設爬音序列
      if (tickData.isChordStart || tickData.isRoundEnd) {
        
        // 【修正邏輯】當一個完整的進行輪迴結束，回到第 0 個和弦的第一拍時，才將把位推進
        if (tickData.isChordStart && tickData.currentChordIdx === 0 && tickData.globalBeat > 0) {
          cagedCycle.value++;
        }

        syncEngineParams();
      }
    };
  } else {
    // 停止時歸位
    currentPhase.value = 'prep';
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
  
  const progArray = getActiveProgression();
  currentChord.value = progArray[0];
  nextChord.value = progArray.length > 1 ? progArray[1] : progArray[0];
  
  if (trainerAudio) {
    trainerAudio.currentChordIdx = 0;
    trainerAudio.currentGlobalBeat = 0;
    trainerAudio.currentChordBeat = 0;
  }
};
</script>

<template>
  <div class="min-h-screen bg-black text-white p-4 font-sans selection:bg-emerald-500 selection:text-black">
    
    <div v-if="!isTrainingActive" class="max-w-3xl mx-auto space-y-6 pt-4 pb-12">
      
      <div class="flex justify-between items-center border-b border-zinc-800 pb-4">
        <h1 class="text-2xl font-black text-emerald-400 tracking-wider">⚡ CAGED 有氧吉他特訓核心</h1>
        <button 
          @click="isLeftHanded = !isLeftHanded"
          class="px-4 py-2 text-xs font-bold rounded-lg border transition-all"
          :class="isLeftHanded ? 'bg-amber-500 border-amber-400 text-black' : 'bg-zinc-900 border-zinc-700 text-zinc-400'"
        >
          {{ isLeftHanded ? '左手模式 (琴頭向右)' : '右手模式 (琴頭向左)' }}
        </button>
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
          <transition-group 
            name="list"
            tag="div"
            class="flex flex-wrap gap-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl min-h-[5rem] items-center relative transition-all"
            @dragover="handleContainerDragOver"
            @dragleave="handleContainerDragLeave"
            @drop="handleContainerDrop"
          >
            <div v-if="customProgressionArray.length === 0" key="empty-msg" class="text-zinc-500 text-sm w-full text-center absolute left-0 pointer-events-none">請拖曳下方和弦加入</div>
            <div 
              v-for="(chordObj, index) in customProgressionArray" 
              :key="chordObj.id"
              draggable="true"
              @dragstart="handleDragStart(index, 'progression')"
              @dragend="handleDragEnd"
              @click="removeChord(index)"
              class="px-4 py-2 font-bold cursor-pointer transition-all shadow-sm relative flex items-center justify-center rounded-lg border"
              :class="[
                activeGap === index ? 'ml-6 before:content-[\'\'] before:absolute before:-left-5 before:top-1/2 before:-translate-y-1/2 before:h-8 before:w-1.5 before:bg-transparent before:rounded-full' : '',
                'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50'
              ]"
              title="點擊移除，拖放到縫隙中插入"
            >
              {{ chordObj.value }}
            </div>
            <!-- 最終縫隙的高光提示 -->
            <div 
              v-if="customProgressionArray.length > 0 && activeGap === customProgressionArray.length"
              key="gap-final"
              class="h-8 w-1.5 bg-transparent rounded-full ml-2 transition-all"
            ></div>
          </transition-group>
          
          <!-- 可用和弦庫 -->
          <div class="flex flex-wrap gap-2">
            <div
              v-for="chord in availableChords"
              :key="'lib-' + chord"
              draggable="true"
              @dragstart="handleDragStart(chord, 'library')"
              @click="addChord(chord)"
              class="px-4 py-2 bg-zinc-900 text-zinc-300 border border-zinc-700 rounded-lg font-bold cursor-pointer hover:bg-zinc-700 hover:text-white transition-colors"
              title="點擊或拖曳加入進行"
            >
              {{ chord }}
            </div>
          </div>
        </div>
      </div>

      <div class="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800 flex flex-col justify-between">
        <h3 class="text-sm font-bold text-zinc-400 tracking-wide mb-2">3. 訓練速度 (BPM)</h3>
        <div class="flex items-center gap-4">
          <button @click="bpm = Math.max(40, bpm - 5)" class="w-12 h-12 bg-zinc-950 border border-zinc-800 rounded-xl font-black text-xl hover:border-zinc-700">-</button>
          <div class="flex-1 text-center font-black text-3xl text-zinc-100">{{ bpm }} <span class="text-xs font-normal text-zinc-500">BPM</span></div>
          <button @click="bpm = Math.min(240, bpm + 5)" class="w-12 h-12 bg-zinc-950 border border-zinc-800 rounded-xl font-black text-xl hover:border-zinc-700">+</button>
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

    <div v-else class="min-h-screen flex flex-col justify-between max-w-5xl mx-auto py-4 space-y-4">
      
      <div 
        class="w-full text-center py-3 rounded-2xl border font-black text-lg tracking-widest transition-all duration-75"
        :class="[
          currentPhase === 'predict' 
            ? 'bg-red-600/90 border-red-400 text-white animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.6)]' 
            : 'bg-zinc-900/50 border-zinc-800 text-zinc-400'
        ]"
      >
        <span v-if="currentPhase === 'predict'">⚠️ NEXT CHORD 預告切換：{{ nextChord }} !!</span>
        <span v-else>NEXT CHORD: {{ nextChord }}</span>
      </div>

      <div class="text-center py-6 flex flex-col items-center justify-center relative">
        <div class="flex gap-4 mb-4">
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

        <h1 class="text-9xl font-black text-red-500 tracking-widest transition-transform duration-200" :class="{ 'scale-105': localBeat4 === 0 }">
          {{ currentChord }}
        </h1>
        <p class="text-xl text-zinc-400 font-medium mt-1">
          {{ NOTE_NAMES[(keyRoot + CHORD_MODES[currentChord]?.offset) % 12] }} {{ CHORD_MODES[currentChord]?.alias }} 和弦時間 
          <span class="text-zinc-600 text-sm ml-2">({{ CHORD_MODES[currentChord]?.name }} Mode)</span>
        </p>
        
        <div class="absolute right-4 top-4 text-xs font-mono px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-emerald-400 uppercase tracking-widest">
          {{ currentPhase }} phase
        </div>
      </div>

      <div class="w-full">
        <Fretboard 
          :keyRoot="keyRoot" 
          :currentChord="currentChord" 
          :currentDynamicForm="currentDynamicForm" 
          :isLeftHanded="isLeftHanded"
          :currentPhase="currentPhase"
          :activeNoteTarget="activeNoteTarget"
          :allowOpenStrings="false"
        />
      </div>

      <div class="grid grid-cols-3 gap-4 items-center bg-zinc-900/30 p-4 rounded-2xl border border-zinc-900">
        <button @click="exitTraining" class="py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 font-bold rounded-xl text-zinc-400 text-sm transition-all cursor-pointer">
          ✕ 退出特訓
        </button>

        <button 
          @click="handleTogglePlay" 
          class="py-5 rounded-xl font-black text-lg tracking-wider transition-all cursor-pointer shadow-lg"
          :class="isPlaying ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-emerald-500 hover:bg-emerald-400 text-black'"
        >
          {{ isPlaying ? '⏸️ PAUSE' : '▶️ RESUME' }}
        </button>

        <div class="flex items-center justify-end pr-2 text-zinc-400 font-bold text-sm">
          目前把位: <span class="text-emerald-400 ml-2 text-lg">{{ currentFormName }} 型</span>
        </div>
      </div>

    </div>

  </div>
</template>

<style scoped>
/* 拖拉字卡的動畫過場效果 */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
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
</style>