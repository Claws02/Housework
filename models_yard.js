// Backyard water set and the kitchen nook: lazy river + lagoon pool, climbing rock with a waterfall, greenhouse the
// river flows through, footbridge, float tubes, a built-in banquette and a bay-window roof.
// Same local frame as models3d.js: origin at the footprint centre on the floor, +y up, +z = front.
import * as THREE from 'three';
import { mat } from './textures.js';
import { BUILDERS as B, M, lampMat, seeded, foliage } from './models3d.js';
import { RIVER, riverSamples, rockTiers, greenhouseWalls, greenhouseLayout, BRIDGE, bridgeDeckAt } from './landscape.js';

const PI = Math.PI;

/** Add a mesh from raw quads. quads: [[a, b, c, d], …] of [x, y, z] corners (a→b→c→d around), uvs per corner. */
function quadMesh(k, quads, uvs, m) {
  const pos = [], uv = [];
  quads.forEach((q, i) => {
    const u = uvs[i];
    for (const j of [0, 1, 2, 0, 2, 3]) { pos.push(...q[j]); uv.push(...u[j]); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m);
  k.g.add(mesh);
  return mesh;
}

// ── Lazy river + lagoon pool ────────────────────────────────────────────────
B.lazyRiver = (k, w, d, h, c, c2, it) => {
  const S = riverSamples(it), n = S.length;
  const D2 = THREE.DoubleSide;
  const water = mat('plain', c, { roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.7, depthWrite: false, side: D2 });
  const plaster = mat('concrete', '#86c3c9', { roughness: 0.85, tile: 5, side: D2 });
  const band = mat('plain', '#2c5b78', { roughness: 0.4, side: D2 });
  const cope = mat('tile', '#c4baa8', { roughness: 0.9, tile: 3, side: D2 });
  const W = RIVER.water, CH = RIVER.copingH, CW = RIVER.coping;
  const surf = [], surfUV = [], floor = [], floorUV = [], walls = [], wallUV = [], bands = [], bandUV = [], top = [], topUV = [];
  for (let i = 0; i < n; i++) {
    const a = S[i], b = S[(i + 1) % n];
    const ds = Math.hypot(b.x - a.x, b.z - a.z), s0 = a.s, s1 = a.s + ds;
    surf.push([[a.L[0], W, a.L[1]], [b.L[0], W, b.L[1]], [b.R[0], W, b.R[1]], [a.R[0], W, a.R[1]]]);
    surfUV.push([[a.L[0], a.L[1]], [b.L[0], b.L[1]], [b.R[0], b.R[1]], [a.R[0], a.R[1]]]);
    floor.push([[a.L[0], -a.depth, a.L[1]], [b.L[0], -b.depth, b.L[1]], [b.R[0], -b.depth, b.R[1]], [a.R[0], -a.depth, a.R[1]]]);
    floorUV.push(surfUV[surfUV.length - 1]);
    for (const [side, sg] of [['L', 1], ['R', -1]]) {
      const pa = a[side], pb = b[side];
      // stone lip and waterline band, then the plaster shell down to the floor
      bands.push([[pa[0], CH, pa[1]], [pb[0], CH, pb[1]], [pb[0], W - 0.15, pb[1]], [pa[0], W - 0.15, pa[1]]]);
      bandUV.push([[s0, CH], [s1, CH], [s1, W], [s0, W]]);
      walls.push([[pa[0], W - 0.15, pa[1]], [pb[0], W - 0.15, pb[1]], [pb[0], -b.depth, pb[1]], [pa[0], -a.depth, pa[1]]]);
      wallUV.push([[s0, 0], [s1, 0], [s1, -b.depth], [s0, -a.depth]]);
      // coping: 15" flat stone band outward from the water's edge
      const oa = [pa[0] + a.nx * sg * CW, pa[1] + a.nz * sg * CW], ob = [pb[0] + b.nx * sg * CW, pb[1] + b.nz * sg * CW];
      top.push([[pa[0], CH, pa[1]], [pb[0], CH, pb[1]], [ob[0], CH, ob[1]], [oa[0], CH, oa[1]]]);
      topUV.push([[pa[0], pa[1]], [pb[0], pb[1]], [ob[0], ob[1]], [oa[0], oa[1]]]);
    }
  }
  quadMesh(k, surf, surfUV, water).renderOrder = 2;
  quadMesh(k, floor, floorUV, plaster);
  quadMesh(k, walls, wallUV, plaster);
  quadMesh(k, bands, bandUV, band);
  quadMesh(k, top, topUV, cope);
  // underwater lights along the walls (they glow in the evening)
  const glow = lampMat('#e9fbff', '#9fe8ff', 1.6, { roughness: 0.3 });
  let next = 6;
  for (const p of S) {
    if (p.s < next) continue;
    next += p.f > 0.5 ? 12 : 22;
    for (const [side, sg] of [['L', 1], ['R', -1]]) if (p.f > 0.5 || side === 'L') {
      const e = p[side];
      k.sph(0.32, glow, e[0] - p.nx * sg * 0.05, W - 1.3, e[1] - p.nz * sg * 0.05, 1, 1, 1, 10);
    }
  }
};

// ── Float tube ──────────────────────────────────────────────────────────────
B.floatTube = (k, w, d, h, c, c2) => {
  const R = w / 2, t = Math.min(0.45, R * 0.36);
  const tube = k.torus(R - t, t, M.plain(c, 0.35), 0, t * 0.4, 0);
  tube.rotation.x = PI / 2;
  for (let i = 0; i < 4; i++) {                     // contrasting stripes
    const s = k.torus(R - t, t * 1.02, M.plain(c2, 0.35), 0, t * 0.4, 0, 0.35);
    s.rotation.x = PI / 2; s.rotation.z = i * PI / 2;
  }
  for (const sx of [-1, 1]) k.box(0.5, 0.08, 0.12, M.plain('#2b2b2e', 0.6), sx * (R - t), t * 1.35, 0);   // handles
};

// ── Climbing rock with waterfall ────────────────────────────────────────────
B.climbingRock = (k, w, d, h, c, c2, it) => {
  const rnd = seeded('rock' + w + d + h);
  const rock = M.plain(c, 0.95, { flatShading: true }), dark = M.plain('#6f6a63', 0.95, { flatShading: true });
  const capM = mat('stone', '#9a948b', { roughness: 0.95, tile: 3 });
  const tiers = rockTiers({ width: w, depth: d, height: h });
  const base = -RIVER.wade - 1.2;                    // the rock runs down into the deep end
  tiers.forEach((t, i) => {
    const tw = t.x1 - t.x0, td = t.z1 - t.z0, cx = (t.x0 + t.x1) / 2, cz = (t.z0 + t.z1) / 2;
    k.rbox(tw, t.top - base - 0.3, td + 0.4, 0.5, i % 2 ? rock : dark, cx, base, cz);
    k.rbox(tw + 0.15, 0.45, td + 0.3, 0.18, capM, cx, t.top - 0.45, cz);                        // flat ledge to stand on
    for (let j = 0; j < 3; j++) {                                                            // lumps break up the outline
      const sx = rnd() < 0.5 ? -1 : 1, lx = sx === -1 ? t.x0 : t.x1;
      k.ico(0.5, rnd() < 0.5 ? rock : dark, lx + sx * 0.15, base + (t.top - base) * (0.25 + rnd() * 0.45), cz + (rnd() - 0.5) * td,
        1.4 + rnd() * 1.4, 1.4 + rnd() * 1.6, td * (0.8 + rnd() * 0.5), 1);
    }
  });
  // front face over the water: a steep wall with climbing holds, and a lip to jump from
  const last = tiers[tiers.length - 1];
  k.rbox(last.x1 - last.x0 + 0.6, 0.35, 0.9, 0.12, capM, (last.x0 + last.x1) / 2, h - 0.35, last.z1 - 0.2);
  const holdCols = ['#e4572e', '#f3c623', '#2e86de', '#27ae60', '#8e44ad'];
  for (let i = 0; i < 34; i++) {
    const t = tiers[Math.floor(rnd() * tiers.length)];
    const side = rnd(), y = 0.4 + rnd() * (t.top - 0.6);
    let x, z;
    if (side < 0.4) { x = t.x0 - 0.05; z = t.z0 + rnd() * (t.z1 - t.z0); }
    else if (side < 0.8) { x = t.x1 + 0.05; z = t.z0 + rnd() * (t.z1 - t.z0); }
    else { x = t.x0 + rnd() * (t.x1 - t.x0); z = last.z1 + 0.25; }
    k.ico(0.16, M.plain(holdCols[i % holdCols.length], 0.6, { flatShading: true }), x, y, z, 1.3, 0.8, 1.3, 0);
  }
  // waterfall on the east shoulder: a stone spillway, a falling sheet and foam where it lands
  const wx0 = 0.22 * w, wx1 = 0.44 * w, wz0 = 0.10 * d, wz1 = 0.36 * d, wt = 0.72 * h;
  k.rbox(wx1 - wx0, wt - base, wz1 - wz0, 0.5, rock, (wx0 + wx1) / 2, base, (wz0 + wz1) / 2);
  k.ico(0.5, dark, wx1, wt * 0.55, (wz0 + wz1) / 2, 1.6, wt * 0.9, 2.4, 1);
  const fx = (wx0 + wx1) / 2, sheetW = (wx1 - wx0) * 0.55;
  const flow = mat('plain', '#dff4fb', { roughness: 0.1, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide });
  const foam = mat('plain', '#f4fbfd', { roughness: 0.6, transparent: true, opacity: 0.85 });
  k.box(sheetW + 0.3, 0.25, wz1 - wz0, capM, fx, wt - 0.1, (wz0 + wz1) / 2);                 // spillway channel
  k.box(sheetW, 0.06, wz1 - wz0 - 0.1, flow, fx, wt + 0.12, (wz0 + wz1) / 2);                // water in the channel
  const drop = wt - RIVER.water;
  const sheet = k.box(sheetW, drop, 0.08, flow, fx, RIVER.water, wz1 + 0.35);
  sheet.rotation.x = -0.12;
  for (let i = 0; i < 9; i++) k.sph(0.35 + rnd() * 0.3, foam, fx + (rnd() - 0.5) * sheetW * 1.4, RIVER.water + 0.05, wz1 + 0.6 + rnd() * 1.2, 1.4, 0.35, 1.2, 10);
};

// ── Greenhouse ──────────────────────────────────────────────────────────────
B.greenhouse = (k, w, d, h, c, c2, it) => {
  const rnd = seeded('gh' + w + d);
  const frame = M.plain(c, 0.4, { metalness: 0.3 }), glass = M.glass();
  const knee = mat('stone', '#8f877c', { roughness: 0.95, tile: 3 }), brick = mat('brick', '#a4664e', { roughness: 0.95, tile: 3 });
  const hw = w / 2, hd = d / 2, E = 8, KH = 1.6, [g0, g1] = it.riverGap ?? [-4, 4];
  // brick paths on both banks inside
  k.box(w - 0.6, 0.06, hd - g1 - 0.3, brick, 0, 0, (g1 + hd) / 2);
  k.box(w - 0.6, 0.06, hd + g0 - 0.3, brick, 0, 0, (g0 - hd) / 2);
  // walls: stone knee wall, glass, white aluminium mullions every ~3 ft
  for (const [ax, az, bx, bz] of greenhouseWalls(it)) {
    const L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const put = (m, hgt, y, t) => { const b = k.box(L, hgt, t, m, mx, y, mz); b.rotation.y = -ang; return b; };
    put(knee, KH, 0, 0.55);
    put(glass, E - KH, KH, 0.05);
    put(frame, 0.18, KH, 0.2); put(frame, 0.12, 5, 0.12); put(frame, 0.22, E - 0.22, 0.25);
    const nm = Math.max(1, Math.round(L / 3));
    for (let i = 0; i <= nm; i++) {
      const t = i / nm, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      k.box(0.14, E - KH, 0.14, frame, px, KH, pz);
    }
  }
  // headers over the door and the river openings; glass above them on the gable ends
  const doors = [[it.door ?? 0, hd, 1], ...(it.backDoor === undefined ? [] : [[it.backDoor, -hd, -1]])];
  for (const [dx, dz] of doors) { k.box(5, 0.3, 0.25, frame, dx, 7.3, dz); k.box(5, E - 7.6, 0.05, glass, dx, 7.6, dz); }
  for (const sx of [-1, 1]) {
    k.box(0.25, 0.4, g1 - g0, frame, sx * hw, 6.6, (g0 + g1) / 2);
    k.box(0.05, E - 7, g1 - g0, glass, sx * hw, 7, (g0 + g1) / 2);
    for (const z of [g0, g1]) k.box(0.3, 7, 0.3, frame, sx * hw, -0.2, z);
  }
  // doors: glass double doors, swung open outward
  for (const [dx, dz, sz] of doors) for (const sx of [-1, 1]) {
    const leaf = new THREE.Group(), lm = k.box(2.4, 7.1, 0.08, glass, 0, 0, 0);
    const lf = k.box(2.4, 0.15, 0.12, frame, 0, 0, 0), lt = k.box(2.4, 0.15, 0.12, frame, 0, 6.95, 0);
    for (const m of [lm, lf, lt]) { k.g.remove(m); leaf.add(m); m.position.x = -sx * 1.2; }
    leaf.position.set(dx + sx * 2.5, 0.1, dz + sz * 0.05); leaf.rotation.y = sx * sz * -1.2;
    k.g.add(leaf);
  }
  // gable glass roof, ridge along x
  const rise = h - E, L = Math.hypot(hd + 0.4, rise), pitch = Math.atan2(rise, hd + 0.4);
  for (const sz of [-1, 1]) {
    const pane = k.box(w + 0.6, 0.05, L, glass, 0, 0, 0);
    pane.position.set(0, E + rise / 2, sz * (hd + 0.4) / 2); pane.rotation.x = sz * pitch;
    const nr = Math.round(w / 3);
    for (let i = 0; i <= nr; i++) {
      const raf = k.box(0.12, 0.2, L, frame, 0, 0, 0);
      raf.position.set(-hw + i * (w / nr), E + rise / 2 + 0.1, sz * (hd + 0.4) / 2); raf.rotation.x = sz * pitch;
    }
  }
  k.box(w + 0.8, 0.35, 0.5, frame, 0, h - 0.1, 0);                                   // ridge
  k.box(w * 0.6, 0.5, 1.4, M.plain('#dfe4e6', 0.4, { metalness: 0.3 }), 0, h + 0.2, 0);   // ridge vent
  // gable triangles
  for (const sx of [-1, 1]) {
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([sx * hw, E, -hd, sx * hw, E, hd, sx * hw, h, 0], 3));
    tri.computeVertexNormals();
    k.g.add(new THREE.Mesh(tri, mat('plain', '#cfe3ee', { roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide })));
  }
  // planting: jungle beds (palms, bananas, ferns, flowers) along the walls, a raised vegetable & herb bed, pots
  const { beds, pots } = greenhouseLayout(it);
  const soil = M.soil(), edge = mat('stone', '#8f877c', { roughness: 0.95, tile: 2 }), cedar = M.wood('#9a6a44', 0.85);
  for (const b of beds) {
    const bw = b.x1 - b.x0, bd = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (b.kind === 'veg') {
      k.box(bw, 2, bd, cedar, cx, 0, cz);
      k.box(bw - 0.3, 0.05, bd - 0.3, soil, cx, 1.95, cz);
      const crops = ['#4f8a3a', '#6aa84f', '#3d7a34', '#7cb35a'];
      for (let x = b.x0 + 0.55; x < b.x1 - 0.4; x += 1.0) for (const z of [b.z0 + 0.6, b.z1 - 0.6]) {
        const ph = 0.3 + rnd() * 0.7;
        foliage(k, x, 2 + ph * 0.5, z, 0.3 + rnd() * 0.12, crops[Math.floor(rnd() * 4)], rnd, 3, 0.9);
        if (rnd() < 0.35) k.sph(0.09, M.plain(rnd() < 0.5 ? '#d6402b' : '#f2b134', 0.5), x + 0.12, 2 + ph * 0.6, z + 0.1, 1, 1, 1, 8);
      }
      for (let x = b.x0 + 0.8; x < b.x1 - 0.5; x += 2.2) {                                  // tomato stakes + twine
        k.cyl(0.03, 0.03, 3.6, M.wood('#6b4a2e', 0.9), x, 2, cz, 6);
        foliage(k, x, 4.4, cz, 0.35, '#3d7a34', rnd, 3, 1.2);
      }
      continue;
    }
    k.box(bw, 0.9, bd, edge, cx, 0, cz);                                                     // stone-edged bed
    k.box(bw - 0.3, 0.05, bd - 0.3, soil, cx, 0.88, cz);
    // layered like a conservatory border: tall palms & bananas against the glass, ferns, then flowers at the front
    const back = cz > 0 ? b.z1 - 0.65 : b.z0 + 0.65, front = cz > 0 ? b.z0 + 0.45 : b.z1 - 0.45, mid = (back + front) / 2;
    let i = 0;
    for (let x = b.x0 + 0.8; x < b.x1 - 0.5; x += 1.5 + rnd() * 0.5, i++) {
      if (i % 2 === 0) palm(k, x, 0.9, back, 5.5 + rnd() * 2, rnd); else banana(k, x, 0.9, back, 4.5 + rnd() * 1.8, rnd);
    }
    for (let x = b.x0 + 0.6; x < b.x1 - 0.3; x += 0.9 + rnd() * 0.3) fern(k, x, 0.9, mid + (rnd() - 0.5) * 0.4, 0.9 + rnd() * 0.5, rnd);
    for (let x = b.x0 + 0.4; x < b.x1 - 0.2; x += 0.75 + rnd() * 0.3) (rnd() < 0.6 ? flowers : bromeliad)(k, x, 0.9, front + (rnd() - 0.5) * 0.2, rnd);
    // climbers up the mullions behind the bed
    for (let x = b.x0 + 1; x < b.x1 - 0.5; x += 3) for (let t = 0; t < 5.5; t += 0.3)
      k.ico(0.22, M.leaf(rnd() < 0.5 ? '#3f7f34' : '#4f9a3a'), x + Math.sin(t * 3) * 0.25, 1.6 + t, (cz > 0 ? b.z1 + 0.3 : b.z0 - 0.3), 1.2, 0.8, 0.5, 0);
  }
  const pot = M.plain('#b5683e', 0.8);
  for (const p of pots) {
    k.cyl(0.85, 0.65, 1.5, pot, p.x, 0, p.z);
    if (p.kind === 'palm') { palm(k, p.x, 1.5, p.z, 8.5, rnd); continue; }
    k.cyl(0.08, 0.1, 2.4, M.bark(), p.x, 1.4, p.z, 8);
    foliage(k, p.x, 4.5, p.z, 1.35, '#3f7d35', rnd, 7, 0.85);
    for (let i = 0; i < 8; i++) k.sph(0.13, M.plain(i % 2 ? '#f2c431' : '#f08a24', 0.5), p.x + (rnd() - 0.5) * 2, 3.8 + rnd() * 1.4, p.z + (rnd() - 0.5) * 2, 1, 1, 1, 8);
  }
  // trailing vines and hanging baskets from the rafters
  const vine = M.leaf('#4b8a3c');
  for (let i = 0; i < 10; i++) {
    const x = -hw + 1.5 + i * ((w - 3) / 9), z = (i % 2 ? 1 : -1) * (hd - 3.6);
    if (i % 3 === 0) {
      k.cyl(0.015, 0.015, 1.6, M.iron(), x, E - 1.1, z, 4);
      k.cyl(0.5, 0.32, 0.45, M.plain('#7a5a3a', 0.9), x, E - 1.55, z, 12);
      foliage(k, x, E - 1.5, z, 0.55, '#4b8a3c', rnd, 5, 0.7);
    }
    const n = 3 + Math.floor(rnd() * 3), len = 1.8 + rnd() * 2.5;                          // strands hanging from the eave
    for (let j = 0; j < n; j++) {
      const vx = x + (rnd() - 0.5) * 1.2, vz = z + (i % 2 ? 1 : -1) * (2.6 + rnd() * 0.6);
      for (let t = 0; t < len; t += 0.28) k.ico(0.2, rnd() < 0.5 ? vine : M.leaf('#5aa04a'), vx + Math.sin(t * 2 + j) * 0.15 + (rnd() - 0.5) * 0.15, E - 0.3 - t, vz + (rnd() - 0.5) * 0.15, 1.3, 0.7, 0.8, 0);
    }
  }
};

// lush plants for the greenhouse
function palm(k, x, y, z, h, rnd) {
  const trunk = M.wood('#7d6448', 0.95), frond = M.leaf('#3f7f34'), frond2 = M.leaf('#4f9a3a'), lean = (rnd() - 0.5) * 0.5;
  for (let i = 0; i < 8; i++) k.cyl(0.22 - i * 0.012, 0.25 - i * 0.012, h / 8 + 0.02, trunk, x + lean * i / 8, y + i * h / 8, z, 8);
  const tx = x + lean, ty = y + h;
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * PI * 2 + rnd() * 0.3, L = 2.6 + rnd() * 1.0, up = rnd() * 0.6;
    for (let t = 0.1; t < 1; t += 0.12) {
      const r = L * t, droop = t * t * 1.8 - up * t;
      const m = k.sph(0.5, i % 2 ? frond : frond2, tx + Math.cos(a) * r, ty - droop + 0.15, z + Math.sin(a) * r, 0.55, 0.06, 1.3 * (1 - t * 0.6), 6);
      m.rotation.order = 'YXZ'; m.rotation.y = -a; m.rotation.x = 0.4;
    }
  }
}
function banana(k, x, y, z, h, rnd) {
  const stem = M.plain('#6e8a3c', 0.8), leaf = M.leaf('#4f9a3a');
  k.cyl(0.18, 0.25, h * 0.55, stem, x, y, z, 8);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * PI * 2 + rnd() * 0.5, tilt = 0.5 + rnd() * 0.5;
    const L = h * 0.42, cx = x + Math.cos(a) * L * 0.5 * tilt, cz = z + Math.sin(a) * L * 0.5 * tilt;
    const m = k.sph(0.5, leaf, cx, y + h * 0.55 + L * 0.35 * (1 - tilt * 0.5), cz, L * 0.95, 0.06, 0.7, 10);
    m.rotation.order = 'YZX'; m.rotation.y = -a; m.rotation.z = tilt * 0.8;
  }
}
function fern(k, x, y, z, s, rnd) {
  const leaf = M.leaf(rnd() < 0.5 ? '#3d8a3a' : '#5aa04a');
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * PI * 2 + rnd() * 0.4;
    const m = k.sph(0.5, leaf, x + Math.cos(a) * s * 0.45, y + s * 0.35, z + Math.sin(a) * s * 0.45, s * 1.1, 0.08, s * 0.32, 8);
    m.rotation.order = 'YZX'; m.rotation.y = -a; m.rotation.z = 0.5;
  }
}
function bromeliad(k, x, y, z, rnd) {
  const leaf = M.leaf('#4a8a40'), c = rnd() < 0.5 ? '#d6402b' : '#f08a24';
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * PI * 2, m = k.sph(0.5, leaf, x + Math.cos(a) * 0.22, y + 0.3, z + Math.sin(a) * 0.22, 0.75, 0.08, 0.22, 6);
    m.rotation.order = 'YZX'; m.rotation.y = -a; m.rotation.z = 0.7;
  }
  k.cone(0.12, 0.5, M.plain(c, 0.5), x, y + 0.25, z, 8);
}
function flowers(k, x, y, z, rnd) {
  const cols = ['#e2557a', '#f08a24', '#f2c431', '#b05fd0', '#f4f1ea'], c = cols[Math.floor(rnd() * cols.length)];
  foliage(k, x, y + 0.45, z, 0.4, '#4b8a3c', rnd, 3, 0.8);
  for (let i = 0; i < 6; i++) k.sph(0.09, M.plain(c, 0.6), x + (rnd() - 0.5) * 0.7, y + 0.7 + rnd() * 0.3, z + (rnd() - 0.5) * 0.7, 1, 0.7, 1, 6);
}

