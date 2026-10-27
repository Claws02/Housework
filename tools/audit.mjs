// Layout & dimension audit for the 191 Webster preset (or any saved layout JSON).
//   node tools/audit.mjs                 → audits the built-in preset
//   node tools/audit.mjs my-house.json   → audits a file saved with 💾
// Checks, per floor:
//   1. catalog sizes against real-world standards
//   2. furniture overlapping other furniture (3D: footprints and height ranges)
//   3. furniture cutting into walls
//   4. anything standing in a doorway / passage (clear zone each side of every door & opening)
//   5. tall furniture in front of windows
//   6. doors & windows that don't sit on a wall, or that overlap each other
//   7. items outside every room (lost in the yard / between rooms)
import { readFileSync } from 'node:fs';
import { CATALOG_BY_TYPE as CAT } from '../furniture.js';
import { buildHouse191 } from '../house191.js';

const file = process.argv[2];
const house = file ? JSON.parse(readFileSync(file, 'utf8')) : buildHouse191();
const ft = v => { const i = Math.round(v * 12); return `${Math.floor(i / 12)}'${i % 12}"`; };
const issues = [];
const report = (sev, floor, msg) => issues.push({ sev, floor, msg });

// ── 1. Catalog vs real-world sizes (inches: w, d, h with tolerance) ─────────
const STD = {
  fridge: [[30, 36], [28, 36], [66, 72]], stove: [[30, 30], [25, 29], [35, 38]], dishwasher: [[24, 24], [23, 26], [33, 35]],
  counter: [[9, 48], [24, 26], [35.5, 36.5]], 'sink-cab': [[30, 48], [24, 26], [35.5, 36.5]], 'upper-cab': [[9, 42], [12, 14], [30, 42]],
  'kitchen-island': [[48, 96], [36, 54], [35.5, 36.5]], 'bar-stool': [[15, 20], [15, 20], [34, 42]],
  'bed-twin': [[39, 44], [75, 84], [14, 60]], 'bed-full': [[54, 60], [75, 84], [14, 60]], 'bed-queen': [[60, 66], [80, 88], [14, 60]],
  'bed-king': [[76, 82], [80, 88], [14, 60]], toilet: [[14, 20], [27, 31], [28, 32]], bathtub: [[60, 60], [30, 32], [14, 22]],
  vanity: [[24, 48], [18, 22], [32, 36]], 'dining-chair': [[16, 22], [18, 22], [34, 42]], 'dining-6': [[60, 78], [36, 42], [29, 31]],
  'sofa-3': [[72, 96], [34, 40], [30, 38]], recliner: [[32, 42], [36, 42], [38, 42]], 'coffee-table': [[36, 60], [20, 30], [16, 20]],
  'door-single': [[30, 36], [0, 12], [80, 84]], 'door-ext': [[36, 38], [0, 12], [80, 84]], washer: [[27, 28], [28, 34], [36, 40]],
  dresser: [[36, 72], [16, 22], [30, 40]], nightstand: [[18, 28], [14, 20], [22, 30]],
};
for (const [type, [W, D, H]] of Object.entries(STD)) {
  const c = CAT[type]; if (!c) continue;
  const chk = (v, [a, b], name) => { const i = v * 12; if (i < a - 0.5 || i > b + 0.5) report('size', '-', `${c.label}: ${name} ${i.toFixed(1)}" outside the usual ${a}–${b}"`); };
  chk(c.width, W, 'width'); chk(c.depth, D, 'depth'); chk(c.height3d, H, 'height');
}

