/*
 * gameplay.js
 * 這份檔案負責：遊戲規則判定，例如吸收、丟棄、Flush、Endless、Game Over、掉落物生成、風險值與玩家/掉落物/平台之間的互動邏輯
 */

// 根據目前風險值，計算危險資料的權重倍率
function getRiskBadDataMultiplier() {
    return 1 + (game?.flushRiskLevel ?? 0) * RISK_BAD_DATA_BONUS_PER_STACK;
}

// 根據目前風險值與技能狀態，計算掉落速度倍率
function getRiskDropSpeedMultiplier() {
    let multiplier = 1 + (game?.flushRiskLevel ?? 0) * RISK_DROP_SPEED_BONUS_PER_STACK;

    // --- 新增：如果緩速技能發動中，速度剩下 40% (緩速 60%) ---
    if (slowMoTimerMs > 0) {
        multiplier *= 0.5;
    }
    return multiplier;
}

// 依擊敗 Boss 後累積的分數，決定 Endless 模式的掉落節奏倍率
function getEndlessSpawnFactor(score) {
    if (game?.endlessStartScore == null) return 0.9;

    const endlessScore = Math.max(0, score - game.endlessStartScore);
    const [stage1, stage2, stage3, stage4] = ENDLESS_STAGE_THRESHOLDS;

    if (endlessScore <= 0) return 0.9;
    if (endlessScore >= stage4) return 0.5;

    if (endlessScore <= stage1) {
        return 0.9 - (endlessScore / stage1) * 0.1;
    }

    if (endlessScore <= stage2) {
        return 0.8 - ((endlessScore - stage1) / (stage2 - stage1)) * 0.1;
    }

    if (endlessScore <= stage3) {
        return 0.7 - ((endlessScore - stage2) / (stage3 - stage2)) * 0.1;
    }

    return 0.6 - ((endlessScore - stage3) / (stage4 - stage3)) * 0.1;
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
    notifyBossTauntCombo(game.combo);

    // 1. 計算既有的 Combo 倍率計算最終得分
    const comboMultiplier = 1 + 0.1 * game.combo;
    const finalScore = Math.round(data.score * comboMultiplier);

    if (game.boss && game.boss.active) {
        attackBoss(finalScore / 10); // Boss 扣血吃到 Combo 後的最終分數。
    }

    game.score += finalScore;
    game.buffer = clamp(game.buffer + data.buffer, 0, 100);
    notifyBossTauntBuffer(game.buffer);
    game.absorbed += 1;
    game.handled += 1;
    game.typeStats[typeKey].absorbed += 1;
    game.typeStats[typeKey].buffer += data.buffer;

    if (!game.bossTriggered && game.score >= BOSS_TRIGGER_SCORE) {
        triggerBossSpawn();
    }

    if (reason.startsWith("auto")) {
        game.autoAbsorbed += 1;
    }

    // 4. 打擊感強化
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;

    if (typeKey === "virus" || typeKey === "heavy") {
        triggerJuice(px, py, data.color, 35, 12, 350);
    } else if (typeKey === "junk") {
        triggerJuice(px, py, data.color, 12, 5, 150);
    } else {
        triggerJuice(px, py, data.color, 18, 7, 150);
    }

    recordEvent(reason === "manual" ? "absorb" : reason, typeKey);
    game.pending = null;

    maybeStartMapTransition();

    if (game.buffer >= 100) {
        endGame();
    }
}

