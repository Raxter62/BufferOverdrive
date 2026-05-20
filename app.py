import os
import json
import random
import math
from flask import Flask, render_template, request, jsonify

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
    "key": {"weight": 4},
    "skill_freeze": {"weight": 0}
}

# 目前 Boss 的共享狀態
BOSS_STATS = {
    "max_hp": 400,
    "active": False,
    "current_hp": 400,
}

def get_boss_phase():
    """根據 Boss 剩餘血量計算目前階段。"""
    hp_percent = BOSS_STATS["current_hp"] / BOSS_STATS["max_hp"]
    if hp_percent > 0.6:
        return "STORM"
    if hp_percent > 0.3:
        return "CHAOS"
    return "DESPERATE"

@app.route('/api/boss/status')
def get_boss_status():
    """回傳目前 Boss 狀態，供前端同步畫面。"""
    return jsonify({
        "active": BOSS_STATS["active"],
        "hp": BOSS_STATS["current_hp"],
        "max_hp": BOSS_STATS["max_hp"],
        "phase": get_boss_phase()
    })

@app.route('/api/boss/damage', methods=['POST'])
def damage_boss():
    """讓 Boss 扣血，並回傳最新血量與階段。"""
    damage = request.json.get('damage', 10)
    BOSS_STATS["current_hp"] = max(0, BOSS_STATS["current_hp"] - damage)
    if BOSS_STATS["current_hp"] <= 0:
        BOSS_STATS["active"] = False
    return jsonify({
        "hp": BOSS_STATS["current_hp"],
        "active": BOSS_STATS["active"],
        "phase": get_boss_phase()
    })

@app.route('/api/boss/burst_drops')
def get_boss_burst_drops():
    """
    依 Boss 階段產生特殊噴發掉落資料。
    """
    phase = request.args.get('phase', default='STORM')
    count = 12 if phase != "DESPERATE" else 20
    drops = []
    
    for i in range(count):
        # Boss 噴發的資料通常比較危險，因此 riskLevel 直接拉高
        drop_type = choose_data_type("ENDLESS", True, 2.0)
        
        # 不同階段使用不同的噴發軌跡
        if phase == "STORM":
            # 扇形噴發
            angle = (i / count) * math.pi
            vx = math.cos(angle) * 6
            vy = math.sin(angle) * 4 + 2
        elif phase == "CHAOS":
            # 隨機散射
            vx = random.uniform(-7, 7)
            vy = random.uniform(2, 6)
        else:
            # DESPERATE：高速垂直落下
            vx = random.uniform(-1, 1)
            vy = random.uniform(8, 12)

        drops.append({"type": drop_type, "vx": vx, "vy": vy, "x": 320})  # 從畫面中央噴出
    return jsonify(drops)

@app.route('/api/boss/spawn', methods=['POST'])
def spawn_boss():
    """重置 Boss 血量並標記為出現中。"""
    BOSS_STATS["current_hp"] = BOSS_STATS["max_hp"]
    BOSS_STATS["active"] = True
    return jsonify({
        "status": "ok", 
        "hp": BOSS_STATS["current_hp"], 
        "max_hp": BOSS_STATS["max_hp"]
    })

# 排行榜與單場紀錄目前都先存成本地檔案
LEADERBOARD_FILE = "leaderboard.json"
GAME_LOGS_FILE = "game_logs.jsonl"

def choose_data_type(phase, flush_danger, risk_level):
    # --- 新增：6% 機率掉落緩速技能球 (Flush 噴出的不掉落技能) ---
    if not flush_danger and random.random() < 0.06: 
        return "skill_freeze"
    # --------------------------------------------------------
    """依模式、Flush 狀態與風險值決定下一個資料類型。"""
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
