// Kitchen & living room set, modelled on the 191 Webster listing photos:
// slipcovered oatmeal sectional with patterned pillows and a knit throw, tufted leather recliner,
// stacked-stone fireplace with a slim white mantel, open white built-ins dressed with books and decor,
// white shaker cabinets with glass uppers, navy island with white quartz, stainless appliances,
// spindle-back counter stools, a stainless dome pendant, recessed cans, pleated leaf-print curtains,
// a roman shade, and the small things that make a kitchen look used.
// Same local frame as models3d.js: origin at the footprint centre on the floor, +y up, +z = front.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from './textures.js';
import { BUILDERS as B, M, lampMat, seeded, geo, r3, shaker, drawerFront, books } from './models3d.js';

const PI = Math.PI;
const shadeHex = (hex, f) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();

// ── Geometry helpers ────────────────────────────────────────────────────────
/** Rounded "superellipsoid" block whose faces bulge like a stuffed cushion.
 *  e < 1 squares it off (0.25 ≈ boxy, 0.6 ≈ pillow); puff = extra loft at the centre of the
 *  `axis` faces. UVs are planar, in feet. */
function plushGeo(w, h, d, e, puff, axis) {
  return geo(`pl${r3(w)},${r3(h)},${r3(d)},${e},${puff},${axis}`, () => {
    let g = new THREE.SphereGeometry(1, 30, 22);
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    g = mergeVertices(g);
    const p = g.attributes.position, uv = new Float32Array(p.count * 2);
    const sp = v => Math.sign(v) * Math.pow(Math.abs(v), e);
    for (let i = 0; i < p.count; i++) {
      let x = sp(p.getX(i)), y = sp(p.getY(i)), z = sp(p.getZ(i));
      if (axis === 'y') y *= (1 + puff * (1 - x * x) * (1 - z * z)) / (1 + puff);
      else z *= (1 + puff * (1 - x * x) * (1 - y * y)) / (1 + puff);
      const X = x * w / 2, Y = y * h / 2, Z = z * d / 2;
      p.setXYZ(i, X, Y, Z);
      const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
      if (ay >= ax && ay >= az) { uv[i * 2] = X; uv[i * 2 + 1] = Z; }
      else if (ax >= az) { uv[i * 2] = Z; uv[i * 2 + 1] = Y; }
      else { uv[i * 2] = X; uv[i * 2 + 1] = Y; }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  });
}
/** Plush block, bottom at y (like Kit.box). */
function plush(k, w, h, d, m, x, y, z, { e = 0.3, puff = 0.2, axis = 'y' } = {}) {
  return k._put(new THREE.Mesh(plushGeo(w, h, d, e, puff, axis), m), x, y + h / 2, z);
}
/** Turned shape from a [radius, height] profile, base at y. */
function lathe(k, key, pts, m, x, y, z, seg = 24) {
  const g = geo('la' + key, () => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg));
  return k._put(new THREE.Mesh(g, m), x, y, z);
}
/** Horizontal cylinder along z (rolled arms, rods front-to-back). Centre at (x, y, z). */
function zcyl(k, r, len, m, x, y, z, seg = 16) {
  const c = k.cyl(r, r, len, m, x, 0, z, seg); c.rotation.x = PI / 2; c.position.y = y; return c;
}
/** Horizontal cylinder along x. */
function xcyl(k, r, len, m, x, y, z, seg = 16) {
  const c = k.cyl(r, r, len, m, x, 0, z, seg); c.rotation.z = PI / 2; c.position.y = y; return c;
}
/** Thin cylinder between two points (stems, struts). */
function strut(k, a, b, r, m) {
  const len = a.distanceTo(b), c = k.cyl(r, r, len, m, 0, 0, 0, 6);
  c.position.copy(a).add(b).multiplyScalar(0.5);
  c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return c;
}
/** Countertop slab with an optional rectangular cut-out (for an undermount sink). */
function counterTop(k, w, d, t, m, y, hole) {
  if (!hole) return k.rbox(w, t, d, 0.015, m, 0, y, 0);
  const { hw, hd, cz } = hole;
  k.box((w / 2 - hw), t, d, m, -w / 2 + (w / 2 - hw) / 2, y, 0);
  k.box((w / 2 - hw), t, d, m, w / 2 - (w / 2 - hw) / 2, y, 0);
  const front = d / 2 - (cz + hd), back = (cz - hd) + d / 2;
  k.box(2 * hw, t, front, m, 0, y, d / 2 - front / 2);
  k.box(2 * hw, t, back, m, 0, y, -d / 2 + back / 2);
}

// ── Materials for this set ──────────────────────────────────────────────────
const S = {
  steel:  () => mat('brushed', '#d2d3d2', { roughness: 0.42, metalness: 0.72 }),
  bowl:   () => mat('plain', '#8f9497', { roughness: 0.35, metalness: 0.8 }),
  quartz: c => mat('quartz', c || '#f1efea', { roughness: 0.16 }),
  butcher: c => mat('butcher', c || '#c9a27a', { roughness: 0.55 }),
  enamel: () => mat('plain', '#121214', { roughness: 0.15, metalness: 0.2 }),
  castIron: () => mat('plain', '#1b1b1c', { roughness: 0.7, metalness: 0.4 }),
  ceramic: c => mat('plain', c || '#f4f2ec', { roughness: 0.18 }),
  darkGlass: () => mat('plain', '#0b0e12', { roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 }),
  slipcover: c => mat('fabric', c, { roughness: 0.97 }),
  knit: c => mat('knit', c, { roughness: 1 }),
  damask: c => mat('damask', c, { roughness: 0.95 }),
  leather: c => mat('leather', c, { roughness: 0.42 }),
  paint: c => mat('plain', c, { roughness: 0.85 }),
  ember: () => lampMat('#ff7a2a', '#ff5a10', 0.9, { roughness: 0.6 }),
  led: () => lampMat('#fff4dc', '#ffe6b8', 0.7, { roughness: 0.4 }),
};

