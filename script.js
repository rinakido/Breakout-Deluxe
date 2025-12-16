const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const MAX_WIDTH = 800;
// スマホは画面の90%を使う（下部に余裕を持たせる）
const isMobile = window.innerWidth <= 600;
let W, H;

if(isMobile){
    W = window.innerWidth;
    H = window.innerHeight * 0.92; // 下部8%を余白に
} else {
    W = Math.min(window.innerWidth * 0.95, MAX_WIDTH);
    H = W * 0.75;
}

canvas.width = W;
canvas.height = H;

let gameStarted = false;
let level = 1;
let score = 0;
let combo = 0;
let comboTimer = null;
let lives = 3;

let x = W/2, y = H-60;
let dx = 3, dy = -3;
const ballRadius = 8;

let paddleWidth = 100;
const paddleHeight = 12;
let paddleX = (W - paddleWidth)/2;
const PADDLE_Y_PAD = window.innerWidth <= 600 ? 40 : 20; // スマホは下から40px

let rightPressed = false;
let leftPressed = false;
let mouseX = null;

// スマホでもブロック数を維持（少し調整）
let brickRowCount = window.innerWidth <= 600 ? 5 : 6;
let brickColumnCount = window.innerWidth <= 600 ? 6 : 8;
let brickWidth = 60;
let brickHeight = 16;
let brickPadding = 8;
let brickOffsetTop = window.innerWidth <= 600 ? 100 : 60;
let brickOffsetLeft = 30;
let bricks = [];

let items = [];
let particles = [];

let soundHit = null;
try {
    soundHit = new Audio("https://assets.mixkit.co/active_storage/sfx/2073/2073.wav");
} catch(e){}

// スタート画面用の変数
let startTextOffset = W/2; // 板付き！最初から画面中央に
let subTextOffset = -1000;
let sparkles = [];

function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
function rand(min,max){ return Math.random()*(max-min)+min; }

function initBricks(){
    bricks = [];
    const bw = (W - brickOffsetLeft*2 - brickPadding*(brickColumnCount-1)) / brickColumnCount;
    brickWidth = bw;
    
    for(let c=0;c<brickColumnCount;c++){
        bricks[c]=[];
        for(let r=0;r<brickRowCount;r++){
            let hits = r===0?2:1;
            bricks[c][r] = {x:0, y:0, status:1, hits:hits, type:hits};
        }
    }
}
initBricks();

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const comboEl = document.getElementById("combo");
const livesEl = document.getElementById("lives");

function updateHUD(){
    scoreEl.textContent = `Score: ${score}`;
    levelEl.textContent = `Level: ${level}`;
    comboEl.textContent = `Combo: ${combo}`;
}

function updateLives(){
    livesEl.innerHTML = '';
    for(let i = 0; i < lives; i++){
        const heart = document.createElement('div');
        heart.className = 'heart';
        livesEl.appendChild(heart);
    }
}

updateLives();

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

function dropItemAt(x,y){
    if(Math.random()<0.2){
        const t = Math.floor(Math.random()*3);
        items.push({x:x, y:y, type:t, vy:2+Math.random()*1.5});
    }
}

function addCombo(){
    combo++;
    clearTimeout(comboTimer);
    comboTimer = setTimeout(()=>{ combo=0; updateHUD(); }, 3000);
    score += 10 * combo;
    updateHUD();
}

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
                    if(soundHit){ try{soundHit.currentTime=0; soundHit.play(); }catch{} }
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
            }
            items.splice(i,1);
            continue;
        }
        if(it.y>H+20) items.splice(i,1);
    }
}

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

const coldplayColors = ["#FF5A36","#FF8A00","#FFD300","#33CC5E","#1E90FF","#7A2ED6"];

function drawBricks(){
    for(let c=0;c<brickColumnCount;c++){
        for(let r=0;r<brickRowCount;r++){
            const b = bricks[c][r];
            if(!b||b.status===0) continue;
            const bx = c*(brickWidth+brickPadding)+brickOffsetLeft;
            const by = r*(brickHeight+brickPadding)+brickOffsetTop;

            ctx.fillStyle = coldplayColors[r%coldplayColors.length];
            roundRect(ctx,bx,by,brickWidth,brickHeight,4,true);
        }
    }
}

