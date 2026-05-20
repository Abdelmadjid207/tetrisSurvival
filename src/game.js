// GAME CORE ENTRY MODULE: Loops, mode init, overlay displays, event hooks and controls
// Initialize DOM references and graphics
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  nextCanvas = document.getElementById('nextCanvas');
  nextCtx = nextCanvas.getContext('2d');
  holdCanvas = document.getElementById('holdCanvas');
  holdCtx = holdCanvas.getContext('2d');
});

// Key bindings listeners
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) ||
    [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }

  activeKeys[e.code] = true;
  activeKeys[e.key] = true;

  if (!gameActive) {
    const overlay = document.getElementById('end-overlay');
    if (overlay.classList.contains('active') && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR')) {
      startGameMode(gameMode);
    }
    return;
  }

  // Tetris Human Key Events
  if (gameMode === 'HvH' || gameMode === 'StickmanCPU_TetrisHuman') {
    if (timeStopTimer <= 0) {
      if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') {
        if (!tetrisKeys.left.pressed) {
          tetrisKeys.left.pressed = true;
          moveTetrisLeft();
          tetrisKeys.left.lastTrigger = Date.now();
        }
      }
      if (e.key === 'ArrowRight' || e.code === 'ArrowRight') {
        if (!tetrisKeys.right.pressed) {
          tetrisKeys.right.pressed = true;
          moveTetrisRight();
          tetrisKeys.right.lastTrigger = Date.now();
        }
      }
      if (e.key === 'ArrowUp' || e.code === 'ArrowUp') {
        rotatePiece();
      }
      if (e.key === 'ArrowDown' || e.code === 'ArrowDown') {
        if (activePiece) activePiece.isShootingDown = true;
      }
      if (e.key === 'c' || e.key === 'C' || e.code === 'KeyC') {
        holdCurrentPiece();
      }
    }
  }
});

window.addEventListener('keyup', (e) => {
  activeKeys[e.code] = false;
  activeKeys[e.key] = false;

  if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') tetrisKeys.left.pressed = false;
  if (e.key === 'ArrowRight' || e.code === 'ArrowRight') tetrisKeys.right.pressed = false;
});

function startGameMode(mode) {
  gameMode = mode;

  // Initialize empty board
  board = Array.from({ length: rows }, () => Array(cols).fill(null));

  // Reset stickman coordinates & parameters
  stickman = {
    x: (cols * cellWidth) / 2 - 5,
    y: (rows * cellHeight) - 28,
    width: 10,
    height: 28,
    vx: 0,
    vy: 0,
    speed: 2.2,
    jumpForce: -4.7,
    climbSpeed: -1.7,
    gravity: 0.21,
    maxFallSpeed: 6.0,
    isGrounded: true,
    isClimbing: false,
    facing: 'right',
    doubleJumpUsed: false,
    spaceWasPressed: false
  };

  // Reset control flags
  activeKeys = {};
  cpuKeys = { a: false, d: false, w: false, space: false, shift: false };
  tetrisKeys.left.pressed = false;
  tetrisKeys.right.pressed = false;

  // Kill any in-progress death animation
  deathAnim = null;

  // Reset gift & time stop state
  gifts = [];
  giftSpawnTimer = 0;
  nextGiftDelay = 10000 + Math.random() * 10000;
  timeStopTimer = 0;
  blasterTimer = 0;
  shootCooldown = 0;
  bullets = [];
  particles = [];

  // Hold status reset
  holdPiece = null;
  hasSwappedThisTurn = false;
  renderHoldPiece();

  // Timing reset
  lastTime = 0;
  dropTimer = 0;
  lockTimer = 0;
  animFrame = 0;
  gameStartTime = Date.now();

  // Reset CPU variables
  hasCpuTarget = false;
  cpuRotationsCount = 0;
  cpuMoveTimer = 0;

  // Reset piece queues
  activePiece = null;
  nextPiece = null;
  spawnPiece();

  // Refresh HUD Panel Controls
  setupUIPanels();

  // Switch screen overlays
  document.getElementById('mode-screen').classList.remove('active');
  document.getElementById('game-screen').classList.add('active');
  document.getElementById('end-overlay').classList.remove('active');

  gameActive = true;
  requestAnimationFrame(gameLoop);
}

