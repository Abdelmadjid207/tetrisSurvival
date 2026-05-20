// STICKMAN MODULE: Physics, Controls, BFS Pathfinding, and Rendering
function checkStickmanStaticCollisionAt(tx, ty) {
  if (tx < 0 || tx + stickman.width > (cols * cellWidth)) return true;
  if (ty + stickman.height > (rows * cellHeight)) return true;

  const startCol = Math.floor(tx / cellWidth);
  const endCol = Math.floor((tx + stickman.width - 0.1) / cellWidth);
  const startRow = Math.floor(ty / cellHeight);
  const endRow = Math.floor((ty + stickman.height - 0.1) / cellHeight);

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        if (board[r][c] !== null) return true;
      }
    }
  }
  return false;
}

function updateStickman() {
  let keys = { a: false, d: false, w: false, space: false, shift: false };

  if (gameMode === 'HvH' || gameMode === 'StickmanHuman_TetrisCPU') {
    // Human keys binding
    keys.a = activeKeys['KeyA'] || activeKeys['a'];
    keys.d = activeKeys['KeyD'] || activeKeys['d'];
    keys.w = activeKeys['KeyW'] || activeKeys['w'];
    keys.space = activeKeys['Space'] || activeKeys[' '];
    keys.shift = activeKeys['KeyX'] || activeKeys['x'] || activeKeys['X'];
  } else {
    // CPU controls Stickman
    keys = cpuKeys;
  }

  // Update facing orientation based on manual inputs FIRST
  if (keys.a && !keys.d) stickman.facing = 'left';
  if (keys.d && !keys.a) stickman.facing = 'right';

  stickman.isDashing = false;

  // Dash Slide forces movement in facing direction
  if (keys.shift) {
    stickman.isDashing = true;
    if (stickman.facing === 'left') {
      keys.a = true;
      keys.d = false;
    } else {
      keys.d = true;
      keys.a = false;
    }
  }

  let speedMulti = keys.shift ? 2.5 : 1.0;

  // Horizontal velocities
  stickman.vx = 0;
  if (keys.a) stickman.vx = -stickman.speed * speedMulti;
  if (keys.d) stickman.vx = stickman.speed * speedMulti;

  // Check adjacent vertical walls
  const leftWall = checkLeftWall();
  const rightWall = checkRightWall();
  const nextToWall = leftWall || rightWall;

  let isClimbingThisFrame = false;
  if (nextToWall && keys.w) {
    stickman.vy = stickman.climbSpeed;
    isClimbingThisFrame = true;
    stickman.isClimbing = true;
    stickman.doubleJumpUsed = false;
  } else {
    stickman.isClimbing = false;
  }

  // Gravity acceleration
  if (!isClimbingThisFrame) {
    stickman.vy += stickman.gravity;
    if (stickman.vy > stickman.maxFallSpeed) {
      stickman.vy = stickman.maxFallSpeed;
    }
  }

  // Jumps (Normal on ground, Wall jump on wall climbing, Double jump in air)
  const spacePressedThisFrame = keys.space && !stickman.spaceWasPressed;
  stickman.spaceWasPressed = keys.space;

  if (spacePressedThisFrame) {
    if (stickman.isGrounded) {
      stickman.vy = stickman.jumpForce;
      stickman.isGrounded = false;
    } else if (stickman.isClimbing) {
      // Wall Jump mechanic! Boost upwards and kick away from the wall
      stickman.vy = stickman.jumpForce * 0.9;
      if (leftWall) {
        stickman.vx = stickman.speed; // push right
      } else if (rightWall) {
        stickman.vx = -stickman.speed; // push left
      }
      stickman.isClimbing = false;
    } else if (!stickman.doubleJumpUsed) {
      // Double Jump!
      stickman.vy = stickman.jumpForce * 0.85; // Slightly weaker second jump
      stickman.doubleJumpUsed = true;
    }
  }

  // Snap & Resolve X position
  stickman.x += stickman.vx;
  resolveXCollisions();

  // Snap & Resolve Y position
  stickman.y += stickman.vy;
  stickman.isGrounded = false;
  resolveYCollisions();

  // Keep stickman boundary bounded
  if (stickman.x < 0) stickman.x = 0;
  if (stickman.x + stickman.width > (cols * cellWidth)) stickman.x = (cols * cellWidth) - stickman.width;

  // Win Check: escape through top row 0 (y < cellHeight)
  if (stickman.y < cellHeight) {
    endGame(1, "Player 1 escaped the pit! Escape route successful.");
  }
}

