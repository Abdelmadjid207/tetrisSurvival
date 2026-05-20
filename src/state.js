// Game Core State variables
let board = [];
let gameActive = false;
let gameMode = 'HvH'; // 'HvH', 'StickmanCPU_TetrisHuman', 'StickmanHuman_TetrisCPU'

// Stickman character state
let stickman = {
  x: 395,
  y: 372,
  width: 10,
  height: 28,
  vx: 0,
  vy: 0,
  speed: 2.2,
  jumpForce: -4.7,
  climbSpeed: -1.7,
  gravity: 0.21,
  maxFallSpeed: 6.0,
  isGrounded: false,
  isClimbing: false,
  facing: 'right',
  doubleJumpUsed: false,
  spaceWasPressed: false
};

// Death animation state
let deathAnim = null; // null = no animation running

// Gift & Time Stop state
let gifts = [];
let giftSpawnTimer = 0;
let nextGiftDelay = 15000;
let timeStopTimer = 0;
let blasterTimer = 0;
let jumpBoostTimer = 0;
let shootCooldown = 0;
let bullets = [];
let particles = [];

// Tetris active & next piece
let activePiece = null;
let nextPiece = null;

// CPU Tetris parameters
let hasCpuTarget = false;
let targetCol = 0;
let targetRot = 0;
let cpuRotationsCount = 0;
let cpuMoveTimer = 0;

// Timing
let lastTime = 0;
let dropTimer = 0;
let lockTimer = 0;
let animFrame = 0;
let gameStartTime = null;

// Keyboard bindings
let activeKeys = {};

// DAS (Delayed Auto Shift)
let tetrisKeys = {
  left: { pressed: false, lastTrigger: 0, delay: 200, repeat: 28 },
  right: { pressed: false, lastTrigger: 0, delay: 200, repeat: 28 }
};

// CPU Stickman inputs
let cpuKeys = { a: false, d: false, w: false, space: false };
let cpuStickmanUpdateTimer = 0;

// Canvas and Context handles (will be set in initialization)
let canvas, ctx, nextCanvas, nextCtx, holdCanvas, holdCtx;

// Hold slots state
let holdPiece = null;
let hasSwappedThisTurn = false;
