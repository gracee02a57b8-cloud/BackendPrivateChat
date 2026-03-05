import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* ═══════════════════════════════════════════════════════
   🏃 SPACE RUNNER — Pseudo-3D Endless Runner Game
   ═══════════════════════════════════════════════════════ */

// ─── Canvas & Perspective ───
const CW = 400;
const CH = 640;
const VP_X = CW / 2;
const VP_Y = 110;
const FOCAL = 150;
const CAM_H = 340;
const HORIZON = 130;

// ─── World ───
const LANE_W = 90;
const SPAWN_Z = 3000;
const P_Z = 150;

// ─── Physics ───
const GRAV = 1.0;
const JUMP_V = -16;
const BASE_SPD = 7;
const MAX_SPD = 22;
const SPD_ACC = 0.002;

// ─── 3D → 2D projection ───
// Camera at height CAM_H above ground. wy<0 = above ground.
function pj(wx, wy, wz) {
  const s = FOCAL / Math.max(wz, 1);
  return { x: VP_X + wx * s, y: VP_Y + (CAM_H + wy) * s, s };
}

// ─── Game State ───
function createGame() {
  return {
    player: { lane: 0, tLane: 0, x: 0, y: 0, vy: 0, jumping: false },
    obs: [],
    coins: [],
    parts: [],
    stars: Array.from({ length: 60 }, () => ({
      x: Math.random() * CW,
      y: Math.random() * HORIZON,
      r: Math.random() * 1.5 + 0.5,
      sp: Math.random() * 0.5 + 0.1,
      br: Math.random(),
    })),
    grid: Array.from({ length: 25 }, (_, i) => P_Z + i * (SPAWN_Z / 25)),
    speed: BASE_SPD,
    dist: 0,
    score: 0,
    coinCnt: 0,
    spCD: 0,
    coCD: 0,
    frame: 0,
    started: false,
    over: false,
    overT: 0,
  };
}

function spawnObs(g) {
  const r = Math.random();
  let lanes;
  let low = false;
  if (r < 0.45) {
    lanes = [[-1, 0, 1][(Math.random() * 3) | 0]];
  } else if (r < 0.75) {
    const skip = (Math.random() * 3) | 0;
    lanes = [-1, 0, 1].filter((_, i) => i !== skip);
  } else {
    lanes = [[-1, 0, 1][(Math.random() * 3) | 0]];
    low = true;
  }
  for (const ln of lanes)
    g.obs.push({ lane: ln, z: SPAWN_Z, low, w: LANE_W * 0.65, h: low ? 18 : 55 });
}

function spawnCoins(g) {
  const ln = [-1, 0, 1][(Math.random() * 3) | 0];
  const n = ((Math.random() * 4) | 0) + 3;
  for (let i = 0; i < n; i++)
    g.coins.push({ lane: ln, z: SPAWN_Z + i * 70, ph: Math.random() * 6.28 });
}

function burst(g, x, y, color, n = 8) {
  for (let i = 0; i < n; i++)
    g.parts.push({
      x, y,
      vx: (Math.random() - 0.5) * 7,
      vy: (Math.random() - 0.5) * 7 - 2,
      life: 1,
      dec: Math.random() * 0.03 + 0.02,
      r: Math.random() * 3 + 2,
      color,
    });
}

