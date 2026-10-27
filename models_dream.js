// Dream-house set: yard & systems (privacy fence, pool, hot tub, heat pumps, generator, EV charger),
// mudroom lockers, cat litter cabinet, walk-in pantry shelving, ceiling beams, home theater and gym gear.
// Same local frame as models3d.js: origin at the footprint centre on the floor, +y up, +z = front.
import { mat } from './textures.js';
import { BUILDERS as B, M, lampMat, seeded } from './models3d.js';

const PI = Math.PI;

// ── Yard ────────────────────────────────────────────────────────────────────
B.privacyFence = (k, w, d, h, c) => {     // 6' board fence: 4×4 posts every ~8', solid boards, cap rail
  const boards = mat('beadboard', c, { roughness: 0.95, tile: 2.5 }), post = M.wood(c, 0.95);
  const n = Math.max(1, Math.round(w / 8)), bay = w / n;
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + i * bay;
    k.box(0.33, h + 0.25, 0.33, post, x, 0, 0);
    k.box(0.45, 0.12, 0.45, post, x, h + 0.25, 0);
  }
  k.box(w, h - 0.35, 0.07, boards, 0, 0.2, 0);
  for (const y of [0.7, h - 0.7]) for (const z of [-1, 1]) k.box(w, 0.29, 0.12, post, 0, y, z * 0.1);
  k.box(w, 0.12, 0.45, post, 0, h - 0.15, 0);
};

B.pool = (k, w, d, h, c, c2) => {          // in-ground pool: bluestone coping, tiled shell, water at −6"
  const cop = mat('stone', '#b9b4aa', { roughness: 0.9, tile: 3 }), shell = mat('mosaic', c, { roughness: 0.35, tile: 1.5 });
  const water = mat('plain', '#2f9fc4', { roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.72, depthWrite: false });
  const C = 1.1, iw = w - 2 * C, id = d - 2 * C, deep = 5.5;
  k.box(w, 0.16, C, cop, 0, 0, -d / 2 + C / 2); k.box(w, 0.16, C, cop, 0, 0, d / 2 - C / 2);
  k.box(C, 0.16, id, cop, -w / 2 + C / 2, 0, 0); k.box(C, 0.16, id, cop, w / 2 - C / 2, 0, 0);
  k.box(iw, deep, 0.1, shell, 0, -deep, -id / 2 - 0.05); k.box(iw, deep, 0.1, shell, 0, -deep, id / 2 + 0.05);
  k.box(0.1, deep, id, shell, -iw / 2 - 0.05, -deep, 0); k.box(0.1, deep, id, shell, iw / 2 + 0.05, -deep, 0);
  // floor slopes from 3'6" at the shallow end (+z) to 5'6"
  const fl = k.box(iw, 0.1, Math.hypot(id, 2), shell, 0, 0, 0); fl.position.y = -4.5; fl.rotation.x = -Math.atan2(2, id);
  k.box(iw * 0.97, 0.06, 0.08, mat('plain', '#1d4a73', { roughness: 0.4 }), 0, -0.5, -id / 2 + 0.06);   // waterline tile
  k.box(iw * 0.97, 0.06, 0.08, mat('plain', '#1d4a73', { roughness: 0.4 }), 0, -0.5, id / 2 - 0.06);
  k.box(iw - 0.02, 0.02, id - 0.02, water, 0, -0.55, 0);
  for (let i = 0; i < 3; i++) k.box(5, 0.6, 1.1, shell, 0, -0.9 - i * 0.6 - 0.6, id / 2 - 0.55 - i * 1.1);   // entry steps
  for (const sx of [-1, 1]) {                                                                         // ladder at the deep end
    const x = sx * 0.8;
    k.cyl(0.04, 0.04, 3.2, M.chrome(), x, -2.6, -id / 2 + 0.35, 8);
    k.torus(0.3, 0.04, M.chrome(), x, 0.6, -id / 2 + 0.05, PI).rotation.y = PI / 2;
  }
};

