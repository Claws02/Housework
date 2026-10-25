// Preset: 191 Webster St, Marshfield MA — 3 bed / 2 bath Cape with rear dormer,
// dining addition, attached 2-car garage, decks and yard. Units are feet.
// Plan +x = left→right as drawn on the listing plan, plan +y = rear (top) → street (bottom).
//
// Laid out from INTERIOR faces so every room's clear size matches the listing:
//   origin = inside face of the 1st-floor left & rear walls of the main block.
//   Exterior frame walls 6" (centre 3" outside the face), interior partitions 4.5",
//   foundation 9.6" flush with the siding above.
// Cross-checks: front row 19'7" living (incl. stair) + 2' closet + 10'6" bedroom + walls = 32.9';
// rear row 9'1" nook + 16' kitchen + 7'5" bath + wall = 32.9'; 2nd floor 13'10" + 6'3" + 12'2" + walls = 33.0';
// basement 32'3" clear = 32.9' less the thicker foundation walls.
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

  const EXT = 0.5, INT = 0.375, FND = 0.8;
  const W = 32.88, D = 23.04;              // main block clear interior (1st floor)
  const xL = -EXT / 2, xR = W + EXT / 2, yB = -EXT / 2, yF = D + EXT / 2;   // exterior wall centrelines
  const OUT = { x0: -EXT, x1: W + EXT, y0: -EXT, y1: D + EXT };         // outer faces (siding)

  // ═══ BASEMENT ════════════════════════════════════════════════════════════
  on(0);
  const fx0 = OUT.x0 + FND / 2, fx1 = OUT.x1 - FND / 2, fy0 = OUT.y0 + FND / 2, fy1 = OUT.y1 - FND / 2;
  const DIN = { x1: 14.42, y0: -EXT - 13.42 };   // dining addition clear: x 0..14.42, y −13.92..−0.5
  const dx1o = DIN.x1 + EXT, dy0o = DIN.y0 - EXT;  // its outer faces
  room('Basement', fx0, fy0, fx1 - fx0, fy1 - fy0, { floor: 'concrete', wallFinish: 'concrete', wall: '#c9c5bd', ceiling: false, color: '#64748b' });
  room('Storage', fx0, dy0o + FND / 2, dx1o - FND / 2 - fx0, fy0 - (dy0o + FND / 2), { floor: 'concrete', wallFinish: 'concrete', wall: '#c9c5bd', ceiling: false, color: '#78716c' });
  const fnd = { t: FND, ext: true };
  chain([[fx0, fy0], [fx0, fy1], [fx1, fy1], [fx1, fy0], [dx1o - FND / 2, fy0]], fnd);
  chain([[fx0, fy0], [fx0, dy0o + FND / 2], [dx1o - FND / 2, dy0o + FND / 2], [dx1o - FND / 2, fy0]], fnd);
  wall(fx0, fy0, dx1o - FND / 2, fy0, { t: FND });
  item('arch', 10, fy0, { w: 3, height: 6.5, rot: 0 });
  door(fx0, -9, 90, { lift: 0, height: 6.5, open: 60 });                 // to bulkhead
  win(6, fy1, 0, { type: 'window-bsmt' }); win(26.5, fy1, 0, { type: 'window-bsmt' });
  win(fx1, 12, 90, { type: 'window-bsmt' }); win(24.5, fy0, 0, { type: 'window-bsmt' });
  win(7, dy0o + FND / 2, 0, { type: 'window-bsmt' });
  item('joists', (fx0 + fx1) / 2, (fy0 + fy1) / 2, { w: fx1 - fx0 - 0.8, d: fy1 - fy0 - 0.8 });
  item('joists', 7.2, -7.2, { w: 13.6, d: 12.6, label: 'Joists (storage)' });
  item('boiler', 27, 2.5, { rot: 0 });
  item('water-heater', 23.6, 1.6);
  item('elec-panel', 20.8, 0.55, { lift: 3.5 });
  item('metal-shelf', 31.8, 8, { rot: -90 });
  item('metal-shelf', 31.8, 13, { rot: -90 });
  item('utility-sink', 29.6, 1.4);
  item('post', 10.8, 11.3, { w: 0.35, d: 0.35, color: '#5d6167' });
  item('post', 22, 11.3, { w: 0.35, d: 0.35, color: '#5d6167' });
  item('metal-shelf', 1.1, -4.2, { rot: 90 });
  item('metal-shelf', 1.1, -9.8, { rot: 90 });
  item('workbench', 8.6, -12.2, { rot: 0 });
  item('trash-bin', 4, 21.6, { label: 'Dehumidifier', color: '#e8e8e8', w: 1.4, d: 1.2, height: 2 });

  // ═══ 1ST FLOOR ═══════════════════════════════════════════════════════════
  on(1);
  // key lines (interior faces & partition centrelines)
  const xStairL = 16.58 - INT / 2, xStairR = 19.58 + INT / 2;      // stair: 3'0" clear between 16.58 and 19.58
  const xBedW = 21.96 + INT / 2;                                    // closet 19.96..21.96 (2'), bedroom 22.33..32.88 (10'6")
  const xBath = 25.08 + INT / 2;                                    // kitchen 9.08..25.08 (16'), bath 25.46..32.88 (7'5")
  const yRow = 11.25 + INT / 2;                                     // kitchen 0..11.25 (11'3"), bedroom 11.63..23.04 (11'5")
  const yBath = 7.83 + INT / 2;                                     // bath 0..7.83 (7'10")
  const BUMP = { x1: W + EXT + 4.58, y0: 11.25 - 8.58 };            // hall 12'0" × 8'7" = hall 7'5" + mudroom bump 4'7"
  const GAR = { x0: OUT.x1 + 9.42 + EXT, y0: -3.25, w: 25.75, d: 27.5 };   // porch deck 9'5" wide between house and garage
  const gx0 = GAR.x0 - EXT / 2, gx1 = GAR.x0 + GAR.w + EXT / 2, gy0 = GAR.y0 - EXT / 2, gy1 = GAR.y0 + GAR.d + EXT / 2;
  const DOOR_X = 14.6;                                              // front door (into the living room, beside the stair)

  room('Living Room', xL, yRow, xStairL - xL, yF - yRow, { wall: '#e6e4dd', color: '#3b82f6' });
  room('Stairs', xStairL, yRow, xStairR - xStairL, yF - yRow, { wall: '#e6e4dd', color: '#94a3b8' });
  room('Closet', xStairR, yRow, xBedW - xStairR, yF - yRow, { wall: '#ecebe6', color: '#64748b' });
  room('Kitchen', 9.08, yB, xBath - 9.08, yRow - yB, { wall: '#d9dbdc', color: '#22c55e' });
  room('Breakfast Nook', xL, yB, 9.08 - xL, yRow - yB, { wall: '#d9dbdc', color: '#84cc16' });
  room('Dining Room', xL, dy0o + EXT / 2, dx1o - EXT / 2 - xL, yB - (dy0o + EXT / 2), { wall: '#dcc896', color: '#f59e0b', ceiling: false });
  room('Bath', xBath, yB, xR - xBath, yBath - yB, { floor: 'tile', floorColor: '#7d7b76', wall: '#eadfc3', color: '#06b6d4' });
  room('Hall', xBath, yBath, xR - xBath, yRow - yBath, { wall: '#e6e4dd', color: '#94a3b8' });
  room('Mudroom', xR, BUMP.y0 - EXT / 2, BUMP.x1 + EXT / 2 - xR, yRow - (BUMP.y0 - EXT / 2), { floor: 'tile', floorColor: '#7d7b76', wall: '#e6e4dd', color: '#94a3b8' });
  room('Bedroom', xBedW, yRow, xR - xBedW, yF - yRow, { wall: '#ead9a2', color: '#ec4899' });
  room('Garage', gx0, gy0, gx1 - gx0, gy1 - gy0, { floor: 'concrete', wallFinish: 'framing', wall: '#c99a66', offset: -1, ceiling: false, color: '#78716c' });
  room('Rear Deck', dx1o - EXT / 2, -EXT - 17.25, 27.83 + EXT / 2, 17.25 + EXT / 2, { floor: 'deck', offset: -0.5, outdoor: true, ceiling: false, color: '#a16207' });
  room('Covered Porch', OUT.x1, 8.5, gx0 - OUT.x1, 15.25, { floor: 'deck', offset: -0.4, outdoor: true, ceiling: false, color: '#a16207' });
  room('Driveway', gx0, gy1, gx1 - gx0, 82 - gy1, { floor: 'asphalt', offset: -1.2, outdoor: true, ceiling: false, color: '#525252' });
  room('Front Walk', DOOR_X - 1.6, OUT.y1 + 2.4, 3.2, 82 - OUT.y1 - 2.4, { floor: 'stone', offset: -1.2, outdoor: true, ceiling: false, color: '#a8a29e' });
  room('Webster St', -60, 82, 190, 22, { floor: 'asphalt', floorColor: '#3c3c3e', offset: -1.22, outdoor: true, ceiling: false, color: '#3f3f46' });

  const E1 = { ext: true, h: 10.5, t: EXT };
  chain([[xL, yB], [xL, yF], [xR, yF], [xR, yRow + INT / 2 + 0.01]], E1);
  wall(xR, BUMP.y0 - EXT / 2, xR, yB, E1);
  wall(xR, yB, dx1o - EXT / 2, yB, E1);
  wall(dx1o - EXT / 2, yB, xL, yB, { t: EXT, h: 8 });                       // nook/kitchen ↔ dining (old exterior wall)
  chain([[xL, yB], [xL, dy0o + EXT / 2], [dx1o - EXT / 2, dy0o + EXT / 2], [dx1o - EXT / 2, yB]], { ext: true, h: 9, t: EXT });
  chain([[xR, BUMP.y0 - EXT / 2], [BUMP.x1 + EXT / 2, BUMP.y0 - EXT / 2], [BUMP.x1 + EXT / 2, yRow + INT / 2 + 0.01], [xR, yRow + INT / 2 + 0.01]], { ext: true, h: 8.25, t: EXT });
  const P = { t: INT };
  wall(xR, BUMP.y0 - EXT / 2, xR, yBath, { t: EXT });                      // bath ↔ mudroom
  wall(xBath, yB, xBath, yBath, P);
  wall(xBath, yBath, xR, yBath, P);
  wall(xStairL, yRow, xStairL, 20.4, P);                                    // stair L (open at the bottom to the living room)
  wall(xStairR, yRow, xStairR, yF, P);
  wall(xStairL, yRow, xStairR, yRow, P);                                    // basement door wall
  wall(xStairR, yRow, xR, yRow, P);
  wall(xBedW, yRow, xBedW, yF, P);
  chain([[gx0, gy1], [gx1, gy1], [gx1, gy0], [gx0, gy0], [gx0, gy1]], { ext: true, h: 9.5, base: -1, t: EXT });

  // Openings
  door(DOOR_X, yF, 0, { type: 'door-ext', color: '#d9b44a', label: 'Front Door' });
  win(3.6, yF, 0); win(8.6, yF, 0); win(27.6, yF, 0);
  win(xL, 2.2, 90, { lift: 3.5, height: 3.6, w: 2.4 }); win(xL, 5.6, 90, { lift: 3.5, height: 3.6 }); win(xL, 9.0, 90, { lift: 3.5, height: 3.6, w: 2.4 });
  win(18.6, yB, 0, { w: 3.6, lift: 3.7, height: 3.4, label: 'Window over sink' });
  win(22.7, yB, 0, { type: 'window-sm', lift: 4.3, w: 2 });
  win(30.2, yB, 0, { type: 'window-sm', lift: 4.5, w: 2.4, grid: false });
  win(xR, 14.4, 90, { w: 2.6 }); win(xR, 20.4, 90, { w: 2.6 });
  item('arch', 7.2, yB, { rot: 0, w: 7, height: 7, label: 'Opening to dining' });
  const dyO = dy0o + EXT / 2, dxO = dx1o - EXT / 2;
  win(xL, -4.4, 90, { w: 3.2, lift: 2.4, height: 5 }); win(xL, -10, 90, { w: 3.2, lift: 2.4, height: 5 });
  win(3.6, dyO, 0, { w: 3, lift: 2.4, height: 5 }); win(7.21, dyO, 0, { w: 3, lift: 2.4, height: 5 }); win(10.8, dyO, 0, { w: 3, lift: 2.4, height: 5 });
  item('sliding-door', dxO, -4.8, { rot: 90, w: 6 });
  win(dxO, -11, 90, { w: 3, lift: 2.4, height: 5 });
  door(29, yBath, 0, { open: 75 });                                         // bath
  door(18.08, yRow, 0, { open: 0, label: 'Basement Door' });
  door(30.4, yRow, 0, { open: 80, rot: 180 });                              // bedroom
  item('door-double', xBedW, 15.8, { rot: 90, w: 3.6, label: 'Closet Doors' });
  door(35.6, yRow + INT / 2 + 0.01, 0, { type: 'door-ext', label: 'Side Door' });
  win(BUMP.x1 + EXT / 2, 6.6, 90, { type: 'window-sm' });
  item('garage-door', GAR.x0 + 6.4, gy1, { rot: 0, lift: -1 });
  item('garage-door', GAR.x0 + 19.35, gy1, { rot: 0, lift: -1 });
  door(gx0, 17.5, 90, { type: 'door-ext', lift: -0.4, label: 'Garage Entry' });
  door(GAR.x0 + 5, gy0, 0, { type: 'door-ext', lift: -1, label: 'Garage Rear Door' });
  win(GAR.x0 + 17, gy0, 0, { lift: 2.5 }); win(gx1, 10, 90, { lift: 2.5 });

  // Stairs: main flight climbs from the living-room end toward the rear and lands in the upstairs
  // hall at y = 13.58; the basement flight (8" risers, 9" treads) descends beneath it.
  const S = { x: 18.08, top: 13.58, bottom: 22.2 };
  item('stairs', S.x, (S.top + S.bottom) / 2, { w: 3, d: S.bottom - S.top, height: 9, rot: 0 });
  item('stairs-down', S.x, (12.6 + 21.6) / 2, { w: 3, d: 9, height: 8, rot: 0, rails: [] });

  // Living room (clear 0..16.39 × 11.63..23.04; 19'7" incl. the stair)
  item('fireplace', 0.8, 17.4, { rot: -90, w: 5.5, height: 8 });
  item('chimney', OUT.x0 - 1.25, 17.4, { rot: 90, lift: GROUND, height: 26 });
  item('builtins', 0.7, 13.3, { rot: -90, w: 3 });
  item('builtins', 0.7, 21.5, { rot: -90, w: 3 });
  item('tv', 1.75, 17.4, { rot: -90, w: 4.6, lift: 4.7 });
  item('rug-8x10', 8.2, 17.6, { rot: 90, color: '#a7836a' });
  item('sofa-l', 8.2, 18.7, { rot: 180, w: 9.6, d: 8 });
  item('recliner', 5, 13.9, { rot: -60 });
  item('ottoman', 7.6, 17.2, { label: 'Storage Ottoman', w: 2.6, d: 2.2 });
  item('side-table', 2.7, 22.2, {});
  item('floor-lamp', 15.6, 14, {});
  item('curtains', 3.6, 22.8, { color: '#8ba0b8' });
  item('curtains', 8.6, 22.8, { color: '#8ba0b8' });
  item('ceiling-light', 8.4, 17.3, {});

  // Kitchen (clear 9.08..25.08 × 0..11.25)
  item('fridge', 10.6, 1.35, { rot: 0 });
  item('counter', 13.75, 1.05, { w: 3.3 });
  item('counter', 15.9, 1.05, { w: 1 });
  item('sink-cab', 18.6, 1.05, { w: 3.6 });
  item('dishwasher', 21.4, 1.05);
  item('counter', 23.75, 1.05, { w: 2.66 });
  item('counter', 24.03, 3.15, { rot: 90, w: 2.1, label: 'Corner Counter' });
  item('stove', 23.98, 5.45, { rot: 90 });
  item('counter', 24.03, 7.5, { rot: 90, w: 1.6 });
  item('range-hood', 24.23, 5.45, { rot: 90 });
  item('upper-cab-glass', 14.1, 0.55, { w: 3 });
  item('upper-cab', 15.9, 0.55, { w: 0.6, height: 2.7 });
  item('upper-cab-glass', 22.4, 0.55, { w: 2.4 });
  item('upper-cab', 24.53, 2.8, { rot: 90, w: 1.4 });
  item('kitchen-island', 17.4, 6.5, { rot: 180, w: 6.5, d: 3.8 });
  item('bar-stool', 15.5, 9.0, { rot: 180 });
  item('bar-stool', 17.4, 9.0, { rot: 180 });
  item('bar-stool', 19.3, 9.0, { rot: 180 });
  item('pendant', 15.8, 6.5, {}); item('pendant', 19.0, 6.5, {});
  item('builtin-desk', 1.0, 5.6, { rot: -90, w: 9.4, d: 2 });
  item('upper-cab', 0.55, 1.2, { rot: -90, w: 1.4, height: 3, lift: 4.3, label: 'Open Shelf' });
  item('upper-cab', 0.55, 10.0, { rot: -90, w: 1.4, height: 3, lift: 4.3, label: 'Open Shelf' });
  item('bar-stool', 2.8, 3.8, { rot: 90, height: 2.8 });
  item('bar-stool', 2.8, 7.4, { rot: 90, height: 2.8 });
  item('plant-sm', 6.6, 10.6, {});
  item('ceiling-light', 4.5, 5.6, {});

  // Dining room (clear 0..14.42 × −13.92..−0.5), vaulted
  const dcy = (dyO + EXT / 2 + yB - EXT / 2) / 2;
  item('rug-8x10', 7.21, dcy, { color: '#b5aca0' });
  item('dining-6', 7.21, dcy, { rot: 90, w: 6, d: 3.6 });
  for (const [dx, dy, r] of [[-1.15, -1.8, 90], [-1.15, 0, 90], [-1.15, 1.8, 90], [1.15, -1.8, -90], [1.15, 0, -90], [1.15, 1.8, -90]])
    item('dining-chair', 7.21 + dx * 2, dcy + dy, { rot: r });
  item('hutch', 0.9, dcy - 2.2, { rot: -90, w: 4.2 });
  item('cube-shelf', 0.7, -2.8, { rot: -90, w: 3.4, height: 2.4 });
  item('sideboard', 7.21, dyO + 0.9, { label: 'Window Bench Table', w: 3.4, d: 1.3, height: 2.6, color: '#5a3a22' });
  item('plant-lg', 13.4, dyO + 0.9, { color: '#3e7d3a', height: 5.5 });
  item('plant-sm', 1.0, dyO + 0.9, {});
  item('pendant', 7.21, dcy, { lift: 5.8, w: 1.4, height: 1.2, ceil: 11, label: 'Chandelier' });

  // 1st floor bedroom (clear 22.33..32.88 × 11.63..23.04)
  item('rug-5x8', 28.2, 17.3, { rot: 90, color: '#5f8a8a' });
  item('bed-queen', 29.38, 17.3, { rot: 90, color: '#4f6a4f', pattern: 'floral', color2: '#f3f1ec' });
  item('nightstand-w', 31.98, 13.9, { rot: 90 });
  item('nightstand-w', 31.98, 20.7, { rot: 90 });
  item('dresser-w', 27.2, 22.2, { rot: 180, w: 2.6, d: 1.6, height: 3.8, label: 'Chest of Drawers' });
  item('bench-foot', 25.2, 17.3, { rot: 90, label: 'Cedar Chest', color: '#8a5a3a', color2: '#8a5a3a', w: 3, d: 1.5 });
  item('wall-art', 27.4, 11.7, { rot: 0, w: 3, height: 1.4, color: '#7a9bb8' });
  item('ceiling-light', 27.6, 17.3, {});

  // Bath (clear 25.46..32.88 × 0..7.83)
  item('bathtub', 30.38, 1.3, { color: '#f2f2f0' });
  item('toilet', 31.68, 4.7, { rot: 90 });
  item('vanity', 26.36, 4.5, { rot: -90, w: 3.4, d: 1.8 });
  item('mirror', 25.54, 4.5, { rot: -90, w: 3, height: 2.6 });

  // Hall / mudroom
  item('bench-foot', BUMP.x1 - 0.8, 6.8, { rot: 90, w: 3.5, label: 'Mudroom Bench', color: '#6f8296', color2: '#f3f1ec' });
  item('ceiling-light', 29.2, 9.7, {});

  // Garage (clear GAR.x0.. × −3.25..24.25)
  item('lawn-tractor', GAR.x0 + 21, 4, { rot: 180 });
  item('metal-shelf', GAR.x0 + 2.2, gy0 + 1, {});
  item('metal-shelf', gx1 - 1, 17, { rot: -90 });
  item('workbench', GAR.x0 + 12, gy0 + 1.5, { w: 7 });
  item('fridge', GAR.x0 + 6.6, gy0 + 1.6, { label: 'Garage Fridge' });
  item('trash-bin', GAR.x0 + 1.2, 2, { rot: -90 });
  item('trash-bin', GAR.x0 + 1.2, 4.5, { rot: -90, color: '#2f5ea8', label: 'Recycling' });

  // Covered porch / decks
  const pcx = (OUT.x1 + GAR.x0 - EXT) / 2;
  item('post', OUT.x1 + 0.5, 23.4, {}); item('post', GAR.x0 - EXT - 0.5, 23.4, {});
  item('lantern', pcx, 17.5, { lift: 6.3, ceil: 9.5 });
  item('steps', pcx, 25.0, { w: 5, d: 2.5, height: 0.85, rot: 0, lift: GROUND });
  item('steps', DOOR_X, OUT.y1 + 1.2, { w: 4.5, d: 2.4, height: 1.25, rot: 0, lift: GROUND, color: '#9a5a44', label: 'Front Steps' });
  item('planter', OUT.x1 + 0.9, 21, {}); item('planter-box', GAR.x0 - EXT - 0.9, 14, { rot: -90 });
  item('patio-table', 19.9, -6.4, { umbrella: 'closed', w: 4, d: 3 });
  for (const [dx, dy, r] of [[-1.6, -2, 0], [1.6, -2, 0], [-1.6, 2, 180], [1.6, 2, 180]]) item('patio-chair', 19.9 + dx, -6.4 + dy, { rot: r, color2: '#9aa0a8' });
  item('grill', 27, -2.0, { rot: 0 });
  item('fire-table', 34, -9.2, {});
  item('lounge-chair', 34, -11.8, { rot: 0 }); item('lounge-chair', 34, -6.6, { rot: 180 });
  item('lounge-chair', 31.3, -9.2, { rot: -90 }); item('lounge-chair', 36.7, -9.2, { rot: 90 });
  item('planter', 40.5, -16.4, {}); item('planter', 16, -16.6, { color: '#c0392b' });
  item('steps', 28.6, -EXT - 17.25 - 1.25, { w: 5, d: 2.5, height: 0.75, rot: 180, lift: GROUND });

  // Yard & landscaping
  item('bulkhead', OUT.x0 - 2.7, -9, { rot: 90, lift: GROUND });
  item('shed', 22, -64, { rot: 0 });
  item('kayak', 28.5, -63, { rot: 10 });
  item('fire-pit', 4, -40, {});
  for (const x of [0.8, 4.6, 9.4, 19.4, 23.4, 29.6]) item('shrub', x, OUT.y1 + 1.2, {});
  item('hydrangea', 7.0, OUT.y1 + 1.5, {}); item('hydrangea', 26.2, OUT.y1 + 1.5, { color2: '#e07a3a' });
  for (const x of [2.6, 6.2, 10.4, 20.4, 25, 31]) item('hosta', x, OUT.y1 + 2.7, {});
  for (let x = 0.5; x < 32; x += 1.6) if (Math.abs(x - DOOR_X) > 2.6) item('boulder', x, OUT.y1 + 3.6, { w: 1, d: 0.8, height: 0.5 });
  item('mailbox', GAR.x0 - 4, 80, {});
  item('lamp-post', DOOR_X - 3, 30, {});
  const trees = [
    ['tree', -28, 40], ['tree-birch', -18, 18], ['tree', 97, 60], ['tree-pine', 94, 10], ['tree', 90, -30], ['tree-pine', 102, -58],
    ['tree', -38, -10], ['tree-pine', -42, -45], ['tree', -30, -75], ['tree', -8, -92], ['tree-birch', 10, -88], ['tree', 34, -95],
    ['tree-pine', 52, -88], ['tree', 70, -92], ['tree', 86, -82], ['tree-birch', 60, -66], ['tree', 45, -70], ['tree-birch', -12, -60],
    ['tree', 107, 30], ['tree-pine', -50, 70], ['tree', 117, -10],
  ];
  for (const [t, x, y] of trees) item(t, x, y, { rot: (x * 37 + y * 11) % 360 });
  item('fence', 30, -104, { w: 120 });

  // ═══ 2ND FLOOR — rear shed dormer, front roof slope over a 5' knee wall ══════
  // Clear interior runs between the gable inner faces (x −0.1 … 32.98) and from the dormer face
  // (y 3.37) to the knee wall (y 20.79): 17'5" deep, matching the bedroom.
  on(2);
  const gx0i = OUT.x0 + 0.4, gx1i = OUT.x1 - 0.4;          // gable inner faces
  const yKnee = 20.79, yDorm = yKnee - 17.42;                // inner faces
  const yKw = yKnee + INT / 2, yDw = yDorm - EXT / 2;          // centrelines
  const xP = gx0i + 13.83 + INT / 2;                          // primary 13'10"
  const xB2 = xP + INT / 2 + 6.25 + INT / 2;                  // bath/hall 6'3", bedroom 12'2"
  const yWic = yDorm + 4.92 + INT / 2;                        // WIC/laundry 4'11"
  const xWic = gx0i + 8.42 + INT / 2, xLau = xWic + INT / 2 + 3.5 + INT / 2;
  const yBa2 = yDorm + 6.75 + INT / 2, yHall = S.top;         // bath 6'9", hall to the stair head
  room('Primary Bedroom', gx0i, yWic, xP - gx0i, yKw - yWic, { wall: '#c8cbcd', color: '#3b82f6', ceiling: false });
  room('W.I.C.', gx0i, yDw, xWic - gx0i, yWic - yDw, { wall: '#c8cbcd', color: '#8b5cf6', ceiling: false });
  room('Laundry', xWic, yDw, xLau - xWic, yWic - yDw, { floor: 'tile', floorColor: '#8d8c88', wall: '#e9e6dc', color: '#06b6d4', ceiling: false });
  room('Linen', xLau, yDw, xP - xLau, yWic - yDw, { wall: '#ecebe6', color: '#64748b', ceiling: false });
  room('Bath', xP, yDw, xB2 - xP, yBa2 - yDw, { floor: 'tile', floorColor: '#9b9b98', wall: '#bfe0e0', color: '#06b6d4', ceiling: false });
  room('Hall', xP, yBa2, xB2 - xP, yHall - yBa2, { wall: '#ecebe6', color: '#94a3b8', ceiling: false });
  room('Storage', xP, yHall, xStairL - xP, yKw - yHall, { wall: '#ecebe6', color: '#64748b', ceiling: false });
  room('Stair Landing', xStairL, yHall, xB2 - xStairL, yKw - yHall, { wall: '#ecebe6', color: '#94a3b8', ceiling: false });
  room('Bedroom', xB2, yDw, gx1i - xB2, yKw - yDw, { wall: '#5f6b7f', color: '#ec4899', ceiling: false });

  wall(gx1i, yDw, gx0i, yDw, { ext: true, h: 8.5, t: EXT });               // rear dormer face
  wall(gx0i, yKw, gx1i, yKw, { h: 5, t: INT });                            // front knee wall
  wall(gx0i, yWic, xP, yWic, P);
  wall(xWic, yDw, xWic, yWic, P);
  wall(xLau, yDw, xLau, yWic, P);
  wall(xP, yDw, xP, yKw, P);
  wall(xP, yBa2, xB2, yBa2, P);
  wall(xB2, yDw, xB2, yKw, P);
  wall(xP, yHall, xStairL, yHall, P);
  wall(xStairL, yHall, xStairL, yKw, P);

  item('stair-opening', S.x, (yHall + yKnee) / 2, { w: 3, d: yKnee - yHall, rails: ['right'] });
  item('door-double', gx0i + 4.4, yWic, { rot: 0, w: 4, label: 'W.I.C. Doors' });
  item('door-double', (xWic + xLau) / 2, yWic, { rot: 0, w: 3, label: 'Laundry Doors' });
  door(xP, 12.0, 90, { open: 75 });
  door(xP + 1.7, yBa2, 0, { open: 70, w: 2.4, rot: 180 });
  door(xB2, 12.0, 90, { open: 75, rot: -90 });
  win(4.4, yDw, 0, { type: 'window-sm', lift: 3.6 });
  win(xP + 3.4, yDw, 0, { type: 'window-sm', lift: 4.2, w: 2, grid: false });
  win(26.6, yDw, 0, { lift: 2.8, w: 2.8, height: 4 });
  win(OUT.x0 + 0.2, 17.6, 90, { w: 2.6, height: 3.6, lift: 2.8 });
  win(OUT.x1 - 0.2, 7.2, 90, { w: 2.6, height: 3.6, lift: 2.8 });

  // Primary bedroom (clear −0.1..13.73 × 8.67..20.79)
  const pcy = (yWic + yKnee) / 2 + 0.1;
  item('rug-8x10', 6.6, pcy, { rot: 90, color: '#9aa4b0' });
  item('bed-queen', gx0i + 3.6, pcy, { rot: -90, color: '#24438a', color2: '#f0eee8', pattern: 'solid', headboard: 3.4 });
  item('nightstand-w', gx0i + 0.75, pcy - 3.4, { rot: -90, color: '#6b4a2f' });
  item('nightstand-w', gx0i + 0.75, pcy + 3.4, { rot: -90, color: '#6b4a2f' });
  item('table-lamp', gx0i + 0.75, pcy - 3.4, { lift: 2.1, color: '#4f8fa0' }); item('table-lamp', gx0i + 0.75, pcy + 3.4, { lift: 2.1, color: '#4f8fa0' });
  item('fireplace-tv', xP - INT / 2 - 0.8, pcy - 0.4, { rot: 90, w: 4.5 });
  item('tv', xP - INT / 2 - 0.85, pcy - 0.4, { rot: 90, w: 4.2, lift: 2.6 });
  item('bench-foot', gx0i + 8.2, pcy, { rot: 90, w: 4, label: 'Upholstered Bench', color: '#6f7378', color2: '#2b2b2e' });
  item('mirror-floor', 11.2, yKnee - 0.6, { rot: 180 });
  item('ceiling-light', 7, 12.5, {});
  item('closet-sys', gx0i + 4.2, yDorm + 1.0, { w: 8.2, d: 2 });
  item('closet-sys', gx0i + 0.8, yDorm + 3.0, { rot: -90, w: 2.2, d: 1.6, height: 7 });
  item('washer-stack', (xWic + xLau) / 2, yDorm + 1.35, {});
  item('closet-sys', (xLau + xP) / 2, (yDorm + yWic) / 2, { rot: -90, w: 4.4, d: 0.9, label: 'Linen Shelves', height: 7 });

  // Bath (2nd) (clear 14.11..20.36 × 3.37..10.12)
  item('shower', xP + INT / 2 + 1.6, yDorm + 1.8, { w: 3.2, d: 3.6 });
  item('toilet', xB2 - INT / 2 - 1.2, yDorm + 1.2, { rot: 90 });
  item('vanity-w', xB2 - INT / 2 - 1.2, yBa2 - INT / 2 - 0.85, { rot: 180, w: 2.3 });
  item('mirror', xB2 - INT / 2 - 1.2, yBa2 - INT / 2 - 0.1, { rot: 180, w: 2, height: 2.6, color: '#f3f1ec' });

  // Bedroom 2 (clear 20.73..32.98 × 3.37..20.79)
  const b2cy = 12.2;
  item('rug-5x8', 27.6, b2cy, { rot: 90, color: '#a98d6b' });
  item('bed-queen', gx1i - 3.6, b2cy, { rot: 90, color: '#2f5aa8', pattern: 'stripes' });
  item('nightstand', gx1i - 0.75, b2cy - 3.6, { rot: 90 }); item('nightstand', gx1i - 0.75, b2cy + 3.6, { rot: 90, w: 2.2 });
  item('table-lamp', gx1i - 0.75, b2cy + 3.6, { lift: 2.2, color: '#dfe6ea' });
  item('dresser', 25.2, yDorm + 0.85, { w: 5.5 });
  item('chest', 31.2, yKnee - 0.9, { rot: 180, w: 2.8 });
  item('antique-desk', xB2 + INT / 2 + 1.05, 16.2, { rot: -90 });
  item('office-chair', xB2 + INT / 2 + 2.9, 16.2, { rot: 90 });
  item('dining-chair', 24.2, 19.4, { rot: 135, label: 'Windsor Chair', color: '#b07a40', color2: '#1f2933' });
  item('plant-sm', 25.8, yDorm + 0.6, { lift: 3 });
  item('ceiling-light', 26.4, 10.5, {});

  // ═══ ROOFS ════════════════════════════════════════════════════════════════
  // Main Cape: 12/12 gable over the outer faces, ridge along x, full-width rear shed dormer.
  const mainRidge = 10.5 + (OUT.y1 - OUT.y0) / 2 + 0.75;
  roof({ name: 'Main roof', x: OUT.x0, y: OUT.y0, w: OUT.x1 - OUT.x0, d: OUT.y1 - OUT.y0, axis: 'x', eave: 10.5, ridge: mainRidge,
    dormer: { x0: gx0i, x1: gx1i, wallY: yDw - EXT / 2, top: 17.5 }, ceilingAt: 17 });
  roof({ name: 'Dining roof', x: OUT.x0, y: dy0o, w: dx1o - OUT.x0, d: OUT.y0 - dy0o, axis: 'y', eave: 9, ridge: 12.8, noGable: ['s'] });
  roof({ name: 'Porch roof', x: OUT.x1, y: BUMP.y0 - EXT, w: GAR.x0 - EXT - OUT.x1, d: 23.8 - (BUMP.y0 - EXT), axis: 'y', eave: 8.25, ridge: 12, noGable: ['n'] });
  roof({ name: 'Garage roof', x: gx0 - EXT / 2, y: gy0 - EXT / 2, w: gx1 - gx0 + EXT, d: gy1 - gy0 + EXT, axis: 'y', eave: 8.5, ridge: 16.8 });

  return { floors, activeFloor: 1, site };
}