// ── Geometry helpers ─────────────────────────────────────────────────────────
const corners = it => {
  const c = Math.cos(it.rotation), s = Math.sin(it.rotation), hw = it.width / 2, hd = it.depth / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => [it.x + x * c - y * s, it.y + x * s + y * c]);
};
// separating-axis test on two convex polygons; returns penetration depth (0 = no overlap)
function overlap(A, B) {
  let best = Infinity;
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length];
    let nx = y1 - y2, ny = x2 - x1; const l = Math.hypot(nx, ny); nx /= l; ny /= l;
    const pa = A.map(([x, y]) => x * nx + y * ny), pb = B.map(([x, y]) => x * nx + y * ny);
    const o = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
    if (o <= 0) return 0;
    best = Math.min(best, o);
  }
  return best;
}
const wallPoly = w => {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L = Math.hypot(dx, dy), t = (w.thick ?? 0.4) / 2;
  const nx = -dy / L * t, ny = dx / L * t;
  return [[w.x1 + nx, w.y1 + ny], [w.x2 + nx, w.y2 + ny], [w.x2 - nx, w.y2 - ny], [w.x1 - nx, w.y1 - ny]];
};
const roomAt = (f, x, y) => f.rooms.filter(r => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height).sort((a, b) => a.width * a.height - b.width * b.height)[0];
const groundFloorIdx = house.site?.groundFloor ?? 0;
const surf = (f, it) => {
  const r = roomAt(f, it.x, it.y);
  if (r) return r.offset || 0;
  return house.floors[groundFloorIdx] === f ? (house.site?.ground ?? 0) - f.elev : 0;   // out in the yard
};
// vertical range of an item relative to the floor level
function vrange(f, it) {
  const c = CAT[it.type] || {}, h = it.height ?? c.height3d ?? 2.5;
  if (c.mount === 'ceiling') return [f.height - h, f.height];
  const lift = it.lift ?? c.lift ?? 0;
  const y0 = c.opening ? lift : (lift < -0.5 ? lift : surf(f, it) + lift);
  return [y0, y0 + h];
}
const IGNORE = new Set(['rug', 'joists', 'recessed', 'ceilingLight', 'stairOpening', 'tree', 'pine']);
const SEATS = new Set(['diningChair', 'barStool', 'officeChair', 'patioChair']);
const TABLES = new Set(['diningTable', 'island', 'builtinDesk', 'desk', 'antiqueDesk', 'lDesk', 'patioTable', 'fireTable', 'baseCab', 'sideboard']);
const PLANTS = new Set(['shrub', 'hosta', 'boulder', 'planter', 'plant', 'tree', 'pine']);
const FABRIC = new Set(['curtains', 'romanShade']);
/** Footprint(s): the L-sectional is two rectangles, not its bounding box. */
function polys(it) {
  if (CAT[it.type]?.model !== 'sectional') return [corners(it)];
  const sd = Math.min(it.seatDepth ?? 3.17, it.depth, it.width), c = Math.cos(it.rotation), s = Math.sin(it.rotation);
  const tr = ([x, y]) => [it.x + x * c - y * s, it.y + x * s + y * c];
  const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(tr);
  const W = it.width / 2, D = it.depth / 2;
  return [rect(-W, W, -D, -D + sd), rect(-W, -W + sd, -D, D)];
}
const polyOverlap = (A, B) => Math.max(0, ...polys(A).flatMap(a => polys(B).map(b => overlap(a, b))));
const isDecorOn = (a, b, f) => { const [a0] = vrange(f, a), [, b1] = vrange(f, b); return a0 >= b1 - 0.15; };   // a sits on top of b