B.hotTub = (k, w, d, h, c, c2) => {        // acrylic spa in a composite cabinet, cover folded back
  const cab = mat('deck', c, { roughness: 0.85, tile: 3 }), shell = M.plain('#e8eaea', 0.25);
  k.rbox(w, h - 0.15, d, 0.3, cab, 0, 0, 0);
  k.rbox(w - 0.1, 0.15, d - 0.1, 0.2, shell, 0, h - 0.2, 0);
  k.rbox(w - 1, 0.05, d - 1, 0.4, mat('plain', '#5fc4d8', { roughness: 0.03, transparent: true, opacity: 0.85 }), 0, h - 0.18, 0);
  const cover = k.rbox(w - 0.1, 0.35, d / 2 - 0.1, 0.12, M.plain(c2, 0.8), 0, h, -d / 4);
  cover.rotation.x = -0.15; cover.position.z -= 0.2;
  k.box(w * 0.5, 0.6, 1.4, cab, 0, 0, d / 2 + 0.7);                                                    // step
  for (let i = 0; i < 6; i++) k.sph(0.06, M.chrome(), (i - 2.5) * 0.8, h - 0.5, d / 2 - 0.55);
};

// ── Systems ─────────────────────────────────────────────────────────────────
B.heatPump = (k, w, d, h, c) => {          // cold-climate outdoor unit on a pad
  const body = M.plain(c, 0.45, { metalness: 0.2 }), grille = M.plain('#2d2f32', 0.6, { metalness: 0.4 });
  k.box(w + 0.4, 0.3, d + 0.4, M.concrete(), 0, 0, 0);
  for (const sx of [-1, 1]) k.box(0.25, 0.5, d, M.plain('#2d2f32', 0.6), sx * (w / 2 - 0.35), 0.3, 0);
  k.box(w, h - 0.8, d, body, 0, 0.8, 0);
  const fan = k.cyl(h * 0.32, h * 0.32, 0.04, grille, -w * 0.15, 0.8 + (h - 0.8) / 2, d / 2 + 0.01, 24);
  fan.rotation.x = PI / 2; fan.position.y = 0.8 + (h - 0.8) / 2;
  for (let i = -3; i <= 3; i++) k.box(0.02, h * 0.62, 0.02, M.plain('#b9bcc0', 0.4, { metalness: 0.6 }), -w * 0.15 + i * h * 0.09, 0.8 + (h - 0.8) / 2 - h * 0.31, d / 2 + 0.05);
  k.box(w * 0.25, 0.4, 0.05, M.plain('#6d7277', 0.5), w * 0.33, h - 0.8, d / 2 + 0.01);
};

B.generator = (k, w, d, h, c) => {         // whole-house standby generator
  k.box(w + 0.5, 0.3, d + 0.5, M.concrete(), 0, 0, 0);
  k.rbox(w, h - 0.3, d, 0.12, M.plain(c, 0.5, { metalness: 0.2 }), 0, 0.3, 0);
  for (let i = 0; i < 7; i++) k.box(w * 0.28, 0.04, 0.03, M.plain('#4d5054', 0.6), w * 0.28, 0.6 + i * 0.18, d / 2 + 0.01);
  k.box(w * 0.18, 0.12, 0.03, M.plain('#2d6db3', 0.5), -w * 0.3, h - 0.55, d / 2 + 0.01);
};

B.evCharger = (k, w, d, h, c) => {         // Level 2 wall charger with a coiled cable
  k.rbox(w, h, d * 0.6, 0.08, M.plain(c, 0.35), 0, 0, -d * 0.2);
  k.box(w * 0.5, 0.04, 0.02, lampMat('#7fd3ff', '#2aa8ff', 1.2), 0, h * 0.72, d * 0.1 + 0.01);
  k.torus(w * 0.42, 0.04, M.black(), 0, -h * 0.25, d * 0.1);
  k.box(0.16, 0.35, 0.16, M.black(), w * 0.32, h * 0.25, d * 0.15);
};