function setupUIPanels() {
  const p1Badge = document.getElementById('p1-badge');
  const p2Badge = document.getElementById('p2-badge');
  const p1Controls = document.getElementById('p1-controls');
  const p2Controls = document.getElementById('p2-controls');
  const p1CpuDesc = document.getElementById('p1-cpu-desc');
  const p2CpuDesc = document.getElementById('p2-cpu-desc');

  if (gameMode === 'HvH') {
    p1Badge.innerText = "Human";
    p1Badge.className = "badge-human";
    p2Badge.innerText = "Human";
    p2Badge.className = "badge-human";

    p1Controls.style.display = "flex";
    p1CpuDesc.style.display = "none";
    p2Controls.style.display = "flex";
    p2CpuDesc.style.display = "none";
  } else if (gameMode === 'StickmanCPU_TetrisHuman') {
    p1Badge.innerText = "CPU";
    p1Badge.className = "badge-cpu";
    p2Badge.innerText = "Human";
    p2Badge.className = "badge-human";

    p1Controls.style.display = "none";
    p1CpuDesc.style.display = "block";
    p2Controls.style.display = "flex";
    p2CpuDesc.style.display = "none";
  } else if (gameMode === 'StickmanHuman_TetrisCPU') {
    p1Badge.innerText = "Human";
    p1Badge.className = "badge-human";
    p2Badge.innerText = "CPU";
    p2Badge.className = "badge-cpu";

    p1Controls.style.display = "flex";
    p1CpuDesc.style.display = "none";
    p2Controls.style.display = "none";
    p2CpuDesc.style.display = "block";
  }
}

function backToMenu() {
  document.getElementById('end-overlay').classList.remove('active');
  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('mode-screen').classList.add('active');
}

// Generate random tetromino

function gameLoop(timestamp) {
  if (!gameActive) return;

  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  animFrame++;

  // Update Time Stop duration
  if (timeStopTimer > 0) {
    timeStopTimer -= dt;
    if (timeStopTimer < 0) timeStopTimer = 0;
  }

  // Update blaster duration and firing
  if (blasterTimer > 0) {
    blasterTimer -= dt;
    if (blasterTimer < 0) blasterTimer = 0;

    shootCooldown -= dt;
    if (shootCooldown <= 0) {
      fireBullet();
      shootCooldown = 120; // Fire every 120ms
    }
  }
  updateBullets(dt);

  // 1. Update character (Stickman)
  updateStickman();

  // Update gift spawning and update gifts/particles
  if (timeStopTimer <= 0) {
    giftSpawnTimer += dt;
    if (giftSpawnTimer >= nextGiftDelay) {
      spawnGift();
      giftSpawnTimer = 0;
      nextGiftDelay = 10000 + Math.random() * 10000;
    }
  }
  updateGifts();
  updateParticles();

  // 2. Update Tetris dropping & CPU placements (only if time is not stopped)
  if (activePiece) {
    if (timeStopTimer <= 0) {
      if (gameMode === 'StickmanHuman_TetrisCPU') {
        updateCpuTetris(dt);
      }

      // Calculate dynamic drop interval
      let currentDropInterval = dropInterval;
      if (activePiece.isShootingDown) {
        currentDropInterval = 15; // Maximum speed visible fall (locked in)
      }

      // Apply drop gravity
      dropTimer += dt;

      if (dropTimer >= currentDropInterval) {
        dropTimer = 0;
        if (!checkCollisionAt(activePiece.x, activePiece.y + 1, activePiece.shape, board)) {
          activePiece.y++;
          lockTimer = 0;

          // Check if active piece now overlaps stickman after dropping
          if (checkActivePieceCollision()) {
            // Try to push stickman down by 1 cell height
            stickman.y += cellHeight;
            // Check if stickman now collides with static board or floor
            if (checkStickmanStaticCollisionAt(stickman.x, stickman.y)) {
              endGame(2, "Player 1 was crushed under a falling tetromino!");
              return;
            }
          }
        }
      }

      // Trigger lock delay timers
      if (checkCollisionAt(activePiece.x, activePiece.y + 1, activePiece.shape, board)) {
        if (activePiece.isShootingDown) {
          lockPiece(); // Instantly lock if it was shot down
        } else {
          lockTimer += dt;
          if (lockTimer >= 500) {
            lockPiece();
          }
        }
      } else {
        lockTimer = 0;
      }
    }
  }

  // Handle Smooth DAS Keyboard inputs
  handleTetrisDas();

  // Update CPU Stickman pathing decisions
  if (gameMode === 'StickmanCPU_TetrisHuman') {
    updateCpuStickmanInputs();
  }

  // Render all visual scenes
  render();

  if (animFrame % 10 === 0) {
    updateStats();
  }

  requestAnimationFrame(gameLoop);
}


function endGame(winningPlayer, reason) {
  gameActive = false;

  if (winningPlayer === 2) {
    // Stickman death â€” play ragdoll animation first
    deathAnim = {
      winningPlayer,
      reason,
      startTime: performance.now(),
      duration: 1500, // ms
      vx: (Math.random() > 0.5 ? 1 : -1) * 4,
      vy: -8,
      angle: 0,
      angularVel: (Math.random() > 0.5 ? 1 : -1) * 0.22,
      x: stickman.x,
      y: stickman.y
    };
    runDeathAnimation();
  } else {
    showEndOverlay(winningPlayer, reason);
  }
}

