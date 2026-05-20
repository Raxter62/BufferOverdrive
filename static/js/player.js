/*
 * player.js
 * 這份檔案負責：玩家角色與掉落物件的資料結構、移動更新、動畫狀態與自身繪製邏輯
 * 遊戲規則判定（吸收、丟棄、Flush、碰撞後處理）會交給 gameplay.js
 */

// 掉落資料物件：負責移動、存在狀態與自身繪製
class DropData {
    constructor(x, y, typeKey = chooseDataType(), options = {}) {
        // 掉落物的基本位置、尺寸與類型
        this.x = x;
        this.y = y;
        this.w = 28;
        this.h = 28;
        this.typeKey = typeKey;

        // 掉落物的移動與物理狀態
        this.vx = options.vx ?? 0;
        this.vy = options.vy ?? randomBetween(1.2, 2.8);
        this.active = true;
        this.fromFlush = options.fromFlush ?? false;
        this.fromDiscard = options.fromDiscard ?? false;
        this.canCollide = options.canCollide ?? true;
        this.noGravityMs = Math.max(0, options.noGravityMs ?? 0);
        this.spin = Math.random() * Math.PI * 2;
    }

    // 更新掉落物的位置、速度與存活狀態
    update(step, speedScale = 1) {
        if (!this.active) return;

        const scaledStep = step * speedScale;

        if (this.noGravityMs > 0) {
            this.noGravityMs = Math.max(0, this.noGravityMs - step * 16.67);
        } else if (this.fromFlush || this.fromDiscard) {
            this.vy += 0.24 * scaledStep;
            this.vx *= Math.pow(0.992, scaledStep);
        }

        this.x += this.vx * scaledStep;
        this.y += this.vy * scaledStep;
        this.spin += 0.08 * scaledStep;

        if (this.x < -40 || this.x > GAME_WIDTH + 40 || this.y > GAME_HEIGHT + 48) {
            this.active = false;
        }
    }

    // 繪製掉落物本體，以及 Flush / 丟棄時的外圈特效
    draw(context) {
        if (!this.active) return;

        // Freeze 技能球使用獨立的視覺表現，避免和一般封包混淆。
        if (this.typeKey === "skill_freeze") {
            context.save();
            context.translate(this.x + this.w / 2, this.y + this.h / 2);
            context.rotate(this.spin); // 讓球體有一點旋轉感

            // 畫發光外圈
            context.shadowBlur = 15;
            context.shadowColor = "#32d6ff";
            context.fillStyle = "rgba(0,0,0,0.8)";
            context.strokeStyle = "#32d6ff";
            context.lineWidth = 3;
            context.beginPath();
            context.arc(0, 0, this.w / 2, 0, Math.PI * 2);
            context.fill();
            context.stroke();

            // 畫中心圖示 (使用雪花/星號 *)
            setArcadeFont(context, 16, 900);
            context.fillStyle = "#32d6ff";
            context.textAlign = "center";
            context.textBaseline = "middle";
            setArcadeFont(context, 16, 900);
            context.fillText("*", 0, 2);

            context.restore();
            return;
        }

        const data = DATA_TYPES[this.typeKey];
        if (!data) {
            // 後端可能丟出前端尚未定義的類型（例如未實作的技能球）
            // 將此封包標記為無效，避免每幀都嘗試繪製造成 game loop crash
            this.active = false;
            return;
        }
        drawDropIcon(context, data.sprite, this.x, this.y, this.w, this.h);

        // Flush 與丟棄形成的拋物線封包外圈會加上提示光環。
        if (this.fromFlush || this.fromDiscard) {
            context.save();
            context.globalAlpha = 0.35;
            context.strokeStyle = data.color;
            context.lineWidth = 2;
            context.beginPath();
            context.arc(this.x + this.w / 2, this.y + this.h / 2, 18 + Math.sin(this.spin) * 2, 0, Math.PI * 2);
            context.stroke();
            context.restore();
        }
    }
}

// 玩家角色類別：負責移動、跳躍、衝刺、受擊與動畫更新
class Player {
    constructor() {
        // 玩家初始位置與碰撞尺寸
        this.x = 96; // 玩家重生時的起始 X 座標
        this.y = 320; // 玩家重生時的起始 Y 座標
        this.prevY = this.y;
        this.w = 32;
        this.h = 36;

        // 玩家移動、朝向與地面狀態
        this.vx = 0;
        this.vy = 0;
        this.facingRight = true;
        this.grounded = false;
        this.state = "idle";

        // 玩家技能、無敵與動畫控制
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.invincible = false;
        this.damageInvincibleMs = 0;
        this.animTimer = 0;
        this.animFrame = 0;
        this.idleFrameMs = 0;
        this.dead = false;
        this.deathFrameIndex = 0;
        this.deathTimer = null;
    }

