// src/utils/audioEngine.js
import {
  CHORD_MODES,
  getAbsoluteNoteFromToken,
  getChordPitches,
  getDynamicCagedForm,
  resolveCagedChordVoicing
} from './musicTheory.js';

export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.bpm = 80;
    this.currentGlobalBeat = 0;
    
    this.nextNoteTime = 0.0;
    this.lookahead = 25.0;
    this.scheduleAheadTime = 0.1;
    this.timerId = null;
    this.currentChordBeat = 0;
    // 訓練一開始的「導入預告期」剩餘拍數：
    // 第一個和弦在 prep 播放前，先走 4 拍 predict (僅節拍器 + 閃爍，不刮弦)。
    this.introBeatsRemaining = 0;
    
    // 訓練設定
    this.progression = ['I', 'IV', 'V'];
    this.currentChordIdx = 0;
    this.stage = 1;
    this.allowOpen = false;
    
    this.isCustomMode = false;
    this.customTokens = [];
    this.cagedSequence = [];
    this.prepChordVoicingNotes = [];
    this.currentCagedCycle = 0;
    
    this.onBeatTrigger = null; 
  }

  init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  setBPM(newBPM) {
    this.bpm = Number(newBPM);
  }
  
  updateParams(
    prog,
    stage,
    allowOpen,
    isCustom,
    tokens,
    cagedSeq,
    keyRoot,
    prepChordVoicingNotes = [],
    cagedCycle = null
  ) {
    this.progression = prog;
    this.stage = stage;
    this.allowOpen = allowOpen;
    this.isCustomMode = isCustom;
    this.customTokens = tokens;
    this.cagedSequence = cagedSeq;
    this.keyRoot = keyRoot;
    this.prepChordVoicingNotes = prepChordVoicingNotes;

    // 播放中由排程器自己推進 CAGED cycle，避免 lookahead 回呼造成第一拍和弦提示落後。
    if (!this.isPlaying && Number.isFinite(cagedCycle)) {
      this.currentCagedCycle = cagedCycle;
    }
  }

  createPluckedSound(freq, time) {
    const osc = this.audioCtx.createOscillator();
    
    // 自訂週期波形，增加泛音豐富度
    const real = new Float32Array([0, 1, 0.5, 0.25, 0.125, 0.06, 0.03]);
    const imag = new Float32Array([0, 0, 0, 0, 0, 0, 0]);
    const wave = this.audioCtx.createPeriodicWave(real, imag);
    osc.setPeriodicWave(wave);
    osc.frequency.value = freq;

    // 低通濾波器包絡線：模擬撥弦瞬間高頻豐富，隨後快速衰減
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, time);
    filter.frequency.exponentialRampToValueAtTime(150, time + 1.5);

    // 音量包絡線：快速 Attack，自然衰減 Decay
    const gainNode = this.audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.6, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 2.0);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    
    osc.start(time);
    osc.stop(time + 2.0);
  }

  // 語音倒數合成音
  speakCount(word) {
    if ('speechSynthesis' in window) {
      // 先取消前一個語音防止堆疊延遲
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 1.4;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  }

  scheduleNote(globalBeat, time) {
    // 【導入預告期】整段訓練最初的第一個和弦，在進入 prep 前先走 4 拍 predict。
    // 只有節拍器 (高音 Click) 與有氧人聲倒數，並讓第一個和弦本身在中央閃爍；和弦不在此播放。
    if (this.introBeatsRemaining > 0) {
      const introLocalBeat = 4 - this.introBeatsRemaining; // 0..3

      // predict 風格的高音 Click
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      osc.frequency.value = 587.33;
      gainNode.gain.setValueAtTime(0.08, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      osc.start(time);
      osc.stop(time + 0.06);

      // 有氧人聲語音倒數
      if (this.onBeatTrigger) {
        const words = ['One', 'Two', 'Three', 'Four'];
        setTimeout(() => {
          this.speakCount(words[introLocalBeat]);
        }, (time - this.audioCtx.currentTime) * 1000);

        const snapChordIdx = this.currentChordIdx;
        const snapCurrentChord = this.progression[snapChordIdx];
        const snapNextChord = this.progression[(snapChordIdx + 1) % this.progression.length];

        setTimeout(() => {
          this.onBeatTrigger({
            globalBeat,
            chordBeat: -1,
            localBeat4: introLocalBeat,
            phase: 'predict',
            isIntroPredict: true,
            currentChordIdx: snapChordIdx,
            currentChord: snapCurrentChord,
            nextChord: snapNextChord,
            activeNoteTarget: null,
            isChordStart: false,
            isRoundEnd: false
          });
        }, (time - this.audioCtx.currentTime) * 1000);
      }

      this.introBeatsRemaining--;
      return;
    }

    const trainLen = this.isCustomMode ? this.customTokens.length : this.cagedSequence.length;
    const trainTotalBeats = Math.max(1, trainLen); // 確保至少有 1 拍
    const chordTotalBeats = 4 + trainTotalBeats + 4; // Prep + Train + Predict

    let phase = 'prep'; 
    if (this.currentChordBeat >= 4 && this.currentChordBeat < 4 + trainTotalBeats) {
      phase = 'train';
    } else if (this.currentChordBeat >= 4 + trainTotalBeats) {
      phase = 'predict';
    }

    let localBeat4 = 0;
    if (phase === 'prep') {
      localBeat4 = this.currentChordBeat;
    } else if (phase === 'train') {
      localBeat4 = (this.currentChordBeat - 4) % 4;
    } else if (phase === 'predict') {
      localBeat4 = this.currentChordBeat - (4 + trainTotalBeats);
    }

    let activeNoteTarget = null;

    if (phase === 'prep') {
      // 【準備期】響起標準 Clicks
      const clickOsc = this.audioCtx.createOscillator();
      const clickGain = this.audioCtx.createGain();
      clickOsc.connect(clickGain);
      clickGain.connect(this.audioCtx.destination);
      clickOsc.frequency.value = localBeat4 === 0 ? 880 : 440;
      clickGain.gain.setValueAtTime(0.15, time);
      clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      clickOsc.start(time);
      clickOsc.stop(time + 0.1);

      // 第一拍時播放吉他和弦刷弦伴奏：使用資料定義式 CAGED voicing
      if (localBeat4 === 0 && this.keyRoot !== undefined) {
        const chordStr = this.progression[this.currentChordIdx];
        const chordConfig = CHORD_MODES[chordStr];

        if (chordConfig) {
          // 優先在音訊排程當下依目前和弦與 CAGED cycle 即時計算 voicing。
          // 這可避免進行回到第 1 個和弦時，prep 第一拍仍播放上一輪把位的問題。
          const liveForm = getDynamicCagedForm(chordStr, this.keyRoot, this.currentCagedCycle);
          const liveVoicingNotes = resolveCagedChordVoicing(this.keyRoot, chordStr, liveForm);
          const sourceVoicingNotes = liveVoicingNotes.length > 0
            ? liveVoicingNotes
            : this.prepChordVoicingNotes;

          if (sourceVoicingNotes && sourceVoicingNotes.length > 0) {
            // 模擬真實吉他刷弦：從粗弦刷到細弦
            const strumNotes = [...sourceVoicingNotes].sort((a, b) => b.stringIndex - a.stringIndex);
            
            strumNotes.forEach((noteObj, idx) => {
              const baseOffsets = [24, 19, 15, 10, 5, 0];
              const freq = 110 * Math.pow(2, (noteObj.fret + baseOffsets[noteObj.stringIndex]) / 12);
              this.createPluckedSound(freq, time + idx * 0.025);
            });
          } else {
            // 防呆 fallback
            const pitches = getChordPitches(this.keyRoot, chordStr);
            pitches.forEach((freq, idx) => {
              this.createPluckedSound(freq, time + idx * 0.02);
            });
          }
        }
      }
    } else if (phase === 'train') {
      const trainIndex = this.currentChordBeat - 4;
      
      if (this.isCustomMode) {
        if (this.customTokens.length > 0) {
          const token = this.customTokens[trainIndex % this.customTokens.length];
          const chordStr = this.progression[this.currentChordIdx];

          // 修正：原本參數順序反了。正確順序是 keyRoot, chordDegreeStr, token。
          const absNote = getAbsoluteNoteFromToken(this.keyRoot, chordStr, token);
          
          const freq = 130.81 * Math.pow(2, (absNote - 0) / 12); 
          this.createPluckedSound(freq, time);
          activeNoteTarget = { type: 'custom', token, trainIndex };
        }
      } else {
        if (trainIndex < this.cagedSequence.length) {
          const noteObj = this.cagedSequence[trainIndex];

          // 以 5 弦空弦 A2=110Hz 為基準推算各弦音高
          const baseOffsets = [24, 19, 15, 10, 5, 0];
          const freq = 110 * Math.pow(2, (noteObj.fret + baseOffsets[noteObj.stringIndex]) / 12);
          
          this.createPluckedSound(freq, time);
          activeNoteTarget = {
            type: 'default',
            stringIndex: noteObj.stringIndex,
            fret: noteObj.fret,
            absoluteNote: noteObj.absoluteNote,
            interval: noteObj.intervalFromChordRoot,
            intervalLabel: noteObj.intervalLabel || noteObj.interval
          };
        }
      }
    } else if (phase === 'predict') {
      // 【預告期】高音 Click 輔助
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      osc.frequency.value = 587.33; 
      gainNode.gain.setValueAtTime(0.08, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      osc.start(time);
      osc.stop(time + 0.06);

      // 有氧人聲語音同步排程
      if (this.onBeatTrigger) {
        const words = ['One', 'Two', 'Three', 'Four'];
        setTimeout(() => {
          this.speakCount(words[localBeat4]);
        }, (time - this.audioCtx.currentTime) * 1000);
      }
    }

    // 觸發 Vue 渲染
    if (this.onBeatTrigger) {
      const currentBeat = this.currentChordBeat;
      const isChordStart = currentBeat === 0;
      const isRoundEnd = currentBeat === chordTotalBeats - 1;

      // 先在排程當下把和弦索引凍結成區域常數。
      const snapChordIdx = this.currentChordIdx;
      const snapCurrentChord = this.progression[snapChordIdx];
      const snapNextChord = this.progression[(snapChordIdx + 1) % this.progression.length];

      setTimeout(() => {
        this.onBeatTrigger({
          globalBeat,
          chordBeat: currentBeat,
          localBeat4,
          phase,
          currentChordIdx: snapChordIdx,
          currentChord: snapCurrentChord,
          nextChord: snapNextChord,
          activeNoteTarget,
          isChordStart,
          isRoundEnd
        });
      }, (time - this.audioCtx.currentTime) * 1000);
    }

    // 推進本和弦內的拍數
    this.currentChordBeat++;
    if (this.currentChordBeat >= chordTotalBeats) {
      this.currentChordBeat = 0;
      this.currentChordIdx = (this.currentChordIdx + 1) % this.progression.length;

      // 一輪進行回到第 1 個和弦時，音訊引擎也同步推進 CAGED cycle。
      if (this.currentChordIdx === 0) {
        this.currentCagedCycle++;
      }
    }
  }

  scheduler() {
    while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentGlobalBeat, this.nextNoteTime);
      const secondsPerBeat = 60.0 / this.bpm;
      this.nextNoteTime += secondsPerBeat;
      this.currentGlobalBeat++;
    }
    this.timerId = setTimeout(() => this.scheduler(), this.lookahead);
  }

  toggle() {
    this.init();

    if (this.isPlaying) {
      this.isPlaying = false;
      clearTimeout(this.timerId);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } else {
      this.isPlaying = true;
      this.currentGlobalBeat = 0;
      this.currentChordBeat = 0;
      this.currentChordIdx = 0;
      this.currentCagedCycle = 0;
      this.introBeatsRemaining = 4;
      this.nextNoteTime = this.audioCtx.currentTime + 0.05;
      this.scheduler();
    }

    return this.isPlaying;
  }
}