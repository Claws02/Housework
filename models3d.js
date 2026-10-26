// Procedural furniture / fixture models.
// Local frame: origin at the footprint centre on the floor, +y up, +z = the item's front
// (plan "down" at rotation 0). Every builder scales to the item's width / depth / height.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat } from './textures.js';

// ── Shared materials ────────────────────────────────────────────────────────
/** Materials that glow when the house lights are on (lighting.js scales their emissiveIntensity). */
export const LAMP_MATS = new Set();
function lampMat(color, emissive, base, extra = {}) {
  const m = mat('plain', color, { roughness: 0.5, emissive, emissiveIntensity: base, ...extra });
  m.userData.base = base; LAMP_MATS.add(m);
  return m;
}

const M = {
  white:    () => mat('plain', '#f3f1ec', { roughness: 0.45 }),
  trim:     () => mat('plain', '#f7f6f2', { roughness: 0.4 }),
  porcelain:() => mat('plain', '#fbfbf9', { roughness: 0.12 }),
  steel:    () => mat('plain', '#c3c7cc', { roughness: 0.28, metalness: 0.85 }),
  chrome:   () => mat('plain', '#eeeeee', { roughness: 0.08, metalness: 1 }),
  nickel:   () => mat('plain', '#b7b2a8', { roughness: 0.25, metalness: 0.9 }),
  iron:     () => mat('plain', '#2b2b2e', { roughness: 0.55, metalness: 0.6 }),
  black:    () => mat('plain', '#1c1c1e', { roughness: 0.5 }),
  blackGl:  () => mat('plain', '#08080a', { roughness: 0.06, metalness: 0.4 }),
  screen:   () => mat('plain', '#0d1117', { roughness: 0.05, metalness: 0.2, emissive: '#0a0f18' }),
  glass:    () => mat('plain', '#cfe3ee', { roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.25, depthWrite: false }),
  mirror:   () => mat('plain', '#dfe8ec', { roughness: 0.02, metalness: 1 }),
  rubber:   () => mat('plain', '#202022', { roughness: 0.9 }),
  bulb:     () => lampMat('#fff6dc', '#ffe1a8', 1.2, { roughness: 0.4 }),
  shade:    () => lampMat('#f1eadb', '#b08a55', 0.5, { roughness: 0.9, side: THREE.DoubleSide }),
  linen:    () => mat('fabric', '#f4f2ec', { roughness: 0.95 }),
  quartz:   () => mat('concrete', '#e9e7e2', { roughness: 0.25 }),
  soil:     () => mat('plain', '#3b2b1e', { roughness: 1 }),
  bark:     () => mat('wood', '#5b4632', { roughness: 1 }),
  brick:    () => mat('brick', '#8e3b2c', { roughness: 0.95, tile: 4 }),
  stone:    () => mat('stone', '#9b8f80', { roughness: 0.95 }),
  concrete: () => mat('concrete', '#a8a59f', { roughness: 0.95 }),
  plain:    (c, r = 0.7, x = {}) => mat('plain', c, { roughness: r, ...x }),
  wood:     (c, r = 0.6) => mat('wood', c, { roughness: r }),
  fabric:   c => mat('fabric', c, { roughness: 0.95 }),
  leather:  c => mat('leather', c, { roughness: 0.45 }),
  // leaf shades are quantised so a tree's random variations share a handful of materials (draw calls)
  leaf:     c => { const q = new THREE.Color(c); for (const k of ['r', 'g', 'b']) q[k] = Math.round(q[k] * 14) / 14; return mat('plain', '#' + q.getHexString(), { roughness: 0.85, flatShading: true }); },
};

// ── Builder kit ─────────────────────────────────────────────────────────────
const _geo = new Map();
function geo(key, make) { if (!_geo.has(key)) _geo.set(key, make()); return _geo.get(key); }
const r3 = v => Math.round(v * 1000) / 1000;

/** Rescale a box-like geometry's per-face 0..1 UVs to feet so textures keep real-world scale. */
function feetUV(g, w, h, d) {
  const uv = g.attributes.uv, idx = g.index;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const done = new Uint8Array(uv.count);
  g.groups.forEach((grp, f) => {
    const [du, dv] = dims[f] || [1, 1];
    for (let i = grp.start; i < grp.start + grp.count; i++) {
      const v = idx ? idx.getX(i) : i;
      if (done[v]) continue; done[v] = 1;
      uv.setXY(v, uv.getX(v) * du, uv.getY(v) * dv);
    }
  });
  return g;
}

