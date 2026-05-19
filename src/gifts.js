// POWERUPS MODULE: Gifts, freezing, shooting blaster charges, bullet collisions, and neon animations
    function spawnGift() {
      // Limit x to make sure it spawns fully on the screen
      const x = 10 + Math.random() * (cols * cellWidth - 20);
      const y = -10;
      const type = Math.random() > 0.5 ? 'freeze' : 'blaster';
      gifts.push({
        x: x,
        y: y,
        width: cellWidth,
        height: cellHeight,
        speed: 0.6 + Math.random() * 0.4,
        type: type
      });
    }

    function updateGifts() {
      for (let i = gifts.length - 1; i >= 0; i--) {
        const gift = gifts[i];
        
        if (timeStopTimer <= 0) {
          const nextY = gift.y + gift.speed;
          
          if (nextY + gift.height > (rows * cellHeight)) {
            gift.y = (rows * cellHeight) - gift.height;
          } else if (checkGiftStaticCollision(gift.x, nextY, gift.width, gift.height)) {
            // Stop falling if resting on top of a static block
          } else {
            gift.y = nextY;
          }
        }
        
        // If a newly locked block spawns on top of the gift, crush it
        if (gift.y + gift.height < (rows * cellHeight) && checkGiftStaticCollision(gift.x, gift.y, gift.width, gift.height)) {
          gifts.splice(i, 1);
          continue;
        }
        
        // Catch gift check
        if (checkStickmanGiftCollision(gift)) {
          if (gift.type === 'freeze') {
            timeStopTimer = 8000; // 8 seconds temporal freeze
          } else {
            blasterTimer = 8000; // 8 seconds blaster weapon
          }
          spawnCatchParticles(gift.x + gift.width / 2, gift.y + gift.height / 2, gift.type);
          gifts.splice(i, 1);
          continue;
        }
      }
    }

    function checkGiftStaticCollision(gx, gy, gw, gh) {
      if (gy + gh > (rows * cellHeight)) return true;
      const startCol = Math.floor(gx / cellWidth);
      const endCol = Math.floor((gx + gw - 0.1) / cellWidth);
      const startRow = Math.floor(gy / cellHeight);
      const endRow = Math.floor((gy + gh - 0.1) / cellHeight);
      
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            if (board[r][c] !== null) return true;
          }
        }
      }
      return false;
    }

    function checkStickmanGiftCollision(gift) {
      return (
        stickman.x < gift.x + gift.width &&
        stickman.x + stickman.width > gift.x &&
        stickman.y < gift.y + gift.height &&
        stickman.y + stickman.height > gift.y
      );
    }

    function spawnCatchParticles(px, py, type = 'freeze') {
      const color1 = type === 'freeze' ? '#ff00ff' : '#ff0055';
      const color2 = type === 'freeze' ? '#00ffff' : '#ffcc00';
      for (let i = 0; i < 25; i++) {
        particles.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 7,
          vy: (Math.random() - 0.5) * 7 - 2, // Slight upward burst
          radius: 2 + Math.random() * 3,
          color: Math.random() > 0.5 ? color1 : color2,
          life: 1.0,
          decay: 0.015 + Math.random() * 0.015
        });
      }
    }

    function updateParticles() {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // minor gravity
        p.life -= p.decay;
        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }
    }

    function fireBullet() {
      bullets.push({
        x: stickman.x + stickman.width / 2,
        y: stickman.y,
        vy: -12 // Speed in px/frame
      });
    }

    function updateBullets(dt) {
      const stepFactor = dt / 16.6;
      for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.y += bullet.vy * stepFactor;

        // Check if out of bounds
        if (bullet.y < 0) {
          bullets.splice(i, 1);
          continue;
        }

        const c = Math.floor(bullet.x / cellWidth);
        const r = Math.floor(bullet.y / cellHeight);

        // 1. Check active piece collision first (falling block)
        if (activePiece) {
          const localCol = c - activePiece.x;
          const localRow = r - activePiece.y;
          
          if (
            localRow >= 0 && localRow < activePiece.shape.length &&
            localCol >= 0 && localCol < activePiece.shape[localRow].length
          ) {
            if (activePiece.shape[localRow][localCol]) {
              // Destroy this block of the falling piece
              activePiece.shape[localRow][localCol] = 0;
              
              // Spawn break particles
              spawnBlockBreakParticles(c * cellWidth + cellWidth / 2, r * cellHeight + cellHeight / 2);
              
              // If the entire piece is now destroyed, spawn the next piece
              let hasBlocks = false;
              for (let pr = 0; pr < activePiece.shape.length; pr++) {
                for (let pc = 0; pc < activePiece.shape[pr].length; pc++) {
                  if (activePiece.shape[pr][pc]) {
                    hasBlocks = true;
                    break;
                  }
                }
                if (hasBlocks) break;
              }
              if (!hasBlocks) {
                spawnPiece();
              }
              
              // Remove bullet
              bullets.splice(i, 1);
              continue;
            }
          }
        }

        // 2. Check static cell block collision
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          if (board[r][c] !== null) {
            // Destroy the block
            board[r][c] = null;
            // Spawn break particles
            spawnBlockBreakParticles(c * cellWidth + cellWidth / 2, r * cellHeight + cellHeight / 2);
            // Remove bullet
            bullets.splice(i, 1);
            continue;
          }
        }
      }
    }

    function spawnBlockBreakParticles(px, py) {
      for (let i = 0; i < 8; i++) {
        particles.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          radius: 1 + Math.random() * 2,
          color: Math.random() > 0.5 ? '#ff5500' : '#ffcc00',
          life: 1.0,
          decay: 0.03 + Math.random() * 0.03
        });
      }
    }


    function drawGifts() {
      for (const gift of gifts) {
        ctx.save();
        
        const mainColor = gift.type === 'freeze' ? '#ff00ff' : '#ff0055';
        const ribbonColor = gift.type === 'freeze' ? '#00ffff' : '#ffcc00';
        
        // Glow effect
        ctx.shadowColor = mainColor;
        ctx.shadowBlur = 8 + Math.sin(Date.now() * 0.01) * 3;
        
        // Present box base
        ctx.fillStyle = gift.type === 'freeze' ? '#1b002c' : '#28000e';
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 2.0;
        drawRoundedRect(ctx, gift.x, gift.y, gift.width, gift.height, 4);
        ctx.fill();
        ctx.stroke();
        
        // Ribbon (Cross)
        ctx.strokeStyle = ribbonColor;
        ctx.shadowColor = ribbonColor;
        ctx.shadowBlur = 4;
        ctx.lineWidth = 1.5;
        
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(gift.x + gift.width / 2, gift.y);
        ctx.lineTo(gift.x + gift.width / 2, gift.y + gift.height);
        ctx.stroke();
        
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(gift.x, gift.y + gift.height / 2);
        ctx.lineTo(gift.x + gift.width, gift.y + gift.height / 2);
        ctx.stroke();
        
        // Bow tie shape on top of the gift
        ctx.fillStyle = ribbonColor;
        ctx.beginPath();
        const bx = gift.x + gift.width / 2;
        const by = gift.y;
        const bowW = gift.width * 0.3;
        const bowH = gift.height * 0.4;
        ctx.moveTo(bx, by);
        ctx.bezierCurveTo(bx - bowW, by - bowH / 2, bx - bowW * 0.75, by - bowH, bx, by - bowH * 0.25);
        ctx.bezierCurveTo(bx + bowW * 0.75, by - bowH, bx + bowW, by - bowH / 2, bx, by);
        ctx.fill();
        
        ctx.restore();
      }
    }

    function drawParticles() {
      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function drawTimeStopUI() {
      if (timeStopTimer <= 0) return;

      ctx.save();
      
      // Cyber time dilation overlay (circular temporal field around stickman)
      const sx = stickman.x + stickman.width / 2;
      const sy = stickman.y + stickman.height / 2;
      const grad = ctx.createRadialGradient(sx, sy, 20, sx, sy, 550);
      grad.addColorStop(0, 'rgba(0, 255, 255, 0.04)');
      grad.addColorStop(0.6, 'rgba(0, 110, 255, 0.16)');
      grad.addColorStop(1, 'rgba(4, 4, 20, 0.5)');
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cols * cellWidth, rows * cellHeight);

      // Warning neon frame border
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.35)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;
      ctx.strokeRect(6, 6, cols * cellWidth - 12, rows * cellHeight - 12);

      // Time Freeze digital display header text
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#00ffff';
      ctx.font = "900 24px 'Orbitron', sans-serif";
      ctx.textAlign = 'center';
      
      const secondsVal = (timeStopTimer / 1000).toFixed(2);
      ctx.fillText(`TEMPORAL FREEZE: ${secondsVal}S`, (cols * cellWidth) / 2, 75);
      
      ctx.restore();
    }

    // Stats updates

    function drawBullets() {
      for (const bullet of bullets) {
        ctx.save();
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 8;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(bullet.x, bullet.y + 12);
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawBlasterUI() {
      if (blasterTimer <= 0) return;

      ctx.save();
      
      // Pulse field around stickman
      const sx = stickman.x + stickman.width / 2;
      const sy = stickman.y + stickman.height / 2;
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.45)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 8 + Math.sin(Date.now() * 0.01) * 4;
      ctx.beginPath();
      ctx.arc(sx, sy, 18 + Math.sin(Date.now() * 0.02) * 3, 0, Math.PI * 2);
      ctx.stroke();

      // Laser warning neon frame border
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.35)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 10;
      ctx.strokeRect(6, 6, cols * cellWidth - 12, rows * cellHeight - 12);

      // Blaster Active digital display header text
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffcc00';
      ctx.font = "900 24px 'Orbitron', sans-serif";
      ctx.textAlign = 'center';
      
      const secondsVal = (blasterTimer / 1000).toFixed(2);
      ctx.fillText(`BLASTER CHARGE: ${secondsVal}S`, (cols * cellWidth) / 2, 105);
      
      ctx.restore();
    }

    // Render Helper functions
