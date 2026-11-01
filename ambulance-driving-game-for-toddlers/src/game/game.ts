// ─── Игровой движок: физика, ИИ машинок, события, камера ───────────────────

import { AudioEngine } from './audio';
import { generateWorld, randomStarPos, mulberry32 } from './world';
import { renderFrame, renderLighting, CONFETTI_C } from './render';
import type { CarState, PlayerState, Particle, GameView, Scene } from './render';

export interface GameCallbacks { onStars(n: number): void }

export interface GameHandle {
  input: { left: boolean; right: boolean };
  startAudio(): void;
  setHorn(on: boolean): void;
  toggleSiren(): boolean;
  toggleLights(): boolean;
  toggleNight(): boolean;
  setMusic(on: boolean): void;
  setSound(on: boolean): void;
  destroy(): void;
}

const CAR_COLORS = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#f368e0', '#ff9f43', '#54a0ff', '#5fbd8f', '#ff9ff3', '#c8d64e'];

export function createGame(canvas: HTMLCanvasElement, cb: GameCallbacks): GameHandle {
  const world = generateWorld(((Math.random() * 1e9) | 0) ^ 0x9e3779b9);
  const rnd = mulberry32(((Math.random() * 1e9) | 0) + 7);
  const audio = new AudioEngine();

  const player: PlayerState = {
    x: 1560, y: 900, angle: 0, speed: 0, steer: 0, siren: false, lights: false,
  };

  const cars: CarState[] = [];
  let carId = 0;
  // припаркованные машинки
  for (const s of world.parkingSpots) {
    cars.push({
      id: carId++, x: s.x, y: s.y, angle: s.a + Math.PI / 2, vx: 0, vy: 0,
      speed: 0, baseSpeed: 0, color: CAR_COLORS[carId % CAR_COLORS.length],
      kind: 'car', state: 'parked', spin: 0, coolI: 0, hitCool: 0, pull: 0, L: 60, Wd: 36,
    });
  }
  // едущие машинки
  for (let k = 0; k < 13; k++) {
    const onV = rnd() > 0.5;
    let x: number, y: number, dx = 0, dy = 0;
    if (onV) {
      x = world.roadV[(rnd() * world.roadV.length) | 0] + (rnd() > 0.5 ? 20 : -20);
      y = 200 + rnd() * (world.H - 400);
      dy = rnd() > 0.5 ? 1 : -1;
    } else {
      x = 200 + rnd() * (world.W - 400);
      y = world.roadH[(rnd() * world.roadH.length) | 0] + (rnd() > 0.5 ? 20 : -20);
      dx = rnd() > 0.5 ? 1 : -1;
    }
    if (Math.hypot(x - player.x, y - player.y) < 400) { x = 300; y = 300 + k * 90; dx = 1; dy = 0; }
    const bus = rnd() > 0.82;
    const c: CarState = {
      id: carId++, x, y, angle: Math.atan2(dy, dx), vx: dx, vy: dy,
      speed: 0, baseSpeed: 80 + rnd() * 60, color: CAR_COLORS[(k + 3) % CAR_COLORS.length],
      kind: bus ? 'bus' : 'car', state: 'drive', spin: 0, coolI: 1 + rnd(), hitCool: 0, pull: 0,
      L: bus ? 94 : 62, Wd: bus ? 42 : 36,
    };
    c.vx = dx;
    c.vy = dy;
    cars.push(c);
  }

  const particles: Particle[] = [];
  const view: GameView = { camX: player.x, camY: player.y, zoom: 1, vw: 800, vh: 600 };

  let starsCount = 0;
  let nightTarget = 0;
  let nightT = 0;
  let t = 0;
  let running = true;
  let hornOn = false;
  let hornRingT = 0;
  let hornResponseT = 0;
  let popCool = 0;
  let splashCool = 0;
  let shake = 0;
  let raf = 0;
  let last = performance.now();

  // канвас подсветки (ночь)
  const lightCanvas = document.createElement('canvas');
  const lctx = lightCanvas.getContext('2d')!;
  const ctx = canvas.getContext('2d')!;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    view.vw = vw;
    view.vh = vh;
    view.zoom = Math.max(0.7, Math.min(1.12, Math.min(vw / 1000, vh / 700) + 0.12));
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    lightCanvas.width = canvas.width;
    lightCanvas.height = canvas.height;
  }
  resize();
  window.addEventListener('resize', resize);

  // ── вспомогательное ────────────────────────────────────────────────────────
  function spawnParticle(p: Particle) { particles.push(p); }

  function burst(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const sp = 60 + rnd() * 160;
      spawnParticle({
        kind: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.7 + rnd() * 0.4, maxLife: 1, size: 6 + rnd() * 7, color: rnd() > 0.5 ? '#ffd93d' : '#ffb400',
        rot: rnd() * 6, vr: (rnd() - 0.5) * 10, grav: 160, grow: 0,
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2;
      spawnParticle({
        kind: 'puff', x: x + Math.cos(a) * 16, y: y + Math.sin(a) * 10,
        vx: Math.cos(a) * 24, vy: Math.sin(a) * 16, life: 0.65, maxLife: 0.65,
        size: 9 + rnd() * 6, color: 'rgba(220,225,232,0.5)', rot: 0, vr: 0, grav: -14, grow: 1.6,
      });
    }
  }

  function confetti(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4;
      const sp = 120 + rnd() * 260;
      spawnParticle({
        kind: 'confetti', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.9 + rnd() * 0.7, maxLife: 1.4, size: 8 + rnd() * 8,
        color: CONFETTI_C[(rnd() * CONFETTI_C.length) | 0],
        rot: rnd() * 6, vr: (rnd() - 0.5) * 14, grav: 330, grow: 0,
      });
    }
    spawnParticle({
      kind: 'ring', x, y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, size: 26,
      color: 'rgba(255,235,150,0.9)', rot: 0, vr: 0, grav: 0, grow: 3.4,
    });
  }

  function sparkle(x: number, y: number) {
    spawnParticle({
      kind: 'spark', x, y, vx: 0, vy: -12, life: 0.45, maxLife: 0.45,
      size: 7 + rnd() * 5, color: 'rgba(255,250,210,0.95)', rot: rnd() * 3, vr: 2, grav: 0, grow: 0,
    });
  }

  function onRoad(x: number, y: number): boolean {
    const rw = world.roadW / 2 + 10;
    for (const rx of world.roadV) if (Math.abs(x - rx) < rw) return true;
    for (const ry of world.roadH) if (Math.abs(y - ry) < rw) return true;
    const rb = world.roundabout;
    const d = Math.hypot(x - rb.cx, y - rb.cy);
    return d < rb.rOut + 8 && d > rb.rIn - 14;
  }

  function inPond(x: number, y: number): boolean {
    const p = world.pondRef;
    if (!p) return false;
    const nx = (x - p.cx) / (p.rx + 4);
    const ny = (y - p.cy) / (p.ry + 4);
    return nx * nx + ny * ny < 1;
  }

  // ── обновление игрока ──────────────────────────────────────────────────────
  function updatePlayer(dt: number) {
    const p = player;
    const steerTarget = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.steer += (steerTarget - p.steer) * Math.min(1, dt * 6.5);

    let surf = 1;
    if (!onRoad(p.x, p.y)) surf = 0.75;
    if (inPond(p.x, p.y)) {
      surf = 0.4;
      splashCool -= dt;
      if (splashCool <= 0 && p.speed > 60) {
        splashCool = 0.16;
        for (let i = 0; i < 3; i++) {
          spawnParticle({
            kind: 'drop', x: p.x + (rnd() - 0.5) * 40, y: p.y + (rnd() - 0.5) * 30,
            vx: (rnd() - 0.5) * 90, vy: -50 - rnd() * 60, life: 0.5, maxLife: 0.5,
            size: 5, color: 'rgba(220,245,255,0.9)', rot: 0, vr: 0, grav: 300, grow: 0,
          });
        }
        spawnParticle({
          kind: 'ring', x: p.x, y: p.y, vx: 0, vy: 0, life: 0.6, maxLife: 0.6,
          size: 22, color: 'rgba(255,255,255,0.7)', rot: 0, vr: 0, grav: 0, grow: 2.6,
        });
        audio.pop();
      }
    }

    const cruise = (p.siren ? 252 : 208) * surf;
    p.speed += (cruise - p.speed) * Math.min(1, dt * 1.6);
    p.angle += p.steer * 2.45 * dt * Math.min(1, p.speed / 130);
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;

    // границы мира — мягкий отскок
    popCool -= dt;
    const m = 46;
    let hitWall = false;
    if (p.x < m) { p.x = m; p.angle = Math.PI - p.angle; hitWall = true; }
    if (p.x > world.W - m) { p.x = world.W - m; p.angle = Math.PI - p.angle; hitWall = true; }
    if (p.y < m) { p.y = m; p.angle = -p.angle; hitWall = true; }
    if (p.y > world.H - m) { p.y = world.H - m; p.angle = -p.angle; hitWall = true; }
    if (hitWall) {
      p.angle += (rnd() - 0.5) * 0.4;
      if (popCool <= 0) { audio.pop(); popCool = 0.4; shake = Math.max(shake, 3); }
    }

    // здания — круг против прямоугольников
    for (const s of world.solids) {
      if (p.x < s.x - 40 || p.x > s.x + s.w + 40 || p.y < s.y - 40 || p.y > s.y + s.h + 40) continue;
      const cx = Math.max(s.x, Math.min(p.x, s.x + s.w));
      const cy = Math.max(s.y, Math.min(p.y, s.y + s.h));
      const dx = p.x - cx, dy = p.y - cy;
      const d = Math.hypot(dx, dy);
      const R = 30;
      if (d < R && d > 0.001) {
        const nx = dx / d, ny = dy / d;
        p.x = cx + nx * R;
        p.y = cy + ny * R;
        const fx = Math.cos(p.angle), fy = Math.sin(p.angle);
        const dot = fx * nx + fy * ny;
        if (dot < 0) {
          const bx = fx - 2 * dot * nx, by = fy - 2 * dot * ny;
          p.angle = Math.atan2(by, bx) + (rnd() - 0.5) * 0.2;
          p.speed *= 0.82;
          if (popCool <= 0) { audio.pop(); popCool = 0.35; shake = Math.max(shake, 2.5); }
          spawnParticle({
            kind: 'puff', x: cx, y: cy, vx: nx * 20, vy: ny * 20, life: 0.5, maxLife: 0.5,
            size: 10, color: 'rgba(220,225,232,0.55)', rot: 0, vr: 0, grav: -10, grow: 1.8,
          });
        }
      }
    }

    // мерцание сирены — искры
    if (p.siren && rnd() < dt * 14) {
      const a = rnd() * Math.PI * 2;
      sparkle(p.x + Math.cos(a) * 46, p.y + Math.sin(a) * 36);
    }

    audio.engineSpeed(p.speed / 260);
  }

  // ── обновление машинок ─────────────────────────────────────────────────────
  function nearestRoadPoint(x: number, y: number): { x: number; y: number; vert: boolean; d: number } {
    let best = { x: world.roadV[0], y, vert: true, d: Math.abs(x - world.roadV[0]) };
    for (const rx of world.roadV) {
      const d = Math.abs(x - rx);
      if (d < best.d) best = { x: rx, y, vert: true, d };
    }
    for (const ry of world.roadH) {
      const d = Math.abs(y - ry);
      if (d < best.d) best = { x, y: ry, vert: false, d };
    }
    return best;
  }

  function updateCar(c: CarState, dt: number) {
    c.coolI -= dt;
    c.hitCool -= dt;

    // сирена рядом — вежливо прижимаемся
    const pd = Math.hypot(c.x - player.x, c.y - player.y);
    const pullTarget = player.siren && pd < 340 && c.state === 'drive' ? 1 : 0;
    c.pull += (pullTarget - c.pull) * Math.min(1, dt * 2.5);

    if (c.state === 'drive') {
      const spd = c.baseSpeed * (1 - c.pull * 0.55);
      // смена направления на перекрёстках
      if (c.coolI <= 0) {
        if (c.vx !== 0) {
          for (const rx of world.roadV) {
            if (Math.abs(c.x - rx) < 48 && Math.abs(c.y - nearestRoadPoint(c.x, c.y).y) < 80) {
              const r = rnd();
              if (r < 0.42) { /* прямо */ }
              else if (r < 0.68) { const nd = c.vx > 0 ? [0, -1] : [0, 1]; c.vx = nd[0]; c.vy = nd[1]; }
              else if (r < 0.94) { const nd = c.vx > 0 ? [0, 1] : [0, -1]; c.vx = nd[0]; c.vy = nd[1]; }
              else { c.vx = -c.vx; }
              c.coolI = 1.1;
              break;
            }
          }
        } else if (c.vy !== 0) {
          for (const ry of world.roadH) {
            if (Math.abs(c.y - ry) < 48 && Math.abs(c.x - nearestRoadPoint(c.x, c.y).x) < 80) {
              const r = rnd();
              if (r < 0.42) { /* прямо */ }
              else if (r < 0.68) { const nd = c.vy > 0 ? [1, 0] : [-1, 0]; c.vx = nd[0]; c.vy = nd[1]; }
              else if (r < 0.94) { const nd = c.vy > 0 ? [-1, 0] : [1, 0]; c.vx = nd[0]; c.vy = nd[1]; }
              else { c.vy = -c.vy; }
              c.coolI = 1.1;
              break;
            }
          }
        }
      }
      c.x += c.vx * spd * dt;
      c.y += c.vy * spd * dt;
      // правосторонняя полоса
      const side = 20 + c.pull * 14;
      if (c.vx !== 0) {
        const rp = nearestRoadPoint(c.x, c.y);
        const target = rp.y + (c.vx > 0 ? side : -side);
        c.y += Math.max(-60 * dt, Math.min(60 * dt, target - c.y) * 4 * dt * 6);
      } else {
        const rp = nearestRoadPoint(c.x, c.y);
        const target = rp.x + (c.vy > 0 ? -side : side);
        c.x += Math.max(-60 * dt, Math.min(60 * dt, target - c.x) * 4 * dt * 6);
      }
      c.angle = Math.atan2(c.vy, c.vx);
      // границы — разворот
      if (c.x < 240) { c.vx = 1; c.vy = 0; c.coolI = 1; }
      if (c.x > world.W - 240) { c.vx = -1; c.vy = 0; c.coolI = 1; }
      if (c.y < 240) { c.vx = 0; c.vy = 1; c.coolI = 1; }
      if (c.y > world.H - 240) { c.vx = 0; c.vy = -1; c.coolI = 1; }
    } else if (c.state === 'fly') {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.angle += c.spin * dt;
      const damp = Math.pow(0.06, dt);
      c.vx *= damp;
      c.vy *= damp;
      c.spin *= Math.pow(0.12, dt);
      // стены
      const m = 60;
      if (c.x < m) { c.x = m; c.vx = Math.abs(c.vx) * 0.55; c.spin *= -0.6; }
      if (c.x > world.W - m) { c.x = world.W - m; c.vx = -Math.abs(c.vx) * 0.55; c.spin *= -0.6; }
      if (c.y < m) { c.y = m; c.vy = Math.abs(c.vy) * 0.55; c.spin *= -0.6; }
      if (c.y > world.H - m) { c.y = world.H - m; c.vy = -Math.abs(c.vy) * 0.55; c.spin *= -0.6; }
      // здания
      for (const s of world.solids) {
        if (c.x < s.x - 36 || c.x > s.x + s.w + 36 || c.y < s.y - 36 || c.y > s.y + s.h + 36) continue;
        const cx = Math.max(s.x, Math.min(c.x, s.x + s.w));
        const cy = Math.max(s.y, Math.min(c.y + 0, s.y + s.h));
        const dx = c.x - cx, dy = c.y - cy;
        const d = Math.hypot(dx, dy);
        if (d < 26 && d > 0.001) {
          const nx = dx / d, ny = dy / d;
          c.x = cx + nx * 26;
          c.y = cy + ny * 26;
          const dot = c.vx * nx + c.vy * ny;
          if (dot < 0) {
            c.vx -= 1.6 * dot * nx;
            c.vy -= 1.6 * dot * ny;
            c.spin *= -0.7;
          }
        }
      }
      if (Math.hypot(c.vx, c.vy) < 55) {
        c.state = c.parkedHome ? 'parked' : 'return';
        c.spin = 0;
      }
    } else if (c.state === 'return') {
      const rp = nearestRoadPoint(c.x, c.y);
      const desired = Math.atan2(rp.y - c.y, rp.x - c.x);
      let diff = desired - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
      c.x += Math.cos(c.angle) * 132 * dt;
      c.y += Math.sin(c.angle) * 132 * dt;
      if (rp.d < 42) {
        // встаём на дорогу
        const ax = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        let bi = 0, bd = Infinity;
        for (let k = 0; k < 4; k++) {
          let dd = Math.abs(ax[k] - c.angle);
          while (dd > Math.PI) dd = Math.abs(dd - Math.PI * 2);
          if (dd < bd) { bd = dd; bi = k; }
        }
        c.vx = Math.round(Math.cos(ax[bi]));
        c.vy = Math.round(Math.sin(ax[bi]));
        c.angle = ax[bi];
        c.state = 'drive';
        c.coolI = 0.8;
      }
    }
    // parked — стоит, ничего не делает
  }

  // ── столкновения ───────────────────────────────────────────────────────────
  function collideAll(dt: number) {
    void dt;
    const p = player;
    const pr = 30;
    for (const c of cars) {
      const cr = Math.max(c.L, c.Wd) * 0.42;
      const dx = c.x - p.x, dy = c.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < pr + cr && d > 0.001 && c.hitCool <= 0) {
        const nx = dx / d, ny = dy / d;
        // выталкиваем
        c.x = p.x + nx * (pr + cr + 2);
        c.y = p.y + ny * (pr + cr + 2);
        const impact = p.speed * Math.max(0.35, Math.abs(Math.cos(p.angle) * nx + Math.sin(p.angle) * ny));
        c.vx = nx * (impact * 1.1 + 90) + (rnd() - 0.5) * 60;
        c.vy = ny * (impact * 1.1 + 90) + (rnd() - 0.5) * 60;
        c.spin = (rnd() > 0.5 ? 1 : -1) * (4 + rnd() * 6);
        if (c.state !== 'fly') {
          c.state = 'fly';
          c.hitCool = 0.55;
          const strength = Math.min(1, impact / 240);
          audio.boing(strength);
          if (strength > 0.55) audio.whoosh();
          burst((p.x + c.x) / 2, (p.y + c.y) / 2, 5 + Math.floor(strength * 6));
          shake = Math.max(shake, 2 + strength * 5);
          if (navigator.vibrate) navigator.vibrate(Math.round(8 + strength * 18));
        }
      }
    }
    // машинка-машинка
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        if (a.state === 'parked' && b.state === 'parked') continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const rr = Math.max(a.L, a.Wd) * 0.4 + Math.max(b.L, b.Wd) * 0.4;
        if (d < rr && d > 0.001) {
          const nx = dx / d, ny = dy / d;
          const push = (rr - d) / 2;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const relVx = (b.state === 'fly' ? b.vx : b.vx * b.baseSpeed) - (a.state === 'fly' ? a.vx : a.vx * a.baseSpeed);
          const relVy = (b.state === 'fly' ? b.vy : b.vy * b.baseSpeed) - (a.state === 'fly' ? a.vy : a.vy * a.baseSpeed);
          const rel = Math.hypot(relVx, relVy);
          if (rel > 150 && (a.hitCool <= 0 || b.hitCool <= 0)) {
            audio.boing(0.45);
            burst((a.x + b.x) / 2, (a.y + b.y) / 2, 4);
            a.hitCool = b.hitCool = 0.6;
            if (a.state !== 'fly') { a.state = 'fly'; a.vx = -nx * 120; a.vy = -ny * 120; a.spin = 4; }
            if (b.state !== 'fly') { b.state = 'fly'; b.vx = nx * 120; b.vy = ny * 120; b.spin = -4; }
          }
        }
      }
    }
  }

  // ── звёздочки ──────────────────────────────────────────────────────────────
  function updateStars(dt: number) {
    for (const st of world.stars) {
      if (st.taken) {
        st.respawn -= dt;
        if (st.respawn <= 0) {
          const pos = randomStarPos(world, rnd);
          st.x = pos.x;
          st.y = pos.y;
          st.taken = false;
        }
        continue;
      }
      const d = Math.hypot(st.x - player.x, st.y - player.y);
      if (d < 52) {
        st.taken = true;
        st.respawn = 2.5 + rnd() * 2;
        starsCount++;
        cb.onStars(starsCount);
        if (starsCount % 8 === 0) {
          audio.fanfare();
          confetti(player.x, player.y - 30, 60);
        } else {
          audio.chime();
          confetti(st.x, st.y, 22);
        }
        if (navigator.vibrate) navigator.vibrate(12);
      }
    }
  }

  // ── живность ───────────────────────────────────────────────────────────────
  function updateCritters(dt: number) {
    // пешеходы ходят вокруг квартала
    for (const ped of world.peds) {
      const b = world.blocks[ped.blockIdx];
      if (!b) continue;
      const inset = 30;
      const w = b.w - inset * 2, h = b.h - inset * 2;
      const perim = 2 * (w + h);
      ped.segT = (ped.segT + (ped.speed * dt) / perim) % 1;
      const L = ped.segT * perim;
      let x = 0, y = 0;
      if (L < w) { x = L; y = 0; }
      else if (L < w + h) { x = w; y = L - w; }
      else if (L < 2 * w + h) { x = w - (L - w - h); y = h; }
      else { x = 0; y = h - (L - 2 * w - h); }
      ped.x = b.x + inset + x;
      ped.y = b.y + inset + y;
      ped.waveT = Math.max(0, ped.waveT - dt);
      const pd = Math.hypot(ped.x - player.x, ped.y - player.y);
      if (player.siren && pd < 230) ped.waveT = Math.max(ped.waveT, 0.6);
    }
    // бабочки
    for (const bf of world.butterflies) {
      bf.phase += dt;
      const dx = bf.tx - bf.x, dy = bf.ty - bf.y;
      const d = Math.hypot(dx, dy);
      if (d < 16) {
        bf.tx = bf.area.x + 30 + rnd() * (bf.area.w - 60);
        bf.ty = bf.area.y + 30 + rnd() * (bf.area.h - 60);
      } else {
        bf.x += (dx / d) * 46 * dt;
        bf.y += (dy / d) * 46 * dt + Math.sin(bf.phase * 5) * 14 * dt;
      }
    }
    // уточки
    const pond = world.pondRef;
    if (pond) {
      for (const du of world.ducks) {
        du.a += du.speed * dt;
        du.x = pond.cx + Math.cos(du.a) * du.r;
        du.y = pond.cy + Math.sin(du.a) * du.r * 0.82;
      }
    }
    // собака
    const dog = world.dog;
    if (dog) {
      const dx = dog.tx - dog.x, dy = dog.ty - dog.y;
      const d = Math.hypot(dx, dy);
      if (dog.pause > 0) {
        dog.pause -= dt;
      } else if (d < 12) {
        dog.pause = 0.8 + rnd() * 1.6;
        dog.tx = dog.area.x + rnd() * dog.area.w;
        dog.ty = dog.area.y + rnd() * dog.area.h;
      } else {
        const desired = Math.atan2(dy, dx);
        let diff = desired - dog.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        dog.angle += Math.max(-5 * dt, Math.min(5 * dt, diff));
        dog.x += Math.cos(dog.angle) * dog.speed * dt;
        dog.y += Math.sin(dog.angle) * dog.speed * dt;
      }
    }
    // птицы
    for (const b of world.birds) {
      b.x += b.vx * dt;
      b.y += b.vy * dt + Math.sin(t * 2 + b.phase) * 12 * dt;
      if (b.x > world.W + 200) { b.x = -200; b.y = rnd() * world.H; }
      if (b.x < -200) { b.x = world.W + 200; b.y = rnd() * world.H; }
    }
    // облака
    for (const c of world.clouds) {
      c.x += c.vx * dt;
      if (c.x > world.W + 400) c.x = -400;
    }
  }

  // ── частицы ────────────────────────────────────────────────────────────────
  function updateParticles(dt: number) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      p.vx *= Math.pow(0.3, dt);
      p.rot += p.vr * dt;
    }
    if (particles.length > 500) particles.splice(0, particles.length - 500);
  }

  // ── сигнал: кольца звука + реакция жителей ─────────────────────────────────
  function updateHorn(dt: number) {
    hornResponseT -= dt;
    if (!hornOn) return;
    hornRingT -= dt;
    if (hornRingT <= 0) {
      hornRingT = 0.16;
      const fx = player.x + Math.cos(player.angle) * 52;
      const fy = player.y + Math.sin(player.angle) * 52;
      spawnParticle({
        kind: 'ring', x: fx, y: fy, vx: Math.cos(player.angle) * 40, vy: Math.sin(player.angle) * 40,
        life: 0.55, maxLife: 0.55, size: 10, color: 'rgba(190,240,255,0.95)', rot: 0, vr: 0, grav: 0, grow: 3.4,
      });
    }
  }

  function hornKick() {
    // машинки рядом отвечают, пешеходы машут
    if (hornResponseT > 0) return;
    hornResponseT = 1.1;
    let nearest: CarState | null = null;
    let nd = 340;
    for (const c of cars) {
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if (d < nd) { nd = d; nearest = c; }
    }
    if (nearest && rnd() > 0.35) {
      window.setTimeout(() => { if (running) audio.honk(0.7 + rnd() * 0.7); }, 220);
    }
    for (const ped of world.peds) {
      if (Math.hypot(ped.x - player.x, ped.y - player.y) < 280) ped.waveT = Math.max(ped.waveT, 1.4);
    }
  }

  // ── тап по карте: интерактив для малыша ────────────────────────────────────
  function onCanvasTap(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const wx = view.camX + (sx - view.vw / 2) / view.zoom;
    const wy = view.camY + (sy - view.vh / 2) / view.zoom;

    // машинка?
    for (const c of cars) {
      if (Math.hypot(c.x - wx, c.y - wy) < 55) {
        audio.honk(0.6 + rnd() * 0.8);
        c.hitCool = Math.max(c.hitCool, 0.2);
        if (c.state === 'parked') { c.state = 'fly'; c.vx = (rnd() - 0.5) * 120; c.vy = -80; c.spin = 3; }
        spawnParticle({
          kind: 'ring', x: c.x, y: c.y, vx: 0, vy: 0, life: 0.4, maxLife: 0.4,
          size: 18, color: 'rgba(255,255,255,0.9)', rot: 0, vr: 0, grav: 0, grow: 2.4,
        });
        return;
      }
    }
    // пруд или уточка?
    const pond = world.pondRef;
    if (pond && Math.hypot((wx - pond.cx) / pond.rx, (wy - pond.cy) / pond.ry) < 1) {
      audio.quack();
      spawnParticle({
        kind: 'ring', x: wx, y: wy, vx: 0, vy: 0, life: 0.8, maxLife: 0.8,
        size: 12, color: 'rgba(255,255,255,0.85)', rot: 0, vr: 0, grav: 0, grow: 4,
      });
      for (let i = 0; i < 4; i++) {
        spawnParticle({
          kind: 'drop', x: wx, y: wy, vx: (rnd() - 0.5) * 120, vy: -60 - rnd() * 80,
          life: 0.5, maxLife: 0.5, size: 4.5, color: 'rgba(220,245,255,0.9)', rot: 0, vr: 0, grav: 320, grow: 0,
        });
      }
      return;
    }
    // дерево?
    for (const tr of world.trees) {
      if (Math.hypot(tr.x - wx, (tr.y - 14 * tr.s) - wy) < 42 * tr.s) {
        audio.rustle();
        for (let i = 0; i < 7; i++) {
          spawnParticle({
            kind: 'leaf', x: tr.x + (rnd() - 0.5) * 30, y: tr.y - 16 + (rnd() - 0.5) * 20,
            vx: (rnd() - 0.5) * 40, vy: 20 + rnd() * 30, life: 1 + rnd() * 0.6, maxLife: 1.4,
            size: 4 + rnd() * 3.5, color: rnd() > 0.5 ? '#4cb35c' : '#3f9e4d',
            rot: rnd() * 6, vr: (rnd() - 0.5) * 8, grav: 26, grow: 0,
          });
        }
        return;
      }
    }
    // собака?
    if (world.dog && Math.hypot(world.dog.x - wx, world.dog.y - wy) < 46) {
      audio.bark();
      world.dog.pause = 0.4;
      world.dog.tx = world.dog.area.x + rnd() * world.dog.area.w;
      world.dog.ty = world.dog.area.y + rnd() * world.dog.area.h;
      return;
    }
    // просто искорка
    audio.pop();
    sparkle(wx, wy);
    sparkle(wx + 14, wy - 8);
  }
  canvas.addEventListener('pointerdown', onCanvasTap);

  // ── главный цикл ───────────────────────────────────────────────────────────
  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    nightT += (nightTarget - nightT) * Math.min(1, dt * 2.2);
    shake = Math.max(0, shake - dt * 14);

    updatePlayer(dt);
    for (const c of cars) updateCar(c, dt);
    collideAll(dt);
    updateStars(dt);
    updateCritters(dt);
    updateParticles(dt);
    updateHorn(dt);

    // камера с упреждением по направлению движения
    const lookX = player.x + Math.cos(player.angle) * 70;
    const lookY = player.y + Math.sin(player.angle) * 70;
    view.camX += (lookX - view.camX) * Math.min(1, dt * 4);
    view.camY += (lookY - view.camY) * Math.min(1, dt * 4);
    const mX = view.vw / 2 / view.zoom - 160;
    const mY = view.vh / 2 / view.zoom - 160;
    view.camX = Math.max(mX, Math.min(world.W - mX, view.camX));
    view.camY = Math.max(mY, Math.min(world.H - mY, view.camY));

    const shx = (rnd() - 0.5) * shake;
    const shy = (rnd() - 0.5) * shake;

    const scene: Scene = {
      world, view: { ...view, camX: view.camX + shx, camY: view.camY + shy },
      t, nightT, player, cars, particles,
    };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.vw, view.vh);
    renderFrame(ctx, scene);

    if (nightT > 0.01) {
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderLighting(lctx, scene, player.siren);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(lightCanvas, 0, 0);
    }

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  const input = { left: false, right: false };

  return {
    input,
    startAudio() {
      audio.ensure();
      audio.engineStart();
    },
    setHorn(on: boolean) {
      if (on === hornOn) return;
      hornOn = on;
      if (on) { audio.hornStart(); hornKick(); hornRingT = 0; }
      else audio.hornStop();
    },
    toggleSiren() {
      player.siren = !player.siren;
      audio.setSiren(player.siren);
      return player.siren;
    },
    toggleLights() {
      player.lights = !player.lights;
      return player.lights;
    },
    toggleNight() {
      nightTarget = nightTarget > 0.5 ? 0 : 1;
      return nightTarget > 0.5;
    },
    setMusic(on: boolean) { audio.setMusic(on); },
    setSound(on: boolean) { audio.setMuted(!on); },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onCanvasTap);
      audio.setSiren(false);
      audio.setMusic(false);
      audio.hornStop();
    },
  };
}
