/*
 * render.js
 * 這份檔案負責：HUD、排行榜與分數顯示、特效、主遊戲畫面、開始畫面與說明畫面的所有繪製邏輯
 */

// 繪製排行榜面板內容
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

// 更新右側顯示的最佳分數
function updateBestScore(currentScore = 0) {
    if (!ui.bestScore) return;
    const highest = Math.max(currentScore, leaderboardScores[0]?.score ?? 0);
    ui.bestScore.textContent = `${highest} PTS`;
}

// 將分數轉成固定位數字串
function formatScoreDigits(score) {
    const numeric = Math.max(0, Math.floor(Number(score) || 0));
    return String(numeric).slice(-SCORE_DIGITS).padStart(SCORE_DIGITS, "0");
}

// 將主分數區塊更新為目前顯示中的數字
function renderMainScore(score) {
    if (!ui.score) return;

    const numeric = Math.max(0, Math.floor(Number(score) || 0));
    const digits = formatScoreDigits(numeric);
    const activeCount = numeric === 0 ? 1 : Math.min(SCORE_DIGITS, String(numeric).length);
    const split = SCORE_DIGITS - activeCount;

    ui.score.dataset.ghost = digits.slice(0, split);
    ui.score.textContent = digits.slice(split);
}

// 讓分數逐步追上目標值，形成跳動動畫
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

// 從技能圖示 Sprite Sheet 取出對應區塊
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

// 繪製單一技能圖示與冷卻倒數
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

    // 繪製圖示下方的技能名稱
    setArcadeFont(context, 9, 700);
    context.textBaseline = "top";
    context.fillStyle = ready ? "#ecfff7" : "#8795a4";
    context.fillText(label, x + size / 2, y + size + 4);

    // 冷卻中時在圖示中央顯示剩餘秒數
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

// 繪製右上角 Dash 與 Flush 的技能狀態
function drawTopRightSkillHud(context) {
    const dashCooldown = Math.max(0, player?.dashCooldown ?? 0);
    const flushCooldown = Math.max(0, game?.flushCooldownMs ?? 0);

    drawSkillIcon(context, "dash", GAME_WIDTH - 84, 12, 39, dashCooldown, "DASH");
    drawSkillIcon(context, "flush", GAME_WIDTH - 42, 12, 39, flushCooldown, "FLUSH");
}

// 繪製風險值圖示與目前的風險層數
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

// 更新右側 HUD 文字、決策條與分數顯示
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
        ui.packetName.textContent = "等待中";
        ui.packetName.style.color = "#ffd166";
        ui.packetMeta.textContent = "接住資料後有 1.5 秒可以決策。J 吸收，K 丟棄。";
        ui.decisionFill.style.width = "0%";
    }
}

// 繪製單一掉落資料的圖示
function drawDropIcon(context, spriteIndex, x, y, w, h) {
    const source = SPRITE_CONFIG.drops[spriteIndex] || SPRITE_CONFIG.drops[0];
    if (imagesLoaded && images.dropData?.complete) {
        context.drawImage(images.dropData, source.x, source.y, source.w, source.h, x, y, w, h);
        return;
    }

    context.fillStyle = "#32d6ff";
    context.fillRect(x, y, w, h);
}

// 繪製遊戲背景與掃描線效果
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

// 繪製畫面底部的垃圾區警示
function drawTrashZone(context) {
    context.save();
    context.fillStyle = "#ff5c7c";
    setArcadeFont(context, 11);
    context.fillText("TRASH / OVERLOAD ZONE", 14, TRASH_ZONE.y + 21);
    context.restore();
}

// 繪製單一平台或危險格
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

// 繪製地圖切換時的平台震動與粒子特效
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

// 繪製玩家手上待決策資料的倒數波紋
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

// 繪製玩家死亡時的黑色聚焦遮罩
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

// 繪製 Flush 執行中的紅色閃爍遮罩
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