// ── Footbridge ──────────────────────────────────────────────────────────────
B.footbridge = (k, w, d, h, c) => {           // arched cedar bridge: high enough in the middle to float under in a tube
  const wood = M.wood(c, 0.85), dk = mat('deck', c, { roughness: 0.9, tile: 4 }), R = BRIDGE.rail;
  const n = Math.round(d / 0.6), seg = d / n;
  for (let i = 0; i < n; i++) {
    const z0 = -d / 2 + i * seg, z1 = z0 + seg, y0 = bridgeDeckAt(d, z0), y1 = bridgeDeckAt(d, z1), zm = (z0 + z1) / 2, ym = (y0 + y1) / 2;
    const ang = -Math.atan2(y1 - y0, z1 - z0), len = Math.hypot(seg, y1 - y0) + 0.02;
    const board = k.box(w, 0.15, len - 0.06, dk, 0, 0, 0); board.position.set(0, ym - 0.075, zm); board.rotation.x = ang;
    for (const sx of [-1, 1]) {
      const st = k.box(0.25, 0.8, len, wood, 0, 0, 0); st.position.set(sx * (w / 2 - 0.15), ym - 0.55, zm); st.rotation.x = ang;
      const rail = k.box(0.22, 0.15, len, wood, 0, 0, 0); rail.position.set(sx * (w / 2 - 0.15), ym + R, zm); rail.rotation.x = ang;
      const mid = k.box(0.12, 0.1, len, wood, 0, 0, 0); mid.position.set(sx * (w / 2 - 0.15), ym + 1.4, zm); mid.rotation.x = ang;
      k.box(0.06, 1.4, 0.06, wood, sx * (w / 2 - 0.15), ym, zm);                                  // baluster
    }
  }
  const np = Math.round((d - 1) / 3.2);
  for (let i = 0; i <= np; i++) {
    const z = -d / 2 + 0.5 + i * (d - 1) / np, y = bridgeDeckAt(d, z);
    for (const sx of [-1, 1]) {
      k.box(0.3, R + 0.15, 0.3, wood, sx * (w / 2 - 0.15), y, z);
      if (y > 1) k.box(0.35, y + 3, 0.35, wood, sx * (w / 2 - 0.15), -3, z);                   // piers down to the river bed
    }
  }
  for (const sz of [-1, 1]) k.box(w - 0.3, BRIDGE.end, 1.2, mat('stone', '#a8a29e', { tile: 3 }), 0, 0, sz * (d / 2 + 0.4));   // landing stones
};

