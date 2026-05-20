/*
 * boss.js
 * 這份檔案負責：Boss 生成、受傷同步、Boss 畫面繪製，以及 Boss 即時台詞（LLM）狀態機。
 *
 * 台詞系統規格摘要：
 *  - 觸發：定時 25~40 秒隨機 + 階段切換 / Flush / Buffer 跨閾 / Combo 里程碑（不含 Fall）
 *  - 冷卻：15 秒，自「上一則顯示結束」起算；逾時/失敗/超字/空回傳 不算冷卻
 *  - LLM：後端 /api/boss/taunt；一次只送一則，等待期間新觸發合併成最新一筆
 *  - 顯示：Boss 旁對話框 3 秒；做法 A —— 顯示也排隊（前一則播完才播下一則）
 *  - 失敗 / 逾時（10s） / 超 20 字 → 不顯示，當功能不存在
 *  - Boss 被擊敗 或 Game Over → 清空 queue、忽略 in-flight、不再觸發
 */

// 分數達標後向後端要求生成 Boss，並初始化前端顯示狀態
async function triggerBossSpawn() {
    game.bossTriggered = true; // 確保同一局只會觸發一次 Boss 出場

    try {
        const res = await fetch("/api/boss/spawn", { method: "POST" });
        const data = await res.json();

        game.boss = {
            active: true,
            hp: data.hp,
            maxHp: data.max_hp,
            phase: "STORM"
        };

        // Boss 出場：重置台詞狀態並準備第一次定時觸發
        resetBossTauntForNewFight();

        // 保留既有提示方式，不改動其他功能流程
        console.log("ALERT: BOSS INCOMING!");
    } catch (e) {
        console.error("Failed to spawn boss:", e);
    }
}

// 玩家吸收資料時，將對應傷害同步到後端 Boss 血量
async function attackBoss(damage) {
    if (!game.boss || !game.boss.active) return;

    try {
        const res = await fetch("/api/boss/damage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ damage })
        });
        const status = await res.json();
        game.boss.hp = status.hp;
        game.boss.active = status.active;
        if (status.phase) {
            game.boss.phase = status.phase;
        }

        if (!status.active && !game.bossDefeated) {
            game.bossDefeated = true;
            recordEvent("boss-defeated");
            cancelBossTaunts("boss-defeated");
            enterEndless();
        }
    } catch (e) {
        console.error("Boss damage error", e);
    }
}

// 繪製 Boss 本體、血條與目前階段文字
function drawBossVisual(context) {
    const bx = GAME_WIDTH / 2 - 60;
    const by = 50 + Math.sin(visualAnimMs / 500) * 10;

    context.save();
    context.shadowBlur = 20;
    context.shadowColor = "#ff5c7c";
    context.fillStyle = "#12202b";
    context.strokeStyle = "#ff5c7c";
    context.lineWidth = 4;
    context.strokeRect(bx, by, 120, 60);
    context.fillRect(bx, by, 120, 60);

    const hpRate = game.boss.hp / game.boss.maxHp;
    context.fillStyle = "#2b3440";
    context.fillRect(bx, by - 20, 120, 8);
    context.fillStyle = "#ff5c7c";
    context.fillRect(bx, by - 20, 120 * hpRate, 8);

    context.textAlign = "center";
    setArcadeFont(context, 10);
    context.fillStyle = "#fff";
    context.fillText(`BOSS PHASE: ${game.boss.phase}`, GAME_WIDTH / 2, by - 25);
    context.restore();

    // 對話框（若有正在顯示的訊息）
    drawBossSpeechBubble(context, bx, by);
}

/* =========================================================================
 *  Boss 台詞狀態機
 * =======================================================================*/

// 建立一份全新的台詞狀態，於 createGameState 與 resetBossTauntForNewFight 使用
function createBossTauntState() {
    return {
        // 觸發節奏
        cooldownMs: 0,            // 距離下一則允許觸發的剩餘時間
        timedTimerMs: -1,         // 定時觸發倒數；-1 = 尚未啟動（Boss 尚未出場）
        lastBossPhase: null,      // 用來偵測階段切換
        bufferFired: {},          // 已觸發過的 Buffer 閾值（70 / 90）
        comboFired: {},           // 已觸發過的 Combo 里程碑（5 / 10）

        // LLM 通訊
        pendingContext: null,     // 等待送往 LLM 的最新 context（合併）
        inFlight: false,          // 是否正在等 LLM 回傳
        requestSeq: 0,            // 每次送出遞增，用來忽略已過期回應

        // 顯示佇列（做法 A：LLM 回傳後排隊顯示）
        displayQueue: [],         // string[]
        currentMessage: null      // { text, startMs }
    };
}