// ── Shelf dressing (built-ins, open shelves, glass uppers) ──────────────────
function shelfDecor(k, x0, x1, y, z, depth, maxH, rnd, style = 'living') {
  let x = x0;
  const vaseCols = ['#e8e2d6', '#7a96b0', '#3c5a78', '#c9b79c', '#f4f2ec', '#6b7b6a'];
  while (x < x1 - 0.25) {
    const room = x1 - x, pick = rnd();
    if (style === 'dishes') {                         // stacks of plates & bowls, glasses
      if (pick < 0.5 && room > 0.9) {
        for (let i = 0; i < 6; i++) k.cyl(0.4, 0.36, 0.035, S.ceramic(), x + 0.42, y + i * 0.04, z, 24);
        x += 0.9;
      } else if (pick < 0.75 && room > 0.6) {
        for (let i = 0; i < 3; i++) lathe(k, 'bowl', [[0, 0], [0.12, 0], [0.24, 0.1], [0.26, 0.17], [0.24, 0.17], [0.11, 0.03], [0, 0.03]], S.ceramic(), x + 0.28, y + i * 0.09, z);
        x += 0.6;
      } else {
        for (let i = 0; i < 3 && x < x1 - 0.2; i++) { lathe(k, 'glass', [[0, 0], [0.09, 0], [0.1, 0.42], [0.095, 0.42], [0.085, 0.02], [0, 0.02]], M.glass(), x + 0.12, y, z - 0.05 + i * 0.03); x += 0.24; }
        x += 0.1;
      }
      continue;
    }
    if (style === 'baskets') {                        // wicker baskets with a framed photo or two
      if (pick < 0.6 && room > 1) { const bw = Math.min(room - 0.1, 1.1 + rnd() * 0.3); basket(k, bw, depth * 0.85, Math.min(maxH * 0.7, 0.75), x + bw / 2, y, z); x += bw + 0.15; }
      else { frame(k, 0.55, 0.7, x + 0.3, y, z, rnd); x += 0.7; }
      continue;
    }
    if (pick < 0.42 && room > 0.9) {                  // a run of upright books, maybe with bookends
      const run = Math.min(room - 0.1, 0.8 + rnd() * 1.1);
      books(k, x, x + run, y, z, depth * 0.85, rnd, Math.min(0.95, maxH - 0.1));
      x += run + 0.15;
    } else if (pick < 0.55 && room > 0.8) {           // stacked books with an object on top
      let yy = y;
      for (let i = 0; i < 3; i++) { const bh = 0.08 + rnd() * 0.05; k.box(0.75 - i * 0.04, bh, 0.55, M.plain(['#d8d2c4', '#2f4f7a', '#8a2f2f', '#c9a050'][(rnd() * 4) | 0], 0.8), x + 0.4, yy, z); yy += bh; }
      k.sph(0.12, S.ceramic(vaseCols[(rnd() * vaseCols.length) | 0]), x + 0.4, yy + 0.12, z);
      x += 0.95;
    } else if (pick < 0.7) {                          // vase
      const vh = Math.min(maxH - 0.1, 0.5 + rnd() * 0.6), vr = 0.12 + rnd() * 0.08;
      lathe(k, `v${r3(vh)},${r3(vr)}`, [[0, 0], [vr * 0.7, 0], [vr, vh * 0.35], [vr * 0.9, vh * 0.7], [vr * 0.45, vh * 0.9], [vr * 0.55, vh], [vr * 0.5, vh], [0, vh * 0.1]], S.ceramic(vaseCols[(rnd() * vaseCols.length) | 0]), x + 0.25, y, z);
      x += 0.55;
    } else if (pick < 0.82) { frame(k, 0.5 + rnd() * 0.25, 0.6 + rnd() * 0.2, x + 0.35, y, z, rnd); x += 0.8; }
    else if (pick < 0.9 && room > 0.8) {              // mantel clock
      const c = k.cyl(0.32, 0.32, 0.12, M.plain('#5a3a22', 0.4), x + 0.38, 0, z, 28); c.rotation.x = PI / 2; c.position.y = y + 0.34;
      const f = k.cyl(0.26, 0.26, 0.02, S.ceramic('#f6f1e4'), x + 0.38, 0, z + 0.07, 28); f.rotation.x = PI / 2; f.position.y = y + 0.34;
      k.box(0.02, 0.18, 0.01, M.black(), x + 0.38, y + 0.34, z + 0.085);
      k.box(0.12, 0.02, 0.01, M.black(), x + 0.44, y + 0.34, z + 0.085);
      k.box(0.5, 0.04, 0.2, M.plain('#5a3a22', 0.4), x + 0.38, y, z);
      x += 0.8;
    } else { basket(k, 0.8, depth * 0.8, Math.min(0.6, maxH * 0.6), x + 0.4, y, z); x += 0.95; }
  }
}

function frame(k, w, h, x, y, z, rnd) {
  const g = k.group(s => {
    s.box(w, h, 0.05, M.plain(rnd() < 0.5 ? '#2a2018' : '#c9b38f', 0.5), 0, 0, 0);
    s.box(w - 0.1, h - 0.1, 0.01, S.ceramic('#f6f3ec'), 0, 0.05, 0.03);
    const col = new THREE.Color().setHSL(0.05 + rnd() * 0.6, 0.35, 0.45 + rnd() * 0.2);
    s.box(w - 0.22, h - 0.22, 0.01, M.plain('#' + col.getHexString(), 0.8), 0, 0.11, 0.037);
  }, x, y, z);
  g.rotation.x = -0.12;
}

function basket(k, w, d, h, x, y, z) {
  const wk = mat('wicker', '#a8875c', { roughness: 1 });
  k.rbox(w, h, d, 0.05, wk, x, y, z);
  k.rbox(w + 0.03, 0.06, d + 0.03, 0.03, mat('wicker', '#8c6c44', { roughness: 1 }), x, y + h - 0.05, z);
}

// ── Living room ─────────────────────────────────────────────────────────────
/** Slipcovered sofa run: skirted base, rolled arms, plump seat and back cushions. */
function plushSofa(k, w, d, h, c, x0 = 0, z0 = 0, { armL = true, armR = true, n = 0, m, rnd = Math.random } = {}) {
  const fab = m || S.slipcover(c), arm = 0.62, armH = 2.05, baseH = 1.0, backT = 0.55;
  k.rbox(w, baseH - 0.05, d, 0.08, fab, x0, 0.05, z0);                                  // skirted base
  k.rbox(w, h - 0.3 - 0.05, backT, 0.14, fab, x0, 0.05, z0 - d / 2 + backT / 2);         // back frame
  for (const [on, sx] of [[armL, -1], [armR, 1]]) {
    if (!on) continue;
    const ax = x0 + sx * (w / 2 - arm / 2);
    k.rbox(arm - 0.08, armH - 0.25, d - 0.04, 0.1, fab, ax - sx * 0.02, 0.05, z0);
    zcyl(k, 0.23, d - 0.06, fab, ax + sx * 0.04, armH - 0.24, z0, 18);                  // rolled top
    plush(k, 0.5, 0.5, 0.12, fab, ax + sx * 0.04, armH - 0.47, z0 + d / 2 - 0.02, { e: 0.6, puff: 0.6, axis: 'z' });   // arm face
  }
  const inner = w - (armL ? arm : 0) - (armR ? arm : 0), xs = x0 - w / 2 + (armL ? arm : 0);
  n = n || Math.max(1, Math.round(inner / 2.5));
  const cw = inner / n, seatD = d - backT - 0.02;
  for (let i = 0; i < n; i++) {
    const cx = xs + cw * i + cw / 2;
    const seat = plush(k, cw - 0.03, 0.58, seatD, fab, cx, baseH - 0.06, z0 + backT / 2 + 0.01, { e: 0.28, puff: 0.22 });
    seat.rotation.y = (rnd() - 0.5) * 0.02; seat.position.z += (rnd() - 0.5) * 0.04;
    const bh = h - baseH - 0.35;
    const back = plush(k, cw - 0.05, bh, 0.72, fab, cx, baseH + 0.46, z0 - d / 2 + backT + 0.2, { e: 0.32, puff: 0.4, axis: 'z' });
    back.rotation.x = -0.16 + (rnd() - 0.5) * 0.04; back.rotation.z = (rnd() - 0.5) * 0.03;
  }
}

