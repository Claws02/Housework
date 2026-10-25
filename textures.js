// Procedural canvas textures. Every texture is tiled in world units (feet):
// geometry UVs are written in feet, and `tile` says how many feet one image covers.
import * as THREE from 'three';

const _cache = new Map();

function rnd(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = v => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

function noise(ctx, S, amt, r, alpha = 1) {
  const img = ctx.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amt * alpha;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// ── Drawers: (ctx, S, color, r) ──────────────────────────────────────────────
const DRAW = {
  paint(ctx, S, c, r) { ctx.fillStyle = c; ctx.fillRect(0, 0, S, S); noise(ctx, S, 6, r); },

  oak(ctx, S, c, r) {
    // 6 planks across, staggered butt joints
    const n = 6, pw = S / n;
    for (let i = 0; i < n; i++) {
      const x = i * pw;
      const joint = r() * S;
      for (const [y0, y1] of [[0, joint], [joint, S]]) {
        ctx.fillStyle = shade(c, 0.9 + r() * 0.2);
        ctx.fillRect(x, y0, pw, y1 - y0);
        for (let g = 0; g < 14; g++) {
          ctx.strokeStyle = `rgba(80,50,20,${0.04 + r() * 0.08})`;
          ctx.lineWidth = 0.6 + r() * 1.2;
          const gx = x + r() * pw;
          ctx.beginPath(); ctx.moveTo(gx, y0);
          ctx.bezierCurveTo(gx + (r() - .5) * 8, y0 + (y1 - y0) * .33, gx + (r() - .5) * 8, y0 + (y1 - y0) * .66, gx + (r() - .5) * 4, y1);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(40,25,10,0.35)'; ctx.fillRect(x, y0, pw, 1.5);
      }
      ctx.fillStyle = 'rgba(40,25,10,0.35)'; ctx.fillRect(x, 0, 1.5, S);
    }
    noise(ctx, S, 10, r);
  },

  tile(ctx, S, c, r) {          // 4×4 large-format tiles with grout
    const n = 4, t = S / n;
    ctx.fillStyle = shade(c, 0.75); ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = shade(c, 0.92 + r() * 0.14);
      ctx.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
      for (let k = 0; k < 6; k++) {   // stone-look veining
        ctx.strokeStyle = `rgba(255,255,255,${r() * 0.08})`;
        ctx.beginPath(); ctx.moveTo(i * t + r() * t, j * t); ctx.lineTo(i * t + r() * t, j * t + t); ctx.stroke();
      }
    }
    noise(ctx, S, 12, r);
  },

  mosaic(ctx, S, c, r) {        // small 2" penny/square mosaic (shower floors)
    const n = 16, t = S / n;
    ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = shade(c, 0.8 + r() * 0.3);
      ctx.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
    }
  },

  subway(ctx, S, c, r) {        // 3×6 subway tile, running bond
    const rows = 16, th = S / rows, tw = th * 2;
    ctx.fillStyle = '#cfcac2'; ctx.fillRect(0, 0, S, S);
    for (let j = 0; j < rows; j++) {
      const off = j % 2 ? tw / 2 : 0;
      for (let x = -tw; x < S + tw; x += tw) {
        const g = ctx.createLinearGradient(0, j * th, 0, j * th + th);
        g.addColorStop(0, shade(c, 1.04)); g.addColorStop(1, shade(c, 0.93));
        ctx.fillStyle = g;
        ctx.fillRect(x + off + 1.5, j * th + 1.5, tw - 3, th - 3);
      }
    }
  },

  carpet(ctx, S, c, r) { ctx.fillStyle = c; ctx.fillRect(0, 0, S, S); noise(ctx, S, 40, r); noise(ctx, S, 20, r); },

  concrete(ctx, S, c, r) {
    ctx.fillStyle = c; ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 120; k++) {
      ctx.fillStyle = `rgba(${r() < .5 ? '0,0,0' : '255,255,255'},${r() * 0.05})`;
      ctx.beginPath(); ctx.arc(r() * S, r() * S, 4 + r() * 40, 0, 6.28); ctx.fill();
    }
    noise(ctx, S, 22, r);
  },

  deck(ctx, S, c, r) {          // 5.5" boards running along u
    const n = 8, bh = S / n;
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = shade(c, 0.85 + r() * 0.25);
      ctx.fillRect(0, j * bh, S, bh);
      for (let g = 0; g < 8; g++) {
        ctx.strokeStyle = `rgba(0,0,0,${r() * 0.08})`;
        const gy = j * bh + r() * bh;
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(S, gy + (r() - .5) * 6); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, j * bh, S, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(r() * S, j * bh, 2, bh);
    }
    noise(ctx, S, 14, r);
  },

  grass(ctx, S, c, r) {
    ctx.fillStyle = c; ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 9000; k++) {
      ctx.fillStyle = shade(c, 0.7 + r() * 0.6);
      ctx.fillRect(r() * S, r() * S, 1.5, 3 + r() * 4);
    }
    // faint mowing stripes
    for (let x = 0; x < S; x += S / 4) { ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(x, 0, S / 8, S); }
  },

  asphalt(ctx, S, c, r) { ctx.fillStyle = c; ctx.fillRect(0, 0, S, S); noise(ctx, S, 50, r); },

  gravel(ctx, S, c, r) {
    ctx.fillStyle = c; ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 2500; k++) {
      ctx.fillStyle = shade(c, 0.6 + r() * 0.8);
      ctx.beginPath(); ctx.arc(r() * S, r() * S, 1 + r() * 3, 0, 6.28); ctx.fill();
    }
  },

  siding(ctx, S, c, r) {        // clapboard, 4" exposure: 12 courses per 4 ft tile, v = up
    const n = 12, h = S / n;
    for (let j = 0; j < n; j++) {
      const g = ctx.createLinearGradient(0, j * h, 0, j * h + h);
      g.addColorStop(0, shade(c, 0.82)); g.addColorStop(0.15, shade(c, 1.02)); g.addColorStop(1, shade(c, 0.94));
      ctx.fillStyle = g; ctx.fillRect(0, j * h, S, h);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, j * h, S, 2);
    }
    noise(ctx, S, 6, r);
  },

  shingle(ctx, S, c, r) {       // architectural asphalt roof shingles
    const n = 10, h = S / n;
    ctx.fillStyle = shade(c, 0.6); ctx.fillRect(0, 0, S, S);
    for (let j = 0; j < n; j++) {
      let x = -(r() * 40);
      while (x < S) {
        const w = 20 + r() * 40;
        ctx.fillStyle = shade(c, 0.75 + r() * 0.45);
        ctx.fillRect(x, j * h + 2, w - 2, h - 2);
        x += w;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, j * h, S, 2);
    }
    noise(ctx, S, 30, r);
  },

  brick(ctx, S, c, r) {
    const rows = 12, bh = S / rows, bw = bh * 2.6;
    ctx.fillStyle = '#b8b0a4'; ctx.fillRect(0, 0, S, S);
    for (let j = 0; j < rows; j++) {
      const off = j % 2 ? bw / 2 : 0;
      for (let x = -bw; x < S + bw; x += bw) {
        ctx.fillStyle = shade(c, 0.75 + r() * 0.4);
        ctx.fillRect(x + off + 2, j * bh + 2, bw - 4, bh - 4);
      }
    }
    noise(ctx, S, 25, r);
  },

  stone(ctx, S, c, r) {         // stacked ledgestone (fireplace surround)
    let y = 0;
    ctx.fillStyle = '#2b2622'; ctx.fillRect(0, 0, S, S);
    while (y < S) {
      const h = 10 + r() * 22;
      let x = -r() * 60;
      while (x < S) {
        const w = 30 + r() * 110;
        ctx.fillStyle = shade(c, 0.55 + r() * 0.75);
        ctx.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + 1.5, y + 1.5, w - 3, 2);
        x += w;
      }
      y += h;
    }
    noise(ctx, S, 20, r);
  },

  beadboard(ctx, S, c, r) {     // vertical bead board, 4" boards
    ctx.fillStyle = c; ctx.fillRect(0, 0, S, S);
    const n = 12, w = S / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(i * w, 0, 2, S);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(i * w + 2, 0, 1.5, S);
    }
  },

  framing(ctx, S, c, r) {       // exposed studs over sheathing (garage), 16" o.c. → 3 per 4ft
    DRAW.plywood(ctx, S, shade(c, 0.92), r);
    for (let i = 0; i < 3; i++) {
      const x = i * S / 3 + 6;
      const g = ctx.createLinearGradient(x, 0, x + 18, 0);
      g.addColorStop(0, shade(c, 0.8)); g.addColorStop(0.5, shade(c, 1.12)); g.addColorStop(1, shade(c, 0.75));
      ctx.fillStyle = g; ctx.fillRect(x, 0, 18, S);
    }
  },

  plywood(ctx, S, c, r) {
    ctx.fillStyle = c; ctx.fillRect(0, 0, S, S);
    for (let g = 0; g < 50; g++) {
      ctx.strokeStyle = `rgba(90,50,20,${r() * 0.12})`; ctx.lineWidth = 1 + r() * 3;
      const y = r() * S;
      ctx.beginPath(); ctx.moveTo(0, y);
      ctx.bezierCurveTo(S * .3, y + (r() - .5) * 30, S * .6, y + (r() - .5) * 30, S, y + (r() - .5) * 10); ctx.stroke();
    }
    noise(ctx, S, 12, r);
  },

  wood(ctx, S, c, r) {          // furniture wood grain (runs along u)
    ctx.fillStyle = c; ctx.fillRect(0, 0, S, S);
    for (let g = 0; g < 70; g++) {
      ctx.strokeStyle = `rgba(30,15,5,${0.03 + r() * 0.1})`; ctx.lineWidth = 0.5 + r() * 2;
      const y = r() * S;
      ctx.beginPath(); ctx.moveTo(0, y);
      ctx.bezierCurveTo(S * .3, y + (r() - .5) * 14, S * .6, y + (r() - .5) * 14, S, y + (r() - .5) * 6); ctx.stroke();
    }
    noise(ctx, S, 8, r);
  },

  fabric(ctx, S, c, r) {        // woven upholstery
    ctx.fillStyle = c; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < S; i += 4) {
      ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(i, 0, 2, S);
      ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, i, S, 2);
    }
    noise(ctx, S, 16, r);
  },

  stripes(ctx, S, c, r) {       // striped bedding (photos: blue & white duvet)
    const n = 8, h = S / n;
    for (let j = 0; j < n; j++) { ctx.fillStyle = j % 2 ? '#f4f4f0' : c; ctx.fillRect(0, j * h, S, h); }
    DRAW._overlay(ctx, S, r);
  },

  floral(ctx, S, c, r) {        // floral print quilt
    ctx.fillStyle = '#f1eee6'; ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 160; k++) {
      ctx.fillStyle = r() < 0.5 ? c : shade(c, 0.6);
      ctx.save(); ctx.translate(r() * S, r() * S); ctx.rotate(r() * 6.28);
      ctx.beginPath(); ctx.ellipse(0, 0, 10 + r() * 10, 3 + r() * 3, 0, 0, 6.28); ctx.fill(); ctx.restore();
    }
    DRAW._overlay(ctx, S, r);
  },

  rug(ctx, S, c, r) {           // bordered oriental-ish area rug
    ctx.fillStyle = c; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = shade(c, 0.55); ctx.lineWidth = S * 0.04; ctx.strokeRect(S * .05, S * .05, S * .9, S * .9);
    ctx.strokeStyle = shade(c, 1.35); ctx.lineWidth = S * 0.012; ctx.strokeRect(S * .12, S * .12, S * .76, S * .76);
    for (let k = 0; k < 40; k++) {
      ctx.fillStyle = r() < .5 ? shade(c, 0.7) : shade(c, 1.3);
      ctx.beginPath(); ctx.arc(S * .2 + r() * S * .6, S * .2 + r() * S * .6, 4 + r() * 14, 0, 6.28); ctx.fill();
    }
    ctx.fillStyle = shade(c, 1.4);
    ctx.beginPath(); ctx.ellipse(S / 2, S / 2, S * .18, S * .12, 0, 0, 6.28); ctx.fill();
    noise(ctx, S, 30, r);
  },

  leather(ctx, S, c, r) { ctx.fillStyle = c; ctx.fillRect(0, 0, S, S); noise(ctx, S, 18, r); },

  _overlay(ctx, S, r) { noise(ctx, S, 10, r); },
};

