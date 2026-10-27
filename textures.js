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

  cedar(ctx, S, c, r) {         // weathered cedar shake siding: staggered shingles, 5" exposure
    const n = 8, h = S / n;
    ctx.fillStyle = shade(c, 0.55); ctx.fillRect(0, 0, S, S);
    for (let j = 0; j < n; j++) {
      let x = -(r() * 30);
      while (x < S) {
        const w = 18 + r() * 34, f = 0.88 + r() * 0.22;
        const g = ctx.createLinearGradient(0, j * h, 0, j * h + h);
        g.addColorStop(0, shade(c, f * 0.86)); g.addColorStop(0.25, shade(c, f)); g.addColorStop(1, shade(c, f * 0.93));
        ctx.fillStyle = g; ctx.fillRect(x + 1, j * h + 3, w - 2, h - 3);
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        for (let k = 0; k < 3; k++) ctx.fillRect(x + 3 + r() * (w - 6), j * h + 4, 1, h - 6);   // grain
        x += w;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, j * h, S, 3);
    }
    noise(ctx, S, 5, r);
  },

  water(ctx, S, c, r) {         // open water seen from a distance: soft ripples
    ctx.fillStyle = c; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) {
      const x = r() * S, y = r() * S, w = 10 + r() * 40;
      ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,20,40,0.12)';
      ctx.fillRect(x, y, w, 2);
      if (x + w > S) ctx.fillRect(x - S, y, w, 2);
    }
    noise(ctx, S, 6, r);
  },

  solar(ctx, S, c, r) {         // one 60-cell module: dark cells, silver busbars, white gaps
    ctx.fillStyle = '#d9dde2'; ctx.fillRect(0, 0, S, S);
    const cols = 6, rows = 10, m = S * 0.02, cw = (S - 2 * m) / cols, ch = (S - 2 * m) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      ctx.fillStyle = shade(c, 0.85 + r() * 0.2);
      ctx.fillRect(m + i * cw + 1.5, m + j * ch + 1.5, cw - 3, ch - 3);
      ctx.fillStyle = 'rgba(200,210,225,0.35)';
      for (let b = 1; b < 3; b++) ctx.fillRect(m + i * cw + 1.5, m + j * ch + b * ch / 3, cw - 3, 1);
    }
    ctx.strokeStyle = '#9aa1a8'; ctx.lineWidth = m; ctx.strokeRect(m / 2, m / 2, S - m, S - m);
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

  quartz(ctx, S, c, r) {        // white quartz / marble-look with soft gray veining
    ctx.fillStyle = c; ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 60; k++) {           // cloudy base
      ctx.fillStyle = `rgba(${r() < 0.5 ? '120,120,125' : '255,255,255'},${r() * 0.05})`;
      ctx.beginPath(); ctx.arc(r() * S, r() * S, 20 + r() * 90, 0, 6.28); ctx.fill();
    }
    for (let v = 0; v < 7; v++) {            // wandering veins, drawn on all 4 wraps so the tile repeats
      const pts = []; let x = r() * S, y = -20, a = 0.3 + r() * 0.9;
      while (y < S + 20) { pts.push([x, y]); a += (r() - 0.5) * 0.5; x += Math.cos(a) * 12; y += Math.abs(Math.sin(a)) * 12 + 4; }
      const wdt = 0.6 + r() * 2.2, al = 0.12 + r() * 0.22;
      for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0]]) {
        ctx.strokeStyle = `rgba(110,112,118,${al})`; ctx.lineWidth = wdt;
        ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px + ox, py + oy) : ctx.moveTo(px + ox, py + oy)); ctx.stroke();
        ctx.strokeStyle = `rgba(150,152,158,${al * 0.35})`; ctx.lineWidth = wdt * 5;
        ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px + ox, py + oy) : ctx.moveTo(px + ox, py + oy)); ctx.stroke();
      }
    }
    noise(ctx, S, 6, r);
  },

  brushed(ctx, S, c, r) {       // brushed stainless: fine horizontal streaks
    ctx.fillStyle = c; ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 900; k++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.022})`;
      ctx.fillRect(0, r() * S, S, 0.5 + r() * 0.8);
    }
    noise(ctx, S, 3, r);
  },

  leafprint(ctx, S, c, r) {     // white cotton with trailing blue leaves (living room curtains)
    ctx.fillStyle = '#f3f1ea'; ctx.fillRect(0, 0, S, S);
    for (let v = 0; v < 6; v++) {
      const x0 = (v + 0.3 * r()) * S / 6;
      ctx.strokeStyle = shade(c, 0.8); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.bezierCurveTo(x0 + 30, S * 0.3, x0 - 30, S * 0.7, x0, S); ctx.stroke();
      for (let y = 10; y < S; y += 26 + r() * 10) {
        const t = y / S, cx = x0 + Math.sin(t * Math.PI * 2) * 12, side = (y / 26 | 0) % 2 ? 1 : -1;
        ctx.save(); ctx.translate(cx, y); ctx.rotate(side * (0.7 + r() * 0.4));
        ctx.fillStyle = r() < 0.65 ? c : shade(c, 1.35);
        ctx.beginPath(); ctx.ellipse(side * 16, 0, 15, 6, 0, 0, 6.28); ctx.fill(); ctx.restore();
      }
    }
    noise(ctx, S, 8, r);
  },

  damask(ctx, S, c, r) {        // patterned throw-pillow fabric: medallions on a light ground
    ctx.fillStyle = shade(c, 1.55); ctx.fillRect(0, 0, S, S);
    const n = 4, t = S / n;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const x = i * t + (j % 2) * t / 2, y = j * t;
      ctx.fillStyle = c;
      for (let p = 0; p < 6; p++) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(p * Math.PI / 3);
        ctx.beginPath(); ctx.ellipse(0, t * 0.18, t * 0.07, t * 0.17, 0, 0, 6.28); ctx.fill(); ctx.restore();
      }
      ctx.fillStyle = shade(c, 0.7); ctx.beginPath(); ctx.arc(x, y, t * 0.06, 0, 6.28); ctx.fill();
    }
    DRAW.fabric(ctx, S, 'rgba(0,0,0,0)', r);
  },

  knit(ctx, S, c, r) {          // chunky cable knit (throws, poufs)
    ctx.fillStyle = shade(c, 0.85); ctx.fillRect(0, 0, S, S);
    const cols = 8, rows = 16, cw = S / cols, rh = S / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      for (const sd of [-1, 1]) {
        const g = ctx.createLinearGradient(0, j * rh, 0, j * rh + rh);
        g.addColorStop(0, shade(c, 1.12)); g.addColorStop(1, shade(c, 0.88));
        ctx.fillStyle = g;
        ctx.save(); ctx.translate(i * cw + cw / 2 + sd * cw * 0.2, j * rh + rh / 2); ctx.rotate(sd * 0.5);
        ctx.beginPath(); ctx.ellipse(0, 0, cw * 0.2, rh * 0.62, 0, 0, 6.28); ctx.fill(); ctx.restore();
      }
    }
    noise(ctx, S, 10, r);
  },

  wicker(ctx, S, c, r) {        // basket weave
    ctx.fillStyle = shade(c, 0.6); ctx.fillRect(0, 0, S, S);
    const n = 16, t = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const hz = (i + j) % 2;
      ctx.fillStyle = shade(c, 0.85 + r() * 0.3);
      if (hz) ctx.fillRect(i * t + 1, j * t + t * 0.2, t - 2, t * 0.6); else ctx.fillRect(i * t + t * 0.2, j * t + 1, t * 0.6, t - 2);
    }
    noise(ctx, S, 14, r);
  },

  butcher(ctx, S, c, r) {       // edge-grain butcher block: narrow staves of varying tone
    let x = 0;
    while (x < S) {
      const w = 18 + r() * 22;
      ctx.fillStyle = shade(c, 0.86 + r() * 0.26); ctx.fillRect(x, 0, w, S);
      for (let g = 0; g < 5; g++) { ctx.fillStyle = `rgba(80,45,15,${r() * 0.08})`; ctx.fillRect(x + r() * w, 0, 1 + r() * 2, S); }
      ctx.fillStyle = 'rgba(60,35,10,0.18)'; ctx.fillRect(x, 0, 1, S);
      x += w;
    }
    noise(ctx, S, 8, r);
  },
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
  cedar:     { label: 'Cedar shingles',   tex: 'cedar',     tile: 3.3, rough: 0.9 },
};

export const FLOOR_FINISHES = {
  oak:      { label: 'Oak hardwood',   tex: 'oak',      tile: 3.5, tileV: 8, rough: 0.55, color: '#c9a77c' },   // 6 boards × 7" wide, ~4–8' long
  tile:     { label: 'Porcelain tile', tex: 'tile',     tile: 6,  rough: 0.4,  color: '#8d8c88' },
  mosaic:   { label: 'Mosaic tile',    tex: 'mosaic',   tile: 2,  rough: 0.4,  color: '#6f7377' },
  carpet:   { label: 'Carpet',         tex: 'carpet',   tile: 3,  rough: 1.0,  color: '#a39a8c' },
  concrete: { label: 'Concrete',       tex: 'concrete', tile: 10, rough: 0.95, color: '#a7a49e' },
  deck:     { label: 'Deck boards',    tex: 'deck',     tile: 4,  rough: 0.9,  color: '#9c8f7e' },
  grass:    { label: 'Grass',          tex: 'grass',    tile: 8,  rough: 1.0,  color: '#5f8f3a' },
  asphalt:  { label: 'Asphalt',        tex: 'asphalt',  tile: 6,  rough: 1.0,  color: '#4a4a4c' },
  gravel:   { label: 'Gravel',         tex: 'gravel',   tile: 4,  rough: 1.0,  color: '#9a948a' },
  stone:    { label: 'Flagstone',      tex: 'tile',     tile: 4,  rough: 0.9,  color: '#8b8378' },
  rubber:   { label: 'Rubber gym floor', tex: 'concrete', tile: 4, rough: 0.9, color: '#3a3b3d' },
  sand:     { label: 'Sand',           tex: 'gravel',   tile: 2,  rough: 1.0,  color: '#d8c8a2' },
  water:    { label: 'Water',          tex: 'water',    tile: 30, rough: 0.12, color: '#3f6e86' },
};

export const ROOF_FINISHES = {
  shingle: { label: 'Asphalt shingles', tex: 'shingle', tile: 6, rough: 0.95 },
  metal:   { label: 'Standing seam',    tex: 'beadboard', tile: 3, rough: 0.35, metal: 0.6 },
};

// ── Texture & material factories ────────────────────────────────────────────
export function texture(name, color = '#cccccc', tile = 4, size = 512, tileV = tile) {
  const key = `${name}|${color}|${tile}|${size}|${tileV}`;
  if (_cache.has(key)) return _cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  (DRAW[name] || DRAW.paint)(ctx, size, color, rnd(h));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / tile, 1 / tileV);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  _cache.set(key, tex);
  return tex;
}

// How strongly each texture's light/dark detail reads as surface relief (0 = flat).
const BUMP = { oak: 1.6, tile: 2.4, mosaic: 2, subway: 2.2, carpet: 1.4, concrete: 0.9, deck: 3, grass: 1.2, asphalt: 1.2,
  gravel: 3, siding: 5, shingle: 4, brick: 4.5, stone: 6, beadboard: 3, framing: 3.5, plywood: 0.8, wood: 0.9, fabric: 0.6,
  leather: 1.2, paint: 0.35, rug: 1, stripes: 0.4, floral: 0.4,
  cedar: 2.2, water: 0.3, solar: 0.3, quartz: 0.25, brushed: 0.08, leafprint: 0.35, damask: 0.8, knit: 4, wicker: 4, butcher: 0.9 };

/** Tangent-space normal map derived from the colour texture's luminance (Sobel, wraps at the edges). */
export function normalMap(name, color = '#cccccc', tile = 4, size = 512, tileV = tile) {
  const strength = BUMP[name] ?? 0;
  if (!strength) return null;
  const key = `n|${name}|${color}|${tile}|${size}|${tileV}`;
  if (_cache.has(key)) return _cache.get(key);
  const src = texture(name, color, tile, size, tileV).image;
  const S = src.width, d = src.getContext('2d').getImageData(0, 0, S, S).data;
  const lum = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) lum[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'), out = ctx.createImageData(S, S), o = out.data;
  const at = (x, y) => lum[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * S + x) * 4;
    o[i] = (nx * 0.5 + 0.5) * 255; o[i + 1] = (ny * 0.5 + 0.5) * 255; o[i + 2] = (nz * 0.5 + 0.5) * 255; o[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / tile, 1 / tileV);
  tex.anisotropy = 4;
  _cache.set(key, tex);
  return tex;
}

const _matCache = new Map();

/** Material for a finish entry from one of the catalogs above. */
export function finishMaterial(finish, color, opts = {}) {
  const key = `${finish.tex}|${color}|${finish.tile}|${finish.tileV ?? ''}|${opts.side ?? ''}|${opts.transparent ?? ''}`;
  if (_matCache.has(key)) return _matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    map: texture(finish.tex, color, finish.tile, 512, finish.tileV ?? finish.tile),
    normalMap: normalMap(finish.tex, color, finish.tile, 512, finish.tileV ?? finish.tile),
    roughness: finish.rough ?? 0.8,
    metalness: finish.metal ?? 0,
    side: opts.side ?? THREE.FrontSide,
  });
  _matCache.set(key, m);
  return m;
}

const MODEL_TILE = { quartz: 4, brushed: 2, leafprint: 2.5, damask: 1.2, knit: 1.2, wicker: 0.8, butcher: 3, wood: 3, fabric: 1.5, leather: 2.5, concrete: 4, stone: 4, brick: 4, subway: 4, mosaic: 2, siding: 4,
  shingle: 6, deck: 4, plywood: 4, beadboard: 4, stripes: 3, floral: 3, rug: 1, carpet: 3, tile: 4 };

/** Free-form material helper for furniture: kind = texture drawer name or 'plain'. */
export function mat(kind, color, extra = {}) {
  const key = `${kind}|${color}|${JSON.stringify(extra)}`;
  if (_matCache.has(key)) return _matCache.get(key);
  const p = { color: kind === 'plain' ? color : '#ffffff', roughness: 0.7, metalness: 0, ...extra };
  if (kind !== 'plain') {
    // model UVs are in feet on box-shaped parts; tile = feet per texture repeat
    const tile = extra.tile ?? MODEL_TILE[kind] ?? 2, tileV = extra.tileV ?? tile;
    p.map = texture(kind, color, tile, 256, tileV);
    const nm = normalMap(kind, color, tile, 256, tileV);
    if (nm) { p.normalMap = nm; p.normalScale = new THREE.Vector2(0.6, 0.6); }
  }
  delete p.tile; delete p.tileV;
  const m = new THREE.MeshStandardMaterial(p);
  _matCache.set(key, m);
  return m;
}
