/*
 * map.js
 * 這份檔案負責：地圖陣列轉平台資料、初始地圖選擇、地圖切換流程、平台轉場特效與地圖相關的狀態更新
 */

// 將地圖陣列轉成平台與危險格物件
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

// 取得初始遊戲地圖
async function chooseInitialMap() {
    const mapData = await fetch(`/api/get_next_map?forceIndex=${INITIAL_MAP_INDEX}`)
        .then((res) => res.json())
        .catch((error) => {
            console.error(error);
            return null;
        });
    return mapData;
}

// 取得平台的唯一識別字串，用來比對是否消失
function getPlatformKey(platform) {
    return `${Math.round(platform.x)}-${Math.round(platform.y)}-${Math.round(platform.w)}-${Math.round(platform.h)}-${platform.type}`;
}

// 建立地圖切換過程需要的轉場資料
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

// 當分數達標時，嘗試啟動下一張地圖的轉場
function maybeStartMapTransition() {
    if (!game?.running || game.mapTransition || game.score < game.nextMapSwapScore) return;

    if (!isFetchingMap && !nextMapData) {
        fetchNextMap(currentMapIndex).then((data) => {
            if (data) nextMapData = data;
        });
        return; // 等待下一張地圖資料載入完成
    }

    if (nextMapData) {
        const choice = nextMapData;
        nextMapData = null; // 已使用快取的地圖資料，清空避免重複使用
        const nextPlatforms = buildPlatforms(choice.map.mapArray);
        if (!nextPlatforms.length) return;

        game.mapTransition = createMapTransition(choice.index, nextPlatforms);

        while (game.score >= game.nextMapSwapScore) {
            game.nextMapSwapScore += MAP_SWAP_SCORE_STEP;
        }
    }
}

// 生成平台崩解時的粒子特效
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

// 更新地圖轉場中的粒子與平台切換時機
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