B.battery = (k, w, d, h, c) => {           // wall-mounted home battery
  k.rbox(w, h, d, 0.12, M.plain(c, 0.3), 0, 0, 0);
  k.box(0.04, h * 0.55, 0.02, lampMat('#d8f3ff', '#9be0ff', 0.9), w * 0.38, h * 0.22, d / 2 + 0.005);
};

B.airHandler = (k, w, d, h, c) => {        // heat-pump air handler with supply plenum and ducts
  const sheet = M.plain('#c9ccd0', 0.45, { metalness: 0.5 });
  k.box(w, h * 0.72, d, M.plain(c, 0.45), 0, 0, 0);
  k.box(w * 0.9, h * 0.28, d * 0.9, sheet, 0, h * 0.72, 0);
  k.box(w * 0.5, 0.9, 1.4, sheet, 0, h - 0.9, -d / 2 - 0.7);
  k.box(0.6, 0.06, 0.4, M.plain('#2f6db3', 0.5), -w * 0.25, h * 0.5, d / 2 + 0.01);
};

B.smartPanel = (k, w, d, h, c) => {        // smart-home touch panel (lights, HVAC, locks, energy)
  k.rbox(w, h, d, 0.03, M.plain('#f4f4f2', 0.3), 0, 0, 0);
  k.box(w * 0.88, h * 0.82, 0.01, mat('plain', '#0d1622', { roughness: 0.05, emissive: '#1d3a5c', emissiveIntensity: 0.9 }), 0, h * 0.09, d / 2);
  const tiles = ['#e8b04a', '#4fa3e0', '#7cc47a', '#e06b5a'];
  tiles.forEach((t, i) => k.box(w * 0.18, h * 0.22, 0.012, mat('plain', t, { emissive: t, emissiveIntensity: 0.6 }), -w * 0.3 + (i % 2) * w * 0.25, h * (0.52 - (i / 2 | 0) * 0.3), d / 2 + 0.002));
};

// ── Mudroom & pets ──────────────────────────────────────────────────────────
B.cubbies = (k, w, d, h, c, c2) => {       // locker wall: shoe bins, bench, open lockers with hooks, top cubbies
  const paint = M.plain(c, 0.45), seat = M.wood(c2, 0.5), wick = mat('wicker', '#a8875c', { roughness: 0.95 });
  const n = Math.max(2, Math.round(w / 1.6)), cw = w / n, t = 0.07;
  k.box(w, h, t, paint, 0, 0, -d / 2 + t / 2);                                         // back
  for (let i = 0; i <= n; i++) k.box(t, h, d, paint, -w / 2 + i * cw, 0, 0);             // dividers
  k.box(w, 0.35, d, paint, 0, 0, 0);                                                     // toe kick
  k.box(w, t, d, paint, 0, 0.7, 0);                                                      // shoe shelf
  k.box(w + 0.1, 0.12, d + 0.08, seat, 0, 1.55, 0.04);                                   // bench top
  k.box(w, t, d * 0.9, paint, 0, h - 1.3, 0);                                            // top cubbies
  k.box(w + 0.15, 0.15, d + 0.1, paint, 0, h - 0.15, 0.02);                              // crown
  const rnd = seeded('cub' + w);
  const shoe = ['#3b3b3b', '#7a4b2a', '#c9c3b8', '#2f4f7a', '#a83a32'];
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * cw;
    k.box(cw - 0.18, 0.6, d - 0.25, wick, x, 0.78, 0.05);                               // shoe bins
    for (let j = 0; j < 2; j++) k.rbox(0.3, 0.25, 0.75, 0.1, M.plain(shoe[(rnd() * 5) | 0], 0.7), x + (j - 0.5) * 0.36, 0.42, 0.1);
    k.box(cw - 0.18, 0.75, d * 0.75, wick, x, h - 1.2, 0);                               // top baskets
    for (const hx of [-0.3, 0.3]) { k.cyl(0.03, 0.03, 0.25, M.iron(), x + hx * cw / 1.6, 4.6, -d / 2 + 0.2, 6).rotation.x = PI / 2; }
    if (rnd() < 0.7) k.rbox(cw * 0.6, 2, 0.35, 0.15, M.fabric(['#2f4f7a', '#8a2f2f', '#4f6a4f', '#c9a050'][i % 4]), x, 2.6, -d / 2 + 0.3);   // coats
  }
};

