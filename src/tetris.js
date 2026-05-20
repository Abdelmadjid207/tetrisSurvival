// TETRIS MODULE: Grid, active piece drops, locking, rotations, DAS inputs, ghost projection, CPU AI and previews
    function getRandomPiece() {
      const p = PIECES[Math.floor(Math.random() * PIECES.length)];
      return {
        type: p.type,
        color: p.color,
        shape: p.shape.map(row => [...row]),
        originalShape: p.shape.map(row => [...row]),
        x: Math.floor((cols - p.shape[0].length) / 2),
        y: p.type === 'I' ? -1 : 0
      };
    }

    // Spawn a piece
    function spawnPiece() {
      if (nextPiece === null) {
        nextPiece = getRandomPiece();
      }

      activePiece = nextPiece;
      nextPiece = getRandomPiece();

      hasCpuTarget = false;
      cpuRotationsCount = 0;
      lockTimer = 0;
      hasSwappedThisTurn = false; // Reset swap check per turn

      // Spawning top-out detection
      if (checkCollisionAt(activePiece.x, activePiece.y, activePiece.shape, board)) {
        // If spawning is blocked immediately, Tetris tops out.
        // If Stickman is still alive, Stickman wins!
        endGame(1, "Stickman survived! The board topped out!");
      }
      
      renderNextPiece();
    }

    // Main Game Loop

    function isCellSolid(r, c) {
      if (c < 0 || c >= cols) return true; // Boundaries
      if (r >= rows) return true; // Floor
      if (r < 0) return false; // Ceiling

      // Check static board
      if (board[r][c] !== null) return true;

      // Check active piece blocks
      if (activePiece) {
        for (let pr = 0; pr < activePiece.shape.length; pr++) {
          for (let pc = 0; pc < activePiece.shape[pr].length; pc++) {
            if (activePiece.shape[pr][pc]) {
              const gridX = activePiece.x + pc;
              const gridY = activePiece.y + pr;
              if (gridX === c && gridY === r) {
                return true;
              }
            }
          }
        }
      }

      return false;
    }


    function checkOverlapWithPieceAt(tx, ty) {
      if (!activePiece) return false;
      for (let r = 0; r < activePiece.shape.length; r++) {
        for (let c = 0; c < activePiece.shape[r].length; c++) {
          if (activePiece.shape[r][c]) {
            const gridX = activePiece.x + c;
            const gridY = activePiece.y + r;
            const blockX = gridX * cellWidth;
            const blockY = gridY * cellHeight;
            if (
              tx < blockX + cellWidth &&
              tx + stickman.width > blockX &&
              ty < blockY + cellHeight &&
              ty + stickman.height > blockY
            ) {
              return true;
            }
          }
        }
      }
      return false;
    }

    // Update Stickman Platform Physics

    function lockPiece() {
      for (let r = 0; r < activePiece.shape.length; r++) {
        for (let c = 0; c < activePiece.shape[r].length; c++) {
          if (activePiece.shape[r][c]) {
            const gridX = activePiece.x + c;
            const gridY = activePiece.y + r;
            if (gridY >= 0 && gridY < rows && gridX >= 0 && gridX < cols) {
              board[gridY][gridX] = activePiece.color;
            }
          }
        }
      }

      // Check if Stickman overlaps locking blocks to handle "riding it up" or getting squished
      let stickmanOverlaps = false;
      for (let r = 0; r < activePiece.shape.length; r++) {
        for (let c = 0; c < activePiece.shape[r].length; c++) {
          if (activePiece.shape[r][c]) {
            const gridX = activePiece.x + c;
            const gridY = activePiece.y + r;
            const blockX = gridX * cellWidth;
            const blockY = gridY * cellHeight;
            if (
              stickman.x < blockX + cellWidth &&
              stickman.x + stickman.width > blockX &&
              stickman.y < blockY + cellHeight &&
              stickman.y + stickman.height > blockY
            ) {
              stickmanOverlaps = true;
            }
          }
        }
      }

      if (stickmanOverlaps) {
        let resolved = false;
        // Try scanning upwards up to 2 blocks height to push the character up
        for (let dy = 0; dy <= cellHeight * 2; dy += 1) {
          const testY = stickman.y - dy;
          if (testY < 0) break;
          if (!checkStickmanCollisionAt(stickman.x, testY)) {
            stickman.y = testY;
            stickman.vy = 0;
            stickman.isGrounded = true;
            resolved = true;
            break;
          }
        }

        if (!resolved) {
          endGame(2, "Player 1 was crushed and squished into solid terrain!");
          return;
        }
      }

      // Check for full line clears
      let linesCleared = 0;
      for (let r = rows - 1; r >= 0; r--) {
        let lineIsFull = true;
        for (let c = 0; c < cols; c++) {
          if (board[r][c] === null) {
            lineIsFull = false;
            break;
          }
        }

        if (lineIsFull) {
          linesCleared++;
          // Remove the row
          board.splice(r, 1);
          // Insert new empty row at top
          board.unshift(Array(cols).fill(null));

          // Instant synchronized drop for stickman if above or inside this cleared row
          const feetRow = Math.floor((stickman.y + stickman.height - 5) / cellHeight);
          if (feetRow <= r) {
            stickman.y += cellHeight;
          }

          // Offset the index to re-verify this spliced row coordinate
          r++;
        }
      }

      if (linesCleared > 0) {
        updateStats(); // Instant HUD update
      }

      spawnPiece();
    }

    // Breadth-First Search (BFS) to find paths for Stickman escape checks & AI navigation

    function getPieceColumns(piece) {
      let colsList = [];
      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
          if (piece.shape[r][c]) {
            const col = piece.x + c;
            if (!colsList.includes(col)) {
              colsList.push(col);
            }
          }
        }
      }
      return colsList;
    }

    // CPU Tetris Placements AI
    function updateCpuTetris(dt) {
      if (!activePiece) return;

      if (!hasCpuTarget) {
        const bestMove = getBestTetrisMove();
        let col = bestMove.col;
        
        // 18% random offset chance for human stickman survival
        if (Math.random() < 0.18) {
          const offset = Math.random() < 0.5 ? -1 : 1;
          const shapeSize = activePiece.shape.length;
          
          let minC = shapeSize, maxC = 0;
          for (let r = 0; r < shapeSize; r++) {
            for (let c = 0; c < shapeSize; c++) {
              if (activePiece.shape[r][c]) {
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
              }
            }
          }

          const newCol = col + offset;
          if (newCol >= -minC && newCol <= cols - 1 - maxC) {
            col = newCol;
          }
        }

        targetCol = col;
        targetRot = bestMove.rot;
        hasCpuTarget = true;
      }

      cpuMoveTimer += dt;
      if (cpuMoveTimer >= 140) { // CPU moves every 140ms
        cpuMoveTimer = 0;

        if (cpuRotationsCount < targetRot) {
          rotatePiece();
          cpuRotationsCount++;
        } else if (activePiece.x < targetCol) {
          moveTetrisRight();
        } else if (activePiece.x > targetCol) {
          moveTetrisLeft();
        } else {
          // Alignment complete, CPU triggers shoot down
          activePiece.isShootingDown = true;
        }
      }
    }


    function predictStickmanPosition(frames) {
      let px = stickman.x;
      let py = stickman.y;
      let pvx = stickman.vx;
      let pvy = stickman.vy;
      
      const width = stickman.width;
      const height = stickman.height;
      const maxCol = cols * cellWidth;
      const maxRow = rows * cellHeight;

      // Helper to check horizontal and vertical block collisions
      function isSolidAt(tx, ty) {
        if (tx < 0 || tx + width > maxCol) return true;
        if (ty + height > maxRow) return true;

        const startCol = Math.floor(tx / cellWidth);
        const endCol = Math.floor((tx + width - 0.1) / cellWidth);
        const startRow = Math.floor(ty / cellHeight);
        const endRow = Math.floor((ty + height - 0.1) / cellHeight);

        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            if (r >= 0 && r < rows && c >= 0 && c < cols) {
              if (board[r][c] !== null) return true;
            }
          }
        }
        return false;
      }

      for (let f = 0; f < frames; f++) {
        // Horizontal movement & wall collision
        px += pvx;
        if (px < 0) {
          px = 0;
          pvx = 0;
        } else if (px + width > maxCol) {
          px = maxCol - width;
          pvx = 0;
        }

        // Check horizontal block collision
        if (isSolidAt(px, py)) {
          if (pvx > 0) {
            const rightCol = Math.floor((px + width - 0.1) / cellWidth);
            px = rightCol * cellWidth - width;
          } else if (pvx < 0) {
            const leftCol = Math.floor(px / cellWidth);
            px = (leftCol + 1) * cellWidth;
          }
          pvx = 0;
        }

        // Apply gravity
        pvy += stickman.gravity;
        if (pvy > stickman.maxFallSpeed) {
          pvy = stickman.maxFallSpeed;
        }
        py += pvy;

        // Bottom floor limit
        if (py + height > maxRow) {
          py = maxRow - height;
          pvy = 0;
        }

        // Vertical block collision
        if (isSolidAt(px, py)) {
          if (pvy > 0) {
            const bottomRow = Math.floor((py + height - 0.1) / cellHeight);
            py = bottomRow * cellHeight - height;
          } else if (pvy < 0) {
            const topRow = Math.floor(py / cellHeight);
            py = (topRow + 1) * cellHeight;
          }
          pvy = 0;
        }
      }

      return { x: px, y: py };
    }

    function getBestTetrisMove() {
      if (!activePiece) return { col: Math.floor(cols / 2) - 1, rot: 0 };

      let bestScore = -Infinity;
      let bestCol = Math.floor(cols / 2) - 1;
      let bestRot = 0;

      // Evaluate all 4 rotations
      for (let rot = 0; rot < 4; rot++) {
        let tempShape = activePiece.originalShape;
        for (let i = 0; i < rot; i++) {
          tempShape = rotateMatrix(tempShape);
        }

        const shapeSize = tempShape.length;
        let minC = shapeSize, maxC = 0;
        for (let r = 0; r < shapeSize; r++) {
          for (let c = 0; c < shapeSize; c++) {
            if (tempShape[r][c]) {
              if (c < minC) minC = c;
              if (c > maxC) maxC = c;
            }
          }
        }

        const startCol = -minC;
        const endCol = cols - 1 - maxC;

        for (let col = startCol; col <= endCol; col++) {
          const result = simulateDrop(col, tempShape);
          if (result) {
            const { simBoard, rIdx, linesCleared } = result;

            // Calculate movement and drop time to estimate frames lookahead
            const steps = rot + Math.abs(col - activePiece.x);
            const alignFrames = steps * (140 / 16.67);
            const dropFrames = (rIdx - activePiece.y) * (15 / 16.67);
            const totalFrames = Math.max(0, alignFrames + dropFrames);

            // Predict stickman position at the moment of landing
            const predictedStickman = predictStickmanPosition(totalFrames);
            const stickmanC = Math.floor((predictedStickman.x + stickman.width / 2) / cellWidth);
            const stickmanR = Math.floor((predictedStickman.y + stickman.height - 5) / cellHeight);

            const score = evaluateTetrisBoard(simBoard, stickmanC, stickmanR, col, rIdx, tempShape, linesCleared);
            if (score > bestScore) {
              bestScore = score;
              bestCol = col;
              bestRot = rot;
            }
          }
        }
      }

      return { col: bestCol, rot: bestRot };
    }

    function simulateDrop(col, shape) {
      let simBoard = board.map(row => [...row]);
      let rIdx = -2;
      while (true) {
        if (checkCollisionAt(col, rIdx + 1, shape, simBoard)) {
          break;
        }
        rIdx++;
        if (rIdx > rows) break;
      }

      let placed = false;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            const gridX = col + c;
            const gridY = rIdx + r;
            if (gridY >= 0 && gridY < rows && gridX >= 0 && gridX < cols) {
              simBoard[gridY][gridX] = 'simulated';
              placed = true;
            }
          }
        }
      }

      if (!placed) return null;

      // Count and clear completed lines in the simulated board
      let linesCleared = 0;
      for (let r = rows - 1; r >= 0; r--) {
        let lineIsFull = true;
        for (let c = 0; c < cols; c++) {
          if (simBoard[r][c] === null) {
            lineIsFull = false;
            break;
          }
        }
        if (lineIsFull) {
          linesCleared++;
          simBoard.splice(r, 1);
          simBoard.unshift(Array(cols).fill(null));
          r++; // check this row index again
        }
      }

      return { simBoard, rIdx, linesCleared };
    }

    // Evaluates board score states: targets the stickman, avoids high bumps, blocks columns, rewards line clears, protects against topping out
    function evaluateTetrisBoard(simBoard, stickmanCol, stickmanRow, col, rIdx, shape, linesCleared) {
      let heights = Array(cols).fill(0);
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (simBoard[r][c] !== null) {
            heights[c] = rows - r;
            break;
          }
        }
      }

      let score = 0;
      let crushedStickman = false;

      // Track newly placed blocks relative to the stickman's predicted location
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            const gridX = col + c;
            const gridY = rIdx + r;
            if (gridY >= 0 && gridY < rows && gridX >= 0 && gridX < cols) {
              if (gridX === stickmanCol) {
                // Placed directly on or above stickman
                if (gridY <= stickmanRow) {
                  score += 150;
                  // Reward closer heights
                  score += (gridY / rows) * 100;
                }
                if (gridY === stickmanRow || gridY === stickmanRow - 1) {
                  crushedStickman = true;
                }
              } else if (Math.abs(gridX - stickmanCol) === 1) {
                if (gridY <= stickmanRow) {
                  score += 65;
                }
              }
            }
          }
        }
      }

      if (crushedStickman) score += 1000;

      // Reward completed lines
      score += linesCleared * 250;

      // Penalty for holes created
      let holes = 0;
      for (let c = 0; c < cols; c++) {
        let blockFound = false;
        for (let r = 0; r < rows; r++) {
          if (simBoard[r][c] !== null) {
            blockFound = true;
          } else if (blockFound && simBoard[r][c] === null) {
            holes++;
          }
        }
      }
      score -= holes * 45;

      // Flatness penalty
      let bumpiness = 0;
      for (let c = 0; c < cols - 1; c++) {
        bumpiness += Math.abs(heights[c] - heights[c + 1]);
      }
      score -= bumpiness * 5;

      // Max height board top-out protection
      const maxHeight = Math.max(...heights);
      if (maxHeight > 12) {
        // Apply dynamic exponential penalty to avoid topping out near the ceiling (max height is 20)
        score -= Math.pow(maxHeight - 11, 2.5) * 50;
      } else {
        score -= maxHeight * 8;
      }

      return score;
    }

    // Helper: generic Tetris rotation matrix
    function rotateMatrix(matrix) {
      const N = matrix.length;
      let rotated = Array.from({ length: N }, () => Array(N).fill(0));
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          rotated[c][N - 1 - r] = matrix[r][c];
        }
      }
      return rotated;
    }

    // Helper: verify generic Tetris collisions
    function checkCollisionAt(gridX, gridY, shape, testBoard) {
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            const boardX = gridX + c;
            const boardY = gridY + r;
            if (boardX < 0 || boardX >= cols || boardY >= rows) {
              return true;
            }
            if (boardY >= 0 && testBoard[boardY][boardX] !== null) {
              return true;
            }
          }
        }
      }
      return false;
    }

    // Shift Tetris blocks

    function moveTetrisLeft() {
      if (!activePiece) return;
      if (!checkCollisionAt(activePiece.x - 1, activePiece.y, activePiece.shape, board)) {
        activePiece.x--;
        lockTimer = 0;

        // Push stickman left if overlapped
        if (checkActivePieceCollision()) {
          stickman.x -= cellWidth;
          if (checkStickmanStaticCollisionAt(stickman.x, stickman.y)) {
            endGame(2, "Player 1 was crushed against a wall!");
          }
        }
      }
    }

    function moveTetrisRight() {
      if (!activePiece) return;
      if (!checkCollisionAt(activePiece.x + 1, activePiece.y, activePiece.shape, board)) {
        activePiece.x++;
        lockTimer = 0;

        // Push stickman right if overlapped
        if (checkActivePieceCollision()) {
          stickman.x += cellWidth;
          if (checkStickmanStaticCollisionAt(stickman.x, stickman.y)) {
            endGame(2, "Player 1 was crushed against a wall!");
          }
        }
      }
    }

    // Dynamic rotation kicks
    function rotatePiece() {
      if (!activePiece) return;
      const rotatedShape = rotateMatrix(activePiece.shape);

      // Multi-point wall-kick offsets
      const offsets = [
        { dx: 0, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: -1 },
        { dx: 0, dy: -2 },
        { dx: -2, dy: 0 },
        { dx: 2, dy: 0 }
      ];

      for (const offset of offsets) {
        const newX = activePiece.x + offset.dx;
        const newY = activePiece.y + offset.dy;
        if (!checkCollisionAt(newX, newY, rotatedShape, board)) {
          // Temporarily apply rotation to check stickman overlap
          const oldShape = activePiece.shape;
          const oldX = activePiece.x;
          const oldY = activePiece.y;
          
          activePiece.shape = rotatedShape;
          activePiece.x = newX;
          activePiece.y = newY;
          
          if (checkActivePieceCollision()) {
            let resolved = false;
            const pushDirections = [
              { dx: 0, dy: -cellHeight },
              { dx: -cellWidth, dy: 0 },
              { dx: cellWidth, dy: 0 }
            ];
            for (const pd of pushDirections) {
              const tx = stickman.x + pd.dx;
              const ty = stickman.y + pd.dy;
              if (!checkStickmanStaticCollisionAt(tx, ty) && !checkOverlapWithPieceAt(tx, ty)) {
                stickman.x = tx;
                stickman.y = ty;
                resolved = true;
                break;
              }
            }
            
            if (!resolved) {
              // Revert because rotation would crush stickman
              activePiece.shape = oldShape;
              activePiece.x = oldX;
              activePiece.y = oldY;
              continue;
            }
          }
          
          lockTimer = 0;
          return;
        }
      }
    }

    // DAS Keyboard Auto Repeat sliding
    function handleTetrisDas() {
      if (timeStopTimer > 0) return;
      const now = Date.now();
      if (tetrisKeys.left.pressed) {
        const elapsed = now - tetrisKeys.left.lastTrigger;
        if (elapsed > tetrisKeys.left.delay) {
          moveTetrisLeft();
          tetrisKeys.left.lastTrigger = now - (tetrisKeys.left.delay - tetrisKeys.left.repeat);
        }
      }
      if (tetrisKeys.right.pressed) {
        const elapsed = now - tetrisKeys.right.lastTrigger;
        if (elapsed > tetrisKeys.right.delay) {
          moveTetrisRight();
          tetrisKeys.right.lastTrigger = now - (tetrisKeys.right.delay - tetrisKeys.right.repeat);
        }
      }
    }

    // Trigger Game Ends overlays

    function drawGrid() {
      ctx.strokeStyle = '#16162a';
      ctx.lineWidth = 1;
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * cellWidth, 0);
        ctx.lineTo(c * cellWidth, rows * cellHeight);
        ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * cellHeight);
        ctx.lineTo(cols * cellWidth, r * cellHeight);
        ctx.stroke();
      }

      ctx.strokeStyle = '#262640';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, cols * cellWidth, rows * cellHeight);
    }

    function drawExitZone() {
      ctx.save();
      const grad = ctx.createLinearGradient(0, 0, 0, cellHeight);
      grad.addColorStop(0, 'rgba(0, 255, 128, 0.22)');
      grad.addColorStop(1, 'rgba(0, 255, 128, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cols * cellWidth, cellHeight);

      // Neon separation border
      ctx.strokeStyle = '#00ff80';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00ff80';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, cellHeight);
      ctx.lineTo(cols * cellWidth, cellHeight);
      ctx.stroke();

      // Pulsing green indicators arrows
      ctx.fillStyle = '#00ff80';
      const pulse = Math.sin(Date.now() * 0.006) * (cellHeight * 0.1);
      ctx.shadowBlur = 8;
      const arrowSize = Math.max(2, cellWidth * 0.2);
      for (let c = 0; c < cols; c++) {
        const x = c * cellWidth + cellWidth / 2;
        const y = cellHeight * 0.5 + pulse;
        
        ctx.beginPath();
        ctx.moveTo(x, y - arrowSize);
        ctx.lineTo(x - arrowSize, y);
        ctx.lineTo(x - arrowSize / 2, y);
        ctx.lineTo(x - arrowSize / 2, y + arrowSize);
        ctx.lineTo(x + arrowSize / 2, y + arrowSize);
        ctx.lineTo(x + arrowSize / 2, y);
        ctx.lineTo(x + arrowSize, y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    function drawBlock(r, c, color, isGhost = false) {
      const x = c * cellWidth;
      const y = r * cellHeight;

      if (isGhost) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.strokeRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4);
        ctx.restore();
        return;
      }

      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;

      // Rounded rect shape
      drawRoundedRect(ctx, x + 2, y + 2, cellWidth - 4, cellHeight - 4, 3.5);
      ctx.fill();

      // Highlight/bevel top shine
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 2);
      ctx.lineTo(x + cellWidth - 2, y + 2);
      ctx.lineTo(x + cellWidth - 4, y + 4);
      ctx.lineTo(x + 4, y + 4);
      ctx.closePath();
      ctx.fill();

      // Bottom shadow beveled contrast
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.moveTo(x + 2, y + cellHeight - 2);
      ctx.lineTo(x + cellWidth - 2, y + cellHeight - 2);
      ctx.lineTo(x + cellWidth - 4, y + cellHeight - 4);
      ctx.lineTo(x + 4, y + cellHeight - 4);
      ctx.closePath();
      ctx.fill();

      // Overlay wireframes border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.15;
      drawRoundedRect(ctx, x + 2, y + 2, cellWidth - 4, cellHeight - 4, 3.5);
      ctx.stroke();
      ctx.restore();
    }


    function drawGhostPiece() {
      if (!activePiece) return;

      let ghostY = activePiece.y;
      while (!checkCollisionAt(activePiece.x, ghostY + 1, activePiece.shape, board)) {
        ghostY++;
      }

      if (ghostY > activePiece.y) {
        for (let r = 0; r < activePiece.shape.length; r++) {
          for (let c = 0; c < activePiece.shape[r].length; c++) {
            if (activePiece.shape[r][c]) {
              drawBlock(ghostY + r, activePiece.x + c, activePiece.color, true);
            }
          }
        }
      }
    }

    // Render stickman onto Canvas with glowing physics

    function renderNextPiece() {
      nextCtx.fillStyle = '#080810';
      nextCtx.fillRect(0, 0, 120, 120);

      if (!nextPiece) return;

      const shape = nextPiece.shape;
      const size = shape.length;
      const previewCellSize = 22;

      // Find boundaries to center correctly
      let minC = size, maxC = 0, minR = size, maxR = 0;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (shape[r][c]) {
            if (c < minC) minC = c;
            if (c > maxC) maxC = c;
            if (r < minR) minR = r;
            if (r > maxR) maxR = r;
          }
        }
      }

      const pieceW = (maxC - minC + 1) * previewCellSize;
      const pieceH = (maxR - minR + 1) * previewCellSize;
      const offsetX = (120 - pieceW) / 2 - minC * previewCellSize;
      const offsetY = (120 - pieceH) / 2 - minR * previewCellSize;

      nextCtx.save();
      nextCtx.shadowColor = nextPiece.color;
      nextCtx.shadowBlur = 8;

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (shape[r][c]) {
            const x = offsetX + c * previewCellSize;
            const y = offsetY + r * previewCellSize;
            nextCtx.fillStyle = nextPiece.color;
            
            drawRoundedRect(nextCtx, x + 1, y + 1, previewCellSize - 2, previewCellSize - 2, 4);
            nextCtx.fill();
          }
        }
      }
      nextCtx.restore();
    }

    // Render Hold Tetromino preview panel
    function renderHoldPiece() {
      holdCtx.fillStyle = '#080810';
      holdCtx.fillRect(0, 0, 120, 120);

      if (!holdPiece) return;

      const shape = holdPiece.shape;
      const size = shape.length;
      const previewCellSize = 22;

      // Find boundaries to center correctly
      let minC = size, maxC = 0, minR = size, maxR = 0;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (shape[r][c]) {
            if (c < minC) minC = c;
            if (c > maxC) maxC = c;
            if (r < minR) minR = r;
            if (r > maxR) maxR = r;
          }
        }
      }

      const pieceW = (maxC - minC + 1) * previewCellSize;
      const pieceH = (maxR - minR + 1) * previewCellSize;
      const offsetX = (120 - pieceW) / 2 - minC * previewCellSize;
      const offsetY = (120 - pieceH) / 2 - minR * previewCellSize;

      holdCtx.save();
      holdCtx.shadowColor = holdPiece.color;
      holdCtx.shadowBlur = 8;

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (shape[r][c]) {
            const x = offsetX + c * previewCellSize;
            const y = offsetY + r * previewCellSize;
            holdCtx.fillStyle = holdPiece.color;
            
            drawRoundedRect(holdCtx, x + 1, y + 1, previewCellSize - 2, previewCellSize - 2, 4);
            holdCtx.fill();
          }
        }
      }
      holdCtx.restore();
    }

    // Swaps active piece with stored hold piece slot
    function holdCurrentPiece() {
      if (!activePiece || hasSwappedThisTurn) return;

      const currentType = activePiece.type;

      if (holdPiece === null) {
        // Initial store: active goes to hold, next piece spawns
        holdPiece = {
          type: activePiece.type,
          color: activePiece.color,
          shape: activePiece.originalShape.map(row => [...row]),
          originalShape: activePiece.originalShape.map(row => [...row])
        };
        activePiece = null;
        spawnPiece();
      } else {
        // Swap pieces
        const temp = holdPiece;
        holdPiece = {
          type: activePiece.type,
          color: activePiece.color,
          shape: activePiece.originalShape.map(row => [...row]),
          originalShape: activePiece.originalShape.map(row => [...row])
        };

        activePiece = {
          type: temp.type,
          color: temp.color,
          shape: temp.originalShape.map(row => [...row]),
          originalShape: temp.originalShape.map(row => [...row]),
          x: Math.floor((cols - temp.shape[0].length) / 2),
          y: temp.type === 'I' ? -1 : 0
        };

        // If newly swapped piece blocks grid on spawn, top-out
        if (checkCollisionAt(activePiece.x, activePiece.y, activePiece.shape, board)) {
          endGame(1, "Stickman survived! The board topped out!");
        }
      }

      hasSwappedThisTurn = true;
      renderHoldPiece();
    }

    // Shoots block instantly to the bottom floor
    function hardDrop() {
      if (!activePiece) return;

      let targetY = activePiece.y;
      while (!checkCollisionAt(activePiece.x, targetY + 1, activePiece.shape, board)) {
        targetY++;
      }

      // Snap piece downwards
      activePiece.y = targetY;

      // Lock piece immediately
      lockPiece();
    }