/** A throw pillow leaning against the back cushions. */
function pillow(k, m, x, y, z, rnd, size = 1.55, ry = 0) {
  const p = plush(k, size, size * 0.95, 0.48, m, x, y, z, { e: 0.55, puff: 0.7, axis: 'z' });
  p.rotation.set(-0.32 + (rnd() - 0.5) * 0.1, ry + (rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.18);
  return p;
}

/** Knit throw folded over an arm or the seat edge, hanging down the front. */
function throwBlanket(k, m, x, z, y, width, rnd) {
  plush(k, width, 0.1, 1.4, m, x, y, z, { e: 0.5, puff: 0.2 });
  const hang = plush(k, width - 0.05, 1.05, 0.1, m, x, y - 1.0, z + 0.72, { e: 0.5, puff: 0.2, axis: 'z' });
  hang.rotation.x = 0.18;
  for (let i = 0; i < 3; i++) zcyl(k, 0.06, 1.3, m, x - width / 2 + 0.25 + i * (width - 0.5) / 2, y + 0.08, z, 10);   // folds
  void rnd;
}

B.sofa = (k, w, d, h, c, c2, it) => {
  const rnd = seeded(it.id);
  plushSofa(k, w, d, h, c, 0, 0, { rnd });
  for (const sx of [-1, 1]) pillow(k, S.damask(c2), sx * (w / 2 - 1.35), 1.35, -d / 2 + 1.05, rnd, 1.45, sx * 0.15);
};

B.sectional = (k, w, d, h, c, c2, it) => {
  // Back run along the rear (−z) with the right arm; return along the left (−x) side out to +z.
  const rnd = seeded(it.id), sd = Math.min(3.5, d), fab = S.slipcover(c);
  plushSofa(k, w - sd, sd, h, c, sd / 2, -d / 2 + sd / 2, { armL: false, rnd });
  k.group(s => plushSofa(s, d - sd, sd, h, c, 0, 0, { armR: false, rnd }), -w / 2 + sd / 2, 0, sd / 2, PI / 2);
  // corner unit
  const cx = -w / 2 + sd / 2, cz = -d / 2 + sd / 2;
  k.rbox(sd, 0.95, sd, 0.08, fab, cx, 0.05, cz);
  k.rbox(sd, h - 0.35, 0.55, 0.14, fab, cx, 0.05, -d / 2 + 0.275);
  k.rbox(0.55, h - 0.35, sd, 0.14, fab, -w / 2 + 0.275, 0.05, cz);
  plush(k, sd - 0.58, 0.58, sd - 0.58, fab, cx + 0.28, 0.94, cz + 0.28, { e: 0.28, puff: 0.22 });
  const cb = plush(k, sd - 0.7, h - 1.35, 0.72, fab, cx + 0.3, 1.46, -d / 2 + 0.75, { e: 0.32, puff: 0.4, axis: 'z' }); cb.rotation.x = -0.16;
  // pillows: patterned, solid, and a knit — photo has a pile of them
  const mats = [S.damask(c2), S.slipcover(shadeHex(c, 1.06)), S.damask(c2), S.knit('#d8d2c6'), S.slipcover(shadeHex(c2, 1.4))];
  const runX = [-w / 2 + sd + 0.9, -w / 2 + sd + 2.4, w / 2 - 2.0];
  runX.forEach((x, i) => pillow(k, mats[i % mats.length], x, 1.4, -d / 2 + 1.05, rnd));
  pillow(k, mats[3], cx + 0.75, 1.4, cz + 0.7, rnd, 1.5, PI / 4);
  for (const [i, zz] of [[4, cz + sd / 2 + 1.0], [0, cz + sd / 2 + 2.4]]) pillow(k, mats[i], -w / 2 + 1.05, 1.4, zz, rnd, 1.5, PI / 2);
  // knit throw folded over the end of the return
  if (it.throw !== false) throwBlanket(k, S.knit('#b9b2a6'), -w / 2 + sd / 2 + 0.2, d / 2 - 1.7, 1.56, 1.8, rnd);
};

B.armchair = (k, w, d, h, c, c2, it) => plushSofa(k, w, d, h, c, 0, 0, { n: 1, rnd: seeded(it.id) });

B.recliner = (k, w, d, h, c, c2, it) => {
  // Overstuffed leather recliner: pillow-top arms, three tufted back bolsters, closed footrest.
  const lm = S.leather(c), dark = S.leather(shadeHex(c, 0.8)), arm = 0.62;
  k.rbox(w - 0.1, 1.0, d - 0.15, 0.12, dark, 0, 0.12, 0.02);
  k.box(w - 0.4, 0.12, d - 0.5, M.black(), 0, 0, 0);
  for (const sx of [-1, 1]) {
    const ax = sx * (w / 2 - arm / 2);
    k.rbox(arm, 1.75, d - 0.1, 0.16, lm, ax, 0.12, 0.02);
    plush(k, arm + 0.06, 0.42, d - 0.25, lm, ax, 1.72, 0.06, { e: 0.45, puff: 0.5 });
  }
  k.rbox(w - 2 * arm + 0.1, h - 0.4, 0.6, 0.18, dark, 0, 0.12, -d / 2 + 0.3);
  plush(k, w - 2 * arm, 0.62, d - 0.85, lm, 0, 1.02, 0.25, { e: 0.35, puff: 0.3 });
  plush(k, w - 2 * arm - 0.1, 0.5, 0.55, lm, 0, 0.55, d / 2 - 0.25, { e: 0.4, puff: 0.4, axis: 'z' });   // footrest front
  const bw = w - 2 * arm - 0.05, bh = (h - 1.55) / 3;
  for (let i = 0; i < 3; i++) {
    const b = plush(k, bw, bh + 0.08, 0.6, lm, 0, 1.55 + i * bh, -d / 2 + 0.78 - i * 0.05, { e: 0.45, puff: 0.55, axis: 'z' });
    b.rotation.x = -0.18;
  }
};

B.ottoman = (k, w, d, h, c, c2, it) => {
  const fab = S.slipcover(c);
  k.rbox(w, h - 0.35, d, 0.08, fab, 0, 0.12, 0);
  plush(k, w + 0.02, 0.32, d + 0.02, fab, 0, h - 0.34, 0, { e: 0.3, puff: 0.3 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.07, 0.05, 0.12, M.wood('#4a3524'), sx * (w / 2 - 0.2), 0, sz * (d / 2 - 0.2), 10);
  if (it.tray !== false) k.group(s => B.trayDecor(s, 1.6, 1.0, 0.4, '#7a5233', '', { id: it.id + 't' }), 0.2, h - 0.04, 0, 0.1);
};

B.pouf = (k, w, d, h, c) => plush(k, w, h, d, S.knit(c), 0, 0, 0, { e: 0.55, puff: 0.25 });

B.trayDecor = (k, w, d, h, c, c2, it) => {
  const wood = M.wood(c || '#7a5233', 0.45);
  k.box(w, 0.04, d, wood, 0, 0, 0);
  for (const sx of [-1, 1]) k.box(0.04, 0.12, d, wood, sx * (w / 2 - 0.02), 0, 0);
  for (const sz of [-1, 1]) k.box(w, 0.12, 0.04, wood, 0, 0, sz * (d / 2 - 0.02));
  k.rbox(0.42, 0.42, 0.42, 0.03, S.ceramic('#eef0f2'), -w * 0.25, 0.04, 0);                 // tissue box
  k.box(0.1, 0.12, 0.05, mat('fabric', '#ffffff', { roughness: 1 }), -w * 0.25, 0.44, 0);
  lathe(k, 'candle', [[0, 0], [0.13, 0], [0.13, 0.32], [0, 0.32]], S.ceramic('#efe6d2'), w * 0.12, 0.04, -0.15);
  k.box(0.5, 0.03, 0.18, M.black(), w * 0.22, 0.04, 0.22).rotation.y = 0.3;                // remote
  void c2; void it; void h;
};

B.tv = (k, w, d, h, c, c2, it) => {
  const panelH = w * 0.57, onStand = (it.lift ?? 0) < 1.5, y0 = onStand ? 0.25 : 0;
  k.box(w - 0.2, panelH - 0.2, 0.12, M.black(), 0, y0 + 0.1, -0.03);                      // back housing
  k.box(w, panelH, 0.035, mat('plain', '#16171a', { roughness: 0.35, metalness: 0.4 }), 0, y0, 0.03);
  k.box(w - 0.04, panelH - 0.06, 0.005, M.screen(), 0, y0 + 0.04, 0.05);
  if (onStand) for (const sx of [-1, 1]) { const f = k.box(0.08, 0.28, 0.6, M.black(), sx * w * 0.38, 0, 0); f.rotation.z = sx * 0.4; }
};

B.fireplace = (k, w, d, h, c, c2) => {
  // Stacked stone to a slim painted mantel at 4'3"; painted chimney breast above; black insert with
  // glass doors and a log set that glows when the lights are on.
  const st = mat('stone', c, { roughness: 0.95, tile: 3 }), paint = S.paint('#f1ede4');
  const mh = Math.min(4.25, h);
  k.box(w, mh, d, st, 0, 0, 0);
  if (h > mh + 0.3) k.box(w - 0.1, h - mh - 0.2, d - 0.15, paint, 0, mh + 0.2, -0.075);
  // mantel shelf
  k.box(w + 0.5, 0.2, 0.7, paint, 0, mh, d / 2 - 0.15);
  k.box(w + 0.3, 0.12, 0.08, paint, 0, mh - 0.12, d / 2 + 0.15);
  // insert
  const fw = Math.min(3.1, w * 0.56), fh = 2.45, fy = 0.45, fz = d / 2;
  k.box(fw + 0.3, fh + 0.3, 0.08, S.castIron(), 0, fy - 0.15, fz + 0.01);
  k.box(fw, fh, 0.1, mat('plain', '#0c0c0d', { roughness: 0.9 }), 0, fy, fz - 0.04);
  for (let i = 0; i < 3; i++) {                                                            // logs + embers
    const lg = xcyl(k, 0.14 - i * 0.015, fw * (0.75 - i * 0.1), M.bark(), (i - 1) * 0.15, fy + 0.22 + (i === 2 ? 0.18 : 0), fz - 0.3 - (i % 2) * 0.2, 10);
    lg.rotation.y = (i - 1) * 0.25;
  }
  k.box(fw * 0.7, 0.06, 0.5, S.ember(), 0, fy + 0.04, fz - 0.35);
  for (const [x, ht] of [[-0.35, 0.75], [0.05, 1.0], [0.4, 0.65]]) k.cone(0.16, ht, S.ember(), x, fy + 0.3, fz - 0.33, 8);
  for (const sx of [-1, 1]) {                                                              // bi-fold glass doors
    k.box(fw / 2 - 0.02, fh - 0.1, 0.02, S.darkGlass(), sx * fw / 4, fy + 0.05, fz + 0.06);
    k.box(0.05, fh - 0.1, 0.04, S.castIron(), sx * (fw / 2 - 0.03), fy + 0.05, fz + 0.07);
    k.box(0.05, fh - 0.1, 0.04, S.castIron(), sx * 0.03, fy + 0.05, fz + 0.07);
    k.cyl(0.02, 0.02, 0.4, M.nickel(), sx * 0.12, fy + fh / 2 - 0.2, fz + 0.12, 8);
  }
  k.box(fw, 0.05, 0.04, S.castIron(), 0, fy + fh - 0.07, fz + 0.07);
  k.box(w + 0.5, 0.16, 1.4, mat('stone', '#5d5852', { roughness: 0.8, tile: 4 }), 0, 0, d / 2 + 0.6);   // hearth
  void c2;
};

B.builtins = (k, w, d, h, c, c2, it) => {
  // Open white bookcases to the ceiling: face frame, adjustable shelves, crown — dressed like the photo.
  const m = M.plain(c, 0.45), back = S.paint(shadeHex(c, 0.96)), rnd = seeded(it.id);
  const ff = 0.16;
  k.box(w, 0.35, d - 0.1, m, 0, 0, -0.05);                                                 // toe/base
  k.box(w, h, 0.05, back, 0, 0, -d / 2 + 0.025);
  for (const sx of [-1, 1]) {
    k.box(0.06, h, d, m, sx * (w / 2 - 0.03), 0, 0);
    k.box(ff, h - 0.35, 0.06, m, sx * (w / 2 - ff / 2), 0.35, d / 2 - 0.03);               // face frame stiles
  }
  const n = Math.max(3, Math.round((h - 0.6) / 1.25)), top = h - 0.45, iw = w - 2 * ff;
  for (let i = 0; i <= n; i++) {
    const y = 0.35 + i * (top - 0.35) / n;
    k.box(w - 0.08, 0.08, d - 0.08, m, 0, y, -0.02);
    k.box(w - 0.08, 0.1, 0.06, m, 0, y - 0.02, d / 2 - 0.03);                              // shelf nosing
    if (i < n) shelfDecor(k, -iw / 2 + 0.05, iw / 2 - 0.05, y + 0.08, -0.08, d - 0.25, (top - 0.35) / n - 0.15, rnd, 'living');
  }
  k.box(w, 0.45, 0.06, m, 0, top, d / 2 - 0.03);                                           // top rail
  k.box(w + 0.12, 0.12, d + 0.04, m, 0, h - 0.12, 0.02);                                   // crown
  k.box(w + 0.2, 0.08, d + 0.12, m, 0, h - 0.2, 0.06);
  void c2;
};

B.curtains = (k, w, d, h, c, c2, it) => {
  // Pinch-pleated leaf-print panels stacked at each side, rod with ball finials.
  const fab = mat('leafprint', c, { roughness: 0.95, side: THREE.DoubleSide });
  const ph = h - 0.12, pw = Math.min(1.35, w * 0.3), folds = Math.max(3, Math.round(pw / 0.24));
  for (const sx of [-1, 1]) {
    const g = geo(`cur${r3(pw)},${r3(ph)},${folds}`, () => {
      const pg = new THREE.PlaneGeometry(pw, ph, folds * 6, 8);
      const p = pg.attributes.position, uv = pg.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), t = (ph / 2 - y) / ph;        // 0 top → 1 hem
        p.setZ(i, Math.sin((x / pw + 0.5) * folds * PI * 2) * (0.07 + 0.06 * t));
        uv.setXY(i, uv.getX(i) * pw * 1.6, uv.getY(i) * ph);
      }
      pg.computeVertexNormals();
      return pg;
    });
    k._put(new THREE.Mesh(g, fab), sx * (w / 2 - pw / 2 + 0.05), 0.1 + ph / 2, 0.06);
  }
  const rod = M.iron();
  k.rod(-w / 2 - 0.25, 0.12, w / 2 + 0.25, 0.12, h + 0.02, 0.028, rod);
  for (const sx of [-1, 1]) { k.sph(0.08, rod, sx * (w / 2 + 0.3), h + 0.02, 0.12); k.box(0.05, 0.05, 0.2, rod, sx * (w / 2 - 0.1), h - 0.02, 0.02); }
  void c2; void it; void d;
};

