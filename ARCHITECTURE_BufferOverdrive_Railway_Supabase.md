# BUFFER OVERDRIVE — ARCHITECTURE.md

> 給 Codex / 開發者閱讀的專案架構文件。  
> 本文件根據目前 GitHub repo `Raxter62/BufferOverdrive` 的實際程式碼狀態整理。  
> 目標：讓 Codex 在新的 chat 中可以理解目前專案狀態、不要重寫已完成的遊戲本體，並按照正確方向把本機版升級成 Railway + Supabase + Resend + LLM + PDF 的正式全端專案。

---

## 0. 重要原則

本專案目前**不需要完全大改**。

目前遊戲核心已經完成很多：

- Flask `app.py` 已存在。
- `templates/index.html` 已能載入遊戲頁面。
- 前端 Canvas 遊戲已經能在本機運作。
- JavaScript 已有主迴圈、輸入控制、角色動畫、資料掉落、Buffer、Flush、Boss、地圖、排行榜等功能。
- 後端目前已有部分 API：地圖、掉落資料、Flush 掉落、Boss 狀態、排行榜、紀錄。
- 目前排行榜與遊戲紀錄是用本機 JSON / JSONL 檔案保存，這是之後要替換成 Supabase 的重點。

Codex 修改時請遵守：

```text
不要推倒重寫整個專案。
不要重寫 Canvas 遊戲本體。
不要把每個按鍵或每一幀都送到後端。
不要把 API key 寫進程式碼或 GitHub。
優先把本機檔案儲存改成 Supabase。
再加入 Game Over 儲存結果、PDF、Email、LLM。
```

---

## 1. 專案目前定位

遊戲名稱目前使用：

```text
BUFFER OVERDRIVE
```

舊企劃名稱：

```text
DATA TOWER RUSH
```

這是一款復古街機風格的 Canvas 網頁遊戲。玩家在資料塔中接住不斷落下的資料，必須在短時間內判斷要「吸收」或「丟棄」。吸收可以得分，但會增加 Buffer。Buffer 滿代表資料過載，Game Over。

核心賣點：

```text
玩家不是在打怪，而是在跟資料過載對抗。
```

---

## 2. 目前 repo 架構概況

目前主要檔案：

```text
app.py
requirements.txt
templates/
  index.html
static/
  css/
    style.css
  js/
    main.js
    player.js
    gameplay.js
    boss.js
    map.js
    render.js
  player_image/
    ...
README.md
```

目前 `requirements.txt` 只有：

```text
Flask==3.0.3
```

之後部署 Railway 與加入 Supabase / Resend / LLM / PDF 後，需要補套件。

---

## 3. 現有前端架構

`templates/index.html` 已載入：

```html
<script src="{{ url_for('static', filename='js/main.js') }}"></script>
<script src="{{ url_for('static', filename='js/player.js') }}"></script>
<script src="{{ url_for('static', filename='js/gameplay.js') }}"></script>
<script src="{{ url_for('static', filename='js/boss.js') }}"></script>
<script src="{{ url_for('static', filename='js/map.js') }}"></script>
<script src="{{ url_for('static', filename='js/render.js') }}"></script>
```

目前頁面包含：

- `canvas#gameCanvas`，大小為 `640 × 480`
- 右側 HUD 面板
- 排行榜區
- Score / Best Score
- 處理、吸收、丟棄統計
- 待處理資料資訊
- 決策倒數條
- Game Over 面板
- 街機外框 overlay
- 按鈕與搖桿 sprite overlay

目前 Canvas 主畫面尺寸：

```text
GAME_WIDTH = 640
GAME_HEIGHT = 480
```

---

## 4. 前端應繼續保留的原則

遊戲即時部分必須留在前端瀏覽器執行：

```text
角色移動
跳躍
Dash
資料掉落
碰撞判定
A 吸收
B 丟棄
長按 B Flush
Buffer 增減
Boss 行為
Endless 難度提升
Canvas 繪圖
按鈕圖片切換
搖桿圖片切換
即時 HUD 顯示
```

原因：

