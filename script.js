const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const graphCanvas = document.getElementById('graphCanvas');
const gCtx = graphCanvas.getContext('2d');

let balls = [];
let isPlaying = false;
let selectedBall = null;
let isDraggingBall = false;
let isSettingVector = false;
let mouse = { x: 0, y: 0 };
let activeForceLabels = [];
let historyData = [];

// ==========================================
// KELAS UTAMA BENDA
// ==========================================
class Ball {
    constructor(x, y, m, color, shape) {
        this.x = x;
        this.y = y;
        this.startX = x; 
        this.startY = y;
        this.m = m;
        
        // --- Skala Massa (1 cm = 20 px) ---
        const PIXEL_PER_CM = 20;
        let ukuranCm = 2.0 + (m * 0.02); 
        this.radius = ukuranCm * PIXEL_PER_CM;
        
        this.color = color;
        this.shape = shape;
        this.vx = 0; 
        this.vy = 0;

        this.vInitial = '-';
        this.vFinal = '-';
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.startX, this.startY, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.1)";
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.closePath();

        if (selectedBall === this) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(52, 152, 219, 0.3)";
            ctx.fill();
            ctx.closePath();
        }

        ctx.fillStyle = this.color;
        ctx.beginPath();
        if (this.shape === 'lingkaran') {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        } else {
            ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        }
        ctx.fill();
        ctx.strokeStyle = "#2d3436";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        if (!isPlaying || isSettingVector) this.drawVector();

        if (document.getElementById('showData').checked) {
            let speed = Math.sqrt(this.vx**2 + this.vy**2).toFixed(2);
            ctx.fillStyle = "#2d3436";
            ctx.font = "bold 13px Arial";
            ctx.fillText(`v: ${speed} m/s`, this.x - 25, this.y - this.radius - 15);
            ctx.fillStyle = "white";
            ctx.font = "bold 12px Arial";
            ctx.fillText(`${this.m}kg`, this.x - 10, this.y + 5);
        }
    }

    drawVector() {
        let headlen = 10; 
        let tox = this.x + (this.vx * 25);
        let toy = this.y + (this.vy * 25);
        let angle = Math.atan2(toy - this.y, tox - this.x);

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(tox, toy);
        ctx.strokeStyle = "red";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(tox, toy);
        ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = "red";
        ctx.fill();
    }

    update() {
        if (!isPlaying) return;
        const friction = parseFloat(document.getElementById('globalFriction').value);
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= (1 - friction);
        this.vy *= (1 - friction);

        if (this.x + this.radius > canvas.width) { this.x = canvas.width - this.radius; this.vx *= -1; }
        if (this.x - this.radius < 0) { this.x = this.radius; this.vx *= -1; }
        if (this.y + this.radius > canvas.height) { this.y = canvas.height - this.radius; this.vy *= -1; }
        if (this.y - this.radius < 0) { this.y = this.radius; this.vy *= -1; }
    }
}

