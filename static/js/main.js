const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;
const TILE = 32;
const DECISION_TIME_MS = 1500;
const FLUSH_HOLD_MS = 650;
const FLUSH_PAUSE_MS = 1100;
const FLUSH_BUFFER_REDUCE = 25;
const DASH_COOLDOWN_MS = 3000;
const FLUSH_COOLDOWN_MS = 6000;
const RISK_DECAY_MS = 10000;
const RISK_BAD_DATA_BONUS_PER_STACK = 0.25;
const RISK_DROP_SPEED_BONUS_PER_STACK = 0.10;
const IDLE_FRAME_INTERVAL_MS = 400;
const SKILL_FRAME_INTERVAL_MS = 300;
const DISCARD_ANIM_MS = 900;
const RESPAWN_INVINCIBLE_MS = 1000;
const DEATH_FRAME_SWITCH_MS = 2000;
const ENDLESS_SCORE = 5000;
const MAP_SWAP_SCORE_STEP = 800;
const MAP_SWAP_TELEGRAPH_MS = 3000;
const ARCADE_FONT_FAMILY = "'Press Start 2P', 'VT323', 'Courier New', 'Noto Sans TC', monospace";
const START_FRAME_ORDER = [1, 2, 3, 4, 5, 4, 3, 2, 1];
const START_FRAME_INTERVAL_MS = 120;
const TRASH_ZONE = { x: 0, y: 448, w: GAME_WIDTH, h: 32 };
const INITIAL_MAP_INDEX = 1;
const LEADERBOARD_STORAGE_KEY = "bufferOverdrive.leaderboard.v1";
const LEADERBOARD_LIMIT = 5;
const SCORE_DIGITS = 6;
const SCENES = {
    INTRO: "intro",
    GUIDE: "guide",
    PLAYING: "playing"
};


const IMAGE_PATHS = {
    idleAction: "/static/player_image/player/idle_action.png",
    idleWaiting: "/static/player_image/player/idle_waiting.png",
    useSkill: "/static/player_image/player/use_skills.png",
    skillicon: "/static/player_image/player/skills_icon.png",
    dropData: "/static/player_image/object/drop_data.png",
    platform: "/static/player_image/background/platform.png",
    state: "/static/player_image/player/skills_icon.png",
    combo1: "/static/player_image/object/combo/1.png",
    combo2: "/static/player_image/object/combo/2.png",
    combo3: "/static/player_image/object/combo/3.png",
    combo4: "/static/player_image/object/combo/4.png",
    combo5: "/static/player_image/object/combo/5.png",
};

const SPRITE_CONFIG = {
    moveLeft: [{ x: 96, y: 0, w: 48, h: 48 }],
    moveRight: [{ x: 0, y: 0, w: 48, h: 48 }],
    dashLeft: [{ x: 0, y: 48, w: 48, h: 48 }],
    dashRight: [{ x: 48, y: 0, w: 48, h: 48 }],
    jumpFull: [{ x: 48, y: 48, w: 48, h: 48 }],
    deathFrame: [
        { x: 0, y: 96, w: 48, h: 48 },
        { x: 48, y: 96, w: 48, h: 48 }
    ],
    idleFrames: [
        { x: 0, y: 0, w: 32, h: 32 },
        { x: 0, y: 32, w: 32, h: 32 },
        { x: 0, y: 64, w: 32, h: 32 },
        { x: 0, y: 96, w: 32, h: 32 }
    ],
    skillFrames: [
        { x: 0, y: 48, w: 48, h: 48 },
        { x: 0, y: 96, w: 48, h: 48 },
        { x: 0, y: 144, w: 48, h: 48 },
        { x: 0, y: 192, w: 48, h: 48 }
    ],
    skillIcons: {
        dash: [{ x: 0, y: 128, w: 256, h: 320 }],
        flush: [{ x: 496, y: 128, w: 256, h: 320 }],
        risk: [{ x: 256, y: 576, w: 256, h: 320 }]
    },
    drops: [
        { x: 0, y: 0, w: 16, h: 16 },
        { x: 16, y: 0, w: 16, h: 16 },
        { x: 0, y: 16, w: 16, h: 16 },
        { x: 16, y: 16, w: 16, h: 16 },
        { x: 0, y: 32, w: 16, h: 16 }
    ],
    platformFrames: {
        normal: { x: 0, y: 8, w: 32, h: 16 },
        arc: [
            { x: 0, y: 32, w: 32, h: 32 },
            { x: 0, y: 64, w: 32, h: 32 },
            { x: 0, y: 96, w: 32, h: 32 }
        ]
    }
};

const DATA_TYPES = {
    clean: {
        label: "Clean Data",
        score: 100,
        buffer: 8,
        sprite: 0,
        color: "#66e28c",
        weight: 30,
        note: "穩定資料，適合吸收。"
    },
    compressed: {
        label: "Compressed Data",
        score: 60,
        buffer: 3,
        sprite: 1,
        color: "#32d6ff",
        weight: 24,
        note: "低壓力，安全累積分數。"
    },
    junk: {
        label: "Junk Data",
        score: 20,
        buffer: 12,
        sprite: 2,
        color: "#91a5b5",
        weight: 18,
        note: "低分高壓，通常適合丟棄。"
    },
    virus: {
        label: "Virus Data",
        score: 180,
        buffer: 18,
        sprite: 3,
        color: "#ff5c7c",
        weight: 12,
        note: "分數不錯，但壓力高。"
    },
    heavy: {
        label: "Heavy Data",
        score: 250,
        buffer: 25,
        sprite: 4,
        color: "#ffd166",
        weight: 10,
        note: "高風險高報酬。"
    },
    key: {   // boss關卡用的
        label: "Key Packet",
        score: 0,
        buffer: 15,
        sprite: 4,
        color: "#8f7cff",
        weight: 4,
        note: "特殊資料，先作為高壓力節奏點。"
    }
};

const keys = {
    left: false,
    right: false,
    jump: false,
    dash: false,
    absorb: false,
    discard: false
};

const justPressed = {
    jump: false,
    dash: false,
    absorb: false,
    discard: false
};

let discardHoldMs = 0;
let discardUsedFlush = false;
let imagesLoaded = false;
const images = {};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const ui = {
    score: document.getElementById("scoreValue"),
    bestScore: document.getElementById("bestScoreValue"),
    leaderboardList: document.getElementById("leaderboardList"),
    handled: document.getElementById("handledValue"),
    absorbed: document.getElementById("absorbValue"),
    discarded: document.getElementById("discardValue"),
    packetName: document.getElementById("packetName"),
    packetMeta: document.getElementById("packetMeta"),
    decisionFill: document.getElementById("decisionFill"),
    gameOverPanel: document.getElementById("gameOverPanel"),
    finalStats: document.getElementById("finalStats"),
    restartButton: document.getElementById("restartButton")
};



let player;
let platforms = [];
let drops = [];
let dropsQueue = [];
let isFetchingDrops = false;
let isFetchingMap = false;
let nextMapData = null;
let flushDropsData = null;
let game;
let currentMapIndex = 0;
let lastTime = 0;
let globalAnimTimer = 0;
let visualAnimMs = 0;
let gameStarted = false;
let gameStarting = false;
let assetsReady = false;
let gameOverRevealTimer = null;
let startAnimMs = 0;
let startLoopStarted = false;
let guideAnimMs = 0;
let currentScene = SCENES.INTRO;
let leaderboardScores = [];
let displayedScore = 0;
let lastLiveLeaderboardScore = null;
let pendingLeaderboardEntry = null;

const startFrames = START_FRAME_ORDER.reduce((acc, frameNumber) => {
    acc[`start${frameNumber}`] = `/static/player_image/start/${frameNumber}.png`;
    return acc;
}, {});


async function fetchNextMap(excludeIndex = -1) {
    if (isFetchingMap) return null;
    isFetchingMap = true;
    try {
        const res = await fetch(`/api/get_next_map?exclude=${excludeIndex}`);
        const data = await res.json();
        return data;
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        isFetchingMap = false;
    }
}

async function fetchDropsQueue() {
    if (isFetchingDrops || !game) return;
    isFetchingDrops = true;
    try {
        const endlessFactor = game.phase === "ENDLESS" ? getEndlessSpawnFactor(game.score) : 1;
        const res = await fetch(`/api/get_drops_queue?phase=${game.phase}&riskLevel=${game.flushRiskLevel}&endlessFactor=${endlessFactor}&elapsedMs=${game.elapsedMs}`);
        const data = await res.json();
        dropsQueue.push(...data);
    } catch (e) {
        console.error(e);
    } finally {
        isFetchingDrops = false;
    }
}