玩家打開 Railway 網站時，HTML/CSS/JS 會下載到玩家瀏覽器。  
JavaScript 會在玩家自己的電腦或手機上執行。  
所以遊戲中的每一幀、每個按鍵、每次動畫切換，不需要回傳 Railway。

後端只應該負責：

```text
提供初始設定或掉落佇列
儲存 Game Over 結果
儲存玩家紀錄
回傳排行榜
整理統計資料
產生 AI 戰後分析
產生 PDF
寄 Email
```

---

## 5. 目前已存在的前端核心

### 5.1 main.js

目前 `main.js` 負責：

```text
共用常數
遊戲狀態
圖片素材路徑
Sprite 切圖設定
鍵盤輸入狀態
排行榜 API
素材載入
遊戲初始化
場景切換
requestAnimationFrame 主迴圈
街機外框按鈕 / 搖桿同步
```

已存在的重要常數：

```js
const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;
const DECISION_TIME_MS = 1500;
const FLUSH_HOLD_MS = 650;
const FLUSH_PAUSE_MS = 1100;
const FLUSH_BUFFER_REDUCE = 25;
const DASH_COOLDOWN_MS = 3000;
const FLUSH_COOLDOWN_MS = 6000;
const RISK_DECAY_MS = 10000;
const RISK_BAD_DATA_BONUS_PER_STACK = 0.25;
const RISK_DROP_SPEED_BONUS_PER_STACK = 0.10;
const BOSS_TRIGGER_SCORE = 5000;
```

### 5.2 gameplay.js

目前 `gameplay.js` 負責：

```text
遊戲規則判定
資料接取
吸收
丟棄
Flush
Endless
Game Over
掉落物生成
風險值
玩家 / 掉落物 / 平台互動
```

已存在的重要功能：

```text
getRiskBadDataMultiplier()
getRiskDropSpeedMultiplier()
getEndlessSpawnFactor()
chooseDataType()
spawnDrop()
spawnFlushWave()
catchDrop()
absorbPending()
discardPending()
triggerFlush()
enterEndless()
endGame()
recordEvent()
updateDecision()
updateInput()
updateDrops()
updateFlushPause()
```

### 5.3 目前 Game Over 行為

目前 `endGame()` 會：

```text
停止遊戲
觸發玩家死亡動畫
把分數排入排行榜暫存
POST /api/log_event
顯示 Game Over 面板
```

目前送到 `/api/log_event` 的資料包含：

```js
{
  score: game.score,
  handled: game.handled,
  absorbed: game.absorbed,
  discarded: game.discarded,
  autoAbsorbed: game.autoAbsorbed,
  flushes: game.flushes,
  history: game.history,
  typeStats: game.typeStats
}
```

這一段未來應升級成正式：

```text
POST /api/game/finish
```

並改成寫入 Supabase、產生 PDF、寄 Email、回傳 session id。

---

## 6. 目前已存在的後端 API

目前 `app.py` 已有：

```text
GET  /
GET  /api/get_next_map
GET  /api/get_drops_queue
GET  /api/get_flush_drops
GET  /api/boss/status
POST /api/boss/damage
GET  /api/boss/burst_drops
POST /api/boss/spawn
GET  /api/leaderboard
POST /api/leaderboard
POST /api/log_event
```

目前 `/api/leaderboard` 使用本機檔案：

```python
LEADERBOARD_FILE = "leaderboard.json"
```

目前 `/api/log_event` 使用本機檔案：

```python
GAME_LOGS_FILE = "game_logs.jsonl"
```

這兩個是上 Railway 前要優先改掉的地方。

---

## 7. 不建議保留的本機儲存方式

目前本機檔案：

```text
leaderboard.json
game_logs.jsonl
```

本機開發可以，但正式 Railway 不建議：

```text
Railway 服務重啟或重新部署後，檔案不可靠。
多人同時寫 JSON 檔可能衝突。
排行榜排序與歷史查詢應該交給資料庫。
PDF / LLM / Email 需要可追蹤的 session_id。
```

未來應改成：

```text
Supabase PostgreSQL
```

---

## 8. 目標雲端架構

目標架構：