B.romanShade = (k, w, d, h, c) => {
  const fab = mat('fabric', c || '#efebe2', { roughness: 0.95 });
  k.box(w, 0.12, 0.12, M.trim(), 0, h - 0.12, 0);                                          // headrail
  k.box(w - 0.04, h * 0.45, 0.03, fab, 0, h * 0.55 - 0.12, 0);
  for (let i = 0; i < 4; i++) { const f = xcyl(k, 0.075, w - 0.04, fab, 0, h * 0.55 - 0.12 - i * 0.13, 0.03, 12); f.scale.z = 0.6; }
  void d;
};

// ── Kitchen ─────────────────────────────────────────────────────────────────
/** Base cabinet run with drawer-over-door bays, recessed toe kick and a 1¼" quartz top. */
function baseCabinet(k, w, d, h, c, c2, it, hole) {
  const m = M.plain(c, 0.42), carcass = M.plain(shadeHex(c, 0.82), 0.6), top = it.pattern === 'butcher' ? S.butcher() : S.quartz(c2);
  const tk = 0.33, tt = 0.105, cd = d - 0.08;
  k.box(w, tk, cd - 0.28, M.plain(shadeHex(c, 0.45), 0.8), 0, 0, -0.18);
  k.box(w, h - tk - tt, cd, carcass, 0, tk, -0.04);
  const fz = -0.04 + cd / 2, bays = Math.max(1, Math.round(w / 1.5)), bw = w / bays;
  for (let i = 0; i < bays; i++) {
    const x = -w / 2 + bw * (i + 0.5);
    if (hole) shaker(k, bw - 0.02, h - tk - tt - 0.02, fz, m, x, tk + 0.01, 'bar');
    else { drawerFront(k, bw - 0.02, 0.5, fz, m, x, h - tt - 0.52); shaker(k, bw - 0.02, h - tk - tt - 0.56, fz, m, x, tk + 0.01, 'bar'); }
  }
  counterTop(k, w, d + 0.06, tt, top, h - tt, hole);
  return { top: h, tt };
}