B.litterBox = (k, w, d, h, c, c2) => {     // shaker cabinet that hides the litter box; cat door on the side
  const paint = M.plain(c, 0.45);
  k.box(w, h, d, paint, 0, 0, 0);
  k.box(w + 0.08, 0.1, d + 0.06, M.wood(c2, 0.5), 0, h, 0.02);
  for (const sx of [-1, 1]) {
    k.box(w / 2 - 0.08, h - 0.4, 0.04, paint, sx * w / 4, 0.25, d / 2 + 0.01);
    k.box(w / 2 - 0.3, h - 0.9, 0.03, M.plain(c, 0.55), sx * w / 4, 0.5, d / 2 + 0.035);
    k.sph(0.05, M.nickel(), sx * 0.12, h * 0.55, d / 2 + 0.08);
  }
  const hole = k.cyl(0.36, 0.36, 0.05, M.black(), -w / 2 - 0.01, 0.75, 0, 20); hole.rotation.z = PI / 2; hole.position.y = 0.75;
  k.box(0.9, 0.06, 0.6, M.plain('#8aa0b0', 0.6), w / 2 - 0.6, h + 0.1, 0);              // scoop tray
};

// ── Pantry ──────────────────────────────────────────────────────────────────
B.pantryShelves = (k, w, d, h, c) => {     // walk-in pantry: deep wood shelves stocked with jars, bins and boxes
  const shelf = M.wood(c, 0.55), rnd = seeded('pan' + w + d);
  const cols = ['#c9a050', '#8a2f2f', '#3d6b45', '#e8e2d6', '#2f4f7a', '#d9822b', '#f4f2ec'];
  for (const sx of [-1, 1]) k.box(0.06, h, d, shelf, sx * (w / 2 - 0.03), 0, 0);
  for (let i = 0; i < 6; i++) {
    const y = 0.4 + i * (h - 0.6) / 5;
    k.box(w, 0.08, d, shelf, 0, y, 0);
    if (i === 5) continue;
    let x = -w / 2 + 0.15;
    while (x < w / 2 - 0.4) {
      const kind = rnd(), bw = 0.25 + rnd() * 0.35;
      if (kind < 0.4) k.cyl(bw / 2, bw / 2, 0.45 + rnd() * 0.3, mat('plain', '#e8eef0', { roughness: 0.05, transparent: true, opacity: 0.55 }), x + bw / 2, y + 0.08, 0, 12);
      else if (kind < 0.75) k.box(bw, 0.5 + rnd() * 0.4, d * 0.6, M.plain(cols[(rnd() * cols.length) | 0], 0.7), x + bw / 2, y + 0.08, 0);
      else k.box(bw + 0.4, 0.5, d * 0.8, mat('wicker', '#a8875c', { roughness: 0.95 }), x + (bw + 0.4) / 2, y + 0.08, 0);
      x += bw + 0.08 + (kind >= 0.75 ? 0.4 : 0);
    }
  }
};

// ── Ceilings ────────────────────────────────────────────────────────────────
B.beams = (k, w, d, h, c) => {             // exposed box beams: spaced along the depth, spanning the width
  const wood = mat('wood', c, { roughness: 0.75, tile: 3 });
  const n = Math.max(1, Math.round(d / 4.5)), sp = d / (n + 1);
  for (let i = 1; i <= n; i++) k.box(w, h, 0.6, wood, 0, 0, -d / 2 + i * sp);
  k.box(0.6, h * 0.9, d, wood, -w / 2 + 0.3, h * 0.1, 0);
  k.box(0.6, h * 0.9, d, wood, w / 2 - 0.3, h * 0.1, 0);
};