// 取得遊戲內的台詞狀態（保證存在）
function getBossTauntState() {
    if (!game) return null;
    if (!game.bossTaunt) {
        game.bossTaunt = createBossTauntState();
    }
    return game.bossTaunt;
}

// Boss 戰開始時呼叫：清掉舊狀態並排第一次定時觸發
function resetBossTauntForNewFight() {
    game.bossTaunt = createBossTauntState();
    const state = game.bossTaunt;
    state.timedTimerMs = randomBetween(BOSS_TAUNT_TIMED_MIN_MS, BOSS_TAUNT_TIMED_MAX_MS);
    state.lastBossPhase = game.boss?.phase ?? null;
}

// Boss 死亡 或 Game Over 時呼叫：清空所有 queue、忽略 in-flight、停止後續觸發
function cancelBossTaunts(reason = "manual") {
    const state = getBossTauntState();
    if (!state) return;
    state.requestSeq += 1; // 讓任何 in-flight 回應失效
    state.inFlight = false;
    state.pendingContext = null;
    state.displayQueue = [];
    state.currentMessage = null;
    state.cooldownMs = 0;
    state.timedTimerMs = -1; // 停止定時
}

// 主迴圈每幀呼叫一次
function updateBossTaunt(dt) {
    const state = getBossTauntState();
    if (!state) return;

    const bossActive = !!(game.boss && game.boss.active);
    if (!game.running || !bossActive) {
        // Boss 不在場上 / Game Over → 停止狀態機（但保留 currentMessage 顯示？）
        // 規格：Boss 死或玩家死後不再觸發，且清空所有 queue 與已有訊息
        if (state.currentMessage || state.displayQueue.length || state.inFlight || state.pendingContext) {
            cancelBossTaunts(game.running ? "boss-inactive" : "game-over");
        }
        return;
    }

    // 1. 倒數冷卻
    if (state.cooldownMs > 0) {
        state.cooldownMs = Math.max(0, state.cooldownMs - dt);
    }

    // 2. 偵測 Boss 階段切換
    const phase = game.boss.phase;
    if (state.lastBossPhase && phase && phase !== state.lastBossPhase) {
        requestBossTaunt("phase_change");
    }
    state.lastBossPhase = phase;

    // 3. 定時觸發倒數
    if (state.timedTimerMs > 0) {
        state.timedTimerMs -= dt;
        if (state.timedTimerMs <= 0) {
            requestBossTaunt("timed");
            // 重新排下一次定時（即便這次因冷卻而 noop，仍要排下次）
            state.timedTimerMs = randomBetween(BOSS_TAUNT_TIMED_MIN_MS, BOSS_TAUNT_TIMED_MAX_MS);
        }
    }

    // 4. 顯示流程：currentMessage 倒數 / 從 queue 取下一則
    if (state.currentMessage) {
        const elapsed = visualAnimMs - state.currentMessage.startMs;
        if (elapsed >= BOSS_TAUNT_DISPLAY_MS) {
            state.currentMessage = null;
            // 顯示結束才開始冷卻
            state.cooldownMs = BOSS_TAUNT_COOLDOWN_MS;
        }
    } else if (state.displayQueue.length > 0 && state.cooldownMs <= 0) {
        // 即便 queue 內已有預先回傳的訊息，也必須等冷卻歸零才能播放下一則
        const next = state.displayQueue.shift();
        state.currentMessage = { text: next, startMs: visualAnimMs };
    }
}

// 推導目前情境應該用的 tone
function deriveBossTauntTone() {
    const buffer = game?.buffer ?? 0;
    const combo = game?.combo ?? 0;
    if (buffer >= BOSS_TAUNT_BUFFER_HIGH) return "taunt";   // Buffer 優先
    if (combo >= BOSS_TAUNT_COMBO_HIGH) return "praise";
    return "taunt"; // 預設
}