function drawEndlessUnlockedBanner(context) {
    if (!game?.endlessBannerStartMs) return;

    const elapsed = visualAnimMs - game.endlessBannerStartMs;
    if (elapsed < 0 || elapsed > ENDLESS_BANNER_DURATION_MS) return;

    const enterMs = 260;
    const holdMs = 520;
    const exitMs = ENDLESS_BANNER_DURATION_MS - enterMs - holdMs;
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT * 0.36;
    const startX = -320;
    const endX = GAME_WIDTH + 320;
    let x = centerX;
    let alpha = 1;
    let scale = 1;

    if (elapsed <= enterMs) {
        const t = clamp(elapsed / enterMs, 0, 1);
        const easeOut = 1 - Math.pow(1 - t, 3);
        x = startX + (centerX - startX) * easeOut;
        alpha = 0.28 + easeOut * 0.72;
        scale = 0.9 + easeOut * 0.1;
    } else if (elapsed <= enterMs + holdMs) {
        const t = clamp((elapsed - enterMs) / holdMs, 0, 1);
        const pulse = Math.sin(t * Math.PI * 4) * 5;
        x = centerX + pulse;
        scale = 1 + Math.sin(t * Math.PI * 2) * 0.018;
    } else {
        const t = clamp((elapsed - enterMs - holdMs) / exitMs, 0, 1);
        const easeIn = t * t * t;
        x = centerX + (endX - centerX) * easeIn;
        alpha = 1 - easeIn;
        scale = 1 + easeIn * 0.12;
    }

    const bandHeight = 94;
    const bandY = centerY - bandHeight / 2;
    const streakOffset = ((elapsed / 18) % 120) - 60;

    context.save();
    context.globalAlpha = alpha;

    const band = context.createLinearGradient(0, bandY, 0, bandY + bandHeight);
    band.addColorStop(0, "rgba(7, 16, 24, 0)");
    band.addColorStop(0.18, "rgba(7, 16, 24, 0.78)");
    band.addColorStop(0.5, "rgba(17, 43, 63, 0.92)");
    band.addColorStop(0.82, "rgba(7, 16, 24, 0.78)");
    band.addColorStop(1, "rgba(7, 16, 24, 0)");
    context.fillStyle = band;
    context.fillRect(0, bandY, GAME_WIDTH, bandHeight);

    context.strokeStyle = "rgba(50, 214, 255, 0.7)";
    context.lineWidth = 2;
    context.strokeRect(10, bandY + 10, GAME_WIDTH - 20, bandHeight - 20);

    for (let i = -1; i <= 6; i += 1) {
        const streakX = streakOffset + i * 110;
        context.fillStyle = i % 2 === 0 ? "rgba(50, 214, 255, 0.18)" : "rgba(102, 226, 140, 0.14)";
        context.fillRect(streakX, bandY + 18, 54, bandHeight - 36);
    }

    context.translate(x, centerY);
    context.scale(scale, scale);
    context.textAlign = "center";
    context.textBaseline = "middle";

    context.fillStyle = "#32d6ff";
    context.shadowColor = "rgba(50, 214, 255, 0.72)";
    context.shadowBlur = 20;
    setArcadeFont(context, 26, 900);
    context.fillText("ENDLESS", 0, -14);

    context.fillStyle = "#ffd166";
    context.shadowColor = "rgba(255, 209, 102, 0.68)";
    context.shadowBlur = 16;
    setArcadeFont(context, 14, 900);
    context.fillText("UNLOCKED", 0, 24);

    context.restore();
}

// 根據 Buffer 高低回傳對應的顏色樣式
function getBufferStateColor(buffer) {
    if (buffer >= 82) return { fill: "#ff5c7c", glow: "rgba(255, 92, 124, 0.55)", accent: "#9b1d41" };
    if (buffer >= 55) return { fill: "#ffd166", glow: "rgba(255, 209, 102, 0.42)", accent: "#ff9f1c" };
    return { fill: "#66e28c", glow: "rgba(102, 226, 140, 0.42)", accent: "#32d6ff" };
}

// 繪製左上角的 Buffer 進度條
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

