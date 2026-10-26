import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CATALOG_BY_TYPE } from './furniture.js';
import { buildModel } from './models3d.js';
import './models_kl.js';           // registers the kitchen & living room set
import { WALL_FINISHES, FLOOR_FINISHES, ROOF_FINISHES, finishMaterial, mat } from './textures.js';
import { Walker } from './walker.js';
import { Atmosphere, Pipeline, defaultQuality, isFixture } from './lighting.js';

const DEFAULT_WALL_H = 8;
const DEFAULT_WALL_T = 0.4;
const SNAP = 0.25;

// ── Geometry helpers ─────────────────────────────────────────────────────────
/** BoxGeometry with UVs in feet so tiled textures keep real-world scale.
 *  u0/v0 offset the long faces so siding courses line up across wall pieces. */
function uvBox(w, h, d, u0 = 0, v0 = 0, L = w) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [du, dv] = dims[f];
    for (let i = f * 4; i < f * 4 + 4; i++) {
      let u = uv.getX(i) * du, v = uv.getY(i) * dv;
      if (f === 4) { u += u0; v += v0; }
      if (f === 5) { u += L - u0 - w; v += v0; }
      if (f < 2) v += v0;
      uv.setXY(i, u, v);
    }
  }
  return g;
}

/** Flat polygon in a vertical plane. pts: [[u, v], …] in feet; holes: [[[u,v]…]…] */
function polyGeo(pts, holes = []) {
  const s = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v))));
  return new THREE.ShapeGeometry(s);
}

