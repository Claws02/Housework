import { Editor2D }        from './editor2d.js';
import { Viewer3D }         from './viewer3d.js';
import { FURNITURE_CATALOG } from './furniture.js';
import { sounds }            from './sounds.js';

// ── Constants ──────────────────────────────────────────────────────────────
const STORAGE_KEY  = 'apt-v2';
const ACH_KEY      = 'apt-ach';
const BUDGET_MAX   = 10000;

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  rooms: [], walls: [], furniture: [],
  tool: 'room', pendingAdd: null, selectedId: null, mode: '2d',
};

let editor = null;
let viewer = null;

// ── History ────────────────────────────────────────────────────────────────
const hist = { stack: [], cursor: -1 };

function _snapshot() {
  const snap = JSON.stringify({ rooms: state.rooms, walls: state.walls, furniture: state.furniture });
  hist.stack = hist.stack.slice(0, hist.cursor + 1);
  hist.stack.push(snap);
  if (hist.stack.length > 60) hist.stack.shift();
  else hist.cursor++;
  _updateUndoButtons();
}

function _undo() {
  if (hist.cursor <= 0) { sounds.error(); return; }
  hist.stack[hist.cursor] = JSON.stringify({ rooms: state.rooms, walls: state.walls, furniture: state.furniture });
  hist.cursor--;
  _restore(hist.stack[hist.cursor]);
  sounds.undo();
  _afterStateChange();
}

function _redo() {
  if (hist.cursor >= hist.stack.length - 1) { sounds.error(); return; }
  hist.cursor++;
  _restore(hist.stack[hist.cursor]);
  _afterStateChange();
}

function _restore(snap) {
  const d = JSON.parse(snap);
  state.rooms = d.rooms; state.walls = d.walls; state.furniture = d.furniture;
  state.selectedId = null;
}

function _afterStateChange() {
  editor?.render();
  if (viewer && state.mode === '3d') viewer.refresh();
  _updateBudget(); _updateUndoButtons();
  _saveStorage();
}

function _updateUndoButtons() {
  const u = _qs('#btn-undo'), r = _qs('#btn-redo');
  if (u) u.disabled = hist.cursor <= 0;
  if (r) r.disabled = hist.cursor >= hist.stack.length - 1;
}

// ── Budget ─────────────────────────────────────────────────────────────────
function _calcSpent() {
  return state.furniture.reduce((sum, f) => {
    const cat = FURNITURE_CATALOG.find(c => c.type === f.type);
    return sum + (cat?.price ?? 0);
  }, 0);
}

function _updateBudget() {
  const spent = _calcSpent();
  const pct   = Math.min(100, (spent / BUDGET_MAX) * 100);
  const left  = BUDGET_MAX - spent;
  const fill  = _qs('#budget-fill');
  const hud   = _qs('#budget-hud');
  if (!fill || !hud) return;

  _qs('#budget-spent').textContent    = `$${spent.toLocaleString()}`;
  _qs('#budget-remaining').textContent = left >= 0 ? `$${left.toLocaleString()} left` : `$${Math.abs(left).toLocaleString()} over!`;
  fill.style.width      = pct + '%';
  fill.style.background = pct < 65 ? '#4ade80' : pct < 88 ? '#fbbf24' : '#f87171';
  hud.classList.toggle('over-budget', left < 0);

  if (left < 0) sounds.overBudget();
}

// ── Achievements ───────────────────────────────────────────────────────────
const ACHIEVEMENTS = {
  'first-room':      { icon: '🏠', title: 'Blueprint Begins!',    sub: 'You drew your first room' },
  'first-furn':      { icon: '🛋', title: 'Moving In!',           sub: 'First piece of furniture placed' },
  'five-furn':       { icon: '⭐', title: 'Getting Cozy!',        sub: 'You placed 5 pieces of furniture' },
  'three-rooms':     { icon: '🏘', title: 'Floor Plan Pro!',      sub: 'You designed 3 rooms' },
  'full-bedroom':    { icon: '😴', title: 'Dream Bedroom!',       sub: 'Bed + nightstand combo placed' },
  'living-room-set': { icon: '🎉', title: 'Living Room Ready!',   sub: 'Sofa + coffee table placed' },
};

