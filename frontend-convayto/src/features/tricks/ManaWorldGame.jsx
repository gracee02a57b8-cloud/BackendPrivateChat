import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* ═══════════════════════════════════════════════════════
   🧙 MANA WORLD — Top-Down Magic Arena
   Combine elements, cast spells, survive waves!
   ═══════════════════════════════════════════════════════ */

// ─── Canvas ───
const CW = 400;
const CH = 400;

// ─── Elements ───
const EL_CLR = ["#ff3322", "#33ccff", "#ffdd22", "#22dd66"];
const EL_ICO = ["🔥", "❄️", "⚡", "💧"];

// ─── Spells: key = sorted element indices ───
const SPELLS = {
  "0":  { nm: "Огнешар",        tp: "proj",   dmg: 20, spd: 7,  r: 5,  clr: "#ff4422", tr: "#ff8844" },
  "1":  { nm: "Ледяной шип",    tp: "proj",   dmg: 15, spd: 6,  r: 4,  clr: "#44ccff", tr: "#88eeff", slow: 0.5 },
  "2":  { nm: "Молния",         tp: "proj",   dmg: 25, spd: 11, r: 3,  clr: "#ffee44", tr: "#ffffaa" },
  "3":  { nm: "Лечение",        tp: "heal",   heal: 20, clr: "#44ff88" },
  "00": { nm: "Метеор",         tp: "aoe",    dmg: 50, r: 55,  clr: "#ff6600", tr: "#ffaa44" },
  "11": { nm: "Морозная нова",  tp: "nova",   dmg: 25, r: 90,  clr: "#88eeff", slow: 0.7 },
  "22": { nm: "Цепь молний",    tp: "chain",  dmg: 35, chains: 4, range: 130, clr: "#ffff44" },
  "33": { nm: "Исцеление+",     tp: "heal",   heal: 80, clr: "#22ffaa" },
  "01": { nm: "Паровой взрыв",  tp: "aoe",    dmg: 35, r: 45,  clr: "#bbddff", tr: "#ddeeff" },
  "02": { nm: "Плазма",         tp: "proj",   dmg: 45, spd: 13, r: 4,  clr: "#ff88ff", tr: "#ffbbff", pierce: true },
  "03": { nm: "Взрыв",          tp: "aoe",    dmg: 40, r: 55,  clr: "#ff8844", tr: "#ffcc88" },
  "12": { nm: "Шок-болт",       tp: "proj",   dmg: 30, spd: 8,  r: 5,  clr: "#88ffff", tr: "#bbffff", stun: 55 },
  "13": { nm: "Ледяной дождь",  tp: "spread", dmg: 10, spd: 6,  r: 3,  cnt: 7, arc: 0.8, clr: "#aaeeff", tr: "#ddf4ff", slow: 0.4 },
  "23": { nm: "Грозовой залп",  tp: "spread", dmg: 18, spd: 11, r: 3,  cnt: 5, arc: 0.5, clr: "#eeff44", tr: "#ffffaa" },
};

// ─── Enemy types: 0=goblin 1=skeleton 2=demon 3=boss ───
const ET = [
  { nm: "Гоблин",  hp: 40,  spd: 1.8, r: 10, dmg: 8,  clr: "#44aa44", sc: 10 },
  { nm: "Скелет",  hp: 70,  spd: 1.3, r: 12, dmg: 12, clr: "#cccc88", sc: 20 },
  { nm: "Демон",   hp: 120, spd: 1.0, r: 15, dmg: 20, clr: "#cc3344", sc: 35 },
  { nm: "Босс",    hp: 400, spd: 0.8, r: 24, dmg: 30, clr: "#8822cc", sc: 100 },
];

// ─── Helpers ───
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function burst(g, x, y, clr, n = 8) {
  for (let i = 0; i < n; i++)
    g.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 1, dec: Math.random() * 0.03 + 0.02,
      r: Math.random() * 3 + 1.5, clr,
    });
}

