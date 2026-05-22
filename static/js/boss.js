/*
 * boss.js
 * 負責 Boss 的出場、扣血、技能狀態、單血條顯示，以及即時台詞狀態機。
 *
 */

// 分數達標後呼叫後端生成 Boss，並同步初始化前端顯示狀態。
async function triggerBossSpawn() {
    game.bossTriggered = true;

    try {
        const res = await fetch("/api/boss/spawn", { method: "POST" });
        const data = await res.json();

        game.boss = {
            active: true,
            hp: data.hp,
            maxHp: data.max_hp
        };

        // 每次重新開打都要重置台詞狀態，避免沿用上一場的冷卻與佇列。
        resetBossTauntForNewFight();
        resetBossSkillForNewFight(data.next_skill_ms);
        console.log("ALERT: BOSS INCOMING!");
    } catch (error) {
        // 若生成失敗，放回未觸發狀態，避免之後永遠不再嘗試生成 Boss。
        game.bossTriggered = false;
        console.error("Failed to spawn boss:", error);
    }
}

// 玩家吸收資料後會呼叫這裡對 Boss 扣血，並同步前端的單血條數值。
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
        game.boss.maxHp = status.max_hp ?? game.boss.maxHp;
        game.boss.active = status.active;

        // Boss 歸零後直接進 Endless，不再有中途切狀態的過場。
        if (!status.active && !game.bossDefeated) {
            game.bossDefeated = true;
            recordEvent("boss-defeated");
            cancelBossTaunts();
            cancelBossSkills();
            enterEndless();
        }
    } catch (error) {
        console.error("Boss damage error", error);
    }
}

// 依動畫時間從 Boss 的循環 frame 清單取出目前要顯示的切圖。
function getBossLoopFrame(frames, intervalMs, elapsedMs = visualAnimMs) {
    if (!Array.isArray(frames) || frames.length === 0) return null;
    const safeInterval = Math.max(1, intervalMs || 1);
    const frameIndex = Math.floor(Math.max(0, elapsedMs) / safeInterval) % frames.length;
    return frames[frameIndex] || frames[0];
}

// 取得 Boss 施放技能時的循環 frame，缺圖時回退到準備動作。
function getBossCastLoopFrame(castConfig, elapsedMs) {
    if (!castConfig?.prep) return null;
    return getBossLoopFrame(
        castConfig.loop,
        BOSS_SKILL_FRAME_INTERVAL_MS,
        elapsedMs
    ) || castConfig.prep;
}

// 依目前技能狀態決定 Boss 本體切圖、光暈與氣場色彩。
function getBossAnimationVisual() {
    const bossConfig = SPRITE_CONFIG?.boss;
    const skill = getBossSkillState();
    if (!bossConfig || !skill) {
        return {
            frame: null,
            glow: "#ff5c7c",
            aura: "rgba(255, 92, 124, 0.18)"
        };
    }

    if (skill.burstAfterMs > 0) {
        const elapsedMs = Math.max(0, (skill.burstAfterTotalMs ?? 0) - skill.burstAfterMs);
        return {
            frame: getBossCastLoopFrame(bossConfig.burstCast, elapsedMs),
            glow: "#32d6ff",
            aura: "rgba(50, 214, 255, 0.18)"
        };
    }

    if (skill.burstLeadMs > 0 || skill.pendingBurstDrops) {
        return {
            frame: bossConfig.burstCast?.prep ?? null,
            glow: "#ffb854",
            aura: "rgba(255, 184, 84, 0.16)"
        };
    }

    if (skill.reverseControlsMs > 0) {
        const elapsedMs = Math.max(0, (skill.reverseControlsTotalMs ?? 0) - skill.reverseControlsMs);
        return {
            frame: getBossLoopFrame(bossConfig.reverseLoop, BOSS_SKILL_FRAME_INTERVAL_MS, elapsedMs),
            glow: "#7cffd7",
            aura: "rgba(124, 255, 215, 0.16)"
        };
    }

    return {
        frame: getBossLoopFrame(bossConfig.idleLoop, BOSS_IDLE_FRAME_INTERVAL_MS),
        glow: "#ff5c7c",
        aura: "rgba(255, 92, 124, 0.12)"
    };
}