// ── Ferns (riverbank planting) ──────────────────────────────────────────────
B.fern = (k, w, d, h, c, c2, it) => {
  const rnd = seeded('fern' + (it.x ?? 0) + (it.y ?? 0));
  fern(k, 0, 0, 0, w * 0.45, rnd);
  fern(k, w * 0.2, 0, -d * 0.15, w * 0.3, rnd);
  if (c2 && c2 !== '#888888') flowers(k, -w * 0.2, 0, d * 0.2, rnd);
};

// ── Kitchen nook ────────────────────────────────────────────────────────────
B.banquette = (k, w, d, h, c, c2) => {         // built-in bench: painted base with drawers, cushion, tall back with pillows
  const paint = M.plain(c, 0.5), cush = mat('fabric', c2, { roughness: 0.95 }), back = mat('beadboard', c, { roughness: 0.6, tile: 3 });
  const seatH = 1.25, cd = d - 0.35;
  k.box(w, 0.25, d - 0.1, M.plain('#2b2b2e', 0.8), 0, 0, -0.05);                  // toe kick
  k.box(w, seatH - 0.25, d, paint, 0, 0.25, 0);
  const nd = Math.max(1, Math.round(w / 2.2));
  for (let i = 0; i < nd; i++) {
    const x = -w / 2 + (i + 0.5) * w / nd;
    k.box(w / nd - 0.15, 0.6, 0.04, paint, x, 0.45, d / 2 + 0.02);
    k.box(0.4, 0.05, 0.06, M.nickel(), x, 0.85, d / 2 + 0.06);
  }
  k.rbox(w - 0.05, 0.28, cd, 0.08, cush, 0, seatH, 0.15);                          // seat cushion
  k.box(w, h - seatH, 0.25, back, 0, seatH, -d / 2 + 0.125);                       // panelled back
  k.box(w + 0.1, 0.1, 0.4, paint, 0, h - 0.05, -d / 2 + 0.15);                     // cap
  const nb = Math.max(1, Math.round(w / 2.6));
  for (let i = 0; i < nb; i++) {
    const cu = k.rbox(w / nb - 0.12, 1.3, 0.38, 0.15, cush, -w / 2 + (i + 0.5) * w / nb, seatH + 0.28, -d / 2 + 0.45);
    cu.rotation.x = -0.12;
  }
  const pc = ['#e8dcc4', '#c96f4a', '#e8dcc4'];
  for (let i = 0; i < Math.min(3, nb + 1); i++) {
    const p = k.rbox(1.1, 1.1, 0.35, 0.2, mat('fabric', pc[i % 3], { roughness: 0.95 }), -w / 2 + 0.9 + i * (w - 1.8) / Math.max(1, Math.min(2, nb)), seatH + 0.3, -d / 2 + 0.75);
    p.rotation.x = -0.25; p.rotation.z = (i - 1) * 0.12;
  }
};

