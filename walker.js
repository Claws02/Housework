// Walk-through mode: a little character you drive around the house.
//  · Touch: floating joystick in the bottom-left thumb zone, swipe anywhere else to look.
//  · Desktop: WASD / arrows to move, drag to look, Shift to run, V to switch camera, Esc to exit.
// Collision runs in plan space (x, z = plan y) against walls (minus door openings), roof gable
// ends and large furniture; the floor height comes from room slabs, stairs, steps and the ground.
import * as THREE from 'three';
import { CATALOG_BY_TYPE } from './furniture.js';
import { wallOpenings, roomAt } from './viewer3d.js';
import { makeCharacter, SHIRT_COLORS } from './character.js';

const RADIUS = 0.58;         // 14" body width turned sideways — fits through any gap a real person could
const BODY_H = 5.4;          // collision height
const STEP_UP = 1.05;        // tallest step you can walk up
const MAX_DROP = 2.6;        // won't walk off ledges taller than this
// Real-world scale (feet). Person 5'10" → eyes ~4.5" below the crown.
export const PERSON_H = 5.83;
const EYE = PERSON_H - 0.375;        // 5'5.5"
const WALK = 4.4, JOG = 9;           // 3 mph stroll · 6 mph jog (push the stick to its edge / hold Shift)
const NO_COLLIDE = new Set(['rug', 'stairs', 'stairsDown', 'stairOpening', 'steps', 'joists', 'ceilingLight', 'pendant',
  'lantern', 'curtains', 'wallArt', 'mirror', 'hosta', 'door', 'slider', 'window', 'opening', 'garageDoor', 'tableLamp', 'tv', 'elecPanel']);
const PREF_KEY = 'house-walk';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };

