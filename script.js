// ===== ブロック崩しゲーム 完全版 =====
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let W = window.innerWidth;
let H = window.innerHeight * 0.6;
canvas.width = W;
canvas.height = H;

// === ゲーム変数 ===
let gameStarted = false;
let level = 1;
let score = 0;
let combo = 0;
let comboTimer = null;
let fever = false;

// ボール
let x = W/2, y = H-60;
let dx = 3, dy = -3;
const ballRadius = 8;

// パドル
let paddleWidth = 100;
const paddleHeight = 12;
let paddleX = (W - paddleWidth)/2;
const PADDLE_Y_PAD = 20;

// 入力
let rightPressed = false;
let leftPressed = false;
let useMouse = false;

// ブロック
let brickRowCount = 6;
let brickColumnCount = 8;
let brickWidth = 60;
let brickHeight = 16;
let brickPadding = 8;
let brickOffsetTop = 60;
let brickOffsetLeft = 30;
let bricks = [];

// アイテム＆パーティクル
let items = [];
let particles = [];

// 音
let soundHit = null, soundBlock = null, soundOver = null;
try {
    soundHit = new Audio("https://assets.mixkit.co/active_storage/sfx/2073/2073.wav");
    soundBlock = new Audio("block.mp3");
    soundOver = new Audio("over.mp3");
} catch(e){}

// ---- Helper ----
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
function rand(min,max){ return Math.random()*(max-min)+min; }

// === 初期化ブロック ===
function initBricks(){
    bricks = [];
    for(let c=0;c<brickColumnCount;c++){
        bricks[c]=[];
        for(let r=0;r<brickRowCount;r++){
            let hits = r===0?2:1;
            bricks[c][r] = {x:0, y:0, status:1, hits:hits, type:hits};
        }
    }
}
initBricks();

// === UI更新 ===
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const comboEl = document.getElementById("combo");
function updateHUD(){
    scoreEl.textContent = `Score: ${score}`;
    levelEl.textContent = `Level: ${level}`;
    comboEl.textContent = `Combo: ${combo}`;
}

// === パーティクル ===
function spawnParticles(cx, cy, color){
    for(let i=0;i<12;i++){
        particles.push({
            x: cx+rand(-10,10),
            y: cy+rand(-6,6),
            vx: rand(-2.5,2.5),
            vy: rand(-3,-0.5),
            life: 40 + Math.floor(rand(0,20)),
            color: color || "#fff"
        });
    }
}

// === アイテムドロップ ===
function dropItemAt(x,y){
    if(Math.random()<0.2){
        const t = Math.floor(Math.random()*3);
        items.push({x:x, y:y, type:t, vy:2+Math.random()*1.5});
    }
}

// === コンボ処理 ===
function addCombo(){
    combo++;
    clearTimeout(comboTimer);
    comboTimer = setTimeout(()=>{ combo=0; updateHUD(); }, 3000);
    score += 10 * combo;
    updateHUD();
}

// === 当たり判定（ボールとブロック） ===
function collisionDetection(){
    for(let c=0;c<brickColumnCount;c++){
        for(let r=0;r<brickRowCount;r++){
            const b = bricks[c][r];
            if(b && b.status===1){
                const bx = c*(brickWidth+brickPadding)+brickOffsetLeft;
                const by = r*(brickHeight+brickPadding)+brickOffsetTop;
                b.x = bx; b.y = by;
                if(x>bx && x<bx+brickWidth && y>by && y<by+brickHeight){
                    dy = -dy;
                    b.hits--;
                    spawnParticles(x,y,"#dfffa0");
                    if(soundBlock){ try{soundBlock.currentTime=0; soundBlock.play(); }catch{} }
                    if(b.hits<=0){
                        b.status=0;
                        addCombo();
                        dropItemAt(bx+brickWidth/2, by+brickHeight/2);
                    } else {
                        score +=5;
                    }
                    updateHUD();
                }
            }
        }
    }
}

// === アイテム更新 ===
function updateItems(){
    for(let i=items.length-1;i>=0;i--){
        const it = items[i];
        it.y += it.vy;
        if(it.y>H-PADDLE_Y_PAD-paddleHeight && it.x>paddleX && it.x<paddleX+paddleWidth){
            if(it.type===0){
                paddleWidth = clamp(paddleWidth+60,80,220);
                setTimeout(()=>{ paddleWidth = clamp(paddleWidth-60,80,220); },8000);
            } else if(it.type===1){
                dx*=0.8; dy*=0.8;
                setTimeout(()=>{ dx*=1.25; dy*=1.25; },8000);
            } else if(it.type===2){
                fever=true;
                setTimeout(()=>{ fever=false; },8000);
            }
            items.splice(i,1);
            continue;
        }
        if(it.y>H+20) items.splice(i,1);
    }
}

// === パーティクル更新 ===
function updateParticles(){
    for(let i=particles.length-1;i>=0;i--){
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.life--;
        if(p.life<=0) particles.splice(i,1);
    }
}

// === 描画 ===
const coldplayColors = ["#FF5A36","#FF8A00","#FFD300","#33CC5E","#1E90FF","#7A2ED6"];

function drawBricks(){
    for(let c=0;c<brickColumnCount;c++){
        for(let r=0;r<brickRowCount;r++){
            const b = bricks[c][r];
            if(!b||b.status===0) continue;
            const bx = c*(brickWidth+brickPadding)+brickOffsetLeft;
            const by = r*(brickHeight+brickPadding)+brickOffsetTop;

            // 塗りつぶし
            ctx.fillStyle = coldplayColors[r%coldplayColors.length];
            roundRect(ctx,bx,by,brickWidth,brickHeight,6,true);

            // 枠線
            ctx.strokeStyle="rgba(0,0,0,0.2)";
            ctx.strokeRect(bx,by,brickWidth,brickHeight);
        }
    }
}

