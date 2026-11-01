// ─── Вся отрисовка мира: город, машинки, эффекты, ночная подсветка ─────────

import type { World, Block, Pond, Park, StarPick } from './world';
import { PASTEL, FLOWER_C } from './world';

export interface CarState {
  id: number; x: number; y: number; angle: number;
  vx: number; vy: number; speed: number; baseSpeed: number;
  color: string; kind: 'car' | 'bus';
  state: 'drive' | 'fly' | 'return' | 'parked';
  spin: number; coolI: number; hitCool: number; pull: number;
  parkedHome?: { x: number; y: number; a: number };
  L: number; Wd: number;
}

export interface PlayerState {
  x: number; y: number; angle: number; speed: number;
  steer: number; siren: boolean; lights: boolean;
}

export interface Particle {
  kind: 'star' | 'confetti' | 'puff' | 'ring' | 'spark' | 'leaf' | 'drop';
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
  rot: number; vr: number; grav: number; grow: number;
}

export interface GameView { camX: number; camY: number; zoom: number; vw: number; vh: number }

export interface Scene {
  world: World; view: GameView; t: number; nightT: number;
  player: PlayerState; cars: CarState[]; particles: Particle[];
}

// ── утилиты ─────────────────────────────────────────────────────────────────
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

function vis(v: GameView, x: number, y: number, pad: number) {
  const hw = v.vw / 2 / v.zoom + pad;
  const hh = v.vh / 2 / v.zoom + pad;
  return x > v.camX - hw && x < v.camX + hw && y > v.camY - hh && y < v.camY + hh;
}

const CONFETTI_C = ['#ff5d8f', '#ffd93d', '#4cc9f0', '#80ed99', '#c56cf0', '#ff8c42'];
export { CONFETTI_C };

