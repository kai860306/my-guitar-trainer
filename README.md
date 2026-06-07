# 🎸 My Guitar Fretboard Trainer

一款專為吉他手設計的高精度互動式指板肌肉記憶與樂理訓練工具。透過視覺化的音樂音程（Intervals）與 CAGED 系統，幫助你在幾秒鐘內直覺反射指板音符，徹底擺脫死記硬背。

[Live Demo 路線 🚀](https://kai860306.github.io/my-guitar-trainer/)

---

## ✨ 核心特色 (Core Features)

本系統專為吉他演奏者在進行**有氧運動（如跑步機、走坡度機）**時設計，擺脫傳統死記硬背，透過高強度的「視覺 ✕ 聽覺 ✕ 幾何直覺」全面建立指板肌肉記憶。

### 🏃‍♂️ 專為有氧特訓打造的極簡視覺 (Cardio-Optimized UI)
* **抗震動盲點設計：** 採用 AMOLED 純黑底色搭配超高飽和度的霓虹發光燈號。即使在身體劇烈晃動時，僅憑餘光也能精準捕捉訊號。
* **上機免手動負擔：** 網頁自動啟用硬體防休眠，並配備超大 80px「安全防滑操作區」與大顆 `+`/`-` 按鈕，防止運動中手震誤觸。

### 🎸 幾何直覺指板核心 (Geometric Intuition Fretboard)
* **拋棄音名文字困境：** 全時指板**不顯示 CDEFGAB 等文字**。母調根音恆為「灰色正方形」，其餘調內音恆為「灰色圓形」，純靠幾何圖形建立直覺反射。
* **真實物理視覺：** 具備高擬真的「1 弦至 6 弦漸變弦粗細」與第 12 格雙點（Double Inlays）標示，視覺體驗更貼近實體吉他。

### 🔄 動態 CAGED 把位自動循環 (Dynamic CAGED Auto-Cycling)
* **全指板橫移推進：** 系統會為進行中的和弦動態尋找最佳 CAGED 型態。每當一輪進行結束，指型將會自動沿著 `C ➔ A ➔ G ➔ E ➔ D` 的順序往高把位橫移推進，強迫大腦解鎖全指板盲區。

### 🎵 律動時序三部曲與階梯解鎖 (3-Phase Rhythm & Progression)
* **4/4 拍動態時序演算法：**
  * **準備期 (Prep)：** 觸發真實木吉他物理合成刷扣音，指板僅亮起當前和弦根音，強迫大腦用意念導航。
  * **訓練期 (Train)：** 逐拍播放單音。發音點以色彩美學閃爍並印上音程數字（如 $1, 3, 5, \flat3$）。
  * **預告期 (Predict)：** 單音停止，切換為有氧英語人聲播報（"One, Two, Three, Four"）與黑紅高頻閃爍預告。
* **五階段音階解鎖 (Stage 1-5)：** 支援從「Stage 1 三和弦」一路解鎖至「Stage 3 五聲音階」與「Stage 5 自然音階調式」，亦可透過自訂音序器輸入相對音程指令（如 `L5, 1, 2`）。

### 🧠 高階順階調式自動映射 (Diatonic Mode Mapping)
* **後台自動避坑演算法：** 內建核心樂理引擎。當使用者輸入通用相對旋律線時，系統會根據當前和弦級數自動對齊專屬 Mode 暫存器（如 I 級對齊 Ionian、ii 級對齊 Dorian、vi 級對齊 Aeolian），確保和弦變換時自動轉換升降音且百分之百不跑調。

---

## 🛠️ 技術棧 (Tech Stack)

* **框架 (Framework):** Vue 3 (Script Setup)
* **構建工具 (Build Tool):** Vite
* **樣式 (Styling):** Tailwind CSS (具備磨砂玻璃 Backdrop Blur 質感與霓虹發光特效)
* **樂理核心 (Core Logic):** 自研高精度 `musicTheory.js` 絕對音高轉換矩陣

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
├── .github/workflows/   # GitHub Actions 自動化部署腳本
├── src/
│   ├── components/
│   │   └── Fretboard.vue # 核心組件：二維指板矩陣、音程色彩渲染
│   ├── utils/
│   │   └── musicTheory.js# 樂理邏輯：絕對音高、音程與和弦 offset 計算
│   ├── App.vue          # 應用主入口：全域狀態與音訊引擎橋接
│   └── main.js          # Vue 初始化
├── index.html           # 網頁入口
├── vite.config.js       # Vite 設定檔 (已封裝基底路徑修正)
└── package.json         # 專案套件依賴說明

```

---

## 🚀 自動化部署 (CI/CD)

本專案已整合 **GitHub Actions**。當你將新的代碼推送到 `main` 分支時，雲端伺服器會自動執行建構並發布至 GitHub Pages。

### 生態系注意事項：

若修改了專案的路由或資源路徑，請確保 `vite.config.js` 中的 `base` 設定保持不變：

```javascript
export default defineConfig({
  plugins: [vue()],
  base: '/my-guitar-trainer/', // 確保 GitHub Pages 子路徑解析正確
})

```

---

## 📄 開源授權 (License)

本專案採用 [MIT License](LICENSE) 條款開源。歡迎自由 Fork、修改與提交 Pull Request！