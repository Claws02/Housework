import { FURNITURE_CATALOG } from './furniture.js';

const SNAP_FT  = 0.5;
const SNAP_ALN = 0.25;
const ROT_DIST = 1.5;
const PX_DEF   = 20;
const BG       = '#111827';
const GRID_MIN = '#1a2535';
const GRID_MAJ = '#243045';
const WALL_CLR = '#c8d8e8';

const ROOM_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#84cc16'];

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

export class Editor2D {
  constructor(canvas, state, cb) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.state  = state;
    this.cb     = cb;
    this.zoom   = PX_DEF;
    this.panX   = 60; this.panY = 60;
    this.dpr    = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW   = 0;  this.cssH = 0;

    this.wallStart    = null;
    this.roomDrag     = null;
    this._roomPrev    = null;
    this.mouseW       = null;
    this.dragging     = null;
    this.rotating     = null;
    this.resizingRoom = null;   // { id, handle, origRoom, origMouseW }
    this.panning      = false;
    this.panScrStart  = null;
    this.panOffset    = null;
    this._snapGuides  = [];     // [{type:'x'|'y', v, color}]

    this._touches   = new Map();
    this._pinchDist = null; this._pinchMid = null;

    this._anim       = new Map();
    this._rafPending = false;

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(canvas.parentElement);
    this._onKey = e => this._keydown(e);
    window.addEventListener('keydown', this._onKey);
    this._bindEvents();
    this._resize();
  }

  // ── Resize ───────────────────────────────────────────────────────────────
  _resize() {
    const el = this.canvas.parentElement;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    this.canvas.width  = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
    this.cssW = w; this.cssH = h;
    if (!this.state.walls.length && !this.state.rooms.length && !this.state.furniture.length) {
      this.panX = w * 0.15; this.panY = h * 0.15;
    }
    this.render();
  }

  // ── Coordinates ──────────────────────────────────────────────────────────
  w2s(wx, wy) { return { x: wx*this.zoom+this.panX, y: wy*this.zoom+this.panY }; }
  s2w(sx, sy) { return { x: (sx-this.panX)/this.zoom, y: (sy-this.panY)/this.zoom }; }
  snap(x, y)  { return { x: Math.round(x/SNAP_FT)*SNAP_FT, y: Math.round(y/SNAP_FT)*SNAP_FT }; }

  snapEndpoint(x, y) {
    let best = null, bd = SNAP_FT;
    for (const w of this.state.walls)
      for (const p of [{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}]) {
        const d = Math.hypot(p.x-x, p.y-y);
        if (d < bd) { bd = d; best = p; }
      }
    return best;
  }

  // ── Public zoom ──────────────────────────────────────────────────────────
  zoomBy(factor) {
    const cx = this.cssW/2, cy = this.cssH/2;
    this.panX = cx - (cx-this.panX)*factor;
    this.panY = cy - (cy-this.panY)*factor;
    this.zoom = Math.max(4, Math.min(120, this.zoom*factor));
    this.cb.onZoom(Math.round(this.zoom));
    this.render();
  }

  zoomToFit() {
    const b = this._contentBounds();
    if (!b) return;
    const pad = 60;
    const scaleX = (this.cssW - pad*2) / (b.maxX - b.minX);
    const scaleY = (this.cssH - pad*2) / (b.maxY - b.minY);
    this.zoom = Math.max(4, Math.min(120, Math.min(scaleX, scaleY)));
    this.panX = (this.cssW - (b.minX + b.maxX)*this.zoom) / 2;
    this.panY = (this.cssH - (b.minY + b.maxY)*this.zoom) / 2;
    this.cb.onZoom(Math.round(this.zoom));
    this.render();
  }

  _contentBounds() {
    let mnX=Infinity, mxX=-Infinity, mnY=Infinity, mxY=-Infinity;
    for (const r of this.state.rooms) {
      mnX=Math.min(mnX,r.x); mxX=Math.max(mxX,r.x+r.width);
      mnY=Math.min(mnY,r.y); mxY=Math.max(mxY,r.y+r.height);
    }
    for (const w of this.state.walls) {
      mnX=Math.min(mnX,w.x1,w.x2); mxX=Math.max(mxX,w.x1,w.x2);
      mnY=Math.min(mnY,w.y1,w.y2); mxY=Math.max(mxY,w.y1,w.y2);
    }
    for (const f of this.state.furniture) {
      mnX=Math.min(mnX,f.x-f.width/2); mxX=Math.max(mxX,f.x+f.width/2);
      mnY=Math.min(mnY,f.y-f.depth/2); mxY=Math.max(mxY,f.y+f.depth/2);
    }
    if (!isFinite(mnX)) return null;
    return { minX:mnX, maxX:mxX, minY:mnY, maxY:mxY };
  }

  // ── Room resize handles ───────────────────────────────────────────────────
  _roomHandles(room) {
    const s  = this.w2s(room.x, room.y);
    const sw = room.width  * this.zoom;
    const sh = room.height * this.zoom;
    return [
      { id:'TL', sx:s.x,      sy:s.y,      cursor:'nwse-resize' },
      { id:'TC', sx:s.x+sw/2, sy:s.y,      cursor:'ns-resize'   },
      { id:'TR', sx:s.x+sw,   sy:s.y,      cursor:'nesw-resize' },
      { id:'LC', sx:s.x,      sy:s.y+sh/2, cursor:'ew-resize'   },
      { id:'RC', sx:s.x+sw,   sy:s.y+sh/2, cursor:'ew-resize'   },
      { id:'BL', sx:s.x,      sy:s.y+sh,   cursor:'nesw-resize' },
      { id:'BC', sx:s.x+sw/2, sy:s.y+sh,   cursor:'ns-resize'   },
      { id:'BR', sx:s.x+sw,   sy:s.y+sh,   cursor:'nwse-resize' },
    ];
  }

  // ── Snap guides ───────────────────────────────────────────────────────────
  _calcSnapGuides(item) {
    this._snapGuides = [];
    const THR = SNAP_ALN;
    const edges = [];
    for (const r of this.state.rooms) {
      edges.push({t:'x',v:r.x},{t:'x',v:r.x+r.width},{t:'x',v:r.x+r.width/2});
      edges.push({t:'y',v:r.y},{t:'y',v:r.y+r.height},{t:'y',v:r.y+r.height/2});
    }
    for (const f of this.state.furniture) {
      if (f.id === item.id) continue;
      edges.push({t:'x',v:f.x-f.width/2},{t:'x',v:f.x+f.width/2},{t:'x',v:f.x});
      edges.push({t:'y',v:f.y-f.depth/2},{t:'y',v:f.y+f.depth/2},{t:'y',v:f.y});
    }
    for (const w of this.state.walls) {
      edges.push({t:'x',v:w.x1},{t:'x',v:w.x2},{t:'y',v:w.y1},{t:'y',v:w.y2});
    }
    const lx=item.x-item.width/2, rx=item.x+item.width/2;
    const ty=item.y-item.depth/2, by=item.y+item.depth/2;
    const seen = new Set();
    for (const e of edges) {
      const k = `${e.t}:${e.v}`;
      if (seen.has(k)) continue;
      if (e.t === 'x') {
        for (const test of [lx, item.x, rx]) {
          if (Math.abs(test - e.v) < THR) {
            seen.add(k);
            this._snapGuides.push({ type:'x', v:e.v, color: test===item.x ? '#00d4aa' : '#fbbf24' });
            break;
          }
        }
      } else {
        for (const test of [ty, item.y, by]) {
          if (Math.abs(test - e.v) < THR) {
            seen.add(k);
            this._snapGuides.push({ type:'y', v:e.v, color: test===item.y ? '#00d4aa' : '#fbbf24' });
            break;
          }
        }
      }
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────
  _bindEvents() {
    const c = this.canvas;
    c.addEventListener('mousedown',   e => { e.preventDefault(); this._mdown(e); });
    c.addEventListener('mousemove',   e => { e.preventDefault(); this._mmove(e); });
    c.addEventListener('mouseup',     e => { e.preventDefault(); this._mup(e); });
    c.addEventListener('mouseleave',  () => this._mleave());
    c.addEventListener('wheel',       e => { e.preventDefault(); this._wheel(e); }, { passive:false });
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('touchstart',  e => { e.preventDefault(); this._tstart(e); }, { passive:false });
    c.addEventListener('touchmove',   e => { e.preventDefault(); this._tmove(e); },  { passive:false });
    c.addEventListener('touchend',    e => { e.preventDefault(); this._tend(e); },   { passive:false });
    c.addEventListener('touchcancel', e => { e.preventDefault(); this._tend(e); },   { passive:false });
  }

  _mdown(e) { if (e.button > 0) { this._startPan(e.offsetX, e.offsetY); return; } this._pdown(e.offsetX, e.offsetY); }
  _mmove(e) { this._pmove(e.offsetX, e.offsetY); }
  _mup(e)   { this._pup(e.offsetX, e.offsetY); }
  _mleave() {
    if (this.panning)     this._endPan();
    if (this.dragging)    { this._snapGuides=[]; this.dragging=null; this.cb.onUpdate(); }
    if (this.rotating)    { this.rotating=null; this.cb.onUpdate(); }
    if (this.resizingRoom){ this.resizingRoom=null; this.cb.onUpdate(); }
    this.mouseW = null; this.render();
  }
  _wheel(e) {
    const f = e.deltaY < 0 ? 1.12 : 1/1.12;
    this.panX = e.offsetX - (e.offsetX-this.panX)*f;
    this.panY = e.offsetY - (e.offsetY-this.panY)*f;
    this.zoom = Math.max(4, Math.min(120, this.zoom*f));
    this.cb.onZoom(Math.round(this.zoom));
    this.render();
  }

  _rect() { return this.canvas.getBoundingClientRect(); }

  _tstart(e) {
    const r = this._rect();
    for (const t of e.changedTouches)
      this._touches.set(t.identifier, { x:t.clientX-r.left, y:t.clientY-r.top });
    const pts = [...this._touches.values()];
    if (pts.length === 1) {
      this._pdown(pts[0].x, pts[0].y);
    } else if (pts.length === 2) {
      this._cancelSingle();
      const [a,b] = pts;
      this._pinchDist = Math.hypot(b.x-a.x, b.y-a.y);
      this._pinchMid  = { x:(a.x+b.x)/2, y:(a.y+b.y)/2 };
    }
  }
  _tmove(e) {
    const r = this._rect();
    for (const t of e.changedTouches)
      if (this._touches.has(t.identifier))
        this._touches.set(t.identifier, { x:t.clientX-r.left, y:t.clientY-r.top });
    const pts = [...this._touches.values()];
    if (pts.length === 1) {
      this._pmove(pts[0].x, pts[0].y);
    } else if (pts.length === 2) {
      const [a,b] = pts;
      const dist = Math.hypot(b.x-a.x, b.y-a.y);
      const mid  = { x:(a.x+b.x)/2, y:(a.y+b.y)/2 };
      if (this._pinchDist) {
        const f = dist / this._pinchDist;
        this.panX = mid.x - (mid.x-this.panX)*f;
        this.panY = mid.y - (mid.y-this.panY)*f;
        this.zoom = Math.max(4, Math.min(120, this.zoom*f));
        this.cb.onZoom(Math.round(this.zoom));
      }
      if (this._pinchMid) { this.panX += mid.x-this._pinchMid.x; this.panY += mid.y-this._pinchMid.y; }
      this._pinchDist = dist; this._pinchMid = mid;
      this.render();
    }
  }
  _tend(e) {
    for (const t of e.changedTouches) {
      if (!this._touches.has(t.identifier)) continue;
      const pos = this._touches.get(t.identifier);
      this._touches.delete(t.identifier);
      if (this._touches.size === 0) { this._pup(pos.x, pos.y); this._pinchDist=null; this._pinchMid=null; }
    }
    if (this._touches.size === 1) { this._pinchDist=null; this._pinchMid=null; }
  }
  _cancelSingle() {
    this.wallStart=null; this.roomDrag=null; this._roomPrev=null;
    this.dragging=null; this.rotating=null; this.resizingRoom=null;
    if (this.panning) this._endPan();
  }
  _startPan(sx, sy) { this.panning=true; this.panScrStart={x:sx,y:sy}; this.panOffset={x:this.panX,y:this.panY}; }
  _endPan()         { this.panning=false; this.panScrStart=null; }

  // ── Pointer core ──────────────────────────────────────────────────────────
  _pdown(sx, sy) {
    const w  = this.s2w(sx, sy);
    const sn = this.snap(w.x, w.y);
    const { tool } = this.state;

    if (tool === 'room') {
      this.roomDrag = sn; this._roomPrev = null;
      this.render(); return;
    }

    if (tool === 'wall') {
      const ep = this.snapEndpoint(w.x, w.y);
      const pt = ep || sn;
      if (!this.wallStart) {
        this.wallStart = pt;
      } else if (Math.hypot(pt.x-this.wallStart.x, pt.y-this.wallStart.y) >= 0.5) {
        this.state.walls.push({ id:`w${Date.now()}${Math.random().toString(36).slice(2,5)}`, x1:this.wallStart.x, y1:this.wallStart.y, x2:pt.x, y2:pt.y });
        this.wallStart = pt;
        this.cb.onWall(); this.cb.onUpdate();
      }
      this.render(); return;
    }

    if (tool === 'select') {
      // Rotation handle on selected furniture
      if (this.state.selectedId && this.state.selectedId[0] !== 'r') {
        const sel = this.state.furniture.find(f => f.id === this.state.selectedId);
        if (sel) {
          const rh = this._rotHS(sel);
          if (Math.hypot(sx-rh.x, sy-rh.y) < 14) {
            const ctr = this.w2s(sel.x, sel.y);
            this.rotating = { id:sel.id, startAngle:Math.atan2(sy-ctr.y, sx-ctr.x), startRot:sel.rotation };
            return;
          }
        }
      }
      // Resize handles on selected room
      if (this.state.selectedId && this.state.selectedId[0] === 'r') {
        const room = this.state.rooms.find(r => r.id === this.state.selectedId);
        if (room) {
          for (const h of this._roomHandles(room)) {
            if (Math.hypot(sx-h.sx, sy-h.sy) < 10) {
              this.resizingRoom = { id:room.id, handle:h.id, origRoom:{...room}, origMouseW:{x:w.x,y:w.y} };
              return;
            }
          }
        }
      }
      // Hit furniture then rooms
      const hitF = this._hitF(w.x, w.y);
      if (hitF) {
        this.state.selectedId = hitF.id;
        this.dragging = { id:hitF.id, ox:w.x-hitF.x, oy:w.y-hitF.y };
        this.cb.onSelect(); this.render(); return;
      }
      const hitR = this._hitR(w.x, w.y);
      if (hitR) {
        this.state.selectedId = hitR.id;
        this.cb.onSelect(); this.render(); return;
      }
      this.state.selectedId = null;
      this._startPan(sx, sy);
      this.render(); return;
    }

    if (tool === 'add' && this.state.pendingAdd) {
      const cat = FURNITURE_CATALOG.find(f => f.type === this.state.pendingAdd);
      if (cat) {
        const id = `f${Date.now()}${Math.random().toString(36).slice(2,5)}`;
        this.state.furniture.push({ id, type:cat.type, label:cat.label, x:sn.x, y:sn.y, width:cat.width, depth:cat.depth, rotation:0, color:cat.color });
        this.state.selectedId = id;
        this.state.tool = 'select'; this.state.pendingAdd = null;
        this._anim.set(id, { t0:performance.now(), dur:380 });
        this._scheduleRaf();
        this.cb.onPlace(id); this.cb.onToolChange('select'); this.cb.onUpdate();
      }
      return;
    }

    if (tool === 'eraser') {
      const hf = this._hitF(w.x, w.y);
      if (hf) { this.state.furniture = this.state.furniture.filter(f => f.id !== hf.id); this.cb.onRemove(); this.cb.onUpdate(); this.render(); return; }
      const hw = this._hitW(w.x, w.y);
      if (hw) { this.state.walls = this.state.walls.filter(wl => wl.id !== hw.id); this.cb.onRemove(); this.cb.onUpdate(); this.render(); return; }
      const hr = this._hitR(w.x, w.y);
      if (hr) { this.state.rooms = this.state.rooms.filter(r => r.id !== hr.id); this.cb.onRemove(); this.cb.onUpdate(); this.render(); }
    }
  }

  _pmove(sx, sy) {
    this.mouseW = this.s2w(sx, sy);

    if (this.panning && this.panScrStart) {
      this.panX = this.panOffset.x + (sx-this.panScrStart.x);
      this.panY = this.panOffset.y + (sy-this.panScrStart.y);
      this.render(); return;
    }

    if (this.state.tool === 'room' && this.roomDrag) {
      const sn = this.snap(this.mouseW.x, this.mouseW.y);
      this._roomPrev = { x:Math.min(this.roomDrag.x,sn.x), y:Math.min(this.roomDrag.y,sn.y), width:Math.abs(sn.x-this.roomDrag.x), height:Math.abs(sn.y-this.roomDrag.y) };
      this.render(); return;
    }

    if (this.resizingRoom) {
      const { id, handle, origRoom, origMouseW } = this.resizingRoom;
      const room = this.state.rooms.find(r => r.id === id);
      if (room) {
        const snCur = this.snap(this.mouseW.x, this.mouseW.y);
        const snOri = this.snap(origMouseW.x, origMouseW.y);
        const dx = snCur.x - snOri.x, dy = snCur.y - snOri.y;
        let nx=origRoom.x, ny=origRoom.y, nw=origRoom.width, nh=origRoom.height;
        if (handle.includes('L')) { nx=origRoom.x+dx; nw=origRoom.width-dx; }
        if (handle.includes('R')) {                   nw=origRoom.width+dx;  }
        if (handle.includes('T')) { ny=origRoom.y+dy; nh=origRoom.height-dy; }
        if (handle.includes('B')) {                   nh=origRoom.height+dy; }
        if (nw >= 2 && nh >= 2) { room.x=nx; room.y=ny; room.width=nw; room.height=nh; }
      }
      this.render(); return;
    }

    if (this.dragging) {
      const it = this.state.furniture.find(f => f.id === this.dragging.id);
      if (it) {
        const sn = this.snap(this.mouseW.x-this.dragging.ox, this.mouseW.y-this.dragging.oy);
        it.x = sn.x; it.y = sn.y;
        this._calcSnapGuides(it);
      }
      this.render(); return;
    }

    if (this.rotating) {
      const it = this.state.furniture.find(f => f.id === this.rotating.id);
      if (it) {
        const ctr = this.w2s(it.x, it.y);
        const ang = Math.atan2(sy-ctr.y, sx-ctr.x);
        let rot = this.rotating.startRot + (ang - this.rotating.startAngle);
        const snap15 = Math.round(rot/(Math.PI/12)) * (Math.PI/12);
        if (Math.abs(rot-snap15) < 0.05) rot = snap15;
        it.rotation = rot;
      }
      this.render(); return;
    }

    this.render();
  }

  _pup(sx, sy) {
    if (this.state.tool === 'room' && this.roomDrag) {
      const sn = this.snap(this.s2w(sx,sy).x, this.s2w(sx,sy).y);
      const x  = Math.min(this.roomDrag.x, sn.x);
      const y  = Math.min(this.roomDrag.y, sn.y);
      const rw = Math.abs(sn.x-this.roomDrag.x);
      const rh = Math.abs(sn.y-this.roomDrag.y);
      if (rw >= 2 && rh >= 2) {
        const color = ROOM_COLORS[this.state.rooms.length % ROOM_COLORS.length];
        const id = `r${Date.now()}`;
        this.state.rooms.push({ id, x, y, width:rw, height:rh, color, name:`Room ${this.state.rooms.length+1}` });
        this.state.selectedId = id;
        this.cb.onRoom(); this.cb.onUpdate();
      }
      this.roomDrag=null; this._roomPrev=null;
      this.render(); return;
    }
    if (this.panning)     this._endPan();
    if (this.resizingRoom){ this.resizingRoom=null; this.cb.onUpdate(); }
    if (this.dragging)    { this._snapGuides=[]; this.dragging=null; this.cb.onUpdate(); }
    if (this.rotating)    { this.rotating=null; this.cb.onUpdate(); }
    this.render();
  }

  _keydown(e) {
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    const ctrl = e.ctrlKey || e.metaKey;

    if (e.key === 'Escape') {
      this.wallStart=null; this.roomDrag=null; this._roomPrev=null;
      this.state.selectedId=null; this.state.pendingAdd=null;
      this.cb.onToolChange('select');
    } else if ((e.key==='Delete'||e.key==='Backspace') && this.state.selectedId) {
      const isRoom = this.state.selectedId[0]==='r';
      if (isRoom) this.state.rooms = this.state.rooms.filter(r=>r.id!==this.state.selectedId);
      else { this.state.furniture = this.state.furniture.filter(f=>f.id!==this.state.selectedId); this.cb.onRemove(); }
      this.state.selectedId=null; this.cb.onUpdate();
    } else if (!ctrl && e.key==='r') { this.cb.onToolChange('room');   }
    else if   (!ctrl && e.key==='w') { this.cb.onToolChange('wall');   }
    else if   (!ctrl && e.key==='v') { this.cb.onToolChange('select'); }
    else if   (!ctrl && e.key==='e') { this.cb.onToolChange('eraser'); }
    else if   (!ctrl && e.key==='f') { this.zoomToFit(); }
    else if   (!ctrl && (e.key==='+'||e.key==='=')) { this.zoomBy(1.2); }
    else if   (!ctrl && e.key==='-') { this.zoomBy(1/1.2); }
    else if (this.state.selectedId) {
      const arrows = { ArrowLeft:[-0.5,0], ArrowRight:[0.5,0], ArrowUp:[0,-0.5], ArrowDown:[0,0.5] };
      const d = arrows[e.key];
      if (d) {
        e.preventDefault();
        const isRoom = this.state.selectedId[0]==='r';
        if (isRoom) {
          const r = this.state.rooms.find(r=>r.id===this.state.selectedId);
          if (r) { r.x+=d[0]; r.y+=d[1]; this.cb.onUpdate(); }
        } else {
          const f = this.state.furniture.find(f=>f.id===this.state.selectedId);
          if (f) { f.x+=d[0]; f.y+=d[1]; this.cb.onUpdate(); }
        }
      }
    }
    this.render();
  }

  // ── Hit tests ─────────────────────────────────────────────────────────────
  _hitF(wx, wy) {
    for (let i=this.state.furniture.length-1; i>=0; i--) {
      const it = this.state.furniture[i];
      const dx=wx-it.x, dy=wy-it.y;
      const c=Math.cos(-it.rotation), s=Math.sin(-it.rotation);
      const lx=dx*c-dy*s, ly=dx*s+dy*c;
      if (Math.abs(lx)<=it.width/2 && Math.abs(ly)<=it.depth/2) return it;
    }
    return null;
  }
  _hitR(wx, wy) {
    for (let i=this.state.rooms.length-1; i>=0; i--) {
      const r = this.state.rooms[i];
      if (wx>=r.x && wx<=r.x+r.width && wy>=r.y && wy<=r.y+r.height) return r;
    }
    return null;
  }
  _hitW(wx, wy) {
    for (const w of this.state.walls) {
      const dx=w.x2-w.x1, dy=w.y2-w.y1, len2=dx*dx+dy*dy;
      const t=len2?Math.max(0,Math.min(1,((wx-w.x1)*dx+(wy-w.y1)*dy)/len2)):0;
      if (Math.hypot(wx-(w.x1+t*dx), wy-(w.y1+t*dy)) < 0.5) return w;
    }
    return null;
  }

  // ── Handle positions ──────────────────────────────────────────────────────
  _rotHS(it) {
    const lx=0, ly=-(it.depth/2+ROT_DIST);
    const c=Math.cos(it.rotation), s=Math.sin(it.rotation);
    return this.w2s(it.x+lx*c-ly*s, it.y+lx*s+ly*c);
  }

  // ── Animation ─────────────────────────────────────────────────────────────
  animatePlacement(id) {
    this._anim.set(id, { t0:performance.now(), dur:380 });
    this._scheduleRaf();
  }
  _scheduleRaf() {
    if (!this._rafPending) {
      this._rafPending = true;
      requestAnimationFrame(() => { this._rafPending=false; this.render(); });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  render() {
    const ctx=this.ctx, W=this.cssW, H=this.cssH;
    if (!W || !H) return;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    this._drawGrid(ctx, W, H);
    this._drawSnapGuides(ctx, W, H);
    this._drawRooms(ctx);
    this._drawWalls(ctx);
    this._drawRoomPreview(ctx);
    this._drawFurniture(ctx);
    ctx.restore();
    if (this._anim.size > 0) this._scheduleRaf();
  }

  _drawGrid(ctx, W, H) {
    const { zoom:z, panX:px, panY:py } = this;
    const x0=Math.floor(-px/z), x1=Math.ceil((W-px)/z);
    const y0=Math.floor(-py/z), y1=Math.ceil((H-py)/z);
    ctx.strokeStyle=GRID_MIN; ctx.lineWidth=0.5;
    ctx.beginPath();
    for (let x=x0; x<=x1; x++) { const sx=x*z+px; ctx.moveTo(sx,0); ctx.lineTo(sx,H); }
    for (let y=y0; y<=y1; y++) { const sy=y*z+py; ctx.moveTo(0,sy); ctx.lineTo(W,sy); }
    ctx.stroke();
    ctx.strokeStyle=GRID_MAJ; ctx.lineWidth=1;
    ctx.beginPath();
    for (let x=Math.floor(x0/5)*5; x<=x1; x+=5) { const sx=x*z+px; ctx.moveTo(sx,0); ctx.lineTo(sx,H); }
    for (let y=Math.floor(y0/5)*5; y<=y1; y+=5) { const sy=y*z+py; ctx.moveTo(0,sy); ctx.lineTo(W,sy); }
    ctx.stroke();
    if (z > 14) {
      ctx.fillStyle='#304060'; ctx.font=`${Math.min(10,z*.45)}px monospace`;
      for (let x=Math.floor(x0/5)*5; x<=x1; x+=5) {
        const sx=x*z+px; ctx.textAlign='center';
        ctx.fillText(`${x}'`, sx, Math.min(H-4, Math.max(12, py-3)));
      }
      for (let y=Math.floor(y0/5)*5; y<=y1; y+=5) {
        const sy=y*z+py; ctx.textAlign='left';
        ctx.fillText(`${y}'`, Math.max(2,Math.min(px+3,W-24)), sy);
      }
    }
  }

  _drawSnapGuides(ctx, W, H) {
    for (const g of this._snapGuides) {
      ctx.save();
      ctx.strokeStyle=g.color; ctx.lineWidth=1; ctx.globalAlpha=0.7; ctx.setLineDash([4,3]);
      ctx.beginPath();
      if (g.type==='x') { const sx=g.v*this.zoom+this.panX; ctx.moveTo(sx,0); ctx.lineTo(sx,H); }
      else               { const sy=g.v*this.zoom+this.panY; ctx.moveTo(0,sy); ctx.lineTo(W,sy); }
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawRooms(ctx) {
    for (const room of this.state.rooms) {
      const s  = this.w2s(room.x, room.y);
      const rw = room.width  * this.zoom;
      const rh = room.height * this.zoom;
      const sel = room.id === this.state.selectedId;

      ctx.globalAlpha=0.18; ctx.fillStyle=room.color; ctx.fillRect(s.x,s.y,rw,rh); ctx.globalAlpha=1;
      ctx.strokeStyle=sel?'#ffffff':room.color; ctx.lineWidth=sel?2.5:2; ctx.globalAlpha=sel?0.9:0.55;
      ctx.strokeRect(s.x,s.y,rw,rh); ctx.globalAlpha=1;

      if (rw > 40 && rh > 20) {
        ctx.fillStyle='rgba(255,255,255,0.65)';
        ctx.font=`bold ${Math.min(14,Math.max(9,rw/8))}px system-ui`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(room.name, s.x+rw/2, s.y+rh/2);
      }

      if (sel) {
        // Dimension labels
        if (rw > 50) {
          ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='10px monospace';
          ctx.textAlign='center'; ctx.textBaseline='bottom';
          ctx.fillText(`${room.width.toFixed(1)}'`, s.x+rw/2, s.y-3);
          ctx.textAlign='right'; ctx.textBaseline='middle';
          ctx.fillText(`${room.height.toFixed(1)}'`, s.x-5, s.y+rh/2);
        }
        // 8 resize handles
        for (const h of this._roomHandles(room)) {
          ctx.fillStyle='#fff'; ctx.strokeStyle='#ff6b35'; ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(h.sx,h.sy,5,0,6.28); ctx.fill(); ctx.stroke();
        }
      }
    }
  }

  _drawRoomPreview(ctx) {
    if (!this._roomPrev) return;
    const r=this._roomPrev, s=this.w2s(r.x,r.y);
    const rw=r.width*this.zoom, rh=r.height*this.zoom;
    ctx.globalAlpha=0.12; ctx.fillStyle='#63b4ff'; ctx.fillRect(s.x,s.y,rw,rh); ctx.globalAlpha=1;
    ctx.strokeStyle='#5B9AD5'; ctx.lineWidth=2; ctx.setLineDash([7,4]);
    ctx.strokeRect(s.x,s.y,rw,rh); ctx.setLineDash([]);
    ctx.fillStyle='#A0D0FF'; ctx.font='bold 11px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`${r.width.toFixed(1)}' × ${r.height.toFixed(1)}'`, s.x+rw/2, s.y+rh/2);
  }

  _drawWalls(ctx) {
    const thick = Math.max(3, 8*this.zoom/PX_DEF);
    for (const w of this.state.walls) {
      const s1=this.w2s(w.x1,w.y1), s2=this.w2s(w.x2,w.y2);
      ctx.strokeStyle=WALL_CLR; ctx.lineWidth=thick; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(s1.x,s1.y); ctx.lineTo(s2.x,s2.y); ctx.stroke();
      ctx.fillStyle='#A0C8E8';
      for (const p of [s1,s2]) { ctx.beginPath(); ctx.arc(p.x,p.y,4,0,6.28); ctx.fill(); }
      if (this.zoom > 14) {
        const len=Math.hypot(w.x2-w.x1, w.y2-w.y1);
        const mx=(s1.x+s2.x)/2, my=(s1.y+s2.y)/2;
        const ang=Math.atan2(s2.y-s1.y, s2.x-s1.x);
        ctx.save(); ctx.translate(mx,my); ctx.rotate(ang);
        ctx.fillStyle='#A0C0E0'; ctx.font='10px monospace'; ctx.textAlign='center';
        ctx.fillText(`${len.toFixed(1)}'`, 0, -thick/2-3);
        ctx.restore();
      }
    }
    if (this.state.tool==='wall' && this.mouseW) {
      const ep = this.snapEndpoint(this.mouseW.x, this.mouseW.y);
      if (ep) { const ss=this.w2s(ep.x,ep.y); ctx.strokeStyle='#FFD700'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(ss.x,ss.y,8,0,6.28); ctx.stroke(); }
    }
    if (this.wallStart) {
      const ss=this.w2s(this.wallStart.x, this.wallStart.y);
      ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.arc(ss.x,ss.y,6,0,6.28); ctx.fill();
      if (this.state.tool==='wall' && this.mouseW) {
        const ep=this.snapEndpoint(this.mouseW.x, this.mouseW.y);
        const end=ep||this.snap(this.mouseW.x, this.mouseW.y);
        const s2=this.w2s(end.x,end.y);
        const len=Math.hypot(end.x-this.wallStart.x, end.y-this.wallStart.y);
        ctx.strokeStyle='#5B9AD5'; ctx.lineWidth=3; ctx.lineCap='round';
        ctx.setLineDash([6,4]); ctx.beginPath(); ctx.moveTo(ss.x,ss.y); ctx.lineTo(s2.x,s2.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle='#A0D0FF'; ctx.font='11px monospace'; ctx.textAlign='center';
        ctx.fillText(`${len.toFixed(1)}'`, (ss.x+s2.x)/2, (ss.y+s2.y)/2-10);
      }
    }
  }

  _drawFurniture(ctx) {
    const now = performance.now();
    for (const it of this.state.furniture) {
      const c=this.w2s(it.x,it.y), pw=it.width*this.zoom, ph=it.depth*this.zoom;
      const sel = it.id===this.state.selectedId;
      let scale = 1;
      const anim = this._anim.get(it.id);
      if (anim) {
        const t=(now-anim.t0)/anim.dur;
        if (t>=1) this._anim.delete(it.id);
        else scale = 1 + 0.3*Math.sin(t*Math.PI);
      }
      ctx.save();
      ctx.translate(c.x,c.y); ctx.rotate(it.rotation); ctx.scale(scale,scale);
      if (sel) { ctx.shadowColor='#fff'; ctx.shadowBlur=10; }
      ctx.fillStyle=it.color;
      ctx.strokeStyle=sel?'#ffffff':'rgba(255,255,255,0.22)';
      ctx.lineWidth=sel?2:1;
      rrect(ctx,-pw/2,-ph/2,pw,ph,3); ctx.fill(); ctx.stroke();
      ctx.shadowBlur=0;
      if (pw>36 && ph>14) {
        ctx.fillStyle='rgba(255,255,255,0.88)';
        ctx.font=`${Math.max(8,Math.min(12,pw/7))}px system-ui`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(it.label, 0, 0);
      }
      ctx.restore();
      if (sel) {
        const rh=this._rotHS(it);
        ctx.strokeStyle='#FFD700'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.moveTo(c.x,c.y); ctx.lineTo(rh.x,rh.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle='#FFD700'; ctx.strokeStyle='#111'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(rh.x,rh.y,9,0,6.28); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#111'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('↻', rh.x, rh.y);
      }
    }
  }

  destroy() {
    this._ro.disconnect();
    window.removeEventListener('keydown', this._onKey);
  }
}
