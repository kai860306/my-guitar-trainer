// src/utils/audioEngine.js
import {
  CHORD_MODES,
  getAbsoluteNoteFromToken,
  getChordPitches,
  getDynamicCagedForm,
  resolveCagedChordVoicing,
  generateTriadProgressionVoicings
} from './musicTheory.js';

// ===============================
// 撥弦音色可調參數
// ===============================
// 調整建議：
// 1. 想要更像吉他：提高 harmonics、filterStartHz、縮短 attackTimeSeconds。
// 2. 想要少一點節拍器 click 感：稍微拉長 attackTimeSeconds，但不要超過 0.012。
// 3. 想要更多弦振動感：提高 resonanceWetGain 或 feedbackStartGain。
// 4. 想要更乾、更短、更像練習用提示音：降低 resonanceWetGain、feedbackStartGain、decayTimeSeconds。
// 5. 如果聲音變成金屬管、機械聲，通常是 feedbackStartGain 或 resonanceWetGain 太高。
const PLUCKED_SOUND_CONFIG = Object.freeze({
  // 泛音比例。
  // 越高越亮、越有撥弦感；越低越圓滑，但太低會失去吉他感。
  // 建議範圍：
  // - 亮一點：[1, 0.65, 0.38, 0.22, 0.12, 0.06, 0.03]
  // - 柔一點：[1, 0.48, 0.24, 0.12, 0.06, 0.03, 0.015]
  harmonics: [1, 0.58, 0.32, 0.18, 0.09, 0.045, 0.022],

  // 第二個 oscillator 的微小音高偏移，單位是 cents。
  // 這會製造兩條弦微微互相干涉的感覺。
  // 數值太大會像 chorus 或走音。
  detuneAInCents: -3,
  detuneBInCents: 4,

  // 兩個 oscillator 的混合比例。
  // oscB 太大會變得比較厚，但也可能比較不準、比較合成器感。
  oscAGain: 0.75,
  oscBGain: 0.35,

  // 起音時間。
  // 這是「節拍器 click 感」和「吉他撥弦感」的主要平衡點。
  // 建議：
  // - 0.004：最像撥弦，但 click 感也比較明顯。
  // - 0.006：平衡型，推薦。
  // - 0.009：click 感較少，仍保留吉他感。
  // - 0.012：更柔，但吉他感會開始變弱。
  attackTimeSeconds: 0.006,

  // 撥弦最高音量。
  // 太高會刺、太低會沒有存在感。
  peakGain: 0.55,

  // 尾音長度。
  // 越長越像弦在延續震動；越短越像提示音。
  decayTimeSeconds: 2.2,

  // 起音時的濾波器亮度。
  // 越高越亮、越像鋼弦；越低越柔、越不像真吉他。
  filterStartHz: 4200,

  // 尾音最後收斂到的亮度。
  // 越低尾音越暗；越高尾音越亮。
  filterEndHz: 420,

  // 濾波器變暗的速度。
  // 越短越快變暗；越長越保留亮度。
  filterDecayTimeSeconds: 1.8,

  // 濾波器 Q 值。
  // 稍微提高會有一點共鳴感；太高會尖銳。
  filterQ: 0.8,

  // 弦共鳴 delay 的最大時間。
  // 通常不需要改。
  maxResonanceDelaySeconds: 0.06,

  // 弦共鳴 feedback 初始值。
  // 這是「弦振動感」最重要的參數之一。
  // 建議：
  // - 0.16：乾淨、短。
  // - 0.22：平衡型，推薦。
  // - 0.26：弦感更明顯。
  // - 0.30 以上：容易變金屬聲或假。
  feedbackStartGain: 0.22,

  // feedback 最後收斂到的值。
  // 不要設成 0，exponentialRampToValueAtTime 不適合 ramp 到 0。
  feedbackEndGain: 0.04,

  // feedback 衰減時間。
  // 越長共鳴越久；太長會拖泥帶水。
  feedbackDecayTimeSeconds: 1.6,

  // dry 是直接音，wet 是短 delay 共鳴音。
  // wet 越高，弦震動與箱體共鳴感越多；太高會像效果器。
  dryGain: 0.9,
  resonanceWetGain: 0.18,

  // 非常輕微的音高搖動。
  // 用來模擬弦振動時的不穩定感。
  // 太大會變 vibrato，不像單純撥弦。
  lfoFrequencyHz: 5.2,
  lfoDepthInCents: 1.6,

  // 音訊節點停止後，延後一點清理 AudioGraph。
  cleanupExtraSeconds: 0.25
});