// ==========================================
// RENDER TABEL DINAMIS
// ==========================================
function renderTable() {
    const tbody = document.getElementById('obsTableBody');
    tbody.innerHTML = ''; 
    
    balls.forEach((b, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:bold; color:${b.color};">Benda ${index + 1}</td>
            <td>${b.m.toFixed(1)}</td>
            <td id="td-vi-${index}">${b.vInitial}</td>
            <td id="td-vf-${index}">${b.vFinal}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateTableValues() {
    balls.forEach((b, index) => {
        const tdVi = document.getElementById(`td-vi-${index}`);
        const tdVf = document.getElementById(`td-vf-${index}`);
        if (tdVi) tdVi.innerText = b.vInitial;
        if (tdVf) tdVf.innerText = b.vFinal;
    });
}

// ==========================================
// INTERAKSI MOUSE & SENTUHAN (SCALING FIX)
// ==========================================
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { 
        x: (e.clientX - rect.left) * scaleX, 
        y: (e.clientY - rect.top) * scaleY 
    };
}

function getTouchPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = e.touches[0];
    return { 
        x: (touch.clientX - rect.left) * scaleX, 
        y: (touch.clientY - rect.top) * scaleY 
    };
}

function findClickedBall(pos) {
    return balls.find(b => {
        const dist = Math.sqrt((pos.x - b.x)**2 + (pos.y - b.y)**2);
        return dist < b.radius + 5;
    });
}

canvas.oncontextmenu = (e) => e.preventDefault();

canvas.addEventListener('mousedown', e => {
    if (isPlaying) return;
    const pos = getMousePos(e);
    selectedBall = findClickedBall(pos);
    if (selectedBall) {
        if (e.button === 0) isDraggingBall = true;
        else if (e.button === 2) isSettingVector = true;
    }
});

canvas.addEventListener('mousemove', e => {
    let mouse = getMousePos(e);
    if (isPlaying || !selectedBall) return;

    if (isDraggingBall) {
        selectedBall.x = mouse.x; selectedBall.y = mouse.y;
        selectedBall.startX = mouse.x; selectedBall.startY = mouse.y;
    } else if (isSettingVector) {
        selectedBall.vx = (mouse.x - selectedBall.x) / 15;
        selectedBall.vy = (mouse.y - selectedBall.y) / 15;
    }
});

window.addEventListener('mouseup', () => { isDraggingBall = false; isSettingVector = false; });

canvas.addEventListener('touchstart', e => {
    if (isPlaying) return;
    const pos = getTouchPos(e);
    selectedBall = findClickedBall(pos);
    if (selectedBall) {
        const mode = document.getElementById('touchMode').value;
        if (mode === 'move') isDraggingBall = true;
        else isSettingVector = true;
        e.preventDefault();
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    if (isPlaying || !selectedBall) return;
    const pos = getTouchPos(e);
    if (isDraggingBall) {
        selectedBall.x = pos.x; selectedBall.y = pos.y;
        selectedBall.startX = pos.x; selectedBall.startY = pos.y;
    } else if (isSettingVector) {
        selectedBall.vx = (pos.x - selectedBall.x) / 10;
        selectedBall.vy = (pos.y - selectedBall.y) / 10;
    }
    e.preventDefault();
}, { passive: false });

window.addEventListener('touchend', () => { isDraggingBall = false; isSettingVector = false; });

// ==========================================
// OPERASIONAL UI & ENGINE
// ==========================================
function togglePlay() {
    isPlaying = !isPlaying;
    selectedBall = null; 
    
    const btn = document.getElementById('playBtn');
    const label = document.getElementById('statusLabel');
    
    if (isPlaying) {
        btn.innerText = "JEDA (EDIT)";
        btn.classList.add('running');
        label.innerText = "MODE: RUNNING";
        label.style.color = "#2ecc71";
        label.style.borderBottomColor = "#2ecc71";

        balls.forEach(b => {
            b.vInitial = Math.sqrt(b.vx**2 + b.vy**2).toFixed(2);
            b.vFinal = '-'; 
        });
        updateTableValues();

    } else {
        btn.innerText = "MULAI (RUN)";
        btn.classList.remove('running');
        label.innerText = "MODE: EDIT";
        label.style.color = "#f39c12";
        label.style.borderBottomColor = "#f39c12";
    }
}

function createObject() {
    const mass = parseFloat(document.getElementById('newMass').value);
    const color = document.getElementById('newColor').value;
    const shape = document.getElementById('newShape').value;
    const speed = parseFloat(document.getElementById('manualSpeed').value);
    
    let newBall = new Ball(canvas.width / 2, canvas.height / 2, mass, color, shape);
    newBall.vx = speed;
    balls.push(newBall);
    
    historyData.push([]); 
    renderTable(); 
}

function clearAll() { 
    balls = []; 
    historyData = [];
    isPlaying = false;
    
    renderTable(); 
    
    const btn = document.getElementById('playBtn');
    const label = document.getElementById('statusLabel');
    btn.innerText = "MULAI (RUN)";
    btn.classList.remove('running');
    label.innerText = "MODE: EDIT";
    label.style.color = "#f39c12";
    label.style.borderBottomColor = "#f39c12";
}

function setMode(mode) {
    document.getElementById('touchMode').value = mode; 
    document.getElementById('btnMove').style.background = (mode === 'move') ? '#3498db' : '#bdc3c7';
    document.getElementById('btnVector').style.background = (mode === 'vector') ? '#e67e22' : '#bdc3c7';
}

document.getElementById('manualSpeed').addEventListener('input', (e) => {
    if (selectedBall && !isPlaying) {
        selectedBall.vx = parseFloat(e.target.value); 
        selectedBall.vy = 0; 
    }
});

// ==========================================
// SIMULASI FISIKA & GRAFIK V-T
// ==========================================
function handleCollisions() {
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            let b1 = balls[i]; let b2 = balls[j];
            
            let dx = b2.x - b1.x;
            let dy = b2.y - b1.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < b1.radius + b2.radius) {
                let nx = dx / dist; 
                let ny = dy / dist;
                let rvx = b2.vx - b1.vx;
                let rvy = b2.vy - b1.vy;
                let velAlongNormal = rvx * nx + rvy * ny;

                if (velAlongNormal > 0) continue;

                let j_impulse = -(2 * velAlongNormal) / (1 / b1.m + 1 / b2.m);
                let impulseX = j_impulse * nx;
                let impulseY = j_impulse * ny;
                
                b1.vx -= (1 / b1.m) * impulseX; b1.vy -= (1 / b1.m) * impulseY;
                b2.vx += (1 / b2.m) * impulseX; b2.vy += (1 / b2.m) * impulseY;

                let percent = 0.2; let slop = 0.01; 
                let penetration = b1.radius + b2.radius - dist;
                let correction = Math.max(penetration - slop, 0) / (1/b1.m + 1/b2.m) * percent;
                let cx = correction * nx; let cy = correction * ny;
                b1.x -= cx * (1/b1.m); b1.y -= cy * (1/b1.m);
                b2.x += cx * (1/b2.m); b2.y += cy * (1/b2.m);
                
                showForceLabel(b1.x + dx/2, b1.y + dy/2, Math.abs(j_impulse).toFixed(1));

                b1.vFinal = Math.sqrt(b1.vx**2 + b1.vy**2).toFixed(2);
                b2.vFinal = Math.sqrt(b2.vx**2 + b2.vy**2).toFixed(2);
                updateTableValues(); 
            }
        }
    }
}

