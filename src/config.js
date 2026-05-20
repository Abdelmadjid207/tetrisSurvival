// Grid and display settings
const cols = 40;
const rows = 20;
const cellWidth = 20;
const cellHeight = 20;
const dropInterval = 600;

// Default Stickman parameters
const STICKMAN_CONFIG = {
  width: 10,
  height: 28,
  speed: 2.2,
  jumpForce: -4.7,
  climbSpeed: -1.7,
  gravity: 0.21,
  maxFallSpeed: 6.0
};

// Tetris pieces definitions
const PIECES = [
  {
    type: 'I',
    color: '#00f0f0',
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  {
    type: 'O',
    color: '#f0f000',
    shape: [
      [1, 1],
      [1, 1]
    ]
  },
  {
    type: 'T',
    color: '#a000f0',
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    type: 'S',
    color: '#00f000',
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ]
  },
  {
    type: 'Z',
    color: '#f00000',
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    type: 'J',
    color: '#0000f0',
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    type: 'L',
    color: '#f0a000',
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  }
];