// ===============================
// 節拍器 Click 音色可調參數（木魚 / woodblock 風）
// ===============================
// 背景：舊版是「三角波 + 白噪 transient」，白噪讓 click 聽起來廉價、電子感重。
// 這裡改成無噪音的合成木魚：起音瞬間讓音高快速下掉（pitch drop）做出「叩」的
// 敲擊感，再疊一個很短的高頻 knock 泛音強化木頭質感。整體是溫暖自然的「トッ」。
// 調整建議：
// 1. 想更響／更容易聽到：提高 bodyGainScale。
// 2. 想更「硬、更像敲木頭」：提高 pitchStartRatio、knockGain。
// 3. 想更「圓、更悶」：降低 pitchStartRatio、knockGain，或縮短 knockDecaySeconds。
// 4. 想更長的木魚餘韻：加大 decaySeconds（不要超過 0.12）。
const METRONOME_CLICK_CONFIG = Object.freeze({
  // 整體音量倍率（乘在呼叫端傳入的 volume 上）。
  bodyGainScale: 1.6,

  // 起音瞬間的音高上衝比例：頻率從 frequency * pitchStartRatio 在 pitchDropSeconds
  // 內快速掉回 frequency。這個下掉就是木魚「叩」的敲擊感來源。
  pitchStartRatio: 1.6,
  pitchDropSeconds: 0.008,

  // 起音爬升時間。極短即可，用來避免瞬間跳變產生的爆音 (pop)。
  attackSeconds: 0.001,

  // 本體衰減長度。越短越乾、越像小木魚；越長餘韻越多。
  decaySeconds: 0.06,

  // 高頻 knock 泛音：很短、非整數倍（inharmonic），強化木頭敲擊質感。
  knockRatio: 3.2,
  knockGain: 0.4,
  knockDecaySeconds: 0.028
});

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
    cagedCycle = null,
    triadMode = false,
    triadStringSet = '2-4'
  ) {
    this.progression = prog;
    this.stage = stage;
    this.allowOpen = allowOpen;
    this.isCustomMode = isCustom;
    this.customTokens = tokens;
    this.cagedSequence = cagedSeq;
    this.keyRoot = keyRoot;
    this.prepChordVoicingNotes = prepChordVoicingNotes;
    // 三和弦模式：prep 刷弦與 train 爬音都改由引擎依 currentChordIdx / currentCagedCycle
    //            即時計算（getLiveTriadVoicings），避免 Vue 回呼落後造成刷弦停在第一個和弦。
    this.triadMode = triadMode;
    this.triadStringSet = triadStringSet;
    this._triadCacheKey = null; // 參數變更後讓三和弦快取失效。

    // 播放中由排程器自己推進 CAGED cycle，避免 lookahead 回呼造成第一拍和弦提示落後。
    if (!this.isPlaying && Number.isFinite(cagedCycle)) {
      this.currentCagedCycle = cagedCycle;
    }
  }

  // 依指定 cycle 即時（memoized）計算整組進行的三和弦轉回形序列。
  // 以 currentChordIdx 取當前和弦，達成刷弦 / 爬音與排程器同步、每輪往高把位推進。
  getLiveTriadVoicings(cycle) {
    const key = `${cycle}|${this.keyRoot}|${this.triadStringSet}|${(this.progression || []).join(',')}`;
    if (this._triadCacheKey !== key) {
      this._triadVoicings = generateTriadProgressionVoicings(
        this.keyRoot,
        this.progression,
        this.triadStringSet,
        { cycle }
      );
      this._triadCacheKey = key;
    }
    return this._triadVoicings;
  }

  createPluckedSound(freq, time) {
    const cfg = PLUCKED_SOUND_CONFIG;

    // 兩個非常接近的 oscillator 疊在一起，製造弦振動時的細微拍頻。
    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();

    // 使用設定檔裡的泛音比例。
    // Float32Array 第一個元素是 DC 成分，所以放 0；後面才是各階泛音。
    const real = new Float32Array([0, ...cfg.harmonics]);
    const imag = new Float32Array(real.length);
    const wave = this.audioCtx.createPeriodicWave(real, imag);

    osc1.setPeriodicWave(wave);
    osc2.setPeriodicWave(wave);

    osc1.frequency.value = freq;
    osc2.frequency.value = freq;

    // 微小 detune 會讓音色比較像真弦，而不是單一穩定 oscillator。
    osc1.detune.setValueAtTime(cfg.detuneAInCents, time);
    osc2.detune.setValueAtTime(cfg.detuneBInCents, time);

    const osc1Gain = this.audioCtx.createGain();
    const osc2Gain = this.audioCtx.createGain();
    osc1Gain.gain.setValueAtTime(cfg.oscAGain, time);
    osc2Gain.gain.setValueAtTime(cfg.oscBGain, time);

    const sourceGain = this.audioCtx.createGain();

    // 音量包絡線：
    // 這裡用極短 attack 保留撥弦感，同時避免音量瞬間跳變造成明顯 click。
    sourceGain.gain.setValueAtTime(0.001, time);
    sourceGain.gain.linearRampToValueAtTime(cfg.peakGain, time + cfg.attackTimeSeconds);
    sourceGain.gain.exponentialRampToValueAtTime(0.001, time + cfg.decayTimeSeconds);

    // 低通濾波器：
    // 起音較亮，尾音逐漸變暗，模擬吉他弦振動後高頻慢慢消失。
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cfg.filterStartHz, time);
    filter.frequency.exponentialRampToValueAtTime(cfg.filterEndHz, time + cfg.filterDecayTimeSeconds);
    filter.Q.setValueAtTime(cfg.filterQ, time);

    // 很短的 delay feedback，模擬弦長造成的 comb resonance。
    // 這是讓聲音有「弦在震」感覺的關鍵。
    const stringDelay = this.audioCtx.createDelay(cfg.maxResonanceDelaySeconds);
    const feedbackGain = this.audioCtx.createGain();
    const wetGain = this.audioCtx.createGain();
    const dryGain = this.audioCtx.createGain();

    // delay time 接近該音高的一個週期。
    // 低音週期較長，高音週期較短，這樣共鳴會跟音高連動。
    const stringPeriod = Math.min(
      cfg.maxResonanceDelaySeconds,
      Math.max(0.001, 1 / freq)
    );
    stringDelay.delayTime.setValueAtTime(stringPeriod, time);

    feedbackGain.gain.setValueAtTime(cfg.feedbackStartGain, time);
    feedbackGain.gain.exponentialRampToValueAtTime(
      cfg.feedbackEndGain,
      time + cfg.feedbackDecayTimeSeconds
    );

    dryGain.gain.setValueAtTime(cfg.dryGain, time);
    wetGain.gain.setValueAtTime(cfg.resonanceWetGain, time);

    // 輕微 LFO：
    // 讓音高有非常小的搖動，增加弦振動的不穩定感。
    const lfo = this.audioCtx.createOscillator();
    const lfoDepth = this.audioCtx.createGain();
    lfo.frequency.setValueAtTime(cfg.lfoFrequencyHz, time);
    lfoDepth.gain.setValueAtTime(cfg.lfoDepthInCents, time);

    lfo.connect(lfoDepth);
    lfoDepth.connect(osc1.detune);
    lfoDepth.connect(osc2.detune);

    osc1.connect(osc1Gain);
    osc2.connect(osc2Gain);
    osc1Gain.connect(sourceGain);
    osc2Gain.connect(sourceGain);

    sourceGain.connect(filter);

    // dry：原本的直接撥弦音。
    filter.connect(dryGain);
    dryGain.connect(this.audioCtx.destination);

    // wet：短 delay 共鳴音。
    filter.connect(stringDelay);
    stringDelay.connect(wetGain);
    wetGain.connect(this.audioCtx.destination);

    // feedback loop：讓弦的共鳴短暫延續。
    stringDelay.connect(feedbackGain);
    feedbackGain.connect(stringDelay);

    osc1.start(time);
    osc2.start(time);
    lfo.start(time);

    const stopTime = time + cfg.decayTimeSeconds + 0.1;
    osc1.stop(stopTime);
    osc2.stop(stopTime);
    lfo.stop(stopTime);

    // 避免 delay feedback loop 在聲音結束後還留在 AudioGraph 裡。
    const cleanupDelayMs = Math.max(
      0,
      (stopTime + cfg.cleanupExtraSeconds - this.audioCtx.currentTime) * 1000
    );

    setTimeout(() => {
      try {
        osc1.disconnect();
        osc2.disconnect();
        osc1Gain.disconnect();
        osc2Gain.disconnect();
        sourceGain.disconnect();
        filter.disconnect();
        stringDelay.disconnect();
        feedbackGain.disconnect();
        wetGain.disconnect();
        dryGain.disconnect();
        lfo.disconnect();
        lfoDepth.disconnect();
      } catch (error) {
        // 節點可能已經被瀏覽器回收，這裡不需要中斷播放流程。
      }
    }, cleanupDelayMs);
  }

  scheduleMetronomeClick(time, frequency, volume = 0.08, duration = 0.06) {
    const cfg = METRONOME_CLICK_CONFIG;
    const decay = Math.min(Math.max(duration, cfg.decaySeconds), 0.12);
    const bodyPeak = Math.max(0.0001, volume * cfg.bodyGainScale);

    // --- 本體：起音瞬間音高快速下掉，做出木魚「叩」的敲擊感 ---
    const bodyGain = this.audioCtx.createGain();
    bodyGain.connect(this.audioCtx.destination);

    const osc1 = this.audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(frequency * cfg.pitchStartRatio, time);
    osc1.frequency.exponentialRampToValueAtTime(
      frequency,
      time + cfg.pitchDropSeconds
    );
    osc1.connect(bodyGain);

    // 極短起音（避免爆音）+ 快速衰減。
    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.linearRampToValueAtTime(bodyPeak, time + cfg.attackSeconds);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    osc1.start(time);
    osc1.stop(time + decay);

    // --- 高頻 knock 泛音：很短的 inharmonic 敲擊，強化木頭質感 ---
    const knock = this.audioCtx.createOscillator();
    knock.type = 'sine';
    knock.frequency.value = frequency * cfg.knockRatio;

    const knockGain = this.audioCtx.createGain();
    const knockPeak = Math.max(0.0001, bodyPeak * cfg.knockGain);
    knockGain.gain.setValueAtTime(knockPeak, time);
    knockGain.gain.exponentialRampToValueAtTime(
      0.0001,
      time + cfg.knockDecaySeconds
    );

    knock.connect(knockGain);
    knockGain.connect(this.audioCtx.destination);

    knock.start(time);
    knock.stop(time + cfg.knockDecaySeconds);
  }

  scheduleNote(globalBeat, time) {
    // 【導入預告期】整段訓練最初的第一個和弦，在進入 prep 前先走 4 拍 predict。
    // 這裡只播放節拍器高音 Click，並讓第一個和弦在中央閃爍；和弦本身不在此播放。
    if (this.introBeatsRemaining > 0) {
      const introLocalBeat = 4 - this.introBeatsRemaining; // 0..3

      // 導入預告期維持高音 Click。
      this.scheduleMetronomeClick(time, 587.33, 0.11, 0.06);

      // 導入預告期：僅同步觸發 Vue 渲染。
      if (this.onBeatTrigger) {
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

    let trainLen;
    if (this.isCustomMode) {
      trainLen = this.customTokens.length;
    } else if (this.triadMode) {
      // 三和弦模式：train 逐拍爬升三和弦的 3 個構成音。
      const notes = this.getLiveTriadVoicings(this.currentCagedCycle)[this.currentChordIdx]?.notes;
      trainLen = notes && notes.length ? notes.length : 3;
    } else {
      trainLen = this.cagedSequence.length;
    }
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
      // 【準備期】播放標準節拍器 Click。
      // 注意：training phase 不會播放這個 Click。
      this.scheduleMetronomeClick(time, localBeat4 === 0 ? 880 : 440, 0.15, 0.1);

      // 第一拍時播放吉他和弦刷弦伴奏：使用資料定義式 CAGED voicing。
      if (localBeat4 === 0 && this.keyRoot !== undefined) {
        const chordStr = this.progression[this.currentChordIdx];
        const chordConfig = CHORD_MODES[chordStr];

        if (chordConfig) {
          // 三和弦模式：直接使用外部算好的三弦組三和弦 voicing（不套用 CAGED）。
          // 其他模式：優先在音訊排程當下依目前和弦與 CAGED cycle 即時計算 voicing，
          //          以避免進行回到第 1 個和弦時，prep 第一拍仍播放上一輪把位的問題。
          let sourceVoicingNotes;
          if (this.triadMode) {
            // 依當前 cycle / chordIdx 即時取三和弦（隨和弦切換而變、每輪往高把位推進）。
            const voicings = this.getLiveTriadVoicings(this.currentCagedCycle);
            sourceVoicingNotes = voicings[this.currentChordIdx]?.notes || [];
          } else {
            const liveForm = getDynamicCagedForm(chordStr, this.keyRoot, this.currentCagedCycle);
            const liveVoicingNotes = resolveCagedChordVoicing(this.keyRoot, chordStr, liveForm);
            sourceVoicingNotes = liveVoicingNotes.length > 0
              ? liveVoicingNotes
              : this.prepChordVoicingNotes;
          }

          if (sourceVoicingNotes && sourceVoicingNotes.length > 0) {
            // 模擬真實吉他刷弦：從粗弦刷到細弦。
            const strumNotes = [...sourceVoicingNotes].sort((a, b) => b.stringIndex - a.stringIndex);
            
            strumNotes.forEach((noteObj, idx) => {
              const baseOffsets = [24, 19, 15, 10, 5, 0];
              const freq = 110 * Math.pow(2, (noteObj.fret + baseOffsets[noteObj.stringIndex]) / 12);
              this.createPluckedSound(freq, time + idx * 0.025);
            });
          } else {
            // 防呆 fallback。
            const pitches = getChordPitches(this.keyRoot, chordStr);
            pitches.forEach((freq, idx) => {
              this.createPluckedSound(freq, time + idx * 0.02);
            });
          }
        }
      }
    } else if (phase === 'train') {
      // 【訓練期】只播放音階音。
      // 這裡故意不呼叫 scheduleMetronomeClick()，所以音階播放時不會疊加節拍器。
      const trainIndex = this.currentChordBeat - 4;
      
      // 依模式決定本拍要爬升的音：自訂 token / 三和弦（低音→高音）/ CAGED 爬音序列。
      let noteObj = null;
      if (this.isCustomMode) {
        if (this.customTokens.length > 0) {
          const token = this.customTokens[trainIndex % this.customTokens.length];
          const chordStr = this.progression[this.currentChordIdx];

          // 正確順序是 keyRoot, chordDegreeStr, token。
          const absNote = getAbsoluteNoteFromToken(this.keyRoot, chordStr, token);

          const freq = 130.81 * Math.pow(2, (absNote - 0) / 12);
          this.createPluckedSound(freq, time);
          activeNoteTarget = { type: 'custom', token, trainIndex };
        }
      } else if (this.triadMode) {
        // 即時取當前三和弦，依音高由低到高排序後逐拍爬升。
        const triadNotes = [...(this.getLiveTriadVoicings(this.currentCagedCycle)[this.currentChordIdx]?.notes || [])]
          .sort((a, b) => a.pitchScore - b.pitchScore);
        if (trainIndex < triadNotes.length) {
          noteObj = triadNotes[trainIndex];
        }
      } else {
        if (trainIndex < this.cagedSequence.length) {
          noteObj = this.cagedSequence[trainIndex];
        }
      }

      if (noteObj) {
        // 以 5 弦空弦 A2=110Hz 為基準推算各弦音高。
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
    } else if (phase === 'predict') {
      // 【預告期】播放高音 Click 輔助下一個和弦預告。
      // 注意：training phase 不會播放這個 Click。
      this.scheduleMetronomeClick(time, 587.33, 0.11, 0.06);
    }

    // 觸發 Vue 渲染。
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

    // 推進本和弦內的拍數。
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