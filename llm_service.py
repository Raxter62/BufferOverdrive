"""
集中管理 Boss 台詞的 Gemini / LangChain 呼叫。

- 使用老師範例風格的 ChatGoogleGenerativeAI
- 只保留單一血量邏輯，不再依賴 Boss 階段
- 回傳結構化結果，方便前端與後端除錯
"""

from __future__ import annotations

import os
import json
import re
import threading
from configparser import ConfigParser
from typing import Any, Optional

# LLM 設定檔位置與 Boss 台詞的輸出限制。
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.ini")

BOSS_TAUNT_MAX_CHARS = 25
LLM_TIMEOUT_SECONDS = 10 # Gemini API 手動 deadline 最低允許 10 秒，低於此值會回 400 INVALID_ARGUMENT。
LLM_MAX_RETRIES = 1 # LangChain 的 Gemini client 預設重試次數是 6 次，改成重試 1 次以避免過度等待

# 延遲建立 LLM client 時要共用的鎖、實例與停用原因。
_llm_lock = threading.Lock()
_llm_instance = None
_llm_disabled_reason: Optional[str] = None


def _load_config() -> ConfigParser:
    """讀取專案根目錄的 LLM 設定檔。"""
    cfg = ConfigParser()
    if os.path.exists(CONFIG_PATH):
        cfg.read(CONFIG_PATH, encoding="utf-8")
    return cfg


def _resolve_api_key(cfg: ConfigParser) -> Optional[str]:
    """依環境變數與設定檔順序解析 Gemini API Key。"""
    env_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if env_key:
        return env_key.strip() or None
    if cfg.has_option("Gemini", "API_KEY"):
        value = cfg.get("Gemini", "API_KEY").strip()
        if value and value != "YOUR_GEMINI_API_KEY_HERE":
            return value
    return None


def _resolve_model(cfg: ConfigParser) -> str:
    """取得 Gemini 模型名稱，未設定時回退到預設模型。"""
    env_model = os.environ.get("GEMINI_MODEL")
    if env_model:
        return env_model.strip()
    if cfg.has_option("Gemini", "MODEL"):
        value = cfg.get("Gemini", "MODEL").strip()
        if value:
            return value
    return "gemini-3-flash-preview"


def _classify_llm_http_status(message: str) -> int | None:
    """把 Gemini / LangChain 常見錯誤文字轉成前端可理解的 HTTP 狀態。"""
    normalized = (message or "").upper()
    if "429" in normalized or "RESOURCE_EXHAUSTED" in normalized:
        return 429
    if "503" in normalized or "UNAVAILABLE" in normalized:
        return 503
    if "504" in normalized or "TIMEOUT" in normalized or "TIMED OUT" in normalized or "DEADLINE_EXCEEDED" in normalized:
        return 504
    return None


def get_llm():
    """延後初始化 LangChain 的 Gemini client，避免啟動時直接失敗。"""
    global _llm_instance, _llm_disabled_reason
    if _llm_instance is not None:
        return _llm_instance

    with _llm_lock:
        if _llm_instance is not None:
            return _llm_instance

        cfg = _load_config()
        api_key = _resolve_api_key(cfg)
        if not api_key:
            _llm_disabled_reason = "missing_api_key"
            print("[llm_service] missing_api_key", flush=True)
            return None

        try:
            from langchain_google_genai import ChatGoogleGenerativeAI

            _llm_instance = ChatGoogleGenerativeAI(
                model=_resolve_model(cfg),
                google_api_key=api_key,
                temperature=0.95,
                timeout=LLM_TIMEOUT_SECONDS,
                max_retries=LLM_MAX_RETRIES,
            )
            _llm_disabled_reason = None
        except Exception as exc:
            _llm_disabled_reason = f"init_failed: {exc}"
            print(f"[llm_service] {_llm_disabled_reason}", flush=True)
            _llm_instance = None
        return _llm_instance


def _message_content_to_str(content: Any) -> str:
    """把 LangChain / Gemini 回傳的多段內容整理成單一字串。"""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text")
                if text:
                    parts.append(str(text))
            elif hasattr(block, "text") and getattr(block, "text", None):
                parts.append(str(block.text))
        return "".join(parts)
    return str(content)