// ── Finish catalogs (shown in the properties panel) ─────────────────────────
// tile: feet covered by one texture image.  rough/metal: PBR params.
export const WALL_FINISHES = {
  paint:     { label: 'Painted drywall',  tex: 'paint',     tile: 4,  rough: 0.92 },
  siding:    { label: 'Clapboard siding', tex: 'siding',    tile: 4,  rough: 0.8  },
  brick:     { label: 'Brick',            tex: 'brick',     tile: 4,  rough: 0.95 },
  stone:     { label: 'Stacked stone',    tex: 'stone',     tile: 4,  rough: 0.95 },
  subway:    { label: 'Subway tile',      tex: 'subway',    tile: 4,  rough: 0.25 },
  tile:      { label: 'Large tile',       tex: 'tile',      tile: 6,  rough: 0.35 },
  beadboard: { label: 'Bead board',       tex: 'beadboard', tile: 4,  rough: 0.7  },
  concrete:  { label: 'Concrete',         tex: 'concrete',  tile: 8,  rough: 1.0  },
  framing:   { label: 'Exposed framing',  tex: 'framing',   tile: 4,  rough: 0.9  },
  plywood:   { label: 'Plywood',          tex: 'plywood',   tile: 4,  rough: 0.9  },
};

export const FLOOR_FINISHES = {
  oak:      { label: 'Oak hardwood',   tex: 'oak',      tile: 6,  rough: 0.55, color: '#c9a77c' },
  tile:     { label: 'Porcelain tile', tex: 'tile',     tile: 6,  rough: 0.4,  color: '#8d8c88' },
  mosaic:   { label: 'Mosaic tile',    tex: 'mosaic',   tile: 2,  rough: 0.4,  color: '#6f7377' },
  carpet:   { label: 'Carpet',         tex: 'carpet',   tile: 3,  rough: 1.0,  color: '#a39a8c' },
  concrete: { label: 'Concrete',       tex: 'concrete', tile: 10, rough: 0.95, color: '#a7a49e' },
  deck:     { label: 'Deck boards',    tex: 'deck',     tile: 4,  rough: 0.9,  color: '#9c8f7e' },
  grass:    { label: 'Grass',          tex: 'grass',    tile: 8,  rough: 1.0,  color: '#5f8f3a' },
  asphalt:  { label: 'Asphalt',        tex: 'asphalt',  tile: 6,  rough: 1.0,  color: '#4a4a4c' },
  gravel:   { label: 'Gravel',         tex: 'gravel',   tile: 4,  rough: 1.0,  color: '#9a948a' },
  stone:    { label: 'Flagstone',      tex: 'tile',     tile: 4,  rough: 0.9,  color: '#8b8378' },
};

