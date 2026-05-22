import os
import json
import random
import math
from flask import Flask, render_template, request, jsonify

from llm_service import generate_boss_taunt

# Flask 應用程式實例
app = Flask(__name__)

# 所有可輪替的地圖版型；0 代表空白、1 代表平台、2 代表危險電弧區
MAP_ARRAYS = [
    {
        "id": "map1",
        "mapArray": [  # 0 空格、1 平台、2 電弧（危險區）
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 2, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [1, 2, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
        ]
    },
    {
        "id": "map2",
        "mapArray": [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 0, 0, 0, 0, 0, 0, 1, 1],
            [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
        ]
    },
    {
        "id": "map3",
        "mapArray": [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 2, 0, 0, 2, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [2, 1, 0, 0, 0, 0, 0, 0, 1, 2],
            [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 2, 2, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 0, 0, 0, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
        ]
    },
    {
        "id": "map4",
        "mapArray": [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
            [0, 0, 0, 0, 0, 0, 0, 1, 0, 0], 
            [0, 0, 0, 0, 0, 1, 0, 0, 0, 0], 
            [0, 0, 1, 1, 0, 0, 0, 0, 1, 0], 
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
            [2, 1, 1, 0, 0, 0, 0, 1, 1, 0], 
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
            [0, 0, 0, 1, 1, 0, 0, 0, 0, 0], 
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1], 
            [0, 1, 1, 0, 0, 0, 0, 0, 0, 0], 
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 1, 1, 0, 0, 0, 1, 0, 0], 
            [0, 0, 0, 0, 0, 1, 1, 2, 1, 0], 
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2] 
        ]
    },
    {
        "id": "map5",
        "mapArray": [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 2], 
            [0, 1, 2, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 0, 0, 0], 
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
            [0, 1, 1, 1, 0, 0, 0, 1, 1, 0], 
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
            [0, 0, 0, 0, 1, 1, 1, 0, 0, 0], 
            [2, 1, 1, 0, 0, 0, 0, 0, 0, 1], 
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
            [0, 0, 0, 0, 0, 1, 1, 0, 0, 0], 
            [0, 0, 1, 1, 0, 0, 0, 0, 1, 1],
            [1, 1, 2, 2, 0, 0, 1, 1, 2, 2], 
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]  
        ]
    }
]

# 後端用來生成各種掉落物的權重設定
DATA_TYPES = {
    "clean": {"weight": 30},
    "compressed": {"weight": 24},
    "junk": {"weight": 18},
    "virus": {"weight": 12},
    "heavy": {"weight": 10},
    # "key": {"weight": 0},
    "skill_freeze": {"weight": 0}
}

# 目前 Boss 的共享狀態
BOSS_STATS = {
    "max_hp": 400,
    "active": False,
    "current_hp": 400,
}

# Boss 技能設定
BOSS_SKILL_INTERVAL_MIN_MS = 15000 # 最短 15 秒觸發一次技能
BOSS_SKILL_INTERVAL_MAX_MS = 40000 # 最長 40 秒觸發一次技能
BOSS_REVERSE_CONTROLS_DURATION_MS = 8000 # 技能1:反轉控制 持續 8 秒
BOSS_SKILL_POOL = ("burst_drops", "reverse_controls") # 技能池：噴發掉落、反轉控制


def roll_boss_skill_interval_ms():
    """依 Boss 技能冷卻範圍抽出下一次觸發間隔。"""
    return random.randint(BOSS_SKILL_INTERVAL_MIN_MS, BOSS_SKILL_INTERVAL_MAX_MS)


def build_boss_burst_drops():
    """建立 Boss 噴發技能要送給前端的掉落物資料。"""
    burst_pattern = random.choice(["fan", "chaos", "slam"])
    burst_count = 12 if burst_pattern != "slam" else 20
    drops = []

    for i in range(burst_count):
        drop_type = choose_data_type("ENDLESS", True, 2.0)

        if burst_pattern == "fan":
            angle = (i / burst_count) * math.pi
            vx = math.cos(angle) * 6
            vy = math.sin(angle) * 4 + 2
        elif burst_pattern == "chaos":
            vx = random.uniform(-7, 7)
            vy = random.uniform(2, 6)
        else:
            vx = random.uniform(-1, 1)
            vy = random.uniform(8, 12)

        drops.append({
            "type": drop_type,
            "vx": vx,
            "vy": vy,
            "x": 320,
            "y": 110,
            "pattern": burst_pattern
        })

    return drops