async function fetchFlushDrops() {
    if (!game) return [];
    try {
        const res = await fetch(`/api/get_flush_drops?phase=${game.phase}&riskLevel=${game.flushRiskLevel}`);
        return await res.json();
    } catch (e) {
        console.error(e);
        return [];
    }
}

// 正規化排行榜資料，過濾無效分數並排序
function normalizeLeaderboard(rawScores) {
    if (!Array.isArray(rawScores)) return [];

    return rawScores
        .map((entry) => {
            if (typeof entry === "number") {
                return {
                    score: Math.floor(entry),
                    time: ""
                };
            }

            if (!entry || typeof entry !== "object") return null;

            const numericScore = Number(entry.score);
            if (!Number.isFinite(numericScore) || numericScore < 0) return null;

            return {
                score: Math.floor(numericScore),
                time: typeof entry.time === "string" ? entry.time : ""
            };
        })
        .filter((entry) => entry && Number.isFinite(entry.score) && entry.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, LEADERBOARD_LIMIT);
}

// 從 API 讀取排行榜資料
async function loadLeaderboard() {
    try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        leaderboardScores = normalizeLeaderboard(data);
    } catch {
        leaderboardScores = [];
    }

    renderLeaderboard(game?.running ? game.score : null);
    updateBestScore(game?.score ?? 0);
}

// 將排行榜資料儲存到 API
async function saveLeaderboard(scores = leaderboardScores, keepalive = false) {
    try {
        await fetch('/api/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scores),
            keepalive
        });
        return true;
    } catch {
        return false;
    }
}

function saveLeaderboardOnUnload(scores = leaderboardScores) {
    try {
        const payload = JSON.stringify(scores);
        if (navigator.sendBeacon) {
            return navigator.sendBeacon('/api/leaderboard', new Blob([payload], { type: 'application/json' }));
        }

        fetch('/api/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
        });
        return true;
    } catch {
        return false;
    }
}

// 渲染排行榜介面
function renderLeaderboard(liveScore = null) {
    if (!ui.leaderboardList) return;

    const normalizedLiveScore = Number.isFinite(liveScore) ? Math.max(0, Math.floor(liveScore)) : null;
    const viewScores = normalizedLiveScore === null
        ? leaderboardScores
        : normalizeLeaderboard([
            ...leaderboardScores,
            { score: normalizedLiveScore, time: "LIVE" }
        ]);

    ui.leaderboardList.innerHTML = "";

    for (let i = 0; i < LEADERBOARD_LIMIT; i += 1) {
        const entry = viewScores[i];
        const li = document.createElement("li");
        const rank = `NODE-${String(i + 1).padStart(2, "0")}`;
        if (entry) {
            li.innerHTML = `
                <span class="leader-rank">${rank}</span>
                <strong class="leader-score">${entry.score} PTS</strong>
                <span class="leader-time">${entry.time || "--/--"}</span>
            `;
        } else {
            li.innerHTML = `
                <span class="leader-rank">${rank}</span>
                <strong class="leader-score">--- PTS</strong>
                <span class="leader-time">--/--</span>
            `;
        }
        ui.leaderboardList.appendChild(li);
    }
}

// 更新介面上的最高分數顯示
function updateBestScore(currentScore = 0) {
    if (!ui.bestScore) return;
    const highest = Math.max(currentScore, leaderboardScores[0]?.score ?? 0);
    ui.bestScore.textContent = `${highest} PTS`;
}

// 將新分數註冊並加入排行榜
function createLeaderboardEntry(score) {
    const now = new Date();
    return {
        score: Math.max(0, Math.floor(Number(score) || 0)),
        time: `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`
    };
}

function queueScoreForLeaderboard(score) {
    pendingLeaderboardEntry = createLeaderboardEntry(score);
    renderLeaderboard(pendingLeaderboardEntry.score);
    lastLiveLeaderboardScore = pendingLeaderboardEntry.score;
    updateBestScore(score);
}

async function commitPendingLeaderboard() {
    if (!pendingLeaderboardEntry) return false;

    const nextScores = normalizeLeaderboard([
        ...leaderboardScores,
        pendingLeaderboardEntry
    ]);
    const saved = await saveLeaderboard(nextScores);
    if (!saved) return false;

    leaderboardScores = nextScores;
    pendingLeaderboardEntry = null;
    lastLiveLeaderboardScore = null;
    renderLeaderboard();
    updateBestScore(game?.score ?? 0);
    return true;
}

function commitPendingLeaderboardOnUnload() {
    if (!pendingLeaderboardEntry) return;

    const nextScores = normalizeLeaderboard([
        ...leaderboardScores,
        pendingLeaderboardEntry
    ]);
    if (!saveLeaderboardOnUnload(nextScores)) return;

    leaderboardScores = nextScores;
    pendingLeaderboardEntry = null;
}

// 將分數格式化為固定位數
function formatScoreDigits(score) {
    const numeric = Math.max(0, Math.floor(Number(score) || 0));
    return String(numeric).slice(-SCORE_DIGITS).padStart(SCORE_DIGITS, "0");
}

// 渲染主畫面分數，包含前導零與動畫效果
function renderMainScore(score) {
    if (!ui.score) return;

    const numeric = Math.max(0, Math.floor(Number(score) || 0));
    const digits = formatScoreDigits(numeric);
    const activeCount = numeric === 0 ? 1 : Math.min(SCORE_DIGITS, String(numeric).length);
    const split = SCORE_DIGITS - activeCount;

    ui.score.dataset.ghost = digits.slice(0, split);
    ui.score.textContent = digits.slice(split);
}

// 處理分數增加時的跳動動畫效果
function animateScoreTo(targetScore) {
    const target = Math.max(0, Math.floor(Number(targetScore) || 0));

    if (displayedScore < target) {
        const gap = target - displayedScore;
        const step = Math.max(1, Math.ceil(gap * 0.18));
        displayedScore = Math.min(target, displayedScore + step);
    } else if (displayedScore > target) {
        displayedScore = target;
    }

    return displayedScore;
}

// 初始化並回傳預設的遊戲狀態物件 (保留統計變數供後續 LLM 分析)
function createGameState() {
    return {
        running: true,
        score: 0,
        buffer: 0,
        phase: "NORMAL",
        combo: 0,
        handled: 0,
        absorbed: 0,
        discarded: 0,
        autoAbsorbed: 0,
        flushes: 0,
        pending: null,
        dropSpawnMs: 250,
        flushPauseMs: 0,
        flushCooldownMs: 0,
        flushRiskLevel: 0,
        nextMapSwapScore: MAP_SWAP_SCORE_STEP,
        mapTransition: null,
        elapsedMs: 0,
        history: [],
        typeStats: Object.fromEntries(Object.keys(DATA_TYPES).map((key) => [key, { absorbed: 0, discarded: 0, buffer: 0 }]))
    };
}

// 預先載入所有遊戲需要的圖片資源
function loadImages(onAllLoaded) {
    const entries = [...Object.entries(IMAGE_PATHS), ...Object.entries(startFrames)];
    let complete = 0;

    entries.forEach(([key, src]) => {
        const image = new Image();
        image.onload = done;
        image.onerror = done;
        image.src = src;
        images[key] = image;
    });

    function done() {
        complete += 1;
        if (complete === entries.length) {
            imagesLoaded = true;
            onAllLoaded();
        }
    }
}

// 根據地圖陣列生成平台與危險區域物件
function buildPlatforms(layout) {
    const rows = layout.length;
    const cols = layout[0].length;
    const cellWidth = GAME_WIDTH / cols;
    const cellHeight = GAME_HEIGHT / rows;
    const platformsFromMap = [];

    layout.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (!cell) return;

            platformsFromMap.push({
                id: `cell-${rowIndex}-${colIndex}`,
                x: colIndex * cellWidth,
                y: rowIndex * cellHeight,
                w: cellWidth,
                h: cellHeight,
                type: cell === 2 ? "hazard" : "normal"
            });
        });
    });

    return platformsFromMap;
}

