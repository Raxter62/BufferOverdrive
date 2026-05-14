/*
 * main.js
 * 這份檔案負責：遊戲共用常數與狀態、API/排行榜、初始化流程、場景切換、主迴圈與按鍵綁定
 */

// 遊戲畫面尺寸、操作節奏與核心數值設定
const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;
const DECISION_TIME_MS = 1500;
const FLUSH_HOLD_MS = 650; // Flush 需要按住的時間
const FLUSH_PAUSE_MS = 1100; // Flush 後的暫停時間
const FLUSH_BUFFER_REDUCE = 25; // Flush 後減少的 Buffer
const DASH_COOLDOWN_MS = 3000; // Dash 的冷卻時間
const FLUSH_COOLDOWN_MS = 6000; // Flush 的冷卻時間
const RISK_DECAY_MS = 10000; // 風險衰退時間
const RISK_BAD_DATA_BONUS_PER_STACK = 0.25; // 每次吸收不良資料，對後續 Flush 增加的風險
const RISK_DROP_SPEED_BONUS_PER_STACK = 0.10; // 每次吸收不良資料，對後續 Flush 掉落的額外速度
const IDLE_FRAME_INTERVAL_MS = 400; // 待機狀態的切圖間距
const SKILL_FRAME_INTERVAL_MS = 300; // 技能狀態的切圖間距
const RESPAWN_INVINCIBLE_MS = 1000; // 角色復活後的無敵時間
const DEATH_FRAME_SWITCH_MS = 2000; // 角色死亡後切換下一幀的時間
const BOSS_TRIGGER_SCORE = 5000; // 分數達標後觸發 Boss
const ENDLESS_STAGE_THRESHOLDS = [1000, 2500, 5000, 8500]; // 擊敗 Boss 後的 Endless 節奏門檻
const ENDLESS_BANNER_DURATION_MS = 1600; // 進入 Endless 時的提示動畫時長
const MAP_SWAP_SCORE_STEP = 800; // 分數每達到此數值時觸發地圖切換
const MAP_SWAP_TELEGRAPH_MS = 3000; // 地圖切換前的預告時間
const ARCADE_FONT_FAMILY = "'Press Start 2P', 'VT323', 'Courier New', 'Noto Sans TC', monospace";
const START_FRAME_ORDER = [1, 2, 3, 4, 5, 4, 3, 2, 1]; // 開始畫面的切圖順序
const START_FRAME_INTERVAL_MS = 120; // 開始畫面的切圖間距
const TRASH_ZONE = { x: 0, y: 448, w: GAME_WIDTH, h: 32 }; // 垃圾資料存在區域
const INITIAL_MAP_INDEX = 1;
const LEADERBOARD_STORAGE_KEY = "bufferOverdrive.leaderboard.v1"; // 保留給舊版本機排行榜用，目前未啟用
const LEADERBOARD_LIMIT = 5;
const SCORE_DIGITS = 6;

// 遊戲目前可能處於的場景階段
const SCENES = {
    INTRO: "intro",
    GUIDE: "guide",
    PLAYING: "playing"
};

// 所有圖片素材路徑；未使用欄位先保留，避免影響既有資源結構
const IMAGE_PATHS = {
    idleAction: "/static/player_image/player/idle_action.png",
    idleWaiting: "/static/player_image/player/idle_waiting.png",
    useSkill: "/static/player_image/player/use_skills.png",
    skillicon: "/static/player_image/player/skills_icon.png",
    arcadeButtons: "/static/player_image/object/Button.png",
    arcadeStick: "/static/player_image/object/sti.png",
    dropData: "/static/player_image/object/drop_data.png",
    platform: "/static/player_image/background/platform.png",
    state: "/static/player_image/player/skills_icon.png", // 保留給舊版狀態圖示用途
    combo1: "/static/player_image/object/combo/1.png",
    combo2: "/static/player_image/object/combo/2.png",
    combo3: "/static/player_image/object/combo/3.png",
    combo4: "/static/player_image/object/combo/4.png",
    combo5: "/static/player_image/object/combo/5.png",
};

