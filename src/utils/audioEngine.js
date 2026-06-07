// src/utils/audioEngine.js
import { CHORD_MODES, getAbsoluteNoteFromToken, getChordPitches } from './musicTheory.js';

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
    
    // 訓練設定
    this.progression = ['I', 'IV', 'V'];
    this.currentChordIdx = 0;
    this.stage = 1;
    this.allowOpen = false;
    
    this.isCustomMode = false;
    this.customTokens = [];
    this.cagedSequence = [];
    
    this.onBeatTrigger = null; 
  }

  init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  setBPM(newBPM) { this.bpm = Number(newBPM); }
  
  updateParams(prog, stage, allowOpen, isCustom, tokens, cagedSeq, keyRoot) {
    this.progression = prog;
    this.stage = stage;
    this.allowOpen = allowOpen;
    this.isCustomMode = isCustom;
    this.customTokens = tokens;
    this.cagedSequence = cagedSeq;
    this.keyRoot = keyRoot;
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
    const trainLen = this.isCustomMode ? this.customTokens.length : this.cagedSequence.length;
    const trainTotalBeats = Math.max(1, trainLen); // 確保至少有1拍，取消向4對齊的Padding機制
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

      // 第一拍時播放吉他和弦刷扣伴奏 (基於真實 CAGED 把位)
      if (localBeat4 === 0 && this.keyRoot !== undefined) {
        const chordStr = this.progression[this.currentChordIdx];
        const chordConfig = CHORD_MODES[chordStr];
        
        if (chordConfig && this.cagedSequence && this.cagedSequence.length > 0) {
          const chordTones = chordConfig.mode;
          const strumNotes = [];
          
          // 模擬真實吉他刷弦：從粗弦 (6弦, stringIndex=5) 刷到細弦 (1弦, stringIndex=0)
          for (let s = 5; s >= 0; s--) {
            const notesOnString = this.cagedSequence.filter(n => n.stringIndex === s && chordTones.includes(n.intervalFromChordRoot));
            if (notesOnString.length > 0) {
              // 取該弦上該把位最低的組成音
              strumNotes.push(notesOnString[0]);
            }
          }
          
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
    } else if (phase === 'train') {
      const trainIndex = this.currentChordBeat - 4;
      
      if (this.isCustomMode) {
        if (this.customTokens.length > 0) {
          const token = this.customTokens[trainIndex % this.customTokens.length];
          const chordStr = this.progression[this.currentChordIdx];
          const absNote = getAbsoluteNoteFromToken(token, this.keyRoot, chordStr);
          
          const freq = 130.81 * Math.pow(2, (absNote - 0) / 12); 
          this.createPluckedSound(freq, time);
          activeNoteTarget = { type: 'custom', token, trainIndex };
        }
      } else {
        if (trainIndex < this.cagedSequence.length) {
          const noteObj = this.cagedSequence[trainIndex];
          // 粗略估算吉他各弦的基頻 (Standard Tuning)
          // 6弦(E2)=82.4, 5弦(A2)=110, 4弦(D3)=146.8, 3弦(G3)=196, 2弦(B3)=246.9, 1弦(E4)=329.6
          // 這裡以 5弦空弦 A2=110Hz 為基準推算
          const baseOffsets = [24, 19, 15, 10, 5, 0]; // 1~6弦距離 A2 的半音差
          const freq = 110 * Math.pow(2, (noteObj.fret + baseOffsets[noteObj.stringIndex]) / 12);
          
          this.createPluckedSound(freq, time);
          activeNoteTarget = { type: 'default', stringIndex: noteObj.stringIndex, fret: noteObj.fret, absoluteNote: noteObj.absoluteNote, interval: noteObj.intervalFromChordRoot };
        }
      }
    } 
    else if (phase === 'predict') {
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

      setTimeout(() => {
        this.onBeatTrigger({
          globalBeat,
          chordBeat: currentBeat,
          localBeat4,
          phase,
          currentChordIdx: this.currentChordIdx,
          currentChord: this.progression[this.currentChordIdx],
          nextChord: this.progression[(this.currentChordIdx + 1) % this.progression.length],
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
      this.nextNoteTime = this.audioCtx.currentTime + 0.05;
      this.scheduler();
    }
    return this.isPlaying;
  }
}