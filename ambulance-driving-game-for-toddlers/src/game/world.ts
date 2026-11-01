// ─── Генерация большого мультяшного города ─────────────────────────────────

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rect { x: number; y: number; w: number; h: number }

export interface House extends Rect { color: number; door: 'l' | 'r'; flip: boolean; trees: { dx: number; dy: number; s: number }[] }
export interface BigB extends Rect { color: number; name: number }
export interface Hospital extends Rect { pad: { x: number; y: number; r: number } }
export interface School extends Rect { flagX: number; flagY: number }
export interface FireSt extends Rect { towerX: number; towerY: number }
export interface Shops extends Rect { awnings: { x: number; y: number; w: number; c: number }[] }
export interface Park extends Rect { paths: Rect[]; trees: { x: number; y: number; s: number }[]; benches: { x: number; y: number; a: number }[]; flowers: { x: number; y: number; c: number }[]; fountain: { x: number; y: number; r: number } | null; blanket: { x: number; y: number; c: number } | null }
export interface Pond extends Rect { cx: number; cy: number; rx: number; ry: number; reeds: { a: number }[]; lilies: { x: number; y: number }[] }
export interface Playground extends Rect { slideX: number; slideY: number; swingX: number; swingY: number; seesawX: number; seesawY: number; sandX: number; sandY: number }
export interface Parking extends Rect { spots: { x: number; y: number; a: number; taken: boolean }[] }
export interface Constr extends Rect { piles: { x: number; y: number; r: number }[]; cones: { x: number; y: number }[]; crane: { x: number; y: number; a: number } }

export type BlockKind = 'houses' | 'big' | 'hospital' | 'school' | 'fire' | 'shops' | 'park' | 'pond' | 'playground' | 'parking' | 'constr';

export interface Block extends Rect {
  kind: BlockKind;
  houses?: House[]; big?: BigB; hospital?: Hospital; school?: School; fire?: FireSt;
  shops?: Shops; park?: Park; pond?: Pond; playground?: Playground; parking?: Parking; constr?: Constr;
}

export interface Tree { x: number; y: number; s: number; v: number; apple: boolean }
export interface FlowerPatch { x: number; y: number; c: number }
export interface Lamp { x: number; y: number }
export interface TLight { x: number; y: number }
export interface Zebra { x: number; y: number } // центр перекрёстка
export interface GrassPatch { x: number; y: number; rx: number; ry: number; c: number }
export interface StarPick { x: number; y: number; taken: boolean; respawn: number; phase: number }
export interface Ped { x: number; y: number; blockIdx: number; segT: number; speed: number; color: number; waveT: number; flip: boolean }
export interface Butterfly { x: number; y: number; tx: number; ty: number; phase: number; color: number; area: Rect }
export interface Duck { a: number; r: number; speed: number; size: number; x: number; y: number }
export interface Cloud { x: number; y: number; vx: number; s: number; blobs: { dx: number; dy: number; r: number }[] }
export interface Bird { x: number; y: number; vx: number; vy: number; phase: number }
export interface Dog { x: number; y: number; tx: number; ty: number; angle: number; speed: number; area: Rect; pause: number }
export interface Roundabout { cx: number; cy: number; rOut: number; rIn: number }
export interface Solid { x: number; y: number; w: number; h: number }

export interface World {
  W: number; H: number;
  roadV: number[]; roadH: number[]; roadW: number;
  roundabout: Roundabout;
  blocks: Block[];
  solids: Solid[];
  grass: GrassPatch[];
  trees: Tree[];
  flowers: FlowerPatch[];
  lamps: Lamp[];
  tlights: TLight[];
  zebras: Zebra[];
  stars: StarPick[];
  peds: Ped[];
  butterflies: Butterfly[];
  ducks: Duck[];
  clouds: Cloud[];
  birds: Bird[];
  dog: Dog | null;
  pondRef: Pond | null;
  parkingSpots: { x: number; y: number; a: number; taken: boolean }[];
}

const PASTEL = ['#f6b6c9', '#ffd29d', '#b7e3ff', '#c9f2c7', '#e6d1ff', '#ffe9a8', '#ffc4a3', '#a8e6e3'];
const FLOWER_C = ['#ff6b9d', '#ffd93d', '#ff8c42', '#c56cf0', '#ff5d8f', '#fff3f0'];