function showEndOverlay(winningPlayer, reason) {
  deathAnim = null;
  const overlay = document.getElementById('end-overlay');
  const titleEl = document.getElementById('overlay-title');
  const descEl = document.getElementById('overlay-desc');

  if (winningPlayer === 1) {
    titleEl.innerText = "Player 1 Wins!";
    titleEl.className = "overlay-title p1-color";
    titleEl.style.textShadow = "0 0 20px rgba(0, 255, 128, 0.6)";
    descEl.innerText = reason;
  } else {
    titleEl.innerText = "Player 2 Wins!";
    titleEl.className = "overlay-title p2-color";
    titleEl.style.textShadow = "0 0 20px rgba(255, 51, 102, 0.6)";
    descEl.innerText = reason;
  }

  overlay.classList.add('active');
}

function runDeathAnimation() {
  if (!deathAnim) return;
  const now = performance.now();
  const elapsed = now - deathAnim.startTime;
  const progress = Math.min(elapsed / deathAnim.duration, 1);

  // Physics for the ragdoll
  deathAnim.vy += 0.45; // gravity
  deathAnim.x += deathAnim.vx;
  deathAnim.y += deathAnim.vy;
  deathAnim.angle += deathAnim.angularVel;

  // Re-render the board + ragdoll each frame
  ctx.fillStyle = '#080810';
  ctx.fillRect(0, 0, cols * cellWidth, rows * cellHeight);
  drawGrid();
  drawExitZone();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c] !== null) drawBlock(r, c, board[r][c]);
    }
  }

  // Red flash overlay (fades in then out)
  const flashAlpha = progress < 0.2 ? progress / 0.2 * 0.4 : (1 - progress) * 0.35;
  ctx.save();
  ctx.fillStyle = `rgba(255, 30, 30, ${flashAlpha})`;
  ctx.fillRect(0, 0, cols * cellWidth, rows * cellHeight);
  ctx.restore();

  // Draw ragdoll stickman
  drawDeadStickman(deathAnim.x, deathAnim.y, deathAnim.angle, 1 - progress * 0.8);

  if (progress < 1) {
    requestAnimationFrame(runDeathAnimation);
  } else {
    showEndOverlay(deathAnim.winningPlayer, deathAnim.reason);
  }
}


function updateStats() {
  const timeEl = document.getElementById('stat-time');
  if (gameStartTime) {
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    timeEl.innerText = `${m}:${s}`;
  } else {
    timeEl.innerText = "00:00";
  }

  let maxHeight = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (board[r][c] !== null) {
        const h = rows - r;
        if (h > maxHeight) maxHeight = h;
        break;
      }
    }
  }
  const dangerPercent = Math.min(100, Math.floor((maxHeight / rows) * 100));
  const dangerEl = document.getElementById('stat-danger');
  dangerEl.innerText = `${dangerPercent}%`;

  if (dangerPercent > 70) {
    dangerEl.style.color = '#ff3366';
    dangerEl.style.textShadow = '0 0 10px rgba(255, 51, 102, 0.5)';
  } else if (dangerPercent > 40) {
    dangerEl.style.color = '#ff9933';
    dangerEl.style.textShadow = '0 0 10px rgba(255, 153, 51, 0.5)';
  } else {
    dangerEl.style.color = '#fff';
    dangerEl.style.textShadow = 'none';
  }
}

// Render Canvas elements
function render() {
  // Dark slate background
  ctx.fillStyle = '#080810';
  ctx.fillRect(0, 0, cols * cellWidth, rows * cellHeight);

  // Grid guidelines
  drawGrid();

  // Top escape arrow highlighter
  drawExitZone();

  // Static placed tetromino blocks
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c] !== null) {
        drawBlock(r, c, board[r][c]);
      }
    }
  }

  // Draw modern ghost projection piece
  drawGhostPiece();

  // Draw active falling tetromino
  if (activePiece) {
    for (let r = 0; r < activePiece.shape.length; r++) {
      for (let c = 0; c < activePiece.shape[r].length; c++) {
        if (activePiece.shape[r][c]) {
          drawBlock(activePiece.y + r, activePiece.x + c, activePiece.color);
        }
      }
    }
  }

  // Draw bullets
  drawBullets();

  // Draw gifts
  drawGifts();

  // Draw particles
  drawParticles();

  // Draw animated stickman
  drawStickman();

  // Draw Time Stop overlay if active
  drawTimeStopUI();

  // Draw Blaster overlay if active
  drawBlasterUI();
}


function drawRoundedRect(context, rx, ry, w, h, radius) {
  context.beginPath();
  context.moveTo(rx + radius, ry);
  context.arcTo(rx + w, ry, rx + w, ry + h, radius);
  context.arcTo(rx + w, ry + h, rx, ry + h, radius);
  context.arcTo(rx, ry + h, rx, ry, radius);
  context.arcTo(rx, ry, rx + w, ry, radius);
  context.closePath();
}

