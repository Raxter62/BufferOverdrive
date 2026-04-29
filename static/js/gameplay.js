/*
 * gameplay.js
 * 這份檔案負責：遊戲規則判定，例如吸收、丟棄、Flush、Endless、Game Over、掉落物生成、風險值與玩家/掉落物/平台之間的互動邏輯
 */

// 根據目前風險值，計算危險資料的權重倍率
function getRiskBadDataMultiplier() {
    return 1 + (game?.flushRiskLevel ?? 0) * RISK_BAD_DATA_BONUS_PER_STACK;
}

// 根據目前風險值，計算掉落速度倍率
function getRiskDropSpeedMultiplier() {
    return 1 + (game?.flushRiskLevel ?? 0) * RISK_DROP_SPEED_BONUS_PER_STACK;
}

// 依分數決定 Endless 模式的掉落節奏倍率
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

// 依目前階段與風險狀態，選出下一個掉落資料類型
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

        // 危險資料會隨風險值提高機率，讓場面逐漸變難
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

// 從後端掉落佇列取出一筆資料並生成到畫面中
function spawnDrop() {
    if (dropsQueue.length === 0) return;

    const dropData = dropsQueue.shift();
    drops.push(new DropData(dropData.x, -36, dropData.type, { vy: dropData.vy }));

    // 使用 API 回傳的 timeToNext 當作下一顆掉落物的生成間隔
    game.dropSpawnMs = dropData.timeToNext;

    // 當佇列剩太少時，提早向後端補下一批資料
    if (dropsQueue.length < 15) {
        fetchDropsQueue();
    }
}

// 觸發 Flush 噴出來的危險資料波
function spawnFlushWave(dropList = flushDropsData) {
    const dropsToSpawn = Array.isArray(dropList) ? dropList : [];
    const startX = player.x + player.w / 2;

    dropsToSpawn.forEach((d) => {
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

// 將手上的資料往玩家面朝方向丟出去
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

// 玩家接到資料後，將其放入待決策區
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

// 吸收待決策資料，增加分數，同時提高 Buffer
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

// 丟棄待決策資料
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

// 玩家碰到危險區或掉落後的重生處理
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

// 發動 Flush：降低 Buffer，但提高風險並噴出危險資料
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

// 進入 Endless 模式，降低當前 Buffer 並切換階段
function enterEndless() {
    game.phase = "ENDLESS";
    game.buffer = Math.floor(game.buffer * 0.35);
    recordEvent("enter-endless");
}

// 結束遊戲並顯示 Game Over 面板
function endGame() {
    if (!game.running) return;

    game.running = false;
    game.pending = null;
    player.triggerDeath();
    queueScoreForLeaderboard(game.score);

    // 將本局統計資料送到後端紀錄 API
    fetch("/api/log_event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    }).catch((err) => console.error("Log error", err));

    if (gameOverRevealTimer) {
        clearTimeout(gameOverRevealTimer);
    }

    gameOverRevealTimer = setTimeout(() => {
        const typeBreakdown = Object.entries(game.typeStats)
            .filter(([_, stats]) => stats.absorbed > 0 || stats.discarded > 0)
            .map(([type, stats]) => `${DATA_TYPES[type].label}: 吸收${stats.absorbed}/丟棄${stats.discarded}`)
            .join("｜");

        ui.finalStats.innerHTML = `分數 <strong>${game.score}</strong><br>處理 <strong>${game.handled}</strong> 筆 (自動吸收 ${game.autoAbsorbed})<br>Flush <strong>${game.flushes}</strong> 次<br><br><span style="font-size: 0.8em; color: var(--muted);">${typeBreakdown}</span>`;
        ui.gameOverPanel.classList.remove("hidden");
    }, DEATH_FRAME_SWITCH_MS * 2);
}

// 記錄近期遊戲事件，方便後端保存與後續分析
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

// 更新待決策資料的倒數時間，超時時自動吸收
function updateDecision(dt) {
    if (!game.pending) return;

    game.pending.elapsedMs += dt;
    if (game.pending.elapsedMs >= DECISION_TIME_MS) {
        absorbPending("auto-timeout");
    }
}

// 根據玩家輸入執行吸收、丟棄或長按 Flush
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

// 更新所有掉落物的位置、生成與玩家碰撞
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

// 更新 Flush 暫停期間的特殊掉落動畫與移動
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

// 處理玩家與平台、危險格、垃圾區之間的互動
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
