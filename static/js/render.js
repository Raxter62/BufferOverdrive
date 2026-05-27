/*
 * render.js
 * 這份檔案負責：HUD、排行榜與分數顯示、特效、主遊戲畫面、開始畫面、說明畫面與 Game Over 結算畫面的所有繪製邏輯
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

// 將結算圖表交給 Plotly 繪製，並統一套用固定尺寸設定。
function renderPlotlyGameOverChart(container, data, layout) {
    if (!container) return;

    if (typeof Plotly === "undefined") {
        container.textContent = "Plotly unavailable";
        container.style.display = "grid";
        container.style.placeItems = "center";
        container.style.color = "#91a5b5";
        container.style.fontFamily = "Orbitron, 'Share Tech Mono', Consolas, monospace";
        container.style.fontSize = "12px";
        return;
    }

    Plotly.purge(container);
    Plotly.newPlot(container, data, layout, {
        displayModeBar: false,
        staticPlot: true
    }).catch((error) => console.error("Plotly render failed", error));
}

// 結算畫面中兩張 Plotly 圖表共用的固定尺寸。
const GAME_OVER_PLOT_WIDTH = 300;
const GAME_OVER_PLOT_HEIGHT = 200;

// 用 Plotly 繪製單場 Buffer 壓力變化折線圖。
function drawGameOverChart(container, history) {
    if (!container) return;
    if (!history || history.length === 0) {
        container.innerHTML = "";
        return;
    }

    const minT = history[0].at;
    const maxT = history[history.length - 1].at;
    const durationMs = Math.max(1, maxT - minT);
    const durationSeconds = durationMs / 1000;
    const xRangeMax = Math.max(0.1, durationSeconds);
    const bufferTrace = history.map((point) => ({
        x: (point.at - minT) / 1000,
        y: point.buffer
    }));
    const flushTrace = history
        .filter((point) => point.action === "flush")
        .map((point) => ({
            x: (point.at - minT) / 1000,
            y: point.buffer
        }));

    renderPlotlyGameOverChart(
        container,
        [
            {
                type: "scatter",
                mode: "lines",
                x: bufferTrace.map((point) => point.x),
                y: bufferTrace.map((point) => point.y),
                line: {
                    color: "#32d6ff",
                    width: 2.2
                },
                hoverinfo: "skip",
                showlegend: false
            },
            {
                type: "scatter",
                mode: "markers",
                name: "FLUSH",
                x: flushTrace.map((point) => point.x),
                y: flushTrace.map((point) => point.y),
                marker: {
                    color: "#ff5c7c",
                    size: 7
                },
                hoverinfo: "skip",
                showlegend: false
            }
        ],
        {
            width: GAME_OVER_PLOT_WIDTH,
            height: GAME_OVER_PLOT_HEIGHT,
            margin: { t: 26, r: 18, b: 22, l: 18, pad: 0 },
            showlegend: false,
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            xaxis: {
                domain: [0.02, 0.998],
                range: [0, xRangeMax],
                tickmode: "array",
                tickvals: [0, xRangeMax],
                ticktext: ["0s", `${durationSeconds.toFixed(1)}s`],
                tickfont: {
                    family: "Orbitron, 'Share Tech Mono', Consolas, monospace",
                    size: 9,
                    color: "#91a5b5"
                },
                showgrid: false,
                zeroline: false,
                showline: false,
                ticks: "",
                fixedrange: true
            },
            yaxis: {
                domain: [0.02, 0.995],
                range: [0, 100],
                tickmode: "array",
                tickvals: [20, 50, 80, 100],
                ticksuffix: "%",
                tickfont: {
                    family: "Orbitron, 'Share Tech Mono', Consolas, monospace",
                    size: 9,
                    color: "#91a5b5"
                },
                gridcolor: "rgba(145, 165, 181, 0.15)",
                zeroline: false,
                fixedrange: true
            },
            shapes: [
                {
                    type: "rect",
                    xref: "x",
                    yref: "y",
                    x0: 0,
                    x1: xRangeMax,
                    y0: 80,
                    y1: 100,
                    fillcolor: "rgba(255, 92, 124, 0.08)",
                    line: { width: 0 },
                    layer: "below"
                },
                {
                    type: "line",
                    xref: "x",
                    yref: "y",
                    x0: 0,
                    x1: xRangeMax,
                    y0: 80,
                    y1: 80,
                    line: {
                        color: "rgba(255, 92, 124, 0.5)",
                    width: 1.2,
                        dash: "dash"
                    }
                }
            ]
        }
    );
}

// 用 Plotly 繪製各資料型別處理量的雷達圖。
function drawTypeRadarChart(container, typeStats) {
    if (!container) return;
    if (!typeStats) {
        container.innerHTML = "";
        return;
    }

    const categories = [
        { key: "clean", label: "CLEAN", color: "#66e28c" },
        { key: "compressed", label: "COMP", color: "#32d6ff" },
        { key: "heavy", label: "HEAVY", color: "#ffd166" },
        { key: "virus", label: "VIRUS", color: "#ff5c7c" },
        { key: "junk", label: "JUNK", color: "#91a5b5" }
    ];
    const totals = categories.map((category) => {
        const stat = typeStats[category.key] || { absorbed: 0, discarded: 0 };
        return stat.absorbed + stat.discarded;
    });
    const maxVal = Math.max(1, ...totals);
    const radarRangeMax = maxVal * 1.2;
    const labelRadius = maxVal * 1.1;
    const theta = categories.map((category) => category.label);
    const closedTheta = [...theta, theta[0]];
    const closedTotals = [...totals, totals[0]];

    renderPlotlyGameOverChart(
        container,
        [
            {
                type: "scatterpolar",
                mode: "lines+markers",
                r: closedTotals,
                theta: closedTheta,
                fill: "toself",
                fillcolor: "rgba(143, 124, 255, 0.35)",
                line: {
                    color: "#8f7cff",
                    width: 1.8
                },
                marker: {
                    size: 7,
                    color: [...categories.map((category) => category.color), categories[0].color]
                },
                hoverinfo: "skip",
                showlegend: false
            },
            {
                type: "scatterpolar",
                mode: "text",
                r: categories.map(() => labelRadius),
                theta,
                text: theta,
                textfont: {
                    family: "Orbitron, 'Share Tech Mono', Consolas, monospace",
                    size: 10,
                    color: categories.map((category) => category.color)
                },
                hoverinfo: "skip",
                showlegend: false
            }
        ],
        {
            width: GAME_OVER_PLOT_WIDTH,
            height: GAME_OVER_PLOT_HEIGHT,
            margin: { t: 24, r: 12, b: 2, l: 12, pad: 0 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            polar: {
                domain: {
                    x: [0, 1],
                    y: [0, 1]
                },
                bgcolor: "rgba(0,0,0,0)",
                radialaxis: {
                    range: [0, radarRangeMax],
                    tickmode: "array",
                    tickvals: [maxVal / 3, (maxVal * 2) / 3, maxVal],
                    ticktext: ["", "", ""],
                    gridcolor: "rgba(145, 165, 181, 0.15)",
                    linecolor: "rgba(145, 165, 181, 0.15)",
                    angle: 90,
                    showline: false,
                    ticks: "",
                    fixedrange: true
                },
                angularaxis: {
                    tickmode: "array",
                    tickvals: theta,
                    ticktext: categories.map(() => ""),
                    gridcolor: "rgba(145, 165, 181, 0.15)",
                    linecolor: "rgba(145, 165, 181, 0.15)",
                    ticks: "",
                    rotation: 90,
                    direction: "clockwise",
                    fixedrange: true
                }
            }
        }
    );
}


// 將毫秒轉成結算畫面與戰報 PDF 使用的遊玩時間。
function formatReportDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// 使用瀏覽器 JS 時間格式化戰報時間，符合使用者要求的前端時間來源。
function formatReportDateTime(date) {
    const safeDate = date instanceof Date ? date : new Date(date || Date.now());
    return safeDate.toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });
}

// 建立 Game Over 結算面板統計與兩張 Plotly 圖表。
function renderGameOverPanel() {
    const endedAt = game.endedAt instanceof Date ? game.endedAt : new Date();
    game.endedAt = endedAt;
    const endedAtText = formatReportDateTime(endedAt);
    const durationText = formatReportDuration(game.elapsedMs);
    game.reportSummary = {
        score: game.score,
        handled: game.handled,
        absorbed: game.absorbed,
        discarded: game.discarded,
        autoAbsorbed: game.autoAbsorbed,
        flushes: game.flushes,
        endedAt: endedAtText,
        duration: durationText
    };

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

    // 把 JS 產生的結束時間顯示在結算畫面，並同步進 PDF 戰報。
    ui.finalStats.insertAdjacentHTML("beforeend", `
        <div class="game-over-time">
            <span>ENDED: <strong>${endedAtText}</strong></span>
            <span>DURATION: <strong>${durationText}</strong></span>
        </div>
    `);

    const chartsContainer = document.createElement("div");
    chartsContainer.style.display = "flex";
    chartsContainer.style.gap = "12px";
    chartsContainer.style.marginTop = "16px";
    chartsContainer.style.width = "100%";
    chartsContainer.style.justifyContent = "center";
    chartsContainer.style.alignItems = "flex-start";

    const lineChart = document.createElement("div");
    lineChart.className = "game-over-chart game-over-chart--line";
    lineChart.innerHTML = `
        <div class="game-over-chart__title">SYSTEM LOAD</div>
        <div class="game-over-chart__legend">
            <span class="game-over-chart__legend-dot"></span>
            FLUSH
        </div>
        <div class="game-over-chart__plot"></div>
    `;
    chartsContainer.appendChild(lineChart);

    const radarChart = document.createElement("div");
    radarChart.className = "game-over-chart game-over-chart--radar";
    radarChart.innerHTML = `
        <div class="game-over-chart__title">DATA PROFILE</div>
        <div class="game-over-chart__plot"></div>
    `;
    chartsContainer.appendChild(radarChart);

    ui.finalStats.appendChild(chartsContainer);
    drawGameOverChart(lineChart.querySelector(".game-over-chart__plot"), game.history);
    drawTypeRadarChart(radarChart.querySelector(".game-over-chart__plot"), game.typeStats);
    ui.gameOverPanel.classList.remove("hidden");
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

// 繪製 Freeze 狀態圖示，剩餘 2 秒內會開始閃爍提醒。
function drawFreezeStatusHud(context) {
    const remainingMs = Math.max(0, slowMoTimerMs);
    if (remainingMs <= 0) return;

    const source = getSkillSheetCell("freeze");
    const blinkWindow = remainingMs <= 2000;
    const blink = blinkWindow ? (Math.sin(globalAnimTimer / 9) + 1) / 2 : 1;
    const iconAlpha = blinkWindow ? 0.35 + blink * 0.65 : 1;
    const size = 26;
    const x = 46;
    const y = 52;

    context.save();
    context.globalAlpha = iconAlpha;
    context.shadowColor = blinkWindow ? "rgba(50, 214, 255, 0.68)" : "rgba(50, 214, 255, 0.35)";
    context.shadowBlur = blinkWindow ? 12 : 8;
    if (source) {
        context.drawImage(source.image, source.x, source.y, source.w, source.h, x, y, size, size);
    }
    context.restore();
}

// 更新右側 HUD 的數字、封包說明與決策進度條。
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

// 依照封包圖示索引繪製掉落物。
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
    context.restore();
}

// 繪製 Boss 反轉控制技能生效時的全畫面提示濾鏡。
function drawReverseControlsOverlay(context) {
    const remainingMs = Math.max(0, game?.bossSkill?.reverseControlsMs ?? 0);
    if (remainingMs <= 0) return;

    const blinkWindow = remainingMs <= 2000;
    const pulse = blinkWindow
        ? 0.35 + ((Math.sin(globalAnimTimer * 0.22) + 1) / 2) * 0.28
        : 0.46 + Math.sin(globalAnimTimer * 0.18) * 0.12;

    context.save();
    context.fillStyle = `rgba(70, 210, 255, ${0.08 + pulse * 0.12})`;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (Math.floor(visualAnimMs / 110) % 2 === 0) {
        context.fillStyle = "rgba(120, 220, 255, 0.05)";
        context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    context.restore();
}

// 繪製左上角的執行中訊息佇列，依觸發順序排序並在補位時做平滑動畫
function drawExecutionStatusBanners(context) {
    const banners = [];

    if (game.flushPauseMs > 0) {
        banners.push({
            key: "flush",
            text: "FLUSH EXECUTING...",
            color: "#ffd166",
            startedAt: flushBannerStartMs ?? visualAnimMs
        });
    }

    if (slowMoTimerMs > 0) {
        banners.push({
            key: "freeze",
            text: "FREEZE EXECUTING...",
            color: "#32d6ff",
            startedAt: freezeBannerStartMs ?? visualAnimMs
        });
    }

    if ((game?.bossSkill?.reverseControlsMs ?? 0) > 0) {
        banners.push({
            key: "reverse",
            text: "CONTROLS INVERTED...",
            color: "#66e28c",
            startedAt: visualAnimMs - (game.bossSkill.reverseControlsMs ?? 0)
        });
    }

    if (Math.max(game?.bossSkill?.burstLeadMs ?? 0, game?.bossSkill?.burstAfterMs ?? 0) > 0) {
        banners.push({
            key: "warning",
            text: "SYSTEM WARNING...",
            color: "#ff5c7c",
            startedAt: visualAnimMs - Math.max(game.bossSkill.burstLeadMs ?? 0, game.bossSkill.burstAfterMs ?? 0)
        });
    }

    if (banners.length === 0) return;

    const baseX = 18;
    const baseY = 105;
    const slotGap = 24;

    banners.sort((a, b) => a.startedAt - b.startedAt);

    banners.forEach((banner, index) => {
        const targetY = baseY + index * slotGap;
        const currentY = executionBannerPositions[banner.key] ?? targetY;
        const nextY = currentY + (targetY - currentY) * 0.22;
        executionBannerPositions[banner.key] = Math.abs(targetY - nextY) < 0.35 ? targetY : nextY;

        context.save();
        context.fillStyle = banner.color;
        context.shadowColor = banner.color;
        context.shadowBlur = 8;
        setArcadeFont(context, 18);
        context.fillText(banner.text, baseX, executionBannerPositions[banner.key]);
        context.restore();
    });
}

// 繪製 Boss 噴發技能警告與施放期間的全畫面閃爍。
function drawBossSkillWarningOverlay(context) {
    const skill = game?.bossSkill;
    if (!skill) return;

    const activeMs = Math.max(skill.burstLeadMs ?? 0, skill.burstAfterMs ?? 0);
    if (activeMs <= 0) return;

    const pulse = 0.42 + Math.sin(globalAnimTimer * 0.22) * 0.18;

    context.save();
    context.fillStyle = `rgba(255, 92, 124, ${0.11 + pulse * 0.18})`;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (Math.floor(visualAnimMs / 90) % 2 === 0) {
        context.fillStyle = "rgba(255, 184, 84, 0.07)";
        context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    context.restore();
}

// 繪製擊敗 Boss 後解鎖 Endless 模式的提示字樣。
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
    // 玩家死亡時只保留原本黑化效果，不再混入震動、粒子或冰凍濾鏡
    const preserveDeathOnly = Boolean(player?.dead);
    ctx.save();

    // 死亡時改用兩下大力震動，一般情況才使用平常的粒子震動
    if (preserveDeathOnly && deathShakeMs > 0) {
        const progress = 1 - deathShakeMs / DEATH_SHAKE_DURATION_MS;
        const amplitude = (1 - progress) * 18;
        const pulse = Math.sin(progress * Math.PI * 4);
        ctx.translate(pulse * amplitude, Math.cos(progress * Math.PI * 4) * amplitude * 0.12);
    } else if (!preserveDeathOnly && screenShakeMs > 0) {
        const dx = (Math.random() - 0.5) * screenShakeIntensity;
        const dy = (Math.random() - 0.5) * screenShakeIntensity;
        ctx.translate(dx, dy);
    }

    // 1. 先畫最底層的背景
    drawBackground(ctx);

    // 2. 畫地圖與物件
    platforms.forEach((platform) => drawPlatform(ctx, platform));
    drawMapTransition(ctx);
    drops.forEach((drop) => {
        if (drop?.renderLayer === "bossBurstFront") return;
        drop.draw(ctx);
    });
    drawTrashZone(ctx);

    // 3. 畫 Boss
    if (game.boss && game.boss.active) {
        drawBossVisual(ctx);
    }

    // 4. 畫玩家與特效
    drawPendingPulse(ctx);
    drawDeathOverlay(ctx);
    player.draw(ctx);
    if (!preserveDeathOnly) {
        drawEffectParticles(ctx);
    }
    drops.forEach((drop) => {
        if (drop?.renderLayer !== "bossBurstFront") return;
        drop.draw(ctx);
    });

    ctx.restore(); // 復原畫布偏移，確保 UI 介面維持固定不晃動
    // --- 新增：時空凍結 (緩速) 發動時的螢幕濾鏡 ---
    if (!preserveDeathOnly && slowMoTimerMs > 0) {
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
    drawReverseControlsOverlay(ctx);
    drawBossSkillWarningOverlay(ctx);
    drawExecutionStatusBanners(ctx);
    drawEndlessUnlockedBanner(ctx);
    drawBufferHud(ctx);
    drawTopRightSkillHud(ctx);
    drawRiskStatusHud(ctx);
    drawFreezeStatusHud(ctx);
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
function drawGuideSpriteFrame(context, image, frame, x, y, w, h) {
    if (!image?.complete || !frame) return;
    context.drawImage(image, frame.x, frame.y, frame.w, frame.h, x, y, w, h);
}

// 在教學畫面繪製單顆街機按鈕圖示。
function drawGuideButtonIcon(context, key, x, y, active) {
    const button = SPRITE_CONFIG.arcadeButtons[key];
    const frame = (active ? button.down : button.up)[0];
    drawGuideSpriteFrame(context, images.arcadeButtons, frame, x, y, 32, 32);
}

// 在教學畫面繪製搖桿方向示意。
function drawGuideStickIcon(context, x, y, direction) {
    const stick = SPRITE_CONFIG.arcadeStick[direction] || SPRITE_CONFIG.arcadeStick.idle;
    drawGuideSpriteFrame(context, images.arcadeStick, stick.frames[0], x, y, 42, 54);
}

// 在教學畫面補上 Combo 視覺提示。
function drawGuideComboIcon(context, x, y) {
    const comboImage = images.combo3;

    context.save();
    if (comboImage?.complete) {
        context.drawImage(comboImage, x, y - 16, 42, 42);
    }
    context.fillStyle = "#ffd166";
    context.shadowColor = "rgba(255, 107, 0, 0.55)";
    context.shadowBlur = 8;
    setArcadeFont(context, 12, 900);
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText("x3", x + 46, y + 6);
    context.restore();
}

// 用圖示說明移動、決策、Flush、Combo 與失敗條件。
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

    // 掃描線與漂移色塊營造教學面板的電子雜訊感。
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
    setArcadeFont(context, 18, 700);
    const lineX = 64;
    const iconGap = 12;
    const lineStartY = 146;
    const lineGap = 26;
    const moveText = "MOVE: A / D or LEFT / RIGHT";
    const jumpText = "JUMP: SPACE";
    const dashText = "DASH: SHIFT";
    const decisionText = "DECISION DATA: J absorb, K discard";
    const flushText = "HOLD K for FLUSH (reduce buffer)";
    const comboText = "COMBO: increases the fractional rate";
    const trashText = "FALL TO TRASH ZONE: BUFFER + 20%";
    const gameOverText = "GAMEOVER: BUFFER reaches 100%";

    // 逐行繪製說明文字，並為圖示示意保留對應位置。
    const guideLines = [
        { text: moveText, y: lineStartY },
        { text: jumpText, y: lineStartY + lineGap * 1 },
        { text: dashText, y: lineStartY + lineGap * 2 },
        { text: decisionText, y: lineStartY + lineGap * 3 },
        { text: flushText, y: lineStartY + lineGap * 4 },
        { text: comboText, y: lineStartY + lineGap * 5 },
        { text: trashText, y: lineStartY + lineGap * 6 },
        { text: gameOverText, y: lineStartY + lineGap * 7 }
    ];
    guideLines.forEach(({ text, y }) => {
        context.fillText(text, lineX, y);
    });

    const moveIconX = lineX + context.measureText(moveText).width + iconGap;
    const jumpIconX = lineX + context.measureText(jumpText).width + iconGap;
    const dashIconX = lineX + context.measureText(dashText).width + iconGap;
    const decisionIconX = lineX + context.measureText(decisionText).width + iconGap;
    const flushIconX = lineX + context.measureText(flushText).width + iconGap;
    const comboIconX = lineX + context.measureText(comboText).width + iconGap;
    const trashIconX = lineX + context.measureText(trashText).width + iconGap;
    const gameOverIconX = lineX + context.measureText(gameOverText).width + iconGap;

    drawGuideStickIcon(context, moveIconX, lineStartY - 24, moveRight ? "right" : "left");
    drawGuideButtonIcon(context, "c", jumpIconX, lineStartY + lineGap * 1 - 14, jumpActive);
    drawGuideButtonIcon(context, "d", dashIconX, lineStartY + lineGap * 2 - 14, dashActive);

    drawDropIcon(context, goodPacket ? DATA_TYPES.clean.sprite : DATA_TYPES.junk.sprite, decisionIconX, lineStartY + lineGap * 3 - 12, 22, 22);
    drawGuideButtonIcon(context, goodPacket ? "a" : "b", decisionIconX + 30, lineStartY + lineGap * 3 - 14, true);

    drawGuideButtonIcon(context, "b", flushIconX, lineStartY + lineGap * 4 - 14, flushActive);
    drawGuideComboIcon(context, comboIconX, lineStartY + lineGap * 5 - 2);

    context.save();
    context.fillStyle = "rgba(255, 92, 124, 0.18)";
    context.fillRect(trashIconX, lineStartY + lineGap * 6 - 8, 84, 16);
    context.strokeStyle = "rgba(255, 92, 124, 0.85)";
    context.lineWidth = 2;
    context.strokeRect(trashIconX, lineStartY + lineGap * 6 - 8, 84, 16);
    context.fillStyle = "#ff5c7c";
    setArcadeFont(context, 7, 900);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("TRASH", trashIconX + 42, lineStartY + lineGap * 6 + 1);
    context.restore();

    context.save();
    context.fillStyle = "rgba(0, 0, 0, 0.72)";
    context.fillRect(gameOverIconX, lineStartY + lineGap * 7 - 6, 84, 12);
    context.strokeStyle = "rgba(237, 247, 255, 0.28)";
    context.lineWidth = 1;
    context.strokeRect(gameOverIconX, lineStartY + lineGap * 7 - 6, 84, 12);
    context.fillStyle = bufferRatio >= 0.82 ? "#ff5c7c" : bufferRatio >= 0.55 ? "#ffd166" : "#66e28c";
    context.fillRect(gameOverIconX + 2, lineStartY + lineGap * 7 - 4, Math.round(80 * bufferRatio), 8);
    context.restore();

    const blinkAlpha = 0.3 + (Math.sin(t / 360) + 1) * 0.3;
    context.fillStyle = `rgba(255, 255, 255, ${blinkAlpha.toFixed(3)})`;
    setArcadeFont(context, 14, 700);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("PRESS ANY BUTTON TO START", GAME_WIDTH / 2, GAME_HEIGHT - 40);
    context.restore();
}


// 建立打擊回饋需要的畫面震動與爆炸粒子。
function triggerJuice(x, y, color, count, shakeIntensity, shakeDuration) {
    screenShakeIntensity = shakeIntensity;
    screenShakeMs = shakeDuration;

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        effectParticles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 300 + Math.random() * 300,
            maxLife: 600,
            size: Math.random() * 3 + 2,
            color
        });
    }
}

// 繪製打擊回饋使用的爆炸粒子特效。
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

// 顯示輸入 email 的戰報寄送視窗。
function openReportDialog() {
    if (!ui.reportDialog || !game || game.running) return;
    ui.reportDialog.classList.remove("hidden");
    ui.reportDialogMessage.textContent = "輸入您的電子郵件寄送戰報";
    ui.reportEmailInput.value = "";
    ui.reportEmailInput.classList.remove("hidden");
    ui.reportEmailInput.disabled = false;
    ui.reportSubmitButton.disabled = false;
    ui.reportCancelButton.classList.remove("hidden");
    ui.reportSubmitButton.classList.remove("hidden");
    ui.reportCloseButton.classList.add("hidden");
    setReportFeedback("", "");
    setTimeout(() => ui.reportEmailInput.focus(), 0);
}

// 關閉寄送視窗並回到原本的結算畫面。
function closeReportDialog() {
    if (!ui.reportDialog) return;
    ui.reportDialog.classList.add("hidden");
    ui.saveReportButton.disabled = false;
}

function setReportFeedback(message, state) {
    if (!ui.reportFeedback) return;
    ui.reportFeedback.textContent = message;
    ui.reportFeedback.classList.toggle("is-error", state === "error");
    ui.reportFeedback.classList.toggle("is-success", state === "success");
}

function setReportSending(isSending) {
    ui.saveReportButton.disabled = isSending;
    ui.reportSubmitButton.disabled = isSending;
    ui.reportEmailInput.disabled = isSending;
    // 寄送期間維持 loading 訊息在畫面上，避免使用者以為視窗被關掉。
    setReportFeedback(isSending ? "正在產生 PDF 並寄送..." : "", "");
}

function buildBattleReportFilename() {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `buffer-overdrive-report-${stamp}.pdf`;
}

async function waitForReportRenderReady() {
    if (document.fonts?.ready) {
        await document.fonts.ready;
    }

    // 等待 Plotly SVG 與瀏覽器 layout 完成，避免 PDF 截到空白圖表。
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, 180));
}

async function generateBattleReportPdfBase64() {
    if (typeof html2canvas === "undefined" || !window.jspdf?.jsPDF) {
        throw new Error("PDF library unavailable");
    }

    await waitForReportRenderReady();

    // 截圖時只讓 html2canvas 忽略 dialog，實際畫面仍保留 loading 狀態。
    ui.gameOverPanel.classList.add("is-capturing-report");
    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
        const canvas = await html2canvas(ui.gameOverPanel, {
            backgroundColor: "#071018",
            ignoreElements: (element) => element?.id === "reportDialog",
            scale: 2,
            useCORS: true
        });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 24;
        const ratio = Math.min(
            (pageWidth - margin * 2) / canvas.width,
            (pageHeight - margin * 2) / canvas.height
        );
        const imageWidth = canvas.width * ratio;
        const imageHeight = canvas.height * ratio;
        const imageX = (pageWidth - imageWidth) / 2;
        const imageY = (pageHeight - imageHeight) / 2;

        // PDF 以整張結算畫面截圖呈現，確保圖表、分數、時間都被包含。
        pdf.setFillColor(7, 16, 24);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", imageX, imageY, imageWidth, imageHeight);

        return pdf.output("datauristring").split(",", 2)[1];
    } finally {
        ui.gameOverPanel.classList.remove("is-capturing-report");
    }
}

async function submitBattleReport(event) {
    event.preventDefault();
    if (!ui.reportEmailInput || !game || game.running) return;

    const email = ui.reportEmailInput.value.trim();
    if (!email) {
        setReportFeedback("請輸入電子郵件。", "error");
        return;
    }

    setReportSending(true);

    try {
        const filename = buildBattleReportFilename();
        const pdfBase64 = await generateBattleReportPdfBase64();
        const response = await fetch("/api/send_report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email,
                filename,
                pdfBase64,
                logId: game.reportLogId,
                summary: game.reportSummary || {}
            })
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.detail || "Report email failed");
        }

        ui.reportDialogMessage.textContent = "寄送成功";
        ui.reportEmailInput.classList.add("hidden");
        ui.reportCancelButton.classList.add("hidden");
        ui.reportSubmitButton.classList.add("hidden");
        ui.reportCloseButton.classList.remove("hidden");
        setReportFeedback("戰報已寄出，請查看您的信箱。", "success");
    } catch (error) {
        console.error("Battle report failed", error);
        setReportFeedback(error.message || "寄送失敗，請稍後再試。", "error");
    } finally {
        ui.saveReportButton.disabled = false;
        ui.reportSubmitButton.disabled = false;
        ui.reportEmailInput.disabled = false;
    }
}