export class Walker {
  constructor(viewer, ui, cb = {}) {
    this.v = viewer; this.ui = ui; this.cb = cb;
    let pref = {};
    try { pref = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (_) {}
    this.thirdPerson = pref.third ?? true;
    this.shirtIdx = pref.shirt ?? 0;
    this.char = makeCharacter({ shirt: SHIRT_COLORS[this.shirtIdx % SHIRT_COLORS.length] });
    this.char.group.scale.setScalar(PERSON_H / 5.7);   // model is 5'8.4" tall as built
    this.v.scene.add(this.char.group);

    this.pos = new THREE.Vector3();   // feet (world): x, y, z
    this.vy = 0;
    this.facing = 0;                  // character body yaw
    this.yaw = 0; this.pitch = -0.3; // camera
    // portrait phones have a narrow horizontal view, so sit the camera further back
    this.camDist = innerHeight > innerWidth ? 13 : 10;
    this.keys = new Set();
    this.joy = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
    this.look = new Map();            // pointerId → last {x,y}
    this.floorIdx = -1; this.outdoors = null; this.roomName = '';
    this._ray = new THREE.Raycaster();

    this.rebuildWorld();
    this._spawn();
    this._bindInput();
    this._syncUI();
    this._updateVisibility(true);
  }

  // ── World (colliders + walkable surfaces) ────────────────────────────────
  rebuildWorld() {
    const st = this.v.state, site = st.site || {};
    const segs = [], boxes = [], circles = [], slabs = [], ramps = [];
    st.floors.forEach((f, fi) => {
      // walls → solid segments with a vertical range, minus door/window openings
      for (const w of this.v._allWalls(f)) {
        const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L = Math.hypot(dx, dy);
        if (L < 0.1) continue;
        const base = f.elev + (w.base || 0), H = w.height ?? f.height, half = (w.thick ?? 0.4) / 2;
        const seg = (t0, t1, y0, y1) => {
          if (t1 - t0 < 0.05 || y1 - y0 < 0.05) return;
          segs.push({ ax: w.x1 + dx * t0 / L, az: w.y1 + dy * t0 / L, bx: w.x1 + dx * t1 / L, bz: w.y1 + dy * t1 / L, half, y0: base + y0, y1: base + y1 });
        };
        let cur = 0;
        for (const o of wallOpenings(w, f.furniture)) {
          const b = o.bottom - (w.base || 0), t = o.top - (w.base || 0);
          if (o.t0 > cur) seg(cur, o.t0, 0, H);
          const s = Math.max(cur, o.t0);
          seg(s, o.t1, 0, Math.max(0, b)); seg(s, o.t1, t, H);
          cur = Math.max(cur, o.t1);
        }
        seg(cur, L, 0, H);
      }
      // floor slabs (with stair holes)
      const holes = f.furniture.filter(it => CATALOG_BY_TYPE[it.type]?.floorHole).map(h => {
        const c = Math.abs(Math.cos(h.rotation)), s = Math.abs(Math.sin(h.rotation));
        const hw = (h.width * c + h.depth * s) / 2, hd = (h.width * s + h.depth * c) / 2;
        return { x0: h.x - hw, x1: h.x + hw, z0: h.y - hd, z1: h.y + hd };
      });
      for (const r of f.rooms) slabs.push({ x0: r.x, x1: r.x + r.width, z0: r.y, z1: r.y + r.height, top: f.elev + (r.offset || 0), holes, fi, room: r });
      // furniture → oriented boxes; stairs/steps → ramps
      for (const it of f.furniture) {
        const cat = CATALOG_BY_TYPE[it.type]; if (!cat) continue;
        const y = this.v._itemY(f, fi, it, cat), h = it.height ?? cat.height3d ?? 2.5;
        const m = cat.model;
        if (m === 'stairs' || m === 'stairsDown' || m === 'steps') {
          ramps.push({ x: it.x, z: it.y, rot: it.rotation, hw: it.width / 2, hd: it.depth / 2, y, h: m === 'stairsDown' ? -h : h, down: m === 'stairsDown' });
          continue;
        }
        if (m === 'tree' || m === 'pine') { circles.push({ x: it.x, z: it.y, r: Math.max(0.5, it.width * 0.055), y0: y, y1: y + h }); continue; }
        if (NO_COLLIDE.has(m) || cat.opening || cat.mount === 'ceiling' || h < 1.1 || it.width * it.depth < 2.2) continue;
        boxes.push({ x: it.x, z: it.y, c: Math.cos(it.rotation), s: Math.sin(it.rotation), hw: it.width / 2, hd: it.depth / 2, y0: y + 0.25, y1: y + h });
      }
    });
    // Gable ends of roofs act as walls (they're the upstairs side walls of a Cape)
    for (const rf of site.roofs || []) {
      const ng = rf.noGable || [];
      const add = (ax, az, bx, bz) => segs.push({ ax, az, bx, bz, half: 0.25, y0: rf.eave - 0.2, y1: rf.ridge });
      if (rf.axis !== 'y') {
        if (!ng.includes('w')) add(rf.x, rf.y, rf.x, rf.y + rf.d);
        if (!ng.includes('e')) add(rf.x + rf.w, rf.y, rf.x + rf.w, rf.y + rf.d);
      } else {
        if (!ng.includes('n')) add(rf.x, rf.y, rf.x + rf.w, rf.y);
        if (!ng.includes('s')) add(rf.x, rf.y + rf.d, rf.x + rf.w, rf.y + rf.d);
      }
    }
    // Ground (with the basement cut out), limited to the lot
    const lot = site.lot ?? { x: -100, y: -100, w: 200, h: 200 };
    let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
    const gy = site.ground ?? 0;
    for (const f of st.floors) if (f.elev < gy) for (const r of f.rooms) { bx0 = Math.min(bx0, r.x); bx1 = Math.max(bx1, r.x + r.width); bz0 = Math.min(bz0, r.y); bz1 = Math.max(bz1, r.y + r.height); }
    this.ground = { y: gy, lot, hole: isFinite(bx0) ? { x0: bx0, x1: bx1, z0: bz0, z1: bz1 } : null };
    Object.assign(this, { segs, boxes, circles, slabs, ramps });
    this.occluders = this.v._pickables.filter(o => ['wall', 'roof', 'room'].includes(o.userData.pick?.kind) && o.isMesh);
  }

  /** Highest walkable surface at (x, z) that's no higher than maxY. */
  surfaceAt(x, z, maxY) {
    let best = -Infinity;
    const take = t => { if (t <= maxY && t > best) best = t; };
    for (const s of this.slabs) {
      if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
      if (s.holes.some(h => x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1)) continue;
      take(s.top);
    }
    for (const r of this.ramps) {
      const dx = x - r.x, dz = z - r.z, c = Math.cos(r.rot), sn = Math.sin(r.rot);
      const lx = dx * c + dz * sn, lz = -dx * sn + dz * c;
      if (Math.abs(lx) > r.hw + 0.05 || lz < -r.hd - 0.7 || lz > r.hd + 0.4) continue;
      // up: 0 at the front (+z) → h at the back (−z); down: 0 at the back → −h at the front
      const t = clamp(r.down ? (lz + r.hd) / (2 * r.hd) : (r.hd - lz) / (2 * r.hd), 0, 1);
      take(r.y + r.h * t);
    }
    const g = this.ground, L = g.lot;
    if (x >= L.x && x <= L.x + L.w && z >= L.y && z <= L.y + L.h && !(g.hole && x > g.hole.x0 && x < g.hole.x1 && z > g.hole.z0 && z < g.hole.z1)) take(g.y);
    return best;
  }

  /** Push a circle at (x, z) out of everything that overlaps the body's height band [y0, y1]. */
  _resolve(p, y0, y1) {
    for (let iter = 0; iter < 3; iter++) {
      for (const s of this.segs) {
        if (s.y1 <= y0 || s.y0 >= y1) continue;
        const ex = s.bx - s.ax, ez = s.bz - s.az, l2 = ex * ex + ez * ez;
        const t = l2 ? clamp(((p.x - s.ax) * ex + (p.z - s.az) * ez) / l2, 0, 1) : 0;
        const cx = s.ax + ex * t, cz = s.az + ez * t;
        let dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
        const min = s.half + RADIUS;
        if (d >= min) continue;
        if (d < 1e-4) { dx = -ez; dz = ex; d = Math.hypot(dx, dz) || 1; }
        p.x = cx + dx / d * min; p.z = cz + dz / d * min;
      }
      for (const b of this.boxes) {
        if (b.y1 <= y0 || b.y0 >= y1) continue;
        const dx = p.x - b.x, dz = p.z - b.z;
        const lx = dx * b.c + dz * b.s, lz = -dx * b.s + dz * b.c;
        const qx = clamp(lx, -b.hw, b.hw), qz = clamp(lz, -b.hd, b.hd);
        let ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz);
        if (d >= RADIUS) continue;
        let nx, nz;
        if (d < 1e-4) {      // centre inside the box: leave by the nearest face
          const px = b.hw - Math.abs(lx), pz = b.hd - Math.abs(lz);
          if (px < pz) { nx = qx + Math.sign(lx || 1) * (px + RADIUS); nz = lz; }
          else { nx = lx; nz = qz + Math.sign(lz || 1) * (pz + RADIUS); }
        } else { nx = qx + ox / d * RADIUS; nz = qz + oz / d * RADIUS; }
        p.x = b.x + nx * b.c - nz * b.s; p.z = b.z + nx * b.s + nz * b.c;
      }
      for (const c of this.circles) {
        if (c.y1 <= y0 || c.y0 >= y1) continue;
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + RADIUS;
        if (d < min && d > 1e-4) { p.x = c.x + dx / d * min; p.z = c.z + dz / d * min; }
      }
    }
  }