// ─── Главная функция кадра ──────────────────────────────────────────────────
export function renderFrame(ctx: CanvasRenderingContext2D, s: Scene) {
  const { world, view, t } = s;
  ctx.save();
  ctx.translate(view.vw / 2, view.vh / 2);
  ctx.scale(view.zoom, view.zoom);
  ctx.translate(-view.camX, -view.camY);

  drawGround(ctx, s);

  // динамика земли
  for (const d of world.ducks) if (vis(view, d.x, d.y, 80)) drawDuck(ctx, d.x, d.y, d.size, t + d.a * 10);
  for (const b of world.butterflies) if (vis(view, b.x, b.y, 60)) drawButterfly(ctx, b.x, b.y, b.phase + t, FLOWER_C[b.color]);
  if (world.dog && vis(view, world.dog.x, world.dog.y, 80)) drawDog(ctx, world.dog.x, world.dog.y, world.dog.angle, t, world.dog.pause > 0);
  for (const p of world.peds) if (vis(view, p.x, p.y, 60)) drawPed(ctx, p.x, p.y, p.color, t, p.waveT, p.flip);

  for (const st of world.stars) if (!st.taken && vis(view, st.x, st.y, 80)) drawStarPick(ctx, st, t);

  // тени облаков
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  for (const c of world.clouds.slice(0, 5)) {
    for (const b of c.blobs) {
      ctx.beginPath();
      ctx.ellipse(c.x + b.dx * c.s + 70, c.y + b.dy * c.s + 95, b.r * c.s * 1.15, b.r * c.s * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const c of s.cars) if (vis(view, c.x, c.y, 120)) drawTrafficCar(ctx, c, t);
  drawAmbulance(ctx, s.player, t, s.nightT);

  drawParticles(ctx, s.particles);

  // птицы и облака — выше всего
  for (const b of world.birds) drawBird(ctx, b, t);
  drawClouds(ctx, world, view, t);

  ctx.restore();
}

// ─── Земля, дороги, кварталы ────────────────────────────────────────────────
function drawGround(ctx: CanvasRenderingContext2D, s: Scene) {
  const { world, view, t } = s;
  const x0 = view.camX - view.vw / 2 / view.zoom - 80;
  const y0 = view.camY - view.vh / 2 / view.zoom - 80;
  const x1 = view.camX + view.vw / 2 / view.zoom + 80;
  const y1 = view.camY + view.vh / 2 / view.zoom + 80;

  // трава
  ctx.fillStyle = '#84cd55';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  for (const g of world.grass) {
    if (!vis(view, g.x, g.y, g.rx + 20)) continue;
    ctx.fillStyle = g.c ? '#79c24b' : '#8ed65f';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, g.rx, g.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const rw = world.roadW;

  // тротуары
  ctx.fillStyle = '#cdd3db';
  for (const rx of world.roadV) ctx.fillRect(rx - rw / 2 - 13, y0, rw + 26, y1 - y0);
  for (const ry of world.roadH) ctx.fillRect(x0, ry - rw / 2 - 13, x1 - x0, rw + 26);

  // асфальт
  ctx.fillStyle = '#5c636f';
  for (const rx of world.roadV) ctx.fillRect(rx - rw / 2, y0, rw, y1 - y0);
  for (const ry of world.roadH) ctx.fillRect(x0, ry - rw / 2, x1 - x0, rw);

  // кромки дорог
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 4;
  for (const rx of world.roadV) {
    if (!vis(view, rx, view.camY, 200)) continue;
    ctx.beginPath(); ctx.moveTo(rx - rw / 2 + 7, y0); ctx.lineTo(rx - rw / 2 + 7, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + rw / 2 - 7, y0); ctx.lineTo(rx + rw / 2 - 7, y1); ctx.stroke();
  }
  for (const ry of world.roadH) {
    if (!vis(view, view.camX, ry, 200)) continue;
    ctx.beginPath(); ctx.moveTo(x0, ry - rw / 2 + 7); ctx.lineTo(x1, ry - rw / 2 + 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, ry + rw / 2 - 7); ctx.lineTo(x1, ry + rw / 2 - 7); ctx.stroke();
  }

  // центральные пунктиры (по сегментам между перекрёстками)
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 5;
  ctx.setLineDash([26, 30]);
  for (const rx of world.roadV) {
    if (!vis(view, rx, view.camY, 150)) continue;
    let prev = 0;
    for (const ry of world.roadH) {
      ctx.beginPath(); ctx.moveTo(rx, prev); ctx.lineTo(rx, ry - rw / 2 - 20); ctx.stroke();
      prev = ry + rw / 2 + 20;
    }
    ctx.beginPath(); ctx.moveTo(rx, prev); ctx.lineTo(rx, world.H); ctx.stroke();
  }
  for (const ry of world.roadH) {
    if (!vis(view, view.camX, ry, 150)) continue;
    let prev = 0;
    for (const rx of world.roadV) {
      ctx.beginPath(); ctx.moveTo(prev, ry); ctx.lineTo(rx - rw / 2 - 20, ry); ctx.stroke();
      prev = rx + rw / 2 + 20;
    }
    ctx.beginPath(); ctx.moveTo(prev, ry); ctx.lineTo(world.W, ry); ctx.stroke();
  }
  ctx.setLineDash([]);

  // кольцевая развязка
  const rb = world.roundabout;
  if (vis(view, rb.cx, rb.cy, rb.rOut + 60)) {
    ctx.fillStyle = '#cdd3db';
    ctx.beginPath(); ctx.arc(rb.cx, rb.cy, rb.rOut + 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5c636f';
    ctx.beginPath(); ctx.arc(rb.cx, rb.cy, rb.rOut, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 22]);
    ctx.beginPath(); ctx.arc(rb.cx, rb.cy, (rb.rOut + rb.rIn) / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#79c24b';
    ctx.beginPath(); ctx.arc(rb.cx, rb.cy, rb.rIn, 0, Math.PI * 2); ctx.fill();
    // цветник на островке
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      ctx.fillStyle = k % 2 ? '#ff6b9d' : '#ffd93d';
      ctx.beginPath(); ctx.arc(rb.cx + Math.cos(a) * 48, rb.cy + Math.sin(a) * 48, 7, 0, Math.PI * 2); ctx.fill();
    }
    drawTreeAt(ctx, rb.cx, rb.cy, 1.1, 0, false, t);
  }

  // зебры
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const z of world.zebras) {
    if (!vis(view, z.x, z.y, 220)) continue;
    for (let m = 0; m < 3; m++) {
      // юг и север (горизонтальные полосы)
      ctx.fillRect(z.x - rw / 2 + 10, z.y + rw / 2 + 5 + m * 13, rw - 20, 8);
      ctx.fillRect(z.x - rw / 2 + 10, z.y - rw / 2 - 13 - m * 13, rw - 20, 8);
      // восток и запад (вертикальные полосы)
      ctx.fillRect(z.x + rw / 2 + 5 + m * 13, z.y - rw / 2 + 10, 8, rw - 20);
      ctx.fillRect(z.x - rw / 2 - 13 - m * 13, z.y - rw / 2 + 10, 8, rw - 20);
    }
  }

  // кварталы
  for (const b of world.blocks) drawBlock(ctx, b, s);

  // фонари
  for (const l of world.lamps) {
    if (!vis(view, l.x, l.y, 60)) continue;
    ctx.strokeStyle = '#8a919c';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y - 2); ctx.stroke();
    ctx.fillStyle = '#6f7680';
    ctx.beginPath(); ctx.arc(l.x, l.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = s.nightT > 0.3 ? '#ffe9a0' : '#e8ecf2';
    ctx.beginPath(); ctx.arc(l.x, l.y, 5.5, 0, Math.PI * 2); ctx.fill();
  }

  // светофоры
  for (const tl of world.tlights) {
    if (!vis(view, tl.x, tl.y, 140)) continue;
    const px = tl.x + rw / 2 + 20;
    const py = tl.y + rw / 2 + 20;
    ctx.fillStyle = '#4a4f58';
    rr(ctx, px - 10, py - 10, 20, 34, 5); ctx.fill();
    const phase = (t * 0.7 + (tl.x + tl.y) * 0.001) % 3;
    const cols = ['#ff5252', '#ffd93d', '#4ade80'];
    for (let k = 0; k < 3; k++) {
      const on = Math.floor(phase) === k;
      ctx.fillStyle = on ? cols[k] : 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.arc(px, py - 3 + k * 9.5, 3.6, 0, Math.PI * 2); ctx.fill();
      if (on) {
        ctx.fillStyle = cols[k] + '44';
        ctx.beginPath(); ctx.arc(px, py - 3 + k * 9.5, 8, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // деревья
  for (const tr of world.trees) if (vis(view, tr.x, tr.y, 80)) drawTreeAt(ctx, tr.x, tr.y, tr.s, tr.v, tr.apple, t);

  // цветы
  for (const f of world.flowers) if (vis(view, f.x, f.y, 60)) drawFlowerPatch(ctx, f.x, f.y, FLOWER_C[f.c]);
}

function drawTreeAt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, v: number, apple: boolean, t: number) {
  const greens = ['#3f9e4d', '#4cb35c', '#59914a'];
  const g = greens[v % 3];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const sway = Math.sin(t * 1.2 + x * 0.05) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.ellipse(4, 8, 26, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a5a3b';
  rr(ctx, -4, -2, 8, 16, 3); ctx.fill();
  ctx.translate(sway * 0.3, 0);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(-12, -8, 16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(12, -8, 16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -20, 17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath(); ctx.arc(-6, -22, 10, 0, Math.PI * 2); ctx.fill();
  if (apple) {
    ctx.fillStyle = '#ff5252';
    ctx.beginPath(); ctx.arc(-9, -10, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -16, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -6, 3.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawFlowerPatch(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  const offs = [[0, 0], [14, 6], [-12, 8], [6, -10], [-7, -8]];
  for (const [dx, dy] of offs) {
    ctx.beginPath(); ctx.arc(x + dx, y + dy, 4.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#fff6cf';
  for (const [dx, dy] of offs) {
    ctx.beginPath(); ctx.arc(x + dx, y + dy, 1.8, 0, Math.PI * 2); ctx.fill();
  }
}

// ─── Кварталы ───────────────────────────────────────────────────────────────
function drawBlock(ctx: CanvasRenderingContext2D, b: Block, s: Scene) {
  const { view, t } = s;
  if (!vis(view, b.x + b.w / 2, b.y + b.h / 2, 420)) return;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;

  switch (b.kind) {
    case 'houses': {
      for (const h of b.houses!) {
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        rr(ctx, h.x + 5, h.y + 7, h.w, h.h, 10); ctx.fill();
        const c = PASTEL[h.color];
        ctx.fillStyle = c;
        rr(ctx, h.x, h.y, h.w, h.h, 10); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        rr(ctx, h.x + 10, h.y + 10, h.w - 20, h.h - 20, 8); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        rr(ctx, h.x + 16, h.y + 16, h.w - 32, h.h - 32, 6); ctx.fill();
        // дверь и окна
        ctx.fillStyle = '#7b5a43';
        const dx = h.door === 'l' ? h.x + 18 : h.x + h.w - 36;
        rr(ctx, dx, h.y + h.h - 30, 18, 30, 4); ctx.fill();
        ctx.fillStyle = '#ffe9a0';
        rr(ctx, h.door === 'l' ? h.x + h.w - 46 : h.x + 28, h.y + h.h - 34, 20, 16, 3); ctx.fill();
        // дымоход
        ctx.fillStyle = '#a2543f';
        ctx.fillRect(h.flip ? h.x + 20 : h.x + h.w - 32, h.y + 8, 12, 16);
        for (const tr of h.trees) drawTreeAt(ctx, tr.dx, tr.dy, tr.s, 1, false, t);
      }
      break;
    }
    case 'big': {
      const g = b.big!;
      const c = PASTEL[g.color];
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      rr(ctx, g.x + 6, g.y + 8, g.w, g.h, 14); ctx.fill();
      ctx.fillStyle = c;
      rr(ctx, g.x, g.y, g.w, g.h, 14); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      rr(ctx, g.x + 14, g.y + 14, g.w - 28, g.h - 28, 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      rr(ctx, g.x + 20, g.y + 20, g.w - 40, g.h - 40, 8); ctx.fill();
      // окна-иллюминаторы
      for (let r = 0; r < 3; r++) {
        for (let q = 0; q < 6; q++) {
          ctx.fillStyle = '#bfe6f5';
          rr(ctx, g.x + 34 + q * 44, g.y + 32 + r * 52, 26, 30, 5); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(g.x + 38 + q * 44, g.y + 36 + r * 52, 8, 8);
        }
      }
      ctx.fillStyle = '#7b5a43';
      rr(ctx, cx - 20, g.y + g.h - 26, 40, 26, 6); ctx.fill();
      break;
    }
    case 'hospital': {
      const h = b.hospital!;
      // газон
      ctx.fillStyle = '#79c24b';
      rr(ctx, b.x + 10, b.y + 10, b.w - 20, b.h - 20, 16); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      rr(ctx, h.x + 6, h.y + 8, h.w, h.h, 14); ctx.fill();
      ctx.fillStyle = '#f9fbfc';
      rr(ctx, h.x, h.y, h.w, h.h, 14); ctx.fill();
      ctx.strokeStyle = '#dfe6ec';
      ctx.lineWidth = 3;
      rr(ctx, h.x, h.y, h.w, h.h, 14); ctx.stroke();
      // красная полоса
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(h.x + 10, h.y + h.h - 34, h.w - 20, 10);
      // большой красный крест на крыше
      ctx.fillStyle = '#ffffff';
      rr(ctx, cx - 42, h.y + 22, 84, 84, 12); ctx.fill();
      ctx.strokeStyle = '#ffc9c9';
      ctx.lineWidth = 4;
      rr(ctx, cx - 42, h.y + 22, 84, 84, 12); ctx.stroke();
      ctx.fillStyle = '#e85548';
      ctx.fillRect(cx - 12, h.y + 36, 24, 56);
      ctx.fillRect(cx - 28, h.y + 52, 56, 24);
      // вертолётная площадка
      const p = h.pad;
      ctx.fillStyle = '#4a4f58';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 10]);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r - 8, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fff';
      ctx.font = '800 44px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', p.x, p.y + 2);
      // козырёк входа
      ctx.fillStyle = '#ffd93d';
      rr(ctx, cx - 55, h.y + h.h - 6, 110, 22, 8); ctx.fill();
      // кустики
      for (const [bx, by] of [[h.x - 8, h.y + h.h + 26], [h.x + h.w + 8, h.y + h.h + 26]] as const) {
        ctx.fillStyle = '#4cb35c';
        ctx.beginPath(); ctx.arc(bx, by, 14, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bx + 16, by + 4, 11, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'school': {
      const sc = b.school!;
      ctx.fillStyle = '#79c24b';
      rr(ctx, b.x + 10, b.y + 10, b.w - 20, b.h - 20, 16); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      rr(ctx, sc.x + 6, sc.y + 8, sc.w, sc.h, 14); ctx.fill();
      ctx.fillStyle = '#ffe08a';
      rr(ctx, sc.x, sc.y, sc.w, sc.h, 14); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      rr(ctx, sc.x + 14, sc.y + 14, sc.w - 28, sc.h - 28, 10); ctx.fill();
      for (let q = 0; q < 5; q++) {
        ctx.fillStyle = '#bfe6f5';
        rr(ctx, sc.x + 26 + q * 54, sc.y + 26, 32, 26, 5); ctx.fill();
        rr(ctx, sc.x + 26 + q * 54, sc.y + sc.h - 52, 32, 26, 5); ctx.fill();
      }
      ctx.fillStyle = '#7b5a43';
      rr(ctx, cx - 18, sc.y + sc.h - 24, 36, 24, 5); ctx.fill();
      // флаг с анимацией
      ctx.strokeStyle = '#8a919c';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(sc.flagX, sc.flagY + 10); ctx.lineTo(sc.flagX, sc.flagY - 52); ctx.stroke();
      const wave = Math.sin(t * 5) * 6;
      ctx.fillStyle = '#e85548';
      ctx.beginPath();
      ctx.moveTo(sc.flagX, sc.flagY - 52);
      ctx.quadraticCurveTo(sc.flagX + 26, sc.flagY - 58 + wave, sc.flagX + 52, sc.flagY - 50 + wave);
      ctx.quadraticCurveTo(sc.flagX + 26, sc.flagY - 40 + wave * 0.5, sc.flagX, sc.flagY - 30);
      ctx.closePath(); ctx.fill();
      // беговая дорожка
      ctx.strokeStyle = '#ffb35c';
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.ellipse(cx, cy + 150, 120, 50, 0, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'fire': {
      const f = b.fire!;
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      rr(ctx, f.x + 6, f.y + 8, f.w, f.h, 14); ctx.fill();
      ctx.fillStyle = '#f3e2c7';
      rr(ctx, f.x, f.y, f.w, f.h, 14); ctx.fill();
      ctx.fillStyle = '#e85548';
      rr(ctx, f.x + 10, f.y + 10, f.w - 20, 60, 8); ctx.fill();
      // ворота
      for (let q = 0; q < 3; q++) {
        const gx = f.x + 30 + q * 95;
        ctx.fillStyle = '#fff5ec';
        rr(ctx, gx, f.y + f.h - 74, 70, 74, 8); ctx.fill();
        ctx.fillStyle = '#e85548';
        rr(ctx, gx + 8, f.y + f.h - 66, 54, 66, 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let l = 0; l < 4; l++) ctx.fillRect(gx + 12, f.y + f.h - 56 + l * 15, 46, 4);
      }
      // вышка с колоколом
      ctx.fillStyle = '#e85548';
      rr(ctx, f.towerX - 22, f.towerY, 44, 44, 8); ctx.fill();
      ctx.fillStyle = '#fff5ec';
      rr(ctx, f.towerX - 12, f.towerY + 10, 24, 18, 5); ctx.fill();
      ctx.fillStyle = '#ffd93d';
      ctx.beginPath(); ctx.arc(f.towerX, f.towerY + 19, 6, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'shops': {
      const sh = b.shops!;
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      rr(ctx, sh.x + 6, sh.y + 8, sh.w, sh.h, 12); ctx.fill();
      ctx.fillStyle = '#f7f1e3';
      rr(ctx, sh.x, sh.y, sh.w, sh.h, 12); ctx.fill();
      for (const aw of sh.awnings) {
        // вывеска
        ctx.fillStyle = PASTEL[aw.c];
        rr(ctx, aw.x, sh.y + 14, aw.w, 22, 6); ctx.fill();
        // окна и дверь
        ctx.fillStyle = '#bfe6f5';
        rr(ctx, aw.x + 8, sh.y + 48, aw.w - 52, 40, 5); ctx.fill();
        ctx.fillStyle = '#7b5a43';
        rr(ctx, aw.x + aw.w - 34, sh.y + 48, 24, 46, 4); ctx.fill();
        // полосатый тент
        ctx.save();
        rr(ctx, aw.x - 4, aw.y, aw.w + 8, 26, 8);
        ctx.clip();
        for (let k = 0; k < 9; k++) {
          ctx.fillStyle = k % 2 ? '#ffffff' : PASTEL[aw.c];
          ctx.fillRect(aw.x - 4 + k * ((aw.w + 8) / 9), aw.y, (aw.w + 8) / 9 + 1, 26);
        }
        ctx.restore();
      }
      break;
    }
    case 'park': drawPark(ctx, b.park!, t); break;
    case 'pond': drawPond(ctx, b.pond!, t); break;
    case 'playground': drawPlayground(ctx, b, t); break;
    case 'parking': drawParking(ctx, b); break;
    case 'constr': drawConstr(ctx, b, t); break;
  }
}

function drawPark(ctx: CanvasRenderingContext2D, p: Park, t: number) {
  ctx.fillStyle = '#6fc24e';
  rr(ctx, p.x + 8, p.y + 8, p.w - 16, p.h - 16, 18); ctx.fill();
  // живая изгородь
  ctx.fillStyle = '#57a845';
  for (let x = p.x + 24; x < p.x + p.w - 20; x += 42) {
    ctx.beginPath(); ctx.arc(x, p.y + 20, 12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, p.y + p.h - 20, 12, 0, Math.PI * 2); ctx.fill();
  }
  // дорожки
  ctx.fillStyle = '#e8d9b8';
  for (const ph of p.paths) rr(ctx, ph.x + 10, ph.y, ph.w - 20, ph.h, 14), ctx.fill();
  // цветы
  for (const f of p.flowers) drawFlowerPatch(ctx, f.x, f.y, FLOWER_C[f.c]);
  // скамейки
  for (const bn of p.benches) {
    ctx.save();
    ctx.translate(bn.x, bn.y);
    ctx.rotate(bn.a);
    ctx.fillStyle = '#a06a42';
    rr(ctx, -20, -6, 40, 12, 4); ctx.fill();
    ctx.fillStyle = '#8a5a3b';
    ctx.fillRect(-16, 6, 5, 8);
    ctx.fillRect(11, 6, 5, 8);
    ctx.restore();
  }
  // плед для пикника
  if (p.blanket) {
    ctx.save();
    ctx.translate(p.blanket.x, p.blanket.y);
    ctx.rotate(0.3);
    const cols = ['#ff8c9d', '#8cd2ff', '#ffd166'];
    ctx.fillStyle = cols[p.blanket.c];
    rr(ctx, -28, -28, 56, 56, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (let k = -2; k <= 2; k++) { ctx.fillRect(k * 12 - 2, -28, 5, 56); ctx.fillRect(-28, k * 12 - 2, 56, 5); }
    // корзинка
    ctx.fillStyle = '#b0784a';
    rr(ctx, 4, -10, 18, 14, 3); ctx.fill();
    ctx.restore();
  }
  // фонтан
  if (p.fountain) {
    const f = p.fountain;
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath(); ctx.arc(f.x + 3, f.y + 5, f.r + 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9fc6d8';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8fd8f2';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    const rip = (t * 24) % 34;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(f.x, f.y, 8 + rip, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(f.x, f.y, 8 + ((rip + 17) % 34), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(f.x, f.y, 7 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2); ctx.fill();
  }
  for (const tr of p.trees) drawTreeAt(ctx, tr.x, tr.y, tr.s, 1, false, t);
}

function drawPond(ctx: CanvasRenderingContext2D, p: Pond, t: number) {
  // песчаный берег
  ctx.fillStyle = '#e8d9a8';
  ctx.beginPath(); ctx.ellipse(p.cx, p.cy, p.rx + 22, p.ry + 22, 0, 0, Math.PI * 2); ctx.fill();
  // вода
  const grad = ctx.createRadialGradient(p.cx - 40, p.cy - 40, 30, p.cx, p.cy, p.rx);
  grad.addColorStop(0, '#9bdcf5');
  grad.addColorStop(1, '#5cb8e8');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.ellipse(p.cx, p.cy, p.rx, p.ry, 0, 0, Math.PI * 2); ctx.fill();
  // блики-волны
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    const ry = p.cy - 60 + k * 55;
    const wob = Math.sin(t * 1.6 + k * 2) * 8;
    ctx.beginPath();
    ctx.ellipse(p.cx + wob, ry, 46 - k * 8, 10, 0, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  // лилии
  for (const l of p.lilies) {
    ctx.fillStyle = '#57a845';
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.arc(l.x, l.y, 12, 0.4, Math.PI * 2 - 0.4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffb3d1';
    ctx.beginPath(); ctx.arc(l.x + 3, l.y - 3, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // камыши
  ctx.strokeStyle = '#57a845';
  ctx.lineWidth = 4;
  for (const r of p.reeds) {
    const rx = p.cx + Math.cos(r.a) * (p.rx + 10);
    const ry = p.cy + Math.sin(r.a) * (p.ry + 10);
    const sw = Math.sin(t * 1.8 + r.a * 5) * 4;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.quadraticCurveTo(rx + sw, ry - 22, rx + sw * 1.6, ry - 40);
    ctx.stroke();
    ctx.fillStyle = '#8a5a3b';
    ctx.beginPath(); ctx.ellipse(rx + sw * 1.6, ry - 44, 4, 9, sw * 0.05, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlayground(ctx: CanvasRenderingContext2D, b: Block, t: number) {
  const pg = b.playground!;
  // разноцветное покрытие
  ctx.fillStyle = '#6fc9dc';
  rr(ctx, b.x + 16, b.y + 16, b.w - 32, b.h - 32, 22); ctx.fill();
  // заборчик из цветных столбиков
  const fenceC = ['#ff6b9d', '#ffd93d', '#4cc9f0', '#80ed99', '#c56cf0', '#ff8c42'];
  let fi = 0;
  for (let x = b.x + 24; x <= b.x + b.w - 24; x += 34) {
    ctx.fillStyle = fenceC[fi++ % fenceC.length];
    ctx.beginPath(); ctx.arc(x, b.y + 22, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, b.y + b.h - 22, 7, 0, Math.PI * 2); ctx.fill();
  }
  for (let y = b.y + 46; y <= b.y + b.h - 46; y += 34) {
    ctx.fillStyle = fenceC[fi++ % fenceC.length];
    ctx.beginPath(); ctx.arc(b.x + 22, y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(b.x + b.w - 22, y, 7, 0, Math.PI * 2); ctx.fill();
  }
  // горка
  ctx.save();
  ctx.translate(pg.slideX, pg.slideY);
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath(); ctx.moveTo(-34, 44); ctx.lineTo(10, 48); ctx.lineTo(-34, -16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff8c42';
  ctx.beginPath(); ctx.moveTo(-38, 40); ctx.lineTo(6, 44); ctx.lineTo(-38, -20); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd93d';
  rr(ctx, 6, -34, 16, 78, 6); ctx.fill();
  ctx.strokeStyle = '#e8b400';
  ctx.lineWidth = 3;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(8, -22 + k * 18); ctx.lineTo(20, -22 + k * 18); ctx.stroke(); }
  ctx.restore();
  // качели с анимицией
  ctx.save();
  ctx.translate(pg.swingX, pg.swingY);
  ctx.strokeStyle = '#7b8a99';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(-56, 52); ctx.lineTo(-44, -30); ctx.moveTo(-44, -30); ctx.lineTo(44, -30); ctx.moveTo(44, -30); ctx.lineTo(56, 52); ctx.stroke();
  for (const off of [-22, 22]) {
    const sw = Math.sin(t * 2.4 + off) * 0.45;
    ctx.save();
    ctx.translate(off, -30);
    ctx.rotate(sw);
    ctx.strokeStyle = '#aab6c4';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-7, 44); ctx.moveTo(7, 0); ctx.lineTo(7, 44); ctx.stroke();
    ctx.fillStyle = '#ff6b9d';
    rr(ctx, -12, 42, 24, 8, 3); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // качалка-балансир
  ctx.save();
  ctx.translate(pg.seesawX, pg.seesawY);
  ctx.fillStyle = '#7b8a99';
  ctx.beginPath(); ctx.moveTo(-10, 16); ctx.lineTo(10, 16); ctx.lineTo(0, -4); ctx.closePath(); ctx.fill();
  ctx.rotate(Math.sin(t * 1.7) * 0.12);
  ctx.fillStyle = '#4cc9f0';
  rr(ctx, -46, -10, 92, 10, 5); ctx.fill();
  ctx.fillStyle = '#ffd93d';
  ctx.beginPath(); ctx.arc(-40, -12, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(40, -12, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // песочница
  ctx.save();
  ctx.translate(pg.sandX, pg.sandY);
  ctx.fillStyle = '#c9a06a';
  rr(ctx, -52, -38, 104, 76, 10); ctx.fill();
  ctx.fillStyle = '#f0d9a8';
  rr(ctx, -44, -30, 88, 60, 8); ctx.fill();
  ctx.fillStyle = '#ff5252';
  ctx.beginPath(); ctx.arc(-18, -4, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4cc9f0';
  rr(ctx, 10, -14, 14, 20, 3); ctx.fill();
  ctx.restore();
}

function drawParking(ctx: CanvasRenderingContext2D, b: Block) {
  const pk = b.parking!;
  ctx.fillStyle = '#565d68';
  rr(ctx, pk.x, pk.y, pk.w, pk.h, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  for (const sp of pk.spots) {
    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate(sp.a);
    ctx.strokeRect(-26, -32, 52, 64);
    ctx.restore();
  }
  // клумба
  ctx.fillStyle = '#6fc24e';
  ctx.beginPath(); ctx.arc(pk.x + pk.w / 2, pk.y + pk.h / 2, 34, 0, Math.PI * 2); ctx.fill();
  drawFlowerPatch(ctx, pk.x + pk.w / 2 - 10, pk.y + pk.h / 2, '#ff6b9d');
  drawFlowerPatch(ctx, pk.x + pk.w / 2 + 12, pk.y + pk.h / 2 + 8, '#ffd93d');
}

function drawConstr(ctx: CanvasRenderingContext2D, b: Block, t: number) {
  const c = b.constr!;
  ctx.fillStyle = '#c69a68';
  rr(ctx, b.x + 14, b.y + 14, b.w - 28, b.h - 28, 16); ctx.fill();
  ctx.fillStyle = '#b5884f';
  for (let k = 0; k < 14; k++) {
    const dx = b.x + 40 + (k * 97) % (b.w - 80);
    const dy = b.y + 40 + (k * 61) % (b.h - 80);
    ctx.beginPath(); ctx.arc(dx, dy, 5, 0, Math.PI * 2); ctx.fill();
  }
  // кучи песка
  for (const p of c.piles) {
    ctx.fillStyle = '#e8cf96';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5e3b3';
    ctx.beginPath(); ctx.arc(p.x - p.r * 0.25, p.y - p.r * 0.25, p.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  // кран (медленно поворачивается)
  const cr = c.crane;
  ctx.save();
  ctx.translate(cr.x, cr.y);
  const ca = cr.a + Math.sin(t * 0.22) * 0.8;
  ctx.fillStyle = '#6b7280';
  rr(ctx, -20, -20, 40, 40, 6); ctx.fill();
  ctx.fillStyle = '#ffb400';
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(ca);
  ctx.fillStyle = '#ffb400';
  rr(ctx, -6, -10, 150, 16, 6); ctx.fill();
  ctx.fillStyle = '#e89a00';
  rr(ctx, -28, -8, 22, 24, 4); ctx.fill();
  ctx.strokeStyle = '#4a4f58';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(128, 6); ctx.lineTo(128, 46); ctx.stroke();
  ctx.fillStyle = '#4a4f58';
  rr(ctx, 120, 44, 16, 12, 3); ctx.fill();
  ctx.restore();
  // конусы
  for (const cn of c.cones) {
    ctx.fillStyle = '#ff8c42';
    ctx.beginPath(); ctx.moveTo(cn.x, cn.y - 12); ctx.lineTo(cn.x + 9, cn.y + 8); ctx.lineTo(cn.x - 9, cn.y + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(cn.x - 6, cn.y - 2, 12, 4);
  }
}

// ─── Звёздочка-бонус ────────────────────────────────────────────────────────
function drawStarPick(ctx: CanvasRenderingContext2D, st: StarPick, t: number) {
  const pulse = 1 + Math.sin(t * 3 + st.phase) * 0.12;
  const rot = Math.sin(t * 1.5 + st.phase) * 0.25;
  ctx.save();
  ctx.translate(st.x, st.y + Math.sin(t * 2.4 + st.phase) * 5);
  ctx.scale(pulse, pulse);
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 34);
  g.addColorStop(0, 'rgba(255,225,120,0.85)');
  g.addColorStop(1, 'rgba(255,225,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(rot);
  starPath(ctx, 0, 0, 20, 9);
  ctx.fillStyle = '#ffd93d';
  ctx.fill();
  ctx.strokeStyle = '#f0a500';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner: number) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const rad = k % 2 === 0 ? r : inner;
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ─── Маленькие жители ───────────────────────────────────────────────────────
function drawDuck(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 3) * 2);
  ctx.scale(size, size);
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath(); ctx.ellipse(2, 6, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff8e8';
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(9, -7, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff9f2e';
  ctx.beginPath(); ctx.arc(15, -6, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.arc(10, -9, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawButterfly(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number, color: string) {
  const flap = Math.abs(Math.sin(phase * 9)) * 0.85 + 0.15;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(-6 * flap - 2, 0, 7 * flap, 5, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6 * flap + 2, 0, 7 * flap, 5, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a4f58';
  ctx.beginPath(); ctx.ellipse(0, 0, 2, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawDog(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, t: number, sitting: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.ellipse(2, 7, 17, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c98d5a';
  const run = sitting ? 0 : Math.abs(Math.sin(t * 10)) * 2;
  ctx.beginPath(); ctx.ellipse(0, -run, 15, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(13, -4 - run, 7.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a06a3b';
  ctx.beginPath(); ctx.ellipse(10, -10 - run, 3, 5, 0.5, 0, Math.PI * 2); ctx.fill();
  // хвост
  ctx.strokeStyle = '#c98d5a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-14, -2);
  ctx.quadraticCurveTo(-20, -8, -18, -12 + Math.sin(t * 12) * 3);
  ctx.stroke();
  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.arc(16, -5 - run, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPed(ctx: CanvasRenderingContext2D, x: number, y: number, colorIdx: number, t: number, waveT: number, flip: boolean) {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.abs(Math.sin(t * 8 + x)) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.beginPath(); ctx.ellipse(1, 10, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  // ноги
  ctx.strokeStyle = '#4a4f58';
  ctx.lineWidth = 4;
  const step = Math.sin(t * 8 + x) * 4;
  ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(-3 + step, 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, 2); ctx.lineTo(3 - step, 10); ctx.stroke();
  // тельце
  ctx.fillStyle = PASTEL[colorIdx];
  ctx.beginPath(); ctx.ellipse(0, -2 - bob, 8, 9.5, 0, 0, Math.PI * 2); ctx.fill();
  // махающая рука
  if (waveT > 0) {
    const wave = Math.sin(t * 12) * 0.5;
    ctx.strokeStyle = '#f2c79b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(flip ? -7 : 7, -4 - bob);
    ctx.lineTo((flip ? -13 : 13), -13 - bob + wave * 4);
    ctx.stroke();
  }
  // голова
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath(); ctx.arc(0, -14 - bob, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b4a2f';
  ctx.beginPath(); ctx.arc(0, -16.5 - bob, 6, Math.PI, 0); ctx.fill();
  ctx.restore();
}

function drawBird(ctx: CanvasRenderingContext2D, b: { x: number; y: number; phase: number }, t: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  ctx.beginPath(); ctx.ellipse(b.x + 50, b.y + 70, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
  const flap = Math.sin(t * 9 + b.phase) * 6;
  ctx.strokeStyle = '#4a5a6a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(b.x - 11, b.y + flap * 0.3);
  ctx.quadraticCurveTo(b.x - 4, b.y - 5 - flap, b.x, b.y);
  ctx.quadraticCurveTo(b.x + 4, b.y - 5 - flap, b.x + 11, b.y + flap * 0.3);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawClouds(ctx: CanvasRenderingContext2D, world: World, view: GameView, t: number) {
  void t;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const c of world.clouds) {
    if (!vis(view, c.x, c.y, 300)) continue;
    for (const b of c.blobs) {
      ctx.beginPath();
      ctx.arc(c.x + b.dx * c.s, c.y + b.dy * c.s, b.r * c.s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─── Машинки ────────────────────────────────────────────────────────────────
function drawTrafficCar(ctx: CanvasRenderingContext2D, c: CarState, t: number) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  const flying = c.state === 'fly';
  const bob = flying ? Math.sin(t * 20 + c.id) * 2 : 0;
  ctx.translate(0, bob);
  const L = c.L, Wd = c.Wd;

  // тень
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(3, 7, L / 2 + 2, Wd / 2 + 2, 0, 0, Math.PI * 2); ctx.fill();

  // колёса
  ctx.fillStyle = '#2f3542';
  for (const [wx, wy] of [[L * 0.28, -Wd / 2 - 3], [L * 0.28, Wd / 2 - 5], [-L * 0.28, -Wd / 2 - 3], [-L * 0.28, Wd / 2 - 5]] as const) {
    rr(ctx, wx - 8, wy, 16, 8, 3); ctx.fill();
  }

  // кузов
  ctx.fillStyle = c.color;
  rr(ctx, -L / 2, -Wd / 2, L, Wd, 12); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  rr(ctx, -L / 2 + 4, -Wd / 2 + 3, L - 8, Wd / 2 - 4, 10); ctx.fill();

  if (c.kind === 'bus') {
    ctx.fillStyle = '#cfeeff';
    for (let k = 0; k < 4; k++) rr(ctx, -L / 2 + 12 + k * 20, -Wd / 2 + 6, 14, Wd - 12, 4), ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(-L / 2 + 4, -2, L - 8, 4);
  } else {
    // лобовое и кабина
    ctx.fillStyle = '#cfeeff';
    rr(ctx, L * 0.12, -Wd / 2 + 6, L * 0.2, Wd - 12, 5); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    rr(ctx, -L * 0.34, -Wd / 2 + 5, L * 0.42, Wd - 10, 7); ctx.fill();
    ctx.fillStyle = '#cfeeff';
    rr(ctx, -L * 0.31, -Wd / 2 + 9, L * 0.16, Wd - 18, 4); ctx.fill();
  }

  // фары и стопы
  ctx.fillStyle = '#ffe28a';
  ctx.beginPath(); ctx.arc(L / 2 - 3, -Wd / 2 + 8, 3.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(L / 2 - 3, Wd / 2 - 8, 3.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff5252';
  ctx.beginPath(); ctx.arc(-L / 2 + 3, -Wd / 2 + 8, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-L / 2 + 3, Wd / 2 - 8, 3, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawAmbulance(ctx: CanvasRenderingContext2D, p: PlayerState, t: number, nightT: number) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  const L = 82, Wd = 46;
  const bounce = Math.sin(t * 9) * 0.8;

  // тень
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(3, 8, L / 2 + 3, Wd / 2 + 3, 0, 0, Math.PI * 2); ctx.fill();

  // колёса
  ctx.fillStyle = '#2f3542';
  for (const [wx, wy] of [[L * 0.3, -Wd / 2 - 3], [L * 0.3, Wd / 2 - 5], [-L * 0.3, -Wd / 2 - 3], [-L * 0.3, Wd / 2 - 5]] as const) {
    rr(ctx, wx - 9, wy, 18, 8, 3); ctx.fill();
    ctx.fillStyle = '#57606f';
    ctx.fillRect(wx - 4, wy, 8, 8);
    ctx.fillStyle = '#2f3542';
  }

  ctx.translate(0, bounce * 0.3);

  // кузов
  ctx.fillStyle = '#fdfdfd';
  rr(ctx, -L / 2, -Wd / 2, L, Wd, 12); ctx.fill();
  ctx.strokeStyle = '#e2e8ee';
  ctx.lineWidth = 2;
  rr(ctx, -L / 2, -Wd / 2, L, Wd, 12); ctx.stroke();

  // красная полоса
  ctx.fillStyle = '#e85548';
  ctx.fillRect(-L / 2 + 6, -Wd / 2 + 2, L - 20, 7);
  ctx.fillRect(-L / 2 + 6, Wd / 2 - 9, L - 20, 7);

  // кабина и стёкла
  ctx.fillStyle = '#cfeeff';
  rr(ctx, L * 0.22, -Wd / 2 + 10, L * 0.17, Wd - 20, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(L * 0.24, -Wd / 2 + 13, 4, Wd - 26);

  // крест на крыше
  ctx.fillStyle = '#fff';
  rr(ctx, -18, -15, 30, 30, 7); ctx.fill();
  ctx.strokeStyle = '#ffd2d2';
  ctx.lineWidth = 2;
  rr(ctx, -18, -15, 30, 30, 7); ctx.stroke();
  ctx.fillStyle = '#e85548';
  ctx.fillRect(-8, -10, 10, 20);
  ctx.fillRect(-13, -5, 20, 10);

  // мигалка
  const flash = p.siren ? (Math.floor(t * 4.5) % 2 === 0) : false;
  ctx.fillStyle = '#57606f';
  rr(ctx, L * 0.05, -16, 12, 32, 4); ctx.fill();
  ctx.fillStyle = p.siren && flash ? '#ff5252' : '#c0392b';
  ctx.beginPath(); ctx.arc(L * 0.05 + 6, -9, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.siren && !flash ? '#4cc9f0' : '#2c6e9e';
  ctx.beginPath(); ctx.arc(L * 0.05 + 6, 9, 5.5, 0, Math.PI * 2); ctx.fill();

  // фары
  ctx.fillStyle = p.lights ? '#ffe9a0' : '#e8d9a8';
  ctx.beginPath(); ctx.arc(L / 2 - 4, -Wd / 2 + 9, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(L / 2 - 4, Wd / 2 - 9, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff5252';
  ctx.beginPath(); ctx.arc(-L / 2 + 3, -Wd / 2 + 9, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-L / 2 + 3, Wd / 2 - 9, 3.4, 0, Math.PI * 2); ctx.fill();

  // конусы света фар
  if (p.lights) {
    for (const side of [-1, 1]) {
      const grad = ctx.createLinearGradient(L / 2, 0, L / 2 + 210, 0);
      grad.addColorStop(0, `rgba(255,240,180,${0.4 + nightT * 0.2})`);
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(L / 2 - 2, side * (Wd / 2 - 12));
      ctx.lineTo(L / 2 + 210, side * (Wd / 2 - 12) + side * 60);
      ctx.lineTo(L / 2 + 210, side * (Wd / 2 - 12) + side * 20);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();

  // сияние сирены (в мировых координатах, поверх)
  if (p.siren) {
    const flash = Math.floor(t * 4.5) % 2 === 0;
    const col = flash ? '255,82,82' : '76,201,240';
    const R = 150 + Math.sin(t * 9) * 14;
    const g = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, R);
    g.addColorStop(0, `rgba(${col},0.4)`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.fill();
  }
}

// ─── Частицы ────────────────────────────────────────────────────────────────
function drawParticles(ctx: CanvasRenderingContext2D, parts: Particle[]) {
  for (const p of parts) {
    const k = p.life / p.maxLife;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = Math.min(1, k * 1.6);
    switch (p.kind) {
      case 'star': {
        ctx.rotate(p.rot);
        starPath(ctx, 0, 0, p.size, p.size * 0.45);
        ctx.fillStyle = p.color;
        ctx.fill();
        break;
      }
      case 'confetti': {
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        break;
      }
      case 'puff': {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(0, 0, p.size * (1 + (1 - k) * p.grow), 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'ring': {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * k + 1;
        ctx.beginPath(); ctx.arc(0, 0, p.size * (1 + (1 - k) * p.grow), 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'spark': {
        ctx.rotate(p.rot);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-p.size, 0); ctx.lineTo(p.size, 0);
        ctx.moveTo(0, -p.size); ctx.lineTo(0, p.size);
        ctx.stroke();
        break;
      }
      case 'leaf': {
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'drop': {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(0, 0, p.size * k + 1.5, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
}

// ─── Ночная подсветка (пробиваем темноту фарами и фонарями) ─────────────────
export function renderLighting(lctx: CanvasRenderingContext2D, s: Scene, siren: boolean) {
  const { view, world, player, nightT } = s;
  const l = lctx;
  l.clearRect(0, 0, view.vw, view.vh);
  if (nightT <= 0.01) return;
  l.save();
  l.fillStyle = `rgba(9,13,38,${0.62 * nightT})`;
  l.fillRect(0, 0, view.vw, view.vh);

  l.globalCompositeOperation = 'destination-out';
  l.translate(view.vw / 2, view.vh / 2);
  l.scale(view.zoom, view.zoom);
  l.translate(-view.camX, -view.camY);

  const punch = (x: number, y: number, r: number, a: number) => {
    const g = l.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    l.fillStyle = g;
    l.beginPath(); l.arc(x, y, r, 0, Math.PI * 2); l.fill();
  };

  // фонари
  for (const lamp of world.lamps) {
    if (!vis(view, lamp.x, lamp.y, 150)) continue;
    punch(lamp.x, lamp.y, 85, 0.75);
  }
  // светофоры
  for (const tl of world.tlights) {
    if (!vis(view, tl.x, tl.y, 200)) continue;
    punch(tl.x + world.roadW / 2 + 20, tl.y + world.roadW / 2 + 20, 55, 0.5);
  }
  // сирена
  if (siren) punch(player.x, player.y, 260, 0.55);
  // аурa вокруг машинки
  punch(player.x, player.y, 130, 0.4);
  // фары
  if (player.lights) {
    l.save();
    l.translate(player.x, player.y);
    l.rotate(player.angle);
    for (const side of [-1, 1]) {
      const g = l.createLinearGradient(41, 0, 250, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      l.fillStyle = g;
      l.beginPath();
      l.moveTo(38, side * 12);
      l.lineTo(255, side * 78);
      l.lineTo(255, side * 30);
      l.closePath();
      l.fill();
    }
    l.restore();
  }
  // звёздочки светятся
  for (const st of world.stars) {
    if (!st.taken && vis(view, st.x, st.y, 60)) punch(st.x, st.y, 60, 0.5);
  }
  l.restore();

  // тёплые блики поверх
  l.save();
  l.translate(view.vw / 2, view.vh / 2);
  l.scale(view.zoom, view.zoom);
  l.translate(-view.camX, -view.camY);
  for (const lamp of world.lamps) {
    if (!vis(view, lamp.x, lamp.y, 150)) continue;
    const g = l.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, 70);
    g.addColorStop(0, `rgba(255,214,120,${0.35 * nightT})`);
    g.addColorStop(1, 'rgba(255,214,120,0)');
    l.fillStyle = g;
    l.beginPath(); l.arc(lamp.x, lamp.y, 70, 0, Math.PI * 2); l.fill();
  }
  if (siren) {
    const flash = Math.floor(s.t * 4.5) % 2 === 0;
    const col = flash ? '255,80,80' : '76,201,240';
    const g = l.createRadialGradient(player.x, player.y, 10, player.x, player.y, 240);
    g.addColorStop(0, `rgba(${col},${0.4 * nightT})`);
    g.addColorStop(1, `rgba(${col},0)`);
    l.fillStyle = g;
    l.beginPath(); l.arc(player.x, player.y, 240, 0, Math.PI * 2); l.fill();
  }
  l.restore();
}
