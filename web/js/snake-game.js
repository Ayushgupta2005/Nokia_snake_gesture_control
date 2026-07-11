// Nokia style snake game on canvas (ported from my pygame version)

const DIRECTIONS = {
  UP: [0, -1],
  DOWN: [0, 1],
  LEFT: [-1, 0],
  RIGHT: [1, 0],
};

const OPPOSITE = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };

// nokia green theme
const COLORS = {
  black: "#000000",
  white: "#ffffff",
  nokiaGreen: "#9bbc0f",
  darkGreen: "#8bac0f",
  lightGreen: "#ccff33",
  red: "#ff0000",
  orange: "#ffa500",
  grid: "#282828",
};

export class SnakeGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;
    this.gridSize = 20;
    this.gridWidth = Math.floor(this.width / this.gridSize);
    this.gridHeight = Math.floor(this.height / this.gridSize);

    // waiting -> playing -> gameover
    this.state = "waiting";
    this.highScore = Number(localStorage.getItem("snakeHighScore") || 0);
    this.particles = [];
    this.resetGame();
  }

  resetGame() {
    const startX = Math.floor(this.gridWidth / 2);
    const startY = Math.floor(this.gridHeight / 2);
    this.snake = [
      [startX, startY],
      [startX - 1, startY],
      [startX - 2, startY],
    ];
    this.direction = "RIGHT";
    this.nextDirection = "RIGHT";
    this.score = 0;
    this.baseSpeed = 8;
    this.particles = [];
    this.spawnFruit();
  }

  start() {
    this.resetGame();
    this.state = "playing";
  }

  get gameOver() {
    return this.state === "gameover";
  }

  spawnFruit() {
    // keep trying till we get a spot not on the snake
    while (true) {
      const x = Math.floor(Math.random() * this.gridWidth);
      const y = Math.floor(Math.random() * this.gridHeight);
      if (!this.snake.some(([sx, sy]) => sx === x && sy === y)) {
        this.fruit = [x, y];
        return;
      }
    }
  }

  addParticleEffect(x, y) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: x * this.gridSize + this.gridSize / 2,
        y: y * this.gridSize + this.gridSize / 2,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 30,
        maxLife: 30,
      });
    }
  }

  updateParticles() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  changeDirection(newDirection) {
    if (this.state !== "playing") return;
    if (!(newDirection in DIRECTIONS)) return;
    // prevent immediate reversal
    if (newDirection !== OPPOSITE[this.direction]) {
      this.nextDirection = newDirection;
    }
  }

  getCurrentSpeed() {
    return this.baseSpeed;
  }

  update() {
    if (this.state !== "playing") {
      this.updateParticles();
      return;
    }

    this.direction = this.nextDirection;

    const [headX, headY] = this.snake[0];
    const [dx, dy] = DIRECTIONS[this.direction];
    // wrap around the edges
    const newHead = [
      (headX + dx + this.gridWidth) % this.gridWidth,
      (headY + dy + this.gridHeight) % this.gridHeight,
    ];

    // self collision = game over
    if (this.snake.some(([sx, sy]) => sx === newHead[0] && sy === newHead[1])) {
      this.state = "gameover";
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem("snakeHighScore", String(this.highScore));
      }
      return;
    }

    this.snake.unshift(newHead);

    if (newHead[0] === this.fruit[0] && newHead[1] === this.fruit[1]) {
      this.score += 10;
      this.addParticleEffect(newHead[0], newHead[1]);
      this.spawnFruit();
    } else {
      this.snake.pop();
    }

    this.updateParticles();
  }

  // DRAWING

  drawGrid() {
    const { ctx } = this;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= this.width; x += this.gridSize) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, this.height);
    }
    for (let y = 0; y <= this.height; y += this.gridSize) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(this.width, y + 0.5);
    }
    ctx.stroke();
  }

  drawSnakeSegment(x, y, isHead) {
    const { ctx, gridSize } = this;
    const px = x * gridSize;
    const py = y * gridSize;

    ctx.fillStyle = isHead ? COLORS.lightGreen : COLORS.nokiaGreen;
    ctx.fillRect(px + 1, py + 1, gridSize - 2, gridSize - 2);
    ctx.strokeStyle = COLORS.darkGreen;
    ctx.strokeRect(px + 1.5, py + 1.5, gridSize - 3, gridSize - 3);

    if (isHead) {
      // eyes
      ctx.fillStyle = COLORS.black;
      ctx.fillRect(px + 5, py + 5, 3, 3);
      ctx.fillRect(px + 12, py + 5, 3, 3);
    }
  }

  drawFruit() {
    const { ctx, gridSize } = this;
    const [x, y] = this.fruit;
    const px = x * gridSize;
    const py = y * gridSize;

    // glow
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 1, py - 1, gridSize + 2, gridSize + 2);
    ctx.lineWidth = 1;
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(px + 2, py + 2, gridSize - 4, gridSize - 4);
    // shine
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(px + 4, py + 4, 4, 4);
  }

  drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      const size = Math.max(1, 3 * t);
      ctx.globalAlpha = t;
      ctx.fillStyle = COLORS.orange;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawCenteredText(text, y, font, color) {
    const { ctx } = this;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, this.width / 2, y);
  }

  drawOverlay(alpha = 0.5) {
    this.ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  draw() {
    const { ctx } = this;
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawGrid();

    for (let i = 0; i < this.snake.length; i++) {
      this.drawSnakeSegment(this.snake[i][0], this.snake[i][1], i === 0);
    }
    this.drawFruit();
    this.drawParticles();

    // score
    ctx.font = "bold 24px 'Courier New', monospace";
    ctx.fillStyle = COLORS.white;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Score: ${this.score}`, 10, 10);
    ctx.textAlign = "right";
    ctx.fillText(`Best: ${this.highScore}`, this.width - 10, 10);

    if (this.state === "waiting") {
      this.drawOverlay(0.6);
      this.drawCenteredText("NOKIA SNAKE", this.height / 2 - 60, "bold 42px 'Courier New', monospace", COLORS.nokiaGreen);
      this.drawCenteredText("Show an open palm to start", this.height / 2 + 10, "22px 'Courier New', monospace", COLORS.white);
      this.drawCenteredText("(or press any arrow key)", this.height / 2 + 45, "16px 'Courier New', monospace", COLORS.nokiaGreen);
    } else if (this.state === "gameover") {
      this.drawOverlay(0.6);
      this.drawCenteredText("GAME OVER", this.height / 2 - 55, "bold 42px 'Courier New', monospace", COLORS.white);
      this.drawCenteredText(`Final Score: ${this.score}`, this.height / 2, "26px 'Courier New', monospace", COLORS.white);
      this.drawCenteredText("Show an open palm to restart", this.height / 2 + 45, "20px 'Courier New', monospace", COLORS.nokiaGreen);
    }
  }
}
