// Preset: Dream House, draft 1 — a coastal Cape-style shingle house for Massachusetts, from dream-house/BRIEF.md.
// 5 bed / 3½ bath, ~2,450 sq ft 1st floor (incl. sunroom) + ~2,200 sq ft 2nd + finished basement.
//
// Orientation: street (plan +y) = north, backyard (plan −y) = south, plan +x = east, plan −x = west.
// That matches the app's sun: ☀ Day comes from the south, 🌅 Morning from the east, 🌇 Evening from the west.
//   • Primary suite on the east end → morning sun; its private deck sits on the sunroom roof.
//   • Solar on the south roof slope; garage on the west end blocks the hot evening sun.
//
// Coordinates are wall CENTRELINES on a simple grid (rooms are drawn centreline to centreline).
// Main block 58' × 38'. Exterior walls 6", partitions 4½", foundation 9.6".
import { CATALOG_BY_TYPE } from './furniture.js';

export const GROUND = -1.25;            // grade, relative to the 1st-floor surface

export function buildDreamHouse() {
  let n = 0;
  const id = p => `${p}${(++n).toString(36)}d`;
  const floors = [
    { id: 'L0', name: 'Basement',  short: 'B', elev: -9.5, height: 9.2, extFinish: 'concrete', rooms: [], walls: [], furniture: [] },
    { id: 'L1', name: '1st Floor', short: '1', elev: 0,    height: 9,   rooms: [], walls: [], furniture: [] },
    { id: 'L2', name: '2nd Floor', short: '2', elev: 10,   height: 8,   rooms: [], walls: [], furniture: [] },
  ];
  let F = floors[1];
  const on = i => { F = floors[i]; };

  const room = (name, x0, y0, x1, y1, o = {}) => F.rooms.push({
    id: id('r'), name, x: x0, y: y0, width: x1 - x0, height: y1 - y0, color: o.color ?? '#3b82f6',
    floorMat: o.floor ?? 'oak', floorColor: o.floorColor, wallColor: o.wall ?? WALL, wallFinish: o.wallFinish ?? 'paint',
    ceiling: o.ceiling ?? true, offset: o.offset ?? 0, outdoor: !!o.outdoor, autoWalls: false,
  });
  const wall = (x1, y1, x2, y2, o = {}) => F.walls.push({
    id: id('w'), x1, y1, x2, y2, thick: o.t ?? INT, height: o.h ?? null, base: o.base ?? 0, ext: !!o.ext,
  });
  const chain = (pts, o) => { for (let i = 0; i < pts.length - 1; i++) wall(...pts[i], ...pts[i + 1], o); };
  const item = (type, x, y, o = {}) => {
    const cat = CATALOG_BY_TYPE[type];
    if (!cat) throw new Error(`unknown item type ${type}`);
    const it = { id: id('f'), type, label: o.label ?? cat.label, x, y, width: o.w ?? cat.width, depth: o.d ?? cat.depth,
      rotation: (o.rot ?? 0) * Math.PI / 180, color: o.color ?? cat.color };
    for (const [k, v] of Object.entries(o)) if (!['label', 'w', 'd', 'rot', 'color'].includes(k)) it[k] = v;
    F.furniture.push(it);
    return it;
  };
  // Openings: rot 0 on walls running along x, 90 on walls along y
  const win = (x, y, rot, o = {}) => item(o.type ?? 'window', x, y, { rot, ...o });
  const door = (x, y, rot, o = {}) => item(o.type ?? 'door-single', x, y, { rot, ...o });
  const arch = (x, y, rot, w, o = {}) => item('arch', x, y, { rot, w, ...o });
  const cans = (x0, y0, x1, y1, nx, ny) => {
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++)
      item('recessed-light', x0 + (x1 - x0) * (i + 0.5) / nx, y0 + (y1 - y0) * (j + 0.5) / ny, {});
  };

  const EXT = 0.5, INT = 0.375, FND = 0.8, e = EXT / 2, p = INT / 2, f = FND / 2;
  const W = 58, D = 38;                       // main block (centrelines)
  const WALL = '#f2eee6';                     // warm white
  const site = {
    ground: GROUND, groundFloor: 1, extFinish: 'cedar', sidingColor: '#b3a896', trimColor: '#f7f6f2',
    lot: { x: -60, y: -135, w: 190, h: 235 },
    roofs: [],
  };
  const roof = o => site.roofs.push({ id: id('g'), finish: 'shingle', color: '#55595d', overhang: 0.75, noGable: [], ...o });

  // ═══ BASEMENT ════════════════════════════════════════════════════════════
  on(0);
  const BS = { floor: 'concrete', wallFinish: 'concrete', wall: '#c9c5bd', ceiling: false, color: '#64748b' };
  room('Theme Room', 30, 0, W, 22, { floor: 'carpet', floorColor: '#5b3b3e', wall: '#2f3846', color: '#a855f7' });
  room('Home Gym', 14, 0, 30, 18, { floor: 'rubber', wall: '#e6e3dc', color: '#ef4444' });
  room('Mechanical', 0, 0, 14, 16, BS);
  room('Storage', 0, 16, 14, D, { ...BS, color: '#78716c' });
  room('Basement Hall', 14, 18, 30, 22, { floor: 'carpet', floorColor: '#8c8378', color: '#94a3b8' });
  room('Game Lounge', 14, 22, 25, D, { floor: 'carpet', floorColor: '#8c8378', color: '#f59e0b' });
  room('Stairs', 25, 22, 37.5, 25.5, { floor: 'carpet', floorColor: '#8c8378', color: '#94a3b8' });
  room('Craft / Flex', 25, 25.5, 37.5, D, { floor: 'carpet', floorColor: '#8c8378', color: '#22c55e' });
  room('Bulk Storage', 37.5, 22, W, D, { ...BS, color: '#78716c' });

  chain([[0, 0], [W, 0], [W, D], [0, D], [0, 0]], { t: FND, ext: true });
  wall(14, 0, 14, 16); wall(0, 16, 14, 16); wall(14, 16, 14, D);
  wall(14, 18, 30, 18); wall(30, 0, 30, 22); wall(25, 22, W, 22);
  wall(25, 25.5, 37.5, 25.5); wall(25, 25.5, 25, D); wall(37.5, 22, 37.5, D);
  door(7, 16, 0, { open: 70, label: 'Mechanical Door' });
  door(14, 20, 90, { open: 70, label: 'Storage Door' });
  door(22, 18, 0, { open: 70, rot: 180, label: 'Gym Door' });
  door(30, 20, 90, { type: 'door-double', w: 5, label: 'Theme Room Doors' });
  door(25, 32, 90, { open: 70 });
  door(37.5, 32, 90, { open: 70, rot: -90 });
  for (const [x, y, r] of [[7, 0, 0], [22, 0, 0], [19.5, D, 0], [31, D, 0], [48, D, 0]]) win(x, y, r, { type: 'window-bsmt' });

  // Basement stair arrives heading west under the main flight (see 1st floor)
  // Theme room (theater by default): screen on the east wall, two rows of recliners, the back row on a riser
  item('proj-screen', W - f - 0.15, 11, { rot: 90, w: 11, height: 6.2, lift: 1.7 });
  item('speaker-tower', W - f - 0.6, 3.6, { rot: 90 }); item('speaker-tower', W - f - 0.6, 18.4, { rot: 90 });
  item('subwoofer', W - f - 0.7, 11, { rot: 90 });
  item('rug-8x10', 47, 11, { rot: 90, w: 13, d: 9, color: '#3a2f33' });
  for (const y of [6.2, 9.4, 12.6, 15.8]) item('recliner', 48, y, { rot: -90, color: '#2b2523', label: 'Theater Recliner' });
  item('steps', 41.6, 11, { rot: -90, w: 14, d: 5.4, height: 0.8, color: '#3a2f33', label: 'Seating Riser' });
  for (const y of [6.2, 9.4, 12.6, 15.8]) item('recliner', 41.6, y, { rot: -90, lift: 0.8, color: '#2b2523', label: 'Theater Recliner' });
  item('projector', 44, 11, { rot: -90 });
  for (const [x, y] of [[36, 3], [36, 19], [51, 2], [51, 20]]) item('speaker-ceiling', x, y, {});
  item('dining-4', 34, 5, { label: 'Game Table', w: 4, d: 4, color: '#3d2a1e' });
  for (const [dx, dy, r] of [[0, -2.1, 0], [0, 2.1, 180], [-2.1, 0, -90], [2.1, 0, 90]]) item('dining-chair', 34 + dx, 5 + dy, { rot: r, color: '#2b2523', color2: '#7a2f2f' });
  item('sideboard', 41, 21, { rot: 180, label: 'Snack Bar / Games Cabinet', w: 6, color: '#2b2523' });
  cans(31, 1, 57, 21, 4, 3);

  // Gym
  item('treadmill', 16.6, 4.2, { rot: 0 });
  item('exercise-bike', 20.4, 3.4, { rot: 0 });
  item('weight-rack', 26.8, 16.6, { rot: 180 });
  item('weight-bench', 26.4, 11.6, { rot: 90 });
  item('mirror', 30 - p - 0.08, 8, { rot: 90, w: 10, height: 6, lift: 1, label: 'Mirror Wall' });
  item('yoga-mat', 21.5, 11, { rot: 90 }); item('yoga-mat', 21.5, 14, { rot: 90, color: '#6f8296' });
  item('tv', 14 + p + 0.2, 10, { rot: -90, w: 4.6, lift: 5 });
  cans(15, 1, 29, 17, 3, 3);

  // Mechanical: cold-climate heat-pump air handler, heat-pump water heater, panel, batteries for the solar
  item('air-handler', 3.4, 3.0, { rot: 0 });
  item('water-heater', 7.0, 2.2, { label: 'Heat-pump Water Heater', height: 5.8, w: 2.1, d: 2.1 });
  item('elec-panel', f + 0.2, 8.6, { rot: -90, lift: 3.5, label: 'Main Panel + Generator Switch' });
  item('battery', f + 0.32, 11.4, { rot: -90, w: 2.4 }); item('battery', f + 0.32, 14.1, { rot: -90, w: 2.4 });
  item('filing-cabinet', 10.4, 1.5, { label: 'Network / Smart-home Rack', color: '#2b2b2e' });
  item('utility-sink', 12.6, 1.6, {});
  item('trash-bin', 12.5, 14.4, { label: 'Dehumidifier', color: '#e8e8e8', w: 1.4, d: 1.2, height: 2 });
  item('joists', 7, 8, { w: 13, d: 15 });
  // Storage
  for (const y of [19.5, 24, 28.5, 33]) item('metal-shelf', f + 0.75, y, { rot: -90 });
  for (const y of [25, 29.5, 34]) item('metal-shelf', 14 - p - 0.75, y, { rot: 90 });
  item('joists', 7, 27, { w: 13, d: 21.2, label: 'Joists (storage)' });
  for (const y of [25, 29.5, 34]) item('metal-shelf', W - f - 0.75, y, { rot: 90 });
  for (const x of [42, 46.5]) item('metal-shelf', x, D - f - 0.75, { rot: 180 });
  item('joists', 47.75, 30, { w: 19.6, d: 15.2, label: 'Joists (bulk storage)' });
  // Game lounge & craft room
  item('sofa-3', 19.5, D - f - 1.7, { rot: 180, color: '#6f7f8f' });
  item('coffee-table', 19.5, 32.6, {});
  item('tv-stand', 19.5, 22.9, { rot: 0, w: 5 });
  item('tv', 19.5, 22.75, { rot: 0, w: 5.4, lift: 2.1 });
  item('rug-8x10', 19.5, 31, { rot: 90, color: '#8c7a68' });
  item('ceiling-light', 19.5, 27, {}); item('ceiling-light', 22, 20, {});
  item('cube-shelf', 31.25, D - f - 0.6, { rot: 180, w: 6 });
  item('dining-6', 31.25, 31, { label: 'Craft Table', color: '#c9a77c' });
  item('ceiling-light', 31.25, 31, {});

  // ═══ 1ST FLOOR ═══════════════════════════════════════════════════════════
  on(1);
  room('Mudroom', 0, 0, 8, 12, { floor: 'tile', floorColor: '#6f6a63', wall: '#e7e3da', color: '#94a3b8' });
  room('Powder Room', 0, 12, 8, 18, { floor: 'tile', floorColor: '#8d8c88', wall: '#c9d6d3', color: '#06b6d4' });
  room('Breakfast Nook', 8, 0, 18, 11, { color: '#84cc16' });
  room('Walk-in Pantry', 8, 11, 13, 18, { color: '#64748b' });
  room("Butler's Pantry", 13, 11, 18, 18, { color: '#64748b' });
  room('Kitchen', 18, 0, 38, 18, { color: '#22c55e' });
  room('Den', 38, 0, W, 18, { wall: '#e9e0cf', color: '#3b82f6' });
  room('Sunroom', 42, -14, W, 0, { floor: 'stone', floorColor: '#a8957f', color: '#eab308' });
  room('Hall', 0, 18, W, 22, { color: '#94a3b8' });
  room('Dining Room', 0, 22, 16, D, { wall: '#dfe6e3', color: '#f59e0b' });
  room('Coat Closet', 16, 22, 19, 24.5, { color: '#64748b' });
  room('Foyer', 19, 22, 25, D, { color: '#94a3b8' });
  room('Foyer', 16, 24.5, 19, D, { color: '#94a3b8' });
  room('Stairs', 25, 22, 37.5, 25.5, { color: '#94a3b8' });
  room('Basement Stair', 37.5, 22, 41, 25.5, { color: '#94a3b8' });
  room('Guest Closet', 41, 22, 45, 25.5, { color: '#64748b' });
  room('Office', 25, 25.5, 37.5, D, { wall: '#dde3e6', color: '#8b5cf6' });
  room('Guest Bath', 37.5, 25.5, 45, D, { floor: 'tile', floorColor: '#b9b4aa', wall: '#e9efee', color: '#06b6d4' });
  room('Guest Suite', 45, 22, W, D, { wall: '#e6ebe7', color: '#ec4899' });
  room('Garage', -24, 4, 0, 30, { floor: 'concrete', wallFinish: 'framing', wall: '#c99a66', offset: -1, ceiling: false, color: '#78716c' });
  const OUT = { outdoor: true, ceiling: false };
  room('Patio Deck', 0, -20, 42, 0, { ...OUT, floor: 'deck', floorColor: '#a68b6c', offset: -0.75, color: '#a16207' });
  room('Front Porch', 14, D, 44, 45.25, { ...OUT, floor: 'deck', floorColor: '#9c8f7e', offset: -0.6, color: '#a16207' });
  room('Driveway', -24, 30, 0, 100, { ...OUT, floor: 'asphalt', offset: -1.0, color: '#525252' });
  room('Front Walk', 18.5, 47.6, 22.5, 100, { ...OUT, floor: 'stone', offset: -1.2, color: '#a8a29e' });
  room('Pool Deck', 6, -70, 64, -40, { ...OUT, floor: 'stone', floorColor: '#b3ab9e', offset: -1.2, color: '#a8a29e' });
  room('Fire Pit Patio', -22, -48, -4, -30, { ...OUT, floor: 'gravel', offset: -1.22, color: '#a8a29e' });
  room('Street', -60, 100, 130, 122, { ...OUT, floor: 'asphalt', floorColor: '#3c3c3e', offset: -1.24, color: '#3f3f46' });
  room('Beach', -600, -175, 700, -158, { ...OUT, floor: 'sand', offset: -1.22, color: '#e7d7a8' });
  room('Bay', -600, -800, 700, -175, { ...OUT, floor: 'water', offset: -1.24, color: '#0ea5e9' });

  const E1 = { ext: true, h: 10, t: EXT };
  chain([[0, 0], [W, 0], [W, D], [0, D], [0, 0]], E1);
  chain([[42, 0], [42, -14], [W, -14], [W, 0]], E1);                          // sunroom (its roof is the primary deck)
  chain([[0, 4], [-24, 4], [-24, 30], [0, 30]], { ext: true, h: 9.75, base: -1, t: EXT });   // garage
  wall(0, 12, 8, 12); wall(8, 0, 8, 18); wall(8, 11, 18, 11); wall(13, 11, 13, 18);
  wall(0, 18, W, 18); wall(18, 0, 18, 18); wall(38, 0, 38, 18);
  wall(0, 22, 19, 22); wall(37.5, 22, W, 22);
  wall(16, 22, 16, D); wall(19, 22, 19, 24.5); wall(16, 24.5, 19, 24.5);
  wall(25, 25.5, 25, D); wall(25, 25.5, 45, 25.5); wall(37.5, 25.5, 37.5, D);
  wall(41, 22, 41, 25.5); wall(45, 22, 45, D);

  // Exterior openings
  door(20.5, D, 0, { type: 'door-ext', color: '#2f4f6f', label: 'Front Door' });
  for (const x of [4, 12]) win(x, D, 0, { lift: 2.4, height: 5.2 });          // dining
  for (const x of [28.5, 34]) win(x, D, 0, {});                               // office
  win(38.8, D, 0, { type: 'window-sm', lift: 4.6, grid: false });              // guest bath
  for (const x of [49, 54]) win(x, D, 0, {});                                 // guest suite
  for (const y of [27, 34]) win(W, y, 90, {});
  win(0, 34.5, 90, { lift: 2.4, height: 5.2 });                               // dining (west, past the garage)
  door(3, 0, 0, { type: 'door-ext', label: 'Back Door (yard)' });
  item('sliding-door', 13, 0, { rot: 0, w: 6, label: 'Nook Slider' });
  win(28.1, 0, 0, { type: 'window-picture', w: 4.2, lift: 3.6, height: 3.6, grid: true, label: 'Window over sink' });
  win(40, 0, 0, { w: 2.6 });
  item('french-door', 50, 0, { rot: 0, w: 5, label: 'Den → Sunroom' });
  for (const x of [45.5, 50, 54.5]) win(x, -14, 0, { type: 'window-picture', w: 3.8, lift: 1.6, height: 6.2, grid: true });
  for (const y of [-10.5, -4]) win(W, y, 90, { type: 'window-picture', w: 3.8, lift: 1.6, height: 6.2, grid: true });
  item('sliding-door', 42, -8, { rot: 90, w: 6, label: 'Sunroom → Deck' });
  win(42, -2.5, 90, { w: 2.6, lift: 1.6, height: 6.2 });
  item('garage-door', -18, 30, { rot: 0, lift: -1 });
  item('garage-door', -6, 30, { rot: 0, lift: -1 });
  door(-24, 22, 90, { type: 'door-ext', lift: -1, label: 'Garage Side Door' });
  win(-24, 26.5, 90, { lift: 2.5 });
  door(0, 6.5, 90, { type: 'door-ext', label: 'Garage → Mudroom' });

  // Interior openings
  door(4, 18, 0, { open: 70, rot: 180, label: 'Powder Room Door' });
  arch(8, 9.5, 90, 3);                                                         // mudroom ↔ nook
  door(13, 14.5, 90, { open: 70, rot: -90, label: 'Pantry Door' });
  arch(15.5, 18, 0, 3);                                                        // butler's pantry ↔ hall
  arch(18, 15, 90, 2.8);                                                       // butler's pantry ↔ kitchen
  arch(18, 8, 90, 5, { label: 'Opening to nook' });
  arch(28, 18, 0, 6, { label: 'Kitchen opening' });
  arch(38, 15, 90, 4, { label: 'Kitchen ↔ den' });
  for (const y of [6.2, 10]) win(38, y, 90, { w: 3, lift: 3.7, height: 3.4, label: 'Interior Window (kitchen ↔ den)' });
  arch(52.5, 18, 0, 5, { label: 'Den opening' });
  arch(8, 22, 0, 6, { label: 'Dining opening (hall)' });
  arch(16, 35, 90, 4, { label: 'Dining opening (foyer)' });
  item('door-double', 17.5, 24.5, { rot: 0, w: 2.6, label: 'Coat Closet Doors' });
  door(25, 34, 90, { w: 3, open: 70, rot: -90, label: 'Office Door' });
  door(39.25, 22, 0, { w: 2.8, open: 0, label: 'Basement Door' });
  door(45, 23.75, 90, { w: 2.4, open: 60, rot: 90, label: 'Guest Closet Door' });
  door(45, 31, 90, { w: 3, open: 70, rot: 90, label: 'Guest Bath Door' });
  door(49, 22, 0, { w: 3, open: 75, rot: 180, label: 'Guest Suite Door' });

  // Stairs: main flight climbs east from the foyer along the office wall (16 × 7½" risers, 10" treads),
  // landing upstairs at x 37.5; the basement flight runs beneath it, entered from the basement door.
  item('stairs', 31.25, 23.75, { rot: 90, w: 3.5, d: 12.5, height: 10, rail: 'left' });
  item('stairs-down', 31.5, 23.75, { rot: 90, w: 3.5, d: 12, height: 9.5, rails: [] });

  // Mudroom: locker wall with shoe bins, litter-box cabinet, smart-home panel by the door
  item('cubbies', 2.85, 12 - p - 0.85, { rot: 180, w: 4.8 });
  item('litter-box', 8 - p - 0.9, 3.6, { rot: 90 });
  item('smart-panel', 8 - p - 0.05, 6.4, { rot: 90 });
  item('rug-runner', 3.6, 5.4, { w: 3, d: 6, color: '#55606a' });
  item('ceiling-light', 4, 6, {});
  // Powder room
  item('toilet', p + 1.45, 15.4, { rot: -90 });
  item('vanity', 5, 12 + p + 0.9, { w: 3, color: '#2f4a5a' });
  item('mirror', 5, 12 + p + 0.08, { w: 2.4, height: 2.8 });
  item('ceiling-light', 4, 15, {});
  // Pantry & butler's pantry
  item('pantry-shelves', 8 + p + 0.7, 14.6, { rot: -90, w: 6.2 });
  item('pantry-shelves', 11.1, 18 - p - 0.7, { rot: 180, w: 2.9 });
  item('pantry-shelves', 11.1, 11 + p + 0.7, { rot: 0, w: 2.9 });
  item('ceiling-light', 10.6, 14.5, {});
  item('counter', 15.5, 11 + p + 1.05, { w: 4.6, label: 'Coffee Bar' });
  item('upper-cab-glass', 15.5, 11 + p + 0.55, { w: 4.4 });
  item('coffee-maker', 14.4, 11.9, { lift: 3 });
  item('ceiling-light', 15.5, 15.5, {});

  // Kitchen (clear 18.19..37.81 × 0.25..17.81) — 36" range, 4' sink under the window, 10' island seating 5
  const KY = e + 1.05;
  item('counter', 19.17, KY, { w: 1.95 });
  item('stove', 21.65, e + 1.1, { w: 3, label: '36" Range' });
  item('range-hood', 21.65, e + 0.85, { w: 3 });
  item('counter', 24.65, KY, { w: 3 });
  item('sink-cab', 28.15, KY, { w: 4, label: 'Big Sink' });
  item('dishwasher', 31.15, KY);
  item('counter', 33.1, KY, { w: 1.9 });
  item('fridge', 35.95, e + 1.35, { w: 3.6, height: 6.2, label: 'Built-in Fridge' });
  item('upper-cab-glass', 24.65, e + 0.55, { w: 3 });
  item('upper-cab', 19.17, e + 0.55, { w: 1.9 });
  item('upper-cab-glass', 33.1, e + 0.55, { w: 1.9 });
  item('kitchen-island', 28, 8.5, { rot: 180, w: 10, d: 4, color: '#2f4a5a' });
  for (const x of [24, 26, 28, 30, 32]) item('bar-stool', x, 11.2, { rot: 180 });
  for (const x of [24.5, 28, 31.5]) item('pendant-dome', x, 8.5, { lift: 6.2 });
  item('roman-shade', 28.1, e + 0.1, { w: 4.0, lift: 7.2, height: 1.1 });
  item('plant-sm', 28.1, e + 0.25, { lift: 3.6, w: 0.6, d: 0.6, height: 0.9, label: 'Sill Plant' });
  item('ceiling-beams', 28, 10, { rot: 90, w: 15, d: 19.4, label: 'Ceiling Beams (kitchen)' });
  cans(19, 1, 37, 17, 4, 3);
  item('fruit-bowl', 27.2, 8.7, { lift: 3 });
  item('vase-flowers', 30.5, 8.4, { lift: 3 });
  item('canisters', 24.4, e + 0.4, { lift: 3 });
  item('cutting-board', 33.0, e + 0.15, { lift: 3 });
  item('knife-block', 25.6, e + 0.6, { lift: 3 });
  item('paper-towel', 30.9, e + 0.4, { lift: 3 });
  // Breakfast nook
  item('dining-4', 12.6, 6, { w: 3.8, d: 3.8, color: '#8a6a4a', label: 'Nook Table' });
  for (const [x, y, r] of [[12.6, 4.15, 0], [12.6, 7.85, 180], [10.75, 6, -90], [14.45, 6, 90]]) item('dining-chair', x, y, { rot: r, color: '#f3f1ec', color2: '#9fb3c3' });
  item('pendant-dome', 12.6, 6, { lift: 6.2 });
  item('plant-lg', 16.9, 1.2, { w: 1.6, d: 1.6 });
  // Den: fireplace + TV on the east wall, built-ins, sectional facing it, 7.1 surround, beams
  item('fireplace', W - e - 0.8, 9, { rot: 90, w: 5.5, height: 9 });
  item('chimney', W + e + 1.25, 9, { rot: -90, lift: GROUND, height: 36.5 });
  item('builtins', W - e - 0.7, 4.75, { rot: 90, w: 3, height: 9 });
  item('builtins', W - e - 0.7, 13.25, { rot: 90, w: 3, height: 9 });
  item('tv', W - e - 1.75, 9, { rot: 90, w: 6.2, lift: 5 });
  item('speaker-tower', W - e - 0.6, 1.6, { rot: 90 }); item('speaker-tower', W - e - 0.6, 16.4, { rot: 90 });
  item('subwoofer', 39.0, 1.1, {});
  for (const [x, y] of [[44, 1.6], [44, 16.4], [39.6, 6], [39.6, 12]]) item('speaker-ceiling', x, y, {});
  item('rug-8x10', 48.6, 9, { rot: 90, w: 10, d: 12, color: '#b8a58c' });
  item('sofa-l', 46.5, 8.6, { rot: -90, w: 10.5, d: 8, seatDepth: 3.17, color: '#d9d2c4', color2: '#5f7a8a' });
  item('ottoman', 48.6, 7.4, { w: 3, d: 4, label: 'Storage Ottoman', color: '#8a6a4a' });
  item('armchair', 54.2, 3.5, { rot: -35, color: '#5f7a8a' });
  item('dog-bed', 40.4, 9, { rot: 90, color: '#8a7a68' });
  item('ceiling-beams', 47, 9, { rot: 90, w: 17.4, d: 17, label: 'Ceiling Beams (den)' });
  cans(39, 1, 57, 17, 3, 3);
  // Sunroom: glass on three sides, beams, a sitting group for coffee in the morning sun
  item('ceiling-beams', 50, -7, { rot: 90, w: 13.4, d: 15.4, label: 'Ceiling Beams (sunroom)' });
  item('rug-8x10', 50.5, -7.5, { rot: 90, color: '#a8b8b0' });
  item('sofa-2', 50.5, -11.6, { rot: 0, color: '#f0ebe0', color2: '#7a9aa6' });
  item('armchair', 46.8, -6.4, { rot: -110, color: '#d8c8a8' }); item('armchair', 54.4, -6.4, { rot: 110, color: '#d8c8a8' });
  item('coffee-table', 50.5, -7.6, { w: 3.6, d: 2, color: '#b98b5a' });
  item('plant-lg', 43.4, -12.6, {}); item('plant-lg', W - e - 1.1, -12.6, { color: '#4f8a3f' });
  item('ceiling-light', 50, -3.5, {});
  // Hall
  for (const x of [6, 22, 34, 46, 54]) item('ceiling-light', x, 20, {});
  item('rug-runner', 34, 20, { rot: 90, w: 2.5, d: 10, color: '#6f8296' });
  item('wall-art', 46, 18 + p + 0.05, { w: 3, height: 2, color: '#7a9bb8', label: 'Coastal Print' });
  // Dining: table for 10, buffet, hutch, chandelier
  item('rug-8x10', 8, 30.4, { rot: 90, w: 9, d: 13.5, color: '#9aa4b0' });
  item('dining-8', 8, 30.4, { w: 10, d: 3.8 });
  for (const x of [4.4, 6.8, 9.2, 11.6]) { item('dining-chair', x, 27.9, { rot: 0 }); item('dining-chair', x, 32.9, { rot: 180 }); }
  item('dining-chair', 2.15, 30.4, { rot: -90, label: 'Host Chair' }); item('dining-chair', 13.85, 30.4, { rot: 90, label: 'Host Chair' });
  item('sideboard', e + 0.75, 26, { rot: -90, w: 5, label: 'Buffet' });
  item('hutch', 16 - p - 0.8, 25.6, { rot: 90, w: 3.6 });
  item('pendant', 8, 30.4, { lift: 6.0, w: 2.6, height: 1.4, label: 'Chandelier' });
  for (const x of [4, 12]) item('curtains', x, D - e - 0.2, { rot: 180, w: 4.6, height: 7.6, color: '#d9d2c4' });
  // Foyer
  item('rug-5x8', 21, 33.5, { rot: 0, color: '#6f8296', w: 4.4, d: 6 });
  item('sideboard', 16 + p + 0.6, 27.5, { rot: -90, w: 3.2, d: 1.2, height: 2.6, label: 'Console Table', color: '#7a5233' });
  item('mirror', 16 + p + 0.08, 27.5, { rot: -90, w: 2.6, height: 3 });
  item('bench-foot', 25 - p - 0.75, 28.6, { rot: 90, w: 3.2, label: 'Entry Bench', color: '#5f7a8a', color2: '#7a5233' });
  item('pendant', 21.5, 30.5, { lift: 6.4, w: 1.4, height: 1.6, label: 'Foyer Lantern' });
  // Office (door closes; desk faces the room with the window to the side)
  item('desk', 37.5 - p - 1.05, 31.5, { rot: 90, w: 5.2, d: 2.1 });
  item('office-chair', 34.5, 31.5, { rot: -90 });
  item('bookshelf', 28.2, 25.5 + p + 0.5, { rot: 0 }); item('bookshelf', 31.3, 25.5 + p + 0.5, { rot: 0 });
  item('armchair', 34.1, 35.75, { rot: 200, color: '#7a5233' });
  item('floor-lamp', 36.55, 36.95, {});
  item('rug-5x8', 31.2, 32, { rot: 90, color: '#8c6d5a' });
  item('ceiling-light', 31.25, 31.75, {});
  // Guest bath (accessible: roll-in shower, 5' turning circle)
  item('shower', 42.5, D - e - 1.8, { rot: 180, w: 4.5, d: 3.6, color: '#f4f4f0', label: 'Roll-in Shower' });
  item('toilet', 37.5 + p + 1.2, 29.2, { rot: -90 });
  item('vanity-w', 41.6, 25.5 + p + 0.85, { w: 3.4 });
  item('mirror', 41.6, 25.5 + p + 0.08, { w: 3, height: 2.8, color: '#f3f1ec' });
  item('ceiling-light', 41.25, 31, {});
  // Guest suite
  item('rug-8x10', 52.6, 30.5, { rot: 90, color: '#c2ab95' });
  item('bed-queen', W - e - 3.6, 30.5, { rot: 90, color: '#7a9aa6', color2: '#f3f1ec', pattern: 'solid' });
  item('nightstand-w', W - e - 0.75, 26.9, { rot: 90 }); item('nightstand-w', W - e - 0.75, 34.1, { rot: 90 });
  item('table-lamp', W - e - 0.75, 26.9, { lift: 2.1 }); item('table-lamp', W - e - 0.75, 34.1, { lift: 2.1 });
  item('dresser-w', 54.5, 22 + p + 0.8, { w: 4.5 });
  item('bench-foot', 49.9, 30.5, { rot: 90, w: 4, label: 'Luggage Bench', color: '#c9c3b8', color2: '#7a5233' });
  item('ceiling-light', 51.5, 30, {});
  item('closet-sys', 41 + p + 0.55, 23.75, { rot: -90, w: 3, d: 1.1, label: 'Guest Closet Shelving' });
  // Garage: EV + a second car, EV charger, storage wall
  item('car', -6, 15.4, { rot: 0, color: '#3d4f63', label: 'EV' });
  item('car', -18, 15.4, { rot: 0, color: '#b0b5ba' });
  item('ev-charger', -6, 4 + e + 0.25, { rot: 0 });
  for (const y of [8, 12.5, 17]) item('metal-shelf', -24 + e + 0.75, y, { rot: -90 });
  item('trash-bin', -21.2, 4 + e + 1.2, {}); item('trash-bin', -18.8, 4 + e + 1.2, { color: '#2f5ea8', label: 'Recycling' });
  item('steps', -1.45, 6.5, { rot: 90, w: 4, d: 2.4, height: 1, color: '#9c8f7e', label: 'Steps to Mudroom' });
  item('ceiling-light', -12, 17, {});

  // Outside: patio deck off the nook & kitchen, porch, pool + hot tub, fire pit, play lawn, workshop shed
  item('patio-table', 23, -9.5, { w: 6.5, d: 3.6, umbrella: 'open', label: 'Patio Table + Umbrella' });
  for (const [dx, dy, r] of [[-2.2, -2.1, 0], [0, -2.1, 0], [2.2, -2.1, 0], [-2.2, 2.1, 180], [0, 2.1, 180], [2.2, 2.1, 180]]) item('patio-chair', 23 + dx, -9.5 + dy, { rot: r, color2: '#9aa0a8' });
  item('grill', 34.5, -2.0, { rot: 0, color: '#3a3c40' });
  for (const [x, y, r] of [[8, -10, 90], [8, -14.5, 90]]) item('lounge-chair', x, y, { rot: r, color2: '#7a9aa6' });
  item('side-table', 7.6, -12.25, {});
  item('planter', 1.2, -18.8, {}); item('planter', 40.8, -18.8, { color: '#5b7fc9' });
  item('steps', 25, -21.2, { rot: 180, w: 6, d: 2.4, height: 0.5, lift: GROUND, label: 'Deck Steps' });
  item('steps', 20.5, 46.4, { rot: 0, w: 5, d: 2.4, height: 0.65, lift: GROUND, label: 'Porch Steps' });
  for (const x of [14.5, 22.5, 35.5, 43.5]) item('post', x, 44.8, { height: 9.8 });
  item('lantern', 20.5, 41.5, { lift: 6.4, ceil: 9.4 }); item('lantern', 35.5, 41.5, { lift: 6.4, ceil: 9.4 });
  item('patio-chair', 39.5, 41.2, { rot: 200, label: 'Porch Rocker', color: '#f3f1ec', color2: '#5f7a8a' });
  item('patio-chair', 42.2, 41.4, { rot: 160, label: 'Porch Rocker', color: '#f3f1ec', color2: '#5f7a8a' });
  item('pool', 30, -55, { rot: 90, color: '#9fd3e0' });
  for (const x of [17, 22, 27, 32]) item('lounge-chair', x, -42.2, { rot: 180, color2: '#f3f1ec' });
  item('patio-table', 40, -42.6, { w: 3, d: 3, umbrella: 'open', color2: '#2f5a8a' });
  item('hot-tub', 56, -52, { rot: 0 });
  item('fire-pit', -13, -39, {});
  for (const [x, y, r] of [[-13, -33.8, 180], [-13, -44.2, 0], [-18.2, -39, -90], [-7.8, -39, 90]]) item('lounge-chair', x, y, { rot: r, color: '#f3f1ec', color2: '#c9a050', label: 'Adirondack Chair' });
  item('shed', 85, -108, { rot: 0, w: 12, d: 16, height: 11, label: 'Workshop Shed', color: '#a39a8c' });
  // 6' privacy fence around the backyard (garage corner → west → south → east → back to the house)
  const fence = (x1, y1, x2, y2) => item('privacy-fence', (x1 + x2) / 2, (y1 + y2) / 2, { w: Math.hypot(x2 - x1, y2 - y1), rot: Math.abs(x2 - x1) > Math.abs(y2 - y1) ? 0 : 90 });
  fence(-24.25, 4, -39.5, 4); fence(-40, 3.5, -40, -124.5); fence(-39.5, -125, 99.5, -125); fence(100, -124.5, 100, 13.5); fence(99.5, 14, W + e, 14);
  // Systems outside the fence on the garage side: two heat-pump condensers, standby generator
  item('heat-pump', -26.4, 7, { rot: -90 }); item('heat-pump', -26.4, 10.8, { rot: -90 });
  item('generator', -27, 16, { rot: -90 });
  // Landscaping
  for (const x of [2, 6, 10, 47, 51, 55]) item('hydrangea', x, D + 1.6, { color2: '#5b7fc9' });
  for (const x of [4, 8, 12, 49, 53, 57]) item('hosta', x, D + 3, {});
  for (const x of [14, 27, 34, 42]) item('shrub', x, D + 8.4, { w: 2.6, d: 2.6, height: 2.4 });
  item('mailbox', -27, 98, {});
  item('lamp-post', 17, 60, {});
  const trees = [
    ['tree', -38, 66], ['tree', 52, 78], ['tree-birch', 74, 52], ['tree-pine', -52, 30], ['tree-pine', 112, 40],
    ['tree-pine', -52, -20], ['tree', -50, -80], ['tree-pine', 115, -30], ['tree', 112, -100], ['tree-birch', 92, -70],
    ['tree-birch', -30, -105], ['tree-pine', 120, 80], ['tree', 95, 92],
  ];
  for (const [t, x, y] of trees) item(t, x, y, { rot: (x * 37 + y * 11) % 360 });

  // ═══ 2ND FLOOR ═══════════════════════════════════════════════════════════
  on(2);
  const bedroomWithCloset = (name, x0, x1, o) => {
    const c0 = x0 + 3.7, c1 = c0 + 6, cy = 12.5;              // 6' × 2'6" reach-in closet beside the door
    room(name, x0, 0, x1, cy, o);
    room(name, x0, cy, c0, 15, o);
    room('Closet', c0, cy, c1, 15, { color: '#64748b' });
    room(name, c1, cy, x1, 15, o);
    wall(c0, cy, c1, cy); wall(c0, cy, c0, 15); wall(c1, cy, c1, 15);
    item('door-double', (c0 + c1) / 2, cy, { rot: 0, w: 5.4, label: 'Closet Doors' });
    item('closet-sys', (c0 + c1) / 2, 15 - p - 0.55, { rot: 180, w: 5.4, d: 1.1 });
    door(x0 + 1.85, 15, 0, { w: 3, open: 70, rot: 180 });
  };
  bedroomWithCloset('Bedroom 4', 0, 13, { wall: '#e3e8ea', color: '#ec4899' });
  bedroomWithCloset('Bedroom 3', 13, 27, { wall: '#ece4d6', color: '#ec4899' });
  bedroomWithCloset('Bunk Room', 27, 41, { wall: '#dbe6ec', color: '#ec4899' });
  room('Upstairs Hall', 0, 15, 41, 19, { color: '#94a3b8' });
  room('Landing', 25, 19, 41, 22, { color: '#94a3b8' });
  room('Landing', 37.5, 22, 41, 25.5, { color: '#94a3b8' });
  room('Stair', 25, 22, 37.5, 25.5, { color: '#94a3b8' });
  room('Loft', 0, 19, 16, D, { wall: '#efe9dc', color: '#f59e0b' });
  room('Hall Bath', 16, 19, 25, 28, { floor: 'tile', floorColor: '#b9b4aa', wall: '#dfe9ea', color: '#06b6d4' });
  room('Kids Study', 16, 28, 25, D, { color: '#22c55e' });
  room('Kids Study', 25, 25.5, 34, D, { color: '#22c55e' });
  room('Laundry', 34, 25.5, 41, 33, { floor: 'tile', floorColor: '#8d8c88', wall: '#e9e6dc', color: '#06b6d4' });
  room('Linen', 34, 33, 41, D, { color: '#64748b' });
  room('Primary Bedroom', 41, 0, W, 18, { wall: '#e4e6e1', color: '#3b82f6' });
  room('Primary Vestibule', 41, 18, 49, 24, { color: '#94a3b8' });
  room('Primary Closet', 41, 24, 49, D, { color: '#8b5cf6' });
  room('Primary Bath', 49, 18, W, D, { floor: 'tile', floorColor: '#c8c3b8', wall: '#dfe7e4', color: '#06b6d4' });
  room('Primary Deck', 42, -14, W, 0, { ...OUT, floor: 'deck', floorColor: '#a68b6c', color: '#a16207' });

  chain([[0, 0], [W, 0], [W, D], [0, D], [0, 0]], { ext: true, t: EXT });
  wall(13, 0, 13, 15); wall(27, 0, 27, 15); wall(0, 15, 41, 15); wall(41, 0, 41, D);
  wall(0, 19, 25, 19); wall(16, 19, 16, D); wall(16, 28, 25, 28); wall(25, 19, 25, 28);
  wall(25, 25.5, 41, 25.5); wall(34, 25.5, 34, D); wall(34, 33, 41, 33);
  wall(41, 18, W, 18); wall(41, 24, 49, 24); wall(49, 18, 49, D);

  // openings
  for (const x of [4, 9, 17, 23]) win(x, 0, 0, {});
  for (const x of [32.5, 35.5]) win(x, 0, 0, { w: 2.6 });
  for (const x of [44.6, 55.4]) win(x, 0, 0, { w: 2.6 });
  item('french-door', 50, 0, { rot: 0, w: 5, label: 'Doors to Primary Deck' });
  win(0, 4, 90, {});
  for (const y of [23.5, 33.5]) win(0, y, 90, {});
  for (const y of [5, 13]) win(W, y, 90, { label: 'Window (morning sun)' });
  win(W, 31.5, 90, { type: 'window-sm', lift: 4.6, grid: false });
  for (const x of [4, 11, 20, 30]) win(x, D, 0, {});
  for (const x of [0, W]) win(x, 19, 90, { type: 'window-sm', lift: 10.8, w: 2.4, height: 3, label: 'Attic Window' });
  arch(8, 19, 0, 8, { label: 'Loft opening' });
  door(19.5, 19, 0, { w: 3, open: 70, rot: 180 });
  arch(16, 33, 90, 5, { label: 'Study opening' });
  door(39.25, 25.5, 0, { w: 3, open: 70, rot: 180, label: 'Laundry Door' });
  door(36, 33, 0, { w: 2.4, open: 70, rot: 180, label: 'Linen Door' });
  door(41, 21.25, 90, { w: 3, open: 75, rot: -90, label: 'Primary Suite Door' });
  arch(45, 18, 0, 4, { label: 'To bedroom' });
  arch(45, 24, 0, 3, { label: 'To closet' });
  door(49, 21, 90, { w: 3, open: 70, rot: -90, label: 'Primary Bath Door' });

  item('stair-opening', 31.25, 23.75, { rot: 90, w: 3.5, d: 12.5, rails: [] });
  item('railing', 31.3, 22, { w: 12.2, height: 3 });
  for (const [x, y, r] of [[42.2, -6.85, 90], [W - 0.2, -6.85, 90], [50, -13.8, 0]]) item('railing', x, y, { rot: r, w: r ? 13.1 : 15, height: 3.2, label: 'Deck Railing' });

  // Primary bedroom (clear 41.19..57.75 × 0.25..17.81): king bed facing the east windows
  item('rug-8x10', 46.2, 9, { rot: 90, w: 9, d: 12, color: '#c9c3b8' });
  item('bed-king', 41 + p + 3.5, 9, { rot: -90, color: '#e8e4da', color2: '#f7f5f0', headboard: 4 });
  item('nightstand-w', 41 + p + 0.8, 4.6, { rot: -90 }); item('nightstand-w', 41 + p + 0.8, 13.4, { rot: -90 });
  item('table-lamp', 41 + p + 0.8, 4.6, { lift: 2.1, color: '#9fb3c3' }); item('table-lamp', 41 + p + 0.8, 13.4, { lift: 2.1, color: '#9fb3c3' });
  item('bench-foot', 49.0, 9, { rot: 90, w: 4.6, label: 'Upholstered Bench', color: '#9fb3c3', color2: '#7a5233' });
  item('armchair', 55.6, 6.2, { rot: 115, color: '#d8c8a8' }); item('armchair', 55.6, 11.8, { rot: 65, color: '#d8c8a8' });
  item('side-table', 56.1, 9, {});
  item('dresser-w', 53.2, 18 - p - 0.85, { rot: 180, w: 5.4 });
  item('tv', 53.2, 18 - p - 0.2, { rot: 180, w: 4.6, lift: 4.3 });
  item('ceiling-light', 49, 9, {});
  item('lounge-chair', 46.5, -5, { rot: 30, color2: '#f3f1ec' }); item('lounge-chair', 50.5, -4.4, { rot: -15, color2: '#f3f1ec' });
  item('side-table', 48.5, -7.7, {});
  item('planter', 56.8, -12.8, { color: '#5b7fc9' }); item('planter', 43.2, -12.8, { color: '#f3f1ec' });
  // Primary closet & vestibule
  item('closet-sys', 41 + p + 1.0, 31.4, { rot: -90, w: 12.6, d: 2 });
  item('closet-sys', 49 - p - 1.0, 31.4, { rot: 90, w: 12.6, d: 2 });
  item('closet-sys', 45, D - e - 1.0, { rot: 180, w: 3.4, d: 2 });
  item('ottoman', 45, 30, { w: 2.2, d: 2.2, color: '#c9c3b8' });
  item('ceiling-light', 45, 31, {}); item('ceiling-light', 45, 21, {});
  item('rug-runner', 45, 21, { rot: 90, w: 2.5, d: 5, color: '#9fb3c3' });
  // Primary bath: 7' × 4½' shower with two heads, double vanity, soaking tub, toilet, linen tower
  item('shower', 53.5, D - e - 2.25, { rot: 180, w: 7, d: 4.5, heads: 2, color: '#f2f1ec', label: 'Walk-in Shower (2 heads)' });
  item('vanity', W - e - 0.95, 25, { rot: 90, w: 6.5, d: 1.9, color: '#f3f1ec', color2: '#e9e7e2', label: 'Double Vanity' });
  item('mirror', W - e - 0.08, 23.4, { rot: 90, w: 2.4, height: 3 }); item('mirror', W - e - 0.08, 26.6, { rot: 90, w: 2.4, height: 3 });
  item('bathtub', 49 + p + 1.3, 26.9, { rot: -90, w: 5.5, label: 'Soaking Tub' });
  item('toilet', W - e - 1.2, 31.2, { rot: 90 });
  item('pantry', 49 + p + 1.05, 30.9, { rot: -90, w: 2, label: 'Linen Tower' });
  item('ceiling-light', 53.5, 24, {}); item('ceiling-light', 53.5, 31, {});
  // Laundry: side-by-side machines, folding counter + sink; linen closet beyond
  item('washer', 34 + p + 1.25, 26.85, { rot: -90 }); item('dryer', 34 + p + 1.25, 29.15, { rot: -90 });
  item('upper-cab', 34 + p + 0.55, 28.0, { rot: -90, w: 4.4, lift: 5.2, height: 2.4 });
  item('counter', 41 - p - 1.05, 29.5, { rot: 90, w: 1.8, label: 'Folding Counter' });
  item('sink-cab', 41 - p - 1.05, 31.55, { rot: 90, w: 2.3, label: 'Laundry Sink' });
  item('ceiling-light', 37.5, 29.2, {});
  item('closet-sys', 37.5, D - e - 0.8, { rot: 180, w: 6.4, d: 1.6, label: 'Linen Shelves' });
  item('ceiling-light', 37.5, 35.5, {});
  // Hall bath (kids)
  item('bathtub', 16 + p + 2.5, 28 - p - 1.3, { rot: 180 });
  item('toilet', 25 - p - 1.2, 23.9, { rot: 90 });
  item('vanity-w', 16 + p + 0.85, 21.8, { rot: -90, w: 4.5, label: 'Double Vanity' });
  item('mirror', 16 + p + 0.08, 21.8, { rot: -90, w: 4, height: 2.6, color: '#f3f1ec' });
  item('pantry', 25 - p - 1.05, 20.4, { rot: 90, w: 2, label: 'Linen Cabinet' });
  item('ceiling-light', 20.5, 23.5, {});
  // Rear bedrooms
  const kidsRoom = (x0, x1, c) => {
    item('bed-queen', x1 - p - 3.5, 6.5, { rot: 90, color: c, pattern: 'stripes' });
    item('nightstand', x1 - p - 0.9, 2.6, { rot: 90 }); item('nightstand', x1 - p - 0.9, 10.4, { rot: 90 });
    const w0 = x0 === 0 ? e : p;
    item('dresser', x0 + w0 + 0.8, 9.6, { rot: -90, w: 4 });
    item('desk', x0 + w0 + 2.3, e + 1.0, { rot: 0, w: 4 });
    item('office-chair', x0 + w0 + 2.3, 3.0, { rot: 180 });
    item('rug-5x8', (x0 + x1) / 2, 7, { rot: 90, color: '#a98d6b' });
    item('ceiling-light', (x0 + x1) / 2, 7.5, {});
  };
  kidsRoom(0, 13, '#5f7a8a');
  kidsRoom(13, 27, '#a85f5f');
  // Bunk room (starts as the kids' bunk room)
  item('bed-bunk', 27 + p + 1.7, e + 3.4, { color: '#3d5a8a' });
  item('bed-bunk', 41 - p - 1.7, e + 3.4, { color: '#4f6a4f' });
  item('rug-round', 34, 8, {});
  item('cube-shelf', 41 - p - 0.6, 10.6, { rot: 90, w: 4 });
  item('pouf', 32.5, 9, { color: '#e0a030' }); item('pouf', 35.5, 9.2, { color: '#5b8fa8' });
  item('ceiling-light', 34, 7.5, {});
  // Loft: game & movie hangout
  item('tv-stand', e + 0.8, 28.5, { rot: -90 });
  item('tv', e + 0.2, 28.5, { rot: -90, w: 5, lift: 3.4 });
  item('sofa-3', 10, 28.5, { rot: 90, color: '#5f7a8a' });
  item('coffee-table', 6.2, 28.5, { rot: 90 });
  item('pouf', 6.2, 32.3, { color: '#d8d2c6' });
  item('bookshelf', 7.5, D - e - 0.55, { rot: 180 });
  item('rug-8x10', 7, 28.5, { rot: 90, color: '#a89f94' });
  item('ceiling-light', 8, 28, {});
  // Kids study
  for (const x of [20, 30]) { item('desk', x, D - e - 1.05, { rot: 180, w: 4 }); item('office-chair', x, D - e - 2.9, { rot: 0 }); }
  item('bookshelf', 34 - p - 0.55, 29.5, { rot: 90 });
  item('ceiling-light', 25, 33, {});
  // Hall & landing
  for (const x of [6, 18, 30, 39]) item('ceiling-light', x, 17, {});
  item('rug-runner', 20, 17, { rot: 90, w: 2.5, d: 10, color: '#9fb3c3' });

  // ═══ ROOFS ════════════════════════════════════════════════════════════════
  // Main: 9/12 gable, ridge east–west, solar on the south slope. Garage: gable to the street.
  // Porch: low double-pitch roof along the front.
  roof({ name: 'Main roof', x: -e, y: -e, w: W + EXT, d: D + EXT, axis: 'x', eave: 18, ridge: 18 + (D / 2 + e + 0.75) * 0.75, solar: true });
  roof({ name: 'Garage roof', x: -24 - e, y: 4 - e, w: 24 - e, d: 26 + EXT, axis: 'y', eave: 8.75, ridge: 17, clipWalls: false });
  roof({ name: 'Porch roof', x: 13.5, y: D + 0.75, w: 31, d: 6.5, axis: 'x', eave: 9.25, ridge: 12.25, clipWalls: false });

  return { floors, activeFloor: 1, site };
}
