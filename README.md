# 🎸 My Guitar Fretboard Trainer

一款專為吉他手設計的高精度互動式指板肌肉記憶與樂理訓練工具。透過視覺化的音樂音程（Intervals）與 CAGED 系統，幫助你在幾秒鐘內直覺反射指板音符，徹底擺脫死記硬背。

[Live Demo 路線 🚀](https://kai860306.github.io/my-guitar-trainer/)

---

## ✨ 核心特色 (Core Features)

本系統專為吉他演奏者在進行**有氧運動（如跑步機、走坡度機）**時設計，擺脫傳統死記硬背，透過高強度的「視覺 ✕ 聽覺 ✕ 幾何直覺」全面建立指板肌肉記憶。

### 🏃‍♂️ 專為有氧特訓打造的極簡視覺 (Cardio-Optimized UI)
* **抗震動盲點設計：** 採用 AMOLED 純黑底色搭配超高飽和度的霓虹發光燈號。即使在身體劇烈晃動時，僅憑餘光也能精準捕捉訊號。
* **上機免手動負擔：** 配備超大 80px「安全防滑操作區」與大顆 `+`/`-` 按鈕，防止運動中手震誤觸；目前未使用 Screen Wake Lock API，螢幕防休眠需依使用者裝置、PWA 或瀏覽器設定處理。
* **全螢幕與自適應縮放：** 一鍵切換瀏覽器全螢幕（不支援 Fullscreen API 的行動瀏覽器則透過 `apple-mobile-web-app-capable` 等 meta 標籤提供「加入主畫面」後備方案），並依瀏覽器尺寸自動縮放指板與元件，確保所有內容不被遮擋。
* **跨裝置拖曳：** 和弦進行組裝器以 Pointer Events 統一實作，桌機滑鼠與手機觸控皆可流暢拖曳字卡。

### 🎸 幾何直覺指板核心 (Geometric Intuition Fretboard)
* **拋棄音名文字困境：** 全時指板**不顯示 CDEFGAB 等文字**。僅母調根音以「灰色正方形」常駐顯示作為定位基準，其餘調內音與和弦根音平時隱形、只在播放到時才點亮，純靠幾何圖形建立直覺反射。
* **音階把位虛線導航：** 當前和弦所需的音階琴格區間，以**虛線 + 半透明長方形**框出，讓你一眼鎖定該在哪個格區間找音；進入預告期時更會**提前切換到下一個和弦的把位**，讓手先定位。
* **真實物理視覺：** 具備高擬真的「1 弦至 6 弦漸變弦粗細」與第 12 格雙點（Double Inlays）標示，視覺體驗更貼近實體吉他。
* **音程顯示基準切換：** 訓練頁提供「從 Chord」／「從 Key」即時切換，決定指板音程數字要相對於目前和弦根音、還是主調 Key 根音顯示，設定會保存於瀏覽器。

### 🔄 動態 CAGED 把位自動循環 (Dynamic CAGED Auto-Cycling)
* **全指板橫移推進：** 系統會為進行中的和弦動態尋找最佳 CAGED 型態。每當一輪進行結束，指型將會自動沿著 `C ➔ A ➔ G ➔ E ➔ D` 的順序往高把位橫移推進，強迫大腦解鎖全指板盲區。
### 🃏 可擴充的和弦庫 (Extensible Chord Library)
* **七大類和弦字卡：** 自由自訂進行時，和弦庫依性質分為「順階三和弦」（`I~vii°`）、「順階七和弦」（`IM7, iim7, V7, viim7b5` 等）、「同主調三和弦」（`i, ii°, bIII, iv, v, bVI, bVII`）、「同主調七和弦」、「副屬七和弦」（Secondary Dominant）、「關聯 II」（Related II）與「裏和弦」（SubV7 / Tritone Substitute），可自由搭配。
* **統一資料模型：** 每張字卡以 `offset / mode / family / label / modeName` 統一描述，新增和弦僅需於 `CHORD_MODES` 增加一筆，指板、音訊與爬音三大引擎即自動支援。
### 🎵 律動時序三部曲與階梯解鎖 (3-Phase Rhythm & Progression)
* **4/4 拍動態時序演算法：**
  * **導入預告期 (Intro Predict)：** 整段訓練最開始，先走 4 拍純導入提示（高音 Click 節拍器 + 第一個和弦置中閃爍），不刷扣、不顯示下一個和弦，作為起跑導引。
  * **準備期 (Prep)：** 觸發真實木吉他物理合成刷扣音，指板僅常駐顯示 Key 的灰色正方形定位點，強迫大腦用意念導航。
  * **訓練期 (Train)：** 逐拍播放單音。發音點以色彩美學閃爍並印上音程數字（如 $1, 3, 5, \flat3$）。
  * **預告期 (Predict)：** 單音停止，改為每拍播放高音 Click。當前和弦右側出現「→ 下一個和弦」，以**與 BPM 同步的黑/紅高頻閃爍**預告，指板把位亦提前切到下一個和弦。
* **訓練頁進行高亮：** 訓練頁面完整顯示所選的和弦進行（如 `I › IV › V`），並即時高亮目前所在的和弦；當前和弦字體隨節拍呼吸變化。
* **雙模式階梯解鎖：** 提供兩種可切換的音程特訓模式演算法——「和弦基礎」（Stage 1-5：Triad → 7th → 9th → 11th → 13th）與「音階基礎」（Stage 1-3：Triad → Pentatonic → Mode Scale），亦可透過自訂音序器輸入相對音程指令（如 `L5, 1, 2`）。

### 🧠 高階順階調式自動映射 (Diatonic Mode Mapping)
* **後台自動避坑演算法：** 內建核心樂理引擎。當使用者輸入通用相對旋律線時，系統會根據當前和弦級數自動對齊專屬 Mode 暫存器（如 I 級對齊 Ionian、ii 級對齊 Dorian、vi 級對齊 Aeolian），確保和弦變換時自動轉換升降音且百分之百不跑調。

---

## 🛠️ 技術棧 (Tech Stack)

* **框架 (Framework):** Vue 3 (Script Setup)
* **構建工具 (Build Tool):** Vite
* **樣式 (Styling):** Tailwind CSS v4（`@tailwindcss/vite` 外掛，具備磨砂玻璃 Backdrop Blur 質感與霓虹發光特效）
* **樂理核心 (Core Logic):** 自研 `musicTheory.js` + `cagedScales.js`，涵蓋絕對音高轉換、CAGED 把位推算與 35 組音階 / 和弦 voicing 資料
* **音訊引擎 (Audio Engine):** 原生 Web Audio API 硬體級時鐘排程（`audioEngine.js`），刷扣合成 + 單音爬音 + 高音 Click 節拍提示；目前僅在停止播放時呼叫 Web Speech API 的 `speechSynthesis.cancel()` 作為保險，尚未排程實際語音播報

---

## 💻 跨平台環境構建 (Development Setup)

不論你是在 **Windows**、**macOS** 還是 **Linux** 上繼續開發，請遵循以下步驟建置完全一致的運行環境。

### 1. 前置需求 (Prerequisites)

本專案需要運行於 **Node.js** 環境下。
* **Node.js 版本：** 建議使用 `v20.x` 或最新 LTS 版本 `v24.x`。
* **包管理工具：** `npm` (Node 自帶) 或 `pnpm`。

> 💡 **跨平台版本管理建議：** > 強烈建議安裝 [fnm](https://github.com/Schniz/fnm) (快速且跨平台) 或 [nvm](https://github.com/nvm-sh/nvm) 來管理 Node 版本，避免不同機器間的環境衝突。

| 作業系統 | 推薦終端機 (Terminal) | 快速安裝 Node 命令 |
| :--- | :--- | :--- |
| **macOS** | Zsh / Itorrm2 | `brew install fnm && fnm install 20` |
| **Windows** | PowerShell / Git Bash | `winget install Schniz.fnm` 之後 `fnm install 20` |
| **Linux** | Bash / Zsh | `curl -fsSL https://fnm.vercel.app/install | bash` |

### 2. 本地複製與安裝 (Installation)

打開你的終端機，依序執行以下指令：

```bash
# 複製遠端倉庫到本地
git clone [https://github.com/kai860306/my-guitar-trainer.git](https://github.com/kai860306/my-guitar-trainer.git)

# 進入專案資料夾
cd my-guitar-trainer

# 安裝所有相依套件
npm install

```

### 3. 開發階段指令 (Scripts)

在專案根目錄下，你可以執行以下常規指令：

```bash
# 啟動本地開發伺服器 (隨改隨看，支援熱更新 HMR)
npm run dev

# 進行代碼打包壓制 (產出優化後的 dist 靜態檔案)
npm run build

# 在本地預覽打包後的實際網頁效果
npm run preview

```

啟動 `npm run dev` 後，終端機會提供一個本地網址（通常是 `http://localhost:5173/`），點擊即可在瀏覽器開始除錯。

---

## 📂 專案結構簡介 (Project Structure)

```text
my-guitar-trainer/
├── .github/workflows/      # GitHub Actions 自動化部署腳本
├── public/                 # 靜態資源 (favicon 等)
├── src/
│   ├── components/
│   │   └── Fretboard.vue   # 核心組件：二維指板矩陣、音程色彩渲染、把位虛線框與自適應縮放
│   ├── utils/
│   │   ├── musicTheory.js  # 樂理核心：CHORD_MODES 資料模型、CAGED 把位推算、和弦 voicing、調式映射
│   │   ├── cagedScales.js  # CAGED 音階資料與爬音序列產生器 (35 個 form、chord/scale 雙模式 Stage 取音)
│   │   └── audioEngine.js  # Web Audio 硬體時鐘排程：刷扣合成、單音爬音、節拍 Click 與時序三部曲
│   ├── App.vue             # 應用主入口：全域狀態、拖曳組裝器與音訊引擎橋接
│   ├── style.css           # 全域樣式
│   └── main.js             # Vue 初始化
├── index.html              # 網頁入口
├── spec.md                 # 產品需求規格書 (PRD)
├── vite.config.js          # Vite 設定檔 (已封裝基底路徑修正)
└── package.json            # 專案套件依賴說明

```

---

## 🚀 自動化部署 (CI/CD)

本專案已整合 **GitHub Actions**。當你將新的代碼推送到 `main` 分支時，雲端伺服器會自動執行建構並發布至 GitHub Pages。

### 生態系注意事項：

若修改了專案的路由或資源路徑，請確保 `vite.config.js` 中的 `base` 設定保持不變：

```javascript
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: './', // 相對路徑，確保 GitHub Pages 子路徑解析正確
})

```

---

## 📄 開源授權 (License)

本專案採用 [MIT License](LICENSE) 條款開源。歡迎自由 Fork、修改與提交 Pull Request！