// 各種角色、平台、掉落物與街機外框的 Sprite Sheet 切圖設定
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
    },
    arcadeButtons: {
        a: {
            target: { left: 450, top: 820 }, // A 鍵在街機外框上的顯示位置
            up: [{ x: 22, y: 13, w: 81, h: 117 }],
            down: [{ x: 22, y: 182, w: 81, h: 117 }]
        },
        b: {
            target: { left: 566, top: 820 }, // B 鍵在街機外框上的顯示位置
            up: [{ x: 142, y: 13, w: 81, h: 111 }],
            down: [{ x: 142, y: 182, w: 81, h: 111 }]
        },
        c: {
            target: { left: 682, top: 820 },
            up: [{ x: 258, y: 13, w: 81, h: 117 }],
            down: [{ x: 258, y: 182, w: 81, h: 117 }]
        },
        d: {
            target: { left: 799, top: 820 },
            up: [{ x: 376, y: 13, w: 81, h: 117 }],
            down: [{ x: 376, y: 182, w: 81, h: 117 }]
        }
    },
    arcadeStick: {
        idle: {
            target: { left: 205, top: 750 },
            frames: [{ x: 120, y: 50, w: 120, h: 180 }]
        },
        left: {
            target: { left: 180, top: 755 },
            frames: [{ x: 100, y: 270, w: 140, h: 180 }]
        },
        right: {
            target: { left: 200, top: 755 },
            frames: [{ x: 110, y: 520, w: 140, h: 180 }]
        }
    }
};

// 各資料類型的分數、Buffer 影響、顏色與提示文字
const DATA_TYPES = {
    clean: {
        label: "Clean Data",
        score: 100,
        buffer: 8,
        sprite: 0,
        color: "#66e28c",
        weight: 30,
        note: "標準可用資料，分數穩定，適合優先吸收。"
    },
    compressed: {
        label: "Compressed Data",
        score: 60,
        buffer: 3,
        sprite: 1,
        color: "#32d6ff",
        weight: 24,
        note: "體積小、Buffer 壓力低，適合補分與控場。"
    },
    junk: {
        label: "Junk Data",
        score: 20,
        buffer: 12,
        sprite: 2,
        color: "#91a5b5",
        weight: 18,
        note: "低價值雜訊資料，容易塞滿 Buffer，不建議硬吃。"
    },
    virus: {
        label: "Virus Data",
        score: 180,
        buffer: 20,
        sprite: 3,
        color: "#ff5c7c",
        weight: 12,
        note: "高分但風險也高，適合在局勢穩定時處理。"
    },
    heavy: {
        label: "Heavy Data",
        score: 250,
        buffer: 25,
        sprite: 4,
        color: "#ffd166",
        weight: 10,
        note: "分數很高，但會大幅推升 Buffer 壓力。"
    },
    key: {
        label: "Key Packet",
        score: 0,
        buffer: 15,
        sprite: 4,
        color: "#8f7cff",
        weight: 4,
        note: "特殊封包，本身沒有分數，但會干擾節奏並增加壓力。"
    }
};

// 持續按住中的按鍵狀態
const keys = {
    left: false,
    right: false,
    jump: false,
    dash: false,
    absorb: false,
    discard: false
};

// 只在當前 frame 內有效一次的按鍵狀態
const justPressed = {
    jump: false,
    dash: false,
    absorb: false,
    discard: false
};

// 丟棄長按判定、素材載入狀態與圖片快取
let discardHoldMs = 0;
let discardUsedFlush = false;
let imagesLoaded = false;
const images = {};

// Canvas 與主要繪圖 context
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// 右側 HUD、結算面板與街機外框控制元件的 DOM 參照
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
    restartButton: document.getElementById("restartButton"),
    arcadeStick: document.getElementById("arcadeStick"),
    arcadeButtonA: document.getElementById("arcadeButtonA"),
    arcadeButtonB: document.getElementById("arcadeButtonB"),
    arcadeButtonC: document.getElementById("arcadeButtonC"),
    arcadeButtonD: document.getElementById("arcadeButtonD")
};

// 遊戲執行期間會持續變動的全域狀態
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

// 從一組 frame 陣列中安全取出第一格設定
function getSpriteFrame(frames) {
    return Array.isArray(frames) && frames.length > 0 ? frames[0] : null;
}