B.bayRoof = (k, w, d, h, c) => {               // standing-seam metal lean-to over a box bay: high at the back (−z)
  const metal = M.plain(c, 0.35, { metalness: 0.55 }), trim = M.trim();
  const L = Math.hypot(d, h), ang = Math.atan2(h, d);
  const p = k.box(w, 0.08, L, metal, 0, 0, 0);
  p.position.set(0, h / 2 + 0.1, 0); p.rotation.x = ang;
  for (let x = -w / 2 + 0.6; x < w / 2 - 0.3; x += 1.4) {
    const s = k.box(0.05, 0.08, L, metal, x, 0, 0);
    s.position.set(x, h / 2 + 0.17, 0); s.rotation.x = ang;
  }
  k.box(w + 0.1, 0.45, 0.12, trim, 0, 0, d / 2);                                   // fascia
  for (const sx of [-1, 1]) {
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([sx * w / 2, 0, -d / 2, sx * w / 2, 0, d / 2, sx * w / 2, h, -d / 2], 3));
    tri.computeVertexNormals();
    k.g.add(new THREE.Mesh(tri, mat('plain', '#f7f6f2', { roughness: 0.4, side: THREE.DoubleSide })));
  }
  k.box(w, 0.3, d, trim, 0, -0.3, 0);                                              // soffit
};
