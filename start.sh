#!/usr/bin/env sh
set -eu

# Railway 會在執行階段注入 PORT；本機直接跑這支腳本時則退回 8000。
: "${PORT:=8000}"

# 目前 Boss 血量存在 Flask 行程記憶體，先使用單一 worker 避免狀態不同步。
exec gunicorn app:app --bind "0.0.0.0:${PORT}" --workers 1
