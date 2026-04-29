/*
 * main.js
 * 這份檔案負責：遊戲共用常數與狀態、API/排行榜、初始化流程、場景切換、主迴圈與按鍵綁定
 */

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
        note: "蝛拙?鞈?嚗??嗚?"
    },
    compressed: {
        label: "Compressed Data",
        score: 60,
        buffer: 3,
        sprite: 1,
        color: "#32d6ff",
        weight: 24,
        note: "雿???摰蝝舐????"
    },
    junk: {
        label: "Junk Data",
        score: 20,
        buffer: 12,
        sprite: 2,
        color: "#91a5b5",
        weight: 18,
        note: "雿?擃?嚗虜?拙?銝???"
    },
    virus: {
        label: "Virus Data",
        score: 180,
        buffer: 18,
        sprite: 3,
        color: "#ff5c7c",
        weight: 12,
        note: "?銝嚗?憯?擃?"
    },
    heavy: {
        label: "Heavy Data",
        score: 250,
        buffer: 25,
        sprite: 4,
        color: "#ffd166",
        weight: 10,
        note: "擃◢?芷??梢??"
    },
    key: {
        label: "Key Packet",
        score: 0,
        buffer: 15,
        sprite: 4,
        color: "#8f7cff",
        weight: 4,
        note: "?寞?鞈?嚗?雿擃???憟???"
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
            game.flushRiskLevel = Math.max(0, game.flushRiskLevel - dt / RISK_DECAY_MS);// Flush 危險值會隨時間逐漸下降
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

function bootstrapGame() {
    registerGameEvents();

    loadImages(() => {
        assetsReady = true;
        if (!startLoopStarted) {
            startLoopStarted = true;
            requestAnimationFrame(gameLoop);
        }
    });

    loadLeaderboard();
    renderMainScore(0);
}

window.addEventListener("load", bootstrapGame, { once: true });
