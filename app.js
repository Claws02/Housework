import { Editor2D } from './editor2d.js';
import { Viewer3D } from './viewer3d.js';
import { FURNITURE_CATALOG } from './furniture.js';

const STORAGE_KEY = 'apt-designer-v1';

const state = {
  walls: [],
  furniture: [],
  tool: 'select',
  pendingAdd: null,
  selectedId: null,
  mode: '2d',
};

let editor = null;
let viewer = null;

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  _loadFromStorage();
  _buildPalette();
  _bindUI();
  _initEditor();
  _updateToolUI();
});

// ---- UI wiring ----
function _bindUI() {
  _on('btn-mode-2d', 'click', () => _setMode('2d'));
  _on('btn-mode-3d', 'click', () => _setMode('3d'));
  _on('btn-select',  'click', () => _setTool('select'));
  _on('btn-wall',    'click', () => _setTool('wall'));
  _on('btn-eraser',  'click', () => _setTool('eraser'));
  _on('btn-save',    'click', _saveToFile);
  _on('btn-load',    'click', () => _qs('#file-input').click());
  _on('btn-clear',   'click', _clearAll);
  _on('btn-export',  'click', _exportImage);
  _on('file-input',  'change', _loadFromFile);
  _on('btn-sidebar-toggle', 'click', _toggleSidebar);
  _on('palette-search', 'input', e => _filterPalette(e.target.value));
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); _saveToStorage(); _showStatus('Saved ✓'); }
  });
}

function _on(id, ev, fn) { _qs(`#${id}`)?.addEventListener(ev, fn); }
function _qs(sel)         { return document.querySelector(sel); }

// ---- Mode ----
function _setMode(mode) {
  state.mode = mode;
  _qs('#btn-mode-2d').classList.toggle('active', mode === '2d');
  _qs('#btn-mode-3d').classList.toggle('active', mode === '3d');
  _qs('#canvas-2d').style.display    = mode === '2d' ? 'block' : 'none';
  _qs('#view-3d').style.display      = mode === '3d' ? 'block' : 'none';
  _qs('#tools-2d').style.display     = mode === '2d' ? 'flex'  : 'none';
  _qs('#btn-export').style.display   = mode === '2d' ? ''      : 'none';

  if (mode === '3d') {
    if (!viewer) {
      viewer = new Viewer3D(_qs('#view-3d'), state);
    } else {
      viewer.refresh();
    }
    viewer.focusOnLayout();
  }
}

// ---- Editor init ----
function _initEditor() {
  const canvas = _qs('#canvas-2d');
  editor = new Editor2D(canvas, state, {
    onUpdate() { _saveToStorage(); if (viewer && state.mode === '3d') viewer.refresh(); },
    onToolChange(t) { _setTool(t); },
    onZoom(z) { _qs('#zoom-label').textContent = `${z} px/ft`; },
  });
}

// ---- Tool ----
function _setTool(tool) {
  state.tool = tool;
  state.pendingAdd = null;
  document.querySelectorAll('.pal-item').forEach(el => el.classList.remove('active'));
  _updateToolUI();
}

function _updateToolUI() {
  for (const t of ['select', 'wall', 'eraser']) {
    _qs(`#btn-${t}`)?.classList.toggle('active', state.tool === t);
  }
  const msgs = {
    select: 'Click furniture to select · Drag to move · Yellow handle to rotate · Red ✕ to delete',
    wall:   'Click to place wall start · Click again to complete · Esc to cancel',
    eraser: 'Click a wall or piece of furniture to delete it',
    add:    'Click the floor plan to place · Esc to cancel',
  };
  _qs('#status-text').textContent = msgs[state.tool] || '';
}

// ---- Palette ----
function _buildPalette() {
  const container = _qs('#furniture-palette');
  const cats = [...new Set(FURNITURE_CATALOG.map(f => f.category))];
  cats.forEach(cat => {
    const section = document.createElement('div');
    section.className = 'pal-cat'; section.dataset.cat = cat;
    const hdr = document.createElement('div');
    hdr.className = 'pal-cat-hdr'; hdr.textContent = cat;
    section.appendChild(hdr);
    FURNITURE_CATALOG.filter(f => f.category === cat).forEach(item => {
      const el = document.createElement('div');
      el.className = 'pal-item'; el.dataset.type = item.type;
      el.innerHTML = `<span class="pal-icon">${item.icon}</span><span class="pal-label">${item.label}</span><span class="pal-sz">${item.width}×${item.depth}'</span>`;
      el.addEventListener('click', () => _pickFurniture(item.type, el));
      section.appendChild(el);
    });
    container.appendChild(section);
  });
}

function _pickFurniture(type, el) {
  state.tool = 'add'; state.pendingAdd = type; state.selectedId = null;
  document.querySelectorAll('.pal-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  _updateToolUI();
  _qs('#status-text').textContent = 'Click the floor plan to place · Esc to cancel';
}

function _filterPalette(q) {
  q = q.toLowerCase();
  document.querySelectorAll('.pal-item').forEach(el => {
    el.style.display = !q || el.querySelector('.pal-label').textContent.toLowerCase().includes(q) ? '' : 'none';
  });
  document.querySelectorAll('.pal-cat').forEach(sec => {
    sec.style.display = [...sec.querySelectorAll('.pal-item')].some(el => el.style.display !== 'none') ? '' : 'none';
  });
}

// ---- Sidebar ----
function _toggleSidebar() { _qs('#sidebar').classList.toggle('collapsed'); }

// ---- Persistence ----
function _saveToStorage() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ walls: state.walls, furniture: state.furniture })); } catch (_) {}
}

function _loadFromStorage() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (d) { state.walls = d.walls || []; state.furniture = d.furniture || []; }
  } catch (_) {}
}

function _saveToFile() {
  const blob = new Blob([JSON.stringify({ walls: state.walls, furniture: state.furniture }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `apartment-${new Date().toISOString().slice(0, 10)}.json` });
  a.click(); URL.revokeObjectURL(url);
}

function _loadFromFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      state.walls = d.walls || []; state.furniture = d.furniture || []; state.selectedId = null;
      editor?.render(); viewer?.refresh();
      _saveToStorage(); _showStatus('Loaded ✓');
    } catch (_) { _showStatus('Error loading file'); }
  };
  reader.readAsText(file); e.target.value = '';
}

function _clearAll() {
  if (!confirm('Clear all walls and furniture?')) return;
  state.walls = []; state.furniture = []; state.selectedId = null;
  editor?.render(); viewer?.refresh(); _saveToStorage();
}

function _exportImage() {
  if (state.mode !== '2d') return;
  _qs('#canvas-2d').toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `floor-plan-${new Date().toISOString().slice(0, 10)}.png` });
    a.click(); URL.revokeObjectURL(url);
  });
}

function _showStatus(msg) {
  const el = _qs('#status-text');
  const prev = el.textContent; el.textContent = msg;
  setTimeout(() => { el.textContent = prev; }, 2000);
}
