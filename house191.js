// Preset: 191 Webster St, Marshfield MA — 3 bed / 2 bath Cape with rear dormer,
// dining addition, attached 2-car garage, decks and yard. Laid out in feet from the
// listing floor plan: plan +x = left→right as drawn, plan +y = rear (top) → street (bottom).
// Main block 32'3" × 23'0" (matches the basement). Dimensions are approximate.
import { CATALOG_BY_TYPE } from './furniture.js';

export const GROUND = -1.25;            // grade, relative to the 1st-floor surface

export function buildHouse191() {
  let n = 0;
  const id = p => `${p}${(++n).toString(36)}h`;
  const floors = [
    { id: 'L0', name: 'Basement', short: 'B',   elev: -8, height: 8, extFinish: 'concrete', rooms: [], walls: [], furniture: [] },
    { id: 'L1', name: '1st Floor', short: '1',  elev: 0,  height: 8, rooms: [], walls: [], furniture: [] },
    { id: 'L2', name: '2nd Floor', short: '2',  elev: 9,  height: 8, rooms: [], walls: [], furniture: [] },
  ];
  let F = floors[1];
  const on = i => { F = floors[i]; };

  const room = (name, x, y, w, h, o = {}) => F.rooms.push({
    id: id('r'), name, x, y, width: w, height: h, color: o.color ?? '#3b82f6',
    floorMat: o.floor ?? 'oak', floorColor: o.floorColor, wallColor: o.wall ?? '#ecebe6', wallFinish: o.wallFinish ?? 'paint',
    ceiling: o.ceiling ?? true, offset: o.offset ?? 0, outdoor: !!o.outdoor, autoWalls: false,
  });
  const wall = (x1, y1, x2, y2, o = {}) => F.walls.push({
    id: id('w'), x1, y1, x2, y2, thick: o.t ?? 0.4, height: o.h ?? null, base: o.base ?? 0, ext: !!o.ext,
    ...(o.finishA && { finishA: o.finishA, colorA: o.colorA }), ...(o.finishB && { finishB: o.finishB, colorB: o.colorB }),
  });
  const chain = (pts, o) => { for (let i = 0; i < pts.length - 1; i++) wall(...pts[i], ...pts[i + 1], o); };
  const item = (type, x, y, o = {}) => {
    const cat = CATALOG_BY_TYPE[type];
    const it = { id: id('f'), type, label: o.label ?? cat.label, x, y, width: o.w ?? cat.width, depth: o.d ?? cat.depth,
      rotation: (o.rot ?? 0) * Math.PI / 180, color: o.color ?? cat.color };
    for (const k of ['color2', 'height', 'lift', 'pattern', 'open', 'grid', 'glass', 'stacked', 'umbrella', 'style', 'rails', 'rail', 'ceil', 'shutters', 'curtain', 'headboard', 'footboard'])
      if (o[k] !== undefined) it[k] = o[k];
    F.furniture.push(it);
    return it;
  };
  // Opening helpers — rot 0 for walls running along x, 90 for walls along y
  const win = (x, y, rot, o = {}) => item(o.type ?? 'window', x, y, { rot, ...o });
  const door = (x, y, rot, o = {}) => item(o.type ?? 'door-single', x, y, { rot, ...o });

  const SIDING = '#5f7180';
  const site = {
    ground: GROUND, groundFloor: 1, sidingColor: SIDING, trimColor: '#f7f6f2',
    lot: { x: -60, y: -110, w: 190, h: 215 },
    roofs: [],
  };
  const roof = o => site.roofs.push({ id: id('g'), finish: 'shingle', color: '#4d4b4a', overhang: 0.75, noGable: [], ...o });

  // ═══ BASEMENT ════════════════════════════════════════════════════════════
  on(0);
  room('Basement', 0, 0, 32.25, 23, { floor: 'concrete', wallFinish: 'concrete', wall: '#c9c5bd', ceiling: false, color: '#64748b' });
  room('Storage', 0, -12.6, 14, 12.6, { floor: 'concrete', wallFinish: 'concrete', wall: '#c9c5bd', ceiling: false, color: '#78716c' });
  const fnd = { t: 0.8, ext: true };
  chain([[0, 0], [0, 23], [32.25, 23], [32.25, 0], [14, 0]], fnd);
  chain([[0, 0], [0, -12.6], [14, -12.6], [14, 0]], fnd);
  wall(0, 0, 14, 0, { t: 0.8 });
  item('arch', 10, 0, { w: 3, height: 6.5, rot: 0 });
  door(0, -8, 90, { lift: 0, height: 6.5, open: 60 });                 // to bulkhead
  win(6, 23, 0, { type: 'window-bsmt' }); win(26, 23, 0, { type: 'window-bsmt' });
  win(32.25, 12, 90, { type: 'window-bsmt' }); win(24, 0, 0, { type: 'window-bsmt' });
  win(7, -12.6, 0, { type: 'window-bsmt' });
  item('joists', 16.12, 11.5, { w: 31.5, d: 22.4 });
  item('joists', 7, -6.3, { w: 13.2, d: 11.8, label: 'Joists (storage)' });
  item('boiler', 26.5, 2.4, { rot: 0 });
  item('water-heater', 23.2, 1.7);
  item('elec-panel', 20.5, 0.6, { lift: 3.5 });
  item('metal-shelf', 31.3, 8, { rot: -90 });
  item('metal-shelf', 31.3, 13, { rot: -90 });
  item('utility-sink', 29, 1.4);
  item('post', 10.5, 11.5, { w: 0.35, d: 0.35, color: '#5d6167' });
  item('post', 21.5, 11.5, { w: 0.35, d: 0.35, color: '#5d6167' });
  item('metal-shelf', 2, -4, { rot: 90 });
  item('metal-shelf', 2, -9, { rot: 90, color: '#d5d7da' });
  item('workbench', 9, -11.3, { rot: 0 });
  item('trash-bin', 4, 21.5, { label: 'Dehumidifier', color: '#e8e8e8', w: 1.4, d: 1.2, height: 2 });

  // ═══ 1ST FLOOR ═══════════════════════════════════════════════════════════
  on(1);
  room('Living Room', 0, 11.5, 16.5, 11.5, { wall: '#e6e4dd', color: '#3b82f6' });
  room('Foyer / Stairs', 16.5, 11.5, 3, 11.5, { wall: '#e6e4dd', color: '#94a3b8' });
  room('Closet', 19.5, 11.5, 2.25, 11.5, { wall: '#ecebe6', color: '#64748b' });
  room('Kitchen', 9.1, 0, 15.9, 11.5, { wall: '#d9dbdc', color: '#22c55e' });
  room('Breakfast Nook', 0, 0, 9.1, 11.5, { wall: '#d9dbdc', color: '#84cc16' });
  room('Dining Room', 0, -13.4, 14.4, 13.4, { wall: '#dcc896', color: '#f59e0b', ceiling: false });
  room('Bath', 25, 0, 7.25, 7.75, { floor: 'tile', floorColor: '#7d7b76', wall: '#eadfc3', color: '#06b6d4' });
  room('Hall', 25, 7.75, 7.25, 3.75, { wall: '#e6e4dd', color: '#94a3b8' });
  room('Mudroom', 32.25, 3.5, 4.25, 8, { floor: 'tile', floorColor: '#7d7b76', wall: '#e6e4dd', color: '#94a3b8' });
  room('Bedroom', 21.75, 11.5, 10.5, 11.5, { wall: '#ead9a2', color: '#ec4899' });
  room('Garage', 42, -3.5, 25.75, 27.5, { floor: 'concrete', wallFinish: 'framing', wall: '#c99a66', offset: -1, ceiling: false, color: '#78716c' });
  room('Rear Deck', 14.4, -17.25, 27.6, 17.25, { floor: 'deck', offset: -0.5, outdoor: true, ceiling: false, color: '#a16207' });
  room('Covered Porch', 32.25, 11.5, 9.75, 12, { floor: 'deck', offset: -0.4, outdoor: true, ceiling: false, color: '#a16207' });
  room('Driveway', 42, 24, 25.75, 58, { floor: 'asphalt', offset: -1.2, outdoor: true, ceiling: false, color: '#525252' });
  room('Front Walk', 16.5, 25.5, 3.2, 56.5, { floor: 'stone', offset: -1.2, outdoor: true, ceiling: false, color: '#a8a29e' });
  room('Webster St', -60, 82, 190, 22, { floor: 'asphalt', floorColor: '#3c3c3e', offset: -1.22, outdoor: true, ceiling: false, color: '#3f3f46' });

  const E1 = { ext: true, h: 10.5, t: 0.5 };
  chain([[0, 0], [0, 23], [32.25, 23], [32.25, 11.5]], E1);
  wall(32.25, 3.5, 32.25, 0, E1);
  wall(32.25, 0, 14.4, 0, E1);
  wall(14.4, 0, 0, 0, { t: 0.5, h: 8 });                                    // nook/kitchen ↔ dining
  chain([[0, 0], [0, -13.4], [14.4, -13.4], [14.4, 0]], { ext: true, h: 9, t: 0.5 });
  chain([[32.25, 3.5], [36.5, 3.5], [36.5, 11.5], [32.25, 11.5]], { ext: true, h: 8.25, t: 0.5 }); // mudroom bump-out
  wall(32.25, 3.5, 32.25, 7.75);                                           // bath ↔ mudroom
  wall(25, 0, 25, 7.75);                                                   // bath W
  wall(25, 7.75, 32.25, 7.75);                                             // bath N
  wall(16.5, 11.5, 16.5, 21.25);                                           // stair L
  wall(19.5, 11.5, 19.5, 23);                                              // stair R
  wall(16.5, 11.5, 19.5, 11.5);                                            // basement door wall
  wall(19.5, 11.5, 32.25, 11.5);                                           // hall ↔ bedroom
  wall(21.75, 11.5, 21.75, 23);                                            // bedroom W
  const G = { ext: true, h: 9.5, base: -1, t: 0.5 };
  chain([[42, 24], [67.75, 24], [67.75, -3.5], [42, -3.5], [42, 24]], G);

  // Openings
  door(18, 23, 0, { type: 'door-ext', color: '#d9b44a', label: 'Front Door' });
  item('arch', 16.5, 22.1, { rot: 90, w: 1.6, label: 'Opening to living' });
  win(4.2, 23, 0); win(10.6, 23, 0); win(27, 23, 0);
  win(0, 5.4, 90, { lift: 3.5, height: 3.6 }); win(0, 2.2, 90, { lift: 3.5, height: 3.6, w: 2.4 }); win(0, 8.6, 90, { lift: 3.5, height: 3.6, w: 2.4 });
  win(0, 12.6, 90, { type: 'window-sm' });
  win(18.6, 0, 0, { w: 3.6, lift: 3.7, height: 3.4, label: 'Window over sink' });
  win(22.6, 0, 0, { type: 'window-sm', lift: 4.3, w: 2 });
  win(29.6, 0, 0, { type: 'window-sm', lift: 4.5, w: 2.4, grid: false });
  win(32.25, 14.2, 90, { w: 2.6 }); win(32.25, 20.8, 90, { w: 2.6 });
  item('arch', 7, 0, { rot: 0, w: 7, height: 7, label: 'Opening to dining' });
  win(0, -4, 90, { w: 3.2, lift: 2.4, height: 5 }); win(0, -9.6, 90, { w: 3.2, lift: 2.4, height: 5 });
  win(3.6, -13.4, 0, { w: 3, lift: 2.4, height: 5 }); win(7.2, -13.4, 0, { w: 3, lift: 2.4, height: 5 }); win(10.8, -13.4, 0, { w: 3, lift: 2.4, height: 5 });
  item('sliding-door', 14.4, -4.6, { rot: 90, w: 6 });
  win(14.4, -10.6, 90, { w: 3, lift: 2.4, height: 5 });
  door(28.6, 7.75, 0, { open: 75 });                                       // bath
  door(18, 11.5, 0, { open: 0, label: 'Basement Door' });
  door(29.6, 11.5, 0, { open: 80, rot: 180 });                             // bedroom
  item('door-double', 21.75, 15.4, { rot: 90, w: 4, label: 'Closet Doors' });
  door(34.4, 11.5, 0, { type: 'door-ext', label: 'Side Door' });
  win(36.5, 7.5, 90, { type: 'window-sm' });
  item('garage-door', 48.6, 24, { rot: 0, lift: -1 });
  item('garage-door', 61.2, 24, { rot: 0, lift: -1 });
  door(42, 17.5, 90, { type: 'door-ext', lift: -0.4, label: 'Garage Entry' });
  door(47, -3.5, 0, { type: 'door-ext', lift: -1, label: 'Garage Rear Door' });
  win(60, -3.5, 0, { lift: 2.5 }); win(67.75, 10, 90, { lift: 2.5 });

  // Stairs: main flight climbs from the foyer toward the rear; basement flight descends beneath it
  item('stairs', 18, 17, { w: 3, d: 8.5, height: 9, rot: 0 });
  item('stairs-down', 18, 17, { w: 3, d: 8.5, height: 8, rot: 0, rails: [] });

  // Living room
  item('fireplace', 0.8, 17.25, { rot: -90, w: 5.5, height: 8 });
  item('chimney', -1.25, 17.25, { rot: 90, lift: GROUND, height: 25.5 });
  item('builtins', 0.7, 13.2, { rot: -90, w: 2.8 });
  item('builtins', 0.7, 21.3, { rot: -90, w: 2.8 });
  item('tv', 1.75, 17.25, { rot: -90, w: 4.6, lift: 4.7 });
  item('rug-8x10', 8, 17.4, { rot: 90, color: '#a7836a' });
  item('sofa-l', 8.4, 18.6, { rot: 180, w: 10, d: 8 });
  item('recliner', 5, 13.9, { rot: -60 });
  item('ottoman', 7.6, 17, { label: 'Storage Ottoman', w: 2.6, d: 2.2 });
  item('side-table', 2.6, 22, {});
  item('floor-lamp', 14.6, 21.9, {});
  item('curtains', 4.2, 22.6, { color: '#8ba0b8' });
  item('curtains', 10.6, 22.6, { color: '#8ba0b8' });
  item('ceiling-light', 8.2, 17.2, {});

  // Kitchen
  item('fridge', 11.0, 1.35, { rot: 0 });
  item('counter', 14.15, 1.05, { w: 3.2 });
  item('counter', 16.25, 1.05, { w: 1 });
  item('sink-cab', 18.6, 1.05, { w: 3.6 });
  item('dishwasher', 21.4, 1.05);
  item('counter', 23.6, 1.05, { w: 2.4 });
  item('counter', 23.95, 3.15, { rot: 90, w: 2.1, label: 'Corner Counter' });
  item('stove', 23.9, 5.45, { rot: 90 });
  item('counter', 23.95, 7.5, { rot: 90, w: 1.6 });
  item('range-hood', 24.15, 5.45, { rot: 90 });
  item('upper-cab-glass', 14.5, 0.55, { w: 3 });
  item('upper-cab', 16.2, 0.55, { w: 0.6, height: 2.7 });
  item('upper-cab-glass', 22.4, 0.55, { w: 2.4 });
  item('upper-cab', 24.45, 2.8, { rot: 90, w: 1.4 });
  item('kitchen-island', 17.2, 6.4, { rot: 180, w: 6.5, d: 3.8 });
  item('bar-stool', 15.3, 8.9, { rot: 180 });
  item('bar-stool', 17.2, 8.9, { rot: 180 });
  item('bar-stool', 19.1, 8.9, { rot: 180 });
  item('pendant', 15.6, 6.4, {}); item('pendant', 18.8, 6.4, {});
  item('builtin-desk', 1.05, 5.4, { rot: -90, w: 9.4, d: 2 });
  item('upper-cab', 0.55, 1.2, { rot: -90, w: 1.4, height: 3, lift: 4.3, label: 'Open Shelf' });
  item('upper-cab', 0.55, 9.6, { rot: -90, w: 1.4, height: 3, lift: 4.3, label: 'Open Shelf' });
  item('bar-stool', 2.8, 3.6, { rot: 90, height: 2.8 });
  item('bar-stool', 2.8, 7.2, { rot: 90, height: 2.8 });
  item('plant-sm', 6.5, 10.8, {});
  item('ceiling-light', 4.5, 5.6, {});

  // Dining room
  item('rug-8x10', 7.2, -6.8, { color: '#b5aca0' });
  item('dining-6', 7.2, -6.8, { rot: 90, w: 6, d: 3.6 });
  for (const [dx, dy, r] of [[-1.15, -1.8, 90], [-1.15, 0, 90], [-1.15, 1.8, 90], [1.15, -1.8, -90], [1.15, 0, -90], [1.15, 1.8, -90]])
    item('dining-chair', 7.2 + dx * 2, -6.8 + dy, { rot: r });
  item('hutch', 0.95, -8.6, { rot: -90, w: 4.2 });
  item('cube-shelf', 0.75, -2.6, { rot: -90, w: 3.4, height: 2.4 });
  item('sideboard', 7.2, -12.6, { label: 'Window Bench Table', w: 3.4, d: 1.3, height: 2.6, color: '#5a3a22' });
  item('plant-lg', 12.8, -12.2, { color: '#3e7d3a', height: 5.5 });
  item('plant-sm', 1.4, -12.3, {});
  item('pendant', 7.2, -6.8, { lift: 5.8, w: 1.4, height: 1.2, ceil: 11, label: 'Chandelier' });

  // 1st floor bedroom
  item('rug-5x8', 27.5, 17.5, { rot: 90, color: '#5f8a8a' });
  item('bed-queen', 28.8, 17.5, { rot: 90, color: '#4f6a4f', pattern: 'floral', color2: '#f3f1ec' });
  item('nightstand-w', 31.3, 14.0, { rot: 90 });
  item('nightstand-w', 31.3, 21.0, { rot: 90 });
  item('dresser-w', 27, 22.1, { rot: 180, w: 2.6, d: 1.6, height: 3.8, label: 'Chest of Drawers' });
  item('bench-foot', 24.9, 17.5, { rot: 90, label: 'Cedar Chest', color: '#8a5a3a', color2: '#8a5a3a', w: 3, d: 1.5 });
  item('wall-art', 28.8, 11.75, { rot: 0, w: 3, height: 1.4, color: '#7a9bb8' });
  item('ceiling-light', 27, 17.2, {});

  // Bath (1st)
  item('bathtub', 29.6, 1.35, { color: '#f2f2f0' });
  item('toilet', 31.0, 4.6, { rot: 90 });
  item('vanity', 25.95, 4.4, { rot: -90, w: 3.4, d: 1.8 });
  item('mirror', 25.3, 4.4, { rot: -90, w: 3, height: 2.6 });

  // Mudroom / hall
  item('bench-foot', 35.6, 7.4, { rot: 90, w: 3.5, label: 'Mudroom Bench', color: '#6f8296', color2: '#f3f1ec' });
  item('ceiling-light', 28.6, 9.6, {});

  // Garage
  item('lawn-tractor', 63.5, 4, { rot: 180 });
  item('metal-shelf', 45, -2.6, {});
  item('metal-shelf', 66.8, 17, { rot: -90 });
  item('workbench', 55, -2.3, { w: 7 });
  item('fridge', 50, -2.1, { label: 'Garage Fridge' });
  item('trash-bin', 43.3, 2, { rot: -90 });
  item('trash-bin', 43.3, 4.5, { rot: -90, color: '#2f5ea8', label: 'Recycling' });

  // Covered porch / decks
  item('post', 32.9, 23.1, {}); item('post', 41.4, 23.1, {});
  item('lantern', 37, 17.5, { lift: 6.3, ceil: 9.5 });
  item('steps', 37, 24.8, { w: 5, d: 2.5, height: 0.85, rot: 0, lift: GROUND });
  item('steps', 18, 24.3, { w: 4.5, d: 2.5, height: 1.25, rot: 0, lift: GROUND, color: '#9a5a44', label: 'Front Steps' });
  item('planter', 33.6, 20.5, {}); item('planter-box', 39.6, 14, { rot: -90 });
  item('patio-table', 19.5, -6.2, { umbrella: 'closed', w: 4, d: 3 });
  for (const [dx, dy, r] of [[-1.6, -2, 0], [1.6, -2, 0], [-1.6, 2, 180], [1.6, 2, 180]]) item('patio-chair', 19.5 + dx, -6.2 + dy, { rot: r, color2: '#9aa0a8' });
  item('grill', 26.5, -1.8, { rot: 0 });
  item('fire-table', 33.5, -9, {});
  item('lounge-chair', 33.5, -11.6, { rot: 0 }); item('lounge-chair', 33.5, -6.4, { rot: 180 });
  item('lounge-chair', 30.8, -9, { rot: -90 }); item('lounge-chair', 36.2, -9, { rot: 90 });
  item('planter', 39.5, -15.5, {}); item('planter', 15.5, -15.8, { color: '#c0392b' });
  item('steps', 28, -18.5, { w: 5, d: 2.5, height: 0.75, rot: 180, lift: GROUND });

  // Yard & landscaping
  item('bulkhead', -3.1, -8, { rot: 90, lift: GROUND });
  item('shed', 22, -64, { rot: 0 });
  item('kayak', 28.5, -63, { rot: 10 });
  item('fire-pit', 4, -40, {});
  for (const [x, y] of [[1, 24.6], [5, 24.8], [12.5, 24.8], [14.8, 24.6], [23, 24.7], [29, 24.8]]) item('shrub', x, y, {});
  item('hydrangea', 8.6, 25, {}); item('hydrangea', 26, 25, { color2: '#e07a3a' });
  for (const [x, y] of [[3, 26.2], [7, 26.4], [11, 26.2], [24.5, 26.2], [28.5, 26.4]]) item('hosta', x, y, {});
  for (let x = 0.5; x < 31; x += 1.6) item('boulder', x, 27.1, { w: 1, d: 0.8, height: 0.5 });
  item('mailbox', 39, 80, {});
  item('lamp-post', 15, 29, {});
  const trees = [
    ['tree', -28, 40], ['tree-birch', -18, 18], ['tree', 95, 60], ['tree-pine', 92, 10], ['tree', 88, -30], ['tree-pine', 100, -58],
    ['tree', -38, -10], ['tree-pine', -42, -45], ['tree', -30, -75], ['tree', -8, -92], ['tree-birch', 10, -88], ['tree', 34, -95],
    ['tree-pine', 52, -88], ['tree', 70, -92], ['tree', 86, -82], ['tree-birch', 60, -66], ['tree', 45, -70], ['tree-birch', -12, -60],
    ['tree', 105, 30], ['tree-pine', -50, 70], ['tree', 115, -10],
  ];
  for (const [t, x, y] of trees) item(t, x, y, { rot: (x * 37 + y * 11) % 360 });
  item('fence', 30, -104, { w: 120 });

  // ═══ 2ND FLOOR (rear shed dormer, front roof slope = knee wall at 20.2') ═════
  on(2);
  room('Primary Bedroom', 0.4, 7.75, 13.1, 12.45, { wall: '#c8cbcd', color: '#3b82f6', ceiling: false });
  room('W.I.C.', 0.4, 2.5, 8.5, 5.25, { wall: '#c8cbcd', color: '#8b5cf6', ceiling: false });
  room('Laundry', 8.9, 2.5, 3.5, 5.25, { floor: 'tile', floorColor: '#8d8c88', wall: '#e9e6dc', color: '#06b6d4', ceiling: false });
  room('Linen', 12.4, 2.5, 1.1, 5.25, { wall: '#ecebe6', color: '#64748b', ceiling: false });
  room('Bath', 13.5, 2.5, 6.25, 6.75, { floor: 'tile', floorColor: '#9b9b98', wall: '#bfe0e0', color: '#06b6d4', ceiling: false });
  room('Hall', 13.5, 9.25, 6.25, 3.25, { wall: '#ecebe6', color: '#94a3b8', ceiling: false });
  room('Storage', 13.5, 12.5, 3, 7.7, { wall: '#ecebe6', color: '#64748b', ceiling: false });
  room('Bedroom', 19.75, 2.5, 11.85, 17.7, { wall: '#5f6b7f', color: '#ec4899', ceiling: false });

  wall(31.95, 2.5, 0.3, 2.5, { ext: true, h: 8.5, t: 0.5 });              // rear dormer face
  wall(0, 20.2, 32.25, 20.2, { h: 5 });                                    // front knee wall
  wall(0.4, 7.75, 13.5, 7.75);
  wall(8.9, 2.5, 8.9, 7.75);
  wall(12.4, 2.5, 12.4, 7.75);
  wall(13.5, 2.5, 13.5, 20.2);
  wall(13.5, 9.25, 19.75, 9.25);
  wall(19.75, 2.5, 19.75, 20.2);
  wall(13.5, 12.5, 16.5, 12.5);
  wall(16.5, 12.5, 16.5, 20.2);

  item('stair-opening', 18.1, 16.6, { w: 3.2, d: 7.2, rails: [] });
  item('door-double', 4.6, 7.75, { rot: 0, w: 4, label: 'W.I.C. Doors' });
  item('door-double', 10.65, 7.75, { rot: 0, w: 3, label: 'Laundry Doors' });
  door(13.5, 11, 90, { open: 75 });
  door(15.2, 9.25, 0, { open: 70, w: 2.4, rot: 180 });
  door(19.75, 11, 90, { open: 75, rot: -90 });
  win(4.5, 2.5, 0, { type: 'window-sm', lift: 3.6 });
  win(16.6, 2.5, 0, { type: 'window-sm', lift: 4.2, w: 2, grid: false });
  win(26, 2.5, 0, { lift: 2.8, w: 2.8, height: 4 });
  win(0.2, 17.2, 90, { w: 2.6, height: 3.6, lift: 2.8 });
  win(32.05, 6.5, 90, { w: 2.6, height: 3.6, lift: 2.8 });

  // Primary bedroom
  item('rug-8x10', 6.2, 14, { rot: 90, color: '#9aa4b0' });
  item('bed-queen', 4.1, 14, { rot: -90, color: '#24438a', color2: '#f0eee8', pattern: 'solid', headboard: 3.4 });
  item('nightstand-w', 1.2, 10.7, { rot: -90, color: '#6b4a2f' });
  item('nightstand-w', 1.2, 17.3, { rot: -90, color: '#6b4a2f' });
  item('table-lamp', 1.2, 10.7, { lift: 2.1, color: '#4f8fa0' }); item('table-lamp', 1.2, 17.3, { lift: 2.1, color: '#4f8fa0' });
  item('fireplace-tv', 12.65, 13.6, { rot: 90, w: 4.5 });
  item('tv', 12.6, 13.6, { rot: 90, w: 4.2, lift: 2.6 });
  item('bench-foot', 8.7, 14, { rot: 90, w: 4, label: 'Upholstered Bench', color: '#6f7378', color2: '#2b2b2e' });
  item('mirror-floor', 10.5, 19.4, { rot: 180 });
  item('ceiling-light', 7, 12, {});
  item('closet-sys', 4.65, 3.6, { w: 8.2, d: 2 });
  item('closet-sys', 1.4, 5.8, { rot: -90, w: 2.4, d: 1.6, height: 7 });
  item('washer-stack', 10.65, 3.9, {});
  item('closet-sys', 12.95, 4.9, { rot: -90, w: 4.6, d: 0.9, label: 'Linen Shelves', height: 7 });

  // Bath (2nd)
  item('shower', 15.1, 4.3, { w: 3.2, d: 3.6 });
  item('toilet', 18.5, 3.8, { rot: 90 });
  item('vanity-w', 18.6, 8.3, { rot: 180, w: 2.3 });
  item('mirror', 18.6, 9.0, { rot: 180, w: 2, height: 2.6, color: '#f3f1ec' });

  // Bedroom 2
  item('rug-5x8', 26.5, 11.5, { rot: 90, color: '#a98d6b' });
  item('bed-queen', 28.1, 11.5, { rot: 90, color: '#2f5aa8', pattern: 'stripes' });
  item('nightstand', 31.0, 8.1, { rot: 90 }); item('nightstand', 31.0, 14.9, { rot: 90, w: 2.2 });
  item('table-lamp', 31.0, 14.9, { lift: 2.2, color: '#dfe6ea' });
  item('dresser', 24.5, 3.4, { w: 5.5 });
  item('chest', 30.4, 18.5, { rot: 180, w: 2.8 });
  item('antique-desk', 21.05, 15, { rot: -90 });
  item('office-chair', 22.9, 15, { rot: 90 });
  item('dining-chair', 22.6, 18.6, { rot: 135, label: 'Windsor Chair', color: '#b07a40', color2: '#1f2933' });
  item('plant-sm', 25.2, 3.1, { lift: 3 });
  item('ceiling-light', 25.5, 9.5, {});

  // ═══ ROOFS ════════════════════════════════════════════════════════════════
  // Main Cape: 12/12 gable, ridge along x, full-width shed dormer on the rear.
  roof({ name: 'Main roof', x: 0, y: 0, w: 32.25, d: 23, axis: 'x', eave: 10.5, ridge: 22.75,
    dormer: { x0: 0.3, x1: 31.95, wallY: 2.5, top: 17.5 }, ceilingAt: 17 });
  roof({ name: 'Dining roof', x: 0, y: -13.4, w: 14.4, d: 13.4, axis: 'y', eave: 9, ridge: 12.8, noGable: ['s'] });
  roof({ name: 'Porch roof', x: 32.25, y: 3.5, w: 9.75, d: 20, axis: 'y', eave: 8.25, ridge: 12, noGable: ['n'] });
  roof({ name: 'Garage roof', x: 42, y: -3.5, w: 25.75, d: 27.5, axis: 'y', eave: 8.5, ridge: 16.5 });

  return { floors, activeFloor: 1, site };
}
