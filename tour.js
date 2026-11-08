// Listing tour: the view-only 3D home tour sent to realtors.
//   tour.html?l=<listing-id>          branded link (agent card, CLAWEngineering credit)
//   tour.html?l=<listing-id>&mls=1    unbranded link for the MLS (no agent, no credit unless creditOnMls)
// A listing lives in listings/<id>.json: the details shown on the card plus the house, either inline
// ("house": { floors, activeFloor, site }) or as a file saved from the designer ("houseFile": "<id>.house.json").
import * as THREE from 'three';
import { Viewer3D, LENSES } from './viewer3d.js';
import { TIMES, QUALITY } from './lighting.js';
import { PERSON_H } from './walker.js';
import { photoTexturesReady } from './textures.js';

const DEFAULT_LISTING = '191-webster';
const CREDIT = { name: 'CLAWEngineering', url: '' };   // set url to your site or a mailto: link once you have one
const PREF_KEY = 'tour-prefs';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const listingId = (params.get('l') || document.querySelector('meta[name="default-listing"]')?.content || DEFAULT_LISTING).replace(/[^a-z0-9_-]/gi, '');
const unbranded = params.get('mls') === '1' || params.get('mls') === 'true';

const store = {
  get() { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (_) { return {}; } },
  set(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...store.get(), ...p })); } catch (_) {} },
};

let viewer = null, state = null, listing = null;

// Line icons (24×24, stroke = currentColor) so buttons look the same on every phone, unlike emoji.
const ICONS = {
  walk:   '<circle cx="13" cy="4.5" r="2"/><path d="M10 21l2-6 3 3v5M9 9l3-2 3 2 2 4M12 7l-1.5 6.5L8 16"/>',
  sofa:   '<path d="M4 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M3 12a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/><path d="M5 17v2M19 17v2"/>',
  sun:    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  sunrise:'<path d="M17 18a5 5 0 0 0-10 0M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4"/>',
  sunset: '<path d="M17 18a5 5 0 0 0-10 0M12 9V2M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M16 5l-4 4-4-4"/>',
  moon:   '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  gear:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  expand: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>',
  shrink: '<path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/>',
  phone:  '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  mail:   '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
  bulb:   '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  share:  '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  lens:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  close:  '<path d="M18 6L6 18M6 6l12 12"/>',
  pin:    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  chev:   '<path d="M6 9l6 6 6-6"/>',
};
const svg = name => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
/** Button content = icon + optional text label. */
function label(el, text, icon = el.dataset.icon) {
  el.innerHTML = (icon ? svg(icon) : '') + (text ? `<span>${text}</span>` : '');
}
const TIME_ICON = { morning: 'sunrise', day: 'sun', evening: 'sunset', night: 'moon' };