// 選擇初始遊戲地圖
async function chooseInitialMap() {
    const mapData = await fetch(`/api/get_next_map?forceIndex=${INITIAL_MAP_INDEX}`)
        .then((res) => res.json())
        .catch((error) => {
            console.error(error);
            return null;
        });
    return mapData;
}

// 取得平台的唯一識別碼字串
function getPlatformKey(platform) {
    return `${Math.round(platform.x)}-${Math.round(platform.y)}-${Math.round(platform.w)}-${Math.round(platform.h)}-${platform.type}`;
}

// 建立地圖切換特效的過渡狀態
function createMapTransition(nextMapIndex, nextPlatforms) {
    const outgoing = platforms.map((platform) => ({ ...platform }));
    const incoming = nextPlatforms.map((platform) => ({ ...platform }));
    const incomingKeySet = new Set(incoming.map(getPlatformKey));
    const disappearingPlatforms = outgoing.filter((platform) => !incomingKeySet.has(getPlatformKey(platform)));

    return {
        timerMs: 0,
        targetMapIndex: nextMapIndex,
        incomingPlatforms: incoming,
        disappearingPlatforms,
        particles: []
    };
}

// 判斷是否達到分數門檻，若達到則開始地圖切換
function maybeStartMapTransition() {
    if (!game?.running || game.mapTransition || game.score < game.nextMapSwapScore) return;

    if (!isFetchingMap && !nextMapData) {
        fetchNextMap(currentMapIndex).then(data => {
            if (data) nextMapData = data;
        });
        return; // wait for fetch
    }

    if (nextMapData) {
        const choice = nextMapData;
        nextMapData = null; // consume it
        const nextPlatforms = buildPlatforms(choice.map.mapArray);
        if (!nextPlatforms.length) return;

        game.mapTransition = createMapTransition(choice.index, nextPlatforms);

        while (game.score >= game.nextMapSwapScore) {
            game.nextMapSwapScore += MAP_SWAP_SCORE_STEP;
        }
    }
}

// 生成平台崩塌時的粒子特效
function spawnCollapseParticle(platform, particles) {
    const px = randomBetween(platform.x + 2, platform.x + platform.w - 2);
    const py = randomBetween(platform.y + 2, platform.y + platform.h - 2);
    particles.push({
        x: px,
        y: py,
        vx: randomBetween(-1.6, 1.6),
        vy: randomBetween(-2.6, -0.8),
        life: randomBetween(420, 820),
        maxLife: randomBetween(420, 820),
        size: randomBetween(1.5, 3.8),
        color: Math.random() > 0.55 ? "#ff5c7c" : "#ffd166"
    });
}

// 更新地圖切換特效與崩塌動畫
function updateMapTransition(dt) {
    if (!game?.mapTransition) return;

    const transition = game.mapTransition;
    transition.timerMs += dt;

    const step = dt / 16.67;
    const spawnBudget = Math.max(1, Math.floor((dt / 1000) * (transition.disappearingPlatforms.length * 5 + 10)));

    for (let i = 0; i < spawnBudget; i += 1) {
        if (!transition.disappearingPlatforms.length) break;
        const source = transition.disappearingPlatforms[Math.floor(Math.random() * transition.disappearingPlatforms.length)];
        spawnCollapseParticle(source, transition.particles);
    }

    transition.particles.forEach((particle) => {
        particle.vy += 0.18 * step;
        particle.x += particle.vx * step;
        particle.y += particle.vy * step;
        particle.life -= dt;
    });
    transition.particles = transition.particles.filter((particle) => particle.life > 0);

    if (transition.timerMs >= MAP_SWAP_TELEGRAPH_MS) {
        platforms = transition.incomingPlatforms.map((platform) => ({ ...platform }));
        currentMapIndex = transition.targetMapIndex;
        game.mapTransition = null;
    }
}

// 重置整個遊戲，重新初始化變數與角色狀態
async function resetGame() {
    await commitPendingLeaderboard();

    if (gameOverRevealTimer) {
        clearTimeout(gameOverRevealTimer);
        gameOverRevealTimer = null;
    }

    const initialMap = await chooseInitialMap();
    game = createGameState();
    currentMapIndex = initialMap?.index ?? INITIAL_MAP_INDEX;
    player = new Player();
    platforms = initialMap ? buildPlatforms(initialMap.map.mapArray) : [];
    drops = [];
    dropsQueue = [];
    flushDropsData = null;
    nextMapData = null;
    displayedScore = 0;
    discardHoldMs = 0;
    discardUsedFlush = false;
    visualAnimMs = 0;
    ui.gameOverPanel.classList.add("hidden");

    await Promise.all([
        fetchDropsQueue(),
        fetchFlushDrops().then((data) => {
            flushDropsData = data;
        })
    ]);

    updateHud();
    lastTime = performance.now();
}

// 從入口畫面正式開始遊戲
async function startGameFromIntro() {
    if (currentScene !== SCENES.GUIDE || gameStarted || gameStarting || !assetsReady) return;

    gameStarting = true;
    try {
        await resetGame();
        currentScene = SCENES.PLAYING;
        gameStarted = true;
    } finally {
        gameStarting = false;
    }
}

// 處理場景切換（入口畫面 -> 說明畫面 -> 遊戲畫面）
async function advanceSceneFromStart() {
    if (!assetsReady) return;

    // 三段流程：入口畫面 -> 說明頁 -> 主遊戲，按任意鍵時只前進一個階段。
    if (currentScene === SCENES.INTRO) {
        currentScene = SCENES.GUIDE;
        return;
    }

    if (currentScene === SCENES.GUIDE) {
        await startGameFromIntro();
    }
}

// 簡單的 2D 矩形碰撞偵測
function rectsOverlap(a, b) {
    return a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y;
}

// 將數值限制在最大值與最小值之間
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// 取得指定範圍內的隨機浮點數
function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

// 設定 Canvas 的街機風格字型
function setArcadeFont(context, sizePx, weight = 700) {
    context.font = `${weight} ${sizePx}px ${ARCADE_FONT_FAMILY}`;
}

// 根據技能名稱取得在 Sprite Sheet 中的裁切座標與大小
function getSkillSheetCell(contextKey) {
    const sheet = images.skillicon;
    if (!sheet?.complete || !sheet.naturalWidth || !sheet.naturalHeight) return null;

    const cellData = SPRITE_CONFIG.skillIcons[contextKey];
    if (!cellData || cellData.length === 0) return null;

    const frame = cellData[0];

    return {
        image: sheet,
        x: frame.x,
        y: frame.y,
        w: frame.w,
        h: frame.h
    };
}

// 繪製單個技能圖示、冷卻倒數及半透明覆蓋效果
function drawSkillIcon(context, key, x, y, size, cooldownMs, label) {
    const source = getSkillSheetCell(key);
    const ready = cooldownMs <= 0;
    const alpha = ready ? 1 : 0.30;
    const pulse = ready ? 1 : 0.86 + Math.sin(globalAnimTimer / 12) * 0.08;

    context.save();
    context.globalAlpha = alpha * pulse;
    context.shadowColor = ready ? "rgba(124, 255, 215, 0.55)" : "rgba(0, 0, 0, 0)";
    context.shadowBlur = ready ? 10 : 0;

    if (source) {
        context.drawImage(source.image, source.x, source.y, source.w, source.h, x, y, size, size);
    } else {
        context.fillStyle = ready ? "#7cffd7" : "#2b3440";
        context.fillRect(x, y, size, size);
    }

    context.restore();

    context.save();
    context.textAlign = "center";

    // Draw label below
    setArcadeFont(context, 9, 700);
    context.textBaseline = "top";
    context.fillStyle = ready ? "#ecfff7" : "#8795a4";
    context.fillText(label, x + size / 2, y + size + 4);

    // Draw countdown in the middle or READY below
    if (!ready) {
        context.textBaseline = "middle";
        setArcadeFont(context, Math.max(12, size * 0.6), 900);
        context.fillStyle = "#ff5c7c";
        context.shadowColor = "#000";
        context.shadowBlur = 4;
        context.fillText(`${Math.ceil(cooldownMs / 1000)}`, x + size / 2, y + size / 2);
    }
    context.restore();
}

