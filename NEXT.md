# What to work on next

Found while checking every model in the new gallery (`tools/gallery.html`) and the houses in walk mode.
Ordered roughly by how much they hurt the realism of a listing tour.

## Models that are built wrong or look off
1. **Car**: the new extruded body renders as a flat slab (the side profile is extruded along the wrong axis).
   Rebuild and check it in the gallery from the side.
2. **Exercise bike**: parts don't line up (flywheel, posts and handlebars float). Rebuild with connected rods
   like the new bar stool (`stick()` in models3d.js).
3. **Treadmill, weight bench**: check that the uprights meet the base; same `stick()` approach.
4. **Bathtub / shower**: add a tiled surround and a proper rounded tub basin; the tub reads as a plain box.
5. **Toilet**: smoother bowl/tank shapes (lathe profiles) and a seat lid.
6. **Fireplace stone**: darker, thinner stacked stone to match the listing photo (texture tint + stone heights).
7. **Sofas / loveseat**: compare against the photos (cushion depth, arm height, legs).
8. **Kitchen appliances**: range knobs and grates, fridge door gaps and handles, microwave detail.
9. **Patio chairs / lounge chairs**: check frames connect; add slats/weave.
10. **Pine trees**: boughs read as dark stripes up close; softer needle texture and more taper.

## Placement & layout
- Keep running `node tools/audit.mjs` and `node tools/audit.mjs dream`. They now catch seats facing away from
  their table, TV or fire, and seats facing straight into a wall.
- **191 Webster**: re-measure the remaining rooms against the listing plan, like the entry and living room
  (kitchen island aisle is ~22" as drawn; worth confirming).
- Add an audit check for items floating above or sunk into the floor (items whose lift doesn't match the
  surface they sit on), and for wall items (art, mirrors, TVs) that aren't against a wall.
- Add an audit check that every room has a light and that each bedroom has a closet and a window.

## Looks
- Real photo textures if `polyhaven.com` / `dl.polyhaven.org` / `api.polyhaven.com` are allowed in the environment's network settings
  (`python3 tools/fetch_textures.py`); otherwise keep improving `tools/make_textures.py`.
- Check phone performance on a real device (the tour now loads ~6 MB of textures plus the HDRI); halve the
  small textures if first load is slow.

## Business / tour
- Real hosting (Cloudflare Pages or Netlify) so agents can open links; `node tools/build-site.mjs` makes the folder.
- Credit link for "Made by CLAWEngineering" once there's a site or business email.
- A one-page listing intake form (what photos, the floor plan, a few laser measurements) to send agents.
