#!/usr/bin/env sh
set -eu

# Railway 會在執行階段注入 PORT；本機直接跑這支腳本時則退回 8000。
: "${PORT:=8000}"

# Boss 血量已由前端單局狀態計算；單一 worker 只用來簡化部署與本機檔案 fallback 寫入。
exec gunicorn app:app --bind "0.0.0.0:${PORT}" --workers 1