// 繪製右上角的 Dash 與 Flush 技能狀態
function drawTopRightSkillHud(context) {
    const dashCooldown = Math.max(0, player?.dashCooldown ?? 0);
    const flushCooldown = Math.max(0, game?.flushCooldownMs ?? 0);

    drawSkillIcon(context, "dash", GAME_WIDTH - 84, 12, 39, dashCooldown, "DASH");
    drawSkillIcon(context, "flush", GAME_WIDTH - 42, 12, 39, flushCooldown, "FLUSH");
}

// 繪製 BUFFER 下方的危險期 (Risk Stack) 狀態與閃爍效果
function drawRiskStatusHud(context) {
    const activeRisk = Math.max(0, game?.flushRiskLevel ?? 0);
    if (activeRisk <= 0) return;

    const source = getSkillSheetCell("risk");
    const blinkWindow = activeRisk <= 0.5;
    const blink = blinkWindow ? (Math.sin(globalAnimTimer / 9) + 1) / 2 : 1;
    const iconAlpha = blinkWindow ? 0.35 + blink * 0.65 : 1;
    const size = 26;
    const x = 14;
    const y = 52;

    context.save();
    context.globalAlpha = iconAlpha;
    context.shadowColor = blinkWindow ? "rgba(255, 92, 124, 0.55)" : "rgba(255, 92, 124, 0.25)";
    context.shadowBlur = blinkWindow ? 12 : 8;
    if (source) {
        context.drawImage(source.image, source.x, source.y, source.w, source.h, x, y, size, size);
    }
    context.restore();

    const count = Math.max(1, Math.ceil(activeRisk));
    context.save();
    context.fillStyle = "rgba(5, 8, 12, 0.88)";
    context.beginPath();
    context.roundRect(x + size - 8, y + size - 8, 16, 12, 3);
    context.fill();
    context.fillStyle = "#ffb7c5";
    context.strokeStyle = "rgba(255, 92, 124, 0.5)";
    context.lineWidth = 1;
    context.stroke();
    setArcadeFont(context, 9, 900);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(count), x + size, y + size - 2);
    context.restore();
}

// 根據危險期層數計算壞資料出現機率加成
function getRiskBadDataMultiplier() {
    return 1 + (game?.flushRiskLevel ?? 0) * RISK_BAD_DATA_BONUS_PER_STACK;
}

// 根據危險期層數計算掉落物下落速度加成
function getRiskDropSpeedMultiplier() {
    return 1 + (game?.flushRiskLevel ?? 0) * RISK_DROP_SPEED_BONUS_PER_STACK;
}

// 無盡模式掉落頻率計算
function getEndlessSpawnFactor(score) {
    if (score <= ENDLESS_SCORE) return 0.9;
    if (score >= 10000) return 0.5;

    if (score <= 6000) {
        return 0.9 - ((score - ENDLESS_SCORE) / 1000) * 0.1;
    }

    if (score <= 7500) {
        return 0.8 - ((score - 6000) / 1500) * 0.1;
    }

    return 0.7 - ((score - 7500) / 2500) * 0.2;
}