function drawLightning(ctx, x1, y1, x2, y2, clr, w) {
  const segs = 6;
  const dx = (x2 - x1) / segs;
  const dy = (y2 - y1) / segs;
  ctx.strokeStyle = clr;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < segs; i++)
    ctx.lineTo(x1 + dx * i + (Math.random() - 0.5) * 14, y1 + dy * i + (Math.random() - 0.5) * 14);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// ─── Game State ───
function createGame() {
  return {
    player: { x: CW / 2, y: CH / 2, hp: 100, maxHp: 100, r: 12, angle: -Math.PI / 2, spd: 3, invuln: 0, flash: 0 },
    queue: [],
    enemies: [],
    projs: [],
    effects: [],
    particles: [],
    texts: [],
    wave: 0,
    waveTimer: 90,
    waveActive: false,
    score: 0,
    kills: 0,
    castCD: 0,
    frame: 0,
    started: false,
    over: false,
    spellNm: "",
    spellT: 0,
    keys: {},
  };
}

// ─── Wave spawning ───
function spawnEnemy(g, type) {
  const t = ET[type];
  let x, y;
  const side = (Math.random() * 4) | 0;
  if (side === 0) { x = Math.random() * CW; y = -20; }
  else if (side === 1) { x = CW + 20; y = Math.random() * CH; }
  else if (side === 2) { x = Math.random() * CW; y = CH + 20; }
  else { x = -20; y = Math.random() * CH; }
  g.enemies.push({ x, y, hp: t.hp, maxHp: t.hp, spd: t.spd, r: t.r, dmg: t.dmg, clr: t.clr, sc: t.sc, type, slowT: 0, stunT: 0 });
}

function spawnWave(g) {
  const w = g.wave;
  if (w % 5 === 0 && w > 0) {
    spawnEnemy(g, 3);
    for (let i = 0; i < Math.min(w / 5 + 1, 4); i++) spawnEnemy(g, 0);
  } else {
    const gobs = Math.min(3 + w, 10);
    const skels = w >= 3 ? Math.min(w - 2, 5) : 0;
    const demons = w >= 7 ? Math.min(w - 6, 3) : 0;
    for (let i = 0; i < gobs; i++) spawnEnemy(g, 0);
    for (let i = 0; i < skels; i++) spawnEnemy(g, 1);
    for (let i = 0; i < demons; i++) spawnEnemy(g, 2);
  }
  g.waveActive = true;
  g.waveAnn = 80;
}