  _blocked(x, z, y) {
    const p = { x, z }; this._resolve(p, y + 0.9, y + BODY_H);
    return Math.hypot(p.x - x, p.z - z) > 0.01;
  }

  _spawn() {
    const st = this.v.state, gf = st.site?.groundFloor ?? 0;
    const lvl = st.view3d.level === 'all' ? st.activeFloor : st.view3d.level;
    let x = 0, z = 0, yaw = 0;
    const walk = lvl === gf && st.floors[gf]?.rooms.find(r => r.outdoor && /walk|path|entry/i.test(r.name));
    if (walk) {   // start on the front walk looking at the house
      x = walk.x + walk.width / 2; z = walk.y + Math.min(6, walk.height / 2); yaw = Math.PI;
    } else {
      const f = st.floors[lvl] || st.floors[0];
      const r = [...f.rooms].filter(q => !q.outdoor && !/garage/i.test(q.name)).sort((a, b) => b.width * b.height - a.width * a.height)[0] || f.rooms[0];
      if (r) { x = r.x + r.width / 2; z = r.y + r.height / 2; }
      yaw = Math.PI;
    }
    // spiral out until there's floor and nothing in the way
    const f = st.floors[lvl] || st.floors[0];
    for (let i = 0; i < 400; i++) {
      const a = i * 0.7, rr = i * 0.12, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
      const y = this.surfaceAt(px, pz, f.elev + 3);
      if (y > -Infinity && !this._blocked(px, pz, y)) { this.pos.set(px, y, pz); break; }
    }
    this.yaw = this.facing = yaw;
  }