function drawBall(){
    ctx.beginPath();
    ctx.arc(x,y,ballRadius,0,Math.PI*2);
    ctx.fillStyle="#00ECFF";
    ctx.fill();
    ctx.closePath();
}

function drawPaddle(){
    ctx.beginPath();
    roundRect(ctx,paddleX,H-PADDLE_Y_PAD-paddleHeight,paddleWidth,paddleHeight,8,true);
    ctx.fillStyle="#0080FF";
    ctx.fill();
    ctx.strokeStyle="#0050AA";
    ctx.strokeRect(paddleX,H-PADDLE_Y_PAD-paddleHeight,paddleWidth,paddleHeight);
}

function drawItems(){
    for(const it of items){
        ctx.fillStyle = it.type===0?"#FFD166":it.type===1?"#06D6A0":"#EF476F";
        roundRect(ctx,it.x-8,it.y-8,16,16,4,true);
    }
}

function drawParticles(){
    for(const p of particles){
        ctx.fillStyle=p.color;
        ctx.fillRect(p.x,p.y,2,2);
    }
}

function roundRect(ctx,x,y,w,h,r,fill){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
    if(fill) ctx.fill();
}

// === 衝突 ===
function checkCollisionsAndProgress(){
    if(x+dx>W-ballRadius||x+dx<ballRadius){ dx=-dx; if(soundHit) try{soundHit.play()}catch{} }
    if(y+dy<ballRadius){ dy=-dy; if(soundHit) try{soundHit.play()}catch{} }

    const paddleTop = H-PADDLE_Y_PAD-paddleHeight;
    if(y+dy>paddleTop-ballRadius){
        if(x>paddleX && x<paddleX+paddleWidth){
            const hitPoint = (x-(paddleX+paddleWidth/2))/(paddleWidth/2);
            const speed = Math.hypot(dx,dy);
            const angle = hitPoint*(Math.PI/3);
            dx = speed*Math.sin(angle);
            dy = -Math.abs(speed*Math.cos(angle));
            if(soundHit) try{ soundHit.play() }catch{};
        } else if(y+dy>H+10){
            if(soundOver) try{ soundOver.play() }catch{};
            setTimeout(resetForRetry,200);
        }
    }
}

// === レベルアップ ===
function checkLevelClear(){
    let allGone=true;
    for(let c=0;c<brickColumnCount;c++){
        for(let r=0;r<brickRowCount;r++){
            if(bricks[c][r] && bricks[c][r].status===1){ allGone=false; break;}
        }
        if(!allGone) break;
    }
    if(allGone){
        level++;
        dx*=1.08; dy*=1.08;
        brickRowCount = Math.min(6, brickRowCount+1);
        initBricks();
        x=W/2; y=H-60;
        paddleX=(W-paddleWidth)/2;
        updateHUD();
    }
}

// === リセット ===
function resetForRetry(){
    x=W/2; y=H-60;
    dx=3*Math.sign(dx||1); dy=-3;
    paddleWidth=100;
    paddleX=(W-paddleWidth)/2;
    combo=0;
    updateHUD();
}

// === 入力 ===
document.addEventListener("keydown",(e)=>{
    const k=e.key.toLowerCase();
    if(k==="arrowright"||k==="d") rightPressed=true;
    if(k==="arrowleft"||k==="a") leftPressed=true;
});
document.addEventListener("keyup",(e)=>{
    const k=e.key.toLowerCase();
    if(k==="arrowright"||k==="d") rightPressed=false;
    if(k==="arrowleft"||k==="a") leftPressed=false;
});

// === マウス/タッチ ===
function handlePointerMove(xPos){
    paddleX = clamp(xPos-paddleWidth/2,0,W-paddleWidth);
    useMouse = true;
}
canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    handlePointerMove(e.clientX-rect.left);
});
canvas.addEventListener("touchmove", e=>{
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    handlePointerMove(e.touches[0].clientX-rect.left);
},{passive:false});

// === リサイズ ===
function resizeCanvas(){
    const prevW=W, prevH=H;
    W=window.innerWidth;
    H=window.innerHeight*0.6;
    canvas.width=W; canvas.height=H;
    const wRatio = W/prevW, hRatio=H/prevH;
    paddleX*=wRatio; x*=wRatio; y*=hRatio;
}
window.addEventListener("resize", resizeCanvas);

// === ゲーム開始 ===
document.addEventListener("click",()=>{
    if(!gameStarted){
        gameStarted=true;
        const st = document.getElementById("startText");
        if(st) st.style.display="none";
        canvas.focus();
    }
});

// === メインループ ===
function loop(){
    if(!gameStarted){
        ctx.fillStyle="#0a1620";
        ctx.fillRect(0,0,W,H);
        ctx.fillStyle="#dff3ff";
        ctx.font="22px sans-serif";
        ctx.textAlign="center";
        ctx.fillText("▶ クリック / タップでゲーム開始", W/2, H/2);
        return requestAnimationFrame(loop);
    }

    ctx.clearRect(0,0,W,H);
    drawBricks(); drawItems(); drawParticles(); drawBall(); drawPaddle();
    updateItems(); updateParticles(); collisionDetection();
    checkCollisionsAndProgress(); checkLevelClear();

    if(!useMouse){
        if(rightPressed) paddleX=clamp(paddleX+6,0,W-paddleWidth);
        if(leftPressed) paddleX=clamp(paddleX-6,0,W-paddleWidth);
    }

    x+=dx; y+=dy;
    updateHUD();
    requestAnimationFrame(loop);
}

// === 開始 ===
requestAnimationFrame(loop);
