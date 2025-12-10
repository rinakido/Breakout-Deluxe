//ブロック崩しゲーム


const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

// === ゲーム変数 ===
let gameStarted = false;
let level = 1;
let score = 0;
let combo = 0;
let comboTimer = null;
let fever = false;

// ボール
let x = W / 2;
let y = H - 60;
let dx = 3;
let dy = -3;
const ballRadius = 8;

// パドル
let paddleWidth = 100;
const paddleHeight = 12;
let paddleX = (W - paddleWidth) / 2;
const PADDLE_Y_PAD = 20;

// 入力
let rightPressed = false;
let leftPressed = false;
let mouseX = null;
let useMouse = true;

// ブロック
let brickRowCount = 4;
let brickColumnCount = 8;
let brickWidth = 60;
let brickHeight = 20;
let brickPadding = 8;
let brickOffsetTop = 60;
let brickOffsetLeft = 30;
let bricks = [];

// アイテム＆パーティクル
let items = []; // {x,y,type,vy}
let particles = [];

// 音（安全に読み込み）
let soundHit = null, soundBlock = null, soundOver = null;
try {
    soundHit = new Audio("hit.mp3");
    soundBlock = new Audio("block.mp3");
    soundOver = new Audio("over.mp3");
} catch (e) { /* ignore if not available */ }

// ---- Helper ----
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function rand(min,max){ return Math.random()*(max-min)+min; }

// === 初期化ブロック ===
function initBricks() {
    bricks = [];
    for (let c=0;c<brickColumnCount;c++){
        bricks[c]=[];
        for (let r=0;r<brickRowCount;r++){
            // 振り分け：上の行ほど硬い
            let hits = 1;
            if (r === 0) hits = 2; // top row requires 2 hits
            // color set by hits/type
            bricks[c][r] = {
                x: 0, y:0, status: 1, hits: hits, type: hits // type = hits for now
            };
        }
    }
}
initBricks();

// === UI 更新 ===
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const comboEl = document.getElementById("combo");
function updateHUD(){
    scoreEl.textContent = `Score: ${score}`;
    levelEl.textContent = `Level: ${level}`;
    comboEl.textContent = `Combo: ${combo}`;
}

// === パーティクル生成 ===
function spawnParticles(cx, cy, color){
    for (let i=0;i<12;i++){
        particles.push({
            x: cx + rand(-10,10),
            y: cy + rand(-6,6),
            vx: rand(-2.5,2.5),
            vy: rand(-3, -0.5),
            life: 40 + Math.floor(rand(0,20)),
            color: color || "#fff"
        });
    }
}
// === アイテムドロップ ===
// === アイテムを落とす ===
function dropItemAt(x, y){
    // 20% の確率で落とす
    if (Math.random() < 0.20){
        const t = Math.floor(Math.random() * 3); 
        items.push({
            x: x,
            y: y,
            type: t,     // 0:パドル拡大, 1:スロー, 2:スコア2倍
            vy: 2 + Math.random()*1.5
        });
    }
}


function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += Math.PI / spikes;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += Math.PI / spikes;
    }
    ctx.closePath();
    ctx.fillStyle = "#FFD700"; // gold
    ctx.fill();
}

// === コンボ処理 ===
function addCombo(){
    combo++;
    clearTimeout(comboTimer);
    comboTimer = setTimeout(()=>{ combo = 0; updateHUD(); }, 3000);
    // scoring: base 10, combo bonus adds increasing value
    score += 10 * combo;
    updateHUD();
}

// === 当たり判定（ボールとブロック） ===
function collisionDetection(){
    for (let c=0;c<brickColumnCount;c++){
        for (let r=0;r<brickRowCount;r++){
            const b = bricks[c][r];
            if (b && b.status === 1){
                const bx = c*(brickWidth+brickPadding) + brickOffsetLeft;
                const by = r*(brickHeight+brickPadding) + brickOffsetTop;
                b.x = bx; b.y = by;
                if (x > bx && x < bx + brickWidth && y > by && y < by + brickHeight){
                    // どの辺に当たったか簡易判定
                    // reflect vertical for simplicity
                    dy = -dy;
                    // hit
                    b.hits -= 1;
                    // particle + sound
                    spawnParticles(x,y, "#dfffa0");
                    if (soundBlock) { try{ soundBlock.currentTime=0; soundBlock.play(); }catch{} }
                    if (b.hits <= 0){
                        b.status = 0;
                        // combo and score
                        addCombo();
                        // drop item maybe
                        dropItemAt(bx + brickWidth/2, by + brickHeight/2);
                    } else {
                        // weaker hit - small score
                        score += 5;
                    }
                    updateHUD();
                }
            }
        }
    }
}