  // ── Input ───────────────────────────────────────────────────────────────
  _bindInput() {
    const ui = this.ui;
    this.$base = ui.querySelector('#joy-base'); this.$knob = ui.querySelector('#joy-knob');
    this.$zone = ui.querySelector('#walk-touch');
    const zone = this.$zone;
    const inJoyZone = e => {
      const r = zone.getBoundingClientRect();
      return e.clientX < r.left + Math.min(r.width * 0.45, 320) && e.clientY > r.top + r.height * 0.35;
    };
    this._onDown = e => {
      e.preventDefault();
      try { zone.setPointerCapture(e.pointerId); } catch (_) {}
      if (this.joy.id === null && inJoyZone(e)) this._startJoy(e);
      else this.look.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    this._onMove = e => {
      if (e.pointerId === this.joy.id) {
        const R = 56, dx = e.clientX - this.joy.cx, dy = e.clientY - this.joy.cy, d = Math.hypot(dx, dy);
        const k = d > R ? R / d : 1;
        this.joy.x = dx * k / R; this.joy.y = dy * k / R;
        this.$knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        return;
      }
      const l = this.look.get(e.pointerId);
      if (!l) return;
      const sens = e.pointerType === 'mouse' ? 0.005 : 0.0075;
      this.yaw -= (e.clientX - l.x) * sens;
      this.pitch = clamp(this.pitch - (e.clientY - l.y) * sens, this.thirdPerson ? -1.15 : -1.35, this.thirdPerson ? 0.45 : 1.35);
      l.x = e.clientX; l.y = e.clientY;
    };
    this._onUp = e => {
      if (e.pointerId === this.joy.id) this._endJoy();
      this.look.delete(e.pointerId);
    };
    zone.addEventListener('pointerdown', this._onDown);
    zone.addEventListener('pointermove', this._onMove);
    zone.addEventListener('pointerup', this._onUp);
    zone.addEventListener('pointercancel', this._onUp);
    zone.addEventListener('contextmenu', e => e.preventDefault());
    this._onWheel = e => { e.preventDefault(); this.camDist = clamp(this.camDist * (e.deltaY > 0 ? 1.1 : 0.9), 4, 18); };
    zone.addEventListener('wheel', this._onWheel, { passive: false });

    this._onKey = e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (e.type === 'keydown') {
        if (k === 'escape') { this.cb.onExit?.(); return; }
        if (k === 'v' && !e.repeat) { this.toggleCamera(); return; }
        this.keys.add(k);
        if (k.startsWith('arrow') || k === ' ') e.preventDefault();
      } else this.keys.delete(k);
    };
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKey);
    this._onBlur = () => { this.keys.clear(); this._endJoy(); this.look.clear(); };
    window.addEventListener('blur', this._onBlur);

