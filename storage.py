from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent


class StorageError(RuntimeError):
    """資料儲存層發生錯誤時，統一丟出這個例外給 Flask route 處理。"""


def _resolve_data_path(env_name: str, default_name: str) -> Path:
    """允許本機或 Railway Volume 用環境變數改資料檔路徑。"""
    configured = os.environ.get(env_name)
    if not configured:
        return BASE_DIR / default_name

    path = Path(configured)
    return path if path.is_absolute() else BASE_DIR / path


LEADERBOARD_FILE = _resolve_data_path("LEADERBOARD_FILE", "leaderboard.json")
GAME_LOGS_FILE = _resolve_data_path("GAME_LOGS_FILE", "game_logs.jsonl")

# Supabase 資料表名稱保留環境變數覆寫空間，正式部署預設使用 schema 檔內的表名。
LEADERBOARD_TABLE = os.environ.get("SUPABASE_LEADERBOARD_TABLE", "leaderboard_state")
GAME_LOGS_TABLE = os.environ.get("SUPABASE_GAME_LOGS_TABLE", "game_logs")
LEADERBOARD_ROW_ID = 1


def _resolve_supabase_key() -> str | None:
    """只在後端讀取 Supabase secret/service key，避免任何金鑰出現在瀏覽器。"""
    return (
        os.environ.get("SUPABASE_SECRET_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_KEY")
    )


def _has_supabase_config() -> bool:
    """Railway 有設定 Supabase 連線資訊時，才切換到雲端資料庫。"""
    return bool(os.environ.get("SUPABASE_URL") and _resolve_supabase_key())


@lru_cache(maxsize=1)
def _get_supabase_client():
    """延遲建立 Supabase client，讓本機沒有安裝 supabase 套件時仍可用檔案模式執行。"""
    if not _has_supabase_config():
        return None

    try:
        from supabase import create_client
    except Exception as exc:  # pragma: no cover - 部署環境缺套件時才會走到這裡。
        raise StorageError("Supabase 套件尚未安裝，請確認 requirements.txt 已安裝。") from exc

    return create_client(os.environ["SUPABASE_URL"], _resolve_supabase_key())


def load_leaderboard() -> list[Any]:
    """讀取排行榜；有 Supabase 設定就讀資料庫，否則使用原本的本機 JSON。"""
    if _has_supabase_config():
        return _load_leaderboard_from_supabase()
    return _load_leaderboard_from_file()


def save_leaderboard(scores: list[Any]) -> None:
    """儲存排行榜；維持前端目前整份 top 5 覆寫的行為。"""
    safe_scores = scores if isinstance(scores, list) else []
    if _has_supabase_config():
        _save_leaderboard_to_supabase(safe_scores)
        return
    _save_leaderboard_to_file(safe_scores)


def append_game_log(payload: Any) -> None:
    """新增一筆遊戲結束紀錄；Supabase 使用 JSONB，本機則延續 jsonl 格式。"""
    safe_payload = payload if payload is not None else {}
    if _has_supabase_config():
        _append_game_log_to_supabase(safe_payload)
        return
    _append_game_log_to_file(safe_payload)


def _load_leaderboard_from_file() -> list[Any]:
    """本機開發用 fallback：讀取原本的 leaderboard.json。"""
    if not LEADERBOARD_FILE.exists():
        return []

    try:
        with LEADERBOARD_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError) as exc:
        raise StorageError("讀取本機排行榜檔案失敗。") from exc

    return data if isinstance(data, list) else []


def _save_leaderboard_to_file(scores: list[Any]) -> None:
    """本機開發用 fallback：寫回原本的 leaderboard.json。"""
    try:
        LEADERBOARD_FILE.parent.mkdir(parents=True, exist_ok=True)
        with LEADERBOARD_FILE.open("w", encoding="utf-8") as file:
            json.dump(scores, file, ensure_ascii=False)
    except OSError as exc:
        raise StorageError("寫入本機排行榜檔案失敗。") from exc


def _append_game_log_to_file(payload: Any) -> None:
    """本機開發用 fallback：延續原本一行一筆 JSON 的紀錄方式。"""
    try:
        GAME_LOGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with GAME_LOGS_FILE.open("a", encoding="utf-8") as file:
            file.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except OSError as exc:
        raise StorageError("寫入本機遊戲紀錄檔案失敗。") from exc


def _load_leaderboard_from_supabase() -> list[Any]:
    """正式部署用：從 Supabase 讀取唯一一筆排行榜狀態。"""
    client = _get_supabase_client()
    try:
        response = (
            client.table(LEADERBOARD_TABLE)
            .select("scores")
            .eq("id", LEADERBOARD_ROW_ID)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise StorageError("從 Supabase 讀取排行榜失敗，請確認資料表與環境變數。") from exc

    rows = response.data or []
    if not rows:
        return []

    scores = rows[0].get("scores", [])
    return scores if isinstance(scores, list) else []


def _save_leaderboard_to_supabase(scores: list[Any]) -> None:
    """正式部署用：用 upsert 固定更新 id=1 的排行榜狀態。"""
    client = _get_supabase_client()
    row = {
        "id": LEADERBOARD_ROW_ID,
        "scores": scores,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        client.table(LEADERBOARD_TABLE).upsert(row).execute()
    except Exception as exc:
        raise StorageError("寫入 Supabase 排行榜失敗，請確認資料表與金鑰權限。") from exc


def _append_game_log_to_supabase(payload: Any) -> None:
    """正式部署用：把整份遊戲結束資料寫成 JSONB，避免改動前端統計格式。"""
    client = _get_supabase_client()
    try:
        client.table(GAME_LOGS_TABLE).insert({"payload": payload}).execute()
    except Exception as exc:
        raise StorageError("寫入 Supabase 遊戲紀錄失敗，請確認資料表與金鑰權限。") from exc