// 把指定的 Sprite 貼到街機外框的按鈕或搖桿元素上
function applyArcadeSprite(element, image, frames, target) {
    if (!element || !image?.complete || !image.naturalWidth || !image.naturalHeight) {
        element?.classList.remove("is-ready");
        return;
    }

    const frame = getSpriteFrame(frames);
    if (!frame || !target || !frame.w || !frame.h) {
        element.classList.remove("is-ready");
        return;
    }

    const drawWidth = target.w ?? frame.w;
    const drawHeight = target.h ?? frame.h;
    const scaleX = drawWidth / frame.w;
    const scaleY = drawHeight / frame.h;

    element.style.left = `${target.left}px`;
    element.style.top = `${target.top}px`;
    element.style.width = `${drawWidth}px`;
    element.style.height = `${drawHeight}px`;
    element.style.backgroundImage = `url("${image.src}")`;
    element.style.backgroundSize = `${image.naturalWidth * scaleX}px ${image.naturalHeight * scaleY}px`;
    element.style.backgroundPosition = `${-frame.x * scaleX}px ${-frame.y * scaleY}px`;
    element.classList.add("is-ready");
}

// 依目前按鍵狀態同步街機外框上的按鈕與搖桿視覺
function syncArcadeControls() {
    applyArcadeSprite(
        ui.arcadeButtonA,
        images.arcadeButtons,
        keys.absorb ? SPRITE_CONFIG.arcadeButtons.a.down : SPRITE_CONFIG.arcadeButtons.a.up,
        SPRITE_CONFIG.arcadeButtons.a.target
    );
    applyArcadeSprite(
        ui.arcadeButtonB,
        images.arcadeButtons,
        keys.discard ? SPRITE_CONFIG.arcadeButtons.b.down : SPRITE_CONFIG.arcadeButtons.b.up,
        SPRITE_CONFIG.arcadeButtons.b.target
    );
    applyArcadeSprite(
        ui.arcadeButtonC,
        images.arcadeButtons,
        keys.jump ? SPRITE_CONFIG.arcadeButtons.c.down : SPRITE_CONFIG.arcadeButtons.c.up,
        SPRITE_CONFIG.arcadeButtons.c.target
    );
    applyArcadeSprite(
        ui.arcadeButtonD,
        images.arcadeButtons,
        keys.dash ? SPRITE_CONFIG.arcadeButtons.d.down : SPRITE_CONFIG.arcadeButtons.d.up,
        SPRITE_CONFIG.arcadeButtons.d.target
    );

    let stickState = SPRITE_CONFIG.arcadeStick.idle;
    if (keys.left && !keys.right) {
        stickState = SPRITE_CONFIG.arcadeStick.left;
    } else if (keys.right && !keys.left) {
        stickState = SPRITE_CONFIG.arcadeStick.right;
    }

    applyArcadeSprite(
        ui.arcadeStick,
        images.arcadeStick,
        stickState.frames,
        stickState.target
    );
}

// 依開始畫面的播放順序建立每一幀素材路徑
const startFrames = START_FRAME_ORDER.reduce((acc, frameNumber) => {
    acc[`start${frameNumber}`] = `/static/player_image/start/${frameNumber}.png`;
    return acc;
}, {});

// 從後端取得下一張可用地圖
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

// 向後端要求下一批一般掉落物資料
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

// 取得 Flush 使用時要噴出的掉落物資料
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

// 將 API 回傳的排行榜資料整理成固定格式
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

// 從 API 載入排行榜資料
async function loadLeaderboard() {
    try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();
        leaderboardScores = normalizeLeaderboard(data);
    } catch {
        leaderboardScores = [];
    }

    renderLeaderboard(game?.running ? game.score : null);
    updateBestScore(game?.score ?? 0);
}

// 將排行榜資料寫回 API
async function saveLeaderboard(scores = leaderboardScores, keepalive = false) {
    try {
        await fetch("/api/leaderboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(scores),
            keepalive
        });
        return true;
    } catch {
        return false;
    }
}