    ui.querySelector('#walk-cam').onclick = () => this.toggleCamera();
    ui.querySelector('#walk-shirt').onclick = () => {
      this.shirtIdx = (this.shirtIdx + 1) % SHIRT_COLORS.length;
      this.char.setShirt(SHIRT_COLORS[this.shirtIdx]); this._savePref(); this._syncUI();
    };
    ui.querySelector('#walk-exit').onclick = () => this.cb.onExit?.();
  }

  _startJoy(e) {
    const r = this.$zone.getBoundingClientRect();
    // the stick appears under your thumb (clamped so the ring stays on screen)
    const cx = clamp(e.clientX, r.left + 70, r.right - 70), cy = clamp(e.clientY, r.top + 70, r.bottom - 70);
    Object.assign(this.joy, { id: e.pointerId, cx, cy, x: 0, y: 0 });
    this.$base.classList.add('active');
    this.$base.style.left = `${cx - r.left}px`; this.$base.style.top = `${cy - r.top}px`;
    this.$base.style.bottom = 'auto';
    this.$knob.style.transform = 'translate(0px, 0px)';
  }

  _endJoy() {
    this.joy.id = null; this.joy.x = this.joy.y = 0;
    this.$base.classList.remove('active');
    this.$base.style.left = ''; this.$base.style.top = ''; this.$base.style.bottom = '';
    this.$knob.style.transform = 'translate(0px, 0px)';
  }

  toggleCamera() {
    this.thirdPerson = !this.thirdPerson;
    this.pitch = this.thirdPerson ? -0.3 : 0;
    this._savePref(); this._syncUI();
  }

  _savePref() { try { localStorage.setItem(PREF_KEY, JSON.stringify({ third: this.thirdPerson, shirt: this.shirtIdx })); } catch (_) {} }

  _syncUI() {
    const b = this.ui.querySelector('#walk-cam');
    b.textContent = this.thirdPerson ? '👁 First person' : '🧍 Third person';
    this.ui.querySelector('#walk-shirt').style.setProperty('--shirt', SHIRT_COLORS[this.shirtIdx]);
    this.char.group.visible = this.thirdPerson;
  }

  // ── Per-frame update ─────────────────────────────────────────────────────
  update(dt) {
    const k = this.keys;
    let mx = this.joy.x, my = -this.joy.y;            // joystick: up = forward
    const kf = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const ks = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
    const kt = (k.has('arrowleft') || k.has('q') ? 1 : 0) - (k.has('arrowright') || k.has('e') ? 1 : 0);
    if (kf || ks) { const l = Math.hypot(kf, ks); mx = ks / l; my = kf / l; }
    this.yaw += kt * dt * 2;
    let mag = Math.min(1, Math.hypot(mx, my));
    if (mag < 0.12) mag = 0;
    // analog: a gentle push strolls, most of the throw is a normal walk, the outer rim jogs
    const running = k.has('shift') || (this.joy.id !== null && mag > 0.96);
    const speed = mag ? (running ? JOG : WALK * clamp((mag - 0.12) / 0.7, 0.3, 1)) : 0;
    this._speedNow = speed;

    // camera-relative direction: forward = (sin yaw, cos yaw); right = (−cos yaw, sin yaw)
    let moved = 0;
    if (mag) {
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const rx = -fz, rz = fx;
      const n = Math.hypot(mx, my);
      const dx = (fx * my + rx * mx) / n, dz = (fz * my + rz * mx) / n;
      this.facing = lerpAngle(this.facing, Math.atan2(dx, dz), Math.min(1, dt * 12));
      moved = this._move(dx * speed * dt, dz * speed * dt);
    }
    // gravity / settle onto the floor
    const ground = this.surfaceAt(this.pos.x, this.pos.z, this.pos.y + STEP_UP);
    if (ground > -Infinity) {
      if (this.pos.y - ground < 1.3 && this.vy <= 0) { this.pos.y += (ground - this.pos.y) * Math.min(1, dt * 18); this.vy = 0; }
      else { this.vy -= 32 * dt; this.pos.y = Math.max(ground, this.pos.y + this.vy * dt); if (this.pos.y === ground) this.vy = 0; }
    }
    const air = this.vy < -1;

    // character
    const g = this.char.group;
    if (moved > 0.001 || Math.abs(g.rotation.y - this.facing) > 0.01) this.v.atmo.shadowDirty = this.thirdPerson || this.v.atmo.shadowDirty;
    g.position.copy(this.pos);
    g.rotation.y = this.facing;
    this.char.animate(dt, dt > 0 ? moved / dt : 0, air);

    this._updateVisibility();
    this._updateCamera(dt);
  }

  _move(dx, dz) {
    const total = Math.hypot(dx, dz), steps = Math.max(1, Math.ceil(total / 0.2));
    let moved = 0;
    for (let i = 0; i < steps; i++) {
      const p = { x: this.pos.x + dx / steps, z: this.pos.z + dz / steps };
      this._resolve(p, this.pos.y + 0.9, this.pos.y + BODY_H);
      const y = this.surfaceAt(p.x, p.z, this.pos.y + STEP_UP);
      if (y === -Infinity || this.pos.y - y > MAX_DROP) break;   // nothing to stand on / ledge
      moved += Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
      this.pos.x = p.x; this.pos.z = p.z;
      if (y > this.pos.y) this.pos.y = y;      // walk up steps & stairs immediately
    }
    return moved;
  }

  _updateVisibility(force = false) {
    const st = this.v.state;
    let fi = 0;
    st.floors.forEach((f, i) => { if (f.elev <= this.pos.y + 1.6) fi = i; });
    const room = roomAt(st.floors[fi], this.pos.x, this.pos.z);
    const outdoors = !room || room.outdoor;
    this.roomName = room ? room.name : 'Outside';
    if (force || fi !== this.floorIdx || outdoors !== this.outdoors) {
      this.floorIdx = fi; this.outdoors = outdoors;
      this.v.walkLevel = outdoors ? 'all' : fi;
      this.v.walkOutdoors = outdoors;
      this.v.atmo?.setIndoor(!outdoors);
      if (force) this.v.buildScene();
      this.occluders = this.v._pickables.filter(o => ['wall', 'roof', 'room'].includes(o.userData.pick?.kind) && o.isMesh);
    }
    const label = `📍 ${st.floors[fi]?.name ?? ''} · ${this.roomName}`;
    if (label !== this._label) { this._label = label; this.ui.querySelector('#walk-where').textContent = label; }
  }

  _updateCamera(dt) {
    const cam = this.v.camera;
    const cp = Math.cos(this.pitch), dir = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    if (!this.thirdPerson) {
      // subtle head bob synced to the stride (≈1" at a walk)
      const sp = this._speedNow || 0;
      if (sp > 0.2) this._bob = (this._bob || 0) + dt * (5.2 + sp * 0.55); else this._bob = 0;
      const bob = Math.sin(this._bob * 2) * 0.03 * Math.min(1, sp / WALK);
      cam.position.set(this.pos.x, this.pos.y + EYE + bob, this.pos.z);
      cam.lookAt(cam.position.clone().add(dir));
      return;
    }
    const target = new THREE.Vector3(this.pos.x, this.pos.y + PERSON_H - 0.9, this.pos.z);
    let dist = this.camDist;
    // keep a wall or ceiling from getting between the camera and the character
    this._ray.set(target, dir.clone().negate());
    this._ray.far = dist + 0.6;
    const hit = this._ray.intersectObjects(this.occluders, false)[0];
    if (hit) dist = Math.max(1.2, hit.distance - 0.6);
    this._camDistNow = this._camDistNow == null ? dist : (dist < this._camDistNow ? dist : this._camDistNow + (dist - this._camDistNow) * Math.min(1, dt * 4));
    const pos = target.clone().addScaledVector(dir, -this._camDistNow);
    // stay under the ceiling when indoors
    if (!this.outdoors) {
      const f = this.v.state.floors[this.floorIdx], r = roomAt(f, this.pos.x, this.pos.z);
      if (r && r.ceiling !== false) pos.y = Math.min(pos.y, f.elev + (r.offset || 0) + f.height - 0.35);
    }
    cam.position.copy(pos);
    cam.lookAt(target);
  }

  dispose() {
    this.v.scene.remove(this.char.group);
    const z = this.$zone;
    z.removeEventListener('pointerdown', this._onDown); z.removeEventListener('pointermove', this._onMove);
    z.removeEventListener('pointerup', this._onUp); z.removeEventListener('pointercancel', this._onUp);
    z.removeEventListener('wheel', this._onWheel);
    this._endJoy();
    window.removeEventListener('keydown', this._onKey); window.removeEventListener('keyup', this._onKey);
    window.removeEventListener('blur', this._onBlur);
    this.v.walkLevel = null; this.v.walkOutdoors = null;
    this.v.atmo?.setIndoor(false);
  }
}
