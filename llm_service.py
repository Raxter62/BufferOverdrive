"""
llm_service.py

集中管理 Gemini LLM 客戶端與 prompt 模板。
- get_llm()：lazy 初始化 ChatGoogleGenerativeAI
- generate_boss_taunt()：產生 Boss 台詞，含 20 字驗證
- 未來戰後分析也可在這裡擴充（post_game_analysis）
"""

from __future__ import annotations

import os
import re
import threading
from configparser import ConfigParser
from typing import Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.ini")

BOSS_TAUNT_MAX_CHARS = 20

_llm_lock = threading.Lock()
_llm_instance = None
_llm_disabled_reason: Optional[str] = None


def _load_config() -> ConfigParser:
    cfg = ConfigParser()
    if os.path.exists(CONFIG_PATH):
        cfg.read(CONFIG_PATH, encoding="utf-8")
    return cfg


def _resolve_api_key(cfg: ConfigParser) -> Optional[str]:
    env_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if env_key:
        return env_key.strip() or None
    if cfg.has_option("Gemini", "API_KEY"):
        value = cfg.get("Gemini", "API_KEY").strip()
        if value and value != "YOUR_GEMINI_API_KEY_HERE":
            return value
    return None


def _resolve_model(cfg: ConfigParser) -> str:
    env_model = os.environ.get("GEMINI_MODEL")
    if env_model:
        return env_model.strip()
    if cfg.has_option("Gemini", "MODEL"):
        value = cfg.get("Gemini", "MODEL").strip()
        if value:
            return value
    return "gemini-3-flash-preview"


def get_llm():
    """Lazy 初始化 LLM；若 API key 不存在則回傳 None 並記錄原因。"""
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
            return None
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI

            _llm_instance = ChatGoogleGenerativeAI(
                model=_resolve_model(cfg),
                google_api_key=api_key,
                temperature=0.95,
            )
        except Exception as e:
            _llm_disabled_reason = f"init_failed: {e}"
            _llm_instance = None
        return _llm_instance


def _message_content_to_str(content) -> str:
    """Gemini／LangChain 的 message.content 可能是 str 或 list（多段 text）。"""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                t = block.get("text")
                if t:
                    parts.append(str(t))
            elif hasattr(block, "text") and getattr(block, "text", None):
                parts.append(str(block.text))
        return "".join(parts)
    return str(content)


_MD_STRIP_RE = re.compile(r"[\*\_`>#~\[\]\(\)\{\}\\]")
_QUOTE_STRIP_RE = re.compile(r"[\"'「」『』“”‘’]")


def _sanitize_taunt(text: str) -> str:
    """去掉 markdown 符號、引號、換行；保留純文字內容。"""
    if not text:
        return ""
    cleaned = text.strip()
    cleaned = cleaned.replace("\r", " ").replace("\n", " ")
    cleaned = _MD_STRIP_RE.sub("", cleaned)
    cleaned = _QUOTE_STRIP_RE.sub("", cleaned)
    cleaned = re.sub(r"\s+", "", cleaned)
    return cleaned


# 共用人設與規則
_BOSS_SYSTEM_PROMPT = (
    "你是「產生垃圾資料的網路病毒」，街機遊戲BUFFER OVERDRIVE的Boss。"
    "說話帶有電子噪音與壓迫感，語氣自大、簡短、像系統警告。"
    "嚴格輸出規則："
    "1. 只輸出一句台詞，使用繁體中文或是美式英文。"
    "2. 純文字。禁止markdown、emoji、引號、換行、解釋。"
    f"3. 長度必須不超過{BOSS_TAUNT_MAX_CHARS}個字（中文字、標點都算）。"
    "4. 當tone=taunt時挑釁、貶低玩家；當tone=praise時勉強、不情願地稱讚玩家，仍保持壓迫感。"
    "5. 不可重複使用相同句子。"
)


def _build_boss_user_prompt(context: dict, tone: str) -> str:
    phase = context.get("bossPhase", "STORM")
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
        f"Boss階段={phase}（STORM正常／CHAOS狂亂／DESPERATE瀕死）\n"
        f"Boss剩餘血量百分比={hp_pct_num:.2f}\n"
        f"玩家分數={score}\n"
        f"玩家Buffer={buffer_val}（0-100，越高代表玩家越接近過載）\n"
        f"玩家Combo={combo}\n"
        f"最近事件={recent}\n"
        f"請依以上情境，輸出一句不超過{BOSS_TAUNT_MAX_CHARS}字的台詞。"
    )


def generate_boss_taunt(context: dict, tone: str) -> Optional[str]:
    """
    產生 Boss 台詞。
    回傳值：
      - 成功且長度 <= 20：回傳純文字
      - LLM 未設定／呼叫失敗／空回傳／超過 20 字：回傳 None（前端忽略不顯示）
    """
    llm = get_llm()
    if llm is None:
        return None

    tone = (tone or "taunt").strip().lower()
    if tone not in ("taunt", "praise"):
        tone = "taunt"

    try:
        from langchain_core.messages import HumanMessage, SystemMessage
    except Exception as e:
        print(f"[llm_service] langchain_core not available: {e}")
        return None

    messages = [
        SystemMessage(content=_BOSS_SYSTEM_PROMPT),
        HumanMessage(content=_build_boss_user_prompt(context or {}, tone)),
    ]
    try:
        result = llm.invoke(messages)
    except Exception as e:
        print(f"[llm_service] boss taunt LLM error: {e}")
        return None

    raw = _message_content_to_str(getattr(result, "content", "")).strip()
    cleaned = _sanitize_taunt(raw)
    if not cleaned:
        return None
    if len(cleaned) > BOSS_TAUNT_MAX_CHARS:
        return None
    return cleaned


def is_llm_available() -> bool:
    return get_llm() is not None


def llm_status() -> dict:
    return {
        "available": is_llm_available(),
        "reason": _llm_disabled_reason,
    }