// 繪製整個主遊戲畫面
function drawGame() {
    ctx.save(); 

    // 套用螢幕震動 (只震動遊戲世界)
    if (screenShakeMs > 0) {
        const dx = (Math.random() - 0.5) * screenShakeIntensity;
        const dy = (Math.random() - 0.5) * screenShakeIntensity;
        ctx.translate(dx, dy);
    }

    // 1. 先畫最底層的背景
    drawBackground(ctx);

    // 2. 畫地圖與物件
    platforms.forEach((platform) => drawPlatform(ctx, platform));
    drawMapTransition(ctx);
    drops.forEach((drop) => drop.draw(ctx));
    drawTrashZone(ctx);

    // 3. 畫 Boss
    if (game.boss && game.boss.active) {
        drawBossVisual(ctx); 
    }

    // 4. 畫玩家與特效
    drawPendingPulse(ctx);
    drawDeathOverlay(ctx);
    player.draw(ctx);
    drawEffectParticles(ctx);

    ctx.restore(); // 復原畫布偏移，確保 UI 介面維持固定不晃動
    // --- 新增：時空凍結 (緩速) 發動時的螢幕濾鏡 ---
    if (slowMoTimerMs > 0) {
        ctx.save();
        ctx.fillStyle = "rgba(50, 214, 255, 0.12)"; // 淡淡的冰藍色覆蓋
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        // 加上一點掃描線閃爍感
        if (Math.floor(visualAnimMs / 100) % 2 === 0) {
             ctx.fillStyle = "rgba(50, 214, 255, 0.05)";
             ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }
        ctx.restore();
    }
    // ------------------------------------------

    // 5. 畫 UI 層 (最上層)
    drawFlushOverlay(ctx);
    drawEndlessUnlockedBanner(ctx);
    drawBufferHud(ctx);
    drawTopRightSkillHud(ctx);
    drawRiskStatusHud(ctx);
    drawCombo(ctx);
}



// 繪製 Combo 圖示與連擊倍率
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

// 繪製開始畫面
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

