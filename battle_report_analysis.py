from __future__ import annotations

from collections import Counter
from typing import Any


MAX_KEY_EVENTS = 45
OPENING_EVENT_COUNT = 5
CLOSING_EVENT_COUNT = 10
HIGH_BUFFER_THRESHOLD = 80


def _safe_number(value: Any, default: float = 0) -> float:
    """把前端送來的數字安全轉成 float，避免 None 或字串造成分析中斷。"""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number


def _event_time_label(ms: Any) -> str:
    """把毫秒時間轉成 LLM 容易閱讀的秒數標籤。"""
    seconds = _safe_number(ms) / 1000
    return f"{seconds:.1f}s"


def _compact_event(event: dict[str, Any]) -> dict[str, Any]:
    """裁掉不必要欄位，只留下分析節奏、風險與得分需要的資訊。"""
    compact = {
        "t": _event_time_label(event.get("at")),
        "action": event.get("action"),
        "type": event.get("type"),
        "buffer": event.get("buffer"),
        "score": event.get("score"),
    }

    for key in ("before", "after", "count", "durationMs", "endlessStartScore"):
        if key in event:
            compact[key] = event[key]

    return {key: value for key, value in compact.items() if value is not None}


def _is_key_event(event: dict[str, Any]) -> bool:
    """挑出會影響戰報解讀的事件，避免把 120 筆流水帳全丟給 LLM。"""
    action = event.get("action")
    buffer_value = _safe_number(event.get("buffer"))
    score = _safe_number(event.get("score"))

    if buffer_value >= HIGH_BUFFER_THRESHOLD:
        return True
    if action in {
        "flush",
        "fall-respawn",
        "boss-defeated",
        "boss-skill",
        "boss-skill-warning",
        "enter-endless",
        "auto-timeout",
    }:
        return True
    if action == "absorb" and score >= 1000:
        return True
    return False


def _dedupe_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """同一個時間點與行為只保留一次，避免開局、結尾、關鍵事件重疊。"""
    seen: set[tuple[Any, Any, Any, Any]] = set()
    deduped: list[dict[str, Any]] = []

    for event in events:
        key = (
            event.get("at"),
            event.get("action"),
            event.get("type"),
            event.get("score"),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(event)

    return deduped


def _build_key_events(history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """保留開局、結尾與高壓/特殊事件，控制 token 量但不丟失戰局脈絡。"""
    if not history:
        return []

    selected = [
        *history[:OPENING_EVENT_COUNT],
        *[event for event in history if _is_key_event(event)],
        *history[-CLOSING_EVENT_COUNT:],
    ]
    selected = _dedupe_events(selected)

    if len(selected) > MAX_KEY_EVENTS:
        opening = selected[:OPENING_EVENT_COUNT]
        closing = selected[-CLOSING_EVENT_COUNT:]
        middle_budget = MAX_KEY_EVENTS - len(opening) - len(closing)
        selected = [*opening, *selected[OPENING_EVENT_COUNT:OPENING_EVENT_COUNT + middle_budget], *closing]

    return [_compact_event(event) for event in selected]


def _summarize_type_stats(type_stats: dict[str, Any]) -> dict[str, Any]:
    """整理各資料類型的吸收與丟棄數，讓戰報分析師能判斷玩家偏好。"""
    summary: dict[str, Any] = {}
    for type_key, stat in type_stats.items():
        if not isinstance(stat, dict):
            continue
        absorbed = int(_safe_number(stat.get("absorbed")))
        discarded = int(_safe_number(stat.get("discarded")))
        buffer_delta = int(_safe_number(stat.get("buffer")))
        total = absorbed + discarded
        summary[type_key] = {
            "absorbed": absorbed,
            "discarded": discarded,
            "total": total,
            "bufferDelta": buffer_delta,
        }
    return summary


def build_analysis_payload(game_log: dict[str, Any]) -> dict[str, Any]:
    """把 Supabase 單局 log 精簡成 LLM 戰報分析師需要的資料。"""
    payload = game_log if isinstance(game_log, dict) else {}
    history = payload.get("history") if isinstance(payload.get("history"), list) else []
    history = [event for event in history if isinstance(event, dict)]
    type_stats = payload.get("typeStats") if isinstance(payload.get("typeStats"), dict) else {}

    buffers = [_safe_number(event.get("buffer")) for event in history if "buffer" in event]
    scores = [_safe_number(event.get("score")) for event in history if "score" in event]
    event_counts = Counter(str(event.get("action") or "unknown") for event in history)
    final_score = int(_safe_number(payload.get("score"), scores[-1] if scores else 0))

    # 這些指標讓 LLM 不必自己掃完整 history，就能快速理解壓力與節奏。
    metrics = {
        "durationSeconds": round(_safe_number(history[-1].get("at")) / 1000, 1) if history else None,
        "maxBuffer": int(max(buffers)) if buffers else 0,
        "avgBuffer": round(sum(buffers) / len(buffers), 1) if buffers else 0,
        "highPressureEventCount": sum(1 for value in buffers if value >= HIGH_BUFFER_THRESHOLD),
        "finalBuffer": int(buffers[-1]) if buffers else 0,
        "peakScore": int(max(scores)) if scores else final_score,
        "bossDefeated": any(event.get("action") == "boss-defeated" for event in history),
        "enteredEndless": any(event.get("action") == "enter-endless" for event in history),
        "fallRespawns": event_counts.get("fall-respawn", 0),
        "autoTimeouts": event_counts.get("auto-timeout", 0),
    }

    return {
        "summary": {
            "score": final_score,
            "handled": int(_safe_number(payload.get("handled"))),
            "absorbed": int(_safe_number(payload.get("absorbed"))),
            "discarded": int(_safe_number(payload.get("discarded"))),
            "autoAbsorbed": int(_safe_number(payload.get("autoAbsorbed"))),
            "flushes": int(_safe_number(payload.get("flushes"))),
            "endedAt": payload.get("endedAt"),
            "historyCount": len(history),
        },
        "metrics": metrics,
        "eventCounts": dict(event_counts),
        "typeStats": _summarize_type_stats(type_stats),
        "keyEvents": _build_key_events(history),
    }