house.floors.forEach(f => {
  const name = f.name, items = f.furniture;
  const allWalls = [...f.walls];
  const openings = items.filter(it => CAT[it.type]?.opening);
  const solid = items.filter(it => { const c = CAT[it.type]; return c && !c.opening && !IGNORE.has(c.model) && c.layer !== 0; });

  // 2. furniture ↔ furniture
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
    const a = solid[i], b = solid[j], ma = CAT[a.type].model, mb = CAT[b.type].model;
    if ((PLANTS.has(ma) && PLANTS.has(mb)) || FABRIC.has(ma) || FABRIC.has(mb)) continue;     // plantings mingle; fabric drapes
    const pen = polyOverlap(a, b);
    if (pen < 0.06) continue;
    const [a0, a1] = vrange(f, a), [b0, b1] = vrange(f, b);
    if (a1 <= b0 + 0.05 || b1 <= a0 + 0.05) continue;                                   // stacked / under
    if (isDecorOn(a, b, f) || isDecorOn(b, a, f)) continue;
    if ((SEATS.has(ma) && TABLES.has(mb)) || (SEATS.has(mb) && TABLES.has(ma))) { if (pen < 1.2) continue; }   // tucked in under an overhang
    if (ma === 'tv' || mb === 'tv') continue;                                            // wall-mounted over a console / fireplace
    if (['stairs', 'stairsDown'].includes(ma) && ['stairs', 'stairsDown'].includes(mb)) continue;   // flights stack
    report('overlap', name, `${a.label} ↔ ${b.label}: overlap ${ft(pen)} (at ${a.x.toFixed(1)},${a.y.toFixed(1)} / ${b.x.toFixed(1)},${b.y.toFixed(1)})`);
  }

  // 3. furniture ↔ walls
  for (const it of solid) {
    const m = CAT[it.type].model;
    if (PLANTS.has(m) && !roomAt(f, it.x, it.y)) continue;                                  // foundation plantings
    if (['chimney', 'bulkhead', 'shed', 'fence', 'steps', 'post', 'car', 'stairs', 'stairsDown', 'mirror', 'wallArt', 'elecPanel', 'curtains', 'romanShade', 'halfWall'].includes(m)) continue;
    const [y0, y1] = vrange(f, it);
    for (const w of allWalls) {
      const base = w.base || 0, top = base + (w.height ?? f.height);
      if (y1 <= base || y0 >= top) continue;
      const pen = overlap(corners(it), wallPoly(w));
      if (pen > 0.06) report('wall', name, `${it.label} cuts ${ft(pen)} into a wall (item at ${it.x.toFixed(1)},${it.y.toFixed(1)})`);
    }
  }

  // 4–6. openings
  for (const o of openings) {
    const c = CAT[o.type], m = c.model, [o0, o1] = vrange(f, o);
    const gable = (house.site?.roofs || []).some(rf => rf.axis !== 'y'
      ? (Math.abs(o.x - rf.x) < 0.8 || Math.abs(o.x - rf.x - rf.w) < 0.8) && o.y > rf.y && o.y < rf.y + rf.d
      : (Math.abs(o.y - rf.y) < 0.8 || Math.abs(o.y - rf.y - rf.d) < 0.8) && o.x > rf.x && o.x < rf.x + rf.w);
    const onWall = gable || allWalls.some(w => overlap(corners({ ...o, depth: 0.1 }), wallPoly(w)) > 0);
    if (!onWall) report('opening', name, `${o.label} at ${o.x.toFixed(1)},${o.y.toFixed(1)} isn't on a wall`);
    for (const p of openings) if (p !== o && p.id > o.id) {
      const [p0, p1] = vrange(f, p);
      if (overlap(corners(o), corners(p)) > 0.05 && o1 > p0 && p1 > o0) report('opening', name, `${o.label} overlaps ${p.label}`);
    }
    const isPassage = ['door', 'slider', 'opening', 'garageDoor'].includes(m);
    // clear zone: the opening's width, 2'6" out on both sides (36" for exterior/garage doors)
    // closet doors only need room to open (~1'), room doors a 2'6" path, garage doors 3'
    const reach = m === 'garageDoor' ? 3 : o.type === 'door-double' ? 1 : 2.5;
    const zone = corners({ ...o, width: Math.max(0.5, o.width - 0.3), depth: (isPassage ? reach * 2 : 0.9) + 0.5 });
    const faceZone = corners({ ...o, width: o.width + 0.4, depth: 1.0 });                  // the opening itself + casing
    for (const it of solid) {
      const [y0, y1] = vrange(f, it), im = CAT[it.type].model;
      if (FABRIC.has(im)) continue;
      const wallMounted = CAT[it.type].layer === 2 && (it.lift ?? CAT[it.type].lift ?? 0) > 2;
      if (isPassage) {
        if (wallMounted) { if (overlap(faceZone, corners(it)) > 0.1 && y0 < o1) report('door', name, `${it.label} hangs over the ${o.label} casing`); continue; }
        if (y0 > 6.5 || y1 < 0.3) continue;                                              // overhead / flat
        if (['stairs', 'stairsDown'].includes(im)) continue;
        if (['steps', 'post', 'lantern'].includes(im)) continue;                         // part of the entry
        const pen = overlap(zone, corners(it));
        if (pen > 0.1) report('door', name, `${it.label} blocks ${o.label} by ${ft(pen)} (door at ${o.x.toFixed(1)},${o.y.toFixed(1)})`);
      } else {                                                                            // window: tall things right in front
        if (y1 <= o0 + 0.1 || y0 >= o1 || ['tableLamp', 'plant', 'vaseFlowers', 'curtains'].includes(im)) continue;
        if (CAT[it.type].layer === 2) continue;
        const pen = overlap(zone, corners(it));
        if (pen > 0.15) report('window', name, `${it.label} (top ${ft(y1)}) stands in front of ${o.label} (sill ${ft(o0)})`);
      }
    }
  }

  // 7. items outside every room on indoor floors
  if (f.elev >= 0 || f.rooms.length) for (const it of items) {
    if (CAT[it.type]?.opening) continue;
    if (!roomAt(f, it.x, it.y) && !['tree', 'pine', 'shrub', 'hosta', 'boulder', 'fence', 'shed', 'firePit', 'mailbox', 'lampPost', 'chimney', 'bulkhead', 'steps', 'kayak', 'planter'].includes(CAT[it.type]?.model) && f.name !== '1st Floor')
      report('outside', name, `${it.label} at ${it.x.toFixed(1)},${it.y.toFixed(1)} isn't inside any room`);
  }
});