// ── Media room ──────────────────────────────────────────────────────────────
B.speaker = (k, w, d, h, c, c2, it) => {   // floor-standing tower, or a ceiling speaker when ceiling-mounted
  if (it.type === 'speaker-ceiling') {
    k.cyl(w / 2, w / 2, h, M.plain('#f4f3ef', 0.6), 0, 0, 0, 20);
    k.cyl(w / 2 - 0.05, w / 2 - 0.05, 0.01, mat('plain', '#e3e2dd', { roughness: 0.95 }), 0, -0.005, 0, 20);
    return;
  }
  const cab = M.wood(c, 0.4), cone = M.plain('#1c1c1e', 0.6), cloth = M.fabric('#1f2022');
  k.box(w, 0.1, d + 0.1, M.black(), 0, 0, 0);
  k.rbox(w, h - 0.1, d, 0.05, cab, 0, 0.1, 0);
  k.box(w - 0.1, h - 0.4, 0.02, cloth, 0, 0.25, d / 2 + 0.005);
  for (const [y, r] of [[h - 0.45, 0.1], [h - 0.95, 0.22], [h - 1.55, 0.22]]) { const s = k.cyl(r, r, 0.03, cone, 0, y, d / 2 + 0.02, 18); s.rotation.x = PI / 2; s.position.y = y; }
};

B.subwoofer = (k, w, d, h, c) => {
  k.rbox(w, h, d, 0.05, M.plain(c, 0.5), 0, 0, 0);
  const s = k.cyl(w * 0.38, w * 0.38, 0.03, M.plain('#2b2b2e', 0.6), 0, h / 2, d / 2 + 0.01, 24); s.rotation.x = PI / 2; s.position.y = h / 2;
};

B.projScreen = (k, w, d, h, c) => {        // fixed-frame 16:9 projection screen with black velvet border
  k.box(w, h, 0.12, mat('fabric', '#111113', { roughness: 1 }), 0, 0, -d / 2 + 0.06);
  k.box(w - 0.5, h - 0.5, 0.02, mat('plain', '#e9eaec', { roughness: 0.9, emissive: '#2a3550', emissiveIntensity: 0.25 }), 0, 0.25, -d / 2 + 0.13);
};

B.projector = (k, w, d, h) => {
  k.box(0.08, 0.8, 0.08, M.black(), 0, h - 0.8 + 0.4, 0);
  k.rbox(w, 0.45, d, 0.08, M.plain('#f0f0ee', 0.4), 0, h - 1.25, 0);
  const lens = k.cyl(0.12, 0.12, 0.08, M.blackGl(), w * 0.25, h - 1.03, d / 2 + 0.03, 16); lens.rotation.x = PI / 2; lens.position.y = h - 1.03;
};

// ── Gym ─────────────────────────────────────────────────────────────────────
B.treadmill = (k, w, d, h, c) => {
  const frame = M.plain(c, 0.5, { metalness: 0.3 });
  k.rbox(w, 0.55, d, 0.15, frame, 0, 0, 0);
  k.box(w - 0.8, 0.04, d - 0.9, M.rubber(), 0, 0.55, 0.15);
  for (const sx of [-1, 1]) { const u = k.box(0.12, h - 0.5, 0.12, frame, sx * (w / 2 - 0.15), 0.5, -d / 2 + 0.4); u.rotation.x = 0.12; }
  k.box(w, 0.1, 0.12, frame, 0, h - 0.6, -d / 2 + 0.25);
  k.rbox(w * 0.75, 0.55, 0.35, 0.08, M.plain('#26282b', 0.4), 0, h - 0.55, -d / 2 + 0.3).rotation.x = -0.5;
  k.box(w * 0.4, 0.3, 0.02, mat('plain', '#0d1622', { emissive: '#3a6ea8', emissiveIntensity: 0.6 }), 0, h - 0.35, -d / 2 + 0.47).rotation.x = -0.5;
};

