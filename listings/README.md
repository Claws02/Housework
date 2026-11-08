# Listings

Each listing tour is two files here:

| File | What it is |
|---|---|
| `<id>.json` | The listing card: address, city, price, beds, baths, sq ft, agent, and options |
| `<id>.house.json` | The 3D model, saved from the designer with 💾 (rename it to match) |

Links you send the realtor:
- Branded (Zillow, social, email): `tour.html?l=<id>`
- Unbranded (MLS virtual-tour field): `tour.html?l=<id>&mls=1`

Options in `<id>.json`:
- `price`: a number (`649900`) or text (`"Coming soon"`); `null` hides it. Same for `sqft`.
- `agent`: shown on the branded link only. `photo` is an image URL or a file in this folder; blank shows initials.
- `furnished`: start furnished (`true`) or unfurnished (`false`). Buyers can switch either way.
- `time`: starting light: `morning`, `day`, `evening` or `night`.
- `credit`: show "Made by CLAWEngineering" on the branded link. `creditOnMls`: also on the MLS link
  (most MLSs don't allow any branding on the unbranded link, so leave this `false` unless yours does).
- `disclaimer`: replaces the default note at the bottom.

Start a new one with `node tools/new-listing.mjs "12 Ocean Ave" "Marshfield, MA 02050"`: it creates the listing with a
hard-to-guess id (e.g. `12-ocean-ave-k7m2qx`), in preview mode, expiring in 6 months, and prints the links.

More options in `<id>.json`:
- `status`: `"preview"` shows a PREVIEW watermark (send this for the agent's approval before payment), `"live"` is the
  normal tour, `"ended"` turns it off (shows a short "no longer available" notice with the agent's contact).
- `expires`: `"YYYY-MM-DD"`. After that day the tour turns itself off. Extend it if the listing is still active.
- `publish`: `true` to include it in the public site build (`tools/build-site.mjs --public`). Leave `false` for anything
  you don't have permission to show (191 Webster is `false`).
- `demo`: `true` marks the sample tour linked from the landing page.

Client file buyout: `node tools/package-listing.mjs <id>` makes `dist/<id>.zip` with just that tour and a README.
Tours always tell search engines not to index them.
Items in the model can override whether they "sell with the house" (stay when Unfurnished) with `"builtIn": true` or `false`.