// 繪製操作說明畫面
function drawGuideScreen(context) {
    context.save();
    const t = guideAnimMs;

    const base = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    base.addColorStop(0, "#060b12");
    base.addColorStop(0.55, "#0b1420");
    base.addColorStop(1, "#090d15");
    context.fillStyle = base;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Glitch 風格的掃描線與橫向干擾背景
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

function drawGuideSpriteFrame(context, image, frame, x, y, w, h) {
    if (!image?.complete || !frame) return;
    context.drawImage(image, frame.x, frame.y, frame.w, frame.h, x, y, w, h);
}

function drawGuideButtonIcon(context, key, x, y, active, label) {
    const button = SPRITE_CONFIG.arcadeButtons[key];
    const frame = (active ? button.down : button.up)[0];
    drawGuideSpriteFrame(context, images.arcadeButtons, frame, x, y, 32, 32);
}

function drawGuideStickIcon(context, x, y, direction) {
    const stick = SPRITE_CONFIG.arcadeStick[direction] || SPRITE_CONFIG.arcadeStick.idle;
    drawGuideSpriteFrame(context, images.arcadeStick, stick.frames[0], x, y, 42, 54);
}

function drawGuideScreen(context) {
    context.save();
    const t = guideAnimMs;
    const moveRight = Math.sin(t / 380) > 0;
    const jumpActive = Math.sin(t / 280) > 0.25;
    const dashActive = Math.sin(t / 220) > 0.1;
    const flushActive = Math.sin(t / 260) > 0.15;
    const goodPacket = Math.sin(t / 420) > 0;
    const bufferRatio = 0.42 + ((Math.sin(t / 300) + 1) / 2) * 0.5;

    const base = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    base.addColorStop(0, "#060b12");
    base.addColorStop(0.55, "#0b1420");
    base.addColorStop(1, "#090d15");
    context.fillStyle = base;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

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
    setArcadeFont(context, 28, 700);
    context.textAlign = "left";
    context.fillText("MISSION GUIDE", 64, 102);

    context.fillStyle = "#edf7ff";
    setArcadeFont(context, 20, 700);
    const lineX = 64;
    const iconGap = 12;
    const moveText = "MOVE: A / D or LEFT / RIGHT";
    const jumpText = "JUMP: SPACE";
    const dashText = "DASH: SHIFT";
    const decisionText = "DECISION DATA: J absorb, K discard";
    const flushText = "HOLD K for FLUSH (reduce buffer)";
    const trashText = "FALL TO TRASH ZONE: BUFFER + 20%";
    const gameOverText = "GAMEOVER: BUFFER reaches 100%";

    context.fillText(moveText, lineX, 148);
    context.fillText(jumpText, lineX, 180);
    context.fillText(dashText, lineX, 212);
    context.fillText(decisionText, lineX, 244);
    context.fillText(flushText, lineX, 276);
    context.fillText(trashText, lineX, 308);
    context.fillText(gameOverText, lineX, 340);

    const moveIconX = lineX + context.measureText(moveText).width + iconGap;
    const jumpIconX = lineX + context.measureText(jumpText).width + iconGap;
    const dashIconX = lineX + context.measureText(dashText).width + iconGap;
    const decisionIconX = lineX + context.measureText(decisionText).width + iconGap;
    const flushIconX = lineX + context.measureText(flushText).width + iconGap;
    const trashIconX = lineX + context.measureText(trashText).width + iconGap;
    const gameOverIconX = lineX + context.measureText(gameOverText).width + iconGap;

    drawGuideStickIcon(context, moveIconX, 122, moveRight ? "right" : "left");
    drawGuideButtonIcon(context, "c", jumpIconX, 166, jumpActive, "SPACE");
    drawGuideButtonIcon(context, "d", dashIconX, 198, dashActive, "SHIFT");

    drawDropIcon(context, goodPacket ? DATA_TYPES.clean.sprite : DATA_TYPES.junk.sprite, decisionIconX, 232, 22, 22);
    drawGuideButtonIcon(context, goodPacket ? "a" : "b", decisionIconX + 30, 230, true, goodPacket ? "J" : "K");

    drawGuideButtonIcon(context, "b", flushIconX, 262, flushActive, "K");

    context.save();
    context.fillStyle = "rgba(255, 92, 124, 0.18)";
    context.fillRect(trashIconX, 300, 84, 16);
    context.strokeStyle = "rgba(255, 92, 124, 0.85)";
    context.lineWidth = 2;
    context.strokeRect(trashIconX, 300, 84, 16);
    context.fillStyle = "#ff5c7c";
    setArcadeFont(context, 7, 900);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("TRASH", trashIconX + 42, 309);
    context.restore();

    context.save();
    context.fillStyle = "rgba(0, 0, 0, 0.72)";
    context.fillRect(gameOverIconX, 334, 84, 12);
    context.strokeStyle = "rgba(237, 247, 255, 0.28)";
    context.lineWidth = 1;
    context.strokeRect(gameOverIconX, 334, 84, 12);
    context.fillStyle = bufferRatio >= 0.82 ? "#ff5c7c" : bufferRatio >= 0.55 ? "#ffd166" : "#66e28c";
    context.fillRect(gameOverIconX + 2, 336, Math.round(80 * bufferRatio), 8);
    context.restore();

    const blinkAlpha = 0.3 + (Math.sin(t / 360) + 1) * 0.3;
    context.fillStyle = `rgba(255, 255, 255, ${blinkAlpha.toFixed(3)})`;
    setArcadeFont(context, 14, 700);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("PRESS ANY BUTTON TO START", GAME_WIDTH / 2, GAME_HEIGHT - 40);
    context.restore();
}

// --- 新增：繪製爆炸粒子特效 ---
function drawEffectParticles(context) {
    if (effectParticles.length === 0) return;

    context.save();
    context.globalCompositeOperation = "lighter"; // 關鍵：讓顏色疊加產生高亮發光感

    effectParticles.forEach(p => {
        const alpha = Math.max(0, p.life / p.maxLife);
        context.globalAlpha = alpha;
        context.fillStyle = p.color;
        context.shadowColor = p.color;
        context.shadowBlur = p.size * 2.5; // 讓粒子自帶光暈
        
        context.beginPath();
        context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        context.fill();
    });

    context.restore();
}
// ============================================================================
// 以下為結算畫面的雙圖表繪製程式碼 (大字體清晰版)
// ============================================================================

// --- 1. 繪製單局 Buffer 壓力波動圖 ---
function drawGameOverChart(canvas, history) {
    if (!history || history.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    // ⚠️ 加大內部邊距，留空間給變大的字
    const padding = { top: 35, right: 30, bottom: 25, left: 55 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const minT = history[0].at;
    const maxT = history[history.length - 1].at;
    const duration = maxT - minT || 1;

    ctx.fillStyle = "rgba(255, 92, 124, 0.08)";
    ctx.fillRect(padding.left, padding.top, chartW, chartH * 0.2);

    // ⚠️ 字體放大並加粗
    ctx.font = "bold 13px 'Orbitron', 'Share Tech Mono', Consolas, monospace";

    const yTicks = [0, 50, 80, 100];
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    yTicks.forEach(tick => {
        const y = padding.top + chartH * (1 - tick / 100);
        ctx.strokeStyle = tick === 80 ? "rgba(255, 92, 124, 0.5)" : "rgba(145, 165, 181, 0.15)";
        ctx.lineWidth = tick === 80 ? 1.5 : 1;
        if (tick === 80) ctx.setLineDash([4, 4]); 
        
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
        ctx.setLineDash([]); 

        ctx.fillStyle = tick >= 80 ? "#ff5c7c" : "#91a5b5";
        ctx.fillText(tick + "%", padding.left - 8, y);
    });

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#91a5b5";
    ctx.fillText("0s", padding.left, h - padding.bottom + 8);
    ctx.fillText((duration / 1000).toFixed(1) + "s", padding.left + chartW, h - padding.bottom + 8);

    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#edf7ff";
    ctx.font = "bold 15px 'Orbitron', 'Share Tech Mono', Consolas, monospace"; // 標題字再放大
    ctx.fillText("SYSTEM LOAD", padding.left, padding.top - 12);
    
    // 圖例位置微調
    ctx.font = "bold 13px 'Orbitron', 'Share Tech Mono', Consolas, monospace";
    const legendX = w - padding.right - 70;
    const legendY = padding.top - 16;
    ctx.fillStyle = "#ff5c7c";
    ctx.beginPath();
    ctx.arc(legendX, legendY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#91a5b5";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("FLUSH", legendX + 10, legendY + 1);

    ctx.beginPath();
    ctx.strokeStyle = "#32d6ff";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#32d6ff";

    history.forEach((point, index) => {
        const x = padding.left + ((point.at - minT) / duration) * chartW;
        const y = padding.top + chartH * (1 - point.buffer / 100);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0; 

    history.forEach(point => {
        if (point.action === 'flush') {
            const x = padding.left + ((point.at - minT) / duration) * chartW;
            const y = padding.top + chartH * (1 - point.buffer / 100);
            ctx.fillStyle = "#ff5c7c"; 
            ctx.shadowColor = "#ff5c7c";
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    });
}

// --- 2. 繪製資料類型收集比例的五角雷達圖 ---
function drawTypeRadarChart(canvas, typeStats) {
    if (!typeStats) return;
    
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const categories = [
        { key: 'clean', label: 'CLEAN', color: '#66e28c' },
        { key: 'compressed', label: 'COMP', color: '#32d6ff' },
        { key: 'heavy', label: 'HEAVY', color: '#ffd166' },
        { key: 'virus', label: 'VIRUS', color: '#ff5c7c' },
        { key: 'junk', label: 'JUNK', color: '#91a5b5' }
    ];

    let maxVal = 1;
    const dataVals = categories.map(cat => {
        const stat = typeStats[cat.key] || { absorbed: 0, discarded: 0 };
        const total = stat.absorbed + stat.discarded; 
        if (total > maxVal) maxVal = total;
        return total;
    });

    const cx = w / 2;
    const cy = h / 2 + 14; 
    // ⚠️ 縮小一點點半徑，因為字變大了，避免字被切到
    const radius = Math.min(w, h) / 2 - 40; 

    ctx.strokeStyle = "rgba(145, 165, 181, 0.15)";
    ctx.lineWidth = 1;
    for (let level = 1; level <= 3; level++) {
        const r = radius * (level / 3);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI / 5);
            const px = cx + Math.cos(angle) * r;
            const py = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
    }

    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI / 5);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    ctx.stroke();

    ctx.beginPath();
    const points = [];
    for (let i = 0; i < 5; i++) {
        const valueRatio = Math.max(0.05, dataVals[i] / maxVal); 
        const r = radius * valueRatio;
        const angle = -Math.PI / 2 + (i * 2 * Math.PI / 5);
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        points.push({x: px, y: py});
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    
    ctx.fillStyle = "rgba(143, 124, 255, 0.35)"; 
    ctx.fill();
    ctx.strokeStyle = "#8f7cff";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#8f7cff";
    ctx.stroke();
    ctx.shadowBlur = 0; 

    // ⚠️ 字體放大並加粗
    ctx.font = "bold 13px 'Orbitron', 'Share Tech Mono', Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI / 5);
        const cat = categories[i];
        
        ctx.fillStyle = cat.color;
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // ⚠️ 把字往外推更遠一點，才不會跟頂點卡在一起
        const tx = cx + Math.cos(angle) * (radius + 20);
        const ty = cy + Math.sin(angle) * (radius + 18);
        ctx.fillText(cat.label, tx, ty);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#edf7ff";
    ctx.font = "bold 15px 'Orbitron', 'Share Tech Mono', Consolas, monospace"; // 標題放大
    ctx.fillText("DATA PROFILE", 14, 10);
}