// ─── Tick ───
function tick(g) {
  // Post-death: animate particles only
  if (g.over) {
    g.overT++;
    for (let i = g.parts.length - 1; i >= 0; i--) {
      const p = g.parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= p.dec;
      if (p.life <= 0) g.parts.splice(i, 1);
    }
    return;
  }
  if (!g.started) return;

  g.frame++;
  g.speed = Math.min(MAX_SPD, g.speed + SPD_ACC);
  g.dist += g.speed;
  g.score = (g.dist / 10) | 0;

  // Player
  const pl = g.player;
  pl.x += (pl.tLane * LANE_W - pl.x) * 0.18;
  pl.lane = pl.tLane;
  if (pl.jumping) {
    pl.vy += GRAV;
    pl.y += pl.vy;
    if (pl.y >= 0) { pl.y = 0; pl.vy = 0; pl.jumping = false; }
  }

  // Obstacles
  g.spCD += g.speed;
  if (g.spCD > 500) { spawnObs(g); g.spCD = 0; }
  for (let i = g.obs.length - 1; i >= 0; i--) {
    const o = g.obs[i];
    o.z -= g.speed;
    if (Math.abs(o.z - P_Z) < g.speed + 15) {
      if (Math.abs(pl.x - o.lane * LANE_W) < LANE_W * 0.55) {
        const hit = o.low ? pl.y > -25 : true;
        if (hit) {
          g.over = true;
          const pr = pj(o.lane * LANE_W, 0, P_Z);
          burst(g, pr.x, pr.y, "#ff2255", 20);
          return;
        }
      }
    }
    if (o.z < 10) g.obs.splice(i, 1);
  }

  // Coins
  g.coCD += g.speed;
  if (g.coCD > 650) { spawnCoins(g); g.coCD = 0; }
  for (let i = g.coins.length - 1; i >= 0; i--) {
    const c = g.coins[i];
    c.z -= g.speed;
    c.ph += 0.06;
    if (Math.abs(c.z - P_Z) < g.speed + 18 && Math.abs(pl.x - c.lane * LANE_W) < LANE_W * 0.5) {
      g.coinCnt++;
      g.score += 10;
      const pr = pj(c.lane * LANE_W, -20, P_Z);
      burst(g, pr.x, pr.y, "#ffd700", 6);
      g.coins.splice(i, 1);
      continue;
    }
    if (c.z < 10) g.coins.splice(i, 1);
  }

  // Grid scroll
  for (let i = 0; i < g.grid.length; i++) {
    g.grid[i] -= g.speed;
    if (g.grid[i] < P_Z * 0.4) g.grid[i] += SPAWN_Z;
  }

  // Stars
  for (const s of g.stars) {
    s.y += s.sp * g.speed * 0.08;
    s.br = 0.4 + 0.6 * Math.sin(g.frame * 0.04 + s.x);
    if (s.y > HORIZON) { s.y = 0; s.x = Math.random() * CW; }
  }

  // Particles
  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= p.dec;
    if (p.life <= 0) g.parts.splice(i, 1);
  }
}

// ─── Render ───
function render(ctx, g) {
  const nZ = P_Z * 0.5;
  const fZ = SPAWN_Z;

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, "#030318");
  sky.addColorStop(1, "#0a0a30");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, HORIZON);

  // Stars
  for (const s of g.stars) {
    ctx.globalAlpha = s.br * 0.8;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, 6.28);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ground
  const gnd = ctx.createLinearGradient(0, HORIZON, 0, CH);
  gnd.addColorStop(0, "#0c0c30");
  gnd.addColorStop(1, "#141450");
  ctx.fillStyle = gnd;
  ctx.fillRect(0, HORIZON, CW, CH - HORIZON);

  // Road trapezoid
  const rN = pj(0, 0, nZ);
  const rF = pj(0, 0, fZ);
  const hN = LANE_W * 2 * rN.s;
  const hF = LANE_W * 2 * rF.s;
  ctx.fillStyle = "#111138";
  ctx.beginPath();
  ctx.moveTo(VP_X - hF, rF.y);
  ctx.lineTo(VP_X + hF, rF.y);
  ctx.lineTo(VP_X + hN, Math.min(rN.y, CH));
  ctx.lineTo(VP_X - hN, Math.min(rN.y, CH));
  ctx.closePath();
  ctx.fill();

  // Road edges
  ctx.strokeStyle = "#3535cc";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(VP_X - hF, rF.y); ctx.lineTo(VP_X - hN, Math.min(rN.y, CH)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(VP_X + hF, rF.y); ctx.lineTo(VP_X + hN, Math.min(rN.y, CH)); ctx.stroke();

  // Lane dividers
  ctx.setLineDash([3, 7]);
  ctx.strokeStyle = "rgba(80,80,255,0.25)";
  ctx.lineWidth = 1;
  for (const lx of [-LANE_W * 0.5, LANE_W * 0.5]) {
    const f = pj(lx, 0, fZ);
    const n = pj(lx, 0, nZ);
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(n.x, Math.min(n.y, CH)); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Horizontal grid lines
  for (const z of g.grid) {
    if (z < nZ || z > fZ) continue;
    const p = pj(0, 0, z);
    const hw = LANE_W * 2 * p.s;
    ctx.strokeStyle = "rgba(50,50,180,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(VP_X - hw, p.y); ctx.lineTo(VP_X + hw, p.y); ctx.stroke();
  }

  // Collect & sort objects back-to-front
  const list = [];
  for (const o of g.obs) list.push({ ...o, tp: "o" });
  for (const c of g.coins) list.push({ ...c, tp: "c" });
  list.push({ tp: "p", z: P_Z });
  list.sort((a, b) => b.z - a.z);

  for (const obj of list) {
    if (obj.z < nZ) continue;
    if (obj.tp === "o") drawObs(ctx, obj, g);
    else if (obj.tp === "c") drawCoin(ctx, obj, g);
    else drawPlayer(ctx, g);
  }

  // Particles
  for (const pt of g.parts) {
    ctx.globalAlpha = pt.life;
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r * pt.life, 0, 6.28); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // HUD
  if (g.started) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`\u{1F3C3} ${g.score}`, 10, 24);
    ctx.fillText(`\u{1FA99} ${g.coinCnt}`, 10, 46);
    const pct = (g.speed - BASE_SPD) / (MAX_SPD - BASE_SPD);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(CW - 76, 10, 64, 6);
    ctx.fillStyle = pct > 0.7 ? "#ff4466" : "#00ffc8";
    ctx.fillRect(CW - 76, 10, 64 * pct, 6);
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("SPEED", CW - 12, 28);
  }
}

