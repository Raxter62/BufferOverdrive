/*
 * boss.js
 * 這份檔案負責：Boss 生成、受傷同步，以及 Boss 的畫面繪製。
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
}