B.baseCab = (k, w, d, h, c, c2, it) => baseCabinet(k, w, d, h, c, c2, it, null);

B.sinkCab = (k, w, d, h, c, c2, it) => {
  const bw = Math.min(2.5, w - 0.5), bd = 1.45, cz = 0.05, depth = 0.75;
  baseCabinet(k, w, d, h, c, c2, it, { hw: bw / 2, hd: bd / 2, cz });
  const st = S.bowl(), y0 = h - 0.105 - depth;
  k.box(bw, 0.03, bd, st, 0, y0, cz);                                                      // undermount bowl
  k.box(bw, depth, 0.03, st, 0, y0, cz - bd / 2); k.box(bw, depth, 0.03, st, 0, y0, cz + bd / 2);
  k.box(0.03, depth, bd, st, -bw / 2, y0, cz); k.box(0.03, depth, bd, st, bw / 2, y0, cz);
  k.cyl(0.12, 0.12, 0.01, M.chrome(), 0, y0 + 0.031, cz, 16);
  // pull-down gooseneck faucet + soap pump
  const fx = 0, fz = -d / 2 + 0.38, n = M.chrome();
  k.cyl(0.08, 0.09, 0.06, n, fx, h, fz, 16);
  k.cyl(0.04, 0.045, 1.05, n, fx, h + 0.06, fz, 14);
  k.torus(0.3, 0.04, n, fx, h + 1.11, fz + 0.3, PI).rotation.y = -PI / 2;
  k.cyl(0.055, 0.045, 0.32, n, fx, h + 0.78, fz + 0.6, 14);
  const lever = k.box(0.04, 0.04, 0.3, n, fx + 0.12, h + 0.55, fz); lever.rotation.x = -0.5;
  k.cyl(0.04, 0.04, 0.18, n, fx + 0.6, h, fz + 0.05, 10);
  k.rod(fx + 0.6, fz + 0.05, fx + 0.6, fz + 0.2, h + 0.2, 0.02, n);
};

B.upperCab = (k, w, d, h, c, c2, it) => {
  const m = M.plain(c, 0.42), inside = S.paint(shadeHex(c, 0.94)), rnd = seeded(it.id);
  const style = it.style || (it.glass ? 'glass' : 'solid');
  k.box(w, h, 0.04, inside, 0, 0, -d / 2 + 0.02);
  for (const sx of [-1, 1]) k.box(0.05, h, d, m, sx * (w / 2 - 0.025), 0, 0);
  k.box(w, 0.06, d, m, 0, 0, 0);
  k.box(w, 0.06, d, m, 0, h - 0.06, 0);
  const shelves = [0.06 + (h - 0.12) / 3, 0.06 + 2 * (h - 0.12) / 3];
  if (style !== 'solid') for (const y of shelves) k.box(w - 0.1, 0.05, d - 0.1, m, 0, y, -0.03);
  if (style !== 'solid') for (const y of [0.06, ...shelves.map(v => v + 0.05)])
    shelfDecor(k, -w / 2 + 0.1, w / 2 - 0.1, y, -0.05, d - 0.25, (h - 0.12) / 3 - 0.1, rnd, style === 'open' ? 'baskets' : 'dishes');
  const bays = Math.max(1, Math.round(w / 1.5)), bw = w / bays, fz = d / 2;
  for (let i = 0; i < bays; i++) {
    const x = -w / 2 + bw * (i + 0.5);
    if (style === 'open') continue;
    if (style === 'glass') {                                                               // frame-only door
      const f = Math.min(0.22, bw * 0.2), H = h - 0.04;
      k.box(f, H, 0.07, m, x - bw / 2 + f / 2 + 0.01, 0.02, fz + 0.035);
      k.box(f, H, 0.07, m, x + bw / 2 - f / 2 - 0.01, 0.02, fz + 0.035);
      k.box(bw - 2 * f - 0.02, f, 0.07, m, x, 0.02, fz + 0.035);
      k.box(bw - 2 * f - 0.02, f, 0.07, m, x, h - 0.02 - f, fz + 0.035);
      k.box(bw - 2 * f, H - 2 * f, 0.01, M.glass(), x, 0.02 + f, fz + 0.04);
      k.cyl(0.017, 0.017, 0.4, M.nickel(), x + bw / 2 - f / 2, 0.25, fz + 0.14, 8);
    } else shaker(k, bw - 0.02, h - 0.04, fz, m, x, 0.02, 'bar');
  }
  // crown, light rail and an under-cabinet LED strip
  k.box(w + 0.06, 0.14, d + 0.05, m, 0, h - 0.02, 0.03);
  k.box(w + 0.14, 0.09, d + 0.12, m, 0, h + 0.1, 0.06);
  if (style !== 'open') {
    k.box(w, 0.08, 0.05, m, 0, -0.06, d / 2 - 0.02);
    k.box(w - 0.3, 0.015, 0.08, S.led(), 0, -0.016, d / 2 - 0.2);
  }
};