function showForceLabel(x, y, val) { activeForceLabels.push({x, y, val, life: 30}); }

function drawForceLabels() {
    activeForceLabels.forEach((label, index) => {
        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 18px Arial";
        ctx.fillText(`F: ${label.val} N`, label.x, label.y - 20);
        label.life--;
        if(label.life <= 0) activeForceLabels.splice(index, 1);
    });
}

function drawGraph() {
    gCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
    
    gCtx.strokeStyle = "#f1f5f9"; gCtx.lineWidth = 1;
    for(let i=0; i<graphCanvas.height; i+=20) { 
        gCtx.beginPath(); gCtx.moveTo(0, i); gCtx.lineTo(graphCanvas.width, i); gCtx.stroke(); 
    }

    if (isPlaying) {
        balls.forEach((b, index) => {
            if(!historyData[index]) historyData[index] = [];
            historyData[index].push(Math.sqrt(b.vx**2 + b.vy**2));
            if (historyData[index].length > graphCanvas.width) historyData[index].shift();
        });
    }
    
    function plot(dataArray, color) {
        if (!dataArray || dataArray.length === 0) return;
        gCtx.beginPath(); gCtx.strokeStyle = color; gCtx.lineWidth = 2.5;
        for(let i = 0; i < dataArray.length; i++) {
            let x = i;
            let y = graphCanvas.height - (dataArray[i] * 12); 
            if (i === 0) gCtx.moveTo(x, y); else gCtx.lineTo(x, y);
        }
        gCtx.stroke();
    }

    balls.forEach((b, index) => {
        if (historyData[index]) plot(historyData[index], b.color);
    });
}

function updateCursor() {
    if (isPlaying) { canvas.style.cursor = "default"; return; }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = "#f0f0f0"; ctx.lineWidth = 1;
    for(let i=0; i<canvas.width; i+=50) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
    for(let j=0; j<canvas.height; j+=50) { ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(canvas.width,j); ctx.stroke(); }

    if (isPlaying) handleCollisions();
    
    balls.forEach(b => { b.update(); b.draw(); });

    drawForceLabels();
    updateCursor();
    drawGraph();

    requestAnimationFrame(draw);
}

draw();