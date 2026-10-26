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
  const sd = Math.min(3.5, it.depth), c = Math.cos(it.rotation), s = Math.sin(it.rotation);
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

const order = ['size', 'door', 'overlap', 'wall', 'window', 'opening', 'outside'];
issues.sort((a, b) => order.indexOf(a.sev) - order.indexOf(b.sev));
for (const i of issues) console.log(`[${i.sev}] ${i.floor}: ${i.msg}`);
console.log(issues.length ? `\n${issues.length} issue(s)` : 'No issues found');
process.exitCode = issues.length ? 1 : 0;