// ─── Spell casting ───
function castSpell(g) {
  if (g.castCD > 0 || g.queue.length === 0 || g.over) return;
  const key = [...g.queue].sort((a, b) => a - b).join("");
  const sp = SPELLS[key];
  if (!sp) { g.queue = []; return; }
  g.queue = [];
  g.castCD = 18;
  g.spellNm = sp.nm;
  g.spellT = 55;

  const p = g.player;
  const dx = Math.cos(p.angle);
  const dy = Math.sin(p.angle);

  switch (sp.tp) {
    case "proj": {
      g.projs.push({
        x: p.x + dx * 18, y: p.y + dy * 18,
        vx: dx * sp.spd, vy: dy * sp.spd,
        dmg: sp.dmg, r: sp.r, clr: sp.clr, tr: sp.tr || sp.clr,
        pierce: sp.pierce || false, slow: sp.slow || 0, stun: sp.stun || 0, life: 100,
      });
      break;
    }
    case "spread": {
      const n = sp.cnt || 5;
      const arc = sp.arc || 0.5;
      for (let i = 0; i < n; i++) {
        const a = p.angle - arc / 2 + (n > 1 ? arc * i / (n - 1) : 0);
        g.projs.push({
          x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18,
          vx: Math.cos(a) * sp.spd, vy: Math.sin(a) * sp.spd,
          dmg: sp.dmg, r: sp.r, clr: sp.clr, tr: sp.tr || sp.clr,
          pierce: false, slow: sp.slow || 0, stun: sp.stun || 0, life: 70,
        });
      }
      break;
    }
    case "aoe": {
      const d = 75;
      g.effects.push({
        tp: "aoe", x: p.x + dx * d, y: p.y + dy * d,
        r: 0, maxR: sp.r, dmg: sp.dmg, clr: sp.clr,
        life: 28, maxLife: 28, applied: false, slow: 0,
      });
      burst(g, p.x + dx * d, p.y + dy * d, sp.clr, 10);
      break;
    }
    case "nova": {
      g.effects.push({
        tp: "nova", x: p.x, y: p.y,
        r: 0, maxR: sp.r, dmg: sp.dmg, clr: sp.clr,
        life: 22, maxLife: 22, applied: false, slow: sp.slow || 0,
      });
      burst(g, p.x, p.y, sp.clr, 12);
      break;
    }
    case "heal": {
      p.hp = Math.min(p.maxHp, p.hp + sp.heal);
      burst(g, p.x, p.y, sp.clr, 15);
      g.texts.push({ x: p.x, y: p.y - p.r - 14, txt: `+${sp.heal}`, clr: "#44ff88", life: 40 });
      g.effects.push({ tp: "heal", x: p.x, y: p.y, r: 0, maxR: 28, clr: sp.clr, life: 18, maxLife: 18 });
      break;
    }
    case "chain": {
      const targets = [];
      let cx = p.x, cy = p.y;
      const hit = new Set();
      for (let c = 0; c < sp.chains; c++) {
        let best = null, bestD = sp.range;
        for (const e of g.enemies) {
          if (hit.has(e) || e.hp <= 0) continue;
          const d2 = dist(cx, cy, e.x, e.y);
          if (d2 < bestD) { bestD = d2; best = e; }
        }
        if (!best) break;
        hit.add(best);
        targets.push({ x1: cx, y1: cy, x2: best.x, y2: best.y });
        best.hp -= sp.dmg;
        if (best.stunT !== undefined) best.stunT = Math.max(best.stunT, 20);
        burst(g, best.x, best.y, sp.clr, 5);
        g.texts.push({ x: best.x, y: best.y - best.r - 8, txt: `-${sp.dmg}`, clr: sp.clr, life: 30 });
        cx = best.x; cy = best.y;
      }
      if (targets.length > 0)
        g.effects.push({ tp: "chain", lines: targets, clr: sp.clr, life: 18, maxLife: 18 });
      else
        burst(g, p.x + dx * 20, p.y + dy * 20, sp.clr, 4);
      break;
    }
    default: break;
  }
}