B.range = (k, w, d, h) => {
  // 30" freestanding gas range: black enamel cooktop, cast-iron grates, front knobs, window door.
  const st = S.steel(), iron = S.castIron(), cz = -0.05, top = h - 0.08;
  k.box(w, 0.3, d - 0.25, M.black(), 0, 0, cz - 0.1);
  k.box(w, top - 0.3, d - 0.1, st, 0, 0.3, cz);
  k.box(w, 0.08, d - 0.1, S.enamel(), 0, top, cz);
  const bx = w * 0.24, bz = d * 0.22;
  for (const [sx, sz, r] of [[-1, -1, 0.22], [1, -1, 0.18], [-1, 1, 0.18], [1, 1, 0.26]]) {
    k.cyl(r, r, 0.04, iron, sx * bx, h, cz + sz * bz, 18);
    k.cyl(r * 0.6, r * 0.6, 0.05, mat('plain', '#2a2a2b', { roughness: 0.5, metalness: 0.5 }), sx * bx, h + 0.02, cz + sz * bz, 18);
  }
  for (const sx of [-1, 1]) {                                                              // two grates
    const gx = sx * w / 4, gw = w / 2 - 0.05, gd = d - 0.4, gy = h + 0.1;
    for (const zz of [-gd / 2, 0, gd / 2]) k.box(gw, 0.05, 0.05, iron, gx, gy, cz + zz);
    for (const xx of [-gw / 2, gw / 2]) k.box(0.05, 0.05, gd, iron, gx + xx, gy, cz);
    for (const bzs of [-1, 1]) for (let i = 0; i < 3; i++) {                                // fingers radiating over each burner
      const a = i * PI / 3, f = k.box(0.04, 0.04, 0.46, iron, gx, gy, cz + bzs * bz); f.rotation.y = a;
    }
  }
  k.box(w, 0.42, 0.12, st, 0, h - 0.05, -d / 2 + 0.02);                                    // backguard
  k.box(0.6, 0.12, 0.01, M.blackGl(), 0, h + 0.15, -d / 2 + 0.085);
  const fz = cz + (d - 0.1) / 2;
  k.box(w - 0.04, 0.5, 0.04, st, 0, top - 0.52, fz);                                        // control strip
  for (let i = 0; i < 5; i++) {
    const kx = -w / 2 + 0.3 + i * (w - 0.6) / 4;
    const kn = k.cyl(0.075, 0.08, 0.12, mat('plain', '#2a2b2e', { roughness: 0.4, metalness: 0.6 }), kx, 0, fz + 0.08, 18); kn.rotation.x = PI / 2; kn.position.y = top - 0.27;
    k.box(0.015, 0.06, 0.01, M.chrome(), kx, top - 0.25, fz + 0.15);
  }
  const dh = top - 0.85 - 0.75;                                                            // oven door
  k.box(w - 0.06, dh, 0.06, st, 0, 0.75, fz);
  k.box(w - 0.7, dh * 0.5, 0.02, M.blackGl(), 0, 0.75 + dh * 0.28, fz + 0.04);
  k.rod(-w / 2 + 0.25, fz + 0.16, w / 2 - 0.25, fz + 0.16, 0.75 + dh - 0.15, 0.03, M.chrome());
  for (const sx of [-1, 1]) k.box(0.04, 0.04, 0.12, M.chrome(), sx * (w / 2 - 0.3), 0.75 + dh - 0.17, fz + 0.09);
  k.box(w - 0.06, 0.4, 0.05, st, 0, 0.32, fz);                                             // storage drawer
  k.rod(-0.4, fz + 0.1, 0.4, fz + 0.1, 0.6, 0.02, M.chrome());
};

B.hood = (k, w, d, h) => {
  const st = S.steel();
  const can = k.cyl(0.5, 1, 0.75, st, 0, 0, 0, 4); can.rotation.y = PI / 4; can.scale.set(w * 0.71, 1, d * 0.71);
  k.box(w, 0.12, d, st, 0, 0, 0);
  k.box(w - 0.3, 0.01, d - 0.3, mat('plain', '#8a8d91', { roughness: 0.5, metalness: 0.7 }), 0, -0.005, 0);      // baffle filter
  for (const sx of [-1, 1]) k.cyl(0.07, 0.07, 0.01, S.led(), sx * w * 0.28, -0.012, d * 0.12, 14);
  k.box(w * 0.38, h - 0.75, d * 0.48, st, 0, 0.75, -d / 2 + d * 0.24);
};

B.fridge = (k, w, d, h) => {
  // French-door fridge with bottom freezer and a through-the-door water/ice dispenser.
  const st = S.steel(), fz = d / 2 - 0.12, dark = mat('plain', '#202124', { roughness: 0.6 });
  k.box(w - 0.02, h - 0.02, d - 0.25, M.plain('#2a2b2e', 0.5), 0, 0, -0.12);
  k.box(w - 0.1, 0.25, 0.05, dark, 0, 0, fz - 0.02);                                       // kick grille
  const split = h * 0.6;
  k.box(w, split - 0.27, 0.22, st, 0, 0.27, fz - 0.1);                                     // freezer drawer
  k.rod(-w / 2 + 0.35, fz + 0.18, w / 2 - 0.35, fz + 0.18, split - 0.45, 0.032, M.chrome());
  for (const sx of [-1, 1]) k.box(0.05, 0.05, 0.16, M.chrome(), sx * (w / 2 - 0.4), split - 0.475, fz + 0.09);
  for (const sx of [-1, 1]) {
    const dw = w / 2 - 0.012;
    k.box(dw, h - split - 0.02, 0.22, st, sx * (w / 4 + 0.003), split + 0.01, fz - 0.1);
    const hx = sx * 0.1, hy = split + 0.45, hl = 1.75;
    k.cyl(0.032, 0.032, hl, M.chrome(), hx, hy, fz + 0.18, 10);
    for (const e of [0.06, hl - 0.06]) k.box(0.05, 0.05, 0.16, M.chrome(), hx, hy + e - 0.025, fz + 0.09);
  }
  const dx = -w / 4 - 0.05, dy = split + 1.15;                                            // dispenser
  k.box(0.62, 0.95, 0.03, M.blackGl(), dx, dy, fz + 0.115);
  k.box(0.5, 0.15, 0.01, mat('plain', '#0e2a3a', { emissive: '#1a5a7a', emissiveIntensity: 0.5 }), dx, dy + 0.75, fz + 0.13);
  k.box(0.32, 0.35, 0.04, mat('plain', '#2b2c2f', { roughness: 0.4 }), dx, dy + 0.25, fz + 0.12);
  k.box(w, 0.06, d - 0.25, dark, 0, h - 0.06, -0.12);
};

