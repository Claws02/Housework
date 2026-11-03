// Listing tour: the view-only 3D home tour sent to realtors.
//   tour.html?l=<listing-id>          branded link (agent card, CLAWEngineering credit)
//   tour.html?l=<listing-id>&mls=1    unbranded link for the MLS (no agent, no credit unless creditOnMls)
// A listing lives in listings/<id>.json: the details shown on the card plus the house, either inline
// ("house": { floors, activeFloor, site }) or as a file saved from the designer ("houseFile": "<id>.house.json").
import { Viewer3D, LENSES } from './viewer3d.js';
import { TIMES, QUALITY } from './lighting.js';
import { PERSON_H } from './walker.js';

const DEFAULT_LISTING = '191-webster';
const CREDIT = { name: 'CLAWEngineering', url: '' };   // set url to your site or a mailto: link once you have one
const PREF_KEY = 'tour-prefs';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const listingId = (params.get('l') || DEFAULT_LISTING).replace(/[^a-z0-9_-]/gi, '');
const unbranded = params.get('mls') === '1' || params.get('mls') === 'true';

const store = {
  get() { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (_) { return {}; } },
  set(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...store.get(), ...p })); } catch (_) {} },
};

let viewer = null, state = null, listing = null;

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
  let house = data.house;
  if (!house && data.houseFile) {
    const hr = await fetch(`listings/${data.houseFile.replace(/[^a-z0-9_.-]/gi, '')}`, { cache: 'no-cache' });
    if (!hr.ok) throw new Error('This tour\'s 3D model is missing.');
    house = await hr.json();
  }
  if (!house?.floors?.length) throw new Error('This tour\'s 3D model is empty.');
  return { listing: data, house };
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
  $('t-decor').textContent = on ? '🛋 Furnished' : '🛋 Unfurnished';
  const icon = (TIMES[state.view3d.time] || TIMES.day).label.split(' ')[0];
  $('t-time').textContent = icon; $('walk-time').textContent = icon;
  $('walk-lens').textContent = '🔭 ' + (LENSES[state.view3d.lens] || LENSES.wide).label;
  $('t-lights').classList.toggle('active', !!viewer.atmo.lampsLit);
}

function bindControls() {
  $('t-decor').onclick = () => { viewer.setDecor(state.view3d.decor === false); syncButtons(); };
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
  // the first drag hides the hint
  $('view-3d').addEventListener('pointerdown', () => $('t-hint').classList.add('gone'), { once: true });
}

/** Fit the house in view; on a portrait phone pull back further so the whole house fits across. */
function frame() {
  viewer.focusOnLayout();
  const c = viewer.camera, t = viewer.controls.target;
  if (c.aspect < 1) { c.position.sub(t).multiplyScalar(Math.min(2.2, 1 / c.aspect)).add(t); viewer.controls.update(); }
}

function setWalk(on) {
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
  try { data = await loadListing(); } catch (e) { fail(e.message || 'This tour could not be loaded.'); return; }
  listing = data.listing;
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
  frame();
  $('t-loading').classList.add('done');
  setTimeout(() => $('t-hint').classList.add('gone'), 9000);
  window.__tour = { state, viewer: () => viewer, setWalk };
}

start();
