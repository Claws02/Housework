# House Designer

A browser-based 2D/3D home designer (Three.js, no build step). It opens with a model of
**191 Webster St, Marshfield MA**: basement, 1st and 2nd floors, attached garage, decks and
yard, laid out from the listing floor plan and furnished to match the listing photos.

Serve the folder with any static server (`python3 -m http.server`) and open `index.html`.
Add `?view=3d` to the URL to open straight into 3D.

## Using it
- **Floors**: tabs at the top right switch the level you're editing. The level below shows as a dashed ghost.
- **2D Plan**: draw rooms (R) and walls (W), select (V) and erase (E). Drag a wall to move it, or drag its
  end dots to reshape it; corners that share a point move together. Doors and windows snap onto walls and cut them in 3D.
- **3D View**: orbit with drag, pan with right-drag or two fingers. Tap anything to select it, and drag a selected item to move it.
  **Show** filters levels (All / B / 1 / 2). **Roof**, **Ceilings** and **Cutaway** toggle what's drawn.
  **Walk** is first-person (WASD or arrow keys, drag to look, on-screen pad for touch).
- **Properties**: size, elevation, rotation and colors for items. Floor finish, wall paint or finish,
  ceiling and outdoor flags for rooms. Height, thickness, exterior flag and a finish per side for walls (A/B, with flip and split).
  Eave, ridge, overhang and color for roofs.
- `,` and `.` rotate the selection 15°. Arrow keys nudge it. Ctrl+Z / Ctrl+Y undo and redo. Ctrl+D duplicates.
- 🏡 reloads the 191 Webster model. 💾 / 📂 save and load JSON. 📷 exports the plan or the 3D view as PNG.

## Code map
| File | What it does |
|---|---|
| `app.js` | State (floors, site, view), history, panels, palette, persistence |
| `editor2d.js` | Canvas floor-plan editor |
| `viewer3d.js` | Scene build: floors, walls with openings, gable/dormer roofs, ground, picking, walk mode |
| `models3d.js` | ~80 procedural furniture and fixture builders, sized from each item's width/depth/height |
| `textures.js` | Procedural canvas textures (oak, tile, siding, shingles, brick, stone, …) and finish catalogs |
| `furniture.js` | Catalog: dimensions, default colors, model key, wall-opening and mount flags |
| `house191.js` | The 191 Webster St preset |

Dimensions are in feet. Plan +x is left → right and plan +y is rear → street. An item's front faces plan +y at
rotation 0. The preset is approximate: the listing plan gives room sizes, not wall-to-wall positions.