// 計算 Boss 在 Canvas 上的繪製位置與顯示尺寸。
function getBossVisualBounds() {
    const bossConfig = SPRITE_CONFIG?.boss ?? {};
    const drawW = bossConfig?.draw?.w ?? 192;
    const drawH = bossConfig?.draw?.h ?? 192;
    const bx = GAME_WIDTH / 2 - drawW / 2;
    const by = 18 + Math.sin(visualAnimMs / 500) * 10;
    return { bx, by, drawW, drawH };
}

// 取得 Boss 噴發掉落物要出現的起始位置。
function getBossBurstSpawnOrigin() {
    const { bx, by, drawW, drawH } = getBossVisualBounds();
    return {
        x: bx + drawW * 0.12,
        y: by + drawH * 0.12
    };
}
// 繪製 Boss 本體與單條血量條，畫面上不再顯示任何階段資訊。
function drawBossVisual(context) {
    const bossConfig = SPRITE_CONFIG?.boss ?? {};
    const { bx, by, drawW, drawH } = getBossVisualBounds();
    const hpRate = game?.boss?.maxHp
        ? Math.max(0, Math.min(1, game.boss.hp / game.boss.maxHp))
        : 0;
    const hpBarW = bossConfig?.hpBar?.w ?? 164;
    const hpBarH = bossConfig?.hpBar?.h ?? 10;
    const hpBarX = GAME_WIDTH / 2 - hpBarW / 2;
    const hpBarY = by + (bossConfig?.hpBar?.yOffset ?? 16);
    const visual = getBossAnimationVisual();
    const frame = visual.frame;
    const bossImage = images.boss;

    context.save();
    context.fillStyle = visual.aura;
    context.beginPath();
    context.ellipse(GAME_WIDTH / 2, by + drawH * 0.66, drawW * 0.24, 16, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.save();
    context.shadowBlur = 24;
    context.shadowColor = visual.glow;
    if (bossImage?.complete && frame) {
        context.drawImage(bossImage, frame.x, frame.y, frame.w, frame.h, bx, by, drawW, drawH);
    } else {
        context.fillStyle = "#12202b";
        context.strokeStyle = visual.glow;
        context.lineWidth = 4;
        context.strokeRect(bx + 34, by + 42, drawW - 68, drawH - 96);
        context.fillRect(bx + 34, by + 42, drawW - 68, drawH - 96);
    }
    context.restore();

    context.save();
    context.fillStyle = "#2b3440";
    context.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
    context.fillStyle = "#ff5c7c";
    context.fillRect(hpBarX, hpBarY, hpBarW * hpRate, hpBarH);
    context.strokeStyle = "rgba(237, 247, 255, 0.32)";
    context.lineWidth = 2;
    context.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);
    context.textAlign = "center";
    setArcadeFont(context, 10);
    context.fillStyle = "#fff";
    context.fillText("BOSS HP", GAME_WIDTH / 2, hpBarY - 6);
    context.restore();

    drawBossSpeechBubble(context, bx, by + 26);
}

// 建立一份新的 Boss 技能狀態，集中保存冷卻與技能特效倒數。
function createBossSkillState() {
    return {
        timerMs: -1,
        reverseControlsMs: 0,
        reverseControlsTotalMs: 0,
        inFlight: false,
        pendingBurstDrops: null,
        burstLeadMs: 0,
        burstLeadTotalMs: 0,
        burstAfterMs: 0,
        burstAfterTotalMs: 0
    };
}

// 取得目前遊戲共用的 Boss 技能狀態，若不存在就即時建立。
function getBossSkillState() {
    if (!game) return null;
    if (!game.bossSkill) {
        game.bossSkill = createBossSkillState();
    }
    return game.bossSkill;
}

// Boss 戰開始時重置技能狀態，並安排第一次技能延遲。
function resetBossSkillForNewFight(initialDelayMs) {
    game.bossSkill = createBossSkillState();
    game.bossSkill.timerMs = Number.isFinite(initialDelayMs)
        ? Math.max(0, initialDelayMs)
        : 25000;
    syncLogicalKeys();
}

