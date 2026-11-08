// Start a new client listing with a hard-to-guess id.
//   node tools/new-listing.mjs "12 Ocean Ave" "Marshfield, MA 02050"
// Writes listings/<street-slug>-<6 random chars>.json (status "preview", expires in 6 months) and prints the
// file name the model must be saved as, plus the preview / branded / MLS links.
// Set SITE_URL to your tour site, e.g. SITE_URL=https://tours.example.com node tools/new-listing.mjs …
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const [address, city = ''] = process.argv.slice(2);
if (!address) { console.error('Usage: node tools/new-listing.mjs "<street address>" "<city, state zip>"'); process.exit(1); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const slug = address.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';           // no look-alikes (0/o, 1/l/i)
const suffix = [...randomBytes(6)].map(b => alphabet[b % alphabet.length]).join('');
const id = `${slug}-${suffix}`, file = join(root, 'listings', id + '.json');
if (existsSync(file)) { console.error('Try again (id collision).'); process.exit(1); }
const expires = new Date(Date.now() + 182 * 864e5).toISOString().slice(0, 10);
writeFileSync(file, JSON.stringify({
  id, publish: true, status: 'preview', expires,
  address, city, price: null, beds: null, baths: null, sqft: null,
  agent: { name: '', brokerage: '', phone: '', email: '', photo: '' },
  furnished: true, time: 'day', credit: true, creditOnMls: false,
  houseFile: `${id}.house.json`,
}, null, 2) + '\n');
const site = (process.env.SITE_URL || 'https://<your-tour-site>').replace(/\/$/, '');
console.log(`Created listings/${id}.json
Next:
  1. Fill in the agent, beds/baths/sq ft and price in that file.
  2. Save the model from the designer (💾) as listings/${id}.house.json
  3. Preview (watermarked) to send the agent for approval:  ${site}/tour.html?l=${id}
  4. When approved and paid, set "status": "live", then deploy.
     Branded link: ${site}/tour.html?l=${id}
     MLS link:     ${site}/tour.html?l=${id}&mls=1
  The tour turns itself off after ${expires} (change "expires" to extend it).`);