// 在瀏覽器即將離開頁面時，使用較保守的方式提交排行榜
function saveLeaderboardOnUnload(scores = leaderboardScores) {
    try {
        const payload = JSON.stringify(scores);
        if (navigator.sendBeacon) {
            return navigator.sendBeacon("/api/leaderboard", new Blob([payload], { type: "application/json" }));
        }

        fetch("/api/leaderboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true
        });
        return true;
    } catch {
        return false;
    }
}

// 依目前分數建立一筆排行榜紀錄
function createLeaderboardEntry(score) {
    const now = new Date();
    return {
        score: Math.max(0, Math.floor(Number(score) || 0)),
        time: `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`
    };
}

// 先把本局分數暫存成待提交排行榜紀錄
function queueScoreForLeaderboard(score) {
    pendingLeaderboardEntry = createLeaderboardEntry(score);
    renderLeaderboard(pendingLeaderboardEntry.score);
    lastLiveLeaderboardScore = pendingLeaderboardEntry.score;
    updateBestScore(score);
}

// 將待提交排行榜正式合併後送回後端
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

// 在頁面關閉前盡可能把待提交排行榜送出
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

// 建立新的遊戲狀態物件，集中初始化所有遊戲數值
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
        dropSpawnMs: 350,
        flushPauseMs: 0,
        flushCooldownMs: 0,
        flushRiskLevel: 0,
        bossTriggered: false, // 是否已經觸發過 Boss 登場
        bossDefeated: false,
        boss: null, // 當前 Boss 的前端同步狀態
        endlessStartScore: null,
        endlessBannerStartMs: null,
        nextMapSwapScore: MAP_SWAP_SCORE_STEP,
        mapTransition: null,
        elapsedMs: 0,
        history: [],
        typeStats: Object.fromEntries(Object.keys(DATA_TYPES).map((key) => [key, { absorbed: 0, discarded: 0, buffer: 0 }]))
    };
}

// 載入所有圖片素材，全部完成後再通知外部
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

// 判斷兩個 2D 矩形是否重疊
function rectsOverlap(a, b) {
    return a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y;
}

// 將數值限制在指定範圍內
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// 取得指定區間內的隨機浮點數
function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

// 設定 Canvas 使用的街機風字體
function setArcadeFont(context, sizePx, weight = 700) {
    context.font = `${weight} ${sizePx}px ${ARCADE_FONT_FAMILY}`;
}

// 重置整場遊戲，重新初始化角色、地圖與狀態
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

// 從入口流程正式進入遊戲
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

// 處理場景切換：入口畫面 -> 說明畫面 -> 正式遊戲
async function advanceSceneFromStart() {
    if (!assetsReady) return;

    // 三段流程依序前進，每次按任意鍵只前進一個階段
    if (currentScene === SCENES.INTRO) {
        currentScene = SCENES.GUIDE;
        return;
    }

    if (currentScene === SCENES.GUIDE) {
        await startGameFromIntro();
    }
}

// 遊戲主迴圈，使用 requestAnimationFrame 持續更新畫面
function gameLoop(time) {
    const dt = Math.min(34, time - lastTime || 16.67);
    lastTime = time;
    visualAnimMs += dt;
    globalAnimTimer += 1;
    syncArcadeControls();

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

    // 正式遊戲進行中的更新流程
    if (game?.running) {
        game.elapsedMs += dt;
        game.flushCooldownMs = Math.max(0, game.flushCooldownMs - dt);
        updateMapTransition(dt);
        if (game.flushPauseMs > 0) {
            updateFlushPause(dt);
        } else {
            game.flushRiskLevel = Math.max(0, game.flushRiskLevel - dt / RISK_DECAY_MS); // Flush 危險值會隨時間逐漸下降
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

// 將實際鍵盤輸入轉成遊戲內部的按鍵狀態
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

// 註冊鍵盤、離頁與重新開始按鈕事件
function registerGameEvents() {
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
}

// 啟動素材載入、事件綁定與遊戲入口流程
function bootstrapGame() {
    registerGameEvents();

    loadImages(() => {
        assetsReady = true;
        syncArcadeControls();
        if (!startLoopStarted) {
            startLoopStarted = true;
            requestAnimationFrame(gameLoop);
        }
    });

    loadLeaderboard();
    renderMainScore(0);
}

window.addEventListener("load", bootstrapGame, { once: true });