// Boss 離場或遊戲結束時清空技能狀態與反轉控制效果。
function cancelBossSkills() {
    const state = getBossSkillState();
    if (!state) return;

    const wasReversed = state.reverseControlsMs > 0;
    state.timerMs = -1;
    state.reverseControlsMs = 0;
    state.reverseControlsTotalMs = 0;
    state.inFlight = false;
    state.pendingBurstDrops = null;
    state.burstLeadMs = 0;
    state.burstLeadTotalMs = 0;
    state.burstAfterMs = 0;
    state.burstAfterTotalMs = 0;

    if (wasReversed) {
        syncLogicalKeys();
    }
}

// 將後端給的 Boss 噴發資料轉成前端掉落物實例。
function spawnBossBurstDrops(dropList = []) {
    if (!Array.isArray(dropList) || dropList.length === 0) return 0;
    const spawnOrigin = getBossBurstSpawnOrigin();

    dropList.forEach((dropData) => {
        drops.push(new DropData(
            spawnOrigin.x,
            spawnOrigin.y,
            dropData.type,
            {
                vx: (dropData.vx ?? 0) * 0.62,
                vy: (dropData.vy ?? 3.5) * 0.48,
                renderLayer: "bossBurstFront"
            }
        ));
    });

    triggerJuice(spawnOrigin.x, spawnOrigin.y, "#ff5c7c", 24, 10, 320);
    return dropList.length;
}

// 將後端抽出的 Boss 技能 payload 套用到前端狀態。
function applyBossSkill(payload) {
    const state = getBossSkillState();
    if (!state) return;

    state.timerMs = Number.isFinite(payload?.next_skill_ms)
        ? Math.max(0, payload.next_skill_ms)
        : 30000;

    if (payload?.skill === "burst_drops") {
        state.pendingBurstDrops = Array.isArray(payload.drops) ? payload.drops : [];
        state.burstLeadMs = BOSS_BURST_PREP_MS;
        state.burstLeadTotalMs = state.burstLeadMs;
        state.burstAfterMs = 0;
        state.burstAfterTotalMs = 0;
        recordEvent("boss-skill-warning", "burst_drops", { count: state.pendingBurstDrops.length });
        return;
    }

    if (payload?.skill === "reverse_controls") {
        state.reverseControlsMs = Math.max(0, payload.duration_ms ?? 8000);
        state.reverseControlsTotalMs = state.reverseControlsMs;
        syncLogicalKeys();
        recordEvent("boss-skill", "reverse_controls", { durationMs: state.reverseControlsMs });
    }
}

// 向後端要求下一次 Boss 技能，並處理請求失敗時的保守冷卻。
function requestBossSkill() {
    const state = getBossSkillState();
    if (!state || state.inFlight) return;
    if (!game?.running || !game?.boss?.active) return;

    state.inFlight = true;

    fetch("/api/boss/skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
    })
        .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            return { res, data };
        })
        .then(({ res, data }) => {
            const latestState = getBossSkillState();
            if (!latestState) return;

            latestState.inFlight = false;
            if (!res.ok) {
                latestState.timerMs = 30000;
                return;
            }

            applyBossSkill(data);
        })
        .catch((error) => {
            const latestState = getBossSkillState();
            if (latestState) {
                latestState.inFlight = false;
                latestState.timerMs = 30000;
            }
            console.error("Boss skill request failed", error);
        });
}