```text
Browser / PWA
    ↓
HTML + CSS + JavaScript + Canvas
    ↓ fetch / AJAX
Flask on Railway
    ↓
Supabase PostgreSQL
    ↓
Pandas / Plotly / LLM / PDF / Resend
```

角色分工：

```text
Railway：部署 Flask 後端與靜態前端
Flask：API、分析、PDF、Email、LLM 串接
Supabase：保存排行榜、遊戲紀錄、玩家 email、戰後分析
Resend：寄出 PDF 戰後報告
LLM：產生戰後分析文字
```

---

## 9. Railway 部署方向

目前不一定需要 Dockerfile。

這是 Flask/Python 專案，Railway 通常可以透過 `requirements.txt` 自動安裝環境。  
目前先不要引入 Dockerfile，除非之後 PDF / 字型 / WeasyPrint / Plotly 匯圖出現系統套件問題。

短期需要做：

### 9.1 requirements.txt

目前只有：

```text
Flask==3.0.3
```

至少要改成：

```text
Flask==3.0.3
gunicorn
python-dotenv
```

之後加入：

```text
supabase
resend
openai
pandas
plotly
kaleido
reportlab
```

若不用 Supabase client、改 PostgreSQL 直連，可用：

```text
psycopg[binary]
```

### 9.2 Railway Start Command

建議：

```bash
gunicorn app:app
```

因為檔名是 `app.py`，Flask instance 也叫 `app`。

### 9.3 app.py 本機啟動段

可改成：

```python
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
```

正式 Railway 用 `gunicorn app:app` 時不一定跑到此段，但本機測試仍有用。

---

## 10. 環境變數

不要把任何 API key 寫進 GitHub。

Railway Variables 建議放：

```text
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
OPENAI_API_KEY=
MAIL_FROM=
BASE_URL=
SECRET_KEY=
```

建立 `.env.example`，只放空值範例：

```env
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
OPENAI_API_KEY=
MAIL_FROM=
BASE_URL=
SECRET_KEY=
```

`.env` 必須加入 `.gitignore`。

---

## 11. Supabase 資料保存設計

目前不需要把每個事件拆成大量表。  
建議先採用「一場一筆 session + JSONB 詳細紀錄」模式。

### 11.1 game_sessions

```sql
create table game_sessions (
  id uuid primary key default gen_random_uuid(),
  player_email text,
  player_name text,
  score int not null default 0,
  handled int not null default 0,
  absorbed int not null default 0,
  discarded int not null default 0,
  auto_absorbed int not null default 0,
  flushes int not null default 0,
  boss_defeated boolean default false,
  final_phase text,
  max_buffer numeric,
  avg_buffer numeric,
  survival_ms int,
  created_at timestamptz default now()
);
```

### 11.2 game_session_details

```sql
create table game_session_details (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references game_sessions(id) on delete cascade,
  history jsonb,
  type_stats jsonb,
  buffer_history jsonb,
  score_history jsonb,
  raw_payload jsonb,
  created_at timestamptz default now()
);
```

### 11.3 ai_comments

```sql
create table ai_comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references game_sessions(id) on delete cascade,
  comment text,
  created_at timestamptz default now()
);
```

可選：

### 11.4 email_reports

```sql
create table email_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references game_sessions(id) on delete cascade,
  recipient_email text,
  status text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz default now()
);
```

---

## 12. 前端要新增或調整的遊戲紀錄

目前 `recordEvent()` 會把事件 push 進 `game.history`，但有長度限制：

```js
if (game.history.length > 120) {
    game.history.shift();
}
```

如果只做「死亡前 10 秒操作紀錄」，可以保留。  
但若要完整 LLM 分析、PDF 報告、整局圖表，建議新增：

```js
game.fullHistory = [];
game.bufferHistory = [];
game.scoreHistory = [];
```

建議：

```text
game.history：保留最近 120 筆，給畫面或死亡前 10 秒使用
game.fullHistory：保留整局所有重大事件，Game Over 後送後端
game.bufferHistory：定時記錄 Buffer
game.scoreHistory：定時記錄 Score
```

不要每一幀都記。  
可以每 300ms～1000ms 記一次 Buffer / Score，事件則只記重要行為：