class Kit {
  constructor() { this.g = new THREE.Group(); }
  _put(mesh, x, y, z) { mesh.position.set(x, y, z); this.g.add(mesh); return mesh; }
  /** Box sitting on y (bottom face at y). */
  box(w, h, d, m, x = 0, y = 0, z = 0) {
    w = Math.max(w, 0.01); h = Math.max(h, 0.01); d = Math.max(d, 0.01);
    const g = geo(`b${r3(w)},${r3(h)},${r3(d)}`, () => feetUV(new THREE.BoxGeometry(w, h, d), w, h, d));
    return this._put(new THREE.Mesh(g, m), x, y + h / 2, z);
  }
  /** Box whose texture spans each face once (rugs, artwork). */
  boxUnit(w, h, d, m, x = 0, y = 0, z = 0) {
    const g = geo(`bu${r3(w)},${r3(h)},${r3(d)}`, () => new THREE.BoxGeometry(w, h, d));
    return this._put(new THREE.Mesh(g, m), x, y + h / 2, z);
  }
  rbox(w, h, d, rad, m, x = 0, y = 0, z = 0) {
    w = Math.max(w, 0.02); h = Math.max(h, 0.02); d = Math.max(d, 0.02);
    rad = Math.min(rad, w / 2, h / 2, d / 2) * 0.98;
    const g = geo(`rb${r3(w)},${r3(h)},${r3(d)},${r3(rad)}`, () => feetUV(new RoundedBoxGeometry(w, h, d, 3, rad), w, h, d));
    return this._put(new THREE.Mesh(g, m), x, y + h / 2, z);
  }
  cyl(rt, rb, h, m, x = 0, y = 0, z = 0, seg = 20) {
    const g = geo(`c${r3(rt)},${r3(rb)},${r3(h)},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
    return this._put(new THREE.Mesh(g, m), x, y + h / 2, z);
  }
  sph(rad, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 16) {
    const g = geo(`s${r3(rad)},${seg}`, () => new THREE.SphereGeometry(rad, seg, Math.max(6, seg * 0.75 | 0)));
    const mesh = this._put(new THREE.Mesh(g, m), x, y, z);
    mesh.scale.set(sx, sy, sz); return mesh;
  }
  ico(rad, m, x, y, z, sx = 1, sy = 1, sz = 1, detail = 1) {
    const g = geo(`i${r3(rad)},${detail}`, () => new THREE.IcosahedronGeometry(rad, detail));
    const mesh = this._put(new THREE.Mesh(g, m), x, y, z);
    mesh.scale.set(sx, sy, sz); return mesh;
  }
  torus(R, t, m, x, y, z, arc = Math.PI * 2) {
    const g = geo(`t${r3(R)},${r3(t)},${r3(arc)}`, () => new THREE.TorusGeometry(R, t, 8, 28, arc));
    return this._put(new THREE.Mesh(g, m), x, y, z);
  }
  cone(rad, h, m, x = 0, y = 0, z = 0, seg = 12) {
    const g = geo(`k${r3(rad)},${r3(h)},${seg}`, () => new THREE.ConeGeometry(rad, h, seg));
    return this._put(new THREE.Mesh(g, m), x, y + h / 2, z);
  }
  /** Horizontal bar between two points at height y (used for rails, rods). */
  rod(x1, z1, x2, z2, y, rad, m) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const mesh = this.cyl(rad, rad, len, m, (x1 + x2) / 2, y - len / 2, (z1 + z2) / 2, 10);
    mesh.position.y = y;
    mesh.rotation.z = Math.PI / 2;
    mesh.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    mesh.rotation.order = 'YZX';
    return mesh;
  }
  group(fn, x = 0, y = 0, z = 0, ry = 0) {
    const sub = new Kit(); fn(sub);
    sub.g.position.set(x, y, z); sub.g.rotation.y = ry;
    this.g.add(sub.g); return sub.g;
  }
}

// Seeded random so models look the same every rebuild
function seeded(str) {
  let s = 0; for (const ch of String(str)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ── Reusable parts ──────────────────────────────────────────────────────────
function legs4(k, w, d, h, rad, m, inset = 0.12, round = true) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - inset), z = sz * (d / 2 - inset);
    if (round) k.cyl(rad, rad * 0.75, h, m, x, 0, z, 10);
    else k.box(rad * 2, h, rad * 2, m, x, 0, z);
  }
}

/** Shaker door/drawer front on the +z face at depth z: a 2¾" frame of stiles and rails standing
 *  ¼" proud of a flat centre panel, with ⅛" reveals around the door and a bar pull. */
function shaker(k, w, h, z, m, x, y, handle = 'bar', hm = M.nickel()) {
  const W = w - 0.02, H = h - 0.02, f = Math.min(0.23, W * 0.22, H * 0.22), t = 0.05, p = 0.022;
  k.box(W, H, t, m, x, y + 0.01, z + t / 2);                                   // panel + back
  k.box(f, H, p, m, x - W / 2 + f / 2, y + 0.01, z + t + p / 2);               // stiles
  k.box(f, H, p, m, x + W / 2 - f / 2, y + 0.01, z + t + p / 2);
  k.box(W - 2 * f, f, p, m, x, y + 0.01, z + t + p / 2);                       // rails
  k.box(W - 2 * f, f, p, m, x, y + 0.01 + H - f, z + t + p / 2);
  const zz = z + t + p;
  if (handle === 'bar') {                                                      // 5" bar pull on standoffs
    const L = Math.min(0.42, h * 0.35), hx = x + W / 2 - f / 2, hy = y + h - L - 0.18;
    k.cyl(0.017, 0.017, L, hm, hx, hy, zz + 0.07, 8);
    for (const e of [0.04, L - 0.04]) k.box(0.025, 0.025, 0.07, hm, hx, hy + e - 0.0125, zz + 0.035);
  }
  if (handle === 'pull') {
    const L = Math.min(0.42, w * 0.4);
    k.rod(x - L / 2, zz + 0.07, x + L / 2, zz + 0.07, y + h - 0.2, 0.017, hm);
    for (const e of [-L / 2 + 0.04, L / 2 - 0.04]) k.box(0.025, 0.025, 0.07, hm, x + e, y + h - 0.2125, zz + 0.035);
  }
  if (handle === 'knob') { k.cyl(0.018, 0.018, 0.05, hm, x + W / 2 - f / 2, y + h / 2, zz + 0.025, 8).rotation.x = Math.PI / 2; k.sph(0.05, hm, x + W / 2 - f / 2, y + h / 2, zz + 0.07); }
}

function drawerFront(k, w, h, z, m, x, y, hm = M.nickel()) {
  if (h > 0.4) { shaker(k, w, h, z, m, x, y, 'none', hm); }                     // shaker-profile drawer
  else k.box(w - 0.03, h - 0.03, 0.06, m, x, y + 0.015, z + 0.03);             // slab drawer
  const L = Math.min(0.5, w * 0.35), zz = z + (h > 0.4 ? 0.072 : 0.06);
  k.rod(x - L / 2, zz + 0.065, x + L / 2, zz + 0.065, y + h / 2, 0.017, hm);
  for (const e of [-L / 2 + 0.04, L / 2 - 0.04]) k.box(0.025, 0.025, 0.065, hm, x + e, y + h / 2 - 0.0125, zz + 0.032);
}

function books(k, x0, x1, y, z, depth, rnd, maxH = 0.85) {
  const cols = ['#8a2f2f', '#2f4f7a', '#3d6b45', '#c9a050', '#5a3a6a', '#d8d2c4', '#262626', '#b8562c'];
  let x = x0;
  while (x < x1 - 0.1) {
    if (rnd() < 0.12) { x += 0.3 + rnd() * 0.4; continue; }
    const bw = 0.08 + rnd() * 0.1, bh = maxH * (0.6 + rnd() * 0.4);
    k.box(bw, bh, depth * (0.7 + rnd() * 0.25), M.plain(cols[(rnd() * cols.length) | 0], 0.8), x + bw / 2, y, z);
    x += bw + 0.005;
  }
}

function cushion(k, w, h, d, m, x, y, z) { return k.rbox(w, h, d, Math.min(0.18, h / 2.2), m, x, y, z); }

function pot(k, rad, h, m, x = 0, z = 0) {
  k.cyl(rad, rad * 0.75, h, m, x, 0, z, 18);
  k.cyl(rad * 0.92, rad * 0.92, 0.02, M.soil(), x, h - 0.05, z, 18);
}

function foliage(k, x, y, z, rad, color, rnd, n = 6, flat = 1) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, rr = rad * (0.25 + rnd() * 0.45);
    const c = new THREE.Color(color).offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.12);
    k.ico(rad * (0.45 + rnd() * 0.35), M.leaf('#' + c.getHexString()),
      x + Math.cos(a) * rr, y + (rnd() - 0.3) * rad * 0.6 * flat, z + Math.sin(a) * rr, 1, flat, 1, 1);
  }
}

// ── Builders: (k, w, d, h, c, c2, item, ctx) ────────────────────────────────
const B = {};

// Bedroom
B.bed = (k, w, d, h, c, c2, it) => {
  const frame = it.pattern === 'wood' ? M.wood(c2) : M.plain(c2, 0.5);
  const railH = 1.0, mt = Math.max(0.5, h - railH);
  const pat = it.pattern === 'stripes' ? mat('stripes', c, { roughness: 0.95, tile: 3 })
            : it.pattern === 'floral'  ? mat('floral',  c, { roughness: 0.95, tile: 3 })
            : M.fabric(c);
  k.box(w, railH - 0.3, d - 0.3, frame, 0, 0.3, 0.05);
  legs4(k, w, d - 0.2, 0.3, 0.12, frame, 0.15, false);
  k.rbox(w - 0.12, mt, d - 0.5, 0.12, M.linen(), 0, railH, 0.1);
  const cov = (d - 0.5) * 0.76;
  k.rbox(w + 0.06, mt * 0.8 + 0.18, cov, 0.1, pat, 0, railH + mt * 0.2, 0.1 + (d - 0.5) / 2 - cov / 2 + 0.02);
  k.rbox(w + 0.04, 0.12, 0.9, 0.05, M.linen(), 0, railH + mt - 0.02, 0.1 + (d - 0.5) / 2 - cov - 0.25); // sheet fold
  const n = w < 4 ? 1 : 2, pw = Math.min(2.4, (w - 0.4) / n);
  for (let i = 0; i < n; i++) {
    const x = -((n - 1) * pw) / 2 + i * pw;
    k.rbox(pw - 0.15, 0.45, 1.15, 0.2, M.linen(), x, railH + mt - 0.05, -d / 2 + 0.95);
    k.rbox(pw * 0.55, 0.4, 0.3, 0.15, M.fabric(c), x, railH + mt, -d / 2 + 1.6);  // accent pillow
  }
  const hbH = it.headboard ?? 4.3;
  k.box(w + 0.25, hbH, 0.22, frame, 0, 0, -d / 2 + 0.11);
  k.box(w + 0.45, 0.14, 0.32, frame, 0, hbH, -d / 2 + 0.11);
  for (const sx of [-1, 1]) k.box(0.22, hbH + 0.15, 0.3, frame, sx * (w / 2 + 0.05), 0, -d / 2 + 0.11);
  k.box(w - 0.5, hbH - 1.8, 0.05, frame, 0, railH + 0.4, -d / 2 + 0.24);   // inset panel
  if (it.footboard !== false) k.box(w + 0.25, railH + 0.5, 0.2, frame, 0, 0, d / 2 - 0.1);
};

B.bunk = (k, w, d, h, c, c2) => {
  const fm = M.wood(c2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.25, h, 0.25, fm, sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.12));
  for (const y of [0.9, h * 0.6]) {
    k.box(w, 0.35, d, fm, 0, y, 0);
    k.rbox(w - 0.3, 0.55, d - 0.3, 0.1, M.linen(), 0, y + 0.35, 0);
    k.rbox(w - 0.25, 0.2, (d - 0.3) * 0.75, 0.08, M.fabric(c), 0, y + 0.75, d * 0.1);
    k.rbox(w - 0.8, 0.35, 0.9, 0.15, M.linen(), 0, y + 0.85, -d / 2 + 0.7);
  }
  k.box(w, 0.15, 0.08, fm, 0, h * 0.6 + 1.3, d / 2 - 0.12);
  for (let y = 1.4; y < h * 0.6; y += 0.8) k.box(0.9, 0.08, 0.08, fm, w / 2 - 0.7, y, d / 2 + 0.05);
};

B.crib = (k, w, d, h, c, c2) => {
  const fm = M.plain(c2, 0.5);
  k.box(w, 0.25, d, fm, 0, 1.2, 0);
  k.rbox(w - 0.15, 0.4, d - 0.15, 0.08, M.linen(), 0, 1.45, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.18, h, 0.18, fm, sx * (w / 2 - 0.09), 0, sz * (d / 2 - 0.09));
  for (const sz of [-1, 1]) { k.box(w, 0.12, 0.12, fm, 0, h - 0.12, sz * (d / 2 - 0.06)); for (let x = -w / 2 + 0.25; x < w / 2 - 0.1; x += 0.22) k.box(0.06, h - 1.4, 0.06, fm, x, 1.3, sz * (d / 2 - 0.06)); }
  for (const sx of [-1, 1]) { k.box(0.12, 0.12, d, fm, sx * (w / 2 - 0.06), h - 0.12, 0); for (let z = -d / 2 + 0.25; z < d / 2 - 0.1; z += 0.22) k.box(0.06, h - 1.4, 0.06, fm, sx * (w / 2 - 0.06), 1.3, z); }
};

B.nightstand = (k, w, d, h, c) => {
  const m = c.toLowerCase() > '#d' ? M.plain(c, 0.45) : M.wood(c);
  k.box(w, h - 0.35, d, m, 0, 0.35, 0);
  k.box(w + 0.06, 0.08, d + 0.06, m, 0, h - 0.08, 0);
  legs4(k, w, d, 0.35, 0.06, m, 0.1, false);
  const rows = 2, rh = (h - 0.55) / rows;
  for (let i = 0; i < rows; i++) {
    k.box(w - 0.12, rh - 0.05, 0.05, m, 0, 0.4 + i * rh, d / 2);
    k.sph(0.05, M.nickel(), 0, 0.4 + i * rh + rh / 2, d / 2 + 0.07);
  }
};

B.dresser = (k, w, d, h, c) => {
  const m = c.toLowerCase() > '#d' ? M.plain(c, 0.45) : M.wood(c);
  k.box(w, h - 0.3, d, m, 0, 0.3, 0);
  k.box(w + 0.08, 0.1, d + 0.06, m, 0, h - 0.1, 0);
  k.box(w, 0.3, d - 0.1, m, 0, 0, 0);
  const rows = Math.max(2, Math.round((h - 0.5) / 0.75)), cols = w > 3.6 ? 2 : 1;
  const rh = (h - 0.5) / rows, cw = (w - 0.1) / cols;
  for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
    const x = -w / 2 + 0.05 + cw * col + cw / 2, y = 0.35 + r * rh;
    k.box(cw - 0.06, rh - 0.06, 0.05, m, x, y, d / 2);
    for (const sx of cols === 1 ? [-0.25, 0.25] : [0]) k.sph(0.045, M.nickel(), x + sx * cw, y + rh / 2, d / 2 + 0.07);
  }
};

B.wardrobe = (k, w, d, h, c) => {
  const m = M.wood(c);
  k.box(w, h - 0.3, d, m, 0, 0.3, 0);
  k.box(w + 0.15, 0.2, d + 0.1, m, 0, h - 0.2, 0);
  k.box(w, 0.3, d - 0.1, m, 0, 0, 0);
  for (const sx of [-1, 1]) shaker(k, w / 2 - 0.04, h - 0.7, d / 2, m, sx * w / 4, 0.4, 'knob');
};

B.closet = (k, w, d, h, c, c2, it) => {     // walk-in closet shelving & hanging clothes
  const m = M.plain(c, 0.5), rnd = seeded(it.id);
  k.box(w, h, 0.05, m, 0, 0, -d / 2 + 0.025);
  for (const sx of [-1, 1]) k.box(0.06, h, d, m, sx * (w / 2 - 0.03), 0, 0);
  k.box(w, 0.06, d, m, 0, h - 1.2, 0);
  k.box(w, 0.06, d, m, 0, h - 0.4, 0);
  k.rod(-w / 2, 0, w / 2, 0, h - 1.4, 0.04, M.chrome());
  const cols = ['#f0e6d8', '#c0392b', '#2c3e50', '#e8a0b8', '#7f8c8d', '#2e86ab', '#ffffff', '#3d3d3d', '#f39c12', '#8e44ad'];
  for (let x = -w / 2 + 0.2; x < w / 2 - 0.15; x += 0.14 + rnd() * 0.08) {
    const len = 2 + rnd() * 1.6;
    k.box(0.08, len, d * 0.8, M.fabric(cols[(rnd() * cols.length) | 0]), x, h - 1.45 - len, 0);
  }
  for (let x = -w / 2 + 0.3; x < w / 2 - 0.3; x += 0.6 + rnd() * 0.3)
    k.box(0.45, 0.25 + rnd() * 0.3, d * 0.7, M.fabric(cols[(rnd() * cols.length) | 0]), x, h - 1.14, 0);
};

B.bench = (k, w, d, h, c, c2) => {
  legs4(k, w, d, h - 0.3, 0.08, M.wood(c2), 0.15);
  k.box(w, 0.1, d, M.wood(c2), 0, h - 0.35, 0);
  cushion(k, w - 0.05, 0.3, d - 0.05, M.fabric(c), 0, h - 0.3, 0);
};

B.mirror = (k, w, d, h, c) => {
  k.box(w, h, Math.min(d, 0.12), M.wood(c), 0, 0, 0);
  k.box(w - 0.3, h - 0.3, 0.02, M.mirror(), 0, 0.15, Math.min(d, 0.12) / 2 + 0.005);
};

B.floorMirror = (k, w, d, h, c) => {
  k.group(s => { B.mirror(s, w, 0.12, h, c); }, 0, 0, 0).rotation.x = -0.12;
  k.box(w * 0.9, 0.08, d, M.black(), 0, 0, 0);
};

// Living

B.coffeeTable = (k, w, d, h, c) => {
  const m = M.wood(c);
  k.box(w, 0.14, d, m, 0, h - 0.14, 0);
  k.box(w - 0.4, 0.06, d - 0.4, m, 0, 0.45, 0);
  legs4(k, w, d, h - 0.14, 0.12, m, 0.18, false);
};

B.sideTable = (k, w, d, h, c) => {
  const m = M.wood(c);
  k.box(w, 0.1, d, m, 0, h - 0.1, 0);
  k.box(w - 0.15, 0.5, d - 0.15, m, 0, h - 0.6, 0);
  legs4(k, w, d, h - 0.6, 0.06, m, 0.12);
};

B.tvStand = (k, w, d, h, c) => {
  const m = c.toLowerCase() > '#7' ? M.plain(c, 0.5) : M.wood(c);
  k.box(w, h - 0.3, d, m, 0, 0.3, 0);
  legs4(k, w, d, 0.3, 0.06, m, 0.2);
  const n = Math.max(2, Math.round(w / 1.4)), dw = w / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + dw * i + dw / 2;
    if (i === 0 || i === n - 1) shaker(k, dw - 0.04, h - 0.4, d / 2, m, x, 0.35, 'knob');
    else k.box(dw - 0.06, h - 0.5, 0.02, M.black(), x, 0.4, d / 2 - 0.15);
  }
};

B.mediaFireplace = (k, w, d, h, c) => {    // electric-fireplace TV console (primary bedroom photo)
  const m = M.wood(c);
  k.box(w, h - 0.25, d, m, 0, 0.25, 0);
  k.box(w + 0.1, 0.1, d + 0.08, m, 0, h - 0.1, 0);
  k.box(w * 0.42, h * 0.5, 0.05, M.blackGl(), 0, 0.45, d / 2);
  k.box(w * 0.36, 0.15, 0.05, mat('plain', '#ff8a3c', { emissive: '#ff5a10', emissiveIntensity: 1.2 }), 0, 0.6, d / 2 + 0.01);
  for (const sx of [-1, 1]) shaker(k, w * 0.25, h - 0.55, d / 2, m, sx * w * 0.36, 0.35, 'knob');
};

B.bookshelf = (k, w, d, h, c, c2, it) => {
  const m = c.toLowerCase() > '#d' ? M.plain(c, 0.5) : M.wood(c), rnd = seeded(it.id);
  k.box(w, h, 0.05, m, 0, 0, -d / 2 + 0.025);
  for (const sx of [-1, 1]) k.box(0.08, h, d, m, sx * (w / 2 - 0.04), 0, 0);
  const n = Math.max(2, Math.round(h / 1.2));
  for (let i = 0; i <= n; i++) {
    const y = i === n ? h - 0.08 : i * (h - 0.08) / n;
    k.box(w, 0.08, d, m, 0, y, 0);
    if (i < n) books(k, -w / 2 + 0.1, w / 2 - 0.1, y + 0.08, 0, d * 0.8, rnd, Math.min(0.9, (h - 0.08) / n - 0.2));
  }
};

B.floorLamp = (k, w, d, h) => {
  k.cyl(w * 0.4, w * 0.45, 0.08, M.iron(), 0, 0, 0);
  k.cyl(0.035, 0.035, h - 1, M.iron(), 0, 0.08, 0, 8);
  k.cyl(w * 0.35, w * 0.5, 1.0, M.shade(), 0, h - 1, 0, 20);
  k.sph(0.18, M.bulb(), 0, h - 0.6, 0);
};

B.tableLamp = (k, w, d, h, c) => {
  k.sph(w * 0.3, M.plain(c, 0.2), 0, w * 0.3, 0, 1, 1.15, 1);
  k.cyl(0.03, 0.03, h * 0.3, M.nickel(), 0, w * 0.6, 0, 8);
  k.cyl(w * 0.32, w * 0.5, h * 0.42, M.shade(), 0, h * 0.58, 0, 20);
};

B.rug = (k, w, d, h, c, c2, it) => {
  const m = mat('rug', c, { roughness: 1, tile: 1 });
  if (it.type.includes('round')) {
    const mesh = k.cyl(w / 2, w / 2, 0.04, m, 0, 0, 0, 40);
    mesh.scale.z = d / w;
  } else k.boxUnit(w, 0.04, d, m, 0, 0, 0);
};

B.plant = (k, w, d, h, c, c2, it) => {
  const rnd = seeded(it.id), potH = Math.min(h * 0.3, 1.2);
  pot(k, w * 0.3, potH, M.plain(c2 || '#c56a3a', 0.6));
  if (h > 3) {   // tall leafy plant
    k.cyl(0.04, 0.05, h * 0.55, M.bark(), 0, potH, 0, 6);
    for (let i = 0; i < 14; i++) {
      const a = rnd() * 6.28, y = potH + h * (0.35 + rnd() * 0.55);
      const leaf = k.box(0.05, w * 0.45, 0.02, M.leaf(c), Math.cos(a) * w * 0.18, y - w * 0.2, Math.sin(a) * w * 0.18);
      leaf.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      leaf.scale.x = 4;
    }
    foliage(k, 0, potH + h * 0.65, 0, w * 0.4, c, rnd, 5);
  } else foliage(k, 0, potH + h * 0.3, 0, w * 0.45, c, rnd, 6);
};

B.piano = (k, w, d, h, c) => {
  const m = M.plain(c, 0.15);
  k.box(w, h, d * 0.55, m, 0, 0, -d / 2 + d * 0.275);
  k.box(w, 0.25, d * 0.45, m, 0, 2.2, -d / 2 + d * 0.55 + d * 0.2);
  k.box(w - 0.4, 0.06, d * 0.3, M.porcelain(), 0, 2.45, -d / 2 + d * 0.55 + d * 0.15);
  for (const sx of [-1, 1]) k.box(0.15, 2.2, 0.15, m, sx * (w / 2 - 0.1), 0, d / 2 - 0.4);
};

B.petBed = (k, w, d, h, c) => {
  const m = M.fabric(c);
  k.rbox(w, h, d, h / 2.1, m, 0, 0, 0);
  k.rbox(w - 0.5, 0.2, d - 0.5, 0.09, M.fabric('#d8cbb8'), 0, h - 0.05, 0);
};

// Dining
B.diningTable = (k, w, d, h, c) => {
  const m = M.wood(c);
  k.box(w, 0.13, d, m, 0, h - 0.13, 0);
  k.box(w - 0.6, 0.3, d - 0.6, m, 0, h - 0.43, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - 0.35), z = sz * (d / 2 - 0.35);
    k.cyl(0.11, 0.08, h - 0.13, m, x, 0, z, 10);
    k.sph(0.13, m, x, h * 0.6, z);
  }
};

B.diningChair = (k, w, d, h, c, c2) => {
  const m = M.wood(c), seatH = 1.5;
  legs4(k, w, d, seatH, 0.055, m, 0.1);
  k.box(w, 0.12, d, m, 0, seatH, 0);
  cushion(k, w - 0.12, 0.12, d - 0.15, M.fabric(c2), 0, seatH + 0.1, 0.03);
  for (const sx of [-1, 1]) k.box(0.1, h - seatH, 0.1, m, sx * (w / 2 - 0.1), seatH, -d / 2 + 0.08);
  k.box(w - 0.1, 0.22, 0.08, m, 0, h - 0.25, -d / 2 + 0.08);
  k.box(w * 0.3, h - seatH - 0.4, 0.05, m, 0, seatH + 0.12, -d / 2 + 0.08);   // vase splat
};

B.hutch = (k, w, d, h, c, c2, it) => {
  const m = M.wood(c), rnd = seeded(it.id);
  const lowH = 2.7;
  k.box(w, lowH, d, m, 0, 0, 0);
  for (const sx of [-1, 1]) shaker(k, w / 2 - 0.06, lowH - 0.9, d / 2, m, sx * w / 4, 0.25, 'knob');
  for (const sx of [-1, 1]) drawerFront(k, w / 2 - 0.06, 0.5, d / 2, m, sx * w / 4, lowH - 0.62);
  k.box(w + 0.12, 0.1, d + 0.1, m, 0, lowH, 0);
  const ud = d * 0.6, uz = -d / 2 + ud / 2;
  k.box(w, h - lowH - 0.35, 0.05, m, 0, lowH + 0.1, -d / 2 + 0.025);
  for (const sx of [-1, 1]) k.box(0.1, h - lowH - 0.35, ud, m, sx * (w / 2 - 0.05), lowH + 0.1, uz);
  for (const y of [lowH + 1.1, lowH + 2.1]) {
    k.box(w - 0.2, 0.06, ud - 0.05, m, 0, y, uz);
    for (let x = -w / 2 + 0.4; x < w / 2 - 0.3; x += 0.45 + rnd() * 0.1) k.cyl(0.18, 0.18, 0.03, M.porcelain(), x, y + 0.3, uz - 0.05, 16).rotation.x = Math.PI / 2;
  }
  for (const sx of [-1, 1]) {
    k.box(w / 2 - 0.08, h - lowH - 0.45, 0.02, M.glass(), sx * w / 4, lowH + 0.15, -d / 2 + ud);
    k.box(w / 2 - 0.08, 0.08, 0.04, m, sx * w / 4, lowH + 0.15, -d / 2 + ud);
    k.box(w / 2 - 0.08, 0.08, 0.04, m, sx * w / 4, h - 0.4, -d / 2 + ud);
  }
  k.box(w + 0.25, 0.25, ud + 0.12, m, 0, h - 0.25, uz);
};

B.sideboard = (k, w, d, h, c) => {
  const m = M.wood(c);
  k.box(w, h - 0.4, d, m, 0, 0.4, 0);
  k.box(w + 0.08, 0.08, d + 0.06, m, 0, h - 0.08, 0);
  legs4(k, w, d, 0.4, 0.07, m, 0.12);
  const n = Math.max(2, Math.round(w / 1.5));
  for (let i = 0; i < n; i++) shaker(k, w / n - 0.05, h - 0.6, d / 2, m, -w / 2 + (i + 0.5) * w / n, 0.45, 'knob');
};

B.cubeShelf = (k, w, d, h, c, c2, it) => {  // white cube organizer with wicker baskets
  const m = M.plain(c, 0.5), rnd = seeded(it.id);
  const cols = Math.max(1, Math.round(w / 1.1)), rows = Math.max(1, Math.round(h / 1.1));
  k.box(w, h, 0.03, m, 0, 0, -d / 2 + 0.015);
  for (let i = 0; i <= cols; i++) k.box(0.06, h, d, m, -w / 2 + i * (w - 0.06) / cols + 0.03, 0, 0);
  for (let j = 0; j <= rows; j++) k.box(w, 0.06, d, m, 0, j * (h - 0.06) / rows, 0);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    if (rnd() < 0.55) {
      const cw = (w - 0.06) / cols, ch = (h - 0.06) / rows;
      k.box(cw - 0.12, ch - 0.12, d - 0.08, mat('fabric', rnd() < 0.5 ? '#8a6a44' : '#a88d64', { roughness: 1 }), -w / 2 + 0.03 + (i + 0.5) * cw, 0.09 + j * ch, 0.02);
    }
  }
};

// Kitchen
B.pantry = (k, w, d, h, c) => {
  const m = M.plain(c, 0.45);
  k.box(w, 0.35, d - 0.2, M.black(), 0, 0, -0.1);
  k.box(w, h - 0.35, d, m, 0, 0.35, 0);
  const n = Math.max(1, Math.round(w / 1.5));
  for (let i = 0; i < n; i++) {
    shaker(k, w / n - 0.04, (h - 0.4) * 0.6, d / 2, m, -w / 2 + (i + 0.5) * w / n, 0.38, 'bar');
    shaker(k, w / n - 0.04, (h - 0.4) * 0.4 - 0.04, d / 2, m, -w / 2 + (i + 0.5) * w / n, 0.38 + (h - 0.4) * 0.6 + 0.02, 'bar');
  }
};

B.microwave = (k, w, d, h) => {
  const s = M.steel();
  k.box(w, h, d, s, 0, 0, 0);
  k.box(w * 0.68, h * 0.75, 0.02, M.blackGl(), -w * 0.12, h * 0.12, d / 2);
  k.box(w * 0.2, h * 0.75, 0.02, M.black(), w * 0.36, h * 0.12, d / 2);
};

B.ceilingLight = (k, w, d, h) => {
  k.cyl(w * 0.5, w * 0.42, h, lampMat('#f6f4ee', '#ffe9c4', 0.9, { roughness: 0.3 }), 0, 0, 0, 24);
  k.cyl(w * 0.52, w * 0.52, 0.04, M.nickel(), 0, h - 0.04, 0, 24);
};

B.lantern = (k, w, d, h, c, c2, it, ctx) => {   // porch pendant lantern
  const drop = Math.max(0.2, (ctx.ceil ?? 8) - (it.lift ?? 6) - h);
  k.cyl(0.015, 0.015, drop, M.iron(), 0, h, 0, 6);
  k.cyl(w * 0.35, w * 0.45, h * 0.75, lampMat('#f0e8d0', '#ffd890', 0.8, { roughness: 0.1, transparent: true, opacity: 0.55 }), 0, h * 0.12, 0, 12);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.box(0.03, h * 0.8, 0.03, M.iron(), Math.cos(a) * w * 0.4, h * 0.1, Math.sin(a) * w * 0.4); }
  k.cone(w * 0.5, h * 0.2, M.iron(), 0, h * 0.82, 0, 12);
  k.cyl(w * 0.45, w * 0.3, 0.06, M.iron(), 0, 0.05, 0, 12);
};

// Bathroom
B.toilet = (k, w, d, h) => {
  const p = M.porcelain();
  k.cyl(0.42 * w / 1.5, 0.35 * w / 1.5, 1.05, p, 0, 0, d * 0.05, 20).scale.z = 1.3;
  k.sph(0.62 * w / 1.5, p, 0, 1.15, d * 0.12, 1, 0.42, 1.3, 20);
  const seat = k.torus(0.5 * w / 1.5, 0.08, M.white(), 0, 1.42, d * 0.12); seat.rotation.x = Math.PI / 2; seat.scale.y = 1.3;
  k.rbox(w * 0.95, h - 1.5, 0.65, 0.08, p, 0, 1.5, -d / 2 + 0.33);
  k.rbox(w, 0.12, 0.72, 0.05, p, 0, h - 0.12, -d / 2 + 0.33);
  k.box(0.18, 0.04, 0.04, M.chrome(), -w / 2 + 0.2, h - 0.4, -d / 2 + 0.7);
};

B.vanity = (k, w, d, h, c, c2, it) => {
  const m = c.toLowerCase() > '#b' ? M.plain(c, 0.45) : M.wood(c, 0.5);
  k.box(w, h - 0.15, d - 0.05, m, 0, 0, -0.025);
  k.box(w + 0.1, 0.15, d + 0.05, mat('concrete', c2, { roughness: 0.2 }), 0, h - 0.15, 0.025);
  const n = w > 3.5 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * w / n;
    if (i === n - 1 && n === 3) for (let j = 0; j < 3; j++) drawerFront(k, w / n - 0.04, (h - 0.35) / 3, d / 2 - 0.05, m, x, 0.1 + j * (h - 0.35) / 3);
    else shaker(k, w / n - 0.04, h - 0.4, d / 2 - 0.05, m, x, 0.1, 'bar');
  }
  const bx = n === 3 ? -w / 6 : 0;
  k.cyl(0.6, 0.55, 0.06, M.porcelain(), bx, h, 0.05, 24).scale.z = 0.8;
  k.cyl(0.035, 0.035, 0.7, M.nickel(), bx, h, -d / 2 + 0.25, 8);
  k.box(0.04, 0.04, 0.5, M.nickel(), bx, h + 0.66, -d / 2 + 0.45);
  k.cyl(0.04, 0.04, 0.2, M.nickel(), bx - 0.35, h, -d / 2 + 0.25, 8);
  k.cyl(0.04, 0.04, 0.2, M.nickel(), bx + 0.35, h, -d / 2 + 0.25, 8);
};

B.tub = (k, w, d, h, c, c2, it) => {
  const p = M.porcelain();
  k.box(w, h, d, p, 0, 0, 0);
  k.box(w - 0.5, 0.05, d - 0.45, mat('plain', '#e9eef2', { roughness: 0.08 }), 0, h - 0.02, 0);
  k.box(0.08, 0.06, 0.45, M.chrome(), w / 2 - 0.35, h + 0.6, -d / 2 + 0.2);
  if (it.curtain !== false) {
    k.rod(-w / 2, d / 2 - 0.1, w / 2, d / 2 - 0.1, 6.6, 0.025, M.chrome());
    const cur = mat('fabric', c, { roughness: 1 });
    for (let i = 0; i < 10; i++) k.box(w * 0.35 / 10 + 0.05, 6.4 - h, 0.06, cur, w / 2 - 0.1 - i * (w * 0.35 / 10), h + 0.1, d / 2 - 0.1 + (i % 2 ? 0.05 : -0.05));
    k.cyl(0.18, 0.12, 0.08, M.chrome(), w / 2 - 0.4, 6.0, -d / 2 + 0.15, 12).rotation.x = -0.6;
  }
};

B.shower = (k, w, d, h, c, c2) => {   // glass enclosure with subway-tiled back & left walls
  const tile = mat('subway', c, { roughness: 0.25, tile: 4 });
  k.box(w, 0.25, d, M.porcelain(), 0, 0, 0);
  k.box(w - 0.2, 0.02, d - 0.2, mat('mosaic', '#6f7377', { roughness: 0.5, tile: 2 }), 0, 0.24, 0);
  k.box(w, h, 0.12, tile, 0, 0, -d / 2 + 0.06);
  k.box(0.12, h, d, tile, -w / 2 + 0.06, 0, 0);
  k.box(0.02, h - 0.6, d - 0.15, M.glass(), w / 2 - 0.02, 0.25, 0);
  k.box(w - 0.15, h - 0.6, 0.02, M.glass(), 0, 0.25, d / 2 - 0.02);
  k.box(0.04, 1.2, 0.04, M.chrome(), w * 0.1, 2.8, d / 2 + 0.03);
  k.cyl(0.25, 0.25, 0.05, M.chrome(), -w * 0.1, 6.4, -d / 2 + 0.6, 20);
  k.cyl(0.03, 0.03, 0.6, M.chrome(), -w * 0.1, 6.45, -d / 2 + 0.3, 6).rotation.x = Math.PI / 2;
  k.cyl(0.12, 0.12, 0.08, M.chrome(), -w * 0.1, 3.8, -d / 2 + 0.15, 16).rotation.x = Math.PI / 2;
  for (const y of [3.5, 4.4]) { const s = k.cyl(0.4, 0.4, 0.04, M.chrome(), -w / 2 + 0.12, y, -d / 2 + 0.12, 4); s.rotation.y = Math.PI / 4; s.scale.set(0.7, 1, 0.7); }
};

B.washer = (k, w, d, h, c, c2, it) => {
  const m = M.plain(c, 0.35);
  const one = (y, hh, dryer) => {
    k.box(w, hh, d, m, 0, y, 0);
    k.box(w - 0.1, 0.35, 0.02, M.plain('#d8dadc', 0.3), 0, y + hh - 0.4, d / 2);
    k.box(0.5, 0.2, 0.02, M.blackGl(), w * 0.15, y + hh - 0.33, d / 2 + 0.01);
    const r = Math.min(w, hh) * 0.3;
    k.torus(r, 0.07, M.steel(), 0, y + hh * 0.42, d / 2 + 0.03);
    k.cyl(r, r, 0.02, dryer ? M.blackGl() : mat('plain', '#9fb4c0', { roughness: 0.05, transparent: true, opacity: 0.6 }), 0, y + hh * 0.42, d / 2 + 0.02, 24).rotation.x = Math.PI / 2;
  };
  if (it.stacked) { one(0, h / 2, false); one(h / 2, h / 2, true); }
  else one(0, h, it.type === 'dryer');
};

B.utilitySink = (k, w, d, h) => {
  const p = M.plain('#e8e6df', 0.5);
  legs4(k, w, d, h - 1.1, 0.06, p, 0.1, false);
  k.box(w, 1.1, d, p, 0, h - 1.1, 0);
  k.box(w - 0.2, 0.02, d - 0.2, M.plain('#cfcdc6', 0.4), 0, h, 0);
  k.cyl(0.035, 0.035, 1, M.chrome(), 0, h, -d / 2 + 0.15, 8);
};

// Office
B.desk = (k, w, d, h, c) => {
  const m = M.wood(c);
  k.box(w, 0.12, d, m, 0, h - 0.12, 0);
  k.box(1.3, h - 0.12, d - 0.1, m, w / 2 - 0.7, 0, 0);
  for (let i = 0; i < 3; i++) drawerFront(k, 1.25, (h - 0.25) / 3, d / 2 - 0.05, m, w / 2 - 0.7, 0.08 + i * (h - 0.25) / 3);
  k.box(0.12, h - 0.12, d - 0.1, m, -w / 2 + 0.06, 0, 0);
  k.box(w - 1.4, 0.8, 0.05, m, -0.65, h - 1, -d / 2 + 0.1);
};

B.lDesk = (k, w, d, h, c) => {
  const m = M.wood(c);
  k.box(w, 0.12, 2, m, 0, h - 0.12, -d / 2 + 1);
  k.box(2, 0.12, d - 2, m, w / 2 - 1, h - 0.12, 1);
  for (const [x, z] of [[-w / 2 + 0.1, -d / 2 + 0.1], [-w / 2 + 0.1, -d / 2 + 1.9], [w / 2 - 0.1, d / 2 - 0.1], [w / 2 - 1.9, d / 2 - 0.1], [w / 2 - 0.1, -d / 2 + 0.1]])
    k.box(0.12, h - 0.12, 0.12, M.iron(), x, 0, z);
};

B.officeChair = (k, w, d, h, c) => {
  const m = M.fabric(c), b = M.black();
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const arm = k.box(w * 0.48, 0.08, 0.12, b, Math.cos(a) * w * 0.24, 0.12, Math.sin(a) * w * 0.24);
    arm.rotation.y = -a;
    k.sph(0.08, b, Math.cos(a) * w * 0.46, 0.08, Math.sin(a) * w * 0.46);
  }
  k.cyl(0.07, 0.07, 1.2, M.chrome(), 0, 0.15, 0, 10);
  cushion(k, w * 0.85, 0.3, d * 0.8, m, 0, 1.4, 0.05);
  cushion(k, w * 0.8, h - 2.1, 0.25, m, 0, 2.0, -d / 2 + 0.2).rotation.x = -0.1;
  for (const sx of [-1, 1]) { k.box(0.1, 0.6, 0.1, b, sx * w * 0.44, 1.5, 0); k.box(0.15, 0.08, d * 0.5, b, sx * w * 0.44, 2.1, 0); }
};

B.filing = (k, w, d, h, c) => {
  const m = M.plain(c, 0.4, { metalness: 0.4 });
  k.box(w, h, d, m, 0, 0, 0);
  const n = Math.max(2, Math.round(h / 1.3));
  for (let i = 0; i < n; i++) drawerFront(k, w - 0.08, h / n - 0.05, d / 2, m, 0, 0.03 + i * h / n);
};

B.antiqueDesk = (k, w, d, h, c) => {      // dark wood desk with brass pulls (photo)
  const m = M.wood(c, 0.35), brass = M.plain('#b08d57', 0.3, { metalness: 0.9 });
  k.box(w, 0.12, d, m, 0, h - 0.12, 0);
  for (const sx of [-1, 1]) {
    k.box(1.2, h - 0.12, d - 0.1, m, sx * (w / 2 - 0.62), 0, 0);
    for (let i = 0; i < 3; i++) drawerFront(k, 1.15, (h - 0.3) / 3, d / 2 - 0.05, m, sx * (w / 2 - 0.62), 0.1 + i * (h - 0.3) / 3, brass);
  }
  drawerFront(k, w - 2.6, 0.4, d / 2 - 0.05, m, 0, h - 0.55, brass);
};

// Architecture (doors & windows are cut into walls by the viewer — see `opening` in the catalog)
function casing(k, w, h, t, m, sill = true) {
  for (const sz of [-1, 1]) {
    const z = sz * (t / 2 + 0.03);
    k.box(0.3, h + 0.3, 0.06, m, -w / 2 - 0.15, 0, z);
    k.box(0.3, h + 0.3, 0.06, m, w / 2 + 0.15, 0, z);
    k.box(w + 0.6, 0.32, 0.08, m, 0, h, z);
  }
  k.box(0.08, h, t, m, -w / 2 + 0.04, 0, 0);
  k.box(0.08, h, t, m, w / 2 - 0.04, 0, 0);
  k.box(w, 0.08, t, m, 0, h - 0.08, 0);
  if (sill) k.box(w + 0.4, 0.1, t + 0.3, m, 0, -0.05, 0);
}

function doorLeaf(k, w, h, m, style, glass) {
  k.box(w, h, 0.15, m, w / 2, 0, 0);
  if (style === 'lite') {   // 9-lite upper glass + 2 lower panels (photo: side entry doors)
    k.box(w - 0.6, h * 0.42, 0.16, M.glass(), w / 2, h * 0.5, 0);
    for (let i = 1; i < 3; i++) { k.box(0.05, h * 0.42, 0.18, m, 0.3 + i * (w - 0.6) / 3, h * 0.5, 0); k.box(w - 0.6, 0.05, 0.18, m, w / 2, h * 0.5 + i * h * 0.14, 0); }
    for (const sx of [0.27, 0.73]) for (const sz of [-1, 1]) k.box(w * 0.32, h * 0.3, 0.02, m, w * sx, 0.4, sz * 0.08);
  } else if (style === 'glass') {
    k.box(w - 0.4, h - 0.6, 0.16, glass, w / 2, 0.3, 0);
  } else {                  // 2-panel shaker
    for (const sz of [-1, 1]) { k.box(w - 0.7, h * 0.42, 0.02, m, w / 2, h * 0.5, sz * 0.08); k.box(w - 0.7, h * 0.3, 0.02, m, w / 2, 0.45, sz * 0.08); }
  }
  for (const sz of [-1, 1]) k.sph(0.09, M.nickel(), w - 0.25, 3.0, sz * 0.12);
}

B.door = (k, w, d, h, c, c2, it, ctx) => {
  const t = ctx.wallT ?? 0.45, m = M.trim(), leafM = M.plain(c, 0.45);
  casing(k, w, h, t, m, false);
  const open = (it.open ?? 0) * Math.PI / 180;
  const leaves = it.type === 'door-double' || it.type === 'french-door' ? 2 : 1;
  const style = it.type === 'french-door' ? 'glass' : it.style;
  const lw = (w - 0.16) / leaves;
  for (let i = 0; i < leaves; i++) {
    const side = i === 0 ? -1 : 1;
    k.group(s => doorLeaf(s, lw, h - 0.08, leafM, style, M.glass()),
      side * (w / 2 - 0.08), 0, t / 2 - 0.1, side === -1 ? open : Math.PI - open).scale.z = 1;
  }
};

B.slider = (k, w, d, h, c, c2, it, ctx) => {
  const t = ctx.wallT ?? 0.45, m = M.plain(c, 0.4);
  casing(k, w, h, t, M.trim(), false);
  for (let i = 0; i < 2; i++) {
    const pw = w / 2 + 0.1, x = -w / 4 + i * w / 2 + (i ? -0.05 : 0.05), z = i ? -0.1 : 0.1;
    k.box(pw, 0.25, 0.15, m, x, 0.05, z);
    k.box(pw, 0.2, 0.15, m, x, h - 0.3, z);
    k.box(0.2, h - 0.15, 0.15, m, x - pw / 2 + 0.1, 0.05, z);
    k.box(0.2, h - 0.15, 0.15, m, x + pw / 2 - 0.1, 0.05, z);
    k.box(pw - 0.4, h - 0.55, 0.03, M.glass(), x, 0.3, z);
  }
  k.box(0.05, 0.6, 0.08, M.nickel(), 0.2, 3.0, 0.2);
};

B.window = (k, w, d, h, c, c2, it, ctx) => {
  const t = ctx.wallT ?? 0.45, m = M.plain(c, 0.4);
  casing(k, w, h, t, m, true);
  const grid = it.grid ?? true, picture = it.type === 'window-picture';
  const sashes = picture ? [[0.08, h - 0.16]] : [[0.08, h / 2], [h / 2 - 0.04, h / 2 - 0.04]];
  sashes.forEach(([y0, sh], i) => {
    const z = picture ? 0 : (i ? -0.06 : 0.06);
    k.box(w - 0.16, 0.14, 0.1, m, 0, y0, z);
    k.box(w - 0.16, 0.14, 0.1, m, 0, y0 + sh - 0.14, z);
    k.box(0.14, sh, 0.1, m, -w / 2 + 0.15, y0, z);
    k.box(0.14, sh, 0.1, m, w / 2 - 0.15, y0, z);
    k.box(w - 0.4, sh - 0.25, 0.02, M.glass(), 0, y0 + 0.12, z);
    if (grid) {
      const cols = Math.max(2, Math.round(w / 1.0)), rows = picture ? 3 : 2;
      for (let cI = 1; cI < cols; cI++) k.box(0.04, sh - 0.25, 0.05, m, -w / 2 + 0.2 + cI * (w - 0.4) / cols, y0 + 0.12, z);
      for (let rI = 1; rI < rows; rI++) k.box(w - 0.4, 0.04, 0.05, m, 0, y0 + 0.12 + rI * (sh - 0.25) / rows, z);
    }
  });
  if (it.shutters) for (const sx of [-1, 1]) {
    const sh = k.box(w * 0.38, h + 0.2, 0.08, M.plain(it.shutters, 0.6), sx * (w / 2 + 0.3 + w * 0.19), -0.1, t / 2 + 0.06);
    for (let y = 0.3; y < h; y += 0.25) k.box(w * 0.32, 0.03, 0.04, M.plain(it.shutters, 0.8), sx * (w / 2 + 0.3 + w * 0.19), y, t / 2 + 0.12);
    void sh;
  }
};

B.opening = (k, w, d, h, c, c2, it, ctx) => casing(k, w, h, ctx.wallT ?? 0.45, M.trim(), false);

B.garageDoor = (k, w, d, h, c, c2, it, ctx) => {
  const t = ctx.wallT ?? 0.45, m = M.plain(c, 0.45);
  casing(k, w, h, t, M.trim(), false);
  const rows = 4, rh = (h - 0.1) / rows, cols = Math.max(2, Math.round(w / 2));
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    k.box(w - 0.1, rh - 0.03, 0.12, m, 0, y, 0);
    for (let cI = 0; cI < cols; cI++) {
      const x = -w / 2 + 0.05 + (cI + 0.5) * (w - 0.1) / cols;
      for (const sz of [-1, 1]) {
        if (r === rows - 1 && sz === 1) k.box((w - 0.1) / cols - 0.35, rh - 0.5, 0.02, M.glass(), x, y + 0.25, 0.07);
        else k.box((w - 0.1) / cols - 0.35, rh - 0.5, 0.03, m, x, y + 0.25, sz * 0.07);
      }
    }
  }
  if (ctx.ceil) { // inside track & opener
    for (const sx of [-1, 1]) k.box(0.12, 0.12, 8, M.steel(), sx * (w / 2 - 0.05), h, -t / 2 - 4);
    k.box(0.15, 0.12, 8, M.steel(), 0, h + 0.4, -t / 2 - 4);
    k.box(1.2, 0.6, 1.4, M.plain('#e8e8e4', 0.6), 0, h + 0.2, -t / 2 - 8.5);
  }
};

B.stairs = (k, w, d, h, c, c2, it) => {
  // Bottom at +z (front), climbing toward -z. Closed stringers, white risers, oak treads.
  const n = Math.max(3, Math.round(h / 0.65)), rise = h / n, tr = d / n;
  const tread = M.wood(c, 0.5), white = M.trim();
  for (let i = 0; i < n; i++) {
    const z = d / 2 - (i + 0.5) * tr, ty = (i + 1) * rise;
    k.box(w, 0.08, tr + 0.08, tread, 0, ty - 0.08, z);
    k.box(w - 0.02, rise - 0.08, 0.04, white, 0, ty - rise, z + tr / 2);
    for (const sx of [-1, 1]) k.box(0.12, ty - 0.08, tr, white, sx * (w / 2 + 0.06), 0, z);
  }
  if (it.rail !== false) {
    const side = it.rail === 'left' ? -1 : 1, x = side * (w / 2 - 0.05);
    const r = k.box(0.12, 0.12, Math.hypot(d, h), M.wood(c2), x, 0, 0);
    r.position.y = h / 2 + 2.8; r.rotation.x = Math.atan2(h, d);
    for (let i = 0; i < n; i++) k.box(0.06, 2.8, 0.06, white, x, (i + 1) * rise, d / 2 - (i + 0.5) * tr);
  }
};

B.stairsDown = (k, w, d, h, c, c2, it) => {
  // Opening on this floor; flight descends toward +z. Top at y = 0 (back edge, -z).
  const n = Math.max(3, Math.round(h / 0.65)), rise = h / n, run = d / n;
  const tread = M.wood(c, 0.6), side = M.plain('#d9d5cc', 0.8);
  for (let i = 0; i < n; i++) {
    const z = -d / 2 + (i + 0.5) * run, ty = -(i + 1) * rise;
    k.box(w, 0.1, run + 0.05, tread, 0, ty, z);
    for (const sx of [-1, 1]) k.box(0.1, rise + 0.1, run, side, sx * (w / 2 + 0.05), ty, z);
  }
  stairRails(k, w, d, it);
};

function stairRails(k, w, d, it) {
  const m = M.trim(), rail = M.wood(it.color2 || '#6b4a2f');
  const sides = it.rails ?? ['right'];
  for (const s of sides) {
    let x1, z1, x2, z2;
    if (s === 'right') [x1, z1, x2, z2] = [w / 2, -d / 2, w / 2, d / 2];
    if (s === 'left')  [x1, z1, x2, z2] = [-w / 2, -d / 2, -w / 2, d / 2];
    if (s === 'back')  [x1, z1, x2, z2] = [-w / 2, -d / 2, w / 2, -d / 2];
    if (s === 'front') [x1, z1, x2, z2] = [-w / 2, d / 2, w / 2, d / 2];
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(2, Math.round(len / 0.4));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
      k.box(i === 0 || i === n ? 0.3 : 0.07, i === 0 || i === n ? 3.3 : 3, i === 0 || i === n ? 0.3 : 0.07, m, x, 0, z);
    }
    const r = k.box(Math.abs(x2 - x1) + 0.15, 0.12, Math.abs(z2 - z1) + 0.15, rail, (x1 + x2) / 2, 3, (z1 + z2) / 2);
    void r;
  }
}

B.stairOpening = (k, w, d, h, c, c2, it) => stairRails(k, w, d, it);

B.railing = (k, w, d, h, c) => {
  const m = M.plain(c, 0.6);
  for (let x = -w / 2; x <= w / 2 + 0.01; x += w / Math.max(1, Math.round(w / 0.33))) k.box(0.12, h, 0.12, m, x, 0, 0);
  k.box(w + 0.2, 0.15, 0.4, m, 0, h - 0.15, 0);
  k.box(w, 0.12, 0.2, m, 0, 0.3, 0);
};

B.steps = (k, w, d, h, c) => {
  const n = Math.max(1, Math.round(h / 0.6)), run = d / n, m = mat('deck', c, { roughness: 0.9, tile: 4 });
  for (let i = 0; i < n; i++) k.box(w, h - i * h / n, run + 0.02, m, 0, 0, -d / 2 + (i + 0.5) * run);
};

B.post = (k, w, d, h, c) => {
  const m = M.plain(c, 0.5);
  k.box(w + 0.15, 0.5, d + 0.15, m, 0, 0, 0);
  k.box(w, h - 0.8, d, m, 0, 0.5, 0);
  k.box(w + 0.2, 0.3, d + 0.2, m, 0, h - 0.3, 0);
};

B.halfWall = (k, w, d, h, c) => {
  k.box(w, h, d, M.plain(c, 0.85), 0, 0, 0);
  k.box(w + 0.1, 0.12, d + 0.15, M.wood('#a07850'), 0, h, 0);
};

B.chimney = (k, w, d, h) => {
  const br = mat('brick', '#8e3b2c', { roughness: 0.95, tile: 4 });
  k.box(w, h, d, br, 0, 0, 0);
  k.box(w + 0.3, 0.3, d + 0.3, br, 0, h - 0.6, 0);
  k.box(w + 0.1, 0.25, d + 0.1, M.concrete(), 0, h, 0);
  k.box(w * 0.45, 0.6, d * 0.45, M.plain('#5d4a3c', 0.8), 0, h + 0.25, 0);
};

B.bulkhead = (k, w, d, h, c) => {      // sloped steel cellar doors on a concrete curb; high end at the back (−z)
  k.box(w + 0.5, 0.45, d + 0.4, M.concrete(), 0, 0, 0);
  const prof = new THREE.Shape([[-d / 2, 0], [d / 2, 0], [d / 2, 0.45], [-d / 2, h - 0.45]].map(([a, b]) => new THREE.Vector2(a, b)));
  const geo = new THREE.ExtrudeGeometry(prof, { depth: w, bevelEnabled: false });
  const body = new THREE.Mesh(geo, M.plain(c, 0.5, { metalness: 0.45 }));
  body.rotation.y = -Math.PI / 2; body.position.set(w / 2, 0.45, 0);
  k.g.add(body);
  const ang = Math.atan2(h - 0.9, d), len = Math.hypot(d, h - 0.9);
  const seam = k.box(0.06, 0.04, len, M.iron(), 0, 0, 0); seam.position.y = 0.45 + (h - 0.9) / 2 + 0.47; seam.rotation.x = ang;
  for (const sx of [-1, 1]) { const hd = k.box(0.08, 0.06, 0.5, M.iron(), sx * 0.25, 0, 0); hd.position.y = 0.45 + (h - 0.9) / 2 + 0.5; hd.rotation.x = ang; }
};

B.wallArt = (k, w, d, h, c, c2, it) => {
  const rnd = seeded(it.id);
  k.box(w, h, 0.08, M.wood(c2 || '#2a2018', 0.4), 0, 0, 0);
  k.box(w - 0.25, h - 0.25, 0.02, M.plain('#f3efe6', 0.9), 0, 0.125, 0.045);
  for (let i = 0; i < 5; i++) {
    const col = new THREE.Color(c).offsetHSL(rnd() * 0.3, 0, (rnd() - 0.5) * 0.3);
    k.box((w - 0.6) * (0.2 + rnd() * 0.4), (h - 0.6) * (0.2 + rnd() * 0.4), 0.01, M.plain('#' + col.getHexString(), 0.9), (rnd() - 0.5) * (w - 0.9), 0.3 + rnd() * (h - 0.9), 0.06);
  }
};

// Utility / basement
B.boiler = (k, w, d, h, c) => {           // blue cast-iron boiler + burner
  const m = M.plain(c, 0.4, { metalness: 0.2 });
  k.rbox(w, h, d, 0.08, m, 0, 0, 0);
  k.rbox(w * 0.7, h * 0.35, 0.9, 0.06, m, 0, 0.3, d / 2 + 0.4);
  k.box(0.3, 0.2, 0.02, M.plain('#ffffff', 0.5), 0, h * 0.7, d / 2 + 0.01);
  const cu = M.plain('#b87333', 0.3, { metalness: 0.9 });
  k.cyl(0.08, 0.08, 2.2, cu, -w * 0.25, h, -d * 0.2, 10);
  k.cyl(0.08, 0.08, 2.2, cu, w * 0.25, h, -d * 0.2, 10);
  k.cyl(0.25, 0.25, 0.7, M.plain('#7a7c7e', 0.4, { metalness: 0.6 }), w * 0.35, h + 0.4, -d * 0.2, 14);
  k.cyl(0.25, 0.25, 2, M.steel(), 0, h, d * 0.2, 14);
};

B.waterHeater = (k, w, d, h) => {
  const m = M.plain('#f2f1ec', 0.45);
  k.cyl(w / 2, w / 2, h, m, 0, 0, 0, 28);
  k.cyl(w / 2 + 0.01, w / 2 + 0.01, 0.08, M.steel(), 0, h - 0.08, 0, 28);
  k.cyl(0.07, 0.07, 1, M.plain('#b87333', 0.3, { metalness: 0.9 }), -0.3, h, 0, 8);
  k.cyl(0.07, 0.07, 1, M.plain('#b87333', 0.3, { metalness: 0.9 }), 0.3, h, 0, 8);
  k.box(0.35, 0.25, 0.05, M.plain('#ffffff', 0.5), 0, h * 0.3, w / 2);
};

B.elecPanel = (k, w, d, h) => {
  k.box(w, h, d, M.plain('#8c9096', 0.4, { metalness: 0.5 }), 0, 0, 0);
  k.box(w - 0.15, h - 0.15, 0.02, M.plain('#9ea3a8', 0.35, { metalness: 0.5 }), 0, 0.075, d / 2);
  k.box(0.6, h * 0.3, 0.6, M.plain('#4b8b5a', 0.6), w * 0.9, h * 0.6, 0);
};

B.joists = (k, w, d, h, c) => {           // exposed floor joists + insulated duct trunk
  const m = M.wood(c, 0.9);
  for (let x = -w / 2 + 0.1; x <= w / 2; x += 1.33) k.box(0.15, h, d, m, x, 0, 0);
  const foil = mat('plain', '#d9dcdf', { roughness: 0.35, metalness: 0.7 });
  k.box(1.6, 0.9, d * 0.95, foil, w * 0.1, -0.9, 0);
  for (let z = -d / 2 + 2; z < d / 2 - 1; z += 4) k.cyl(0.25, 0.25, w * 0.3, foil, w * 0.1 + w * 0.15 + 0.8, -0.6 - w * 0.15, z, 12).rotation.z = Math.PI / 2;
  k.rod(-w / 2, -d / 2 + 1.5, w / 2, -d / 2 + 1.5, -0.15, 0.06, M.plain('#b87333', 0.3, { metalness: 0.9 }));
  k.rod(-w / 2, -d / 2 + 2, w / 2, -d / 2 + 2, -0.15, 0.06, M.plain('#b87333', 0.3, { metalness: 0.9 }));
};

B.metalShelf = (k, w, d, h, c, c2, it) => {
  const m = M.plain(c, 0.35, { metalness: 0.6 }), rnd = seeded(it.id);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.06, h, 0.06, m, sx * (w / 2 - 0.03), 0, sz * (d / 2 - 0.03));
  const n = 4;
  for (let i = 0; i < n; i++) {
    const y = 0.3 + i * (h - 0.4) / (n - 1);
    k.box(w, 0.04, d, m, 0, y, 0);
    if (i < n - 1) for (let x = -w / 2 + 0.3; x < w / 2 - 0.4; x += 0.7 + rnd() * 0.5) {
      const bh = 0.5 + rnd() * 0.6;
      k.box(0.6 + rnd() * 0.3, Math.min(bh, (h - 0.4) / (n - 1) - 0.1), d * 0.8, M.plain(rnd() < 0.6 ? '#b89668' : ['#3b6fb6', '#c0392b', '#e8e8e8'][(rnd() * 3) | 0], 0.9), x + 0.35, y + 0.04, 0);
    }
  }
};

B.workbench = (k, w, d, h, c) => {
  const m = M.wood(c, 0.8);
  legs4(k, w, d, h - 0.15, 0.1, m, 0.15, false);
  k.box(w, 0.15, d, m, 0, h - 0.15, 0);
  k.box(w - 0.2, 0.08, d - 0.2, m, 0, 0.6, 0);
  k.box(w, 2.5, 0.06, mat('plain', '#b8996e', { roughness: 0.9 }), 0, h, -d / 2 + 0.03);
  for (let i = 0; i < 6; i++) k.box(0.08, 0.6, 0.08, M.iron(), -w / 2 + 0.5 + i * (w - 1) / 5, h + 1.2, -d / 2 + 0.1);
};

// Garage / vehicles
B.mower = (k, w, d, h, c) => {           // ride-on lawn tractor
  const g = M.plain(c, 0.35), y = M.plain('#f2c230', 0.4);
  const wheel = (x, z, r, t) => { const tw = k.cyl(r, r, t, M.rubber(), x, r, z, 16); tw.rotation.z = Math.PI / 2; tw.position.y = r; k.cyl(r * 0.6, r * 0.6, t + 0.02, y, x, r, z, 12).rotation.z = Math.PI / 2; };
  wheel(-w / 2 + 0.25, -d / 2 + 0.7, 0.7, 0.5); wheel(w / 2 - 0.25, -d / 2 + 0.7, 0.7, 0.5);
  wheel(-w / 2 + 0.3, d / 2 - 0.6, 0.45, 0.35); wheel(w / 2 - 0.3, d / 2 - 0.6, 0.45, 0.35);
  k.rbox(w - 0.8, 0.7, d - 0.6, 0.1, g, 0, 0.6, 0);
  k.rbox(w - 1.2, 0.8, d * 0.4, 0.2, g, 0, 1.1, d / 2 - d * 0.22);
  k.box(w - 0.2, 0.25, 2.2, M.plain('#2b2b2b', 0.6), 0, 0.3, 0);
  k.rbox(1.4, 0.5, 1.2, 0.15, M.black(), 0, 1.3, -d / 2 + 1.1);
  k.rbox(1.4, 0.9, 0.3, 0.1, M.black(), 0, 1.6, -d / 2 + 0.6);
  k.cyl(0.04, 0.04, 1, M.black(), 0, 1.7, d * 0.12, 8).rotation.x = -0.5;
  k.torus(0.35, 0.05, M.black(), 0, 2.6, d * 0.02).rotation.x = Math.PI / 2 - 0.5;
};

B.trashBin = (k, w, d, h, c) => {
  const m = M.plain(c, 0.6);
  k.box(w, h - 0.15, d, m, 0, 0.1, 0).scale.set(1, 1, 1);
  k.box(w + 0.1, 0.12, d + 0.12, m, 0, h - 0.12, 0.03);
  for (const sx of [-1, 1]) { const wh = k.cyl(0.3, 0.3, 0.2, M.rubber(), sx * (w / 2 - 0.15), 0.3, -d / 2 + 0.15, 14); wh.rotation.z = Math.PI / 2; wh.position.y = 0.3; }
};

B.car = (k, w, d, h, c) => {
  const body = M.plain(c, 0.25, { metalness: 0.6 }), gl = mat('plain', '#1d2a33', { roughness: 0.05, metalness: 0.5 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wh = k.cyl(1.05, 1.05, 0.75, M.rubber(), sx * (w / 2 - 0.4), 1.05, sz * (d / 2 - 2.8), 18);
    wh.rotation.z = Math.PI / 2; wh.position.y = 1.05;
    const rim = k.cyl(0.65, 0.65, 0.78, M.steel(), sx * (w / 2 - 0.4), 1.05, sz * (d / 2 - 2.8), 14); rim.rotation.z = Math.PI / 2; rim.position.y = 1.05;
  }
  k.rbox(w, 1.9, d, 0.5, body, 0, 0.8, 0);
  k.rbox(w - 0.5, 1.6, d * 0.48, 0.5, body, 0, 2.4, -d * 0.05);
  k.rbox(w - 0.45, 1.25, d * 0.46, 0.4, gl, 0, 2.5, -d * 0.05);
  for (const sx of [-1, 1]) {
    k.box(1.1, 0.35, 0.1, mat('plain', '#fffbe8', { emissive: '#fff4c0', emissiveIntensity: 0.4 }), sx * (w / 2 - 0.9), 2.1, d / 2 - 0.02);
    k.box(1.1, 0.35, 0.1, mat('plain', '#b01010', { emissive: '#600000' }), sx * (w / 2 - 0.9), 2.1, -d / 2 + 0.02);
  }
};

// Outdoor
B.tree = (k, w, d, h, c, c2, it) => {
  const rnd = seeded(it.id), trunkH = h * 0.42;
  const bark = it.type === 'tree-birch' ? mat('plain', '#e9e5dc', { roughness: 0.9 }) : M.bark();
  k.cyl(w * 0.04, w * 0.07, trunkH + h * 0.2, bark, 0, 0, 0, 9);
  for (let i = 0; i < 4; i++) {
    const a = rnd() * 6.28, br = k.cyl(w * 0.02, w * 0.03, h * 0.25, bark, Math.cos(a) * w * 0.08, trunkH * 0.8, Math.sin(a) * w * 0.08, 6);
    br.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
  }
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, rr = w * 0.28 * rnd();
    const col = new THREE.Color(c).offsetHSL((rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.12);
    k.ico(w * (0.22 + rnd() * 0.12), M.leaf('#' + col.getHexString()), Math.cos(a) * rr, trunkH + (h - trunkH) * (0.3 + rnd() * 0.45), Math.sin(a) * rr, 1, 1.15, 1, 1);
  }
};

B.pine = (k, w, d, h, c) => {
  k.cyl(w * 0.04, w * 0.06, h * 0.3, M.bark(), 0, 0, 0, 8);
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers, rr = w / 2 * (1 - t * 0.8);
    const col = new THREE.Color(c).offsetHSL(0, 0, (i % 2 ? 0.03 : -0.02));
    k.cone(rr, h * 0.32, M.leaf('#' + col.getHexString()), 0, h * 0.18 + t * h * 0.62, 0, 10);
  }
};

B.shrub = (k, w, d, h, c, c2, it) => {
  const rnd = seeded(it.id);
  foliage(k, 0, h * 0.45, 0, Math.max(w, d) * 0.55, c, rnd, 7, h / Math.max(w, d) * 1.3);
  if (c2) for (let i = 0; i < 10; i++) { const a = rnd() * 6.28; k.sph(0.12, M.plain(c2, 0.8), Math.cos(a) * w * 0.38, h * (0.5 + rnd() * 0.4), Math.sin(a) * d * 0.38); }
};

B.hosta = (k, w, d, h, c, c2, it) => {
  const rnd = seeded(it.id);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * 6.28 + rnd() * 0.3;
    const leaf = k.sph(w * 0.22, M.leaf(i % 3 ? c : c2 || '#d8e6b0'), Math.cos(a) * w * 0.22, h * 0.45, Math.sin(a) * d * 0.22, 0.5, 0.12, 1, 8);
    leaf.rotation.set(0, -a + Math.PI / 2, 0); leaf.rotation.order = 'YXZ'; leaf.rotation.x = -0.6;
  }
};

B.shed = (k, w, d, h, c, c2) => {          // gable shed on blocks with double doors & ramp
  const siding = mat('siding', c, { roughness: 0.9, tile: 4 }), trim = M.trim();
  const wallH = h * 0.6, rise = h - wallH - 0.6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.6, 0.6, 0.6, M.concrete(), sx * (w / 2 - 0.4), 0, sz * (d / 2 - 0.4));
  const body = k.box(w, wallH, d, siding, 0, 0.6, 0); void body;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.25, wallH, 0.25, trim, sx * w / 2, 0.6, sz * d / 2);
  // gable triangles (front/back)
  const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, rise); tri.closePath();
  const tg = new THREE.ExtrudeGeometry(tri, { depth: d, bevelEnabled: false });
  const tm = new THREE.Mesh(tg, siding); tm.position.set(0, 0.6 + wallH, -d / 2); k.g.add(tm);
  const slope = Math.hypot(w / 2 + 0.5, rise + 0.3), ang = Math.atan2(rise + 0.3, w / 2 + 0.5);
  for (const sx of [-1, 1]) {
    const r = k.box(slope, 0.2, d + 0.8, mat('shingle', '#5a5550', { roughness: 0.95, tile: 6 }), 0, 0, 0);
    r.position.set(sx * (w / 4 + 0.15), 0.6 + wallH + rise / 2 + 0.15, 0); r.rotation.z = -sx * ang;
  }
  // doors
  for (const sx of [-1, 1]) {
    k.box(w * 0.22, wallH * 0.85, 0.08, M.plain(c2, 0.45), sx * w * 0.115, 0.7, d / 2 + 0.02);
    k.box(0.04, 0.4, 0.06, M.iron(), sx * 0.12, 0.7 + wallH * 0.4, d / 2 + 0.08);
  }
  k.box(1.2, 1.2, 0.08, M.glass(), -w * 0.36, 0.6 + wallH * 0.45, d / 2 + 0.03);
  k.box(1.3, 1.3, 0.05, trim, -w * 0.36, 0.55 + wallH * 0.45, d / 2 + 0.02);
  for (const sx of [-1, 1]) k.box(0.45, 1.4, 0.06, M.plain('#2b2b2b', 0.7), -w * 0.36 + sx * 0.9, 0.5 + wallH * 0.45, d / 2 + 0.04);
  const ramp = k.box(w * 0.5, 0.15, 2.5, mat('deck', '#8c8170', { roughness: 0.95, tile: 4 }), 0, 0, d / 2 + 1.1);
  ramp.position.y = 0.32; ramp.rotation.x = 0.22;
};

B.firePit = (k, w, d, h) => {
  const rnd = seeded('pit' + w);
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28;
    const s = k.box(w * 0.22, h, w * 0.12, mat('stone', '#8f8a82', { roughness: 1, tile: 3 }), Math.cos(a) * w * 0.42, 0, Math.sin(a) * w * 0.42);
    s.rotation.y = -a + Math.PI / 2;
  }
  k.cyl(w * 0.36, w * 0.36, 0.05, mat('plain', '#2a2622', { roughness: 1 }), 0, 0.02, 0, 20);
  for (let i = 0; i < 8; i++) {
    const log = k.cyl(0.06, 0.06, w * 0.35, M.bark(), (rnd() - 0.5) * w * 0.3, 0.2, (rnd() - 0.5) * w * 0.3, 6);
    log.rotation.set(Math.PI / 2, 0, rnd() * 3);
    log.position.y = 0.12 + rnd() * 0.1;
  }
};

B.grill = (k, w, d, h, c) => {            // covered grill
  k.rbox(w, h - 0.2, d, 0.35, M.fabric(c), 0, 0.2, 0);
  for (const sx of [-1, 1]) { const wh = k.cyl(0.25, 0.25, 0.1, M.rubber(), sx * (w / 2 - 0.3), 0.25, d / 2 - 0.25, 14); wh.rotation.z = Math.PI / 2; wh.position.y = 0.25; }
};

B.patioTable = (k, w, d, h, c, c2, it) => {
  const m = M.iron();
  legs4(k, w, d, h - 0.08, 0.04, m, 0.15);
  k.box(w, 0.06, d, mat('plain', '#5e6064', { roughness: 0.3, metalness: 0.3 }), 0, h - 0.08, 0);
  if (it.umbrella) {
    k.cyl(0.04, 0.04, 7.5 - h, m, 0, h, 0, 8);
    const canopy = mat('stripes', c2 || '#b52f3a', { roughness: 0.9, tile: 1 });
    if (it.umbrella === 'closed') k.cone(0.5, 3.2, canopy, 0, 4.4, 0, 12).rotation.x = Math.PI;
    else k.cone(4, 1.2, canopy, 0, 6.6, 0, 16);
  }
};

B.patioChair = (k, w, d, h, c, c2) => {
  const m = M.iron(), seatH = 1.5;
  for (const sx of [-1, 1]) {
    k.rod(sx * (w / 2 - 0.05), d / 2 - 0.1, sx * (w / 2 - 0.05), -d / 2 + 0.1, 0.05, 0.03, m);
    k.box(0.06, seatH, 0.06, m, sx * (w / 2 - 0.05), 0, d / 2 - 0.15);
    k.box(0.06, h, 0.06, m, sx * (w / 2 - 0.05), 0, -d / 2 + 0.1);
    k.box(0.08, 0.06, d - 0.2, m, sx * (w / 2 - 0.05), 2.1, 0.0);
  }
  k.box(w - 0.1, 0.06, d - 0.2, m, 0, seatH, 0);
  cushion(k, w - 0.2, 0.3, d - 0.35, M.fabric(c2 || c), 0, seatH + 0.05, 0.05);
  k.box(w - 0.1, h - seatH - 0.2, 0.05, mat('plain', '#2b2b2e', { roughness: 0.6, metalness: 0.5, transparent: true, opacity: 0.85 }), 0, seatH + 0.2, -d / 2 + 0.1).rotation.x = -0.12;
  cushion(k, w - 0.3, h - seatH - 0.5, 0.3, M.fabric(c2 || c), 0, seatH + 0.4, -d / 2 + 0.35).rotation.x = -0.15;
};

B.fireTable = (k, w, d, h, c) => {
  const m = mat('concrete', c, { roughness: 0.8 });
  k.box(w - 0.3, h - 0.25, d - 0.3, M.plain('#3c3d40', 0.6), 0, 0, 0);
  k.box(w, 0.25, d, m, 0, h - 0.25, 0);
  k.box(w * 0.4, 0.06, d * 0.4, M.blackGl(), 0, h - 0.02, 0);
  for (let i = 0; i < 9; i++) k.sph(0.12, M.plain(['#c0392b', '#f39c12', '#e8e8e8'][i % 3], 0.6), (i % 3 - 1) * 0.35, h + 0.2, ((i / 3 | 0) - 1) * 0.35);
};

B.kayak = (k, w, d, h, c) => {
  k.sph(1, M.plain(c, 0.35), 0, h / 2, 0, w / 2, h / 2, d / 2, 20);
  k.sph(1, M.black(), 0, h * 0.85, -d * 0.05, w / 2 * 0.55, 0.12, d * 0.12, 16);
};

B.planter = (k, w, d, h, c, c2, it) => {
  const rnd = seeded(it.id);
  if (it.type === 'planter-box') k.box(w, h * 0.5, d, M.plain(c2 || '#d2691e', 0.7), 0, 0, 0);
  else pot(k, w * 0.45, h * 0.45, M.plain(c2 || '#9a5b3c', 0.7));
  foliage(k, 0, h * 0.65, 0, w * 0.45, '#4f7d39', rnd, 6, 0.8);
  for (let i = 0; i < 10; i++) { const a = rnd() * 6.28; k.sph(0.1, M.plain(c, 0.8), Math.cos(a) * w * 0.3, h * (0.7 + rnd() * 0.3), Math.sin(a) * d * 0.3); }
};

B.lampPost = (k, w, d, h) => {
  k.cyl(0.18, 0.25, 0.5, M.iron(), 0, 0, 0, 10);
  k.cyl(0.08, 0.08, h - 1.4, M.iron(), 0, 0.5, 0, 8);
  const s = new Kit(); B.lantern(s, 0.9, 0.9, 1.2, '', '', { lift: 0 }, { ceil: 1.2 }); s.g.position.y = h - 1.2; k.g.add(s.g);
};

B.mailbox = (k, w, d, h, c) => {
  k.box(0.35, h - 0.6, 0.35, M.trim(), 0, 0, 0);
  const box = k.cyl(0.35, 0.35, d, M.plain(c, 0.4), 0, h - 0.4, 0, 16); box.rotation.x = Math.PI / 2; box.position.y = h - 0.3;
};

B.boulder = (k, w, d, h) => k.ico(0.5, M.plain('#8c8780', 0.95, { flatShading: true }), 0, h / 2, 0, w, h, d, 1);

B.fence = (k, w, d, h, c) => {
  const m = M.wood(c, 0.95);
  for (let x = -w / 2; x <= w / 2 + 0.01; x += w / Math.max(1, Math.round(w / 8))) k.box(0.35, h, 0.35, m, x, 0, 0);
  for (const y of [h * 0.35, h * 0.8]) k.box(w, 0.25, 0.15, m, 0, y, 0);
};

export const BUILDERS = B;
// Shared with models_kl.js (kitchen & living room set)
export { Kit, M, lampMat, seeded, geo, r3, shaker, drawerFront, books, legs4, pot, foliage, cushion };

/**
 * Build a THREE.Group for a furniture item.
 * ctx: { ceil: floor height (ft) for ceiling-hung items, wallT: wall thickness for openings }
 */
export function buildModel(item, cat, ctx = {}) {
  const k = new Kit();
  const w = item.width, d = item.depth;
  const h = item.height ?? cat?.height3d ?? 2.5;
  const fn = B[cat?.model] || null;
  if (fn) fn(k, w, d, h, item.color || cat.color, item.color2 || cat?.color2 || '#888888', { ...cat?.defaults, ...item }, ctx);
  else k.rbox(w, h, d, 0.08, M.plain(item.color || '#999999', 0.7), 0, 0, 0);
  k.g.traverse(o => { if (o.isMesh) { o.castShadow = !o.material.transparent; o.receiveShadow = true; } });
  return k.g;
}