// ── Designer clearance guidelines (advice, not errors) ──────────────────────
// These are comfort guidelines; an older house (like 191 Webster's 28" kitchen aisle) can be
// tighter as built. Use them as targets when designing a new layout.
const GUIDE = { walk: 3.0, seatToTable: [1.33, 1.75], workAisle: 3.5, bedSide: 2.5, toiletFront: 2.0 };
const advice = [];
const advise = (floor, msg) => advice.push({ floor, msg });
const inPoly = (P, x, y) => { let s0 = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; const c = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1); if (c !== 0) { if (s0 === 0) s0 = Math.sign(c); else if (Math.sign(c) !== s0) return false; } } return true; };
function segDist(px, py, [x1, y1], [x2, y2]) { const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2)) : 0; return Math.hypot(px - x1 - t * dx, py - y1 - t * dy); }
function polyDist(A, B) {
  if (overlap(A, B) > 0) return 0;
  let d = Infinity;
  for (const [P, Q] of [[A, B], [B, A]]) for (const [x, y] of P) for (let i = 0; i < Q.length; i++) d = Math.min(d, segDist(x, y, Q[i], Q[(i + 1) % Q.length]));
  return d;
}
const itemsDist = (a, b) => Math.min(...polys(a).flatMap(pa => polys(b).map(pb => polyDist(pa, pb))));
const isFloorObstacle = (f, it) => {
  const c = CAT[it.type]; if (!c || c.opening || c.mount === 'ceiling' || c.layer === 0 || IGNORE.has(c.model) || FABRIC.has(c.model)) return false;
  if (c.layer === 2 && (it.lift ?? c.lift ?? 0) > 2) return false;     // wall-mounted / on a counter
  const [y0, y1] = vrange(f, it); return y1 > 0.3 && y0 < 5.5;
};