// ─── Game Tick ───
function tick(g) {
  if (g.over || !g.started) return;
  g.frame++;
  if (g.castCD > 0) g.castCD--;
  if (g.spellT > 0) g.spellT--;
  if (g.waveAnn > 0) g.waveAnn--;
  if (g.player.invuln > 0) g.player.invuln--;
  if (g.player.flash > 0) g.player.flash--;

  // ── Player movement ──
  const k = g.keys;
  const mdx = (k.d || k.D || k.ArrowRight ? 1 : 0) - (k.a || k.A || k.ArrowLeft ? 1 : 0);
  const mdy = (k.s || k.S || k.ArrowDown ? 1 : 0) - (k.w || k.W || k.ArrowUp ? 1 : 0);
  if (mdx || mdy) {
    const len = Math.hypot(mdx, mdy);
    g.player.x = clamp(g.player.x + mdx / len * g.player.spd, g.player.r, CW - g.player.r);
    g.player.y = clamp(g.player.y + mdy / len * g.player.spd, g.player.r, CH - g.player.r);
    g.player.angle = Math.atan2(mdy, mdx);
  }

  // ── Projectiles ──
  for (let i = g.projs.length - 1; i >= 0; i--) {
    const pr = g.projs[i];
    pr.x += pr.vx; pr.y += pr.vy; pr.life--;
    // Trail particle
    if (g.frame % 2 === 0)
      g.particles.push({ x: pr.x, y: pr.y, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, life: 1, dec: 0.07, r: pr.r * 0.5, clr: pr.tr });
    // Out of bounds
    if (pr.life <= 0 || pr.x < -30 || pr.x > CW + 30 || pr.y < -30 || pr.y > CH + 30) { g.projs.splice(i, 1); continue; }
    // Hit enemies
    let hit = false;
    for (const e of g.enemies) {
      if (e.hp <= 0) continue;
      if (dist(pr.x, pr.y, e.x, e.y) < pr.r + e.r) {
        e.hp -= pr.dmg;
        if (pr.slow) e.slowT = Math.max(e.slowT, 55);
        if (pr.stun) e.stunT = Math.max(e.stunT, pr.stun);
        burst(g, pr.x, pr.y, pr.clr, 4);
        g.texts.push({ x: e.x, y: e.y - e.r - 8, txt: `-${pr.dmg}`, clr: pr.clr, life: 28 });
        if (!pr.pierce) { hit = true; break; }
      }
    }
    if (hit) g.projs.splice(i, 1);
  }

  // ── Effects ──
  for (let i = g.effects.length - 1; i >= 0; i--) {
    const ef = g.effects[i];
    ef.life--;
    if (ef.life <= 0) { g.effects.splice(i, 1); continue; }
    if (ef.tp === "aoe" || ef.tp === "nova") {
      ef.r = ef.maxR * (1 - ef.life / ef.maxLife);
      if (!ef.applied && ef.r > ef.maxR * 0.5) {
        ef.applied = true;
        for (const e of g.enemies) {
          if (e.hp <= 0) continue;
          if (dist(ef.x, ef.y, e.x, e.y) < ef.maxR + e.r) {
            e.hp -= ef.dmg;
            if (ef.slow) e.slowT = Math.max(e.slowT, 80);
            burst(g, e.x, e.y, ef.clr, 4);
            g.texts.push({ x: e.x, y: e.y - e.r - 8, txt: `-${ef.dmg}`, clr: ef.clr, life: 28 });
          }
        }
      }
    }
    if (ef.tp === "heal") ef.r = ef.maxR * (1 - ef.life / ef.maxLife);
  }

  // ── Enemies ──
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    if (e.stunT > 0) { e.stunT--; continue; }
    let spd = e.spd;
    if (e.slowT > 0) { spd *= 0.45; e.slowT--; }
    const a = Math.atan2(g.player.y - e.y, g.player.x - e.x);
    e.x += Math.cos(a) * spd;
    e.y += Math.sin(a) * spd;
    // Collision with player
    if (g.player.invuln <= 0 && dist(e.x, e.y, g.player.x, g.player.y) < e.r + g.player.r) {
      g.player.hp -= e.dmg;
      g.player.invuln = 45;
      g.player.flash = 10;
      const ka = Math.atan2(g.player.y - e.y, g.player.x - e.x);
      g.player.x = clamp(g.player.x + Math.cos(ka) * 22, g.player.r, CW - g.player.r);
      g.player.y = clamp(g.player.y + Math.sin(ka) * 22, g.player.r, CH - g.player.r);
      burst(g, g.player.x, g.player.y, "#ff2244", 8);
      g.texts.push({ x: g.player.x, y: g.player.y - 20, txt: `-${e.dmg}`, clr: "#ff4444", life: 30 });
      if (g.player.hp <= 0) {
        g.over = true;
        burst(g, g.player.x, g.player.y, "#ff2244", 25);
        return;
      }
    }
  }

  // ── Remove dead enemies ──
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    if (e.hp <= 0) {
      burst(g, e.x, e.y, e.clr, 10);
      g.texts.push({ x: e.x, y: e.y - 12, txt: `+${e.sc}`, clr: "#ffdd44", life: 35 });
      g.score += e.sc;
      g.kills++;
      g.enemies.splice(i, 1);
    }
  }

  // ── Wave management ──
  if (g.waveActive && g.enemies.length === 0) {
    g.waveActive = false;
    g.waveTimer = 100;
  }
  if (!g.waveActive) {
    if (g.waveTimer > 0) g.waveTimer--;
    if (g.waveTimer === 0) { g.wave++; spawnWave(g); }
  }

  // ── Particles ──
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const pt = g.particles[i];
    pt.x += pt.vx; pt.y += pt.vy; pt.life -= pt.dec;
    if (pt.life <= 0) g.particles.splice(i, 1);
  }

  // ── Floating texts ──
  for (let i = g.texts.length - 1; i >= 0; i--) {
    g.texts[i].y -= 0.6;
    g.texts[i].life--;
    if (g.texts[i].life <= 0) g.texts.splice(i, 1);
  }
}