```text
catch
absorb
discard
auto-timeout
auto-next
flush
fall-respawn
boss-start
boss-damage
boss-defeated
enter-endless
game-over
```

---

## 13. API 目標改造

### 13.1 保留既有 API

短期可保留：

```text
GET /api/get_next_map
GET /api/get_drops_queue
GET /api/get_flush_drops
GET /api/boss/status
POST /api/boss/damage
GET /api/boss/burst_drops
POST /api/boss/spawn
```

### 13.2 改造 leaderboard

目前：

```text
GET /api/leaderboard
POST /api/leaderboard
```

目前 POST 是前端整包覆寫排行榜。  
未來不建議由前端決定排行榜。

改成：

```text
GET /api/leaderboard
```

由後端查 Supabase：

```sql
select player_name, player_email, score, created_at
from game_sessions
order by score desc
limit 5;
```

可保留 POST 但不建議繼續使用。

### 13.3 新增正式 Game Over 儲存 API

新增：

```text
POST /api/game/finish
```

用途：

```text
接收 Game Over 的完整資料
驗證 email
存 Supabase
產生分析
產生 PDF
用 Resend 寄信
回傳 session_id
```

前端 payload 建議：

```json
{
  "email": "player@example.com",
  "playerName": "Player",
  "score": 6200,
  "handled": 55,
  "absorbed": 35,
  "discarded": 20,
  "autoAbsorbed": 4,
  "flushes": 3,
  "bossDefeated": true,
  "phase": "ENDLESS",
  "survivalMs": 168000,
  "history": [],
  "fullHistory": [],
  "bufferHistory": [],
  "scoreHistory": [],
  "typeStats": {}
}
```

回傳：

```json
{
  "status": "ok",
  "sessionId": "uuid",
  "emailSent": true,
  "message": "Result saved and report sent."
}
```

---

## 14. Email + PDF + Resend 流程

Game Over 後，結算畫面應提供：

```text
輸入 email
按「儲存結果」
```

前端：

```text
POST /api/game/finish
```

後端流程：

```text
1. 驗證 email
2. 接收 score / history / typeStats / bufferHistory
3. 寫入 Supabase
4. 用 Pandas 整理統計
5. 用 LLM 產生戰後分析
6. 產生 PDF 戰後報告
7. 用 Resend 寄出 PDF
8. 回傳結果給前端
```

Resend API key 只能存在 Railway 環境變數：

```text
RESEND_API_KEY
```

寄件人放：

```text
MAIL_FROM
```

不要在前端或 GitHub 中出現 Resend key。

---

## 15. PDF 產生方式

本專案是 Flask/Python，不要使用 TCPDF。  
TCPDF 是 PHP 套件，不適合目前架構。

建議用 Python：

```text
ReportLab
```

PDF 內容：

```text
玩家 Email
分數
生存時間
Boss 是否擊敗
最終階段
吸收 / 丟棄 / Flush 次數
最高 Buffer
平均 Buffer
資料類型貢獻
死亡前 10 秒事件
LLM 戰後分析文字
```

若要放圖表：

```text
Plotly 圖表需轉 PNG 後放進 PDF。
Plotly 匯出圖可能需要 kaleido。
```

若部署時 kaleido 或字型出問題，可先在 PDF 中使用表格與文字，前端仍用 Plotly 顯示互動圖。

---

## 16. LLM 分析設計

不要把整個 history 原封不動丟給 LLM。  
後端應該先用 Python 整理摘要，再交給 LLM。

LLM input 建議：

```json
{
  "score": 6200,
  "phase": "ENDLESS",
  "bossDefeated": true,
  "handled": 80,
  "absorbed": 50,
  "discarded": 30,
  "flushes": 4,
  "maxBuffer": 98,
  "avgBuffer": 63.2,
  "deathReason": "buffer_overflow",
  "mostDangerousType": "heavy",
  "last10Seconds": []
}
```

Prompt 方向：

```text
你是 BUFFER OVERDRIVE 的資料分析官。
根據以下統計，用繁體中文給玩家 3 段短評：
1. 表現亮點
2. 失敗原因
3. 下次建議
不要超過 180 字。
```

LLM 失敗時必須 fallback：