function drawObs(ctx, o) {
  const wx = o.lane * LANE_W;
  const p = pj(wx, 0, o.z);
  const s = p.s;
  const bw = o.w * s;
  const bh = o.h * s;
  const tOff = bh * 0.25;

  // Front
  ctx.fillStyle = "#ff2255";
  ctx.fillRect(p.x - bw / 2, p.y - bh, bw, bh);
  // Top
  ctx.fillStyle = "#ff5588";
  ctx.beginPath();
  ctx.moveTo(p.x - bw / 2, p.y - bh);
  ctx.lineTo(p.x - bw / 2 + bw * 0.12, p.y - bh - tOff);
  ctx.lineTo(p.x + bw / 2 + bw * 0.12, p.y - bh - tOff);
  ctx.lineTo(p.x + bw / 2, p.y - bh);
  ctx.closePath(); ctx.fill();
  // Right side
  ctx.fillStyle = "#aa1133";
  ctx.beginPath();
  ctx.moveTo(p.x + bw / 2, p.y);
  ctx.lineTo(p.x + bw / 2, p.y - bh);
  ctx.lineTo(p.x + bw / 2 + bw * 0.12, p.y - bh - tOff);
  ctx.lineTo(p.x + bw / 2 + bw * 0.12, p.y - tOff);
  ctx.closePath(); ctx.fill();
  // Warning stripes
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  const sw = bw / 6;
  for (let i = 0; i < 3; i++) ctx.fillRect(p.x - bw / 2 + i * sw * 2, p.y - bh, sw, bh);
  // Glow
  ctx.shadowColor = "#ff2255";
  ctx.shadowBlur = 8 * s;
  ctx.strokeStyle = "#ff2255";
  ctx.lineWidth = 1;
  ctx.strokeRect(p.x - bw / 2, p.y - bh, bw, bh);
  ctx.shadowBlur = 0;
}

function drawCoin(ctx, c, g) {
  const wx = c.lane * LANE_W;
  const fy = -22 + Math.sin(c.ph) * 5;
  const p = pj(wx, fy, c.z);
  const r = 9 * p.s;
  const cw = r * Math.abs(Math.cos(g.frame * 0.07 + c.ph));
  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 12 * p.s;
  ctx.fillStyle = "#ffd700";
  ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(cw, r * 0.15), r, 0, 0, 6.28); ctx.fill();
  ctx.fillStyle = "#fff8cc";
  ctx.beginPath(); ctx.ellipse(p.x - cw * 0.15, p.y - r * 0.2, Math.max(cw * 0.35, 1), r * 0.35, 0, 0, 6.28); ctx.fill();
  ctx.shadowBlur = 0;
}