export const ROOF_FINISHES = {
  shingle: { label: 'Asphalt shingles', tex: 'shingle', tile: 6, rough: 0.95 },
  metal:   { label: 'Standing seam',    tex: 'beadboard', tile: 3, rough: 0.35, metal: 0.6 },
};

// ── Texture & material factories ────────────────────────────────────────────
export function texture(name, color = '#cccccc', tile = 4, size = 512) {
  const key = `${name}|${color}|${tile}|${size}`;
  if (_cache.has(key)) return _cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  (DRAW[name] || DRAW.paint)(ctx, size, color, rnd(h));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / tile, 1 / tile);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  _cache.set(key, tex);
  return tex;
}

const _matCache = new Map();

/** Material for a finish entry from one of the catalogs above. */
export function finishMaterial(finish, color, opts = {}) {
  const key = `${finish.tex}|${color}|${finish.tile}|${opts.side ?? ''}|${opts.transparent ?? ''}`;
  if (_matCache.has(key)) return _matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    map: texture(finish.tex, color, finish.tile),
    roughness: finish.rough ?? 0.8,
    metalness: finish.metal ?? 0,
    side: opts.side ?? THREE.FrontSide,
  });
  _matCache.set(key, m);
  return m;
}

/** Free-form material helper for furniture: kind = texture drawer name or 'plain'. */
export function mat(kind, color, extra = {}) {
  const key = `${kind}|${color}|${JSON.stringify(extra)}`;
  if (_matCache.has(key)) return _matCache.get(key);
  const p = { color: kind === 'plain' ? color : '#ffffff', roughness: 0.7, metalness: 0, ...extra };
  if (kind !== 'plain') p.map = texture(kind, color, extra.tile ?? 1, 256);
  delete p.tile;
  const m = new THREE.MeshStandardMaterial(p);
  _matCache.set(key, m);
  return m;
}
