// Build a folder you can upload to any static host (Netlify, Cloudflare Pages, GitHub Pages…):
//   node tools/build-site.mjs        → site/
// Contains the listing tour (tour.html), every listing in listings/, and the designer (designer.html).
// The repo's HTML files are written without <html>/<head>/<body> so they also publish as claude.ai
// artifacts; here they get a proper document wrapper.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'site');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'listings'), { recursive: true });

const MODULES = ['viewer3d.js', 'walker.js', 'character.js', 'lighting.js', 'models3d.js', 'models_kl.js', 'models_dream.js', 'models_nature.js',
  'textures.js', 'furniture.js', 'tour.js', 'tour.css',
  'app.js', 'editor2d.js', 'sounds.js', 'house191.js', 'houseDream.js', 'style.css'];
for (const f of MODULES) copyFileSync(join(root, f), join(out, f));
for (const dir of ['assets/hdri', 'assets/tex']) {
  mkdirSync(join(out, dir), { recursive: true });
  for (const f of readdirSync(join(root, dir))) if (/\.(js|json|jpe?g|png|webp|md)$/i.test(f)) copyFileSync(join(root, dir, f), join(out, dir, f));
}
for (const f of readdirSync(join(root, 'listings'))) if (/\.(json|jpe?g|png|webp)$/i.test(f)) copyFileSync(join(root, 'listings', f), join(out, 'listings', f));

const wrap = src => {
  const i = src.indexOf('<div');            // head part = metas, title, styles, importmap; then the body
  return `<!doctype html>\n<html lang="en">\n<head>\n${src.slice(0, i).trim()}\n</head>\n<body>\n${src.slice(i).trim()}\n</body>\n</html>\n`;
};
writeFileSync(join(out, 'tour.html'), wrap(readFileSync(join(root, 'tour.html'), 'utf8')));
writeFileSync(join(out, 'designer.html'), wrap(readFileSync(join(root, 'index.html'), 'utf8')));
writeFileSync(join(out, 'index.html'), '<!doctype html><meta charset="utf-8"><title>3D Home Tours</title><meta http-equiv="refresh" content="0; url=tour.html' + '"><a href="tour.html">Open the tour</a>\n');
console.log('Built site/ — upload the whole folder. Tour links: tour.html?l=<id> (branded), tour.html?l=<id>&mls=1 (MLS)');
