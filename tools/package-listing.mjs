// Package one listing's tour as a zip the client can host themselves (the "file buyout" option).
//   node tools/package-listing.mjs <listing-id>      → dist/<listing-id>.zip
// The zip holds only that tour (no designer, no other listings) plus a README with hosting steps and terms.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const id = process.argv[2];
if (!id) { console.error('Usage: node tools/package-listing.mjs <listing-id>'); process.exit(1); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [join(root, 'tools', 'build-site.mjs'), '--listing', id], { stdio: 'inherit' });
const dir = join(root, 'dist', id);
const L = JSON.parse(readFileSync(join(dir, 'listings', id + '.json'), 'utf8'));
writeFileSync(join(dir, 'README.txt'), `3D tour: ${L.address || id}
Made by CLAWEngineering.

HOSTING
Upload everything in this folder, as is, to any web host that serves static files (your brokerage
website, Netlify, Cloudflare Pages, GitHub Pages, Amazon S3). Then open index.html on that site.
  Branded link: <your site>/tour.html?l=${id}
  MLS link:     <your site>/tour.html?l=${id}&mls=1
It won't run by double-clicking the file on your computer: browsers only load 3D content from a web address.

TERMS (summary; your service agreement governs)
This tour is licensed to you for marketing the property at the address above. You may host and share it
for that purpose. Don't resell it, edit it to misrepresent the property, or remove the disclaimer.
It's a 3D rendering from listing photos and the floor plan: dimensions are approximate and furniture
is virtual staging. The software in this folder remains CLAWEngineering's.
`);

// minimal zip writer (deflate), no dependencies
const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const files = [];
const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); } };
walk(dir);
const parts = [], central = [];
let offset = 0;
for (const p of files) {
  const name = Buffer.from(join(id, relative(dir, p)).split('\\').join('/'));
  const data = readFileSync(p), comp = zlib.deflateRawSync(data, { level: 9 }), crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
  parts.push(local, name, comp);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
  cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(name.length, 28);
  cen.writeUInt32LE(offset, 42);
  central.push(cen, name);
  offset += 30 + name.length + comp.length;
}
const cenBuf = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
const zipPath = join(root, 'dist', id + '.zip');
writeFileSync(zipPath, Buffer.concat([...parts, cenBuf, end]));
console.log(`Packaged ${relative(root, zipPath)} (${files.length} files, ${(statSync(zipPath).size / 1048576).toFixed(1)} MB)`);