```text
使用本地規則分析文字，不讓整個儲存結果失敗。
```

---

## 17. Pandas / Plotly 分析

後端可用 Pandas 分析：

```text
最高 Buffer
平均 Buffer
死亡前 10 秒 Buffer 變化
吸收 / 丟棄比例
各資料類型造成的 Buffer 貢獻
Normal / Boss / Endless 三階段分數效率
Flush 使用次數與效果
```

前端 Game Over 後可顯示 Plotly：

```text
1. Buffer 隨時間變化折線圖
2. 吸收 vs 丟棄比例圖
3. 每種資料造成的 Buffer 貢獻長條圖
4. 死亡前 10 秒操作紀錄
5. Boss 前後表現比較
```

不要在遊戲進行中每一幀重畫 Plotly。  
若要右側即時小圖表，請節流：

```text
每 500ms～1000ms 更新一次
```

---

## 18. 建議逐步改造順序

### 第一階段：部署準備

```text
requirements.txt 加 gunicorn、python-dotenv
app.py 支援 PORT
建立 .env.example
建立 .gitignore，排除 .env、__pycache__、leaderboard.json、game_logs.jsonl
Railway start command：gunicorn app:app
```

### 第二階段：Supabase

```text
建立 game_sessions / game_session_details / ai_comments / email_reports
新增 Supabase service
把 /api/log_event 升級成 /api/game/finish
把 /api/leaderboard 改成查 Supabase
```

### 第三階段：前端結算畫面

```text
Game Over 顯示 email 輸入框
新增「儲存結果」按鈕
按下後 POST /api/game/finish
顯示儲存 / 寄送狀態
```

### 第四階段：分析

```text
後端 Pandas 整理統計
前端 Plotly 顯示圖表
```

### 第五階段：LLM

```text
新增 llm_service.py
Game Over 後產生 AI 分析
失敗時 fallback
```

### 第六階段：PDF + Resend

```text
新增 pdf_service.py
新增 email_service.py
產生 PDF
Resend 寄信
```

### 第七階段：PWA / 手機版

```text
手機版不是遙控器，而是完整遊戲
觸控搖桿 + A/B/C/D
manifest.json
service-worker.js
```

---

## 19. 建議拆分後端模組

目前 `app.py` 已經偏大。  
不需要立刻重構，但加入 Supabase / LLM / PDF / Email 時，建議拆：

```text
app.py
services/
  supabase_service.py
  analysis_service.py
  llm_service.py
  pdf_service.py
  email_service.py
routes/
  game_routes.py
  leaderboard_routes.py
  report_routes.py
```

短期可先只建立 `services/`，routes 仍放 `app.py`。

---

## 20. Codex 工作規則

Codex 後續修改時請遵守：

```text
1. 先讀 ARCHITECTURE.md。
2. 不要重寫 Canvas 遊戲主流程。
3. 不要刪除既有可運作功能。
4. 不要把每次按鍵都改成後端 API。
5. 不要把 secrets 寫進程式碼。
6. 優先處理 Supabase /api/game/finish。
7. 修改 API 時同步更新文件。
8. 修改後說明改了哪些檔案與函式。
9. 若新增套件，更新 requirements.txt。
10. 若新增環境變數，更新 .env.example。
```

---

## 21. 最終目標架構摘要

最終專案應該是：

```text
前端：
  Canvas 遊戲
  街機外框
  鍵盤 / 觸控輸入
  即時 HUD
  Game Over email 儲存結果
  Plotly 結算圖表

後端 Flask：
  遊戲設定 API
  掉落資料 API
  Supabase 儲存
  排行榜
  Pandas 統計
  LLM 戰後分析
  PDF 產生
  Resend 寄信

資料庫 Supabase：
  game_sessions
  game_session_details
  ai_comments
  email_reports

部署：
  Railway 跑 Flask
  環境變數存 Supabase / Resend / OpenAI key
```

一句話：

```text
保留現在可玩的本機 Canvas 遊戲，把本機 JSON 儲存升級成 Supabase，並在 Game Over 後加入「輸入 email → 儲存結果 → 分析 → PDF → Resend 寄信」的完整全端流程。
```
