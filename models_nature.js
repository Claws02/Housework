// Trees and shrubs built from leaf cards: small crossed planes carrying a painted cluster of leaves with
// see-through edges (alpha-tested, so they also cast leafy shadows). Far more natural than solid blobs and
// still cheap: each plant merges to a handful of meshes. Replaces the tree / pine / shrub builders.
import * as THREE from 'three';
import { BUILDERS as B, M, seeded, geo } from './models3d.js';
import { mat } from './textures.js';

const PI = Math.PI;
const _tex = new Map(), _mats = new Map();

/** Canvas texture of a leaf clump (kind 'leaf' | 'birch' | 'needle') in shades around `color`. */
function foliageTexture(kind, color) {
  const key = kind + color;
  if (_tex.has(key)) return _tex.get(key);
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'), rnd = seeded(key), base = new THREE.Color(color);
  const shade = (l, h = 0, s = 0) => '#' + base.clone().offsetHSL(h, s, l).getHexString();
  if (kind === 'needle') {
    // a bough: a central twig with needles angled out to both sides, longest in the middle
    ctx.strokeStyle = shade(-0.12, 0.02); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(S / 2, S); ctx.lineTo(S / 2, 8); ctx.stroke();
    for (let y = 10; y < S - 4; y += 2) {
      const len = 26 + 58 * Math.sin(PI * (y / S)) * (0.8 + rnd() * 0.3);
      for (const sd of [-1, 1]) {
        ctx.strokeStyle = shade((rnd() - 0.55) * 0.16, (rnd() - 0.5) * 0.03);
        ctx.lineWidth = 2.4 + rnd() * 1.4;
        ctx.beginPath(); ctx.moveTo(S / 2, y); ctx.lineTo(S / 2 + sd * len, y - len * (0.35 + rnd() * 0.25)); ctx.stroke();
      }
    }
  } else {
    // leaves scattered in a rough disc, denser toward the middle, each with a lighter or darker shade
    const n = kind === 'birch' ? 120 : 95, lw = kind === 'birch' ? 7 : 10, lh = kind === 'birch' ? 13 : 20;
    for (let i = 0; i < n; i++) {
      const a = rnd() * PI * 2, r = Math.sqrt(rnd()) * (S * 0.44);
      const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * PI * 2);
      const l = (rnd() - 0.5) * 0.2 - (r / S) * 0.05;
      ctx.fillStyle = shade(l, (rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.1);
      const s = 0.75 + rnd() * 0.5;
      ctx.beginPath(); ctx.ellipse(0, 0, lw * s, lh * s, 0, 0, PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -lh * s * 0.85); ctx.lineTo(0, lh * s * 0.85); ctx.stroke();   // midrib
      ctx.restore();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  _tex.set(key, t);
  return t;
}

/** Shared material per (kind, colour); colours are quantised so a yard of trees shares a few materials. */
function foliageMat(kind, color) {
  const q = new THREE.Color(color); for (const k of ['r', 'g', 'b']) q[k] = Math.round(q[k] * 12) / 12;
  const hex = '#' + q.getHexString(), key = kind + hex;
  if (!_mats.has(key)) _mats.set(key, new THREE.MeshStandardMaterial({
    map: foliageTexture(kind, hex), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.82, metalness: 0,
  }));
  return _mats.get(key);
}

/** Three quads crossing at 60° (a clump that reads from every angle), unit size, centred. */
function clumpGeo() {
  return geo('clump3', () => {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const p = new THREE.PlaneGeometry(1, 1); p.rotateY(i * PI / 3);
      parts.push(p);
    }
    const g = new THREE.BufferGeometry();
    const pos = [], nor = [], uv = [], idx = [];
    let off = 0;
    for (const p of parts) {
      pos.push(...p.attributes.position.array); nor.push(...p.attributes.normal.array); uv.push(...p.attributes.uv.array);
      idx.push(...Array.from(p.index.array, v => v + off)); off += p.attributes.position.count;
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  });
}

function clump(k, m, x, y, z, s, rnd) {
  const mesh = new THREE.Mesh(clumpGeo(), m);
  mesh.position.set(x, y, z);
  mesh.rotation.set((rnd() - 0.5) * 0.9, rnd() * PI * 2, (rnd() - 0.5) * 0.9);
  mesh.scale.setScalar(s);
  k.g.add(mesh);
}

/** Fill an ellipsoid crown (centre cx,cy,cz; radii rx,ry,rz) with leaf clumps, mostly near the surface. */
function crown(k, kind, color, cx, cy, cz, rx, ry, rz, n, size, rnd) {
  const light = foliageMat(kind, '#' + new THREE.Color(color).offsetHSL(0.01, 0.02, 0.05).getHexString());
  const dark = foliageMat(kind, '#' + new THREE.Color(color).offsetHSL(-0.01, 0, -0.07).getHexString());
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, a = rnd() * PI * 2, sr = Math.sqrt(1 - u * u);
    const r = 0.55 + Math.pow(rnd(), 0.6) * 0.45;                // bias toward the surface
    const dx = Math.cos(a) * sr * r, dy = u * r, dz = Math.sin(a) * sr * r;
    const lower = dy < -0.1 || r < 0.72;                          // underside & inner clumps sit in shade
    clump(k, lower ? dark : light, cx + dx * rx, cy + dy * ry, cz + dz * rz, size * (0.8 + rnd() * 0.45), rnd);
  }
}

function trunk(k, bark, h, r0, r1, rnd, w, top) {
  k.cyl(r1, r0, h, bark, 0, 0, 0, 10);
  // a few limbs fanning up into the crown (visible through the gaps)
  for (let i = 0; i < 5; i++) {
    const len = w * (0.22 + rnd() * 0.12);
    const g = k.group(s => s.cyl(r1 * 0.35, r1 * 0.6, len, bark, 0, 0, 0, 6), 0, top * (0.78 + rnd() * 0.18), 0, rnd() * PI * 2);
    g.rotation.order = 'YZX'; g.rotation.z = 0.55 + rnd() * 0.35;
  }
}

B.tree = (k, w, d, h, c, c2, it) => {
  const rnd = seeded(it.id || String(w + h));
  const birch = it.type === 'tree-birch';
  const trunkH = h * (birch ? 0.5 : 0.4);
  const bark = birch ? mat('plain', '#e6e1d6', { roughness: 0.85 }) : M.bark();
  trunk(k, bark, trunkH + h * 0.18, w * (birch ? 0.03 : 0.055), w * (birch ? 0.022 : 0.04), rnd, w, trunkH);
  if (birch) for (let i = 0; i < 9; i++) k.box(w * 0.05, 0.12, w * 0.05, M.plain('#2b2724', 0.9), 0, 1 + rnd() * trunkH, 0);   // dark birch marks
  const cy = trunkH + (h - trunkH) * 0.52, rx = w * 0.46, ry = (h - trunkH) * 0.52;
  crown(k, birch ? 'birch' : 'leaf', c, 0, cy, 0, rx, ry, rx * (0.85 + rnd() * 0.25), birch ? 60 : 85, w * (birch ? 0.2 : 0.24), rnd);
};

B.pine = (k, w, d, h, c, c2, it) => {
  const rnd = seeded(it.id || String(w + h));
  k.cyl(w * 0.025, w * 0.06, h * 0.95, M.bark(), 0, 0, 0, 9);
  const m1 = foliageMat('needle', c), m2 = foliageMat('needle', '#' + new THREE.Color(c).offsetHSL(0, 0, -0.06).getHexString());
  const tiers = 15, base = h * 0.1;
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1), y = base + f * (h * 0.86 - base);
    const reach = (w / 2) * (1 - f * 0.88) * (0.9 + rnd() * 0.2);
    const n = Math.max(5, Math.round(13 - f * 6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2 + rnd() * 0.5 + t;
      const bough = new THREE.Mesh(geo('bough', () => { const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0); g.rotateX(-PI / 2); return g; }), i % 2 ? m1 : m2);
      // plane lies flat pointing out along +z from the trunk; droop it and turn it round the trunk
      bough.scale.set(reach * 1.05, 1, reach * 1.1);
      bough.position.set(0, y, 0);
      bough.rotation.set(0.32 + rnd() * 0.2, a, (rnd() - 0.5) * 0.3); bough.rotation.order = 'YXZ';
      k.g.add(bough);
    }
  }
  const tip = new THREE.Mesh(clumpGeo(), m1); tip.position.set(0, h * 0.94, 0); tip.scale.set(w * 0.12, h * 0.1, w * 0.12); k.g.add(tip);
};

B.shrub = (k, w, d, h, c, c2, it) => {
  const rnd = seeded(it.id || String(w + h + d));
  const r = Math.max(w, d) / 2;
  crown(k, 'leaf', c, 0, h * 0.5, 0, w * 0.48, h * 0.5, d * 0.48, Math.round(18 + r * 6), r * 0.75, rnd);
  if (c2 && it.type === 'hydrangea') {          // mophead flowers sitting on the outside of the bush
    const petal = mat('plain', c2, { roughness: 0.75 });
    for (let i = 0; i < 14; i++) {
      const a = rnd() * PI * 2, u = 0.1 + rnd() * 0.8, sr = Math.sqrt(1 - u * u);
      k.ico(0.32 + rnd() * 0.12, petal, Math.cos(a) * sr * w * 0.45, h * 0.5 + u * h * 0.48, Math.sin(a) * sr * d * 0.45, 1, 0.85, 1, 1);
    }
  }
};