// 根據機率與當前遊戲階段，隨機選擇掉落資料的類型
function chooseDataType(flushDanger = false) {
    const badDataMultiplier = getRiskBadDataMultiplier();
    const entries = Object.entries(DATA_TYPES).map(([key, value]) => {
        let weight = value.weight;

        if (game?.phase === "ENDLESS" && (key === "heavy" || key === "virus" || key === "junk")) {
            weight *= 1.55;
        }

        if (flushDanger) {
            weight = ["junk", "heavy", "virus"].includes(key) ? weight * 4 : Math.max(1, weight * 0.15);
        }

        // 風險期會提高壞資料總產生量，每層 +25%，可由多次開技能疊加。
        if (["junk", "heavy", "virus"].includes(key)) {
            weight *= badDataMultiplier;
        }

        return [key, weight];
    });

    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * total;

    for (const [key, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return key;
    }

    return "clean";
}

// 掉落物類別：處理資料封包的掉落、碰撞與渲染
class DropData {
    constructor(x, y, typeKey = chooseDataType(), options = {}) {
        this.x = x;
        this.y = y;
        this.w = 28;
        this.h = 28;
        this.typeKey = typeKey;
        this.vx = options.vx ?? 0;
        this.vy = options.vy ?? randomBetween(1.2, 2.8);
        this.active = true;
        this.fromFlush = options.fromFlush ?? false;
        this.fromDiscard = options.fromDiscard ?? false;
        this.canCollide = options.canCollide ?? true;
        this.noGravityMs = Math.max(0, options.noGravityMs ?? 0);
        this.spin = Math.random() * Math.PI * 2;
    }

    update(step, speedScale = 1) {
        if (!this.active) return;

        const scaledStep = step * speedScale;

        if (this.noGravityMs > 0) {
            this.noGravityMs = Math.max(0, this.noGravityMs - step * 16.67);
        } else if (this.fromFlush || this.fromDiscard) {
            this.vy += 0.24 * scaledStep;
            this.vx *= Math.pow(0.992, scaledStep);
        }

        this.x += this.vx * scaledStep;
        this.y += this.vy * scaledStep;
        this.spin += 0.08 * scaledStep;

        if (this.x < -40 || this.x > GAME_WIDTH + 40 || this.y > GAME_HEIGHT + 48) {
            this.active = false;
        }
    }

    draw(context) {
        if (!this.active) return;
        const data = DATA_TYPES[this.typeKey];
        drawDropIcon(context, data.sprite, this.x, this.y, this.w, this.h);

        if (this.fromFlush || this.fromDiscard) {
            context.save();
            context.globalAlpha = 0.35;
            context.strokeStyle = data.color;
            context.lineWidth = 2;
            context.beginPath();
            context.arc(this.x + this.w / 2, this.y + this.h / 2, 18 + Math.sin(this.spin) * 2, 0, Math.PI * 2);
            context.stroke();
            context.restore();
        }
    }
}

// 玩家類別：負責玩家的移動、跳躍、衝刺與動畫狀態更新
class Player {
    constructor() {
        this.x = 96; //玩家重生點位置
        this.y = 320; //玩家重生點位置
        this.prevY = this.y;
        this.w = 32;
        this.h = 36;
        this.vx = 0;
        this.vy = 0;
        this.facingRight = true;
        this.grounded = false;
        this.state = "idle";
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.invincible = false;
        this.damageInvincibleMs = 0;
        this.animTimer = 0;
        this.animFrame = 0;
        this.idleFrameMs = 0;
        this.dead = false;
        this.deathFrameIndex = 0;
        this.deathTimer = null;
    }

    update(dt) {
        if (this.dead) return;

        const step = dt / 16.67;
        const speed = 4.1;
        const gravity = 0.55;
        const jumpForce = -10.8;

        this.prevY = this.y;
        this.dashCooldown = Math.max(0, this.dashCooldown - dt);
        this.damageInvincibleMs = Math.max(0, this.damageInvincibleMs - dt);
        this.invincible = this.damageInvincibleMs > 0;

        if (this.dashTimer > 0) {
            this.dashTimer -= dt;
            this.invincible = true;
            this.state = "dash";
            this.vx = this.facingRight ? 10.5 : -10.5;
        } else {
            if (keys.left) {
                this.vx = -speed;
                this.facingRight = false;
                this.state = this.grounded ? "move" : "jump";
            } else if (keys.right) {
                this.vx = speed;
                this.facingRight = true;
                this.state = this.grounded ? "move" : "jump";
            } else {
                this.vx *= Math.pow(0.78, step);
                if (Math.abs(this.vx) < 0.06) this.vx = 0;
                this.state = this.grounded ? "idle" : "jump";
            }

            if (justPressed.jump && this.grounded) {
                this.vy = jumpForce;
                this.grounded = false;
                this.state = "jump";
            }

            // 大跳小跳機制：如果在上升期間放開跳躍鍵，將向上的速度截斷
            if (!keys.jump && this.vy < -3.5) {
                this.vy = -3.5;
            }

            if (justPressed.dash && this.dashCooldown <= 0) {
                this.dashTimer = 160;
                this.dashCooldown = DASH_COOLDOWN_MS;
                this.invincible = true;
                this.state = "dash";
            }
        }

        this.vy += gravity * step;
        this.x += this.vx * step;
        this.y += this.vy * step;

        this.x = clamp(this.x, 0, GAME_WIDTH - this.w);

        if (this.state === "idle") {
            this.idleFrameMs += dt;
            if (this.idleFrameMs >= IDLE_FRAME_INTERVAL_MS) {
                this.idleFrameMs = 0;
                this.animFrame = (this.animFrame + 1) % SPRITE_CONFIG.idleFrames.length;
            }
        } else {
            this.idleFrameMs = 0;
            this.animFrame = 0;
        }
    }

    setRespawnInvincible() {
        this.damageInvincibleMs = RESPAWN_INVINCIBLE_MS;
    }

    triggerDeath() {
        if (this.dead) return;

        this.dead = true;
        this.state = "death";
        this.vx = 0;
        this.vy = 0;
        this.deathFrameIndex = 0;

        if (this.deathTimer) {
            clearTimeout(this.deathTimer);
        }

        this.deathTimer = setTimeout(() => {
            this.deathFrameIndex = 1;
        }, DEATH_FRAME_SWITCH_MS);
    }

    draw(context) {
        let frames = SPRITE_CONFIG.idleFrames;
        let image = images.idleWaiting;
        let frameIndex = this.animFrame;

        if (this.dead || this.state === "death") {
            frames = SPRITE_CONFIG.deathFrame;
            image = images.idleAction;
        } else if (game.flushPauseMs > 0) {
            frames = SPRITE_CONFIG.skillFrames;
            image = images.useSkill;
        } else if (this.state === "move") {
            frames = this.facingRight ? SPRITE_CONFIG.moveRight : SPRITE_CONFIG.moveLeft;
            image = images.idleAction;
        } else if (this.state === "dash") {
            frames = this.facingRight ? SPRITE_CONFIG.dashRight : SPRITE_CONFIG.dashLeft;
            image = images.idleAction;
        } else if (this.state === "jump") {
            frames = SPRITE_CONFIG.jumpFull;
            image = images.idleAction;
        }

        if (this.dead) {
            frameIndex = Math.min(this.deathFrameIndex, frames.length - 1);
        } else if (game.flushPauseMs > 0) {
            frameIndex = Math.floor(visualAnimMs / SKILL_FRAME_INTERVAL_MS) % frames.length;
        }

        const frame = frames[frameIndex] || frames[0];
        const drawW = frame.w * 1.55;
        const drawH = frame.h * 1.55;

        context.save();
        if (this.damageInvincibleMs > 0) {
            context.globalAlpha = 0.42 + (Math.floor(visualAnimMs / 90) % 2) * 0.38;
            context.shadowColor = "#32d6ff";
            context.shadowBlur = 18;
        } else if (this.invincible) {
            context.globalAlpha = 0.82;
            context.shadowColor = "#32d6ff";
            context.shadowBlur = 18;
        }
        context.translate(this.x + this.w / 2, this.y + this.h / 2);
        context.drawImage(image, frame.x, frame.y, frame.w, frame.h, -drawW / 2, -drawH / 2, drawW, drawH);
        context.restore();

        if (game.pending && !this.dead) {
            const data = DATA_TYPES[game.pending.typeKey];
            drawDropIcon(context, data.sprite, this.x + this.w / 2 - 14, this.y - 34, 28, 28);
        }
    }
}

// 繪製掉落物的圖示
function drawDropIcon(context, spriteIndex, x, y, w, h) {
    const source = SPRITE_CONFIG.drops[spriteIndex] || SPRITE_CONFIG.drops[0];
    if (imagesLoaded && images.dropData?.complete) {
        context.drawImage(images.dropData, source.x, source.y, source.w, source.h, x, y, w, h);
        return;
    }

    context.fillStyle = "#32d6ff";
    context.fillRect(x, y, w, h);
}

// 在畫面上方從後端佇列取出一個新的掉落物
function spawnDrop() {
    if (dropsQueue.length === 0) return;

    const dropData = dropsQueue.shift();
    drops.push(new DropData(dropData.x, -36, dropData.type, { vy: dropData.vy }));

    // 將下一次掉落的時間設定為後端決定的 timeToNext
    game.dropSpawnMs = dropData.timeToNext;

    // 當剩餘少於 15 筆時，提前向後端要下一批
    if (dropsQueue.length < 15) {
        fetchDropsQueue();
    }
}

// 當執行 Flush 時，從玩家身上噴出多個危險資料
function spawnFlushWave(dropList = flushDropsData) {
    const dropsToSpawn = Array.isArray(dropList) ? dropList : [];
    const startX = player.x + player.w / 2;

    dropsToSpawn.forEach(d => {
        drops.push(new DropData(startX, player.y - 10, d.type, {
            fromFlush: true,
            canCollide: false,
            vx: d.vx,
            vy: d.vy,
            noGravityMs: 300
        }));
    });

    return dropsToSpawn.length;
}

// 將目前手中的資料往反方向丟棄
function throwPendingDrop(typeKey) {
    const direction = player.facingRight ? 1 : -1;
    const startX = player.x + player.w / 2 - 14;
    const startY = player.y + 6;

    drops.push(new DropData(
        startX,
        startY,
        typeKey,
        {
            vx: direction * randomBetween(4.4, 5.8),
            vy: randomBetween(-8.8, -6.2),
            fromDiscard: true,
            canCollide: false
        }
    ));
}

// 玩家接觸到資料時，將其暫存到處理區
function catchDrop(typeKey) {
    if (game.pending) {
        absorbPending("auto-next");
    }

    game.pending = {
        typeKey,
        elapsedMs: 0
    };

    recordEvent("catch", typeKey);
}

// 吸收處理區中的資料，增加分數與 BUFFER
function absorbPending(reason = "manual") {
    if (!game.pending) return;

    const typeKey = game.pending.typeKey;
    const data = DATA_TYPES[typeKey];

    const oldCombo = game.combo || 0;
    game.combo = oldCombo + 1;
    if (oldCombo < 2 && game.combo >= 2) {
        game.comboAppearMs = visualAnimMs;
    }

    const multiplier = 1 + 0.1 * game.combo;
    const finalScore = Math.round(data.score * multiplier);

    game.score += finalScore;
    game.buffer = clamp(game.buffer + data.buffer, 0, 100);
    game.absorbed += 1;
    game.handled += 1;
    game.typeStats[typeKey].absorbed += 1;
    game.typeStats[typeKey].buffer += data.buffer;

    if (reason.startsWith("auto")) {
        game.autoAbsorbed += 1;
    }

    recordEvent(reason === "manual" ? "absorb" : reason, typeKey);
    game.pending = null;

    if (game.score >= ENDLESS_SCORE && game.phase === "NORMAL") {
        enterEndless();
    }

    maybeStartMapTransition();

    if (game.buffer >= 100) {
        endGame();
    }
}

// 丟棄處理區中的資料
function discardPending() {
    if (!game.pending) return;

    const typeKey = game.pending.typeKey;
    throwPendingDrop(typeKey);
    game.combo = 0;
    game.discarded += 1;
    game.handled += 1;
    game.typeStats[typeKey].discarded += 1;
    recordEvent("discard", typeKey);
    game.pending = null;
}

// 玩家掉出邊界或碰到危險區域後的重生處理
function respawnAfterFall(applyBufferPenalty = true) {
    if (applyBufferPenalty) {
        game.buffer = clamp(game.buffer + 20, 0, 100);
    }
    game.combo = 0;

    if (game.buffer >= 100) {
        endGame();
        return;
    }

    player.x = 96;
    player.y = 320;
    player.prevY = player.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    player.state = "jump";
    player.dashTimer = 0;
    player.dashCooldown = Math.max(player.dashCooldown, 180);
    player.setRespawnInvincible();
    recordEvent("fall-respawn");
}

// 觸發 Flush 技能，降低 BUFFER 並產生危險資料
function triggerFlush() {
    if (game.buffer <= 0 || !game.running) return;

    const before = game.buffer;
    game.buffer = clamp(game.buffer - FLUSH_BUFFER_REDUCE, 0, 100);
    game.flushes += 1;
    game.flushPauseMs = FLUSH_PAUSE_MS;
    game.flushCooldownMs = FLUSH_COOLDOWN_MS;
    game.flushRiskLevel += 1;
    const spawned = spawnFlushWave();

    if (spawned === 0) {
        fetchFlushDrops().then((data) => {
            flushDropsData = data;
            if (game?.running && game.flushPauseMs > 0) {
                spawnFlushWave(data);
            }
        });
    }

    fetchFlushDrops().then((data) => {
        flushDropsData = data;
    });
    recordEvent("flush", null, { before, after: game.buffer });
}

// 進入無盡模式（難度大幅提升）
function enterEndless() {
    game.phase = "ENDLESS";
    game.buffer = Math.floor(game.buffer * 0.35);
    recordEvent("enter-endless");
}

// 結束遊戲，觸發死亡動畫與結算畫面
function endGame() {
    if (!game.running) return;

    game.running = false;
    game.pending = null;
    player.triggerDeath();
    queueScoreForLeaderboard(game.score);

    // 將紀錄送到後端 API
    fetch('/api/log_event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            score: game.score,
            handled: game.handled,
            absorbed: game.absorbed,
            discarded: game.discarded,
            autoAbsorbed: game.autoAbsorbed,
            flushes: game.flushes,
            history: game.history,
            typeStats: game.typeStats
        })
    }).catch(err => console.error("Log error", err));

    if (gameOverRevealTimer) {
        clearTimeout(gameOverRevealTimer);
    }

    gameOverRevealTimer = setTimeout(() => {
        const typeBreakdown = Object.entries(game.typeStats)
            .filter(([_, stats]) => stats.absorbed > 0 || stats.discarded > 0)
            .map(([type, stats]) => `${DATA_TYPES[type].label}: 收${stats.absorbed}/棄${stats.discarded}`)
            .join('｜');

        ui.finalStats.innerHTML = `分數 <strong>${game.score}</strong><br>處理 <strong>${game.handled}</strong> 筆 (自動吸收 ${game.autoAbsorbed})<br>Flush <strong>${game.flushes}</strong> 次<br><br><span style="font-size: 0.8em; color: var(--muted);">${typeBreakdown}</span>`;
        ui.gameOverPanel.classList.remove("hidden");
    }, DEATH_FRAME_SWITCH_MS * 2);
}