B.dishwasher = (k, w, d, h) => {
  const st = S.steel(), fz = d / 2 - 0.12;
  k.box(w, 0.33, d - 0.4, M.black(), 0, 0, -0.25);
  k.box(w - 0.02, h - 0.33 - 0.12, 0.08, st, 0, 0.33, fz);
  k.box(w - 0.02, 0.2, 0.08, mat('plain', '#2a2b2e', { roughness: 0.35, metalness: 0.5 }), 0, h - 0.32, fz);
  k.rod(-w / 2 + 0.2, fz + 0.16, w / 2 - 0.2, fz + 0.16, h - 0.45, 0.028, M.chrome());
  for (const sx of [-1, 1]) k.box(0.04, 0.04, 0.1, M.chrome(), sx * (w / 2 - 0.25), h - 0.47, fz + 0.09);
};

B.island = (k, w, d, h, c, c2, it) => {
  // Work side (+z) has drawer/door bays; seating side (−z) has shaker back panels and a 12" overhang.
  const m = M.plain(c, 0.4), carcass = M.plain(shadeHex(c, 0.75), 0.6), top = it.pattern === 'butcher' ? S.butcher() : S.quartz(c2);
  const tt = 0.105, over = 1.0, cw = w - 0.1, cd = d - over - 0.06, cz = over / 2 - 0.03, tk = 0.33;
  k.box(cw - 0.2, tk, cd - 0.3, M.plain(shadeHex(c, 0.45), 0.8), 0, 0, cz);
  k.box(cw, h - tk - tt, cd, carcass, 0, tk, cz);
  const bays = Math.max(1, Math.round(cw / 1.6)), bw = cw / bays, fz = cz + cd / 2;
  for (let i = 0; i < bays; i++) {
    const x = -cw / 2 + bw * (i + 0.5);
    drawerFront(k, bw - 0.02, 0.5, fz, m, x, h - tt - 0.52);
    shaker(k, bw - 0.02, h - tk - tt - 0.56, fz, m, x, tk + 0.01, 'bar');
    k.group(s => shaker(s, bw - 0.02, h - tk - tt - 0.04, 0, m, 0, 0, 'none'), x, tk + 0.01, cz - cd / 2, PI);
  }
  for (const sx of [-1, 1]) {                                                              // finished end panels
    k.group(s => shaker(s, cd - 0.04, h - tk - tt - 0.04, 0, m, 0, 0, 'none'), sx * cw / 2, tk + 0.01, cz, sx * PI / 2);
    k.box(0.12, h - tt, 0.12, m, sx * (cw / 2 - 0.02), 0, cz - cd / 2 - 0.04);
  }
  counterTop(k, w + 0.08, d, tt, top, h - tt, null);
};

B.builtinDesk = (k, w, d, h, c, c2, it) => {
  // Nook desk: drawer banks at both ends, a door cabinet in the middle, butcher-block top.
  const m = M.plain(c, 0.42), carcass = M.plain(shadeHex(c, 0.82), 0.6), tt = 0.13;
  const bank = Math.min(1.6, w * 0.16), cab = w * 0.26, knee = (w - 2 * bank - cab) / 2, tk = 0.3, fz = d / 2 - 0.07;
  const unit = (x, uw, kind) => {
    k.box(uw, tk, d - 0.4, M.plain(shadeHex(c, 0.45), 0.8), x, 0, -0.2);
    k.box(uw, h - tk - tt, d - 0.12, carcass, x, tk, -0.06);
    const ih = h - tk - tt - 0.02;
    if (kind === 'bank') { drawerFront(k, uw - 0.02, ih * 0.25, fz, m, x, tk + 0.01 + ih * 0.75); drawerFront(k, uw - 0.02, ih * 0.37, fz, m, x, tk + 0.01 + ih * 0.38); drawerFront(k, uw - 0.02, ih * 0.37, fz, m, x, tk + 0.01); }
    else for (const sx of [-1, 1]) shaker(k, uw / 2 - 0.01, ih, fz, m, x + sx * uw / 4, tk + 0.01, 'bar');
  };
  unit(-w / 2 + bank / 2, bank, 'bank'); unit(w / 2 - bank / 2, bank, 'bank'); unit(0, cab, 'cab');
  for (const sx of [-1, 1]) k.box(knee, 0.15, d - 0.12, m, sx * (cab / 2 + knee / 2), h - tt - 0.15, -0.06);   // apron
  k.rbox(w + 0.02, tt, d + 0.04, 0.02, S.butcher(c2), 0, h - tt, 0.02);
  void it;
};

B.barStool = (k, w, d, h, c, c2, it) => {
  const seatH = it.style === 'upholstered' ? h - 0.05 : h - 0.95;
  if (it.style === 'upholstered') {                                                        // backless upholstered stool
    const legs = M.wood('#3b2a1e', 0.5), fab = mat('fabric', c, { roughness: 0.95 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = k.cyl(0.05, 0.04, seatH - 0.3, legs, sx * (w / 2 - 0.15), 0, sz * (d / 2 - 0.15), 10); l.rotation.set(sz * 0.05, 0, -sx * 0.05); }
    for (const [ax, az] of [[1, 0], [0, 1]]) for (const s of [-1, 1]) k.box(ax ? w - 0.3 : 0.05, 0.05, ax ? 0.05 : d - 0.3, legs, az ? s * (w / 2 - 0.15) : 0, seatH * 0.3, ax ? s * (d / 2 - 0.15) : 0);
    plush(k, w, 0.36, d, fab, 0, seatH - 0.36, 0, { e: 0.35, puff: 0.25 });
    return;
  }
  // White spindle-back counter stool with a natural wood saddle seat (photo)
  const m = M.plain(c, 0.4), seat = M.wood('#c9a27a', 0.45);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = k.cyl(0.035, 0.05, seatH, m, sx * (w / 2 - 0.14), 0, sz * (d / 2 - 0.14), 10);
    l.rotation.set(sz * 0.07, 0, -sx * 0.07);
  }
  for (const [yy, ins] of [[seatH * 0.3, 0.1], [seatH * 0.62, 0.13]]) {
    k.rod(-w / 2 + ins, d / 2 - ins, w / 2 - ins, d / 2 - ins, yy, 0.025, m);
    k.rod(-w / 2 + ins, -d / 2 + ins, w / 2 - ins, -d / 2 + ins, yy, 0.025, m);
    k.rod(-w / 2 + ins, -d / 2 + ins, -w / 2 + ins, d / 2 - ins, yy + 0.1, 0.022, m);
    k.rod(w / 2 - ins, -d / 2 + ins, w / 2 - ins, d / 2 - ins, yy + 0.1, 0.022, m);
  }
  plush(k, w - 0.05, 0.14, d - 0.08, seat, 0, seatH - 0.06, 0.02, { e: 0.5, puff: 0.15 });
  for (const sx of [-1, 1]) { const p = k.cyl(0.035, 0.035, 0.95, m, sx * (w / 2 - 0.2), seatH + 0.04, -d / 2 + 0.16, 8); p.rotation.x = -0.12; }
  for (let i = -1; i <= 1; i++) { const sp = k.cyl(0.02, 0.02, 0.62, m, i * 0.2, seatH + 0.06, -d / 2 + 0.15, 6); sp.rotation.x = -0.12; }
  const rail = k.box(w - 0.3, 0.2, 0.08, m, 0, seatH + 0.82, -d / 2 + 0.07); rail.rotation.x = -0.12;
};