// === アイテム当たり判定（パドルで受ける） ===
function updateItems(){
    for (let i = items.length-1; i>=0; i--){
        const it = items[i];
        it.y += it.vy;
        // draw in main loop
        if (it.y > H - PADDLE_Y_PAD - paddleHeight && it.x > paddleX && it.x < paddleX + paddleWidth){
            // picked
            if (it.type === 0){
                // paddle expand
                paddleWidth = clamp(paddleWidth + 60, 80, 220);
                setTimeout(()=>{ paddleWidth = clamp(paddleWidth - 60, 80, 220); }, 8000);
            } else if (it.type === 1){
                // slow ball
                dx *= 0.8; dy *= 0.8;
                setTimeout(()=>{ dx *= 1.25; dy *= 1.25; }, 8000);
            } else if (it.type === 2){
                // score double effect (we'll mark fever flag briefly)
                fever = true;
                setTimeout(()=>{ fever = false; }, 8000);
            }
            items.splice(i,1);
            continue;
        }
        // remove if off-screen
        if (it.y > H + 20) items.splice(i,1);
    }
}

// === パーティクル更新 ===
function updateParticles(){
    for (let i = particles.length-1;i>=0;i--){
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        p.life -= 1;
        if (p.life <= 0) particles.splice(i,1);
    }
}

// === 描画パーツ ===
function drawBricks(){
    for (let c=0;c<brickColumnCount;c++){
        for (let r=0;r<brickRowCount;r++){
            const b = bricks[c][r];
            const bx = c*(brickWidth+brickPadding) + brickOffsetLeft;
            const by = r*(brickHeight+brickPadding) + brickOffsetTop;
            if (!b || b.status === 0) continue;
            // color by hits
            if (b.hits >= 2) ctx.fillStyle = "#FFB773"; // orange (hard)
            else ctx.fillStyle = "#99FF66"; // light green
            roundRect(ctx, bx, by, brickWidth, brickHeight, 6, true);
            // border
            ctx.strokeStyle = "rgba(0,0,0,0.2)";
            ctx.strokeRect(bx, by, brickWidth, brickHeight);
        }
    }
}

function drawBall(){
    ctx.beginPath();
    ctx.arc(x,y,ballRadius,0,Math.PI*2);
    ctx.fillStyle = "#00ECFF";
    ctx.fill();
    ctx.closePath();
}

function drawPaddle(){
    ctx.beginPath();
    roundRect(ctx, paddleX, H - PADDLE_Y_PAD - paddleHeight, paddleWidth, paddleHeight, 8, true);
    ctx.fillStyle = "#0080FF";
    ctx.fill();
}

function drawItems(){
    for (const it of items){
        if (it.type === 0) ctx.fillStyle = "#FFD166"; // paddle expand
        else if (it.type === 1) ctx.fillStyle = "#06D6A0"; // slow
        else ctx.fillStyle = "#EF476F"; // score
        roundRect(ctx, it.x-8, it.y-8, 16, 16, 4, true);
    }
}

function drawParticles(){
    for (const p of particles){
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 2);
    }
}

function roundRect(ctx, x, y, w, h, r, fill){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
}

// === 衝突とゲーム進行 ===
function checkCollisionsAndProgress(){
    // wall
    if (x + dx > W - ballRadius || x + dx < ballRadius) { dx = -dx; if (soundHit) try{soundHit.play()}catch{} }
    if (y + dy < ballRadius) { dy = -dy; if (soundHit) try{soundHit.play()}catch{} }

    // paddle hit
    const paddleTop = H - PADDLE_Y_PAD - paddleHeight;
    if (y + dy > paddleTop - ballRadius){
        if (x > paddleX && x < paddleX + paddleWidth){
            // reflect with angle based on hit point
            const hitPoint = (x - (paddleX + paddleWidth/2)) / (paddleWidth/2); // -1..1
            const speed = Math.hypot(dx, dy);
            const angle = hitPoint * (Math.PI/3); // ±60°
            dx = speed * Math.sin(angle);
            dy = -Math.abs(speed * Math.cos(angle));
            if (soundHit) try{ soundHit.play() }catch{};
            // reset combo timer? we keep combo until timeout
        } else if (y + dy > H + 10){
            // miss -> game over
            if (soundOver) try{ soundOver.play() }catch{};
            // reset to initial state but keep level?
            setTimeout(()=>{ resetForRetry(); }, 200);
        }
    }
}