    // 依輸入與物理參數更新玩家位置、速度與動畫狀態
    update(dt) {
        if (this.dead) return;

        const step = dt / 16.67;
        const speed = 4.1;
        const gravity = 0.55;
        const jumpForce = -10.8;

        this.prevY = this.y;
        this.dashCooldown = Math.max(0, this.dashCooldown - dt);
        this.damageInvincibleMs = Math.max(0, this.damageInvincibleMs - dt);
        this.invincible = this.damageInvincibleMs > 0;

        if (this.dashTimer > 0) {
            this.dashTimer -= dt;
            this.invincible = true;
            this.state = "dash";
            this.vx = this.facingRight ? 10.5 : -10.5;
        } else {
            if (keys.left) {
                this.vx = -speed;
                this.facingRight = false;
                this.state = this.grounded ? "move" : "jump";
            } else if (keys.right) {
                this.vx = speed;
                this.facingRight = true;
                this.state = this.grounded ? "move" : "jump";
            } else {
                this.vx *= Math.pow(0.78, step);
                if (Math.abs(this.vx) < 0.06) this.vx = 0;
                this.state = this.grounded ? "idle" : "jump";
            }

            if (justPressed.jump && this.grounded) {
                this.vy = jumpForce;
                this.grounded = false;
                this.state = "jump";
            }

            // 提前放開跳躍鍵時，縮短上升高度，讓跳躍手感更靈活
            if (!keys.jump && this.vy < -3.5) {
                this.vy = -3.5;
            }

            if (justPressed.dash && this.dashCooldown <= 0) {
                this.dashTimer = 160;
                this.dashCooldown = DASH_COOLDOWN_MS;
                this.invincible = true;
                this.state = "dash";
            }
        }

        this.vy += gravity * step;
        this.x += this.vx * step;
        this.y += this.vy * step;

        this.x = clamp(this.x, 0, GAME_WIDTH - this.w);

        if (this.state === "idle") {
            this.idleFrameMs += dt;
            if (this.idleFrameMs >= IDLE_FRAME_INTERVAL_MS) {
                this.idleFrameMs = 0;
                this.animFrame = (this.animFrame + 1) % SPRITE_CONFIG.idleFrames.length;
            }
        } else {
            this.idleFrameMs = 0;
            this.animFrame = 0;
        }
    }

    // 讓玩家在重生後短暫進入無敵狀態
    setRespawnInvincible() {
        this.damageInvincibleMs = RESPAWN_INVINCIBLE_MS;
    }

    // 觸發玩家死亡狀態，並切換到死亡動畫
    triggerDeath() {
        if (this.dead) return;

        this.dead = true;
        this.state = "death";
        this.vx = 0;
        this.vy = 0;
        this.deathFrameIndex = 0;

        if (this.deathTimer) {
            clearTimeout(this.deathTimer);
        }

        this.deathTimer = setTimeout(() => {
            this.deathFrameIndex = 1;
        }, DEATH_FRAME_SWITCH_MS);
    }

    // 依玩家目前狀態選擇對應動畫並繪製到畫面上
    draw(context) {
        let frames = SPRITE_CONFIG.idleFrames;
        let image = images.idleWaiting;
        let frameIndex = this.animFrame;

        if (this.dead || this.state === "death") {
            frames = SPRITE_CONFIG.deathFrame;
            image = images.idleAction;
        } else if (game.flushPauseMs > 0) {
            frames = SPRITE_CONFIG.skillFrames;
            image = images.useSkill;
        } else if (this.state === "move") {
            frames = this.facingRight ? SPRITE_CONFIG.moveRight : SPRITE_CONFIG.moveLeft;
            image = images.idleAction;
        } else if (this.state === "dash") {
            frames = this.facingRight ? SPRITE_CONFIG.dashRight : SPRITE_CONFIG.dashLeft;
            image = images.idleAction;
        } else if (this.state === "jump") {
            frames = SPRITE_CONFIG.jumpFull;
            image = images.idleAction;
        }

        if (this.dead) {
            frameIndex = Math.min(this.deathFrameIndex, frames.length - 1);
        } else if (game.flushPauseMs > 0) {
            frameIndex = Math.floor(visualAnimMs / SKILL_FRAME_INTERVAL_MS) % frames.length;
        }

        const frame = frames[frameIndex] || frames[0];
        const drawW = frame.w * 1.55;
        const drawH = frame.h * 1.55;

        context.save();
        if (this.damageInvincibleMs > 0) {
            context.globalAlpha = 0.42 + (Math.floor(visualAnimMs / 90) % 2) * 0.38;
            context.shadowColor = "#32d6ff";
            context.shadowBlur = 18;
        } else if (this.invincible) {
            context.globalAlpha = 0.82;
            context.shadowColor = "#32d6ff";
            context.shadowBlur = 18;
        }
        context.translate(this.x + this.w / 2, this.y + this.h / 2);
        context.drawImage(image, frame.x, frame.y, frame.w, frame.h, -drawW / 2, -drawH / 2, drawW, drawH);
        context.restore();

        // 玩家頭上會顯示目前正在等待決策的資料
        if (game.pending && !this.dead) {
            const data = DATA_TYPES[game.pending.typeKey];
            drawDropIcon(context, data.sprite, this.x + this.w / 2 - 14, this.y - 34, 28, 28);
        }
    }
}