// 每幀更新 Boss 技能倒數、反轉控制與噴發掉落流程。
function updateBossSkills(dt) {
    const state = getBossSkillState();
    if (!state) return;

    const bossActive = !!(game?.running && game?.boss?.active);
    if (!bossActive) {
        if (state.timerMs >= 0 || state.reverseControlsMs > 0 || state.inFlight) {
            cancelBossSkills();
        }
        return;
    }

    if (state.reverseControlsMs > 0) {
        state.reverseControlsMs = Math.max(0, state.reverseControlsMs - dt);
        if (state.reverseControlsMs <= 0) {
            state.reverseControlsTotalMs = 0;
            syncLogicalKeys();
        }
    }

    if (state.burstLeadMs > 0) {
        state.burstLeadMs = Math.max(0, state.burstLeadMs - dt);
        if (state.burstLeadMs <= 0 && state.pendingBurstDrops) {
            const spawned = spawnBossBurstDrops(state.pendingBurstDrops);
            state.pendingBurstDrops = null;
            state.burstAfterMs = BOSS_BURST_ACTIVE_MS;
            state.burstAfterTotalMs = state.burstAfterMs;
            state.burstLeadTotalMs = 0;
            if (spawned > 0) {
                recordEvent("boss-skill", "burst_drops", { count: spawned });
            }
        }
    } else if (state.burstAfterMs > 0) {
        state.burstAfterMs = Math.max(0, state.burstAfterMs - dt);
        if (state.burstAfterMs <= 0) {
            state.burstAfterTotalMs = 0;
        }
    }

    if (state.timerMs > 0) {
        state.timerMs -= dt;
    }

    if (state.timerMs <= 0 && !state.inFlight) {
        requestBossSkill();
    }
}

/* =========================================================================
 *  Boss 台詞狀態
 * =======================================================================*/

// 建立一份新的 Boss 台詞狀態，讓每場 Boss 戰都能從乾淨狀態開始。
function createBossTauntState() {
    return {
        cooldownMs: 0,        // 台詞顯示完後的冷卻時間。
        timedTimerMs: -1,     // 定時觸發倒數，-1 代表尚未啟動。
        bufferFired: {},      // 記錄高 Buffer 觸發點是否已用過。
        comboFired: {},       // 記錄 Combo 里程碑是否已用過。
        pendingContext: null, // LLM 忙碌時暫存最新一次請求。
        inFlight: false,      // 是否仍在等待 LLM 回應。
        requestSeq: 0,        // 用來淘汰過期回應的序號。
        displayQueue: [],     // 等待顯示的台詞佇列。
        currentMessage: null  // 目前正在顯示的台詞內容。
    };
}

// 取得目前遊戲共用的 Boss 台詞狀態，若不存在就即時建立。
function getBossTauntState() {
    if (!game) return null;
    if (!game.bossTaunt) {
        game.bossTaunt = createBossTauntState();
    }
    return game.bossTaunt;
}

// 新 Boss 戰開始時重置台詞狀態，並重新安排第一次定時嘲諷。
function resetBossTauntForNewFight() {
    game.bossTaunt = createBossTauntState();
    game.bossTaunt.timedTimerMs = randomBetween(BOSS_TAUNT_TIMED_MIN_MS, BOSS_TAUNT_TIMED_MAX_MS);
}

// Boss 離場或 Game Over 時清空台詞佇列，避免上一場訊息殘留。
function cancelBossTaunts() {
    const state = getBossTauntState();
    if (!state) return;

    state.requestSeq += 1;
    state.inFlight = false;
    state.pendingContext = null;
    state.displayQueue = [];
    state.currentMessage = null;
    state.cooldownMs = 0;
    state.timedTimerMs = -1;
}

// 每禎更新 Boss 台詞系統，只保留定時與顯示節奏，不再偵測階段切換。
function updateBossTaunt(dt) {
    const state = getBossTauntState();
    if (!state) return;

    const bossActive = !!(game.boss && game.boss.active);
    if (!game.running || !bossActive) {
        if (state.currentMessage || state.displayQueue.length || state.inFlight || state.pendingContext) {
            cancelBossTaunts();
        }
        return;
    }

    if (state.cooldownMs > 0) {
        state.cooldownMs = Math.max(0, state.cooldownMs - dt);
    }

    if (state.timedTimerMs > 0) {
        state.timedTimerMs -= dt;
        if (state.timedTimerMs <= 0) {
            requestBossTaunt("timed");
            state.timedTimerMs = randomBetween(BOSS_TAUNT_TIMED_MIN_MS, BOSS_TAUNT_TIMED_MAX_MS);
        }
    }

    if (state.currentMessage) {
        const elapsed = visualAnimMs - state.currentMessage.startMs;
        if (elapsed >= BOSS_TAUNT_DISPLAY_MS) {
            state.currentMessage = null;
            state.cooldownMs = BOSS_TAUNT_COOLDOWN_MS;
        }
    } else if (state.displayQueue.length > 0 && state.cooldownMs <= 0) {
        const next = state.displayQueue.shift();
        state.currentMessage = { text: next, startMs: visualAnimMs };
    }
}