house.floors.forEach((f, fi) => {
  const name = f.name, items = f.furniture, walls = f.walls;
  const obstacles = items.filter(it => isFloorObstacle(f, it));
  const obstaclePolys = obstacles.flatMap(it => polys(it).map(P => ({ P, it })));
  const wallPolys = walls.map(wallPoly);
  // distance from a point to the nearest wall or floor-standing item (excluding `skip`)
  const blockedAt = (x, y, skip, also = []) => wallPolys.some(P => inPoly(P, x, y)) || obstaclePolys.some(o => o.it !== skip && !also.includes(o.it) && inPoly(o.P, x, y));
  const castClear = (x, y, ux, uy, skip, max = 3.5, also = []) => { for (let d = 0.05; d <= max; d += 0.05) if (blockedAt(x + ux * d, y + uy * d, skip, also)) return d; return max; };

  // seat ↔ coffee table / ottoman
  const seats = items.filter(it => ['sofa', 'sectional', 'armchair', 'recliner'].includes(CAT[it.type]?.model));
  for (const t of items.filter(it => ['coffeeTable', 'ottoman'].includes(CAT[it.type]?.model))) {
    if (!seats.length) continue;
    const g = Math.min(...seats.map(sa => itemsDist(sa, t)));
    if (g < GUIDE.seatToTable[0] || g > GUIDE.seatToTable[1] + 0.5) advise(name, `${t.label} is ${ft(g)} from the nearest seat (16–18" is comfortable)`);
  }
  // kitchen work aisle
  const work = items.filter(it => ['baseCab', 'sinkCab', 'range', 'dishwasher', 'fridge', 'pantry'].includes(CAT[it.type]?.model));
  for (const isl of items.filter(it => CAT[it.type]?.model === 'island')) {
    const g = Math.min(...work.map(w => itemsDist(isl, w)));
    if (g < GUIDE.workAisle) advise(name, `Kitchen work aisle is ${ft(g)} between the ${isl.label} and the counters (42" recommended, 36" minimum)`);
  }
  // beds: both long sides and the foot
  for (const b of items.filter(it => ['bed', 'bunk', 'crib'].includes(CAT[it.type]?.model))) {
    const c = Math.cos(b.rotation), sn = Math.sin(b.rotation), hw = b.width / 2, hd = b.depth / 2;
    const P = (lx, lz) => [b.x + lx * c - lz * sn, b.y + lx * sn + lz * c];
    const dir = (lx, lz) => [lx * c - lz * sn, lx * sn + lz * c];
    const sides = [['left side', P(-hw, hd * 0.35), dir(-1, 0)], ['right side', P(hw, hd * 0.35), dir(1, 0)], ['foot', P(0, hd), dir(0, 1)]];
    const benches = items.filter(it => CAT[it.type]?.model === 'bench');   // a bench at the foot is part of the bed set
    const free = sides.map(([lab, [x, y], [ux, uy]]) => [lab, castClear(x, y, ux, uy, b, 3.5, benches)]);
    for (const [lab, d] of free) if (d > 0.3 && d < GUIDE.bedSide) advise(name, `${b.label}: ${ft(d)} clear at the ${lab} (30" recommended)`);
  }
  // toilets: clear space in front
  for (const t of items.filter(it => CAT[it.type]?.model === 'toilet')) {
    const c = Math.cos(t.rotation), sn = Math.sin(t.rotation), [ux, uy] = [-sn * 1, c * 1];
    const d = castClear(t.x + ux * t.depth / 2, t.y + uy * t.depth / 2, ux, uy, t);
    if (d < GUIDE.toiletFront) advise(name, `${t.label}: ${ft(d)} clear in front (24" recommended, 21" code minimum)`);
  }

  // walkable paths: from the floor's entry to every door / opening, widest route available
  const indoor = f.rooms.filter(r => !r.outdoor);
  if (!indoor.length) return;
  const G = 0.2, X0 = Math.min(...indoor.map(r => r.x)) - 1, Y0 = Math.min(...indoor.map(r => r.y)) - 1;
  const NX = Math.ceil((Math.max(...indoor.map(r => r.x + r.width)) + 1 - X0) / G), NY = Math.ceil((Math.max(...indoor.map(r => r.y + r.height)) + 1 - Y0) / G);
  const idx = (i, j) => j * NX + i, cx = i => X0 + (i + 0.5) * G, cy = j => Y0 + (j + 0.5) * G;
  const passages = items.filter(it => ['door', 'slider', 'opening', 'garageDoor'].includes(CAT[it.type]?.model));
  const doorZone = new Uint8Array(NX * NY), free = new Uint8Array(NX * NY);
  const doorPolys = passages.map(o => corners({ ...o, width: Math.max(0.4, o.width - 0.2), depth: 1.6 }));
  const holes = items.filter(it => CAT[it.type]?.floorHole || ['stairs'].includes(CAT[it.type]?.model)).map(corners);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = cx(i), y = cy(j), k = idx(i, j);
    const inRoom = indoor.some(r => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
    const inDoor = doorPolys.some(P => inPoly(P, x, y));
    if (inDoor) doorZone[k] = 1;
    if ((inRoom || inDoor) && (inDoor || !wallPolys.some(P => inPoly(P, x, y))) && !obstaclePolys.some(o => inPoly(o.P, x, y)) && !holes.some(P => inPoly(P, x, y))) free[k] = 1;
  }
  // distance to the nearest blocked cell (two-pass chamfer); door openings count as wide enough
  const dist = new Float32Array(NX * NY);
  for (let k = 0; k < dist.length; k++) dist[k] = free[k] ? 1e6 : 0;
  const pass = (order) => { for (const [i, j] of order) { const k = idx(i, j); if (!dist[k]) continue;
    for (const [di, dj, w] of [[-1, 0, G], [0, -1, G], [-1, -1, G * 1.414], [1, -1, G * 1.414], [1, 0, G], [0, 1, G], [1, 1, G * 1.414], [-1, 1, G * 1.414]]) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= NX || jj >= NY) { dist[k] = Math.min(dist[k], w); continue; }
      dist[k] = Math.min(dist[k], dist[idx(ii, jj)] + w);
    } } };
  const fwd = [], bwd = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) fwd.push([i, j]);
  for (let n = fwd.length - 1; n >= 0; n--) bwd.push(fwd[n]);
  pass(fwd); pass(bwd); pass(fwd);
  // widest-path (maximin) search from the entry
  const width = new Float32Array(NX * NY).fill(-1);
  const cellOf = (x, y) => [Math.floor((x - X0) / G), Math.floor((y - Y0) / G)];
  const hubDoor = fi === groundFloorIdx ? passages.find(o => /front/i.test(o.label)) : null;
  let hubPt;
  if (hubDoor) hubPt = [hubDoor.x, hubDoor.y];
  else {   // stair landing: the end of the flight that meets this floor
    const st = house.floors.flatMap(F => F.furniture).find(it => CAT[it.type]?.model === (fi < groundFloorIdx ? 'stairsDown' : 'stairOpening'));
    if (!st) return;
    const c = Math.cos(st.rotation), sn = Math.sin(st.rotation), e = fi < groundFloorIdx ? st.depth / 2 + 0.6 : -st.depth / 2 - 0.6;
    hubPt = [st.x - sn * e, st.y + c * e];
  }
  const eff = k => doorZone[k] ? 99 : 2 * dist[k];
  const heap = [];   // simple bucket queue on width (descending)
  const push = (k, w) => { if (w > width[k]) { width[k] = w; heap.push([w, k]); } };
  const [hi, hj] = cellOf(...hubPt);
  for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const i = hi + di, j = hj + dj; if (i >= 0 && j >= 0 && i < NX && j < NY && free[idx(i, j)]) push(idx(i, j), eff(idx(i, j))); }
  while (heap.length) {
    let bi = 0; for (let n = 1; n < heap.length; n++) if (heap[n][0] > heap[bi][0]) bi = n;
    const [w, k] = heap[bi]; heap[bi] = heap[heap.length - 1]; heap.pop();
    if (w < width[k]) continue;
    const i = k % NX, j = (k / NX) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= NX || jj >= NY) continue; const kk = idx(ii, jj); if (free[kk]) push(kk, Math.min(w, eff(kk))); }
  }
  const sideName = (o, s) => { const c = Math.cos(o.rotation), sn = Math.sin(o.rotation); const r = roomAt(f, o.x - sn * s, o.y + c * s); return r ? r.name : 'outside'; };
  for (const o of passages) {
    if (o === hubDoor) continue;
    const P = doorPolys[passages.indexOf(o)];
    let best = -1;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = idx(i, j); if (doorZone[k] && inPoly(P, cx(i), cy(j))) best = Math.max(best, width[k]); }
    const sideA = sideName(o, 0.9), sideB = sideName(o, -0.9);
    if ([sideA, sideB].some(n => n === 'outside' || f.rooms.find(r => r.name === n)?.outdoor)) continue;   // exterior doors: reached from outside
    const where = `${o.label} (${sideA} ↔ ${sideB})`;
    if (best < 0) advise(name, `No walkable path from the ${hubDoor ? hubDoor.label : 'stairs'} to the ${where}`);
    else if (best < GUIDE.walk) advise(name, `Path from the ${hubDoor ? hubDoor.label : 'stairs'} to the ${where} narrows to ${ft(Math.min(best, 9))} (36" recommended)`);
  }
});

const order = ['size', 'door', 'overlap', 'wall', 'window', 'opening', 'outside'];
issues.sort((a, b) => order.indexOf(a.sev) - order.indexOf(b.sev));
for (const i of issues) console.log(`[${i.sev}] ${i.floor}: ${i.msg}`);
console.log(issues.length ? `\n${issues.length} issue(s)` : 'No issues found');
if (advice.length) {
  console.log(`\nDesigner clearance guidelines (${advice.length} note${advice.length > 1 ? 's' : ''}; advice, not errors):`);
  for (const a of advice) console.log(`  · ${a.floor}: ${a.msg}`);
}
process.exitCode = issues.length ? 1 : 0;