export function generateWorld(seed = 20240601): World {
  const rnd = mulberry32(seed);
  const W = 3600;
  const H = 3600;
  const roadW = 120;
  const roadV = [300, 900, 1500, 2100, 2700, 3300];
  const roadH = [300, 900, 1500, 2100, 2700, 3300];

  const roundabout: Roundabout = { cx: 2100, cy: 1500, rOut: 178, rIn: 74 };

  // ── Блоки 5×5 между дорогами ──────────────────────────────────────────────
  const blocks: Block[] = [];
  const kinds: BlockKind[] = [];
  const specials: BlockKind[] = ['hospital', 'fire', 'school', 'pond', 'playground', 'constr', 'shops', 'shops', 'parking', 'parking', 'park', 'park', 'park', 'big', 'big', 'big', 'houses', 'houses', 'houses', 'houses', 'houses', 'houses', 'houses', 'houses', 'houses'];
  // перемешать
  for (let i = specials.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [specials[i], specials[j]] = [specials[j], specials[i]];
  }
  let si = 0;
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < 5; i++) {
      const x = roadV[i] + roadW / 2;
      const y = roadH[j] + roadW / 2;
      kinds.push(specials[si++]);
      blocks.push({ x, y, w: 480, h: 480, kind: kinds[kinds.length - 1] });
    }
  }

  const solids: Solid[] = [];
  const parkingSpots: Parking['spots'] = [];
  let pondRef: Pond | null = null;
  let dog: Dog | null = null;
  const butterflies: Butterfly[] = [];
  const duckDefs: Duck[] = [];

  for (const b of blocks) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    switch (b.kind) {
      case 'houses': {
        const hs: House[] = [];
        for (let q = 0; q < 4; q++) {
          const hx = b.x + 52 + (q % 2) * 200;
          const hy = b.y + 58 + Math.floor(q / 2) * 200;
          hs.push({
            x: hx, y: hy, w: 150, h: 110,
            color: Math.floor(rnd() * PASTEL.length),
            door: rnd() > 0.5 ? 'l' : 'r',
            flip: rnd() > 0.5,
            trees: rnd() > 0.4 ? [{ dx: hx + 170, dy: hy + 40 + rnd() * 40, s: 0.7 + rnd() * 0.4 }] : [],
          });
          solids.push({ x: hx, y: hy, w: 150, h: 110 });
        }
        b.houses = hs;
        break;
      }
      case 'big': {
        const bw = 300, bh = 230;
        const bx = cx - bw / 2, by = cy - bh / 2;
        b.big = { x: bx, y: by, w: bw, h: bh, color: Math.floor(rnd() * PASTEL.length), name: Math.floor(rnd() * 3) };
        solids.push({ x: bx, y: by, w: bw, h: bh });
        break;
      }
      case 'hospital': {
        const bw = 300, bh = 180;
        const bx = cx - bw / 2, by = cy - 130;
        b.hospital = { x: bx, y: by, w: bw, h: bh, pad: { x: cx + 120, y: cy + 130, r: 55 } };
        solids.push({ x: bx, y: by, w: bw, h: bh });
        break;
      }
      case 'school': {
        const bw = 300, bh = 170;
        const bx = cx - bw / 2, by = cy - 110;
        b.school = { x: bx, y: by, w: bw, h: bh, flagX: bx + 26, flagY: by - 12 };
        solids.push({ x: bx, y: by, w: bw, h: bh });
        break;
      }
      case 'fire': {
        const bw = 310, bh = 180;
        const bx = cx - bw / 2, by = cy - 100;
        b.fire = { x: bx, y: by, w: bw, h: bh, towerX: bx + bw - 20, towerY: by - 40 };
        solids.push({ x: bx, y: by, w: bw, h: bh });
        break;
      }
      case 'shops': {
        const bw = 420, bh = 130;
        const bx = cx - bw / 2, by = cy - bh / 2;
        const awnings: Shops['awnings'] = [];
        for (let k = 0; k < 3; k++) {
          awnings.push({ x: bx + 18 + k * 132, y: by + bh - 6, w: 116, c: Math.floor(rnd() * PASTEL.length) });
        }
        b.shops = { x: bx, y: by, w: bw, h: bh, awnings };
        solids.push({ x: bx, y: by, w: bw, h: bh });
        break;
      }
      case 'park': {
        const paths: Rect[] = [
          { x: b.x, y: cy - 18, w: b.w, h: 36 },
          { x: cx - 18, y: b.y, w: 36, h: b.h },
        ];
        const trees: Park['trees'] = [];
        for (let k = 0; k < 8; k++) {
          const a = rnd() * Math.PI * 2;
          const r = 70 + rnd() * 140;
          trees.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, s: 0.8 + rnd() * 0.6 });
        }
        const benches: Park['benches'] = [
          { x: cx - 90, y: cy - 34, a: 0 }, { x: cx + 70, y: cy + 26, a: Math.PI },
          { x: cx - 26, y: cy + 70, a: Math.PI / 2 },
        ];
        const flowers: Park['flowers'] = [];
        for (let k = 0; k < 5; k++) {
          flowers.push({ x: b.x + 40 + rnd() * 400, y: b.y + 40 + rnd() * 400, c: Math.floor(rnd() * FLOWER_C.length) });
        }
        const hasFountain = !blocks.some(o => o.park?.fountain) && rnd() > 0.4;
        b.park = {
          x: b.x, y: b.y, w: b.w, h: b.h,
          paths, trees, benches, flowers,
          fountain: hasFountain ? { x: cx, y: cy, r: 44 } : null,
          blanket: rnd() > 0.4 ? { x: b.x + 60 + rnd() * 200, y: b.y + 60 + rnd() * 200, c: Math.floor(rnd() * 3) } : null,
        };
        if (hasFountain) solids.push({ x: cx - 40, y: cy - 40, w: 80, h: 80 });
        for (let k = 0; k < 3; k++) {
          butterflies.push({ x: cx, y: cy, tx: cx, ty: cy, phase: rnd() * 10, color: Math.floor(rnd() * FLOWER_C.length), area: { x: b.x, y: b.y, w: b.w, h: b.h } });
        }
        if (!dog && rnd() > 0.3) {
          dog = { x: cx, y: cy - 80, tx: cx + 60, ty: cy, angle: 0, speed: 130, area: { x: b.x + 20, y: b.y + 20, w: b.w - 40, h: b.h - 40 }, pause: 0 };
        }
        break;
      }
      case 'pond': {
        const pond: Pond = {
          x: b.x, y: b.y, w: b.w, h: b.h, cx, cy: cy + 10, rx: 185, ry: 155,
          reeds: [], lilies: [],
        };
        for (let k = 0; k < 7; k++) pond.reeds.push({ a: rnd() * Math.PI * 2 });
        for (let k = 0; k < 4; k++) {
          pond.lilies.push({ x: cx + (rnd() - 0.5) * 260, y: cy + 10 + (rnd() - 0.5) * 210 });
        }
        b.pond = pond;
        pondRef = pond;
        for (let k = 0; k < 3; k++) {
          duckDefs.push({ a: rnd() * Math.PI * 2, r: 40 + rnd() * 90, speed: (0.15 + rnd() * 0.15) * (rnd() > 0.5 ? 1 : -1), size: 0.8 + rnd() * 0.4, x: cx, y: cy });
        }
        butterflies.push({ x: cx, y: cy, tx: cx, ty: cy, phase: rnd() * 10, color: Math.floor(rnd() * FLOWER_C.length), area: { x: b.x, y: b.y, w: b.w, h: b.h } });
        break;
      }
      case 'playground': {
        b.playground = {
          x: b.x, y: b.y, w: b.w, h: b.h,
          slideX: cx - 130, slideY: cy - 60,
          swingX: cx + 80, swingY: cy - 80,
          seesawX: cx - 60, seesawY: cy + 110,
          sandX: cx + 90, sandY: cy + 90,
        };
        break;
      }
      case 'parking': {
        const spots: Parking['spots'] = [];
        for (let row = 0; row < 2; row++) {
          for (let k = 0; k < 6; k++) {
            const taken = rnd() > 0.35;
            spots.push({ x: b.x + 55 + k * 74, y: b.y + 80 + row * 300, a: row === 0 ? Math.PI / 2 : -Math.PI / 2, taken });
          }
        }
        b.parking = { x: b.x + 14, y: b.y + 14, w: b.w - 28, h: b.h - 28, spots };
        for (const s of spots) if (s.taken) parkingSpots.push(s);
        break;
      }
      case 'constr': {
        b.constr = {
          x: b.x, y: b.y, w: b.w, h: b.h,
          piles: [
            { x: cx - 120, y: cy - 60, r: 34 }, { x: cx + 40, y: cy + 80, r: 42 }, { x: cx + 140, y: cy - 90, r: 26 },
          ],
          cones: [
            { x: b.x + 20, y: cy }, { x: b.x + b.w - 20, y: cy - 80 }, { x: cx, y: b.y + 20 },
            { x: cx - 60, y: b.y + b.h - 20 }, { x: b.x + b.w - 30, y: b.y + 40 },
          ],
          crane: { x: cx + 60, y: cy - 20, a: rnd() * Math.PI },
        };
        solids.push({ x: cx + 40, y: cy - 40, w: 44, h: 44 });
        break;
      }
    }
  }

  // ── Трава с пятнами ───────────────────────────────────────────────────────
  const grass: GrassPatch[] = [];
  for (let k = 0; k < 70; k++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const nearRoad = roadV.some(rx => Math.abs(x - rx) < roadW / 2 + 10) || roadH.some(ry => Math.abs(y - ry) < roadW / 2 + 10);
    if (nearRoad) continue;
    grass.push({ x, y, rx: 30 + rnd() * 90, ry: 24 + rnd() * 70, c: rnd() > 0.5 ? 1 : 0 });
  }

  // ── Деревья вдоль дорог и по границе ──────────────────────────────────────
  const trees: Tree[] = [];
  const isIntersection = (x: number, y: number) =>
    roadV.some(rx => Math.abs(x - rx) < 100) && roadH.some(ry => Math.abs(y - ry) < 100);
  for (const rx of roadV) {
    for (let y = 90; y < H; y += 190) {
      for (const side of [-1, 1]) {
        if (rnd() > 0.55) continue;
        const tx = rx + side * (roadW / 2 + 42);
        const ty = y + rnd() * 60;
        if (isIntersection(tx, ty)) continue;
        trees.push({ x: tx, y: ty, s: 0.75 + rnd() * 0.5, v: Math.floor(rnd() * 3), apple: rnd() > 0.85 });
      }
    }
  }
  for (const ry of roadH) {
    for (let x = 90; x < W; x += 190) {
      for (const side of [-1, 1]) {
        if (rnd() > 0.55) continue;
        const tx = x + rnd() * 60;
        const ty = ry + side * (roadW / 2 + 42);
        if (isIntersection(tx, ty)) continue;
        trees.push({ x: tx, y: ty, s: 0.75 + rnd() * 0.5, v: Math.floor(rnd() * 3), apple: rnd() > 0.85 });
      }
    }
  }
  // лесная граница по краям
  for (let t = 40; t < W; t += 95) {
    trees.push({ x: t + rnd() * 40, y: 60 + rnd() * 90, s: 0.9 + rnd() * 0.7, v: Math.floor(rnd() * 3), apple: false });
    trees.push({ x: t + rnd() * 40, y: H - 60 - rnd() * 90, s: 0.9 + rnd() * 0.7, v: Math.floor(rnd() * 3), apple: false });
    trees.push({ x: 60 + rnd() * 90, y: t + rnd() * 40, s: 0.9 + rnd() * 0.7, v: Math.floor(rnd() * 3), apple: false });
    trees.push({ x: W - 60 - rnd() * 90, y: t + rnd() * 40, s: 0.9 + rnd() * 0.7, v: Math.floor(rnd() * 3), apple: false });
  }

  // ── Цветочные поляны ──────────────────────────────────────────────────────
  const flowers: FlowerPatch[] = [];
  for (let k = 0; k < 46; k++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const nearRoad = roadV.some(rx => Math.abs(x - rx) < roadW / 2 + 24) || roadH.some(ry => Math.abs(y - ry) < roadW / 2 + 24);
    if (nearRoad) continue;
    flowers.push({ x, y, c: Math.floor(rnd() * FLOWER_C.length) });
  }

  // ── Фонари ────────────────────────────────────────────────────────────────
  const lamps: Lamp[] = [];
  for (const rx of roadV) {
    for (let y = 150; y < H; y += 260) {
      if (roadH.some(ry => Math.abs(y - ry) < 110)) continue;
      lamps.push({ x: rx + roadW / 2 + 16, y });
      lamps.push({ x: rx - roadW / 2 - 16, y: y + 130 });
    }
  }
  for (const ry of roadH) {
    for (let x = 150; x < W; x += 260) {
      if (roadV.some(rx => Math.abs(x - rx) < 110)) continue;
      lamps.push({ x, y: ry + roadW / 2 + 16 });
      lamps.push({ x: x + 130, y: ry - roadW / 2 - 16 });
    }
  }

  // ── Светофоры и зебры ─────────────────────────────────────────────────────
  const tlights: TLight[] = [];
  const zebras: Zebra[] = [];
  const chosenI = new Set<number>();
  while (chosenI.size < 9) {
    chosenI.add(Math.floor(rnd() * 16));
  }
  let ci = 0;
  for (let j = 1; j < 5; j++) {
    for (let i = 1; i < 5; i++) {
      if (Math.abs(roadV[i] - roundabout.cx) < 2 && Math.abs(roadH[j] - roundabout.cy) < 2) { ci++; continue; }
      if (chosenI.has(ci)) {
        tlights.push({ x: roadV[i], y: roadH[j] });
        zebras.push({ x: roadV[i], y: roadH[j] });
      }
      ci++;
    }
  }

  // ── Звёздочки для сбора ───────────────────────────────────────────────────
  const stars: StarPick[] = [];
  let guard = 0;
  while (stars.length < 26 && guard++ < 900) {
    const onV = rnd() > 0.5;
    let x: number, y: number;
    if (onV) {
      x = roadV[Math.floor(rnd() * roadV.length)] + (rnd() - 0.5) * 70;
      y = 120 + rnd() * (H - 240);
    } else {
      x = 120 + rnd() * (W - 240);
      y = roadH[Math.floor(rnd() * roadH.length)] + (rnd() - 0.5) * 70;
    }
    if (stars.some(s => Math.hypot(s.x - x, s.y - y) < 240)) continue;
    stars.push({ x, y, taken: false, respawn: 0, phase: rnd() * 10 });
  }

  // ── Пешеходы ──────────────────────────────────────────────────────────────
  const peds: Ped[] = [];
  const walkBlocks = blocks.filter(bl => bl.kind !== 'constr' && bl.kind !== 'parking').slice(0, 14);
  for (let k = 0; k < 12; k++) {
    const bi = blocks.indexOf(walkBlocks[k % walkBlocks.length]);
    peds.push({
      x: 0, y: 0, blockIdx: bi, segT: rnd(), speed: 34 + rnd() * 22,
      color: Math.floor(rnd() * PASTEL.length), waveT: 0, flip: rnd() > 0.5,
    });
  }

  // ── Облака и птицы ────────────────────────────────────────────────────────
  const clouds: Cloud[] = [];
  for (let k = 0; k < 7; k++) {
    const blobs: Cloud['blobs'] = [];
    const n = 3 + Math.floor(rnd() * 3);
    for (let m = 0; m < n; m++) blobs.push({ dx: m * 46 - n * 20, dy: (rnd() - 0.5) * 22, r: 26 + rnd() * 20 });
    clouds.push({ x: rnd() * W, y: rnd() * H, vx: 8 + rnd() * 10, s: 0.9 + rnd() * 0.8, blobs });
  }
  const birds: Bird[] = [];
  for (let k = 0; k < 3; k++) {
    birds.push({ x: rnd() * W, y: rnd() * H, vx: 40 + rnd() * 30, vy: (rnd() - 0.5) * 20, phase: rnd() * 10 });
  }

  return {
    W, H, roadV, roadH, roadW, roundabout, blocks, solids, grass, trees, flowers,
    lamps, tlights, zebras, stars, peds, butterflies, ducks: duckDefs, clouds, birds,
    dog, pondRef, parkingSpots,
  };
}

export function randomStarPos(world: World, rnd: Rng): { x: number; y: number } {
  for (let tries = 0; tries < 200; tries++) {
    const onV = rnd() > 0.5;
    let x: number, y: number;
    if (onV) {
      x = world.roadV[Math.floor(rnd() * world.roadV.length)] + (rnd() - 0.5) * 80;
      y = 120 + rnd() * (world.H - 240);
    } else {
      x = 120 + rnd() * (world.W - 240);
      y = world.roadH[Math.floor(rnd() * world.roadH.length)] + (rnd() - 0.5) * 80;
    }
    if (!world.stars.some(s => !s.taken && Math.hypot(s.x - x, s.y - y) < 200)) return { x, y };
  }
  return { x: 900, y: 860 };
}

export { PASTEL, FLOWER_C };