// 丟棄待決策封包：重置 Combo，並將封包轉成可視的拋出物件。
function discardPending() {
    if (!game.pending) return;

    const typeKey = game.pending.typeKey;
    const data = DATA_TYPES[typeKey]; // 取出資料屬性以取得顏色。
    throwPendingDrop(typeKey);

    // 丟棄時仍保留輕量的視覺回饋。
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    triggerJuice(px, py, data.color, 8, 4, 100);

    game.combo = 0;
    game.discarded += 1;
    game.handled += 1;
    game.typeStats[typeKey].discarded += 1;
    recordEvent("discard", typeKey);
    game.pending = null; // 封包已離手，不再保留決策狀態。
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

// 啟動 Flush：降低 Buffer、增加風險值，並生成反噴波。
function triggerFlush() {
    if (game.buffer <= 0 || !game.running) return;

    // 只有在這次 Flush 剛開始時才記錄排序時間，避免重複刷新順序。
    if (game.flushPauseMs <= 0) {
        flushBannerStartMs = visualAnimMs;
    }

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
    notifyBossTauntFlush();
}

// 進入 Endless 模式，降低當前 Buffer 並切換階段
function enterEndless() {
    if (game.phase === "ENDLESS") return;

    game.phase = "ENDLESS";
    game.endlessStartScore = game.score;
    game.endlessBannerStartMs = visualAnimMs;
    game.buffer = Math.floor(game.buffer * 0.35);
    dropsQueue = [];
    game.dropSpawnMs = 0;
    fetchDropsQueue();
    fetchFlushDrops().then((data) => {
        flushDropsData = data;
    });
    recordEvent("enter-endless", null, { endlessStartScore: game.endlessStartScore });
}

// 結束遊戲並顯示 Game Over 面板
function endGame() {
    if (!game.running) return;

    game.running = false;
    game.pending = null;
    cancelBossTaunts("game-over");
    screenShakeMs = 0;
    screenShakeIntensity = 0;
    effectParticles = [];
    // 死亡時改用專用雙震效果，避免沿用一般粒子震動
    deathShakeMs = DEATH_SHAKE_DURATION_MS;
    slowMoTimerMs = 0;
    flushBannerStartMs = null;
    freezeBannerStartMs = null;
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
        // 1. 更新純文字統計部分 (覆蓋並清空先前的內容)
        ui.finalStats.innerHTML = `
            <div style="font-size:16px; margin-bottom: 8px; color:var(--text); letter-spacing: 2px;">
                FINAL SCORE <strong style="color:var(--cyan); font-size:26px;">${game.score}</strong>
            </div>
            <div style="font-size:12px; color:var(--muted); display:flex; justify-content:center; gap: 14px; flex-wrap:wrap;">
                <span>處理: <strong style="color:#fff">${game.handled}</strong></span>
                <span>吸收: <strong style="color:#fff">${game.absorbed}</strong></span>
                <span>丟棄: <strong style="color:#fff">${game.discarded}</strong></span>
                <span>自動吸收: <strong style="color:#fff">${game.autoAbsorbed}</strong></span>
                <span>flush次數: <strong style="color:#fff">${game.flushes}</strong></span>
            </div>
        `;

        // 2. 直接建立圖表容器與畫布 (不再用 getElementById 抓取，避免 DOM 延遲錯誤)
        const chartsContainer = document.createElement('div');
        chartsContainer.style.display = 'flex';
        chartsContainer.style.gap = '12px';
        chartsContainer.style.marginTop = '16px';
        chartsContainer.style.width = '100%';

        // 左側：壓力波動圖
        const lineCanvas = document.createElement('canvas');
        lineCanvas.className = 'game-over-canvas';
        lineCanvas.style.flex = "1.8";
        lineCanvas.width = 540;  // ⚠️ 提高解析度
        lineCanvas.height = 260; // ⚠️ 提高解析度
        chartsContainer.appendChild(lineCanvas);

        // 右側：資料比例五角雷達圖
        const radarCanvas = document.createElement('canvas');
        radarCanvas.className = 'game-over-canvas';
        radarCanvas.style.flex = "1.2";
        radarCanvas.width = 360;  // ⚠️ 提高解析度
        radarCanvas.height = 260; // ⚠️ 提高解析度
        chartsContainer.appendChild(radarCanvas);

        // 將容器加入結算面板中
        ui.finalStats.appendChild(chartsContainer);

        // 3. 直接傳入剛建立的 lineCanvas 與 radarCanvas 變數給繪圖函式，保證 100% 成功！
        drawGameOverChart(lineCanvas, game.history);
        drawTypeRadarChart(radarCanvas, game.typeStats);

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
            // --- 新增：攔截技能球，自動觸發 ---
            if (drop.typeKey === "skill_freeze") {
                // 冰凍狀態第一次啟動時記錄排序時間，供左上提示佇列使用
                if (slowMoTimerMs <= 0) {
                    freezeBannerStartMs = visualAnimMs;
                }

                // 吃到冰凍技能球後，啟動固定秒數的緩速狀態
                slowMoTimerMs = SLOW_MO_DURATION_MS;

                // 觸發冰藍色粒子爆炸特效
                triggerJuice(drop.x + drop.w / 2, drop.y + drop.h / 2, "#32d6ff", 40, 5, 150);

                drop.active = false; // 吃掉後消失
                return; // ⚠️ 關鍵：直接結束這次迴圈，不會執行下方的 catchDrop
            }
            // --------------------------------

            // 原本接到一般掉落物的邏輯
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

// --- 新增：觸發打擊感特效 ---
function triggerJuice(x, y, color, count, shakeIntensity, shakeDuration) {
    screenShakeIntensity = shakeIntensity;
    screenShakeMs = shakeDuration;

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2; // 粒子噴射速度
        effectParticles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 300 + Math.random() * 300, // 存活時間
            maxLife: 600,
            size: Math.random() * 3 + 2, // 粒子大小
            color: color
        });
    }
}