def roll_boss_skill_payload():
    """抽出下一個 Boss 技能，並整理成前端可套用的 payload。"""
    skill_key = random.choice(BOSS_SKILL_POOL)
    payload = {
        "skill": skill_key,
        "next_skill_ms": roll_boss_skill_interval_ms()
    }

    if skill_key == "burst_drops":
        payload["drops"] = build_boss_burst_drops()
    elif skill_key == "reverse_controls":
        payload["duration_ms"] = BOSS_REVERSE_CONTROLS_DURATION_MS

    return payload


def get_boss_hp_percent():
    """回傳 Boss 目前血量百分比，供前端與 LLM 共用。"""
    return BOSS_STATS["current_hp"] / BOSS_STATS["max_hp"]

@app.route('/api/boss/damage', methods=['POST'])
def damage_boss():
    """讓 Boss 扣血，並回傳最新的單血條結果。"""
    damage = request.json.get('damage', 10)
    BOSS_STATS["current_hp"] = max(0, BOSS_STATS["current_hp"] - damage)
    if BOSS_STATS["current_hp"] <= 0:
        BOSS_STATS["active"] = False
    return jsonify({
        "hp": BOSS_STATS["current_hp"],
        "active": BOSS_STATS["active"],
        "max_hp": BOSS_STATS["max_hp"],
        "hp_percent": get_boss_hp_percent()
    })


@app.route('/api/boss/skill', methods=['POST'])
def activate_boss_skill():
    """讓前端取得下一次 Boss 技能與後續冷卻時間。"""
    if not BOSS_STATS["active"]:
        return jsonify({
            "error": "boss_inactive",
            "next_skill_ms": None
        }), 409

    return jsonify(roll_boss_skill_payload())

# Boss 出場時只需要把單條血量重置，不再帶入任何切階段狀態。
@app.route('/api/boss/spawn', methods=['POST'])
def spawn_boss():
    """重置 Boss 血量並標記為出現中。"""
    BOSS_STATS["current_hp"] = BOSS_STATS["max_hp"]
    BOSS_STATS["active"] = True
    return jsonify({
        "status": "ok", 
        "hp": BOSS_STATS["current_hp"], 
        "max_hp": BOSS_STATS["max_hp"],
        "next_skill_ms": roll_boss_skill_interval_ms()
    })

# Boss 台詞只根據單血條比例與玩家表現決定內容，不再傳遞階段資訊。
@app.route('/api/boss/taunt', methods=['POST'])
def boss_taunt():
    """
    Boss 即時台詞 API。
    請求格式：
      {
        "tone": "taunt" | "praise",
        "context": {
          "bossHpPercent": 0.0-1.0,
          "playerScore": number,
          "buffer": 0-100,
          "combo": number,
          "recentEvent": "timed" | "flush" | "buffer_threshold" | "combo_milestone"
        }
      }
    回應：
      成功 -> { "reply": "...（不超過25字）" }
      失敗／逾時／超字／LLM 未啟用 -> { "reply": "" }（前端不顯示）
    """
    data = request.get_json(silent=True) or {}
    tone = data.get("tone", "taunt")
    context = data.get("context") or {}

    result = generate_boss_taunt(context, tone)
    status_code = 200 if result.get("ok") else (result.get("httpStatus") or 503)
    return jsonify(result), status_code


# 排行榜與單場紀錄目前都先存成本地檔案
LEADERBOARD_FILE = "leaderboard.json"
GAME_LOGS_FILE = "game_logs.jsonl"