B.bike = (k, w, d, h, c) => {              // spin bike with a screen
  const frame = M.plain(c, 0.4, { metalness: 0.3 });
  for (const z of [-d / 2 + 0.3, d / 2 - 0.3]) k.box(w, 0.12, 0.25, frame, 0, 0, z);
  const fw = k.cyl(0.7, 0.7, 0.2, M.plain('#2b2b2e', 0.3, { metalness: 0.7 }), 0, 0.6, -d * 0.2, 24); fw.rotation.z = PI / 2; fw.position.y = 1.1;
  const post = k.box(0.15, 2.4, 0.15, frame, 0, 0.1, d * 0.1); post.rotation.x = 0.3;
  k.rbox(0.45, 0.15, 0.85, 0.06, M.leather('#1c1c1e'), 0, 2.6, d * 0.27);
  const bar = k.box(0.15, 2.8, 0.15, frame, 0, 0.1, -d * 0.3); bar.rotation.x = -0.15;
  k.box(1.4, 0.08, 0.3, M.rubber(), 0, h - 0.4, -d * 0.36);
  k.box(1.2, 0.75, 0.05, mat('plain', '#0d1622', { emissive: '#22324a', emissiveIntensity: 0.6 }), 0, h - 0.1, -d * 0.42).rotation.x = -0.3;
};

B.weightBench = (k, w, d, h, c) => {
  const frame = M.plain('#2b2b2e', 0.4, { metalness: 0.5 });
  for (const z of [-d / 2 + 0.3, d / 2 - 0.3]) k.box(w, 0.1, 0.2, frame, 0, 0, z);
  k.box(0.15, h - 0.25, 0.15, frame, 0, 0.1, 0);
  k.rbox(w * 0.6, 0.25, d - 0.2, 0.08, M.leather(c), 0, h - 0.25, 0);
};

B.weightRack = (k, w, d, h, c) => {        // dumbbell rack + kettlebells
  const frame = M.plain('#2b2b2e', 0.4, { metalness: 0.5 }), iron = M.plain('#1f1f21', 0.5, { metalness: 0.6 });
  for (const sx of [-1, 1]) k.box(0.12, h, d, frame, sx * (w / 2 - 0.06), 0, 0);
  for (const [y, z] of [[h * 0.45, 0.2], [h * 0.85, -0.2]]) {
    k.box(w, 0.06, d * 0.5, frame, 0, y, z);
    for (let i = 0; i < 8; i++) {
      const x = -w / 2 + 0.35 + i * (w - 0.7) / 7, r = 0.12 + i * 0.012;
      const bell = k.cyl(r, r, 0.75, iron, x, y + 0.06 + r, z, 12); bell.rotation.x = PI / 2; bell.position.y = y + 0.06 + r;
    }
  }
  for (let i = 0; i < 3; i++) { k.sph(0.3 + i * 0.05, iron, -w / 2 + 0.5 + i * 0.9, 0.3 + i * 0.05, d / 2 + 0.6); k.torus(0.15, 0.04, iron, -w / 2 + 0.5 + i * 0.9, 0.7 + i * 0.1, d / 2 + 0.6, PI); }
};

// ── Shower with two heads (primary bath) ────────────────────────────────────
const baseShower = B.shower;
B.shower = (k, w, d, h, c, c2, it) => {
  baseShower(k, w, d, h, c, c2, it);
  if ((it.heads ?? 1) < 2) return;
  k.cyl(0.25, 0.25, 0.05, M.chrome(), w * 0.3, 6.4, -d / 2 + 0.6, 20);
  k.cyl(0.03, 0.03, 0.6, M.chrome(), w * 0.3, 6.45, -d / 2 + 0.3, 6).rotation.x = PI / 2;
  k.cyl(0.12, 0.12, 0.08, M.chrome(), w * 0.3, 3.8, -d / 2 + 0.15, 16).rotation.x = PI / 2;
  k.box(w * 0.4, 0.12, 1.1, mat('subway', c, { roughness: 0.25, tile: 4 }), w * 0.05, 1.6, -d / 2 + 0.67);   // bench
};