// 蒐集目前的遊戲情境快照
function buildBossTauntContext(reason) {
    const boss = game?.boss;
    const hpPercent = boss && boss.maxHp ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : 1;
    return {
        bossPhase: boss?.phase ?? "STORM",
        bossHpPercent: Number(hpPercent.toFixed(2)),
        playerScore: game?.score ?? 0,
        buffer: Math.round(game?.buffer ?? 0),
        combo: game?.combo ?? 0,
        recentEvent: reason
    };
}

/**
 * 觸發一次台詞請求（外部呼叫的入口）。
 * 規則：
 *  - 冷卻中 → 直接丟棄這次觸發（不顯示、不排隊、不送 LLM）
 *  - 正在等 LLM → 更新 pendingContext 為最新（合併）
 *  - 否則 → 立即送 LLM
 */
function requestBossTaunt(reason) {
    const state = getBossTauntState();
    if (!state) return;
    if (!game?.running) return;
    if (!game.boss || !game.boss.active) return;

    // 冷卻中（含正在顯示的時段）→ 忽略本次觸發
    if (state.cooldownMs > 0 || state.currentMessage) return;

    const tone = deriveBossTauntTone();
    const context = buildBossTauntContext(reason);

    if (state.inFlight) {
        // 合併：只保留最新一筆，待 LLM 回傳後再送出
        state.pendingContext = { tone, context };
        return;
    }

    sendBossTauntRequest(tone, context);
}

// 實際送 LLM 請求；含 10 秒逾時與 seq 校驗
function sendBossTauntRequest(tone, context) {
    const state = getBossTauntState();
    if (!state) return;

    state.inFlight = true;
    state.requestSeq += 1;
    const mySeq = state.requestSeq;
    const myGame = game; // 用來偵測 game reset

    const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
        // 逾時：標記失敗，不顯示，不算冷卻
        if (controller) controller.abort();
        finalizeBossTauntRequest(myGame, mySeq, null);
    }, BOSS_TAUNT_LLM_TIMEOUT_MS);

    fetch("/api/boss/taunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone, context }),
        signal: controller ? controller.signal : undefined
    })
        .then((res) => res.json())
        .then((data) => {
            clearTimeout(timeoutId);
            const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
            // 前端再做一次 20 字防呆
            const valid = reply && [...reply].length <= BOSS_TAUNT_MAX_CHARS;
            finalizeBossTauntRequest(myGame, mySeq, valid ? reply : null);
        })
        .catch(() => {
            clearTimeout(timeoutId);
            finalizeBossTauntRequest(myGame, mySeq, null);
        });
}

// LLM 回應（成功 / 失敗 / 逾時）統一收尾
function finalizeBossTauntRequest(originalGame, mySeq, reply) {
    // game 已重置 或 已被取消 → 直接丟棄
    if (originalGame !== game) return;
    const state = getBossTauntState();
    if (!state) return;
    if (mySeq !== state.requestSeq) return;

    state.inFlight = false;

    if (reply) {
        state.displayQueue.push(reply);
    }
    // 失敗 / 逾時 / 超字 → 不顯示、不算冷卻（cooldownMs 維持不變）

    // 若等待期間累積了 pending（合併後的最新一筆），現在送出
    if (state.pendingContext && game.running && game.boss && game.boss.active) {
        const { tone, context } = state.pendingContext;
        state.pendingContext = null;
        sendBossTauntRequest(tone, context);
    }
}

/* =========================================================================
 *  Boss 對話框繪製
 * =======================================================================*/

// 將文字依寬度切行（中英混排簡易斷字，每行不超過 maxCharsPerLine）
function _splitBossBubbleLines(text, maxCharsPerLine) {
    const chars = [...(text || "")];
    if (chars.length === 0) return [];
    const lines = [];
    for (let i = 0; i < chars.length; i += maxCharsPerLine) {
        lines.push(chars.slice(i, i + maxCharsPerLine).join(""));
    }
    return lines;
}