function _checkAchievements() {
  const done = JSON.parse(localStorage.getItem(ACH_KEY) || '{}');
  const types = new Set(state.furniture.map(f => f.type));
  const checks = [
    ['first-room',      state.rooms.length >= 1],
    ['first-furn',      state.furniture.length >= 1],
    ['five-furn',       state.furniture.length >= 5],
    ['three-rooms',     state.rooms.length >= 3],
    ['full-bedroom',    (types.has('bed-queen')||types.has('bed-king')||types.has('bed-full')||types.has('bed-twin')) && types.has('nightstand')],
    ['living-room-set', (types.has('sofa-2')||types.has('sofa-3')||types.has('sofa-l')) && types.has('coffee-table')],
  ];
  for (const [key, cond] of checks) {
    if (!done[key] && cond) {
      done[key] = true;
      const ach = ACHIEVEMENTS[key];
      sounds.achievement();
      _toast(ach.icon, ach.title, ach.sub);
    }
  }
  localStorage.setItem(ACH_KEY, JSON.stringify(done));
}

// ── Toast ──────────────────────────────────────────────────────────────────
function _toast(icon, title, sub = '') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-icon">${icon}</span><div><div class="toast-title">${title}</div>${sub ? `<div class="toast-sub">${sub}</div>` : ''}</div>`;
  _qs('#toast-wrap').appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3200);
}

// ── onUpdate callback ──────────────────────────────────────────────────────
function _onUpdate() {
  _snapshot();
  _saveStorage();
  _updateBudget();
  _checkAchievements();
  if (viewer && state.mode === '3d') viewer.refresh();
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _loadStorage();
  _buildPalette();
  _bindUI();
  _initEditor();
  _updateToolUI();
  _updateBudget();
  // seed history with initial state
  _snapshot();
  _updateUndoButtons();
});

function _qs(sel) { return document.querySelector(sel); }
function _on(id, ev, fn) { _qs(`#${id}`)?.addEventListener(ev, fn); }

// ── Editor init ────────────────────────────────────────────────────────────
function _initEditor() {
  editor = new Editor2D(_qs('#canvas-2d'), state, {
    onUpdate:     _onUpdate,
    onToolChange: t => _setTool(t),
    onZoom:       z => { _qs('#zoom-label').textContent = `${z} px/ft`; },
    onPlace:      id  => { sounds.place(); editor.animatePlacement(id); },
    onRoom:       ()  => sounds.room(),
    onWall:       ()  => sounds.wall(),
    onSelect:     ()  => sounds.select(),
    onRemove:     ()  => sounds.remove(),
  });
}

// ── UI binding ─────────────────────────────────────────────────────────────
function _bindUI() {
  _on('btn-mode-2d', 'click', () => _setMode('2d'));
  _on('btn-mode-3d', 'click', () => _setMode('3d'));

  _on('btn-room',   'click', () => _setTool('room'));
  _on('btn-wall',   'click', () => _setTool('wall'));
  _on('btn-select', 'click', () => _setTool('select'));
  _on('btn-eraser', 'click', () => _setTool('eraser'));

  _on('btn-undo',  'click', _undo);
  _on('btn-redo',  'click', _redo);

  _on('btn-save',   'click', _saveFile);
  _on('btn-load',   'click', () => _qs('#file-input').click());
  _on('btn-clear',  'click', _clearAll);
  _on('btn-export', 'click', _exportPNG);
  _on('btn-sound',  'click', () => {
    const m = sounds.toggleMute();
    _qs('#btn-sound').textContent = m ? '🔇' : '🔊';
  });

  _qs('#file-input')?.addEventListener('change', _loadFile);
  _qs('#palette-search')?.addEventListener('input', e => _filterPalette(e.target.value));
  _on('btn-sidebar-toggle', 'click', _toggleSidebar);

  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 'z') { e.preventDefault(); _undo(); }
    if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); _redo(); }
    if (ctrl && e.key === 's') { e.preventDefault(); _saveStorage(); _toast('💾', 'Saved!'); }
  });
}

// ── Mode ───────────────────────────────────────────────────────────────────
function _setMode(mode) {
  state.mode = mode;
  _qs('#btn-mode-2d').classList.toggle('active', mode === '2d');
  _qs('#btn-mode-3d').classList.toggle('active', mode === '3d');
  _qs('#canvas-2d').style.display  = mode === '2d' ? 'block' : 'none';
  _qs('#view-3d').style.display    = mode === '3d' ? 'block' : 'none';
  _qs('#tools-2d').style.display   = mode === '2d' ? 'flex'  : 'none';
  _qs('#btn-export').style.display = mode === '2d' ? ''      : 'none';
  _qs('#budget-hud').style.display = mode === '2d' ? ''      : 'none';

  if (mode === '3d') {
    if (!viewer) viewer = new Viewer3D(_qs('#view-3d'), state);
    else viewer.refresh();
    viewer.focusOnLayout();
  }
}