function drawBall(){
    ctx.beginPath();
    ctx.arc(x,y,ballRadius,0,Math.PI*2);
    ctx.fillStyle="#FFFF00";
    ctx.fill();
    ctx.strokeStyle="#FF8800";
    ctx.lineWidth = 2;
    ctx.stroke();
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
            setTimeout(resetForRetry,200);
        }
    }
}

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
        
        const maxRows = window.innerWidth <= 600 ? 5 : 6;
        brickRowCount = Math.min(maxRows, brickRowCount+1);
        initBricks();
        x=W/2; y=H-60;
        paddleX=(W-paddleWidth)/2;
        updateHUD();
    }
}

function resetForRetry(){
    lives--;
    updateLives();
    
    if(lives <= 0){
        lives = 3;
        level = 1;
        score = 0;
        combo = 0;
        dx = 3;
        dy = -3;
        brickRowCount = window.innerWidth <= 600 ? 5 : 6;
        brickColumnCount = window.innerWidth <= 600 ? 6 : 8;
        initBricks();
        updateLives();
        updateHUD();
        gameStarted = false;
    }
    
    x=W/2; y=H-60;
    dx=3*Math.sign(dx||1); dy=-3;
    paddleWidth=100;
    paddleX=(W-paddleWidth)/2;
    combo=0;
    updateHUD();
}

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

function getCanvasX(clientX){
    const rect = canvas.getBoundingClientRect();
    const relX = clientX - rect.left;
    return (relX / rect.width) * W;
}

document.addEventListener("mousemove", e => {
    mouseX = getCanvasX(e.clientX);
});

document.addEventListener("touchmove", e => {
    e.preventDefault();
    if(e.touches.length > 0){
        mouseX = getCanvasX(e.touches[0].clientX);
    }
}, { passive: false });

document.addEventListener("touchstart", e => {
    e.preventDefault();
    if(e.touches.length > 0){
        mouseX = getCanvasX(e.touches[0].clientX);
    }
}, { passive: false });

function resizeCanvas(){
    const prevW=W, prevH=H;
    const isMobile = window.innerWidth <= 600;
    
    if(isMobile){
        W = window.innerWidth;
        H = window.innerHeight * 0.92;
    } else {
        W = Math.min(window.innerWidth * 0.95, MAX_WIDTH);
        H = W * 0.75;
    }
    
    canvas.width=W; canvas.height=H;
    const wRatio = W/prevW, hRatio=H/prevH;
    paddleX*=wRatio; x*=wRatio; y*=hRatio;
    
    brickRowCount = window.innerWidth <= 600 ? 5 : 6;
    brickColumnCount = window.innerWidth <= 600 ? 6 : 8;
    brickOffsetTop = window.innerWidth <= 600 ? 100 : 60;
    initBricks();
}
window.addEventListener("resize", resizeCanvas);

function startGame(){
    if(!gameStarted){
        gameStarted=true;
        const st = document.getElementById("startText");
        if(st) st.style.display="none";
        canvas.focus();
    }
}

document.addEventListener("click", startGame);
canvas.addEventListener("touchstart", (e) => {
    startGame();
}, { passive: true });

// キラキラパーティクル生成
function createSparkles() {
    if(Math.random() < 0.3) {
        sparkles.push({
            x: Math.random() * W,
            y: Math.random() * H,
            size: Math.random() * 4 + 2,
            alpha: 1,
            speed: Math.random() * 0.02 + 0.01
        });
    }
    
    for(let i = sparkles.length - 1; i >= 0; i--) {
        sparkles[i].alpha -= sparkles[i].speed;
        if(sparkles[i].alpha <= 0) {
            sparkles.splice(i, 1);
        }
    }
}