// 記錄遊戲事件，用於統計或除錯 (為後續 LLM 整合預留)
function recordEvent(action, typeKey = null, extra = {}) {
    game.history.push({
        at: Math.round(game.elapsedMs),
        action,
        type: typeKey,
        buffer: game.buffer,
        score: game.score,
        ...extra
    });

    if (game.history.length > 120) {
        game.history.shift();
    }
}

// 更新手中資料的決策倒數，超時會自動吸收
function updateDecision(dt) {
    if (!game.pending) return;

    game.pending.elapsedMs += dt;
    if (game.pending.elapsedMs >= DECISION_TIME_MS) {
        absorbPending("auto-timeout");
    }
}

// 處理玩家的按鍵輸入（丟棄、吸收、Flush等）
function updateInput(dt) {
    if (keys.discard) {
        discardHoldMs += dt;
        if (!discardUsedFlush && discardHoldMs >= FLUSH_HOLD_MS) {
            discardUsedFlush = true;
            if (game.flushCooldownMs <= 0) {
                triggerFlush();
            }
        }
    }

    if (justPressed.absorb) {
        absorbPending("manual");
    }

    if (justPressed.discard) {
        discardPending();
    }
}

// 更新所有掉落物的位置與碰撞判定
function updateDrops(dt) {
    const step = dt / 16.67;
    const riskSpeedMultiplier = getRiskDropSpeedMultiplier();

    game.dropSpawnMs -= dt;
    if (game.dropSpawnMs <= 0) {
        spawnDrop();
        if (dropsQueue.length === 0) {
            game.dropSpawnMs = 500; // Fallback if API fails or queue is empty
        }
    }

    drops.forEach((drop) => {
        drop.update(step, riskSpeedMultiplier);

        if (!drop.active) return;

        if (!drop.canCollide) return;

        if (player.invincible && rectsOverlap(player, drop)) {
            return;
        }

        if (rectsOverlap(player, drop)) {
            catchDrop(drop.typeKey);
            drop.active = false;
        }
    });

    drops = drops.filter((drop) => drop.active);
}

// 處理 Flush 執行期間的遊戲暫停與特效更新
function updateFlushPause(dt) {
    if (game.flushPauseMs <= 0) return;

    game.flushPauseMs = Math.max(0, game.flushPauseMs - dt);
    const step = dt / 16.67;
    const riskSpeedMultiplier = getRiskDropSpeedMultiplier();
    drops.forEach((drop) => {
        if (drop.fromFlush && drop.active) {
            drop.update(step, riskSpeedMultiplier);
        }
    });
    drops = drops.filter((drop) => drop.active);
}

// 處理玩家與平台間的物理碰撞與著陸
function resolvePlayerPlatforms() {
    player.grounded = false;
    let touchedHazardTile = false;

    platforms.forEach((p) => {
        if (p.type === "hazard") {
            if (rectsOverlap(player, p)) {
                touchedHazardTile = true;
            }
            return;
        }

        const wasAbove = player.prevY + player.h <= p.y + 8;
        const crossingTop = player.y + player.h >= p.y && player.vy >= 0;
        const overlapsX = player.x < p.x + p.w && player.x + player.w > p.x;

        if (wasAbove && crossingTop && overlapsX) {
            player.y = p.y - player.h + 8;
            player.vy = 0;
            player.grounded = true;
        }
    });

    if (touchedHazardTile && !player.invincible) {
        respawnAfterFall();
        return;
    }

    if (player.y + player.h >= TRASH_ZONE.y + 5) {
        if (player.invincible) {
            respawnAfterFall(false);
            return;
        }
        respawnAfterFall();
    }
}

// 更新遊戲畫面的所有文字、數字與 HUD 狀態
function updateHud() {
    const animatedScore = animateScoreTo(game.score);
    renderMainScore(animatedScore);
    updateBestScore(game.score);

    if (lastLiveLeaderboardScore !== game.score) {
        renderLeaderboard(game.score);
        lastLiveLeaderboardScore = game.score;
    }

    ui.handled.textContent = game.handled.toString();
    ui.absorbed.textContent = game.absorbed.toString();
    ui.discarded.textContent = game.discarded.toString();

    if (game.pending) {
        const data = DATA_TYPES[game.pending.typeKey];
        const remaining = clamp(DECISION_TIME_MS - game.pending.elapsedMs, 0, DECISION_TIME_MS);
        ui.packetName.textContent = data.label;
        ui.packetName.style.color = data.color;
        ui.packetMeta.textContent = `分數 +${data.score}｜Buffer +${data.buffer}%｜${(remaining / 1000).toFixed(1)} 秒內決策。${data.note}`;
        ui.decisionFill.style.width = `${(remaining / DECISION_TIME_MS) * 100}%`;
    } else {
        ui.packetName.textContent = "無";
        ui.packetName.style.color = "#ffd166";
        ui.packetMeta.textContent = "接到資料後 1.5 秒內按 J 吸收或 K 丟棄。";
        ui.decisionFill.style.width = "0%";
    }
}

// 繪製遊戲背景與動態網格
function drawBackground(context) {
    const gradient = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, "#12202b");
    gradient.addColorStop(0.55, "#0d1720");
    gradient.addColorStop(1, "#071018");
    context.fillStyle = gradient;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    context.save();
    context.globalAlpha = 0.18;
    context.strokeStyle = "#32d6ff";
    context.lineWidth = 1;
    for (let x = 0; x <= GAME_WIDTH; x += 32) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, GAME_HEIGHT);
        context.stroke();
    }
    for (let y = 0; y <= GAME_HEIGHT; y += 32) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(GAME_WIDTH, y);
        context.stroke();
    }
    context.restore();

    context.save();
    context.globalAlpha = 0.45;
    for (let i = 0; i < 18; i += 1) {
        const x = (i * 47 + globalAnimTimer * (0.2 + (i % 3) * 0.05)) % GAME_WIDTH;
        context.fillStyle = i % 2 ? "#66e28c" : "#32d6ff";
        context.fillRect(x, 24 + (i * 29) % 360, 2, 18 + (i % 4) * 8);
    }
    context.restore();
}

// 繪製畫面最下方的垃圾區域警告線
function drawTrashZone(context) {
    context.save();
    context.fillStyle = "#ff5c7c";
    setArcadeFont(context, 11);
    context.fillText("TRASH / OVERLOAD ZONE", 14, TRASH_ZONE.y + 21);
    context.restore();
}