// ── Tool ───────────────────────────────────────────────────────────────────
function _setTool(tool) {
  state.tool = tool;
  state.pendingAdd = null;
  document.querySelectorAll('.pal-item').forEach(el => el.classList.remove('active'));
  _updateToolUI();
}

function _updateToolUI() {
  for (const t of ['room','wall','select','eraser'])
    _qs(`#btn-${t}`)?.classList.toggle('active', state.tool === t);

  const msgs = {
    room:   'Draw Room: drag on the canvas to create a room',
    wall:   'Wall: click to place first point, click again to extend',
    select: 'Select: tap furniture or rooms · drag to move · yellow handle to rotate',
    eraser: 'Erase: tap any wall, room, or furniture to remove it',
    add:    'Tap the floor plan to place · Esc to cancel',
  };
  _qs('#status-text').textContent = msgs[state.tool] || '';
}

// ── Palette ────────────────────────────────────────────────────────────────
function _buildPalette() {
  const container = _qs('#furniture-palette');
  const cats = [...new Set(FURNITURE_CATALOG.map(f => f.category))];
  cats.forEach(cat => {
    const sec = document.createElement('div');
    sec.className = 'pal-cat'; sec.dataset.cat = cat;
    const hdr = document.createElement('div');
    hdr.className = 'pal-cat-hdr'; hdr.textContent = cat;
    sec.appendChild(hdr);
    FURNITURE_CATALOG.filter(f => f.category === cat).forEach(item => {
      const el = document.createElement('div');
      el.className = 'pal-item'; el.dataset.type = item.type;
      el.innerHTML = `
        <div class="pal-swatch" style="background:${item.color}"></div>
        <div class="pal-info">
          <div class="pal-name">${item.label}</div>
          <div class="pal-dims">${item.width} × ${item.depth} ft</div>
        </div>
        <div class="pal-price">$${item.price.toLocaleString()}</div>`;
      el.addEventListener('click', () => _pickFurniture(item.type, el));
      sec.appendChild(el);
    });
    container.appendChild(sec);
  });
}

function _pickFurniture(type, el) {
  state.tool = 'add'; state.pendingAdd = type; state.selectedId = null;
  document.querySelectorAll('.pal-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  _updateToolUI();
  sounds.select();
}

function _filterPalette(q) {
  q = q.toLowerCase();
  document.querySelectorAll('.pal-item').forEach(el => {
    el.style.display = !q || el.querySelector('.pal-name').textContent.toLowerCase().includes(q) ? '' : 'none';
  });
  document.querySelectorAll('.pal-cat').forEach(sec => {
    sec.style.display = [...sec.querySelectorAll('.pal-item')].some(el => el.style.display !== 'none') ? '' : 'none';
  });
}

function _toggleSidebar() {
  const sb = _qs('#sidebar');
  if (window.innerWidth <= 520) sb.classList.toggle('open');
  else sb.classList.toggle('collapsed');
}

// ── Persistence ────────────────────────────────────────────────────────────
function _saveStorage() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ rooms: state.rooms, walls: state.walls, furniture: state.furniture })); } catch (_) {}
}

function _loadStorage() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (d) { state.rooms = d.rooms||[]; state.walls = d.walls||[]; state.furniture = d.furniture||[]; }
  } catch (_) {}
}

function _saveFile() {
  const blob = new Blob([JSON.stringify({ rooms: state.rooms, walls: state.walls, furniture: state.furniture }, null, 2)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href:url, download:`apartment-${new Date().toISOString().slice(0,10)}.json` }).click();
  URL.revokeObjectURL(url);
  _toast('💾', 'Saved to file!');
}

function _loadFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const fr = new FileReader();
  fr.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      state.rooms=d.rooms||[]; state.walls=d.walls||[]; state.furniture=d.furniture||[]; state.selectedId=null;
      editor?.render(); viewer?.refresh(); _saveStorage(); _updateBudget(); _snapshot();
      _toast('📂','Layout loaded!');
    } catch(_){ _toast('❌','Could not load file'); }
  };
  fr.readAsText(file);
  e.target.value = '';
}

function _clearAll() {
  if (!confirm('Clear everything and start fresh?')) return;
  state.rooms=[]; state.walls=[]; state.furniture=[]; state.selectedId=null;
  editor?.render(); viewer?.refresh(); _saveStorage(); _updateBudget();
  hist.stack=[]; hist.cursor=-1; _snapshot(); _updateUndoButtons();
  _toast('🗑', 'Canvas cleared');
}

function _exportPNG() {
  _qs('#canvas-2d').toBlob(blob => {
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href:url, download:`floor-plan-${new Date().toISOString().slice(0,10)}.png` }).click();
    URL.revokeObjectURL(url);
  });
}