function loop(){
    if(!gameStarted){
        ctx.fillStyle="#0a1620";
        ctx.fillRect(0,0,W,H);
        
        // キラキラパーティクル生成と描画
        createSparkles();
        for(const sparkle of sparkles) {
            ctx.save();
            ctx.fillStyle = `rgba(0, 255, 255, ${sparkle.alpha})`;
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#00ffff";
            ctx.fillRect(sparkle.x, sparkle.y, sparkle.size, sparkle.size);
            
            // 十字の光
            ctx.fillRect(sparkle.x - sparkle.size, sparkle.y + sparkle.size/2, sparkle.size * 3, 1);
            ctx.fillRect(sparkle.x + sparkle.size/2, sparkle.y - sparkle.size, 1, sparkle.size * 3);
            ctx.restore();
        }
        
        // メインテキスト1行目「Breakout-Deluxe」
        startTextOffset += 4.5; // スピードアップ（3.5 → 4.5）
        if(startTextOffset > W + 800) startTextOffset = -800;
        
        const mainText1 = "Breakout-Deluxe";
        const mainText2 = "GAME START";
        
        // スマホ用のフォントサイズ調整
        const fontSize1 = window.innerWidth <= 600 ? 28 : 48;
        const fontSize2 = window.innerWidth <= 600 ? 24 : 40;
        const subFontSize = window.innerWidth <= 600 ? 12 : 20;
        
        ctx.font = `bold ${fontSize1}px 'Press Start 2P', monospace`;
        ctx.textAlign = "center";
        
        const pulse = 0.8 + Math.sin(Date.now() / 200) * 0.2;
        
        // 1行目の描画（ピクセル風に2重で描画 + 白い縁取り強化）
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#003344";
        ctx.fillText(mainText1, startTextOffset + 2, H/2 - 38);
        
        // 白い光る縁取り（太く！）
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 4; // 2 → 4に増加
        ctx.strokeText(mainText1, startTextOffset, H/2 - 40);
        
        ctx.shadowBlur = 20; // 15 → 20に増加
        ctx.shadowColor = "#00ecff";
        ctx.fillStyle = `rgba(0, 236, 255, ${pulse})`;
        ctx.fillText(mainText1, startTextOffset, H/2 - 40);
        
        // 2行目の描画（白い縁取り強化）
        ctx.font = `bold ${fontSize2}px 'Press Start 2P', monospace`;
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#003344";
        ctx.fillText(mainText2, startTextOffset + 2, H/2 + 12);
        
        // 白い光る縁取り（太く！）
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 4; // 2 → 4に増加
        ctx.strokeText(mainText2, startTextOffset, H/2 + 10);
        
        ctx.shadowBlur = 20; // 15 → 20に増加
        ctx.shadowColor = "#00ecff";
        ctx.fillStyle = `rgba(0, 236, 255, ${pulse})`;
        ctx.fillText(mainText2, startTextOffset, H/2 + 10);
        
        // サブテキスト（固定 + 点滅）
        const subText = "▶ クリック / タップでブロック崩しゲーム開始";
        ctx.font = `bold ${subFontSize}px 'Press Start 2P', monospace`;
        
        const subPulse = 0.7 + Math.sin(Date.now() / 300) * 0.3;
        
        // 発光（点滅）
        ctx.shadowBlur = 30;
        ctx.shadowColor = "#00ffff";
        ctx.fillStyle = `rgba(0, 255, 255, ${subPulse * 0.4})`;
        ctx.fillText(subText, W/2, H/2 + 80);
        
        ctx.shadowBlur = 12;
        ctx.fillStyle = `rgba(120, 255, 255, ${subPulse})`;
        ctx.fillText(subText, W/2, H/2 + 80);
        
        // 白いストローク
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(255, 255, 255, ${subPulse * 0.6})`;
        ctx.lineWidth = 2;
        ctx.strokeText(subText, W/2, H/2 + 80);
        
        return requestAnimationFrame(loop);
    }

    ctx.fillStyle="#0a1620";
    ctx.fillRect(0,0,W,H);
    drawBricks(); drawItems(); drawParticles(); drawBall(); drawPaddle();
    updateItems(); updateParticles(); collisionDetection();
    checkCollisionsAndProgress(); checkLevelClear();

    if(mouseX !== null){
        paddleX = clamp(mouseX - paddleWidth/2, 0, W - paddleWidth);
    } else {
        if(rightPressed) paddleX=clamp(paddleX+8,0,W-paddleWidth);
        if(leftPressed) paddleX=clamp(paddleX-8,0,W-paddleWidth);
    }

    x+=dx; y+=dy;
    updateHUD();
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);