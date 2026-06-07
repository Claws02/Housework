import { FURNITURE_CATALOG } from './furniture.js';

const WALL_PX = 8;
const SNAP_FT = 0.5;
const ROT_HANDLE_DIST = 1.5;
const BG = '#111827';
const GRID_MINOR = '#1a2535';
const GRID_MAJOR = '#243045';
const WALL_CLR = '#CBD5E0';
const PX_PER_FT = 20;

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export class Editor2D {
  constructor(canvas, state, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.cb = callbacks;
    this.zoom = PX_PER_FT;
    this.panX = 0;
    this.panY = 0;
    this.dpr = window.devicePixelRatio || 1;
    this.wallStart = null;
    this.mouseW = null;
    this.dragging = null;
    this.rotating = null;
    this.panning = false;
    this.panScrStart = null;
    this.panOffset = null;
    this._touches = new Map();
    this._pinchDist = null;
    this._pinchMid = null;
    this.cssW = 0;
    this.cssH = 0;

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(canvas.parentElement);
    this._onKey = e => this._keydown(e);
    window.addEventListener('keydown', this._onKey);
    this._bindEvents();
    this._resize();
  }

  _resize() {
    const el = this.canvas.parentElement;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.cssW = w; this.cssH = h;
    if (this.state.walls.length === 0 && this.state.furniture.length === 0) {
      this.panX = w / 2; this.panY = h / 2;
    }
    this.render();
  }

  w2s(wx, wy) { return { x: wx * this.zoom + this.panX, y: wy * this.zoom + this.panY }; }
  s2w(sx, sy) { return { x: (sx - this.panX) / this.zoom, y: (sy - this.panY) / this.zoom }; }
  snap(x, y) { return { x: Math.round(x / SNAP_FT) * SNAP_FT, y: Math.round(y / SNAP_FT) * SNAP_FT }; }

  snapEndpoint(x, y) {
    let best = null, bd = SNAP_FT;
    for (const w of this.state.walls) {
      for (const p of [{x: w.x1, y: w.y1}, {x: w.x2, y: w.y2}]) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) { bd = d; best = p; }
      }
    }
    return best;
  }

  _bindEvents() {
    const c = this.canvas;
    c.addEventListener('mousedown', e => { e.preventDefault(); this._mdown(e); });
    c.addEventListener('mousemove', e => { e.preventDefault(); this._mmove(e); });
    c.addEventListener('mouseup',   e => { e.preventDefault(); this._mup(e); });
    c.addEventListener('mouseleave',e => { this._mleave(); });
    c.addEventListener('wheel',     e => { e.preventDefault(); this._wheel(e); }, { passive: false });
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('touchstart',  e => { e.preventDefault(); this._tstart(e); }, { passive: false });
    c.addEventListener('touchmove',   e => { e.preventDefault(); this._tmove(e); }, { passive: false });
    c.addEventListener('touchend',    e => { e.preventDefault(); this._tend(e); }, { passive: false });
    c.addEventListener('touchcancel', e => { e.preventDefault(); this._tend(e); }, { passive: false });
  }

  _rect() { return this.canvas.getBoundingClientRect(); }

  _mdown(e) {
    if (e.button === 1 || e.button === 2) { this._startPan(e.offsetX, e.offsetY); return; }
    this._pdown(e.offsetX, e.offsetY);
  }
  _mmove(e) { this._pmove(e.offsetX, e.offsetY); }
  _mup(e)   { this._pup(e.offsetX, e.offsetY); }
  _mleave() {
    if (this.panning) this._endPan();
    if (this.dragging) { this.dragging = null; this.cb.onUpdate(); }
    if (this.rotating) { this.rotating = null; this.cb.onUpdate(); }
    this.mouseW = null; this.render();
  }

  _wheel(e) {
    const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const sx = e.offsetX, sy = e.offsetY;
    this.panX = sx - (sx - this.panX) * f;
    this.panY = sy - (sy - this.panY) * f;
    this.zoom = Math.max(4, Math.min(120, this.zoom * f));
    this.cb.onZoom(Math.round(this.zoom));
    this.render();
  }

  _tstart(e) {
    const r = this._rect();
    for (const t of e.changedTouches) {
      this._touches.set(t.identifier, { x: t.clientX - r.left, y: t.clientY - r.top });
    }
    const pts = [...this._touches.values()];
    if (pts.length === 1) {
      this._pdown(pts[0].x, pts[0].y);
    } else if (pts.length === 2) {
      this._cancelSingle();
      const [a, b] = pts;
      this._pinchDist = Math.hypot(b.x - a.x, b.y - a.y);
      this._pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }

  _tmove(e) {
    const r = this._rect();
    for (const t of e.changedTouches) {
      if (this._touches.has(t.identifier))
        this._touches.set(t.identifier, { x: t.clientX - r.left, y: t.clientY - r.top });
    }
    const pts = [...this._touches.values()];
    if (pts.length === 1) {
      this._pmove(pts[0].x, pts[0].y);
    } else if (pts.length === 2) {
      const [a, b] = pts;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (this._pinchDist) {
        const f = dist / this._pinchDist;
        this.panX = mid.x - (mid.x - this.panX) * f;
        this.panY = mid.y - (mid.y - this.panY) * f;
        this.zoom = Math.max(4, Math.min(120, this.zoom * f));
        this.cb.onZoom(Math.round(this.zoom));
      }
      if (this._pinchMid) { this.panX += mid.x - this._pinchMid.x; this.panY += mid.y - this._pinchMid.y; }
      this._pinchDist = dist; this._pinchMid = mid;
      this.render();
    }
  }

  _tend(e) {
    for (const t of e.changedTouches) {
      if (this._touches.has(t.identifier)) {
        const pos = this._touches.get(t.identifier);
        this._touches.delete(t.identifier);
        if (this._touches.size === 0) { this._pup(pos.x, pos.y); this._pinchDist = null; this._pinchMid = null; }
      }
    }
    if (this._touches.size === 1) { this._pinchDist = null; this._pinchMid = null; }
  }

  _cancelSingle() {
    this.wallStart = null; this.dragging = null; this.rotating = null;
    if (this.panning) this._endPan();
  }

  _startPan(sx, sy) {
    this.panning = true;
    this.panScrStart = { x: sx, y: sy };
    this.panOffset = { x: this.panX, y: this.panY };
    this.canvas.style.cursor = 'grabbing';
  }

  _endPan() {
    this.panning = false; this.panScrStart = null;
    this.canvas.style.cursor = this._toolCursor();
  }

  _toolCursor() {
    return this.state.tool === 'wall' ? 'crosshair' : this.state.tool === 'eraser' ? 'cell' : 'default';
  }

  _rotHandleScreen(item) {
    const lx = 0, ly = -(item.depth / 2 + ROT_HANDLE_DIST);
    const c = Math.cos(item.rotation), s = Math.sin(item.rotation);
    return this.w2s(item.x + lx * c - ly * s, item.y + lx * s + ly * c);
  }

  _delHandleScreen(item) {
    const lx = item.width / 2, ly = -(item.depth / 2);
    const c = Math.cos(item.rotation), s = Math.sin(item.rotation);
    return this.w2s(item.x + lx * c - ly * s, item.y + lx * s + ly * c);
  }

  _hitFurniture(wx, wy) {
    for (let i = this.state.furniture.length - 1; i >= 0; i--) {
      const it = this.state.furniture[i];
      const dx = wx - it.x, dy = wy - it.y;
      const c = Math.cos(-it.rotation), s = Math.sin(-it.rotation);
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      if (Math.abs(lx) <= it.width / 2 && Math.abs(ly) <= it.depth / 2) return it;
    }
    return null;
  }

  _hitWall(wx, wy) {
    const thresh = 0.5;
    for (const w of this.state.walls) {
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) { if (Math.hypot(wx - w.x1, wy - w.y1) < thresh) return w; continue; }
      const t = Math.max(0, Math.min(1, ((wx - w.x1) * dx + (wy - w.y1) * dy) / len2));
      if (Math.hypot(wx - (w.x1 + t * dx), wy - (w.y1 + t * dy)) < thresh) return w;
    }
    return null;
  }

  _pdown(sx, sy) {
    const w = this.s2w(sx, sy);
    const sn = this.snap(w.x, w.y);
    const { tool } = this.state;

    if (tool === 'wall') {
      const ep = this.snapEndpoint(w.x, w.y);
      const pt = ep || sn;
      if (!this.wallStart) {
        this.wallStart = pt;
      } else {
        if (Math.hypot(pt.x - this.wallStart.x, pt.y - this.wallStart.y) >= 0.5) {
          this.state.walls.push({ id: `w${Date.now()}${Math.random().toString(36).slice(2,6)}`, x1: this.wallStart.x, y1: this.wallStart.y, x2: pt.x, y2: pt.y });
          this.wallStart = pt;
          this.cb.onUpdate();
        }
      }
      this.render(); return;
    }

    if (tool === 'select') {
      if (this.state.selectedId) {
        const sel = this.state.furniture.find(f => f.id === this.state.selectedId);
        if (sel) {
          const rh = this._rotHandleScreen(sel);
          if (Math.hypot(sx - rh.x, sy - rh.y) < 14) {
            const ctr = this.w2s(sel.x, sel.y);
            this.rotating = { id: sel.id, startAngle: Math.atan2(sy - ctr.y, sx - ctr.x), startRot: sel.rotation };
            return;
          }
          const dh = this._delHandleScreen(sel);
          if (Math.hypot(sx - dh.x, sy - dh.y) < 14) {
            this.state.furniture = this.state.furniture.filter(f => f.id !== sel.id);
            this.state.selectedId = null;
            this.cb.onUpdate(); this.render(); return;
          }
        }
      }
      const hit = this._hitFurniture(w.x, w.y);
      if (hit) {
        this.state.selectedId = hit.id;
        this.dragging = { id: hit.id, ox: w.x - hit.x, oy: w.y - hit.y };
      } else {
        this.state.selectedId = null;
        this._startPan(sx, sy);
      }
      this.render(); return;
    }

    if (tool === 'add' && this.state.pendingAdd) {
      const cat = FURNITURE_CATALOG.find(f => f.type === this.state.pendingAdd);
      if (cat) {
        const id = `f${Date.now()}${Math.random().toString(36).slice(2,6)}`;
        this.state.furniture.push({ id, type: cat.type, label: cat.label, x: sn.x, y: sn.y, width: cat.width, depth: cat.depth, rotation: 0, color: cat.color });
        this.state.selectedId = id;
        this.state.tool = 'select';
        this.state.pendingAdd = null;
        this.cb.onUpdate(); this.cb.onToolChange('select');
      }
      this.render(); return;
    }

    if (tool === 'eraser') {
      const hf = this._hitFurniture(w.x, w.y);
      if (hf) { this.state.furniture = this.state.furniture.filter(f => f.id !== hf.id); this.cb.onUpdate(); this.render(); return; }
      const hw = this._hitWall(w.x, w.y);
      if (hw) { this.state.walls = this.state.walls.filter(wl => wl.id !== hw.id); this.cb.onUpdate(); this.render(); }
    }
  }

  _pmove(sx, sy) {
    this.mouseW = this.s2w(sx, sy);
    if (this.panning && this.panScrStart) {
      this.panX = this.panOffset.x + (sx - this.panScrStart.x);
      this.panY = this.panOffset.y + (sy - this.panScrStart.y);
      this.render(); return;
    }
    if (this.dragging) {
      const it = this.state.furniture.find(f => f.id === this.dragging.id);
      if (it) {
        const sn = this.snap(this.mouseW.x - this.dragging.ox, this.mouseW.y - this.dragging.oy);
        it.x = sn.x; it.y = sn.y;
      }
      this.render(); return;
    }
    if (this.rotating) {
      const it = this.state.furniture.find(f => f.id === this.rotating.id);
      if (it) {
        const ctr = this.w2s(it.x, it.y);
        const ang = Math.atan2(sy - ctr.y, sx - ctr.x);
        let rot = this.rotating.startRot + (ang - this.rotating.startAngle);
        const snap15 = Math.round(rot / (Math.PI / 12)) * (Math.PI / 12);
        if (Math.abs(rot - snap15) < 0.05) rot = snap15;
        it.rotation = rot;
      }
      this.render(); return;
    }
    this.render();
  }

  _pup(sx, sy) {
    if (this.panning) this._endPan();
    if (this.dragging) { this.dragging = null; this.cb.onUpdate(); }
    if (this.rotating) { this.rotating = null; this.cb.onUpdate(); }
    this.render();
  }

  _keydown(e) {
    if (e.target !== document.body && e.target.tagName !== 'CANVAS') return;
    if (e.key === 'Escape') {
      this.wallStart = null; this.state.selectedId = null;
      this.state.pendingAdd = null; this.cb.onToolChange('select');
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.state.selectedId) {
      this.state.furniture = this.state.furniture.filter(f => f.id !== this.state.selectedId);
      this.state.selectedId = null; this.cb.onUpdate();
    } else if (e.key === 'v') { this.cb.onToolChange('select'); }
    else if (e.key === 'w') { this.cb.onToolChange('wall'); }
    else if (e.key === 'e') { this.cb.onToolChange('eraser'); }
    this.render();
  }

  render() {
    const ctx = this.ctx;
    const W = this.cssW || this.canvas.width, H = this.cssH || this.canvas.height;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    this._drawGrid(ctx, W, H);
    this._drawWalls(ctx);
    this._drawFurniture(ctx);
    if (this.state.tool === 'wall' && this.wallStart && this.mouseW) this._drawWallPreview(ctx);
    ctx.restore();
  }

  _drawGrid(ctx, W, H) {
    const { zoom: z, panX: px, panY: py } = this;
    const x0 = Math.floor(-px / z), x1 = Math.ceil((W - px) / z);
    const y0 = Math.floor(-py / z), y1 = Math.ceil((H - py) / z);

    ctx.strokeStyle = GRID_MINOR; ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = x0; x <= x1; x++) { const sx = x * z + px; ctx.moveTo(sx, 0); ctx.lineTo(sx, H); }
    for (let y = y0; y <= y1; y++) { const sy = y * z + py; ctx.moveTo(0, sy); ctx.lineTo(W, sy); }
    ctx.stroke();

    ctx.strokeStyle = GRID_MAJOR; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.floor(x0 / 5) * 5; x <= x1; x += 5) { const sx = x * z + px; ctx.moveTo(sx, 0); ctx.lineTo(sx, H); }
    for (let y = Math.floor(y0 / 5) * 5; y <= y1; y += 5) { const sy = y * z + py; ctx.moveTo(0, sy); ctx.lineTo(W, sy); }
    ctx.stroke();

    if (z > 14) {
      ctx.fillStyle = '#304060'; ctx.font = `${Math.min(10, z * 0.45)}px monospace`;
      for (let x = Math.floor(x0 / 5) * 5; x <= x1; x += 5) {
        const sx = x * z + px;
        ctx.textAlign = 'center';
        ctx.fillText(`${x}'`, sx, Math.min(H - 4, Math.max(12, py - 3)));
      }
      for (let y = Math.floor(y0 / 5) * 5; y <= y1; y += 5) {
        const sy = y * z + py;
        ctx.textAlign = 'left';
        ctx.fillText(`${y}'`, Math.max(2, Math.min(px + 3, W - 24)), sy);
      }
    }
  }

  _drawWalls(ctx) {
    const thick = Math.max(3, WALL_PX * this.zoom / PX_PER_FT);
    for (const w of this.state.walls) {
      const s1 = this.w2s(w.x1, w.y1), s2 = this.w2s(w.x2, w.y2);
      ctx.strokeStyle = WALL_CLR; ctx.lineWidth = thick; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
      ctx.fillStyle = '#A0C8E8';
      for (const p of [s1, s2]) { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.28); ctx.fill(); }
      if (this.zoom > 14) {
        const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
        const mx = (s1.x + s2.x) / 2, my = (s1.y + s2.y) / 2;
        const ang = Math.atan2(s2.y - s1.y, s2.x - s1.x);
        ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
        ctx.fillStyle = '#A0C0E0'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
        ctx.fillText(`${len.toFixed(1)}'`, 0, -thick / 2 - 3);
        ctx.restore();
      }
    }
    if (this.state.tool === 'wall' && this.mouseW) {
      const ep = this.snapEndpoint(this.mouseW.x, this.mouseW.y);
      if (ep) { const ss = this.w2s(ep.x, ep.y); ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ss.x, ss.y, 8, 0, 6.28); ctx.stroke(); }
    }
    if (this.wallStart) {
      const ss = this.w2s(this.wallStart.x, this.wallStart.y);
      ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(ss.x, ss.y, 6, 0, 6.28); ctx.fill();
    }
  }

  _drawWallPreview(ctx) {
    const ep = this.snapEndpoint(this.mouseW.x, this.mouseW.y);
    const end = ep || this.snap(this.mouseW.x, this.mouseW.y);
    const s1 = this.w2s(this.wallStart.x, this.wallStart.y), s2 = this.w2s(end.x, end.y);
    ctx.strokeStyle = '#5B9AD5'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke(); ctx.setLineDash([]);
    const len = Math.hypot(end.x - this.wallStart.x, end.y - this.wallStart.y);
    ctx.fillStyle = '#A0D0FF'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${len.toFixed(1)}'`, (s1.x + s2.x) / 2, (s1.y + s2.y) / 2 - 10);
  }

  _drawFurniture(ctx) {
    for (const it of this.state.furniture) {
      const c = this.w2s(it.x, it.y);
      const w = it.width * this.zoom, h = it.depth * this.zoom;
      const sel = it.id === this.state.selectedId;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(it.rotation);
      if (sel) { ctx.shadowColor = '#E94560'; ctx.shadowBlur = 14; }
      ctx.fillStyle = it.color;
      ctx.strokeStyle = sel ? '#E94560' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = sel ? 2 : 1;
      rrect(ctx, -w / 2, -h / 2, w, h, 3); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      if (w > 40 && h > 16) {
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.font = `${Math.max(8, Math.min(13, w / 7))}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(it.label, 0, 0);
      }
      ctx.restore();
      if (sel) {
        const rh = this._rotHandleScreen(it);
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(rh.x, rh.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#FFD700'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(rh.x, rh.y, 8, 0, 6.28); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#222'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('↻', rh.x, rh.y);
        const dh = this._delHandleScreen(it);
        ctx.fillStyle = '#E94560'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(dh.x, dh.y, 8, 0, 6.28); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✕', dh.x, dh.y);
      }
    }
  }

  destroy() {
    this._ro.disconnect();
    window.removeEventListener('keydown', this._onKey);
  }
}