// 繪製單一平台或危險區域
function drawPlatform(context, platform) {
    const isHazard = platform.type === "hazard";
    const sprite = isHazard
        ? SPRITE_CONFIG.platformFrames.arc[Math.floor((globalAnimTimer / 10) % SPRITE_CONFIG.platformFrames.arc.length)]
        : SPRITE_CONFIG.platformFrames.normal;

    context.drawImage(images.platform, sprite.x, sprite.y, sprite.w, sprite.h, platform.x, platform.y, platform.w, platform.h);

    context.save();
    if (isHazard) {
        context.fillStyle = "rgba(255, 92, 124, 0.2)";
        context.fillRect(platform.x, platform.y, platform.w, platform.h);
        context.strokeStyle = "#ff5c7c";
        context.lineWidth = 2;
        context.strokeRect(platform.x + 1, platform.y + 1, Math.max(0, platform.w - 2), Math.max(0, platform.h - 2));
    }
    context.restore();
}

// 繪製地圖切換時的崩塌粒子與新地圖淡入效果
function drawMapTransition(context) {
    if (!game?.mapTransition) return;

    const transition = game.mapTransition;
    const progress = clamp(transition.timerMs / MAP_SWAP_TELEGRAPH_MS, 0, 1);
    const jitterStrength = 1 + progress * 3.2;

    context.save();
    transition.disappearingPlatforms.forEach((platform, index) => {
        const jitterX = Math.sin((visualAnimMs + index * 17) / 36) * jitterStrength;
        const jitterY = Math.cos((visualAnimMs + index * 11) / 44) * jitterStrength * 0.55;

        context.globalAlpha = 0.42 + Math.sin((visualAnimMs + index * 20) / 120) * 0.15;
        context.fillStyle = "rgba(255, 92, 124, 0.24)";
        context.fillRect(platform.x + jitterX, platform.y + jitterY, platform.w, platform.h);
        context.strokeStyle = "rgba(255, 92, 124, 0.9)";
        context.lineWidth = 1.8;
        context.strokeRect(platform.x + jitterX + 1, platform.y + jitterY + 1, Math.max(0, platform.w - 2), Math.max(0, platform.h - 2));
    });
    context.restore();

    context.save();
    context.globalAlpha = 0.12 + progress * 0.25;
    transition.incomingPlatforms.forEach((platform) => {
        drawPlatform(context, platform);
    });
    context.restore();

    context.save();
    transition.particles.forEach((particle) => {
        const alpha = clamp(particle.life / particle.maxLife, 0, 1);
        context.globalAlpha = alpha;
        context.fillStyle = particle.color;
        context.fillRect(particle.x, particle.y, particle.size, particle.size);
    });
    context.restore();
}

// 繪製玩家手中資料的決策倒數脈衝波紋
function drawPendingPulse(context) {
    if (!game.pending || player?.dead) return;

    const data = DATA_TYPES[game.pending.typeKey];
    const remaining = clamp(DECISION_TIME_MS - game.pending.elapsedMs, 0, DECISION_TIME_MS);
    const pulse = 0.55 + Math.sin(globalAnimTimer * 0.25) * 0.15;

    context.save();
    context.globalAlpha = pulse;
    context.strokeStyle = data.color;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(player.x + player.w / 2, player.y + 8, 27 + (1 - remaining / DECISION_TIME_MS) * 12, 0, Math.PI * 2);
    context.stroke();
    context.restore();
}

// 繪製玩家死亡時的暗色漸層遮罩
function drawDeathOverlay(context) {
    if (!player?.dead) return;

    const centerX = player.x + player.w / 2;
    const centerY = player.y + player.h / 2;
    const gradient = context.createRadialGradient(centerX, centerY, 34, centerX, centerY, 220);

    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(0.42, "rgba(0, 0, 0, 0.18)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.72)");

    context.save();
    context.fillStyle = gradient;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    context.restore();
}

// 繪製執行 Flush 時的紅色閃爍警告遮罩
function drawFlushOverlay(context) {
    if (game.flushPauseMs <= 0) return;

    const pulse = 0.4 + Math.sin(globalAnimTimer * 0.24) * 0.2;
    context.save();
    context.fillStyle = `rgba(255, 92, 124, ${0.1 + pulse * 0.18})`;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    context.fillStyle = "#ffd166";
    setArcadeFont(context, 18);
    context.fillText("FLUSH EXECUTING...", 18, 105);
    context.restore();
}

// 根據 BUFFER 壓力計算顏色狀態（安全/警告/危險）
function getBufferStateColor(buffer) {
    if (buffer >= 82) return { fill: "#ff5c7c", glow: "rgba(255, 92, 124, 0.55)", accent: "#9b1d41" };
    if (buffer >= 55) return { fill: "#ffd166", glow: "rgba(255, 209, 102, 0.42)", accent: "#ff9f1c" };
    return { fill: "#66e28c", glow: "rgba(102, 226, 140, 0.42)", accent: "#32d6ff" };
}

// 繪製左上角的 BUFFER 容量條與刻度
function drawBufferHud(context) {
    const buffer = Math.round(clamp(game.buffer, 0, 100));
    const colors = getBufferStateColor(buffer);
    const x = 14;
    const y = 14;
    const width = 188;
    const height = 30;
    const innerPadding = 4;
    const barX = x + innerPadding;
    const barY = y + 15;
    const barWidth = width - innerPadding * 2;
    const barHeight = 10;
    const segmentCount = 18;
    const segmentGap = 2;
    const segmentWidth = Math.floor((barWidth - (segmentCount - 1) * segmentGap) / segmentCount);
    const progress = buffer / 100;
    const filledExact = progress * segmentCount;

    context.save();
    context.imageSmoothingEnabled = false;

    context.fillStyle = "rgba(0, 0, 0, 0.82)";
    context.fillRect(x, y, width, height);
    context.fillStyle = "rgba(255, 255, 255, 0.04)";
    context.fillRect(x + 1, y + 1, width - 2, 3);
    context.lineWidth = 2;
    context.strokeRect(x + 1, y + 1, width - 2, height - 2);

    context.fillStyle = colors.accent;
    context.fillRect(x + 3, y + 3, width - 6, 2);

    context.fillStyle = "#091016";
    context.fillRect(barX, barY, barWidth, barHeight);

    for (let i = 0; i < segmentCount; i += 1) {
        const segmentX = barX + i * (segmentWidth + segmentGap);
        const segmentFill = clamp(filledExact - i, 0, 1);

        context.fillStyle = "rgba(255, 255, 255, 0.04)";
        context.fillRect(segmentX, barY, segmentWidth, barHeight);
        context.strokeStyle = "rgba(237, 247, 255, 0.75)";
        context.lineWidth = 1;
        context.strokeRect(segmentX + 0.5, barY + 0.5, Math.max(0, segmentWidth - 1), Math.max(0, barHeight - 1));

        if (segmentFill > 0) {
            context.fillStyle = colors.fill;
            context.fillRect(segmentX, barY, Math.max(1, Math.round(segmentWidth * segmentFill)), barHeight);
        }
    }

    context.fillStyle = colors.glow;
    context.fillRect(barX, barY, Math.max(0, Math.round(barWidth * progress)), 1);

    context.fillStyle = "#edf7ff";
    setArcadeFont(context, 12);
    context.fillText("BUFFER", x + 6, y + 12);

    context.fillStyle = buffer >= 82 ? "#ff5c7c" : buffer >= 55 ? "#ffd166" : "#edf7ff";
    context.fillText(`${buffer}%`, x + width - 36, y + 12);

    context.restore();
}

// 遊戲主要繪製迴圈：呼叫所有渲染函式
function drawGame() {
    drawBackground(ctx);
    platforms.forEach((platform) => drawPlatform(ctx, platform));
    drawMapTransition(ctx);
    drops.forEach((drop) => drop.draw(ctx));
    drawTrashZone(ctx);
    drawPendingPulse(ctx);
    drawDeathOverlay(ctx);
    player.draw(ctx);
    drawFlushOverlay(ctx);
    drawBufferHud(ctx);
    drawTopRightSkillHud(ctx);
    drawRiskStatusHud(ctx);
    drawCombo(ctx);
}

