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

Start a new one by copying `191-webster.json`, changing the details and `houseFile`, and dropping in the house file.
Items in the model can override whether they "sell with the house" (stay when Unfurnished) with `"builtIn": true` or `false`.
