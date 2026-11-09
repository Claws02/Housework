// Shared plan geometry for the backyard water features, used by the 3D models, the ground, the walker and the audit.
// No three.js here: plain numbers in feet.
//
// Local frame = an item's footprint frame (origin at its centre, x along its width, z along its depth, +z = front).
// Plan = the floor plan (x, y). toPlan / toLocal convert, matching floorHoleRect in viewer3d.js.

export const RIVER = { water: -0.45, coping: 1.3, copingH: 0.12, wade: 2.6 };   // water 5½" below grade; you wade ~2'7" deep

export const toPlan = (it, lx, lz) => {
  const c = Math.cos(it.rotation || 0), s = Math.sin(it.rotation || 0);
  return [it.x + lx * c - lz * s, it.y + lx * s + lz * c];
};

export function pointInPoly(P, x, y) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const area = P => { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += P[j][0] * P[i][1] - P[i][0] * P[j][1]; return a / 2; };

// ── Lazy river ──────────────────────────────────────────────────────────────
// it.path: closed loop of [lx, lz, width] control points (local). Where the width balloons the loop becomes a
// lagoon pool. A smooth Catmull-Rom centreline is sampled about every 0.8 ft.
const _riverCache = new WeakMap();
export function riverSamples(it) {
  const key = JSON.stringify(it.path);
  const hit = _riverCache.get(it);
  if (hit && hit.key === key) return hit.S;
  const P = it.path, n = P.length, pts = [];
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.8));
    for (let k = 0; k < steps; k++) {
      const t = k / steps, u = t * t * (3 - 2 * t);           // ease the width so lagoon edges round off
      pts.push({ x: cr(p0[0], p1[0], p2[0], p3[0], t), z: cr(p0[1], p1[1], p2[1], p3[1], t), w: p1[2] + (p2[2] - p1[2]) * u });
    }
  }
  let s = 0;
  const S = pts.map((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz) || 1;
    if (i) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    const f = Math.max(0, Math.min(1, (p.w - 9) / 12));        // 0 = river, 1 = lagoon
    const wobL = 0.18 * Math.sin(s * 0.5) + f * (0.9 * Math.sin(s * 0.19 + 1) + 0.45 * Math.sin(s * 0.57));
    const wobR = 0.18 * Math.sin(s * 0.43 + 2) + f * (0.8 * Math.sin(s * 0.23 + 4) + 0.4 * Math.sin(s * 0.61 + 3));
    const nx = -tz / tl, nz = tx / tl, hl = p.w / 2 + wobL, hr = p.w / 2 + wobR;
    return { x: p.x, z: p.z, w: p.w, s, f, nx, nz, depth: 3.4 + f * 2.6,
      L: [p.x + nx * hl, p.z + nz * hl], R: [p.x - nx * hr, p.z - nz * hr] };
  });
  _riverCache.set(it, { key, S });
  return S;
}

/** Water edges in plan: { outer, inner } closed polygons (the water is the ring between them). */
export function riverOutline(it) {
  const S = riverSamples(it);
  const L = S.map(p => toPlan(it, ...p.L)), R = S.map(p => toPlan(it, ...p.R));
  return Math.abs(area(L)) > Math.abs(area(R)) ? { outer: L, inner: R, outerSide: 'L' } : { outer: R, inner: L, outerSide: 'R' };
}

/** Is plan point (x, y) on the water of this river? */
export function inRiver(it, x, y, ol = riverOutline(it)) {
  return pointInPoly(ol.outer, x, y) && !pointInPoly(ol.inner, x, y);
}

/** Current at plan point (x, y): downstream direction (path order) plus a nudge back toward the middle.
 *  Returns { dx, dy } in ft/s: about 1.6 ft/s (a lazy 1 mph) in the river, slowing to a drift in the lagoon. */