# 清理模型台詞中不該出現在 Boss 泡泡裡的格式符號。
_MD_STRIP_RE = re.compile(r"[\*_`>#~\[\]\(\)\{\}\\]")
_QUOTE_STRIP_RE = re.compile(r"[\"'「」『』“”‘’]")


def _sanitize_taunt(text: str) -> str:
    """移除引號、markdown 與換行，避免前端顯示時出現格式噪音。"""
    if not text:
        return ""
    cleaned = text.strip()
    cleaned = cleaned.replace("\r", " ").replace("\n", " ")
    cleaned = _MD_STRIP_RE.sub("", cleaned)
    cleaned = _QUOTE_STRIP_RE.sub("", cleaned)
    cleaned = re.sub(r"\s+", "", cleaned)
    return cleaned


# 人設描述
_BOSS_SYSTEM_PROMPT = (
    "你是「網路病毒機器人」，街機遊戲BUFFER OVERDRIVE的Boss。"
    "說話帶有電子噪音與壓迫感，語氣自大、傲慢、尖酸刻薄、愛批評。"
    "嚴格輸出規則："
    "1. 只輸出一句台詞，使用繁體中文或是英文。"
    "2. 純文字。禁止markdown、emoji、引號、換行、解釋、句子結尾不須加句號。"
    f"3. 長度必須不超過{BOSS_TAUNT_MAX_CHARS}個字（中文字、標點都算）。"
    "4. 當tone=taunt時挑釁、貶低玩家；當tone=praise時勉強、不情願地稱讚玩家，仍保持壓迫感。"
    "5. 不可重複使用相同句子。"
)


def _build_boss_user_prompt(context: dict[str, Any], tone: str) -> str:
    """只把單一血量條資訊送給模型，不再傳送 Boss 階段。"""
    hp_pct = context.get("bossHpPercent")
    try:
        hp_pct_num = float(hp_pct) if hp_pct is not None else 1.0
    except (TypeError, ValueError):
        hp_pct_num = 1.0

    score = context.get("playerScore", 0)
    buffer_val = context.get("buffer", 0)
    combo = context.get("combo", 0)
    recent = context.get("recentEvent", "timed")
    tone_hint = "挑釁、嘲諷玩家" if tone == "taunt" else "勉強、不情願地稱讚玩家"

    return (
        f"tone={tone}（{tone_hint}）\n"
        f"Boss剩餘血量百分比={hp_pct_num:.2f}\n"
        f"玩家分數={score}\n"
        f"玩家Buffer={buffer_val}（0-100，越高代表玩家越接近過載）\n"
        f"玩家Combo={combo}\n"
        f"最近事件={recent}\n"
        f"請依以上情境，輸出一句不超過{BOSS_TAUNT_MAX_CHARS}字的台詞。"
    )


def generate_boss_taunt(context: dict[str, Any], tone: str) -> dict[str, Any]:
    """統一回傳 Boss 台詞呼叫結果，讓前端能知道失敗原因。"""
    result = {
        "ok": False,
        "reply": "",
        "error": None,
        "detail": None,
        "httpStatus": None,
        "backend": "langchain",
        "model": None,
    }

    llm = get_llm()
    cfg = _load_config()
    result["model"] = _resolve_model(cfg)
    if llm is None:
        result["error"] = _llm_disabled_reason or "llm_unavailable"
        result["detail"] = "LLM client is unavailable."
        print(f"[llm_service] boss taunt unavailable: {result['error']}", flush=True)
        return result

    tone = (tone or "taunt").strip().lower()
    if tone not in ("taunt", "praise"):
        tone = "taunt"

    try:
        from langchain_core.messages import HumanMessage, SystemMessage
    except Exception as exc:
        message = f"langchain_core_unavailable: {exc}"
        print(f"[llm_service] {message}", flush=True)
        result["error"] = "langchain_core_unavailable"
        result["detail"] = str(exc)
        return result

    messages = [
        SystemMessage(content=_BOSS_SYSTEM_PROMPT),
        HumanMessage(content=_build_boss_user_prompt(context or {}, tone)),
    ]

    try:
        invoke_result = llm.invoke(messages)
    except Exception as exc:
        message = str(exc)
        print(f"[llm_service] boss taunt LLM error: {message}", flush=True)
        result["error"] = "langchain_invoke_failed"
        result["detail"] = message
        result["httpStatus"] = _classify_llm_http_status(message)
        return result

    raw = _message_content_to_str(getattr(invoke_result, "content", "")).strip()
    cleaned = _sanitize_taunt(raw)
    if not cleaned:
        result["error"] = "empty_reply"
        result["detail"] = "Model returned an empty reply after sanitization."
        print(f"[llm_service] {result['detail']}", flush=True)
        return result

    if len(cleaned) > BOSS_TAUNT_MAX_CHARS:
        result["error"] = "reply_too_long"
        result["detail"] = f"Reply exceeded {BOSS_TAUNT_MAX_CHARS} characters."
        print(f"[llm_service] {result['detail']}", flush=True)
        return result

    result["ok"] = True
    result["reply"] = cleaned
    return result