/** Merge a model group into one mesh per material (big draw-call savings). */
function compact(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  const put = (m, g) => { if (!buckets.has(m)) buckets.set(m, []); buckets.get(m).push(g); };
  group.traverse(o => {
    if (!o.isMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(o.matrixWorld);
    if (Array.isArray(o.material)) {
      // multi-material mesh: split by group so each part joins its material's bucket
      const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
      for (const gr of groups) {
        const part = new THREE.BufferGeometry();
        for (const k of ['position', 'normal', 'uv']) {
          const a = g.attributes[k];
          part.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
        }
        put(o.material[gr.materialIndex], part);
      }
      g.dispose();
      return;
    }
    g.clearGroups();
    put(o.material, g);
  });
  const out = new THREE.Group();
  for (const [m, list] of buckets) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (list.length > 1) list.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = !m.transparent; mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}

function inRoom(r, x, y) { return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height; }

/** Smallest room containing the point (so nested rooms like a walk inside a lawn win). */
export function roomAt(floor, x, y, skipOutdoor = false) {
  let best = null, ba = Infinity;
  for (const r of floor.rooms) {
    if (skipOutdoor && r.outdoor) continue;
    if (inRoom(r, x, y) && r.width * r.height < ba) { best = r; ba = r.width * r.height; }
  }
  return best;
}

/** Walls a room generates for itself when autoWalls is on (classic apartment mode). */
export function roomWalls(room) {
  const { x, y, width: w, height: h } = room;
  return [[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]]
    .map(([x1, y1, x2, y2], i) => ({ id: `${room.id}:${i}`, roomId: room.id, x1, y1, x2, y2, thick: DEFAULT_WALL_T }));
}

/** Opening items (doors/windows) that sit on this wall → [{t0, t1, bottom, top, item}] in wall coords. */
export function wallOpenings(wall, items) {
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1, len = Math.hypot(dx, dy);
  if (len < 0.01) return [];
  const ux = dx / len, uy = dy / len, t = wall.thick ?? DEFAULT_WALL_T;
  const res = [];
  for (const it of items) {
    const cat = CATALOG_BY_TYPE[it.type];
    if (!cat?.opening) continue;
    const px = it.x - wall.x1, py = it.y - wall.y1;
    const along = px * ux + py * uy, off = Math.abs(-px * uy + py * ux);
    const align = Math.abs(Math.cos(it.rotation) * ux + Math.sin(it.rotation) * uy);
    if (off > t / 2 + 0.35 || align < 0.92 || along < -0.1 || along > len + 0.1) continue;
    const lift = it.lift ?? cat.lift ?? 0, h = it.height ?? cat.height3d;
    res.push({ t0: Math.max(0, along - it.width / 2), t1: Math.min(len, along + it.width / 2), bottom: lift, top: lift + h, item: it });
  }
  return res.sort((a, b) => a.t0 - b.t0);
}

// ── Viewer ──────────────────────────────────────────────────────────────────
export class Viewer3D {
  constructor(container, state, cb = {}) {
    this.container = container;
    this.state = state;
    this.cb = cb;
    this._modelCache = new Map();
    this._pickables = [];
    this._itemNodes = new Map();

    this.scene = new THREE.Scene();

    const w = container.clientWidth || 300, h = container.clientHeight || 200;
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.2, 1500);
    this.camera.position.set(-40, 70, 110);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;           // lighting.js flags redraws
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 450;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.target.set(30, 0, 5);

    // Physical sky + sun + sky-lit reflections, fixture lights, and the post-processing chain
    this.atmo = new Atmosphere(this.scene, this.renderer);
    this.sun = this.atmo.sun;
    this.pipeline = new Pipeline(this.renderer, this.scene, this.camera);
    this.view.time ??= 'day';
    this.view.quality ??= defaultQuality();
    this.atmo.setTime(this.view.time);
    this.pipeline.setQuality(this.view.quality, this.atmo);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this._selBox = new THREE.Box3Helper(new THREE.Box3(), 0xffd400);
    this._selBox.visible = false;
    this.scene.add(this._selBox);

    this.walk = { on: false };
    this.walker = null;
    this.walkLevel = null; this.walkOutdoors = null;
    this._clock = new THREE.Clock();
    this._bindPointer();

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(container);
    this.buildScene();
    this._animate();
  }

  get view() { return this.state.view3d; }

  // ── Scene build ───────────────────────────────────────────────────────────
  refresh() { this.buildScene(); }

  _visibleFloors() {
    const floors = this.state.floors;
    // walking: keep the whole house so floors and roof block light like the real thing
    const lvl = this.walk.on ? 'all' : this.view.level;
    return floors.map((f, i) => ({ f, i })).filter(({ i }) => lvl === 'all' || i <= lvl);
  }

  _topVisible() {
    const v = this._visibleFloors();
    return v.length ? v[v.length - 1].i : -1;
  }

  buildScene() {
    for (const c of [...this.root.children]) {
      this.root.remove(c);
      c.traverse(o => { if (o.isMesh && o.userData.own) o.geometry.dispose(); });
    }
    this._pickables = [];
    this._itemNodes = new Map();
    this._fixtures = [];
    const used = new Set();
    const site = this.state.site || {};
    const top = this._topVisible();
    const showRoof = this.walk.on ? true : this.view.roof && this.view.level === 'all' && !this.view.cutaway;

    for (const { f, i } of this._visibleFloors()) {
      const g = new THREE.Group();
      g.userData.floor = i;
      this.root.add(g);
      // cut: dollhouse walls · peel: looking down into a single level (no ceiling clutter, walls to ceiling height)
      const cut = this.view.cutaway && i === top;
      const peel = !cut && this.view.level !== 'all' && i === top && !this.walk.on;
      this._buildRooms(g, f, i);
      this._buildWalls(g, f, i, cut, peel);
      this._buildItems(g, f, i, used, cut, peel);
    }
    const groundFloorVisible = this.view.level === 'all' || this.view.level >= (site.groundFloor ?? 0);
    if (groundFloorVisible) this._buildGround();
    if (showRoof) this._buildRoofs();
    else if (top >= 0) {
      // Roof hidden: still draw gable-end walls (they are the upstairs side walls), clipped to the view
      const tf = this.state.floors[top];
      const clip = tf.elev + (this.view.cutaway ? 3.5 : tf.height);
      for (const rf of this.state.site?.roofs || []) if (clip > rf.eave + 0.1) {
        const g = this._roofGroup(rf, { gablesOnly: true, clip });
        g.traverse(o => { if (o.isMesh) { o.userData.pick = { kind: 'roof', id: rf.id, floor: -1 }; this._pickables.push(o); } });
        this.root.add(g);
      }
    }

    for (const k of this._modelCache.keys()) if (!used.has(k)) this._modelCache.delete(k);
    this.root.updateMatrixWorld(true);
    this.atmo.setFixtures(this._fixtures);
    this.atmo.applyEnv();
    this.atmo.shadowDirty = true;
    if (this.walker) this.walker.occluders = this._pickables.filter(o => ['wall', 'roof', 'room'].includes(o.userData.pick?.kind) && o.isMesh);
    if (!this.walk.on) this._updateSelection();
  }

  _ownMesh(geo, material) { const m = new THREE.Mesh(geo, material); m.userData.own = true; m.castShadow = true; m.receiveShadow = true; return m; }

  _groundY() { return this.state.site?.ground ?? 0; }

  _buildGround() {
    const site = this.state.site;
    const lot = site?.lot ?? { x: -100, y: -100, w: 200, h: 200 };
    const gy = this._groundY();
    // hole over the basement footprint so the basement can be seen from inside
    const shape = new THREE.Shape([[lot.x, -lot.y], [lot.x + lot.w, -lot.y], [lot.x + lot.w, -(lot.y + lot.h)], [lot.x, -(lot.y + lot.h)]].map(([a, b]) => new THREE.Vector2(a, b)));
    const bs = this.state.floors.filter(f => f.elev < gy);
    let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
    for (const f of bs) for (const r of f.rooms) { mnX = Math.min(mnX, r.x); mxX = Math.max(mxX, r.x + r.width); mnY = Math.min(mnY, r.y); mxY = Math.max(mxY, r.y + r.height); }
    if (isFinite(mnX) && mnX > lot.x && mxX < lot.x + lot.w && mnY > lot.y && mxY < lot.y + lot.h)
      shape.holes.push(new THREE.Path([[mnX, -mnY], [mnX, -mxY], [mxX, -mxY], [mxX, -mnY]].map(([a, b]) => new THREE.Vector2(a, b))));
    const geo = new THREE.ShapeGeometry(shape);
    const fin = FLOOR_FINISHES.grass;
    const m = this._ownMesh(geo, finishMaterial({ ...fin, tile: 10 }, fin.color));
    m.rotation.x = -Math.PI / 2; m.position.y = gy; m.castShadow = false;
    this.root.add(m);
    // wide surround so the horizon isn't an edge
    const far = this._ownMesh(new THREE.RingGeometry(Math.min(lot.w, lot.h) * 0.42, 1400, 64, 1), mat('plain', '#6f8f4e', { roughness: 1 }));
    far.rotation.x = -Math.PI / 2; far.position.set(lot.x + lot.w / 2, gy - 0.05, lot.y + lot.h / 2); far.castShadow = false;
    this.root.add(far);
  }

  _buildRooms(g, floor, fi) {
    const gy = this._groundY();
    const holes = floor.furniture.filter(it => CATALOG_BY_TYPE[it.type]?.floorHole);
    for (const r of floor.rooms) {
      const fin = FLOOR_FINISHES[r.floorMat] || FLOOR_FINISHES.oak;
      const color = r.floorColor || fin.color;
      const shape = new THREE.Shape([[r.x, -r.y], [r.x + r.width, -r.y], [r.x + r.width, -(r.y + r.height)], [r.x, -(r.y + r.height)]].map(([a, b]) => new THREE.Vector2(a, b)));
      for (const h of holes) {
        const c = Math.abs(Math.cos(h.rotation)), s = Math.abs(Math.sin(h.rotation));
        const hw = (h.width * c + h.depth * s) / 2, hd = (h.width * s + h.depth * c) / 2;
        const x0 = Math.max(r.x + 0.05, h.x - hw), x1 = Math.min(r.x + r.width - 0.05, h.x + hw);
        const y0 = Math.max(r.y + 0.05, h.y - hd), y1 = Math.min(r.y + r.height - 0.05, h.y + hd);
        if (x1 - x0 > 0.2 && y1 - y0 > 0.2) shape.holes.push(new THREE.Path([[x0, -y0], [x0, -y1], [x1, -y1], [x1, -y0]].map(([a, b]) => new THREE.Vector2(a, b))));
      }
      const top = floor.elev + (r.offset || 0);
      const isGround = fi === (this.state.site?.groundFloor ?? -1);
      const thick = r.outdoor && isGround ? Math.max(0.15, top - gy + 0.05) : 0.3;
      const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
      const mesh = this._ownMesh(geo, [finishMaterial(fin, color), mat('plain', r.outdoor ? '#7b6f60' : '#d8d4cc', { roughness: 0.9 })]);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = top - thick;
      mesh.userData.pick = { kind: 'room', id: r.id, floor: fi };
      g.add(mesh); this._pickables.push(mesh);

      if ((this.view.ceilings || this.walk.on) && r.ceiling !== false && !r.outdoor) {
        const cg = new THREE.ShapeGeometry(new THREE.Shape([[r.x, r.y], [r.x + r.width, r.y], [r.x + r.width, r.y + r.height], [r.x, r.y + r.height]].map(([a, b]) => new THREE.Vector2(a, b))));
        const cm = this._ownMesh(cg, mat('plain', '#f6f5f1', { roughness: 0.95, emissive: '#e9e4da', emissiveIntensity: 0.45 }));   // fake bounce light off a white ceiling
        cm.rotation.x = Math.PI / 2; cm.position.y = floor.elev + (r.offset || 0) + floor.height - 0.01;
        g.add(cm);
      }
    }
  }

  /** Material for one face of a wall, auto-picked from the room on that side unless overridden. */
  _sideMat(floor, wall, side) {
    const { key, color } = this._sideFinish(floor, wall, side);
    return finishMaterial(WALL_FINISHES[key] || WALL_FINISHES.paint, color);
  }

  /** Which finish a wall face gets: explicit override, else the room on that side, else siding/paint. */
  _sideFinish(floor, wall, side) {
    const fk = side === 'A' ? wall.finishA : wall.finishB;
    const ck = side === 'A' ? wall.colorA : wall.colorB;
    if (fk) return { key: fk, color: ck || '#ecebe6' };
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, sgn = side === 'A' ? 1 : -1, off = (wall.thick ?? DEFAULT_WALL_T) / 2 + 0.4;
    const mx = (wall.x1 + wall.x2) / 2 + nx * off * sgn, my = (wall.y1 + wall.y2) / 2 + ny * off * sgn;
    // auto walls of a room: side A faces into that room, side B faces the neighbour
    const r = wall.roomId && side === 'A' ? floor.rooms.find(q => q.id === wall.roomId) : roomAt(floor, mx, my, true);
    if (r && r.id !== (side === 'B' ? wall.roomId : null)) return { key: r.wallFinish || 'paint', color: r.wallColor || '#ecebe6', room: r };
    if (wall.ext || wall.roomId) {
      const k = floor.extFinish || 'siding';
      return { key: k, color: k === 'concrete' ? '#b3afa7' : (this.state.site?.sidingColor || '#5f7180') };
    }
    return { key: 'paint', color: '#ecebe6' };
  }

  _allWalls(floor) {
    const out = [...floor.walls];
    for (const r of floor.rooms) if (r.autoWalls !== false && !r.outdoor) out.push(...roomWalls(r));
    return out;
  }

  _buildWalls(g, floor, fi, cut, peel) {
    const trim = mat('plain', this.state.site?.trimColor || '#f7f6f2', { roughness: 0.5 });
    const walls = this._allWalls(floor);
    const trimAll = new THREE.Group();   // baseboards & crown for the whole floor, merged into one mesh below
    const joinExt = (w, i, end) => {   // extend into a corner shared with a later, non-parallel wall
      const px = end ? w.x2 : w.x1, py = end ? w.y2 : w.y1, ax = w.x2 - w.x1, ay = w.y2 - w.y1, al = Math.hypot(ax, ay) || 1;
      for (let j = i + 1; j < walls.length; j++) {
        const q = walls[j];
        for (const [qx, qy] of [[q.x1, q.y1], [q.x2, q.y2]]) {
          if (Math.hypot(qx - px, qy - py) > 0.05) continue;
          const bx = q.x2 - q.x1, by = q.y2 - q.y1, bl = Math.hypot(bx, by) || 1;
          if (Math.abs((ax * by - ay * bx) / (al * bl)) > 0.5) return (q.thick ?? DEFAULT_WALL_T) / 2 - 0.004;
        }
      }
      return 0;
    };
    walls.forEach((w, wi) => { w._e0 = joinExt(w, wi, false); w._e1 = joinExt(w, wi, true); });
    for (const w of walls) {
      const e0 = w._e0 || 0, e1 = w._e1 || 0; delete w._e0; delete w._e1;   // scratch values, never saved
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L = Math.hypot(dx, dy);
      if (L < 0.1) continue;
      const t = w.thick ?? DEFAULT_WALL_T;
      let H = w.height ?? floor.height;
      if (cut) H = Math.min(H, 3.5);
      if (peel) H = Math.min(H, floor.height - (w.base || 0));
      const base = floor.elev + (w.base || 0);
      const mA = this._sideMat(floor, w, 'A'), mB = this._sideMat(floor, w, 'B');
      // 4" painted baseboard on interior painted faces
      const finA = this._sideFinish(floor, w, 'A'), finB = this._sideFinish(floor, w, 'B');
      const baseA = ['paint', 'beadboard'].includes(finA.key), baseB = ['paint', 'beadboard'].includes(finB.key);
      // crown molding where a painted face meets a flat ceiling (height relative to this wall's base)
      const crownAt = f => (f.room && f.room.ceiling !== false && !f.room.outdoor && ['paint', 'beadboard'].includes(f.key) && !cut && !peel)
        ? floor.height + (f.room.offset || 0) - (w.base || 0) : null;
      const crownA = crownAt(finA), crownB = crownAt(finB);
      const mats = [trim, trim, trim, trim, mA, mB];
      const wg = new THREE.Group();
      wg.position.set(w.x1, base, w.y1);
      const tg = new THREE.Group();
      wg.rotation.y = -Math.atan2(dy, dx);
      const roofTop = u => this._roofAt(w.x1 + dx * u / L, w.y1 + dy * u / L) - base - 0.05;
      const piece = (u0, u1, v0, v1) => {
        if (u1 - u0 < 0.02 || v1 - v0 < 0.02) return;
        // Clip under sloped roofs (upstairs walls in a Cape): sample the roof along the piece
        const N = Math.max(2, Math.ceil((u1 - u0) / 0.5));
        const tops = []; let clipped = false;
        for (let i = 0; i <= N; i++) { const u = u0 + (u1 - u0) * i / N, tp = Math.min(v1, roofTop(u)); tops.push([u, tp]); if (tp < v1 - 0.01) clipped = true; }
        let m;
        if (clipped) {
          if (tops.every(([, tp]) => tp <= v0 + 0.02)) return;
          const pts = [[u0, v0], [u1, v0], ...tops.reverse().map(([u, tp]) => [u, Math.max(v0 + 0.01, tp)])];
          const shape = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b + (w.base || 0))));
          const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
          geo.translate(0, -(w.base || 0), -t / 2);
          m = this._ownMesh(geo, [mA, trim]);
          const back = this._ownMesh(new THREE.ShapeGeometry(shape), mB);
          back.geometry.translate(0, -(w.base || 0), 0);
          back.rotation.y = Math.PI; back.scale.x = -1; back.position.z = -t / 2 - 0.004;
          back.userData.pick = w.roomId ? { kind: 'room', id: w.roomId, floor: fi } : { kind: 'wall', id: w.id, floor: fi };
          this._pickables.push(back); wg.add(back);
        } else {
          m = this._ownMesh(uvBox(u1 - u0, v1 - v0, t, u0, v0 + (w.base || 0), L), mats);
          m.position.set((u0 + u1) / 2, (v0 + v1) / 2, 0);
        }
        for (const [ch, sg] of [[crownA, 1], [crownB, -1]]) {
          if (ch == null || clipped || v0 > ch - 0.35 || v1 < ch - 0.01) continue;
          for (const [hh, dd, off] of [[0.3, 0.05, 0.3], [0.1, 0.11, 0.1], [0.07, 0.17, 0.07]]) {
            const cm = this._ownMesh(new THREE.BoxGeometry(u1 - u0, hh, dd), trim);
            cm.position.set((u0 + u1) / 2, ch - off + hh / 2 - 0.005, sg * (t / 2 + dd / 2)); cm.castShadow = false;
            tg.add(cm);
          }
        }
        if (v0 < 0.01 && v1 > 0.5) for (const [on, sg] of [[baseA, 1], [baseB, -1]]) {
          if (!on) continue;
          const bb = this._ownMesh(new THREE.BoxGeometry(u1 - u0, 0.34, 0.045), trim);
          bb.position.set((u0 + u1) / 2, 0.17, sg * (t / 2 + 0.022)); bb.castShadow = false;
          tg.add(bb);
          const cap = this._ownMesh(new THREE.BoxGeometry(u1 - u0, 0.04, 0.06), trim);
          cap.position.set((u0 + u1) / 2, 0.355, sg * (t / 2 + 0.028)); cap.castShadow = false;
          tg.add(cap);
        }
        m.userData.pick = w.roomId ? { kind: 'room', id: w.roomId, floor: fi } : { kind: 'wall', id: w.id, floor: fi };
        this._pickables.push(m);
        wg.add(m);
      };
      // Merge overlapping openings, then cut
      const ops = wallOpenings(w, floor.furniture).map(o => ({ ...o, bottom: o.bottom - (w.base || 0), top: o.top - (w.base || 0) }));
      let cursor = -e0;
      for (const o of ops) {
        if (o.t0 > cursor) piece(cursor, o.t0, 0, H);
        const s = Math.max(cursor, o.t0);
        if (o.t1 > s) {
          piece(s, o.t1, 0, Math.min(H, Math.max(0, o.bottom)));
          piece(s, o.t1, Math.max(0, o.top), H);
        }
        cursor = Math.max(cursor, o.t1);
      }
      piece(cursor, L + e1, 0, H);
      const pick = w.roomId ? { kind: 'room', id: w.roomId, floor: fi } : { kind: 'wall', id: w.id, floor: fi };
      if (wg.children.length) {
        const cw = compact(wg);
        cw.traverse(o => { if (o.isMesh) { o.userData.own = true; o.userData.pick = pick; this._pickables.push(o); } });
        for (const c of wg.children) { const i = this._pickables.indexOf(c); if (i >= 0) this._pickables.splice(i, 1); c.geometry.dispose(); }
        g.add(cw);
      }
      tg.position.copy(wg.position); tg.rotation.copy(wg.rotation);
      trimAll.add(tg);
    }
    const merged = compact(trimAll);
    merged.traverse(o => { if (o.isMesh) { o.castShadow = false; o.userData.own = true; } });
    g.add(merged);
    trimAll.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  }

  /** Height of the lowest roof underside above plan point (x, y), or +∞. */
  _roofAt(x, y) {
    if (!(this.state.site?.roofs?.length)) return Infinity;
    let best = Infinity;
    for (const rf of this.state.site.roofs) {
      const o = rf.overhang ?? 0.75;
      if (x < rf.x - o || x > rf.x + rf.w + o || y < rf.y - o || y > rf.y + rf.d + o) continue;
      const alongX = rf.axis !== 'y';
      const s = (alongX ? rf.d : rf.w) / 2, k = (rf.ridge - rf.eave) / (s + o);
      const z = alongX ? y - (rf.y + rf.d / 2) : x - (rf.x + rf.w / 2);
      let h = rf.eave + (s + o - Math.abs(z)) * k;
      const dm = rf.dormer;
      if (dm && alongX && z < 0 && x >= dm.x0 && x <= dm.x1) {
        const dz = s - (dm.wallY - rf.y);
        if (-z <= dz + 0.01) h = Math.max(h, dm.top + (dz + z) * (rf.ridge - dm.top) / dz);
      }
      best = Math.min(best, h);
    }
    return best;
  }

  _surface(floor, fi, x, y) {
    const r = roomAt(floor, x, y);
    if (r) return r.offset || 0;
    return fi === (this.state.site?.groundFloor ?? -1) ? this._groundY() - floor.elev : 0;
  }

  _itemY(floor, fi, it, cat) {
    const h = it.height ?? cat?.height3d ?? 2.5;
    if (cat?.opening) return floor.elev + (it.lift ?? cat.lift ?? 0);
    const s = this._surface(floor, fi, it.x, it.y);
    if (cat?.mount === 'ceiling') return floor.elev + s + floor.height - h;
    if (it.lift !== undefined && it.lift <= this._groundY() + 0.01 && it.lift < 0) return floor.elev + it.lift;   // explicit grade-level items
    return floor.elev + s + (it.lift ?? cat?.lift ?? 0);
  }

  _modelFor(it, cat, ctx) {
    const { x, y, rotation, label, ...rest } = it;
    const key = JSON.stringify(rest) + JSON.stringify(ctx);
    let proto = this._modelCache.get(key);
    if (!proto) { proto = compact(buildModel(it, cat, ctx)); this._modelCache.set(key, proto); }
    return { key, node: proto.clone() };
  }

  _buildItems(g, floor, fi, used, cut, peel) {
    const allWalls = this._allWalls(floor);
    for (const it of floor.furniture) {
      const cat = CATALOG_BY_TYPE[it.type];
      if ((cut || peel) && (cat?.mount === 'ceiling' || cat?.model === 'chimney')) continue;
      const ctx = { ceil: it.ceil ?? floor.height };
      if (cat?.opening) {
        const w = allWalls.find(wl => wallOpenings(wl, [it]).length);
        ctx.wallT = w ? (w.thick ?? DEFAULT_WALL_T) : 0.45;
        ctx.ceil = cat.model === 'garageDoor' ? floor.height : undefined;
        if (cut && (it.lift ?? cat.lift ?? 0) + (it.height ?? cat.height3d) > 3.6) continue;
      }
      const { key, node } = this._modelFor(it, cat, ctx);
      used.add(key);
      node.position.set(it.x, this._itemY(floor, fi, it, cat), it.y);
      node.rotation.y = -it.rotation;
      node.userData.pick = { kind: 'item', id: it.id, floor: fi };
      // small decor and ceiling fixtures don't need to cast sun shadows (halves their cost)
      const noShadow = cat?.layer === 2 || cat?.mount === 'ceiling' || it.width * it.depth < 1.2;
      node.traverse(o => { if (o.isMesh) { o.userData.pick = node.userData.pick; if (noShadow) o.castShadow = false; } });
      g.add(node);
      this._pickables.push(node);
      this._itemNodes.set(it.id, node);
      if (isFixture(cat?.model)) this._fixtures.push({ node, model: cat.model, h: it.height ?? cat.height3d });
    }
  }

  // ── Roofs ────────────────────────────────────────────────────────────────
  _gableHoles(planeAxis, planeVal, uAxisSign) {
    // Openings (windows) that sit in a gable plane → holes [[u,v]…] in the gable's 2D frame.
    const holes = [];
    for (const f of this.state.floors) for (const it of f.furniture) {
      const cat = CATALOG_BY_TYPE[it.type];
      if (!cat?.opening) continue;
      const c = Math.abs(Math.cos(it.rotation)), onX = planeAxis === 'x';
      if (onX ? c > 0.2 : c < 0.8) continue;
      const pos = onX ? it.x : it.y;
      if (Math.abs(pos - planeVal) > 0.8) continue;
      const along = onX ? it.y : it.x;
      const lift = it.lift ?? cat.lift ?? 0, h = it.height ?? cat.height3d;
      const v0 = f.elev + lift, v1 = v0 + h, u0 = (along - it.width / 2) * uAxisSign, u1 = (along + it.width / 2) * uAxisSign;
      holes.push({ u0: Math.min(u0, u1), u1: Math.max(u0, u1), v0, v1 });
    }
    return holes;
  }

  _buildRoofs() {
    for (const rf of this.state.site?.roofs || []) {
      const g = this._roofGroup(rf);
      g.traverse(o => { if (o.isMesh) { o.userData.pick = { kind: 'roof', id: rf.id, floor: -1 }; this._pickables.push(o); } });
      this.root.add(g);
    }
  }

  _roofGroup(rf, opt = {}) {
    const clipV = opt.clip ?? Infinity;
    const clipPoly = pts => {   // keep the part of a (u,v) polygon with v ≤ clipV
      if (!isFinite(clipV)) return pts;
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], ia = a[1] <= clipV, ib = b[1] <= clipV;
        if (ia) out.push(a);
        if (ia !== ib) { const t = (clipV - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, clipV]); }
      }
      return out.length >= 3 ? out : null;
    };
    const fin = ROOF_FINISHES[rf.finish] || ROOF_FINISHES.shingle;
    const shingle = finishMaterial(fin, rf.color || '#4d4b4a');
    const under = mat('plain', '#f3f2ee', { roughness: 0.95, emissive: '#e9e4da', emissiveIntensity: 0.4 });   // painted ceiling side
    const trim = mat('plain', this.state.site?.trimColor || '#f7f6f2', { roughness: 0.5 });
    const sidingF = WALL_FINISHES.siding, sidingC = this.state.site?.sidingColor || '#5f7180';
    const siding = finishMaterial(sidingF, sidingC);
    const paint = finishMaterial(WALL_FINISHES.paint, '#ecebe6');
    const slabMats = [trim, trim, shingle, under, trim, trim];
    const o = rf.overhang ?? 0.75, T = 0.45;
    const alongX = rf.axis !== 'y';
    // Local frame: ridge along local X (length Lr), span along local Z (2·s). Origin at footprint centre, y = 0.
    const Lr = alongX ? rf.w : rf.d, s = (alongX ? rf.d : rf.w) / 2;
    const E = rf.eave, R = rf.ridge, k = (R - E) / (s + o);
    const cx = rf.x + rf.w / 2, cz = rf.y + rf.d / 2;
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    if (!alongX) g.rotation.y = Math.PI / 2;     // local X → world −Z (plan −y), local Z → world +X

    const slopeLen = Math.hypot(s + o, R - E), ang = Math.atan(k);
    const slab = (x0, x1, zFrom, zTo, sideSign) => {
      // slope strip between |z| = zFrom (low) … zTo (high, toward ridge) on side sideSign (±1 = ±Z)
      const len = x1 - x0, run = zFrom - zTo, sl = run / Math.cos(ang);
      if (len < 0.05 || sl < 0.05) return;
      const m = this._ownMesh(uvBox(len, T, sl), slabMats);
      const zMid = (zFrom + zTo) / 2, yMid = E + (s + o - zMid) * k;
      m.position.set((x0 + x1) / 2, yMid + T / 2 / Math.cos(ang), sideSign * zMid);
      m.rotation.x = sideSign * ang;
      g.add(m);
    };
    const xs0 = -Lr / 2 - o, xs1 = Lr / 2 + o;
    // which local side is the dormer on? (plan −y = rear)
    const dm = rf.dormer && alongX ? rf.dormer : null;
    const only = !!opt.gablesOnly;
    if (!only) slab(xs0, xs1, s + o, 0, 1);
    if (dm) {
      const dz = -(dm.wallY - rf.y - s);                // local |z| of the dormer face on the −Z side (positive)
      const dx0 = dm.x0 - cx, dx1 = dm.x1 - cx;
      if (!only) {
      slab(xs0, dx0, s + o, 0, -1);
      slab(dx1, xs1, s + o, 0, -1);
      slab(dx0, dx1, s + o, dz, -1);
      // dormer roof: from the face (y = top) up to the ridge
      const dk = (R - dm.top) / dz, dang = Math.atan(dk), dOver = 0.6;
      const dLen = Math.hypot(dz + dOver, (dz + dOver) * dk);
      const dmM = this._ownMesh(uvBox(dx1 - dx0 + 0.6, T, dLen), slabMats);
      const zMid = -(dz + dOver) / 2, yMid = dm.top - dOver * dk + (dz + dOver) / 2 * dk;
      dmM.position.set((dx0 + dx1) / 2, yMid + T / 2, zMid); dmM.rotation.x = -dang;
      g.add(dmM);
      }
      // cheek walls
      const yAtWall = E + (s + o - dz) * k;
      for (const [x, sign] of [[dx0, -1], [dx1, 1]]) {
        const pts = clipPoly([[-dz, yAtWall], [-dz, dm.top], [0, R]]);
        if (pts) this._vpoly(g, pts, x, sign, siding, paint, []);
      }
      if (rf.ceilingAt && !only) {   // flat ceiling between dormer face and where the front slope drops below it
        const zF = s + o - (rf.ceilingAt - E) / k;
        const cm = this._ownMesh(new THREE.PlaneGeometry(Lr - 0.1, zF + dz), mat('plain', '#f6f5f1', { roughness: 0.95 }));
        cm.rotation.x = Math.PI / 2; cm.position.set(0, rf.ceilingAt, (zF - dz) / 2);
        g.add(cm);
      }
    } else if (!only) slab(xs0, xs1, s + o, 0, -1);
    // ridge cap + fascia
    if (!only) {
    const cap = this._ownMesh(new THREE.BoxGeometry(Lr + 2 * o, 0.25, 0.7), shingle);
    cap.position.set(0, R + T + 0.05, 0); g.add(cap);
    for (const sg of [1, -1]) {
      const f = this._ownMesh(new THREE.BoxGeometry(Lr + 2 * o, 0.5, 0.12), trim);
      f.position.set(0, E + 0.05, sg * (s + o)); g.add(f);
    }
    }
    // gable ends
    const yWall = E + o * k;
    const gable = [[-s, E], [s, E], [s, yWall], [0, R], [-s, yWall]];
    const ends = alongX ? [['w', -Lr / 2, -1], ['e', Lr / 2, 1]] : [['s', -Lr / 2, -1], ['n', Lr / 2, 1]];
    for (const [name, x, sign] of ends) {
      if ((rf.noGable || []).includes(name)) continue;
      // holes: map world coords onto this gable's (z, y) frame
      let holes;
      if (alongX) holes = this._gableHoles('x', cx + x, 1).map(hh => ({ ...hh, u0: hh.u0 - cz, u1: hh.u1 - cz }));
      else holes = this._gableHoles('y', cz - x, 1).map(hh => ({ ...hh, u0: hh.u0 - cx, u1: hh.u1 - cx }));
      const inside = holes.filter(hh => hh.v0 > E + 0.1 && hh.u0 > -s + 0.2 && hh.u1 < s - 0.2 && hh.v1 < clipV - 0.05 &&
        hh.v1 < Math.min(yWall + (s - Math.abs(hh.u0)) * k, yWall + (s - Math.abs(hh.u1)) * k) - 0.1);
      const gp = clipPoly(gable);
      if (gp) this._vpoly(g, gp, x, sign, siding, paint, inside.map(hh => [[hh.u0, hh.v0], [hh.u1, hh.v0], [hh.u1, hh.v1], [hh.u0, hh.v1]]));
      // rake trim
      if (!only) for (const sg of [1, -1]) {
        const rake = this._ownMesh(new THREE.BoxGeometry(0.15, 0.45, slopeLen), trim);
        rake.position.set(x + sign * 0.06, (E + R) / 2 + 0.1, sg * (s + o) / 2);
        rake.rotation.x = sg * ang; g.add(rake);
      }
    }
    return g;
  }

  /** Vertical polygon in the local (z,y) plane at local x; outer face toward ±X (sign) gets `outer`. */
  _vpoly(g, pts, x, sign, outer, inner, holes) {
    // ShapeGeometry lies in XY with normal +Z. Map shape (u = z, v = y).
    // Ry(-π/2): shape +u → +Z, normal → −X. Ry(+π/2): shape +u → −Z, normal → +X.
    const mk = (m, faceSign, offset) => {
      const fl = faceSign > 0 ? -1 : 1;     // +X-facing plane maps shape +u to −Z, so mirror u
      const geo = polyGeo(pts.map(([u, v]) => [u * fl, v]), holes.map(h => h.map(([u, v]) => [u * fl, v])));
      const mesh = this._ownMesh(geo, m);
      mesh.rotation.y = faceSign > 0 ? Math.PI / 2 : -Math.PI / 2;
      mesh.position.x = x + offset;
      g.add(mesh);
    };
    mk(outer, sign, sign * 0.01);
    mk(inner, -sign, -sign * 0.4);
  }

  // ── Selection & picking ─────────────────────────────────────────────────
  _pick(ev) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    this._ray = this._ray || new THREE.Raycaster();
    this._ray.setFromCamera(p, this.camera);
    const hits = this._ray.intersectObjects(this._pickables, true);
    for (const h of hits) {
      const pk = h.object.userData.pick;
      if (pk && !(h.object.material?.transparent && h.object.material.opacity < 0.5)) return { ...pk, point: h.point };
    }
    return null;
  }

  _bindPointer() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => {
      this._down = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (this.walk.on) return;
      const sel = this.state.selectedId;
      if (!sel || e.button !== 0) return;
      const hit = this._pick(e);
      if (hit?.kind === 'item' && hit.id === sel) {
        const node = this._itemNodes.get(sel);
        if (!node) return;
        this.controls.enabled = false;
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -node.position.y);
        const pt = new THREE.Vector3();
        this._ray.ray.intersectPlane(plane, pt);
        this._drag = { node, plane, ox: node.position.x - pt.x, oz: node.position.z - pt.z, moved: false };
        el.setPointerCapture(e.pointerId);
      }
    });
    el.addEventListener('pointermove', e => {
      if (!this._drag) return;
      const rect = el.getBoundingClientRect();
      const p = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this._ray.setFromCamera(p, this.camera);
      const pt = new THREE.Vector3();
      if (!this._ray.ray.intersectPlane(this._drag.plane, pt)) return;
      const snap = e.shiftKey ? 0.01 : SNAP;
      this._drag.node.position.x = Math.round((pt.x + this._drag.ox) / snap) * snap;
      this._drag.node.position.z = Math.round((pt.z + this._drag.oz) / snap) * snap;
      this._drag.moved = true;
      this.atmo.shadowDirty = true;
      this._updateSelection();
    });
    const up = e => {
      if (this.walk.on) return;
      if (this._drag) {
        const { node, moved } = this._drag;
        this._drag = null; this.controls.enabled = true;
        if (moved) {
          const it = this.state.floors[node.userData.pick.floor].furniture.find(f => f.id === node.userData.pick.id);
          if (it) { it.x = node.position.x; it.y = node.position.z; this.cb.onUpdate?.(); }
          return;
        }
      }
      const d = this._down;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || e.button !== 0) return;
      const hit = this._pick(e);
      this.cb.onSelect?.(hit);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => { this._drag = null; this.controls.enabled = !this.walk.on; });
  }

  _updateSelection() {
    const id = this.state.selectedId;
    let obj = null;
    if (id) {
      obj = this._itemNodes.get(id);
      if (!obj) {
        const meshes = this._pickables.filter(m => m.userData.pick?.id === id);
        if (meshes.length) {
          const box = new THREE.Box3();
          meshes.forEach(m => box.expandByObject(m));
          this._selBox.box.copy(box); this._selBox.visible = true; return;
        }
      }
    }
    if (obj) { this._selBox.box.setFromObject(obj); this._selBox.visible = true; }
    else this._selBox.visible = false;
  }

  /** Called by the app after selection changes or a quick prop tweak. */
  select() { this._updateSelection(); }

  // ── Camera / walk mode ───────────────────────────────────────────────────
  /** Enter/leave walk-through mode. ui: the overlay element with the joystick & buttons. */
  setWalk(on, ui, cb = {}) {
    this.walk.on = on;
    this.controls.enabled = !on;
    this._selBox.visible = false;
    if (on) {
      this._applyWalkFov();
      this.camera.near = 0.1;
      this.buildScene();
      this.walker = new Walker(this, ui, cb);
    } else {
      this.walker?.dispose(); this.walker = null;
      this.camera.fov = 50; this.camera.near = 0.2; this.camera.updateProjectionMatrix();
      this.buildScene();
      this.focusOnLayout();
    }
  }

  /** Walk-mode field of view: aim for ~90° across (what a person takes in without turning their head),
   *  but keep the vertical between 60° and 95° so portrait phones don't distort. */
  _applyWalkFov() {
    const aspect = this.camera.aspect || 1;
    const vfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(45)) / aspect);
    this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vfov), 60, 95);
    this.camera.updateProjectionMatrix();
  }

  _resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.walk.on) this._applyWalkFov();
    this.renderer.setSize(w, h);
    this.pipeline?.resize();
  }

  _animate() {
    this._animId = requestAnimationFrame(() => this._animate());
    const dt = Math.min(0.05, this._clock.getDelta());
    if (this.walker) this.walker.update(dt);
    else this.controls.update();
    // aim the sun's shadow box at what you're looking at (tight & crisp when walking)
    if (this.walker) this.atmo.update(dt, this.walker.pos, 38, this.camera.position);
    else this.atmo.update(dt, this.controls.target, this.camera.position.distanceTo(this.controls.target) * 0.85, this.camera.position);
    this.pipeline.render();
  }

  focusOnLayout() {
    let mnX = Infinity, mxX = -Infinity, mnZ = Infinity, mxZ = -Infinity;
    for (const { f } of this._visibleFloors()) {
      for (const r of f.rooms) { if (r.outdoor) continue; mnX = Math.min(mnX, r.x); mxX = Math.max(mxX, r.x + r.width); mnZ = Math.min(mnZ, r.y); mxZ = Math.max(mxZ, r.y + r.height); }
      for (const w of f.walls) { mnX = Math.min(mnX, w.x1, w.x2); mxX = Math.max(mxX, w.x1, w.x2); mnZ = Math.min(mnZ, w.y1, w.y2); mxZ = Math.max(mxZ, w.y1, w.y2); }
    }
    if (!isFinite(mnX)) {
      for (const f of this.state.floors) for (const it of f.furniture) { mnX = Math.min(mnX, it.x - 3); mxX = Math.max(mxX, it.x + 3); mnZ = Math.min(mnZ, it.y - 3); mxZ = Math.max(mxZ, it.y + 3); }
    }
    if (!isFinite(mnX)) { mnX = -10; mxX = 10; mnZ = -10; mxZ = 10; }
    const cx = (mnX + mxX) / 2, cz = (mnZ + mxZ) / 2, span = Math.max(mxX - mnX, mxZ - mnZ, 12);
    const lvl = this.view.level, fy = lvl === 'all' ? 0 : this.state.floors[lvl]?.elev ?? 0;
    this.camera.position.set(cx - span * 0.55, fy + span * 0.75, cz + span * 0.95);
    this.controls.target.set(cx, fy, cz);
    this.controls.update();
  }

  setTime(key) { this.view.time = key; this.atmo.setTime(key); }
  setQuality(key) { this.view.quality = key; this.pipeline.setQuality(key, this.atmo); }
  setLights(on) { this.atmo.setLightsOn(on); }

  snapshotPNG() { return this.renderer.domElement.toDataURL('image/png'); }

  destroy() {
    if (this._animId) cancelAnimationFrame(this._animId);
    this._ro.disconnect(); this.controls.dispose(); this.renderer.dispose();
    this.renderer.domElement.parentNode?.removeChild(this.renderer.domElement);
  }
}