// 在 Boss 旁邊繪製對話框（若有 currentMessage）
function drawBossSpeechBubble(context, bossX, bossY) {
    const state = getBossTauntState();
    if (!state || !state.currentMessage) return;

    const elapsed = visualAnimMs - state.currentMessage.startMs;
    if (elapsed < 0 || elapsed >= BOSS_TAUNT_DISPLAY_MS) return;

    // 進出場淡入淡出
    const fadeMs = 220;
    let alpha = 1;
    if (elapsed < fadeMs) {
        alpha = elapsed / fadeMs;
    } else if (elapsed > BOSS_TAUNT_DISPLAY_MS - fadeMs) {
        alpha = Math.max(0, (BOSS_TAUNT_DISPLAY_MS - elapsed) / fadeMs);
    }

    const text = state.currentMessage.text;
    const maxCharsPerLine = 10;
    const lines = _splitBossBubbleLines(text, maxCharsPerLine);
    if (lines.length === 0) return;

    const padding = 10;
    const lineHeight = 16;
    const fontSize = 10;
    const longestChars = Math.max(...lines.map((l) => [...l].length));
    const bubbleWidth = Math.min(220, Math.max(80, longestChars * fontSize + padding * 2));
    const bubbleHeight = lines.length * lineHeight + padding * 2;

    // 預設放右側，超出畫面時放左側
    const bossW = 120;
    let bubbleX = bossX + bossW + 14;
    let pointerDir = "left"; // 三角形朝向 Boss
    if (bubbleX + bubbleWidth + 4 > GAME_WIDTH) {
        bubbleX = bossX - bubbleWidth - 14;
        pointerDir = "right";
    }
    const bubbleY = bossY - 4;

    context.save();
    context.globalAlpha = alpha;

    // 外框（青色科技感）
    context.fillStyle = "rgba(8, 18, 28, 0.92)";
    context.strokeStyle = "#32d6ff";
    context.lineWidth = 2;
    context.shadowColor = "#32d6ff";
    context.shadowBlur = 10;
    _drawRoundedRect(context, bubbleX, bubbleY, bubbleWidth, bubbleHeight, 6);
    context.fill();
    context.stroke();

    // 指向 Boss 的小三角
    context.shadowBlur = 0;
    context.fillStyle = "rgba(8, 18, 28, 0.92)";
    context.strokeStyle = "#32d6ff";
    context.beginPath();
    if (pointerDir === "left") {
        const px = bubbleX;
        const py = bubbleY + 18;
        context.moveTo(px, py - 6);
        context.lineTo(px - 8, py);
        context.lineTo(px, py + 6);
    } else {
        const px = bubbleX + bubbleWidth;
        const py = bubbleY + 18;
        context.moveTo(px, py - 6);
        context.lineTo(px + 8, py);
        context.lineTo(px, py + 6);
    }
    context.closePath();
    context.fill();
    context.stroke();

    // 文字
    context.shadowBlur = 0;
    context.textAlign = "left";
    context.textBaseline = "top";
    setArcadeFont(context, fontSize);
    context.fillStyle = "#eaffff";
    lines.forEach((line, idx) => {
        context.fillText(line, bubbleX + padding, bubbleY + padding + idx * lineHeight);
    });

    context.restore();
}

function _drawRoundedRect(context, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + w - radius, y);
    context.quadraticCurveTo(x + w, y, x + w, y + radius);
    context.lineTo(x + w, y + h - radius);
    context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    context.lineTo(x + radius, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
}

/* =========================================================================
 *  外部事件 hook（供 gameplay.js 呼叫）
 * =======================================================================*/

// Flush 使用時呼叫
function notifyBossTauntFlush() {
    requestBossTaunt("flush");
}

// 玩家 Combo 變動時呼叫；首次達到 5 / 10 觸發
function notifyBossTauntCombo(currentCombo) {
    const state = getBossTauntState();
    if (!state) return;
    BOSS_TAUNT_COMBO_TRIGGERS.forEach((threshold) => {
        if (currentCombo >= threshold && !state.comboFired[threshold]) {
            state.comboFired[threshold] = true;
            requestBossTaunt("combo_milestone");
        }
    });
}

// Buffer 變動時呼叫；首次跨越 70 / 90 觸發
function notifyBossTauntBuffer(currentBuffer) {
    const state = getBossTauntState();
    if (!state) return;
    BOSS_TAUNT_BUFFER_TRIGGERS.forEach((threshold) => {
        if (currentBuffer >= threshold && !state.bufferFired[threshold]) {
            state.bufferFired[threshold] = true;
            requestBossTaunt("buffer_threshold");
        }
    });
}