// 繪製 Combo 狀態與動畫
function drawCombo(context) {
    const combo = game?.combo || 0;
    if (combo < 2) return;

    const frameIndex = Math.floor(visualAnimMs / 200) % 5 + 1;
    const img = images[`combo${frameIndex}`];

    const appearTime = visualAnimMs - (game.comboAppearMs || 0);
    const progress = Math.min(1, appearTime / 250);
    const easeOut = 1 - Math.pow(1 - progress, 3);

    const targetX = GAME_WIDTH - 120;
    const startX = GAME_WIDTH + 150;
    const x = startX - (startX - targetX) * easeOut;
    const y = GAME_HEIGHT / 2 + 30;

    context.save();

    if (img && img.complete) {
        context.drawImage(img, x, y, 120, 120);
    }

    const gradient = context.createLinearGradient(0, y + 20, 0, y + 100);
    gradient.addColorStop(0, "#fce12fff");
    gradient.addColorStop(1, "#ff6b00");

    context.fillStyle = gradient;
    context.shadowColor = "rgba(255, 107, 0, 0.6)";
    context.shadowBlur = 12;
    context.font = `italic 900 42px ${ARCADE_FONT_FAMILY}`;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(`x${combo}`, x + 25, y + 85);

    context.restore();
}

// 繪製遊戲開場入口畫面
function drawStartScreen(context) {
    const frameIndex = Math.floor(startAnimMs / START_FRAME_INTERVAL_MS) % START_FRAME_ORDER.length;
    const frameNumber = START_FRAME_ORDER[frameIndex];
    const frameImage = images[`start${frameNumber}`];

    context.save();
    context.fillStyle = "#05080d";
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (frameImage?.complete && frameImage.naturalWidth > 0) {
        context.drawImage(frameImage, 0, 0, GAME_WIDTH, GAME_HEIGHT);
    } else {
        const gradient = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        gradient.addColorStop(0, "#0b1520");
        gradient.addColorStop(1, "#05080d");
        context.fillStyle = gradient;
        context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    const blinkAlpha = 0.25 + (Math.sin(startAnimMs / 360) + 1) * 0.35;
    context.fillStyle = `rgba(255, 255, 255, ${blinkAlpha.toFixed(3)})`;
    setArcadeFont(context, 16, 700);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("PRESS ANY BUTTON TO START", GAME_WIDTH / 2, GAME_HEIGHT - 40);
    context.restore();
}

// 繪製遊戲操作說明畫面
function drawGuideScreen(context) {
    context.save();
    const t = guideAnimMs;

    const base = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    base.addColorStop(0, "#060b12");
    base.addColorStop(0.55, "#0b1420");
    base.addColorStop(1, "#090d15");
    context.fillStyle = base;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Glitch 背景動畫：用掃描條與抖動條塊建立故障感，不使用入口圖片。
    for (let y = 0; y < GAME_HEIGHT; y += 3) {
        const alpha = 0.025 + (Math.sin((y * 0.19) + t * 0.018) + 1) * 0.018;
        context.fillStyle = `rgba(80, 196, 255, ${alpha.toFixed(3)})`;
        context.fillRect(0, y, GAME_WIDTH, 1);
    }

    for (let i = 0; i < 13; i += 1) {
        const barY = (i * 39 + t * (0.06 + i * 0.004)) % GAME_HEIGHT;
        const shift = Math.sin(t * 0.02 + i * 1.7) * (8 + (i % 3) * 6);
        const w = 120 + (i * 23) % 280;
        const x = ((i * 53) % (GAME_WIDTH + 140)) - 70 + shift;
        context.fillStyle = i % 2 ? "rgba(255, 92, 124, 0.16)" : "rgba(50, 214, 255, 0.16)";
        context.fillRect(x, barY, w, 6 + (i % 3));
    }

    context.fillStyle = "rgba(6, 11, 18, 0.60)";
    context.fillRect(44, 68, GAME_WIDTH - 88, GAME_HEIGHT - 144);
    context.strokeStyle = "rgba(50, 214, 255, 0.72)";
    context.lineWidth = 2;
    context.strokeRect(44, 68, GAME_WIDTH - 88, GAME_HEIGHT - 144);

    context.fillStyle = "#32d6ff";
    setArcadeFont(context, 20, 700);
    context.textAlign = "left";
    context.fillText("MISSION GUIDE", 64, 102);

    context.fillStyle = "#edf7ff";
    setArcadeFont(context, 15, 700);
    context.fillText("MOVE: A / D or LEFT / RIGHT", 64, 148);
    context.fillText("JUMP: SPACE", 64, 180);
    context.fillText("DASH: SHIFT", 64, 212);
    context.fillText("DECISION DATA: J absorb, K discard", 64, 244);
    context.fillText("HOLD K for FLUSH (reduce buffer)", 64, 276);
    context.fillText("FALL TO TRASH ZONE: BUFFER + 20%", 64, 308);
    context.fillText("GAMEOVER: BUFFER reaches 100%", 64, 340);

    const blinkAlpha = 0.3 + (Math.sin(t / 360) + 1) * 0.3;
    context.fillStyle = `rgba(255, 255, 255, ${blinkAlpha.toFixed(3)})`;
    setArcadeFont(context, 14, 700);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("PRESS ANY BUTTON TO START", GAME_WIDTH / 2, GAME_HEIGHT - 40);
    context.restore();
}

// 遊戲主要更新與渲染迴圈 (使用 requestAnimationFrame)
function gameLoop(time) {
    const dt = Math.min(34, time - lastTime || 16.67);
    lastTime = time;
    visualAnimMs += dt;
    globalAnimTimer += 1;

    if (currentScene === SCENES.INTRO) {
        startAnimMs += dt;
        drawStartScreen(ctx);
        requestAnimationFrame(gameLoop);
        return;
    }

    if (currentScene === SCENES.GUIDE) {
        guideAnimMs += dt;
        drawGuideScreen(ctx);
        requestAnimationFrame(gameLoop);
        return;
    }
    // 更新遊戲邏輯
    if (game?.running) {
        game.elapsedMs += dt;
        game.flushCooldownMs = Math.max(0, game.flushCooldownMs - dt);
        updateMapTransition(dt);
        if (game.flushPauseMs > 0) {
            updateFlushPause(dt);
        } else {
            game.flushRiskLevel = Math.max(0, game.flushRiskLevel - dt / RISK_DECAY_MS);//當危險期時，風險值開始遞減
            updateInput(dt);
            updateDecision(dt);
            player.update(dt);
            resolvePlayerPlatforms();
            updateDrops(dt);
        }
    }

    drawGame();
    updateHud();

    Object.keys(justPressed).forEach((key) => {
        justPressed[key] = false;
    });

    requestAnimationFrame(gameLoop);
}

// 將鍵盤事件映射到遊戲內的按鍵狀態
function setKey(code, pressed, browserEvent) {
    if (["Space", "ArrowLeft", "ArrowRight"].includes(code)) {
        browserEvent.preventDefault();
    }

    if (code === "KeyA" || code === "ArrowLeft") keys.left = pressed;
    if (code === "KeyD" || code === "ArrowRight") keys.right = pressed;

    if (code === "Space") {
        if (pressed && !keys.jump) justPressed.jump = true;
        keys.jump = pressed;
    }

    if (code === "ShiftLeft" || code === "ShiftRight") {
        if (pressed && !keys.dash) justPressed.dash = true;
        keys.dash = pressed;
    }

    if (code === "KeyJ") {
        if (pressed && !keys.absorb) justPressed.absorb = true;
        keys.absorb = pressed;
    }

    if (code === "KeyK") {
        if (pressed && !keys.discard) {
            discardHoldMs = 0;
            discardUsedFlush = false;
        }

        if (!pressed && keys.discard && !discardUsedFlush && discardHoldMs < FLUSH_HOLD_MS) {
            justPressed.discard = true;
        }

        keys.discard = pressed;
    }
}

window.addEventListener("keydown", (event) => {
    if (currentScene !== SCENES.PLAYING) {
        if (!event.repeat) {
            event.preventDefault();
            advanceSceneFromStart();
        }
        return;
    }

    if (event.repeat) return;
    setKey(event.code, true, event);
});

window.addEventListener("keyup", (event) => {
    if (currentScene !== SCENES.PLAYING) return;
    setKey(event.code, false, event);
});

window.addEventListener("beforeunload", () => {
    commitPendingLeaderboardOnUnload();
});

ui.restartButton.addEventListener("click", () => {
    resetGame().catch((error) => {
        console.error(error);
    });
});

loadImages(() => {
    assetsReady = true;
    if (!startLoopStarted) {
        startLoopStarted = true;
        requestAnimationFrame(gameLoop);
    }
});

loadLeaderboard();
renderMainScore(0);
