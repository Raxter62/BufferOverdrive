from __future__ import annotations

import base64
import html
import os
import re
from typing import Any


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_PDF_BYTES = 12 * 1024 * 1024


class ReportMailError(RuntimeError):
    """戰報寄送失敗時使用的例外，讓 Flask route 可以回傳清楚狀態。"""

    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


def _clean_pdf_base64(pdf_base64: str) -> str:
    """移除 data URI 前綴並驗證內容確實是合法 PDF base64。"""
    if not isinstance(pdf_base64, str) or not pdf_base64.strip():
        raise ReportMailError("缺少 PDF 戰報內容。", 400)

    cleaned = pdf_base64.strip()
    if "," in cleaned and cleaned.startswith("data:"):
        cleaned = cleaned.split(",", 1)[1]

    try:
        pdf_bytes = base64.b64decode(cleaned, validate=True)
    except Exception as exc:
        raise ReportMailError("PDF 戰報內容格式不正確。", 400) from exc

    if not pdf_bytes.startswith(b"%PDF"):
        raise ReportMailError("附件不是有效的 PDF 檔案。", 400)

    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise ReportMailError("PDF 戰報檔案過大，請降低截圖解析度。", 413)

    return cleaned


def _safe_filename(filename: str | None) -> str:
    """限制附件檔名只保留安全字元，避免特殊字元影響寄送。"""
    if not filename:
        return "buffer-overdrive-report.pdf"

    cleaned = re.sub(r"[^A-Za-z0-9_.-]", "-", filename)
    if not cleaned.lower().endswith(".pdf"):
        cleaned += ".pdf"
    return cleaned[:120]


def _summary_html(summary: dict[str, Any]) -> str:
    """把前端送來的戰報摘要轉成 email 內文，PDF 仍是主要附件。"""
    score = html.escape(str(summary.get("score", "")))
    ended_at = html.escape(str(summary.get("endedAt", "")))
    duration = html.escape(str(summary.get("duration", "")))
    handled = html.escape(str(summary.get("handled", "")))
    absorbed = html.escape(str(summary.get("absorbed", "")))
    discarded = html.escape(str(summary.get("discarded", "")))
    flushes = html.escape(str(summary.get("flushes", "")))

    return f"""
    <div style="font-family:Arial,'Microsoft JhengHei',sans-serif;color:#0b1720;">
        <h2>BUFFER OVERDRIVE Battle Report</h2>
        <p>戰報 PDF 已附加在這封信中。</p>
        <ul>
            <li>Final Score: <strong>{score}</strong></li>
            <li>Ended At: <strong>{ended_at}</strong></li>
            <li>Duration: <strong>{duration}</strong></li>
            <li>Handled: <strong>{handled}</strong></li>
            <li>Absorbed: <strong>{absorbed}</strong></li>
            <li>Discarded: <strong>{discarded}</strong></li>
            <li>Flushes: <strong>{flushes}</strong></li>
        </ul>
    </div>
    """


def send_battle_report(
    recipient_email: str,
    pdf_base64: str,
    filename: str | None = None,
    summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """使用 Resend 將前端產生的 PDF 戰報寄出。"""
    api_key = os.environ.get("RESEND_API_KEY")
    from_email = os.environ.get("RESEND_FROM_EMAIL")

    if not api_key:
        raise ReportMailError("尚未設定 RESEND_API_KEY。", 503)
    if not from_email:
        raise ReportMailError("尚未設定 RESEND_FROM_EMAIL。", 503)

    recipient = (recipient_email or "").strip()
    if not EMAIL_RE.match(recipient):
        raise ReportMailError("電子郵件格式不正確。", 400)

    clean_pdf = _clean_pdf_base64(pdf_base64)
    safe_name = _safe_filename(filename)

    try:
        import resend
    except Exception as exc:  # pragma: no cover - 部署環境缺套件時才會走到這裡。
        raise ReportMailError("Resend 套件尚未安裝，請確認 requirements.txt。", 503) from exc

    resend.api_key = api_key
    params: resend.Emails.SendParams = {
        "from": from_email,
        "to": [recipient],
        "subject": "BUFFER OVERDRIVE Battle Report",
        "html": _summary_html(summary or {}),
        "attachments": [
            {
                "filename": safe_name,
                "content": clean_pdf,
            }
        ],
    }

    reply_to = os.environ.get("RESEND_REPLY_TO")
    if reply_to:
        params["reply_to"] = reply_to

    try:
        return resend.Emails.send(params)
    except Exception as exc:
        raise ReportMailError(f"Resend 寄送失敗：{exc}", 502) from exc
