---
trigger: model_decision
description: Defines rules for updating spec.md and README.md. Mandates updates for new features, UI, or data model changes to ensure documentation aligns with implementation. Explicitly excludes bug fixes and internal refactoring unless requested.
---

## 建立或修改程式碼時的規格書更新規則

當建立新程式碼或修改現有程式碼時，應根據實作內容建立或更新 `spec.md` 與 `README.md`。

但是，**若僅為修正 Bug，則不建立也不更新 `spec.md` 與 `README.md`**。

### 需要建立或更新 spec.md 的對象

遇到以下情況時，請務必在實作完成後建立或更新 `spec.md` 與 `README.md`：

- 新增功能時
- 修改現有功能的規格或行為時
- 進行了使用者可感知的變更時，例如 UI、畫面跳轉、按鈕、選單、顯示文字、輸入欄位等
- 變更資料構造、儲存格式、JSON、DB 模型、同步對象、匯入/匯出格式時
- 變更錯誤顯示、欄位驗證、權限處理、復原流程等規格時
- 現有規格書與實作內容產生差異時
- 使用者明確指示要建立或更新 `spec.md` 與 `README.md` 時

### 不需要建立或更新 spec.md 與 `README.md` 的對象

遇到以下情況時，原則上不建立也不更新 `spec.md` 與 `README.md`：

- 僅為修正 Bug 時
- 為了讓程式按照現有規格運作而進行的修正，且不涉及規格變更時
- 僅修正用詞不一致、註解、記錄輸出（Logs）或進行內部重構時
- 僅進行效能優化，且外部可見的行為或規格未發生改變時
- 僅修改測試程式碼時

不過，若使用者明確指示更新 `spec.md` 與 `README.md`，則優先遵循該指示。

### 更新 spec.md 與 `README.md` 時的撰寫規則

更新 `spec.md` 與 `README.md` 時，請遵守以下規定：

- 確保更新後的規格書內容與實作內容完全一致
- 不僅要確認變更的功能，還需檢視受影響的相關規格，並視需要進行更新
- 不得殘留過時、矛盾的規格或與實作不符的說明
- 若已知規格變更的原因，請視需要進行簡短的補充說明
- 配合現有的章節結構與文體風格進行追加或修改
- 若 `spec.md` 與 `README.md` 不存在，請重新建立
- 若 `spec.md` 與 `README.md` 已存在，請以現有內容為基礎，僅更新必要的局部內容
- 除非使用者明確指示「覆寫」，否則不得刪除無關的規格