// === レベルアップ判定 ===
function checkLevelClear(){
    let allGone = true;
    for (let c=0;c<brickColumnCount;c++){
        for (let r=0;r<brickRowCount;r++){
            if (bricks[c][r] && bricks[c][r].status === 1) { allGone = false; break; }
        }
        if (!allGone) break;
    }
    if (allGone){
        level++;
        // make next level slightly harder
        dx *= 1.08; dy *= 1.08;
        // increase rows or columns to make variety
        brickRowCount = Math.min(6, brickRowCount + 1);
        initBricks();
        // nudge ball/paddle positions
        x = W/2; y = H - 60;
        paddleX = (W - paddleWidth)/2;
        updateHUD();
    }
}

// === reset after miss ===
function resetForRetry(){
    // reset ball & paddle, but keep score and combos
    x = W/2; y = H - 60;
    dx = 3 * Math.sign(dx || 1);
    dy = -3;
    paddleWidth = 100;
    paddleX = (W - paddleWidth)/2;
    combo = 0;
    updateHUD();
}

// === input handlers ===
document.addEventListener("keydown", (e)=>{
    const k = e.key.toLowerCase();
    if (k === "arrowright" || k === "d") rightPressed = true;
    if (k === "arrowleft" || k === "a") leftPressed = true;
});
document.addEventListener("keyup", (e)=>{
    const k = e.key.toLowerCase();
    if (k === "arrowright" || k === "d") rightPressed = false;
    if (k === "arrowleft" || k === "a") leftPressed = false;
});

// mouse movement to control paddle (optional)
canvas.addEventListener("mousemove", (e)=>{
    const rect = canvas.getBoundingClientRect();
    const xPos = e.clientX - rect.left;
    // center paddle on pointer
    paddleX = clamp(xPos - paddleWidth/2, 0, W - paddleWidth);
    useMouse = true;
});
// === スマホ対応: タッチでパドルを動かす ===
canvas.addEventListener("touchmove", (e) => {
    e.preventDefault(); // スクロール防止

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const xPos = touch.clientX - rect.left;

    paddleX = clamp(xPos - paddleWidth / 2, 0, W - paddleWidth);
    useMouse = true;
}, { passive: false });

// start on click (overlay)
document.addEventListener("click", (e)=>{
    if (!gameStarted){
        gameStarted = true;
        document.getElementById("startText").style.display = "none";
        // ensure focus on canvas
        canvas.focus();
    }
});

// main loop
function loop(){
    if (!gameStarted){
        // draw title overlay
        ctx.clearRect(0,0,W,H);
        ctx.fillStyle = "#0a1620";
        ctx.fillRect(0,0,W,H);
        ctx.fillStyle = "#dff3ff";
        ctx.font = "22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("▶ クリック / タップでゲーム開始", W/2, H/2);
        return requestAnimationFrame(loop);
    }

    // clear
    ctx.clearRect(0,0,W,H);

    // draw
    drawBricks();
    drawItems();
    drawParticles();
    drawBall();
    drawPaddle();

    // update
    updateItems();
    updateParticles();
    collisionDetection();
    checkCollisionsAndProgress();
    checkLevelClear();

    // movement for paddle by keys (if user moved mouse recently, prefer mouse)
    if (!useMouse){
        if (rightPressed) paddleX = clamp(paddleX + 6, 0, W - paddleWidth);
        if (leftPressed) paddleX = clamp(paddleX - 6, 0, W - paddleWidth);
    }

    // ball pos
    x += dx;
    y += dy;

    updateHUD();
    requestAnimationFrame(loop);
}

// ensure only one animation starts
let startedOnce = false;
function startGame(){
    if (!startedOnce){
        startedOnce = true;
        requestAnimationFrame(loop);
    }
}

// kick off
startGame();


