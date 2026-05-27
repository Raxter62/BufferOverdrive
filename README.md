# BufferOverdrive

114-2 web_final_project

## 技術與部署

- 全端網站維持 Python Flask + JavaScript。
- 前端仍使用隨機性、日期時間、HTML5 Canvas、PlotlyJS。
- 大型語言模型維持後端 Flask 呼叫 Gemini / LangChain，不把 API key 放到前端。
- Railway 使用 `sh start.sh` 啟動，實際會由 gunicorn 執行 `app.py` 裡的 Flask app。

## Railway 環境變數

請在 Railway Service 的 Variables 設定下列值：

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxxxx
GOOGLE_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3-flash-preview
```

如果 Supabase 專案仍使用 legacy key，也可以用 `SUPABASE_SERVICE_ROLE_KEY` 取代 `SUPABASE_SECRET_KEY`。

## Supabase 設定

1. 在 Supabase 建立 project。
2. 到 SQL Editor 執行 `supabase_schema.sql`。
3. 將 `SUPABASE_URL` 與 secret/service key 填到 Railway Variables。
4. 部署後，`/api/leaderboard` 與 `/api/log_event` 會自動寫入 Supabase。

本機沒有設定 Supabase 環境變數時，會自動退回使用 `leaderboard.json` 與 `game_logs.jsonl`，方便開發測試。