// 依目前玩家狀態推導台詞語氣，Buffer 高時偏嘲諷，Combo 高時偏稱讚。
function deriveBossTauntTone() {
    const buffer = game?.buffer ?? 0;
    const combo = game?.combo ?? 0;
    if (buffer >= BOSS_TAUNT_BUFFER_HIGH) return "taunt";
    if (combo >= BOSS_TAUNT_COMBO_HIGH) return "praise";
    return "taunt";
}

// 建立送往後端的台詞上下文，單血條版只保留血量百分比，不再傳 Boss 階段。
function buildBossTauntContext(reason) {
    const boss = game?.boss;
    const hpPercent = boss?.maxHp ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : 1;

    return {
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

// 統一收尾一次 LLM 回應，避免過期請求把新狀態蓋掉。
function finalizeBossTauntRequest(originalGame, mySeq, reply) {
    if (originalGame !== game) return;

    const state = getBossTauntState();
    if (!state) return;
    if (mySeq !== state.requestSeq) return;

    state.inFlight = false;

    if (reply) {
        state.displayQueue.push(reply);
    }

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
    const fontSize = 14;
    const longestChars = Math.max(...lines.map((line) => [...line].length));
    const bubbleWidth = Math.min(220, Math.max(80, longestChars * fontSize + padding * 2));
    const bubbleHeight = lines.length * lineHeight + padding * 2;

    const bossW = SPRITE_CONFIG?.boss?.draw?.w ?? 120;
    let bubbleX = bossX + bossW - 50;
    let pointerDir = "left"; // 三角形朝向 Boss
    if (bubbleX + bubbleWidth + 4 > GAME_WIDTH) {
        bubbleX = bossX - bubbleWidth - 78;
        pointerDir = "right";
    }
    const bubbleY = bossY - 4;

    context.save();
    context.globalAlpha = alpha;

    // 外框
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
    context.textAlign = "left";
    context.textBaseline = "top";
    setArcadeFont(context, fontSize);
    context.fillStyle = "#eaffff";
    lines.forEach((line, index) => {
        context.fillText(line, bubbleX + padding, bubbleY + padding + index * lineHeight);
    });

    context.restore();
}

// 繪製圓角矩形，供台詞泡泡共用。
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

// Flush 完成時通知 Boss 台詞系統評估是否要說話。
function notifyBossTauntFlush() {
    requestBossTaunt("flush");
}

// Combo 跨過指定門檻時只觸發一次，避免短時間內重複洗版。
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

// Buffer 跨過高風險門檻時只觸發一次，避免每禎都重送請求。
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

// 實際送出台詞請求，並保留完整的錯誤資訊方便除錯。
function sendBossTauntRequest(tone, context) {
    const state = getBossTauntState();
    if (!state) return;

    state.inFlight = true;
    state.requestSeq += 1;
    const mySeq = state.requestSeq;
    const myGame = game;

    const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
        if (controller) controller.abort();
        finalizeBossTauntRequest(myGame, mySeq, null);
    }, BOSS_TAUNT_LLM_TIMEOUT_MS);

    fetch("/api/boss/taunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone, context }),
        signal: controller ? controller.signal : undefined
    })
        .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            return { res, data };
        })
        .then(({ res, data }) => {
            clearTimeout(timeoutId);

            if (!res.ok || !data?.ok) {
                console.warn("Boss taunt unavailable", {
                    status: res.status,
                    error: data?.error ?? `http_${res.status}`,
                    detail: data?.detail ?? null,
                    backend: data?.backend ?? null,
                    model: data?.model ?? null
                });
            }

            const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
            const valid = !!data?.ok && reply && [...reply].length <= BOSS_TAUNT_MAX_CHARS;
            finalizeBossTauntRequest(myGame, mySeq, valid ? reply : null);
        })
        .catch((error) => {
            clearTimeout(timeoutId);
            console.error("Boss taunt request failed", error);
            finalizeBossTauntRequest(myGame, mySeq, null);
        });
}