function toast(msg) {
  const t = $('t-toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

function fail(msg) {
  $('t-loading').classList.add('error');
  $('t-loading-text').textContent = msg;
}

async function loadListing() {
  const res = await fetch(`listings/${listingId}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`No tour found for "${listingId}".`);
  const data = await res.json();
  if (tourEnded(data)) return { listing: data, house: null, ended: true };   // don't even fetch the model
  let house = data.house;
  if (!house && data.houseFile) {
    const hr = await fetch(`listings/${data.houseFile.replace(/[^a-z0-9_.-]/gi, '')}`, { cache: 'no-cache' });
    if (!hr.ok) throw new Error('This tour\'s 3D model is missing.');
    house = await hr.json();
  }
  if (!house?.floors?.length) throw new Error('This tour\'s 3D model is empty.');
  return { listing: data, house };
}

/** A tour is over when it's marked ended/archived or its `expires` date (YYYY-MM-DD, end of that day) has passed. */
function tourEnded(L) {
  if (['ended', 'archived'].includes(L.status)) return true;
  if (!L.expires) return false;
  const end = new Date(L.expires + 'T23:59:59');
  return !isNaN(end) && Date.now() > end.getTime();
}

/** Ended tours show a short notice (with the agent's contact on the branded link) instead of the house. */
function showEnded() {
  const L = listing, box = $('t-loading');
  box.classList.add('error');
  const who = !unbranded && L.agent?.name ? ` Contact ${L.agent.name}${L.agent.brokerage ? ' (' + L.agent.brokerage + ')' : ''} for details.` : '';
  $('t-loading-text').textContent = `The 3D tour for ${L.address || 'this home'} is no longer available.${who}`;
  document.title = '3D Tour Ended';
}

// ── Listing card, agent, credit ──────────────────────────────────────────────
function fillCard() {
  const L = listing;
  document.title = `${L.address || '3D Home Tour'} · 3D Tour`;
  $('t-address').textContent = L.address || '3D Home Tour';
  $('t-city').textContent = L.city || '';
  const facts = [];
  if (L.price) facts.push(`<span class="t-price">${typeof L.price === 'number' ? '$' + L.price.toLocaleString() : L.price}</span>`);
  if (L.beds) facts.push(`${L.beds} bd`);
  if (L.baths) facts.push(`${L.baths} ba`);
  if (L.sqft) facts.push(`${Number(L.sqft).toLocaleString()} sq ft`);
  $('t-facts').innerHTML = facts.map(f => f.startsWith('<') ? f : `<span>${f}</span>`).join('');
  $('t-head-toggle').onclick = () => {
    const c = $('t-head').classList.toggle('collapsed');
    $('t-head-toggle').setAttribute('aria-expanded', String(!c));
  };

  const A = L.agent;
  if (!unbranded && A?.name) {
    $('t-agent').hidden = false;
    $('t-agent-name').textContent = A.name;
    $('t-agent-firm').textContent = A.brokerage || '';
    const ph = $('t-agent-photo');
    if (A.photo) ph.style.backgroundImage = `url("${encodeURI(A.photo)}")`;
    else ph.textContent = A.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const call = $('t-agent-call'), mail = $('t-agent-mail');
    if (A.phone) call.href = `tel:${A.phone.replace(/[^\d+]/g, '')}`; else call.hidden = true;
    if (A.email) mail.href = `mailto:${A.email}?subject=${encodeURIComponent(L.address || 'Your listing')}`; else mail.hidden = true;
  }

  const showCredit = unbranded ? L.creditOnMls === true : L.credit !== false;
  if (showCredit) {
    const a = $('t-credit'), url = L.creditUrl || CREDIT.url;
    a.hidden = false; a.textContent = `Made by ${CREDIT.name}`;
    if (url) a.href = url; else { a.removeAttribute('href'); a.removeAttribute('target'); }
  }
  if (L.disclaimer) $('t-disclaimer').textContent = L.disclaimer;
}

// ── Controls ────────────────────────────────────────────────────────────────
function buildFloors() {
  const el = $('t-floors'); el.innerHTML = '';
  const opts = [['all', 'All'], ...state.floors.map((f, i) => [i, f.short || f.name])];
  for (const [v, label] of opts) {
    const b = document.createElement('button');
    b.textContent = label;
    b.title = v === 'all' ? 'Whole house' : state.floors[v].name;
    b.classList.toggle('active', String(state.view3d.level) === String(v));
    b.onclick = () => {
      state.view3d.level = v === 'all' ? 'all' : Number(v);
      state.view3d.cutaway = v !== 'all';          // dollhouse view of a single floor
      if (v !== 'all') state.activeFloor = Number(v);
      buildFloors(); viewer.refresh(); frame();
    };
    el.appendChild(b);
  }
}

function syncButtons() {
  const on = state.view3d.decor !== false;
  $('t-decor').classList.toggle('active', on);
  $('t-decor').setAttribute('aria-pressed', String(on));
  label($('t-decor'), on ? 'Furnished' : 'Unfurnished');
  label($('walk-decor'), on ? 'Furnished' : 'Empty');
  $('walk-decor').setAttribute('aria-pressed', String(on));
  $('walk-decor').classList.toggle('off', !on);
  const ti = TIME_ICON[state.view3d.time] || 'sun', tl = (TIMES[state.view3d.time] || TIMES.day).label.replace(/^\S+\s/, '');
  label($('t-time'), '', ti); label($('walk-time'), '', ti);
  $('t-time').title = $('walk-time').title = `Light: ${tl} (tap to change)`;
  label($('walk-lens'), (LENSES[state.view3d.lens] || LENSES.wide).label);
  $('t-lights').classList.toggle('active', !!viewer.atmo.lampsLit);
}

function bindControls() {
  const toggleDecor = () => { viewer.setDecor(state.view3d.decor === false); syncButtons(); toast(state.view3d.decor !== false ? 'Furnished' : 'Unfurnished: only what sells with the house'); };
  $('t-decor').onclick = toggleDecor;
  $('walk-decor').onclick = toggleDecor;
  const cycleTime = () => {
    const keys = Object.keys(TIMES);
    const t = keys[(keys.indexOf(state.view3d.time) + 1) % keys.length];
    viewer.setTime(t); store.set({ time: t }); syncButtons();
  };
  $('t-time').onclick = cycleTime;
  $('walk-time').onclick = cycleTime;
  $('t-more').onclick = () => { $('t-sheet').hidden = !$('t-sheet').hidden; $('t-more').classList.toggle('active', !$('t-sheet').hidden); };

  const lens = $('t-lens');
  lens.innerHTML = Object.entries(LENSES).map(([k, v]) => `<option value="${k}">${v.label} (${v.h}°)</option>`).join('');
  lens.value = state.view3d.lens;
  const setLens = k => { viewer.setLens(k); lens.value = k; store.set({ lens: k }); syncButtons(); };
  lens.onchange = () => setLens(lens.value);
  $('walk-lens').onclick = () => { const ks = Object.keys(LENSES); setLens(ks[(ks.indexOf(state.view3d.lens) + 1) % ks.length]); };

  const h = $('t-height');
  const heights = []; for (let inch = 60; inch <= 78; inch++) heights.push(inch);
  h.innerHTML = heights.map(i => `<option value="${i}">${Math.floor(i / 12)}′${i % 12}″</option>`).join('');
  h.value = String(Math.round(state.view3d.personH * 12));
  h.onchange = () => { const ft = Number(h.value) / 12; viewer.setPersonHeight(ft); store.set({ personH: ft }); };

  const q = $('t-quality');
  q.innerHTML = Object.entries(QUALITY).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  q.value = state.view3d.quality;
  q.onchange = () => { viewer.setQuality(q.value); store.set({ quality: q.value }); };

  $('t-lights').onclick = () => { viewer.setLights(!viewer.atmo.lampsLit); syncButtons(); };
  $('t-share').onclick = async () => {
    const url = location.href;
    try {
      if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
      await navigator.clipboard.writeText(url); toast('Link copied');
    } catch (_) { toast('Copy the link from the address bar'); }
  };

  $('t-walk').onclick = () => setWalk(true);
  // full screen where the browser allows it (not iPhone Safari)
  const fs = $('t-full'), canFs = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  fs.hidden = !canFs;
  fs.onclick = () => {
    const d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  };
  document.addEventListener('fullscreenchange', () => label(fs, '', document.fullscreenElement ? 'shrink' : 'expand'));
  // walk mode: jump to any room
  $('walk-where-btn').onclick = () => { const m = $('walk-rooms'); m.hidden = !m.hidden; if (!m.hidden) buildRoomMenu(); };
  // the first drag hides the hint
  $('view-3d').addEventListener('pointerdown', () => $('t-hint').classList.add('gone'), { once: true });
}

/** Rooms worth jumping to: indoor, not closets/halls/stairs, grouped by floor. */
function buildRoomMenu() {
  const m = $('walk-rooms'); m.innerHTML = '';
  const skip = /closet|hall|stair|landing|w\.?i\.?c|linen|chase|storage|vestibule|pantry/i;
  state.floors.forEach((f, fi) => {
    const seen = new Set(), rooms = f.rooms.filter(r => !r.outdoor && !skip.test(r.name) && r.width * r.height > 30)
      .filter(r => !seen.has(r.name) && seen.add(r.name));
    if (!rooms.length) return;
    const h = document.createElement('div'); h.className = 'wr-floor'; h.textContent = f.name; m.appendChild(h);
    for (const r of rooms) {
      const b = document.createElement('button'); b.className = 'wr-room'; b.textContent = r.name;
      b.onclick = () => { m.hidden = true; viewer.walker?.goTo(fi, r.x + r.width / 2, r.y + r.height / 2); };
      m.appendChild(b);
    }
  });
}

/** Fit the house in view; on a portrait phone pull back further so the whole house fits across. */
function frame() {
  viewer.focusOnLayout();
  const c = viewer.camera, t = viewer.controls.target;
  if (c.aspect < 1) { c.position.sub(t).multiplyScalar(Math.min(2.2, 1 / c.aspect)).add(t); viewer.controls.update(); }
}

/** Open on a slow descent from high above to the framed view (skipped if the viewer prefers less motion). */
function flyIn() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = viewer.camera, t = viewer.controls.target.clone(), end = c.position.clone();
  const off = end.clone().sub(t), start = t.clone().add(off.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.9).multiplyScalar(1.8));
  start.y = Math.max(start.y, end.y * 2.2);
  const t0 = performance.now(), dur = 2600;
  c.position.copy(start); viewer.controls.update();
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    c.position.lerpVectors(start, end, e);
    // keep the arc round instead of a straight line through the house
    const a = (1 - e) * -0.9, v = off.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a).multiplyScalar(1 + (1 - e) * 0.8);
    c.position.copy(t).add(v); c.position.y = Math.max(c.position.y, THREE.MathUtils.lerp(end.y * 2.2, end.y, e));
    viewer.controls.update();
    if (k < 1 && !state.view3d.walk && !flyIn.cancel) requestAnimationFrame(step);
  };
  $('view-3d').addEventListener('pointerdown', () => { flyIn.cancel = true; }, { once: true });
  requestAnimationFrame(step);
}

function setWalk(on) {
  $('walk-rooms').hidden = true;
  if (on) {
    // buyers start in first person unless they've chosen otherwise on this device
    try { if (!localStorage.getItem('house-walk')) localStorage.setItem('house-walk', JSON.stringify({ third: false, shirt: 0 })); } catch (_) {}
    $('t-sheet').hidden = true; $('t-more').classList.remove('active');
  }
  state.view3d.walk = on;
  document.body.classList.toggle('walking', on);
  $('walk-ui').style.display = on ? 'block' : 'none';
  viewer.setWalk(on, $('walk-ui'), { onExit: () => setWalk(false) });
  if (!on) frame();
  syncButtons();
}

// ── Start ───────────────────────────────────────────────────────────────────
async function start() {
  let data;
  await Promise.race([photoTexturesReady, new Promise(r => setTimeout(r, 1500))]);
  try { data = await loadListing(); } catch (e) { fail(e.message || 'This tour could not be loaded.'); return; }
  listing = data.listing;
  if (data.ended) { showEnded(); return; }
  if (listing.status === 'preview') document.body.classList.add('preview');   // watermarked until approved & paid
  const pref = store.get();
  state = {
    ...data.house,
    activeFloor: Math.min(data.house.activeFloor ?? 0, data.house.floors.length - 1),
    selectedId: null,
    view3d: {
      level: 'all', roof: true, ceilings: false, cutaway: false, walk: false,
      decor: listing.furnished !== false,
      time: pref.time && TIMES[pref.time] ? pref.time : (listing.time || 'day'),
      quality: pref.quality && QUALITY[pref.quality] ? pref.quality : undefined,
      lens: pref.lens && LENSES[pref.lens] ? pref.lens : 'wide',
      personH: pref.personH || PERSON_H,
    },
  };
  state.site ||= { roofs: [] };
  fillCard();
  try {
    viewer = new Viewer3D($('view-3d'), state, {});
  } catch (e) {
    fail('Your browser couldn\'t start 3D (WebGL). Try another browser or device.'); return;
  }
  buildFloors();
  bindControls();
  syncButtons();
  for (const el of document.querySelectorAll('[data-icon]')) {
    if (el.tagName === 'SPAN') el.innerHTML = svg(el.dataset.icon);
    else if (!el.querySelector('svg')) label(el, el.textContent.trim());
  }
  syncButtons();
  frame();
  flyIn();
  $('t-loading').classList.add('done');
  setTimeout(() => $('t-hint').classList.add('gone'), 9000);
  window.__tour = { state, viewer: () => viewer, setWalk };
}

start();