function drawPlayer(ctx, g) {
  const pl = g.player;
  const pr = pj(pl.x, pl.y, P_Z);
  const x = pr.x;
  const y = pr.y;
  const s = pr.s;
  const pw = 28 * s;
  const ph = 48 * s;

  // Ground shadow when jumping
  if (pl.y < -3) {
    const gp = pj(pl.x, 0, P_Z);
    ctx.fillStyle = "rgba(0,255,200,0.15)";
    ctx.beginPath(); ctx.ellipse(gp.x, gp.y, pw, 4 * s, 0, 0, 6.28); ctx.fill();
  }

  // Glow
  ctx.shadowColor = "#00ffc8";
  ctx.shadowBlur = 16;

  // Body gradient
  const bg = ctx.createLinearGradient(x, y - ph, x, y);
  bg.addColorStop(0, "#00ffc8");
  bg.addColorStop(1, "#007755");
  ctx.fillStyle = bg;

  // Rounded rect body
  const rx = x - pw / 2, ry = y - ph, cr = 4 * s;
  ctx.beginPath();
  ctx.moveTo(rx + cr, ry);
  ctx.lineTo(rx + pw - cr, ry);
  ctx.quadraticCurveTo(rx + pw, ry, rx + pw, ry + cr);
  ctx.lineTo(rx + pw, ry + ph - cr);
  ctx.quadraticCurveTo(rx + pw, ry + ph, rx + pw - cr, ry + ph);
  ctx.lineTo(rx + cr, ry + ph);
  ctx.quadraticCurveTo(rx, ry + ph, rx, ry + ph - cr);
  ctx.lineTo(rx, ry + cr);
  ctx.quadraticCurveTo(rx, ry, rx + cr, ry);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;

  // Visor
  ctx.fillStyle = "#003322";
  ctx.fillRect(rx + pw * 0.15, ry + ph * 0.13, pw * 0.7, ph * 0.22);

  // Eyes
  const eb = 0.5 + 0.5 * Math.sin(g.frame * 0.1);
  ctx.fillStyle = `rgba(0,255,200,${eb})`;
  ctx.fillRect(rx + pw * 0.22, ry + ph * 0.18, pw * 0.18, ph * 0.1);
  ctx.fillRect(rx + pw * 0.58, ry + ph * 0.18, pw * 0.18, ph * 0.1);

  // Speed trails
  if (g.speed > BASE_SPD + 2) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#00ffc8";
    for (let i = 1; i <= 3; i++) {
      const tp = pj(pl.x, pl.y, P_Z + i * 18);
      ctx.fillRect(tp.x - pw * 0.35, tp.y - ph * 0.7, pw * 0.7, ph * 0.5);
    }
    ctx.globalAlpha = 1;
  }
}