export function riverFlow(it, x, y) {
  const S = riverSamples(it), c = Math.cos(it.rotation || 0), s = Math.sin(it.rotation || 0);
  const lx = (x - it.x) * c + (y - it.y) * s, lz = -(x - it.x) * s + (y - it.y) * c;
  let bi = 0, bd = Infinity;
  for (let i = 0; i < S.length; i++) { const d = (S[i].x - lx) ** 2 + (S[i].z - lz) ** 2; if (d < bd) { bd = d; bi = i; } }
  const a = S[(bi - 2 + S.length) % S.length], b = S[(bi + 2) % S.length], p = S[bi];
  let tx = b.x - a.x, tz = b.z - a.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
  const off = Math.sqrt(bd), pull = Math.min(1, off / (p.w / 2)) * 0.6;   // drift back toward the centreline
  let vx = tx + (p.x - lx) / (off || 1) * pull, vz = tz + (p.z - lz) / (off || 1) * pull;
  const vl = Math.hypot(vx, vz) || 1, speed = 1.6 * (1 - p.f * 0.75);
  vx = vx / vl * speed; vz = vz / vl * speed;
  return { dx: vx * c - vz * s, dy: vx * s + vz * c };
}

// ── Climbing rock ───────────────────────────────────────────────────────────
// Ledges climbing from the back (−z) to a jump-off lip at the front (+z), each 0.8 ft above the last so you can
// step up them. Local rects scaled to the item's size; top = height above grade.
const ROCK_TIERS = [
  // x0,   x1,    z0,    z1,   top   (fractions of width/depth, top as a fraction of height)
  [-0.34, 0.32, -0.50, -0.33, 1 / 8],
  [-0.40, 0.34, -0.33, -0.17, 2 / 8],
  [-0.44, 0.38, -0.17, -0.02, 3 / 8],
  [-0.44, 0.28, -0.02, 0.11, 4 / 8],
  [-0.36, 0.22, 0.11, 0.22, 5 / 8],
  [-0.32, 0.18, 0.22, 0.31, 6 / 8],
  [-0.27, 0.16, 0.31, 0.40, 7 / 8],
  [-0.22, 0.12, 0.40, 0.50, 1],
];
export function rockTiers(it) {
  const w = it.width, d = it.depth, h = it.height ?? 6.4;
  return ROCK_TIERS.map(([x0, x1, z0, z1, t]) => ({ x0: x0 * w, x1: x1 * w, z0: z0 * d, z1: z1 * d, top: t * h }));
}

// ── Greenhouse ──────────────────────────────────────────────────────────────
// Glass walls on all four sides: a double door in the middle of the front (+z) wall and an arched opening in each
// end wall where the river flows through (it.riverGap = [z0, z1], local).
export function greenhouseWalls(it) {
  const hw = it.width / 2, hd = it.depth / 2, door = 2.5, [g0, g1] = it.riverGap ?? [-6.4, 6.4];
  return [
    [-hw, hd, -door, hd], [door, hd, hw, hd],               // front, door gap
    [-hw, -hd, hw, -hd],                                    // back
    [-hw, -hd, -hw, g0], [-hw, g1, -hw, hd],                // ends, river gap
    [hw, -hd, hw, g0], [hw, g1, hw, hd],
  ];
}
/** Raised beds inside (local rects, 2 ft tall). */
export function greenhouseBeds(it) {
  const hw = it.width / 2, hd = it.depth / 2, [g0, g1] = it.riverGap ?? [-6.4, 6.4];
  const back = { z0: -hd + 0.4, z1: -hd + 2.9 }, front = { z0: hd - 2.9, z1: hd - 0.4 };
  return [
    { x0: -hw + 0.6, x1: -hw * 0.18, ...back }, { x0: hw * 0.18, x1: hw - 0.6, ...back },
    { x0: -hw + 0.6, x1: -4.5, ...front }, { x0: 4.5, x1: hw - 0.6, ...front },
  ].filter(b => b.z0 > g1 || b.z1 < g0);
}

// ── Footbridge ──────────────────────────────────────────────────────────────
// Walkway along the item's depth (z): a flat middle high enough to float under (`deck`), sloping down to `end` at both
// ends over `ramp` ft; rails down both long sides.
export const BRIDGE = { deck: 3.0, end: 0.35, ramp: 5, rail: 3.4 };
/** Deck height (above grade) at local z along a footbridge of depth d. */
export function bridgeDeckAt(d, z) {
  const flat = d / 2 - BRIDGE.ramp, a = Math.abs(z);
  if (a <= flat) return BRIDGE.deck;
  const t = Math.min(1, (a - flat) / BRIDGE.ramp);
  return BRIDGE.deck - (BRIDGE.deck - BRIDGE.end) * t;
}
