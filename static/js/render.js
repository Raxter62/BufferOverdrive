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
        ui.packetName.textContent = "??";
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