def choose_data_type(phase, flush_danger, risk_level):
    """依模式、Flush 狀態與風險值決定下一個資料類型。"""
    # --- 新增：6% 機率掉落緩速技能球 (Flush 噴出的不掉落技能) ---
    if not flush_danger and random.random() < 0.06: 
        return "skill_freeze"
    # --------------------------------------------------------
    bad_data_multiplier = 1 + risk_level * 0.25
    entries = []
    
    for key, val in DATA_TYPES.items():
        weight = val["weight"]
        
        if phase == "ENDLESS" and key in ["heavy", "virus", "junk"]:
            weight *= 1.55
            
        if flush_danger:
            weight = weight * 4 if key in ["junk", "heavy", "virus"] else max(1, weight * 0.15)
            
        if key in ["junk", "heavy", "virus"]:
            weight *= bad_data_multiplier
            
        entries.append((key, weight))
        
    total = sum(w for k, w in entries)
    roll = random.uniform(0, total)
    for key, weight in entries:
        roll -= weight
        if roll <= 0:
            return key
    return "clean"

@app.route('/')
def index():
    """回傳遊戲首頁。"""
    return render_template('index.html')

@app.route('/api/get_next_map')
def get_next_map():
    """取得下一張地圖，或依指定索引回傳固定地圖。"""
    force_index = request.args.get('forceIndex', default=None, type=int)
    if force_index is not None and 0 <= force_index < len(MAP_ARRAYS):
        return jsonify({"index": force_index, "map": MAP_ARRAYS[force_index]})

    exclude_index = request.args.get('exclude', default=-1, type=int)
    pool = [i for i in range(len(MAP_ARRAYS)) if i != exclude_index]
    if not pool:
        pool = list(range(len(MAP_ARRAYS)))
    
    choice_idx = random.choice(pool)
    return jsonify({"index": choice_idx, "map": MAP_ARRAYS[choice_idx]})

@app.route('/api/get_drops_queue')
def get_drops_queue():
    """依目前遊戲階段產生一批一般掉落物佇列。"""
    count = request.args.get('count', default=50, type=int)
    phase = request.args.get('phase', default='NORMAL', type=str)
    risk_level = request.args.get('riskLevel', default=0.0, type=float)
    endless_factor = request.args.get('endlessFactor', default=1.0, type=float)
    elapsed_ms = request.args.get('elapsedMs', default=0, type=float)
    
    queue = []
    for _ in range(count):
        drop_type = choose_data_type(phase, False, risk_level)
        x = random.uniform(18, 640 - 46)
        
        phase_boost = 1.1 + (elapsed_ms / 90000) if phase == "ENDLESS" else 1
        speed_multiplier = 1 + risk_level * 0.10
        vy = random.uniform(1.45, 3.05) * min(2.15, phase_boost) * speed_multiplier
        
        time_to_next = random.uniform(360, 590) * endless_factor
        
        queue.append({
            "type": drop_type,
            "x": x,
            "vy": vy,
            "timeToNext": time_to_next
        })
        
    return jsonify(queue)

@app.route('/api/get_flush_drops')
def get_flush_drops():
    """產生 Flush 技能噴出的特殊掉落資料。"""
    phase = request.args.get('phase', default='NORMAL', type=str)
    risk_level = request.args.get('riskLevel', default=0.0, type=float)
    count = 9 if phase == "ENDLESS" else 7
    
    drops = []
    for i in range(count):
        drop_type = choose_data_type(phase, True, risk_level)
        spread = i - (count - 1) / 2
        vx = spread * random.uniform(0.95, 1.35)
        vy = random.uniform(-8.4, -5.8)
        
        drops.append({
            "type": drop_type,
            "vx": vx,
            "vy": vy
        })
        
    return jsonify(drops)

@app.route('/api/leaderboard', methods=['GET', 'POST'])
def leaderboard():
    """讀取或覆寫排行榜資料。"""
    if request.method == 'GET':
        if os.path.exists(LEADERBOARD_FILE):
            with open(LEADERBOARD_FILE, 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        return jsonify([])
    elif request.method == 'POST':
        scores = request.json
        with open(LEADERBOARD_FILE, 'w', encoding='utf-8') as f:
            json.dump(scores, f, ensure_ascii=False)
        return jsonify({"status": "ok"})

@app.route('/api/log_event', methods=['POST'])
def log_event():
    """將單場遊戲的統計結果追加寫入紀錄檔。"""
    data = request.json
    with open(GAME_LOGS_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False) + "\n")
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