B.pendantDome = (k, w, d, h, c, c2, it, ctx) => {
  // Stainless dome pendant on a cord, white inside.
  const drop = Math.max(0.2, (ctx.ceil ?? 8) - (it.lift ?? 5.5) - h);
  k.cyl(0.012, 0.012, drop, M.black(), 0, h, 0, 6);
  k.cyl(0.22, 0.22, 0.06, S.steel(), 0, h + drop - 0.06, 0, 18);
  const r = w / 2, prof = [[r, 0], [r * 0.97, h * 0.18], [r * 0.85, h * 0.45], [r * 0.55, h * 0.75], [0.12, h * 0.95], [0.08, h]];
  lathe(k, `dome${r3(r)},${r3(h)}`, prof, mat('brushed', '#d2d3d2', { roughness: 0.35, metalness: 0.8 }), 0, 0, 0, 32);
  lathe(k, `domei${r3(r)},${r3(h)}`, prof.map(([a, b]) => [a - 0.012, b]), mat('plain', '#f4f2ee', { roughness: 0.6, side: THREE.BackSide }), 0, 0, 0, 32);
  k.cyl(0.05, 0.05, 0.25, M.nickel(), 0, h * 0.72, 0, 10);
  k.sph(0.13, M.bulb(), 0, h * 0.6, 0);
};

B.recessed = (k, w) => {
  k.cyl(w / 2, w / 2, 0.03, M.trim(), 0, 0, 0, 24);
  k.cyl(w / 2 - 0.06, w / 2 - 0.06, 0.012, lampMat('#fffaf0', '#fff0d6', 1.4, { roughness: 0.3 }), 0, -0.004, 0, 24);
};

// ── Lived-in dressing ───────────────────────────────────────────────────────
B.fruitBowl = (k, w, d, h, c, c2, it) => {
  const rnd = seeded(it.id), r = w / 2;
  lathe(k, `fb${r3(r)}`, [[0, 0], [r * 0.45, 0], [r * 0.5, 0.05], [r, h * 0.55], [r * 0.95, h * 0.55], [r * 0.45, 0.08], [0, 0.08]], S.ceramic(c), 0, 0, 0, 32);
  const cols = ['#e8862a', '#c0392b', '#e9d14a', '#7fb03a', '#c0392b'];
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + rnd(), rr = i < 5 ? r * 0.45 : 0;
    k.sph(0.13 + rnd() * 0.03, mat('plain', cols[i % cols.length], { roughness: 0.35 }), Math.cos(a) * rr, h * 0.45 + (i < 5 ? 0 : 0.12), Math.sin(a) * rr);
  }
  for (let i = 0; i < 3; i++) { const b = k.torus(0.32, 0.055, mat('plain', '#efd34a', { roughness: 0.5 }), 0.05, h * 0.62, -0.05 + i * 0.08, PI * 0.55); b.rotation.set(PI / 2, 0, 0.6 + i * 0.1); }
};

B.cuttingBoard = (k, w, d, h) => {
  const g = k.group(s => {
    s.rbox(w, h - 0.25, 0.08, 0.04, S.butcher('#b98b5a'), 0, 0, 0);
    s.rbox(w * 0.3, 0.3, 0.08, 0.06, S.butcher('#b98b5a'), 0, h - 0.3, 0);
  }, 0, 0, 0);
  g.rotation.x = -0.18; void d;
};

B.canisters = (k, w, d, h, c) => {
  const sizes = [[0.27, h], [0.24, h * 0.8], [0.21, h * 0.62]];
  let x = -w / 2;
  for (const [r, ht] of sizes) {
    x += r + 0.02;
    lathe(k, `can${r3(r)},${r3(ht)}`, [[0, 0], [r, 0], [r, ht - 0.1], [r * 0.96, ht - 0.08], [0, ht - 0.08]], S.ceramic(c), x, 0, 0, 28);
    k.cyl(r * 0.98, r * 0.98, 0.1, M.wood('#b98b5a', 0.5), x, ht - 0.1, 0, 28);
    x += r;
  }
};

B.coffeeMaker = (k, w, d, h) => {
  const b = mat('plain', '#1c1c1e', { roughness: 0.35 }), st = S.steel();
  k.rbox(w, 0.12, d, 0.03, b, 0, 0, 0);
  k.rbox(w * 0.4, h, d * 0.7, 0.05, b, w * 0.3, 0, -d * 0.12);
  k.rbox(w, h * 0.22, d, 0.05, b, 0, h * 0.78, 0);
  k.box(w * 0.36, h * 0.1, 0.01, st, w * 0.3, h * 0.55, d * 0.23);
  lathe(k, 'carafe', [[0, 0], [0.2, 0], [0.24, 0.2], [0.2, 0.42], [0.15, 0.5], [0, 0.5]], mat('plain', '#2a1a10', { roughness: 0.1, transparent: true, opacity: 0.85 }), -w * 0.12, 0.12, 0.05);
  k.box(0.12, 0.05, 0.05, b, -w * 0.12 + 0.24, 0.42, 0.05);
};

B.knifeBlock = (k, w, d, h) => {
  const g = k.group(s => {
    s.rbox(w, h * 0.75, d, 0.03, M.wood('#7a5233', 0.5), 0, 0, 0);
    for (let i = 0; i < 5; i++) s.rbox(0.07, 0.35, 0.1, 0.02, M.black(), -w / 2 + 0.08 + i * (w - 0.16) / 4, h * 0.72, -d * 0.2 + (i % 2) * 0.12);
  }, 0, 0, 0);
  g.rotation.x = -0.25;
};

B.paperTowel = (k, w, d, h) => {
  k.cyl(w * 0.35, w * 0.35, 0.04, M.chrome(), 0, 0, 0, 20);
  k.cyl(0.02, 0.02, h, M.chrome(), 0, 0, 0, 8);
  k.cyl(w * 0.42, w * 0.42, h - 0.12, mat('fabric', '#fbfaf6', { roughness: 1 }), 0, 0.05, 0, 24);
  void d;
};

B.vaseFlowers = (k, w, d, h, c, c2, it) => {
  const rnd = seeded(it.id), vh = h * 0.45, r = w * 0.22;
  lathe(k, `vf${r3(vh)},${r3(r)}`, [[0, 0], [r * 0.8, 0], [r, vh * 0.4], [r * 0.6, vh * 0.85], [r * 0.7, vh], [r * 0.65, vh], [0, vh * 0.1]], S.ceramic(c), 0, 0, 0);
  const p0 = new THREE.Vector3(0, vh * 0.5, 0);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * 6.28, lean = 0.12 + rnd() * 0.3, len = h * (0.45 + rnd() * 0.25);
    const p1 = new THREE.Vector3(Math.cos(a) * lean * len, vh * 0.5 + len, Math.sin(a) * lean * len);
    strut(k, p0, p1, 0.012, M.leaf('#4f7d39'));
    k.sph(0.09 + rnd() * 0.05, mat('plain', ['#f3f0e8', '#e9b8c4', '#f2d16b', '#b23a5a'][(rnd() * 4) | 0], { roughness: 0.8 }), p1.x, p1.y, p1.z);
  }
  void c2; void d;
};

B.basket = (k, w, d, h) => basket(k, w, d, h, 0, 0, 0);