// ═════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════
export default function RunnerGame({ onClose }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const rafRef = useRef(null);
  const touchRef = useRef({ x: 0, y: 0, ok: false });

  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  function loop() {
    const g = gameRef.current;
    const cv = canvasRef.current;
    if (!g || !cv) return;
    const ctx = cv.getContext("2d");
    tick(g);
    render(ctx, g);
    setScore(g.score);
    setCoins(g.coinCnt);
    if (g.over && g.overT >= 45) { setGameOver(true); return; }
    rafRef.current = requestAnimationFrame(loop);
  }

  function start() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    gameRef.current = createGame();
    setScore(0); setCoins(0); setGameOver(false); setStarted(false);
    rafRef.current = requestAnimationFrame(loop);
  }

  function activate() {
    const g = gameRef.current;
    if (g && !g.started && !g.over) { g.started = true; setStarted(true); }
  }

  useEffect(() => {
    start();
    const onKey = (e) => {
      const g = gameRef.current;
      if (!g || g.over) return;
      activate();
      const p = g.player;
      switch (e.key) {
        case "ArrowLeft": case "a": case "A":
          e.preventDefault(); if (p.tLane > -1) p.tLane--; break;
        case "ArrowRight": case "d": case "D":
          e.preventDefault(); if (p.tLane < 1) p.tLane++; break;
        case "ArrowUp": case "w": case "W": case " ":
          e.preventDefault(); if (!p.jumping) { p.jumping = true; p.vy = JUMP_V; } break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onTS(e) {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, ok: false };
  }

  function onTM(e) {
    if (touchRef.current.ok) return;
    const g = gameRef.current;
    if (!g || g.over) return;
    activate();
    const t = e.touches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    if (Math.abs(dx) > 28 || Math.abs(dy) > 28) {
      touchRef.current.ok = true;
      const p = g.player;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && p.tLane < 1) p.tLane++;
        else if (dx < 0 && p.tLane > -1) p.tLane--;
      } else if (dy < 0 && !p.jumping) { p.jumping = true; p.vy = JUMP_V; }
    }
  }

  const btn = (fn) => () => { const g = gameRef.current; if (!g || g.over) return; activate(); fn(g); };
  const btnL = btn((g) => { if (g.player.tLane > -1) g.player.tLane--; });
  const btnR = btn((g) => { if (g.player.tLane < 1) g.player.tLane++; });
  const btnJ = btn((g) => { if (!g.player.jumping) { g.player.jumping = true; g.player.vy = JUMP_V; } });

  const ds = Math.min(window.innerWidth * 0.88 / CW, window.innerHeight * 0.65 / CH, 1);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative flex flex-col items-center rounded-2xl bg-gray-900 p-3 shadow-2xl"
        style={{ maxWidth: "95vw", maxHeight: "95vh" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white shadow-lg transition-transform hover:scale-110"
          data-testid="runner-close"
        >
          ✕
        </button>

        <p className="mb-1 text-center text-lg font-bold tracking-wider text-cyan-400">
          🏃 SPACE RUNNER
        </p>

        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          className="rounded-lg"
          style={{ width: CW * ds, height: CH * ds, touchAction: "none" }}
          onTouchStart={onTS}
          onTouchMove={onTM}
        />

        {/* Start overlay */}
        {!started && !gameOver && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/60"
            onClick={activate}
          >
            <p className="mb-2 text-2xl font-bold text-cyan-400">🏃 SPACE RUNNER</p>
            <p className="mb-1 text-sm text-gray-300">Бесконечный бег в космосе</p>
            <p className="mb-4 text-xs text-gray-400">Уклоняйся, прыгай, собирай монеты!</p>
            <p className="animate-pulse text-base text-white">Нажми чтобы начать</p>
          </div>
        )}

        {/* Game Over */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/70">
            <p className="mb-1 text-3xl">💥</p>
            <p className="mb-2 text-2xl font-bold text-red-400">Игра окончена</p>
            <p className="mb-1 text-white">Счёт: {score}</p>
            <p className="mb-4 text-yellow-400">🪙 {coins}</p>
            <div className="flex gap-3">
              <button onClick={start} className="rounded-lg bg-cyan-500 px-6 py-2 font-bold text-black hover:bg-cyan-400">Заново</button>
              <button onClick={onClose} className="rounded-lg bg-gray-600 px-6 py-2 font-bold text-white hover:bg-gray-500">Закрыть</button>
            </div>
          </div>
        )}

        {/* Mobile controls */}
        <div className="mt-2 flex items-center gap-2">
          <button onClick={btnL} className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-700/80 text-2xl text-gray-300 active:bg-cyan-600/50">◀</button>
          <button onClick={btnJ} className="flex h-12 w-14 items-center justify-center rounded-xl bg-gray-700/80 text-2xl text-gray-300 active:bg-cyan-600/50">▲</button>
          <button onClick={btnR} className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-700/80 text-2xl text-gray-300 active:bg-cyan-600/50">▶</button>
        </div>
        <p className="mt-1 text-[10px] text-gray-500">← → свайп / стрелки • ↑ прыжок</p>
      </div>
    </div>,
    document.body
  );
}