// Collision Resolvers for character against static placed board block cells
function checkLeftWall() {
  const startRow = Math.floor(stickman.y / cellHeight);
  const endRow = Math.floor((stickman.y + stickman.height - 1) / cellHeight);
  const colToCheck = Math.floor((stickman.x - 2) / cellWidth); // 2px left buffer

  if (colToCheck < 0) return false; // Outer grid boundary is not climbable

  for (let r = startRow; r <= endRow; r++) {
    if (r >= 0 && r < rows) {
      if (isCellSolid(r, colToCheck)) return true;
    }
  }
  return false;
}

function checkRightWall() {
  const startRow = Math.floor(stickman.y / cellHeight);
  const endRow = Math.floor((stickman.y + stickman.height - 1) / cellHeight);
  const colToCheck = Math.floor((stickman.x + stickman.width + 2) / cellWidth); // 2px right buffer

  if (colToCheck >= cols) return false;

  for (let r = startRow; r <= endRow; r++) {
    if (r >= 0 && r < rows) {
      if (isCellSolid(r, colToCheck)) return true;
    }
  }
  return false;
}

function resolveXCollisions() {
  const startRow = Math.floor(stickman.y / cellHeight);
  const endRow = Math.floor((stickman.y + stickman.height - 0.1) / cellHeight);
  const startCol = Math.floor(stickman.x / cellWidth);
  const endCol = Math.floor((stickman.x + stickman.width - 0.1) / cellWidth);

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        if (isCellSolid(r, c)) {

          // Dash Block Breaking Mechanic!
          if (stickman.isDashing && board[r][c] !== null) {
            board[r][c] = null; // Break the block
            continue; // Do not stop the stickman!
          }

          if (stickman.vx > 0) {
            stickman.x = c * cellWidth - stickman.width;
            stickman.vx = 0;
            return;
          } else if (stickman.vx < 0) {
            stickman.x = (c + 1) * cellWidth;
            stickman.vx = 0;
            return;
          }
        }
      }
    }
  }
}

function resolveYCollisions() {
  // Snap to bottom floor
  if (stickman.y + stickman.height > (rows * cellHeight)) {
    stickman.y = (rows * cellHeight) - stickman.height;
    stickman.vy = 0;
    stickman.isGrounded = true;
    stickman.doubleJumpUsed = false;
    return;
  }

  const startRow = Math.floor(stickman.y / cellHeight);
  const endRow = Math.floor((stickman.y + stickman.height - 0.1) / cellHeight);
  const startCol = Math.floor(stickman.x / cellWidth);
  const endCol = Math.floor((stickman.x + stickman.width - 0.1) / cellWidth);

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        if (isCellSolid(r, c)) {
          if (stickman.vy > 0) {
            stickman.y = r * cellHeight - stickman.height;
            stickman.vy = 0;
            stickman.isGrounded = true;
            stickman.doubleJumpUsed = false;
            return;
          } else if (stickman.vy < 0) {
            stickman.y = (r + 1) * cellHeight;
            stickman.vy = 0;
            return;
          }
        }
      }
    }
  }
}

// Check if Stickman overlaps ANY solid block at potential coordinates
function checkStickmanCollisionAt(tx, ty) {
  if (tx < 0 || tx + stickman.width > (cols * cellWidth)) return true;
  if (ty + stickman.height > (rows * cellHeight)) return true;

  const startCol = Math.floor(tx / cellWidth);
  const endCol = Math.floor((tx + stickman.width - 0.1) / cellWidth);
  const startRow = Math.floor(ty / cellHeight);
  const endRow = Math.floor((ty + stickman.height - 0.1) / cellHeight);

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        if (isCellSolid(r, c)) return true;
      }
    }
  }
  return false;
}