REPORT_ANALYSIS_MAX_CHARS = 900

_REPORT_ANALYST_SYSTEM_PROMPT = (
    "你是 BUFFER OVERDRIVE 的戰報分析師。"
    "你的任務是根據單局遊戲 log 摘要，寫出玩家能看懂、具體、有行動建議的繁體中文戰報分析"
    "請用專業但不冷冰冰的語氣，有點幽默風趣，分析操作節奏、風險管理、Flush 時機、資料處理偏好、Boss/Endless 表現，偶爾可以開開玩笑"
    "限制：不要使用 Markdown 表格，不要編造不存在的數字"
    "輸出 3 到 5 句，總長控制在 200 個中文字以內"
)


def _sanitize_report_analysis(text: str) -> str:
    """整理戰報分析文字，避免 email 裡出現過長或空白過多的內容。"""
    if not text:
        return ""
    cleaned = text.strip().replace("\r", " ").replace("\n", "<br>")
    cleaned = re.sub(r"(<br>\s*){3,}", "<br><br>", cleaned)
    if len(cleaned) > REPORT_ANALYSIS_MAX_CHARS:
        cleaned = cleaned[:REPORT_ANALYSIS_MAX_CHARS].rstrip() + "..."
    return cleaned


def generate_battle_report_analysis(analysis_payload: dict[str, Any]) -> dict[str, Any]:
    """讓戰報分析師根據精簡後的 Supabase 單局 log 產生 email 分析文字。"""
    result = {
        "ok": False,
        "analysis": "",
        "error": None,
        "detail": None,
        "httpStatus": None,
        "backend": "langchain",
        "model": None,
    }

    llm = get_llm()
    cfg = _load_config()
    result["model"] = _resolve_model(cfg)
    if llm is None:
        result["error"] = _llm_disabled_reason or "llm_unavailable"
        result["detail"] = "LLM client is unavailable."
        print(f"[llm_service] report analysis unavailable: {result['error']}", flush=True)
        return result

    try:
        from langchain_core.messages import HumanMessage, SystemMessage
    except Exception as exc:
        result["error"] = "langchain_core_unavailable"
        result["detail"] = str(exc)
        print(f"[llm_service] report analysis import failed: {exc}", flush=True)
        return result

    payload_json = json.dumps(analysis_payload or {}, ensure_ascii=False, separators=(",", ":"))
    messages = [
        SystemMessage(content=_REPORT_ANALYST_SYSTEM_PROMPT),
        HumanMessage(content=(
            "請根據以下精簡後的單局遊戲 log 寫戰報分析。"
            "請指出一個做得好的地方、一個主要風險、以及下一局可執行的建議。\n"
            f"{payload_json}"
        )),
    ]

    try:
        invoke_result = llm.invoke(messages)
    except Exception as exc:
        message = str(exc)
        print(f"[llm_service] report analysis LLM error: {message}", flush=True)
        result["error"] = "langchain_invoke_failed"
        result["detail"] = message
        result["httpStatus"] = _classify_llm_http_status(message)
        return result

    raw = _message_content_to_str(getattr(invoke_result, "content", "")).strip()
    cleaned = _sanitize_report_analysis(raw)
    if not cleaned:
        result["error"] = "empty_analysis"
        result["detail"] = "Model returned an empty battle report analysis."
        return result

    result["ok"] = True
    result["analysis"] = cleaned
    return result
