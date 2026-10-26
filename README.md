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
  **Walk** drops you in as a little character on the front walk.
  **☀ Day / 🌇 Evening / 🌙 Night** sets the sun and sky. **💡 Lights** switches the house fixtures (on by default in the evening and at night).
  **✨ Low / Medium / High** trades looks for speed: ambient occlusion, bloom, more lamp lights and sharper shadows at higher levels.
  It defaults to Medium on phones and High on desktops, and remembers your choice.
- **Walk-through**: on a phone or tablet, put your left thumb anywhere in the bottom-left to get a joystick
  (push it all the way to run) and swipe anywhere else to look around. On a desktop, use WASD or the arrows, drag to look,
  hold Shift to run, and scroll to zoom. Doorways and stairs work, while walls and big furniture block you. Floors above you
  hide while you're indoors. **👁 First person / 🧍 Third person** switches the camera (or press V), **Shirt** changes
  your color, and **✕ Exit** (or Esc) leaves.
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
| `walker.js` | Walk-through controller: joystick and look input, collision, stairs and floors, third- and first-person cameras |
| `character.js` | The walking character model and its walk/run animation |
| `lighting.js` | Physical sky, sun and time of day, sky-lit reflections, indoor fill, pooled fixture lights, and the AO/bloom render pipeline with quality levels |
| `models_kl.js` | Kitchen & living room set matched to the listing photos: plush slipcovered sectional, tufted recliner, stone fireplace, dressed built-ins, shaker cabinets, appliances, stools, dome pendant, recessed cans, curtains, roman shade and counter decor |
| `models3d.js` | ~80 procedural furniture and fixture builders, sized from each item's width/depth/height |
| `textures.js` | Procedural canvas textures (oak, tile, siding, shingles, brick, stone, …) and finish catalogs |
| `furniture.js` | Catalog: dimensions, default colors, model key, wall-opening and mount flags |
| `house191.js` | The 191 Webster St preset |

**Real-world scale.** Everything is in feet. In the preset, each room's clear interior (wall face to wall face) matches
the listing, with 6″ exterior walls, 4½″ partitions and a 9.6″ foundation. The walk-through camera is set for a
5′10″ person (eyes at 5′5½″), walks at 3 mph (jogs at 6 mph at the joystick's rim or with Shift) and aims for a ~90° horizontal
field of view: about 103° in landscape and 54° in portrait, where the vertical is capped at 95° to avoid distortion. Oak boards are 7″ wide.
Doors are 6′8″, counters 36″ and ceilings 8′.

**Layout check.** `node tools/audit.mjs` (or `node tools/audit.mjs saved-house.json`) checks every item for overlaps,
cutting into walls, blocking a doorway (2′6″ clear path; 1′ for closet doors), standing in front of windows, and catalog sizes
against real-world standards. Run it after editing the preset; it exits non-zero when it finds problems.

Dimensions are in feet. Plan +x is left → right and plan +y is rear → street. An item's front faces plan +y at
rotation 0. The preset is approximate: the listing plan gives room sizes, not wall-to-wall positions.
