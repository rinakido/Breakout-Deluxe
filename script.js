const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const MAX_WIDTH = 800;
const ASPECT_RATIO = window.innerWidth <= 600 ? 1.4 : 0.75;
let W = Math.min(window.innerWidth * 0.95, MAX_WIDTH);
let H = W * ASPECT_RATIO;
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
const PADDLE_Y_PAD = 20;

let rightPressed = false;
let leftPressed = false;
let mouseX = null;

let brickRowCount = window.innerWidth <= 600 ? 3 : 6;
let brickColumnCount = window.innerWidth <= 600 ? 4 : 8;
let brickWidth = 60;
let brickHeight = 16;
let brickPadding = 8;
let brickOffsetTop = window.innerWidth <= 600 ? 80 : 60;
let brickOffsetLeft = 30;
let bricks = [];

let items = [];
let particles = [];

let soundHit = null;
try {
    soundHit = new Audio("https://assets.mixkit.co/active_storage/sfx/2073/2073.wav");
} catch(e){}

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
            roundRect(ctx,bx,by,brickWidth,brickHeight,6,true);

            ctx.strokeStyle="rgba(0,0,0,0.2)";
            ctx.strokeRect(bx,by,brickWidth,brickHeight);
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
        
        // レベルアップ時もスマホとPCで調整
        const maxRows = window.innerWidth <= 600 ? 4 : 6;
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
        brickRowCount = window.innerWidth <= 600 ? 3 : 6;
        brickColumnCount = window.innerWidth <= 600 ? 4 : 8;
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
    W = Math.min(window.innerWidth * 0.95, MAX_WIDTH);
    const aspectRatio = window.innerWidth <= 600 ? 1.4 : 0.75;
    H = W * aspectRatio;
    canvas.width=W; canvas.height=H;
    const wRatio = W/prevW, hRatio=H/prevH;
    paddleX*=wRatio; x*=wRatio; y*=hRatio;
    
    // スマホとPCでブロック数を調整
    brickRowCount = window.innerWidth <= 600 ? 3 : 6;
    brickColumnCount = window.innerWidth <= 600 ? 4 : 8;
    brickOffsetTop = window.innerWidth <= 600 ? 80 : 60;
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