// Active falling tetromino collision checks
function checkActivePieceCollision() {
  if (!activePiece) return false;
  for (let r = 0; r < activePiece.shape.length; r++) {
    for (let c = 0; c < activePiece.shape[r].length; c++) {
      if (activePiece.shape[r][c]) {
        const gridX = activePiece.x + c;
        const gridY = activePiece.y + r;
        const blockX = gridX * cellWidth;
        const blockY = gridY * cellHeight;

        // Bounding box intersection check
        if (
          stickman.x < blockX + cellWidth &&
          stickman.x + stickman.width > blockX &&
          stickman.y < blockY + cellHeight &&
          stickman.y + stickman.height > blockY
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

// Lock active piece onto board

function isEscapeRoutePossible() {
  // Map stickman center to grid feet
  const stickmanC = Math.floor((stickman.x + stickman.width / 2) / cellWidth);
  const stickmanR = Math.floor((stickman.y + stickman.height - 5) / cellHeight);

  const { visited } = runStickmanBfs(stickmanR, stickmanC);

  // Escape if path can reach any col in row 0 or 1
  for (const key of visited) {
    const r = parseInt(key.split(',')[0]);
    if (r <= 0) return true;
  }
  return false;
}

function runStickmanBfs(startR, startC) {
  let queue = [];
  let visited = new Set();
  let parentMap = new Map();

  const startKey = `${startR},${startC}`;
  queue.push({ r: startR, c: startC });
  visited.add(startKey);

  while (queue.length > 0) {
    const curr = queue.shift();

    const neighbors = getBfsNeighbors(curr.r, curr.c, !stickman.doubleJumpUsed);
    for (const n of neighbors) {
      const nKey = `${n.r},${n.c}`;
      if (!visited.has(nKey)) {
        visited.add(nKey);
        parentMap.set(nKey, { r: curr.r, c: curr.c, type: n.type });
        queue.push({ r: n.r, c: n.c });
      }
    }
  }

  return { visited, parentMap };
}

function getBfsNeighbors(r, c, canDoubleJump) {
  let list = [];

  function isEmpty(row, col) {
    if (col < 0 || col >= cols || row < 0) return true; // Above board = open sky (escape!)
    if (row >= rows) return false;
    return !isCellSolid(row, col);
  }

  function isSolid(row, col) {
    if (col < 0 || col >= cols) return true;
    if (row >= rows) return true;
    if (row < 0) return false;
    return isCellSolid(row, col);
  }

  // Walk Left
  if (isEmpty(r, c - 1) && isEmpty(r - 1, c - 1)) {
    list.push({ r: r, c: c - 1, type: 'left' });
  }

  // Walk Right
  if (isEmpty(r, c + 1) && isEmpty(r - 1, c + 1)) {
    list.push({ r: r, c: c + 1, type: 'right' });
  }

  // Climb Up (Requires wall block adjacent)
  const leftWall = isSolid(r, c - 1) || isSolid(r - 1, c - 1);
  const rightWall = isSolid(r, c + 1) || isSolid(r - 1, c + 1);
  if (leftWall || rightWall) {
    if (isEmpty(r - 1, c) && isEmpty(r - 2, c)) {
      list.push({ r: r - 1, c: c, type: 'climb' });
    }
    // Climb to above board (escape!)
    if (r <= 1) {
      list.push({ r: -1, c: c, type: 'climb' });
    }
  }

  // Jump Up (Requires solid ground or walls nearby)
  const standing = isSolid(r + 1, c) || r >= rows - 1;
  if (standing) {
    // Single jump â€” 1 cell up
    if (isEmpty(r - 1, c) && isEmpty(r - 2, c)) {
      list.push({ r: r - 1, c: c, type: 'jump' });
    }
    // Single jump â€” 2 cells up (apex)
    if (isEmpty(r - 1, c) && isEmpty(r - 2, c) && isEmpty(r - 3, c)) {
      list.push({ r: r - 2, c: c, type: 'jump2' });
    }
    // Jump to escape (near top)
    if (r <= 2) {
      list.push({ r: -1, c: c, type: 'jump' });
    }
  }

  // Double Jump (available in air â€” allows extra 2 rows up)
  if (canDoubleJump && !standing) {
    if (isEmpty(r - 1, c) && isEmpty(r - 2, c)) {
      list.push({ r: r - 1, c: c, type: 'jump', usedDoubleJump: true });
    }
    if (r <= 2) {
      list.push({ r: -1, c: c, type: 'jump', usedDoubleJump: true });
    }
  }

  // Fall Down
  if (isEmpty(r + 1, c)) {
    list.push({ r: r + 1, c: c, type: 'fall' });
  }

  return list;
}

// CPU Stickman Pathfinding & Dodge logic
function updateCpuStickmanInputs() {
  cpuStickmanUpdateTimer++;
  if (cpuStickmanUpdateTimer >= 4) { // Faster decisions (4 frames ~67ms)
    cpuStickmanUpdateTimer = 0;

    // Urgency check â€” how close is the top of the board?
    let maxHeight = 0;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (board[r][c] !== null) { maxHeight = Math.max(maxHeight, rows - r); break; }
      }
    }
    const urgency = maxHeight / rows; // 0.0 = empty, 1.0 = full

    // Hesitation: only delay when board is calm, never when urgent
    const hesitationChance = urgency > 0.5 ? 0 : 0.08;
    if (Math.random() < hesitationChance) {
      cpuKeys.a = false; cpuKeys.d = false; cpuKeys.w = false; cpuKeys.space = false;
      return;
    }

    const step = getCpuStickmanAction();
    cpuKeys.a = false;
    cpuKeys.d = false;
    cpuKeys.w = false;
    cpuKeys.space = false;
    cpuKeys.shift = false;

    if (step) {
      const stickmanC = Math.floor((stickman.x + stickman.width / 2) / cellWidth);

      if (step.type === 'left') {
        cpuKeys.a = true;
        cpuKeys.shift = urgency > 0.4; // Dash when board is filling up
      } else if (step.type === 'right') {
        cpuKeys.d = true;
        cpuKeys.shift = urgency > 0.4;
      } else if (step.type === 'climb') {
        cpuKeys.w = true;
        if (step.c < stickmanC) cpuKeys.a = true;
        else if (step.c > stickmanC) cpuKeys.d = true;
      } else if (step.type === 'jump' || step.type === 'jump2') {
        cpuKeys.space = true;
        if (step.c < stickmanC) cpuKeys.a = true;
        else if (step.c > stickmanC) cpuKeys.d = true;
      } else if (step.type === 'fall') {
        if (step.c < stickmanC) cpuKeys.a = true;
        else if (step.c > stickmanC) cpuKeys.d = true;
      }
    } else if (urgency > 0.6) {
      // Completely trapped â€” try dash-breaking left or right to escape!
      cpuKeys.shift = true;
      const stickmanC = Math.floor((stickman.x + stickman.width / 2) / cellWidth);
      if (stickmanC > cols / 2) cpuKeys.a = true; // Break towards center
      else cpuKeys.d = true;
    }
  }
}

function getCpuStickmanAction() {
  const stickmanC = Math.floor((stickman.x + stickman.width / 2) / cellWidth);
  const stickmanR = Math.floor((stickman.y + stickman.height - 5) / cellHeight);

  const canDoubleJump = !stickman.doubleJumpUsed;
  const { visited, parentMap } = runStickmanBfs(stickmanR, stickmanC, canDoubleJump);

  // Determine danger columns of the active falling piece
  let dangerCols = [];
  if (activePiece) dangerCols = getPieceColumns(activePiece);

  // PRIMARY GOAL: find a path to row <= 0 (escape zone)
  const escapeKey = [...visited].find(k => parseInt(k.split(',')[0]) <= 0);
  if (escapeKey) {
    // Path to escape exists â€” follow it!
    let currKey = escapeKey;
    const startKey = `${stickmanR},${stickmanC}`;
    if (currKey === startKey) return null;
    let path = [];
    while (currKey !== startKey) {
      const parentInfo = parentMap.get(currKey);
      if (!parentInfo) break;
      path.push({ r: parseInt(currKey.split(',')[0]), c: parseInt(currKey.split(',')[1]), type: parentInfo.type });
      currKey = `${parentInfo.r},${parentInfo.c}`;
    }
    path.reverse();
    return path[0];
  }

  // SECONDARY GOAL: can't escape yet â€” climb as high as possible
  // and avoid danger columns
  let target = null;
  let bestScore = Infinity;

  for (const key of visited) {
    const [rStr, cStr] = key.split(',');
    const r = parseInt(rStr);
    const c = parseInt(cStr);
    const inDanger = dangerCols.includes(c);

    // Score = row (lower row = higher = better) + penalty for danger column
    let score = r + (inDanger ? 50 : 0);
    if (score < bestScore) {
      bestScore = score;
      target = { r, c };
    }
  }

  if (!target) return null;

  // Reconstruct single step from start toward target
  const startKey = `${stickmanR},${stickmanC}`;
  let currKey = `${target.r},${target.c}`;
  if (currKey === startKey) return null;

  let path = [];
  while (currKey !== startKey) {
    const parentInfo = parentMap.get(currKey);
    if (!parentInfo) break;
    path.push({ r: parseInt(currKey.split(',')[0]), c: parseInt(currKey.split(',')[1]), type: parentInfo.type });
    currKey = `${parentInfo.r},${parentInfo.c}`;
  }

  path.reverse();
  return path[0];
}


function drawDeadStickman(x, y, angle, alpha) {
  const cx = x + stickman.width / 2;
  const cy = y + stickman.height / 2;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const scale = stickman.height / 56;
  ctx.scale(scale, scale);

  ctx.strokeStyle = '#ff3366';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.shadowColor = '#ff3366';
  ctx.shadowBlur = 18;

  const headR = 7;
  // Head
  ctx.beginPath();
  ctx.arc(0, -20, headR, 0, Math.PI * 2);
  ctx.stroke();
  // X eyes
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-4, -23); ctx.lineTo(-2, -21); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-2, -23); ctx.lineTo(-4, -21); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2, -23); ctx.lineTo(4, -21); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, -23); ctx.lineTo(2, -21); ctx.stroke();
  ctx.lineWidth = 3.5;
  // Spine
  ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, 8); ctx.stroke();
  // Arms (limp)
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-12, 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(12, -4); ctx.stroke();
  // Legs (splayed)
  ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(-10, 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(10, 22); ctx.stroke();

  ctx.restore();
}

