import { useEffect, useRef, useCallback, useState } from "react";

// ─── Constants ───
const CELL = 20;
const COLS = 21;
const ROWS = 21;
const W = COLS * CELL;
const H = ROWS * CELL;

const WALL = 1;
const DOT = 2;
const POWER = 3;
const EMPTY = 0;

// Classic Pacman-style maze (21×21)
// 1 = wall, 2 = dot, 3 = power pellet, 0 = empty
function createMaze() {
  /* eslint-disable */
  return [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,3,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,3,1],
    [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,1,2,1],
    [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
    [1,1,1,1,2,1,1,1,0,1,1,1,0,1,1,1,2,1,1,1,1],
    [0,0,0,1,2,1,0,0,0,0,0,0,0,0,0,1,2,1,0,0,0],
    [1,1,1,1,2,1,0,1,1,0,0,0,1,1,0,1,2,1,1,1,1],
    [0,0,0,0,2,0,0,1,0,0,0,0,0,1,0,0,2,0,0,0,0],
    [1,1,1,1,2,1,0,1,0,0,0,0,0,1,0,1,2,1,1,1,1],
    [0,0,0,1,2,1,0,0,0,0,0,0,0,0,0,1,2,1,0,0,0],
    [1,1,1,1,2,1,0,1,1,1,1,1,1,1,0,1,2,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
    [1,3,2,1,2,2,2,2,2,2,0,2,2,2,2,2,2,1,2,3,1],
    [1,1,2,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,2,1,1],
    [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,2,1,1,1,2,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];
  /* eslint-enable */
}

const GHOST_COLORS = ["#ff0000", "#ffb8ff", "#00ffff", "#ffb852"];

// ─── Directions ───
const DIR = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

function wrapPos(x, y) {
  if (x < 0) x = COLS - 1;
  if (x >= COLS) x = 0;
  if (y < 0) y = ROWS - 1;
  if (y >= ROWS) y = 0;
  return { x, y };
}

function canMove(maze, x, y) {
  const p = wrapPos(x, y);
  return maze[p.y]?.[p.x] !== WALL;
}

// ─── Component ───
export default function PacmanGame({ onClose }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [paused, setPaused] = useState(false);

  const initState = useCallback(() => {
    const maze = createMaze();
    let totalDots = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (maze[r][c] === DOT || maze[r][c] === POWER) totalDots++;

    return {
      maze,
      pacman: { x: 10, y: 15, dir: DIR.LEFT, nextDir: DIR.LEFT, mouthOpen: 0 },
      ghosts: [
        { x: 9, y: 9, dir: DIR.UP, color: GHOST_COLORS[0], scared: false, home: true, homeTimer: 0 },
        { x: 10, y: 9, dir: DIR.UP, color: GHOST_COLORS[1], scared: false, home: true, homeTimer: 40 },
        { x: 11, y: 9, dir: DIR.UP, color: GHOST_COLORS[2], scared: false, home: true, homeTimer: 80 },
        { x: 10, y: 10, dir: DIR.DOWN, color: GHOST_COLORS[3], scared: false, home: true, homeTimer: 120 },
      ],
      score: 0,
      lives: 3,
      totalDots,
      eaten: 0,
      powerTimer: 0,
      tick: 0,
      gameOver: false,
      won: false,
    };
  }, []);

  useEffect(() => {
    stateRef.current = initState();
    setScore(0);
    setLives(3);
    setGameOver(false);
    setWon(false);
  }, [initState]);

  // Keyboard
  useEffect(() => {
    function handleKey(e) {
      if (!stateRef.current || stateRef.current.gameOver || stateRef.current.won) return;
      const p = stateRef.current.pacman;
      switch (e.key) {
        case "ArrowUp":    case "w": case "W": p.nextDir = DIR.UP;    e.preventDefault(); break;
        case "ArrowDown":  case "s": case "S": p.nextDir = DIR.DOWN;  e.preventDefault(); break;
        case "ArrowLeft":  case "a": case "A": p.nextDir = DIR.LEFT;  e.preventDefault(); break;
        case "ArrowRight": case "d": case "D": p.nextDir = DIR.RIGHT; e.preventDefault(); break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Touch controls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let startX = 0, startY = 0;
    function onStart(e) {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
    }
    function onEnd(e) {
      if (!stateRef.current || stateRef.current.gameOver) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      const p = stateRef.current.pacman;
      if (Math.abs(dx) > Math.abs(dy)) {
        p.nextDir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
      } else {
        p.nextDir = dy > 0 ? DIR.DOWN : DIR.UP;
      }
      e.preventDefault();
    }
    canvas.addEventListener("touchstart", onStart, { passive: true });
    canvas.addEventListener("touchend", onEnd, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", onStart);
      canvas.removeEventListener("touchend", onEnd);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let lastTime = 0;
    const TICK_MS = 120; // game speed

    function gameLoop(time) {
      rafRef.current = requestAnimationFrame(gameLoop);
      if (paused) { draw(ctx); return; }
      if (time - lastTime < TICK_MS) { draw(ctx); return; }
      lastTime = time;

      const s = stateRef.current;
      if (!s || s.gameOver || s.won) { draw(ctx); return; }

      s.tick++;
      s.pacman.mouthOpen = (s.pacman.mouthOpen + 1) % 3;

      // Power timer
      if (s.powerTimer > 0) {
        s.powerTimer--;
        if (s.powerTimer === 0) {
          s.ghosts.forEach((g) => (g.scared = false));
        }
      }

      // Move pacman
      const pac = s.pacman;
      const nx1 = pac.x + pac.nextDir.x;
      const ny1 = pac.y + pac.nextDir.y;
      if (canMove(s.maze, nx1, ny1)) {
        pac.dir = pac.nextDir;
      }
      const nx = pac.x + pac.dir.x;
      const ny = pac.y + pac.dir.y;
      if (canMove(s.maze, nx, ny)) {
        const pos = wrapPos(nx, ny);
        pac.x = pos.x;
        pac.y = pos.y;
      }

      // Eat dots
      const cell = s.maze[pac.y]?.[pac.x];
      if (cell === DOT) {
        s.maze[pac.y][pac.x] = EMPTY;
        s.score += 10;
        s.eaten++;
      } else if (cell === POWER) {
        s.maze[pac.y][pac.x] = EMPTY;
        s.score += 50;
        s.eaten++;
        s.powerTimer = 40;
        s.ghosts.forEach((g) => { if (!g.home) g.scared = true; });
      }

      // Win check
      if (s.eaten >= s.totalDots) {
        s.won = true;
        setWon(true);
        setScore(s.score);
        return;
      }

      // Move ghosts
      s.ghosts.forEach((g) => {
        if (g.home) {
          g.homeTimer--;
          if (g.homeTimer <= 0) {
            g.home = false;
            g.x = 10;
            g.y = 7;
            g.dir = DIR.UP;
          }
          return;
        }

        // Choose direction: chase or scatter
        const dirs = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];
        const opposite = { x: -g.dir.x, y: -g.dir.y };
        const possible = dirs.filter((d) => {
          if (d.x === opposite.x && d.y === opposite.y) return false;
          return canMove(s.maze, g.x + d.x, g.y + d.y);
        });

        if (possible.length === 0) {
          // Dead end — reverse
          if (canMove(s.maze, g.x + opposite.x, g.y + opposite.y)) {
            g.dir = opposite;
          }
        } else if (possible.length === 1) {
          g.dir = possible[0];
        } else {
          // Scared = random, normal = chase pacman
          if (g.scared) {
            g.dir = possible[Math.floor(Math.random() * possible.length)];
          } else {
            // Simple chase: prefer direction that reduces distance to pacman
            let best = possible[0];
            let bestDist = Infinity;
            for (const d of possible) {
              const p = wrapPos(g.x + d.x, g.y + d.y);
              const dist = Math.abs(p.x - pac.x) + Math.abs(p.y - pac.y);
              if (dist < bestDist) { bestDist = dist; best = d; }
            }
            g.dir = best;
          }
        }

        const gp = wrapPos(g.x + g.dir.x, g.y + g.dir.y);
        g.x = gp.x;
        g.y = gp.y;
      });

      // Collision
      s.ghosts.forEach((g) => {
        if (g.home) return;
        if (g.x === pac.x && g.y === pac.y) {
          if (g.scared) {
            // Eat ghost
            s.score += 200;
            g.home = true;
            g.homeTimer = 30;
            g.scared = false;
            g.x = 10;
            g.y = 9;
          } else {
            // Lose life
            s.lives--;
            if (s.lives <= 0) {
              s.gameOver = true;
              setGameOver(true);
            } else {
              pac.x = 10;
              pac.y = 15;
              pac.dir = DIR.LEFT;
              pac.nextDir = DIR.LEFT;
            }
            setLives(s.lives);
          }
        }
      });

      setScore(s.score);
      draw(ctx);
    }

    function draw(ctx) {
      const s = stateRef.current;
      if (!s) return;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      // Draw maze
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const val = s.maze[r][c];
          const x = c * CELL;
          const y = r * CELL;
          if (val === WALL) {
            ctx.fillStyle = "#2121de";
            ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          } else if (val === DOT) {
            ctx.fillStyle = "#ffb8ae";
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, 2, 0, Math.PI * 2);
            ctx.fill();
          } else if (val === POWER) {
            ctx.fillStyle = "#ffb8ae";
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw pacman
      const pac = s.pacman;
      const px = pac.x * CELL + CELL / 2;
      const py = pac.y * CELL + CELL / 2;
      const mouth = [0, 0.25, 0.15][pac.mouthOpen];
      let angle = 0;
      if (pac.dir === DIR.RIGHT) angle = 0;
      else if (pac.dir === DIR.DOWN) angle = Math.PI / 2;
      else if (pac.dir === DIR.LEFT) angle = Math.PI;
      else if (pac.dir === DIR.UP) angle = -Math.PI / 2;

      ctx.fillStyle = "#ffff00";
      ctx.beginPath();
      ctx.arc(px, py, CELL / 2 - 1, angle + mouth * Math.PI, angle + (2 - mouth) * Math.PI);
      ctx.lineTo(px, py);
      ctx.fill();

      // Draw ghosts
      s.ghosts.forEach((g) => {
        if (g.home) return;
        const gx = g.x * CELL + CELL / 2;
        const gy = g.y * CELL + CELL / 2;
        const r = CELL / 2 - 1;
        const color = g.scared ? (s.powerTimer < 10 && s.tick % 2 ? "#fff" : "#2121de") : g.color;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(gx, gy, r, Math.PI, 0);
        ctx.lineTo(gx + r, gy + r);
        // Wavy bottom
        for (let i = r; i >= -r; i -= r / 2) {
          ctx.lineTo(gx + i, gy + r + (i % r === 0 ? -3 : 0));
        }
        ctx.closePath();
        ctx.fill();

        // Eyes
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(gx - 3, gy - 2, 3, 0, Math.PI * 2);
        ctx.arc(gx + 3, gy - 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = g.scared ? "#fff" : "#00f";
        ctx.beginPath();
        ctx.arc(gx - 3 + (g.dir.x || 0), gy - 2 + (g.dir.y || 0), 1.5, 0, Math.PI * 2);
        ctx.arc(gx + 3 + (g.dir.x || 0), gy - 2 + (g.dir.y || 0), 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    rafRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [paused]);

  function restart() {
    stateRef.current = initState();
    setScore(0);
    setLives(3);
    setGameOver(false);
    setWon(false);
    setPaused(false);
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative flex flex-col items-center rounded-2xl bg-gray-900 p-4 shadow-2xl"
        style={{ maxWidth: "95vw", maxHeight: "95vh" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 active:scale-90"
          data-testid="pacman-close"
        >
          ✕
        </button>

        {/* Header */}
        <div className="mb-2 flex w-full items-center justify-between px-2 text-sm text-white">
          <span className="font-bold text-yellow-400">PACMAN</span>
          <span>Счёт: <b className="text-yellow-300">{score}</b></span>
          <span>
            {Array.from({ length: lives }, (_, i) => (
              <span key={i} className="ml-0.5">🟡</span>
            ))}
          </span>
        </div>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="rounded-lg border-2 border-blue-800"
          style={{ imageRendering: "pixelated", touchAction: "none" }}
          data-testid="pacman-canvas"
        />

        {/* Controls for mobile */}
        <div className="mt-3 grid grid-cols-3 gap-1">
          <div />
          <button onClick={() => { if (stateRef.current) stateRef.current.pacman.nextDir = DIR.UP; }} className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-700 text-lg text-white active:bg-gray-600">▲</button>
          <div />
          <button onClick={() => { if (stateRef.current) stateRef.current.pacman.nextDir = DIR.LEFT; }} className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-700 text-lg text-white active:bg-gray-600">◀</button>
          <button onClick={() => { if (stateRef.current) stateRef.current.pacman.nextDir = DIR.DOWN; }} className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-700 text-lg text-white active:bg-gray-600">▼</button>
          <button onClick={() => { if (stateRef.current) stateRef.current.pacman.nextDir = DIR.RIGHT; }} className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-700 text-lg text-white active:bg-gray-600">▶</button>
        </div>

        {/* Game over / win overlay */}
        {(gameOver || won) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/80">
            <p className="mb-2 text-2xl font-bold text-yellow-400">
              {won ? "🎉 Победа!" : "💀 Игра окончена"}
            </p>
            <p className="mb-4 text-white">Счёт: {score}</p>
            <div className="flex gap-3">
              <button
                onClick={restart}
                className="rounded-lg bg-yellow-500 px-5 py-2 font-bold text-black transition hover:bg-yellow-400 active:scale-95"
                data-testid="pacman-restart"
              >
                Заново
              </button>
              <button
                onClick={onClose}
                className="rounded-lg bg-gray-600 px-5 py-2 font-bold text-white transition hover:bg-gray-500 active:scale-95"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}

        {/* Hint */}
        <p className="mt-2 text-center text-xs text-gray-400">
          Стрелки / WASD / свайп для управления
        </p>
      </div>
    </div>
  );
}