// ─── Render ───
function render(ctx, g) {
  // Arena
  const bg = ctx.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, CW * 0.72);
  bg.addColorStop(0, "#0e0e2a");
  bg.addColorStop(1, "#060618");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  // Rune circles
  ctx.strokeStyle = "rgba(100,60,200,0.15)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(CW / 2, CH / 2, 170, 0, 6.28); ctx.stroke();
  ctx.beginPath(); ctx.arc(CW / 2, CH / 2, 90, 0, 6.28); ctx.stroke();
  // Rune marks
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + g.frame * 0.003;
    ctx.fillStyle = "rgba(100,60,200,0.12)";
    ctx.fillRect(CW / 2 + Math.cos(a) * 170 - 3, CH / 2 + Math.sin(a) * 170 - 3, 6, 6);
    ctx.fillRect(CW / 2 + Math.cos(a + 0.4) * 90 - 2, CH / 2 + Math.sin(a + 0.4) * 90 - 2, 4, 4);
  }
  // Subtle grid
  ctx.strokeStyle = "rgba(60,40,120,0.06)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= CW; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke(); }
  for (let y = 0; y <= CH; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke(); }

  // ── Zone/AoE/Nova effects (below entities) ──
  for (const ef of g.effects) {
    if (ef.tp === "aoe" || ef.tp === "nova" || ef.tp === "heal") {
      const alp = ef.life / ef.maxLife;
      ctx.globalAlpha = alp * 0.35;
      ctx.fillStyle = ef.clr;
      ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.r, 0, 6.28); ctx.fill();
      ctx.globalAlpha = alp * 0.7;
      ctx.strokeStyle = ef.clr;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ── Enemies ──
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.4, e.r * 0.8, e.r * 0.25, 0, 0, 6.28); ctx.fill();
    // Body
    const eg = ctx.createRadialGradient(e.x - e.r * 0.3, e.y - e.r * 0.3, 0, e.x, e.y, e.r);
    eg.addColorStop(0, e.clr);
    eg.addColorStop(1, "#111");
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.28); ctx.fill();
    // Status overlay
    if (e.stunT > 0) { ctx.fillStyle = "rgba(255,255,0,0.25)"; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 2, 0, 6.28); ctx.fill(); }
    if (e.slowT > 0) { ctx.fillStyle = "rgba(100,200,255,0.2)"; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 2, 0, 6.28); ctx.fill(); }
    // Eyes
    const ea = Math.atan2(g.player.y - e.y, g.player.x - e.x);
    const ex1 = e.x + Math.cos(ea - 0.35) * e.r * 0.35;
    const ey1 = e.y + Math.sin(ea - 0.35) * e.r * 0.35;
    const ex2 = e.x + Math.cos(ea + 0.35) * e.r * 0.35;
    const ey2 = e.y + Math.sin(ea + 0.35) * e.r * 0.35;
    ctx.fillStyle = e.type === 2 ? "#ffaa00" : e.type === 3 ? "#ff44ff" : "#fff";
    ctx.beginPath(); ctx.arc(ex1, ey1, e.r * 0.18, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(ex2, ey2, e.r * 0.18, 0, 6.28); ctx.fill();
    // Boss crown
    if (e.type === 3) {
      ctx.fillStyle = "#ffcc00";
      const cy2 = e.y - e.r - 2;
      ctx.beginPath();
      ctx.moveTo(e.x - 10, cy2); ctx.lineTo(e.x - 7, cy2 - 8); ctx.lineTo(e.x, cy2 - 3);
      ctx.lineTo(e.x + 7, cy2 - 8); ctx.lineTo(e.x + 10, cy2); ctx.closePath(); ctx.fill();
    }
    // HP bar
    const bw = e.r * 2.2;
    const by = e.y - e.r - 6;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(e.x - bw / 2, by, bw, 3);
    ctx.fillStyle = e.hp > e.maxHp * 0.3 ? "#44ff44" : "#ff4444";
    ctx.fillRect(e.x - bw / 2, by, bw * (e.hp / e.maxHp), 3);
  }

  // ── Player ──
  const p = g.player;
  if (!(p.invuln > 0 && g.frame % 6 < 3)) {
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.4, p.r * 0.7, p.r * 0.22, 0, 0, 6.28); ctx.fill();
    // Robe
    const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    rg.addColorStop(0, "#6633cc");
    rg.addColorStop(1, "#2a1155");
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
    ctx.strokeStyle = "#8844ee";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Staff
    const sx = p.x + Math.cos(p.angle) * p.r * 1.6;
    const sy = p.y + Math.sin(p.angle) * p.r * 1.6;
    ctx.strokeStyle = "#aa8844";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4); ctx.lineTo(sx, sy); ctx.stroke();
    // Staff tip glow
    const tipC = g.queue.length > 0 ? EL_CLR[g.queue[g.queue.length - 1]] : "#8866dd";
    ctx.shadowColor = tipC; ctx.shadowBlur = 10;
    ctx.fillStyle = tipC;
    ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, 6.28); ctx.fill();
    ctx.shadowBlur = 0;
    // Direction dot
    ctx.fillStyle = "#eeddff";
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * p.r * 0.45, p.y + Math.sin(p.angle) * p.r * 0.45, 2, 0, 6.28); ctx.fill();
    // Damage flash
    if (p.flash > 0) {
      ctx.fillStyle = `rgba(255,50,50,${p.flash / 10 * 0.5})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 3, 0, 6.28); ctx.fill();
    }
  }
  // Player HP bar
  const pbw = 30;
  const pby = p.y - p.r - 8;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(p.x - pbw / 2, pby, pbw, 3);
  ctx.fillStyle = p.hp > p.maxHp * 0.3 ? "#44ff88" : "#ff4444";
  ctx.fillRect(p.x - pbw / 2, pby, pbw * Math.max(0, p.hp / p.maxHp), 3);

  // ── Projectiles ──
  for (const pr of g.projs) {
    ctx.shadowColor = pr.clr; ctx.shadowBlur = 8;
    ctx.fillStyle = pr.clr;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, 6.28); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ── Chain lightning lines ──
  for (const ef of g.effects) {
    if (ef.tp === "chain") {
      ctx.globalAlpha = ef.life / ef.maxLife;
      for (const ln of ef.lines) {
        drawLightning(ctx, ln.x1, ln.y1, ln.x2, ln.y2, ef.clr, 2.5);
        drawLightning(ctx, ln.x1, ln.y1, ln.x2, ln.y2, "#fff", 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── Particles ──
  for (const pt of g.particles) {
    ctx.globalAlpha = pt.life;
    ctx.fillStyle = pt.clr;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r * pt.life, 0, 6.28); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── Floating texts ──
  for (const t of g.texts) {
    ctx.globalAlpha = Math.min(1, t.life / 10);
    ctx.fillStyle = t.clr;
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(t.txt, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  // ── HUD ──
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`⭐ ${g.score}`, 8, 18);
  ctx.fillText(`🌊 ${g.wave}`, 8, 36);

  // Spell name
  if (g.spellT > 0) {
    ctx.globalAlpha = Math.min(1, g.spellT / 15);
    ctx.fillStyle = "#ffdd88";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText(g.spellNm, CW / 2, CH - 10);
    ctx.globalAlpha = 1;
  }

  // Wave announcement
  if (g.waveAnn > 0) {
    ctx.globalAlpha = Math.min(1, g.waveAnn / 20);
    ctx.fillStyle = "#ffdd44";
    ctx.font = "bold 26px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`Волна ${g.wave}`, CW / 2, CH / 2 - 20);
    ctx.font = "14px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(g.wave % 5 === 0 && g.wave > 0 ? "⚠ БОСС!" : `Врагов: ${g.enemies.length}`, CW / 2, CH / 2 + 8);
    ctx.globalAlpha = 1;
  }
}

// ═════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════
export default function ManaWorldGame({ onClose }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const rafRef = useRef(null);

  const [queue, setQueue] = useState([]);
  const [over, setOver] = useState(false);
  const [started, setStarted] = useState(false);

  function loop() {
    const g = gameRef.current;
    const cv = canvasRef.current;
    if (!g || !cv) return;
    tick(g);
    render(cv.getContext("2d"), g);
    setQueue((prev) => {
      const nq = g.queue;
      if (prev.length === nq.length && prev.every((v, i) => v === nq[i])) return prev;
      return [...nq];
    });
    if (g.over) { setOver(true); return; }
    rafRef.current = requestAnimationFrame(loop);
  }

  function start() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    gameRef.current = createGame();
    setQueue([]); setOver(false); setStarted(false);
    rafRef.current = requestAnimationFrame(loop);
  }

  function activate() {
    const g = gameRef.current;
    if (g && !g.started && !g.over) { g.started = true; setStarted(true); }
  }

  function addEl(el) {
    const g = gameRef.current;
    if (!g || g.over) return;
    activate();
    if (g.queue.length < 2) g.queue.push(el);
  }

  function doCast() {
    const g = gameRef.current;
    if (!g || g.over) return;
    activate();
    castSpell(g);
  }

  function setKey(k, val) {
    const g = gameRef.current;
    if (g) g.keys[k] = val;
  }

  useEffect(() => {
    start();
    const onDown = (e) => {
      const g = gameRef.current;
      if (!g || g.over) return;
      activate();
      g.keys[e.key] = true;
      if (e.key === "1") { e.preventDefault(); addEl(0); }
      if (e.key === "2") { e.preventDefault(); addEl(1); }
      if (e.key === "3") { e.preventDefault(); addEl(2); }
      if (e.key === "4") { e.preventDefault(); addEl(3); }
      if (e.key === " ") { e.preventDefault(); doCast(); }
    };
    const onUp = (e) => {
      const g = gameRef.current;
      if (g) g.keys[e.key] = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spellPreview = (() => {
    if (queue.length === 0) return "";
    const k = [...queue].sort((a, b) => a - b).join("");
    return SPELLS[k]?.nm || "";
  })();

  const ds = Math.min(window.innerWidth * 0.92 / CW, window.innerHeight * 0.52 / CH, 1);

  /* eslint-disable react/no-unknown-property */
  const DBtn = ({ k, children }) => (
    <button
      className="flex h-10 w-10 select-none items-center justify-center rounded-lg bg-gray-700/80 text-lg text-gray-300 active:bg-purple-600/50"
      onTouchStart={(e) => { e.preventDefault(); setKey(k, true); activate(); }}
      onTouchEnd={() => setKey(k, false)}
      onTouchCancel={() => setKey(k, false)}
      onMouseDown={() => { setKey(k, true); activate(); }}
      onMouseUp={() => setKey(k, false)}
      onMouseLeave={() => setKey(k, false)}
      onContextMenu={(e) => e.preventDefault()}
    >{children}</button>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex flex-col items-center rounded-2xl bg-gray-900 p-3 shadow-2xl" style={{ maxWidth: "95vw", maxHeight: "95vh" }}>
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white shadow-lg transition-transform hover:scale-110"
          data-testid="mana-close"
        >✕</button>

        <p className="mb-1 text-center text-base font-bold tracking-wider text-purple-400">🧙 MANA WORLD</p>

        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          className="rounded-lg"
          style={{ width: CW * ds, height: CH * ds, touchAction: "none" }}
        />

        {/* Queue */}
        <div className="mt-1 flex items-center gap-1">
          <span className="text-[10px] text-gray-500">Маг:</span>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex h-7 w-7 items-center justify-center rounded-md border text-sm"
              style={{
                background: queue[i] !== undefined ? EL_CLR[queue[i]] + "22" : "#222",
                borderColor: queue[i] !== undefined ? EL_CLR[queue[i]] : "#444",
              }}
            >
              {queue[i] !== undefined ? EL_ICO[queue[i]] : "·"}
            </div>
          ))}
          {spellPreview && <span className="ml-1 text-[11px] font-semibold text-yellow-300">{spellPreview}</span>}
        </div>

        {/* Controls */}
        <div className="mt-1 flex w-full items-start justify-between gap-2 px-1">
          {/* D-pad */}
          <div className="grid grid-cols-3 gap-[3px]">
            <div />
            <DBtn k="ArrowUp">▲</DBtn>
            <div />
            <DBtn k="ArrowLeft">◀</DBtn>
            <DBtn k="ArrowDown">▼</DBtn>
            <DBtn k="ArrowRight">▶</DBtn>
          </div>

          {/* Elements + Cast */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((el) => (
                <button
                  key={el}
                  onClick={() => addEl(el)}
                  className="flex h-10 w-10 select-none items-center justify-center rounded-lg border text-lg active:scale-95"
                  style={{ background: EL_CLR[el] + "22", borderColor: EL_CLR[el] }}
                >{EL_ICO[el]}</button>
              ))}
            </div>
            <button
              onClick={doCast}
              className="w-full select-none rounded-lg bg-purple-600/80 px-3 py-1.5 text-sm font-bold text-white active:bg-purple-500"
            >⚔️ Каст</button>
          </div>
        </div>

        <p className="mt-1 text-[9px] text-gray-600">WASD ходить • 1234 элементы • Пробел каст</p>

        {/* Start overlay */}
        {!started && !over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/65" onClick={activate}>
            <p className="mb-2 text-3xl">🧙</p>
            <p className="mb-1 text-xl font-bold text-purple-400">MANA WORLD</p>
            <p className="mb-1 text-sm text-gray-300">Комбинируй элементы, уничтожай врагов!</p>
            <div className="mb-3 flex gap-2 text-2xl">{EL_ICO.map((e, i) => <span key={i}>{e}</span>)}</div>
            <p className="mb-1 text-xs text-gray-400">🔥+🔥 = Метеор • ❄+⚡ = Шок-болт • 💧+💧 = Исцеление+</p>
            <p className="mt-2 animate-pulse text-sm text-white">Нажми чтобы начать</p>
          </div>
        )}

        {/* Game Over */}
        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/75">
            <p className="mb-1 text-3xl">💀</p>
            <p className="mb-2 text-2xl font-bold text-red-400">Игра окончена</p>
            <p className="text-white">Счёт: {gameRef.current?.score || 0}</p>
            <p className="text-gray-300">Волна: {gameRef.current?.wave || 0}</p>
            <p className="mb-4 text-gray-300">Убито: {gameRef.current?.kills || 0}</p>
            <div className="flex gap-3">
              <button onClick={start} className="rounded-lg bg-purple-500 px-6 py-2 font-bold text-white hover:bg-purple-400">Заново</button>
              <button onClick={onClose} className="rounded-lg bg-gray-600 px-6 py-2 font-bold text-white hover:bg-gray-500">Закрыть</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