// Gift and Time Stop helper functions

function drawStickman() {
  const x = stickman.x;
  const y = stickman.y;
  const w = 20; // Original width used in coordinates
  const h = 56; // Original height used in coordinates

  ctx.save();

  // Translate to stickman base coordinate and scale
  ctx.translate(x, y);
  const scaleX = stickman.width / 20;
  const scaleY = stickman.height / 56;
  ctx.scale(scaleX, scaleY);

  ctx.strokeStyle = '#00ff80';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.shadowColor = '#00ff80';
  ctx.shadowBlur = 10;

  const headRadius = 7;
  const headX = w / 2;
  const headY = headRadius + 2;

  const spineTopX = headX;
  const spineTopY = headY + headRadius;
  const spineBotX = headX;
  const spineBotY = h * 0.6; // Hip pivot position

  // Head (Circle)
  ctx.beginPath();
  ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Spine
  ctx.beginPath();
  ctx.moveTo(spineTopX, spineTopY);
  ctx.lineTo(spineBotX, spineBotY);
  ctx.stroke();

  // Multi-state limb calculation animations
  let leftHandX, leftHandY, rightHandX, rightHandY;
  let leftFootX, leftFootY, rightFootX, rightFootY;

  const shoulderY = spineTopY + 4;

  if (stickman.isClimbing) {
    // Climbing animation
    const climbCycle = Math.sin(animFrame * 0.15) * 5;

    leftHandX = - 4;
    leftHandY = shoulderY - 4 + climbCycle;
    rightHandX = w + 4;
    rightHandY = shoulderY - 4 - climbCycle;

    leftFootX = - 2;
    leftFootY = h - 6 + climbCycle;
    rightFootX = w + 2;
    rightFootY = h - 6 - climbCycle;
  } else if (!stickman.isGrounded) {
    // Air jump pose
    leftHandX = headX - 12;
    leftHandY = headY - 4;
    rightHandX = headX + 12;
    rightHandY = headY - 4;

    leftFootX = headX - 8;
    leftFootY = h - 8;
    rightFootX = headX + 8;
    rightFootY = h - 8;
  } else if (stickman.vx !== 0) {
    // Running cycle
    const angle = animFrame * 0.22;
    const strideX = Math.sin(angle) * 8;
    const strideY = Math.max(0, Math.cos(angle) * 4);

    leftFootX = headX - 6 + strideX;
    leftFootY = h - strideY;
    rightFootX = headX + 6 - strideX;
    rightFootY = h - (4 - strideY);

    leftHandX = headX - 8 - strideX * 0.8;
    leftHandY = shoulderY + 8 + Math.cos(angle) * 4;
    rightHandX = headX + 8 + strideX * 0.8;
    rightHandY = shoulderY + 8 - Math.cos(angle) * 4;
  } else {
    // Breathing idle
    const breath = Math.sin(animFrame * 0.08) * 1.5;

    leftHandX = headX - 8;
    leftHandY = shoulderY + 12 + breath;
    rightHandX = headX + 8;
    rightHandY = shoulderY + 12 + breath;

    leftFootX = headX - 5;
    leftFootY = h;
    rightFootX = headX + 5;
    rightFootY = h;
  }

  // Draw arms
  ctx.beginPath();
  ctx.moveTo(spineTopX, shoulderY);
  ctx.lineTo(leftHandX, leftHandY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(spineTopX, shoulderY);
  ctx.lineTo(rightHandX, rightHandY);
  ctx.stroke();

  // Draw legs
  ctx.beginPath();
  ctx.moveTo(spineBotX, spineBotY);
  ctx.lineTo(leftFootX, leftFootY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(spineBotX, spineBotY);
  ctx.lineTo(rightFootX, rightFootY);
  ctx.stroke();

  ctx.restore();
}

// Render Next Tetromino preview panel
