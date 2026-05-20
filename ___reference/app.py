from flask import Flask, render_template, request, jsonify
from configparser import ConfigParser
import os

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
config = ConfigParser()
config.read(os.path.join(BASE_DIR, "config.ini"))

llm = ChatGoogleGenerativeAI(
    model="gemini-3-flash-preview",
    google_api_key=config["Gemini"]["API_KEY"],
    temperature=0.9,
)

app = Flask(__name__)


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


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/call_llm", methods=["POST"])
def call_llm():
    """
    僅負責呼叫模型並回傳文字。
    角色設定、遊戲情境與畫面邏輯由前端 main.js 組好後傳入。
    """
    data = request.get_json(silent=True) or {}
    system_content = (data.get("system_role") or "").strip()
    human_content = (data.get("user_message") or "").strip()
    if not system_content:
        system_content = "你是一位遊戲 NPC，請用繁體中文簡短回應。"
    if not human_content:
        human_content = "請打招呼。"

    messages = [
        SystemMessage(content=system_content),
        HumanMessage(content=human_content),
    ]
    try:
        result = llm.invoke(messages)
        text = _message_content_to_str(result.content).strip()
        if not text:
            text = "（模型沒有回傳可顯示的文字）"
        return jsonify({"reply": text})
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"reply": "我現在不想跟你講話，待會再來"})


if __name__ == "__main__":
    app.run(debug=True)
