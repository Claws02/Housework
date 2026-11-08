// Build a folder you can upload to any static host (Cloudflare Pages, Netlify, GitHub Pages…).
//
//   node tools/build-site.mjs                    → site/  internal build: tour + designer + every listing
//   node tools/build-site.mjs --public           → site/  public build: tour only, and only listings marked
//                                                          "publish": true (the designer stays private)
//   node tools/build-site.mjs --listing <id>     → dist/<id>/  one listing's tour on its own (file buyout)
//   add --out <dir> to write somewhere else.
//
// The repo's HTML files are written without <html>/<head>/<body> so they also publish as claude.ai
// artifacts; here they get a proper document wrapper.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), flag = n => args.includes(n), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const one = opt('--listing'), pub = flag('--public') || !!one;
const out = opt('--out') ? join(process.cwd(), opt('--out')) : one ? join(root, 'dist', one) : join(root, 'site');

// which listings go in
const listingFiles = readdirSync(join(root, 'listings')).filter(f => f.endsWith('.json') && !f.endsWith('.house.json'));
const listings = listingFiles.map(f => ({ id: f.replace(/\.json$/, ''), data: JSON.parse(readFileSync(join(root, 'listings', f), 'utf8')) }))
  .filter(l => one ? l.id === one : !pub || l.data.publish === true);
if (one && !listings.length) { console.error(`No listing "${one}" in listings/`); process.exit(1); }

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'listings'), { recursive: true });

const TOUR = ['viewer3d.js', 'walker.js', 'character.js', 'lighting.js', 'models3d.js', 'models_kl.js', 'models_dream.js', 'models_nature.js',
  'textures.js', 'furniture.js', 'tour.js', 'tour.css'];
const DESIGNER = ['app.js', 'editor2d.js', 'sounds.js', 'house191.js', 'houseDream.js', 'style.css'];
for (const f of [...TOUR, ...(pub ? [] : DESIGNER)]) copyFileSync(join(root, f), join(out, f));
for (const dir of ['assets/hdri', 'assets/tex']) {
  mkdirSync(join(out, dir), { recursive: true });
  for (const f of readdirSync(join(root, dir))) if (/\.(js|json|jpe?g|png|webp|md)$/i.test(f)) copyFileSync(join(root, dir, f), join(out, dir, f));
}
for (const l of listings) {
  copyFileSync(join(root, 'listings', l.id + '.json'), join(out, 'listings', l.id + '.json'));
  for (const extra of [l.data.houseFile, l.data.agent?.photo].filter(Boolean)) {
    const src = join(root, 'listings', extra);
    if (existsSync(src)) copyFileSync(src, join(out, 'listings', extra));
  }
}

const wrap = (src, extraHead = '') => {
  const i = src.indexOf('<div');            // head part = metas, title, styles, importmap; then the body
  return `<!doctype html>\n<html lang="en">\n<head>\n${src.slice(0, i).trim()}\n${extraHead}</head>\n<body>\n${src.slice(i).trim()}\n</body>\n</html>\n`;
};
const first = listings[0]?.id;
writeFileSync(join(out, 'tour.html'), wrap(readFileSync(join(root, 'tour.html'), 'utf8'), first ? `  <meta name="default-listing" content="${first}">\n` : ''));
if (!pub) writeFileSync(join(out, 'designer.html'), wrap(readFileSync(join(root, 'index.html'), 'utf8')));

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { --bg: #f4f6f9; --card: #fff; --text: #17212f; --muted: #5b6878; --accent: #1f4e79; color-scheme: light; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0f1623; --card: #17202e; --text: #eef3fa; --muted: #9aa8bb; --accent: #4f8fd0; color-scheme: dark; } }
  * { box-sizing: border-box; } body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--text);
    font: 16px/1.5 system-ui, -apple-system, sans-serif; display: grid; place-items: center; padding: 24px 16px; }
  main { width: 100%; max-width: 640px; } h1 { font-size: 1.6rem; margin: 0 0 4px; } p.sub { color: var(--muted); margin: 0 0 24px; }
  a.card { display: block; background: var(--card); border-radius: 14px; padding: 18px 20px; margin-bottom: 14px; text-decoration: none;
    color: inherit; box-shadow: 0 4px 18px rgba(10,20,35,.10); border: 1px solid rgba(127,127,127,.15); }
  a.card:hover { border-color: var(--accent); } a.card b { display: block; font-size: 1.1rem; color: var(--accent); }
  a.card span { color: var(--muted); font-size: .92rem; } footer { color: var(--muted); font-size: .8rem; margin-top: 18px; }
</style></head><body><main>${body}</main></body></html>
`;
if (one) {
  // a client package opens straight into its tour
  writeFileSync(join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>3D Tour</title><meta http-equiv="refresh" content="0; url=tour.html?l=${one}"><a href="tour.html?l=${one}">Open the 3D tour</a>\n`);
} else {
  const demo = listings.find(l => l.data.demo) || listings[0];
  writeFileSync(join(out, 'index.html'), page('CLAWEngineering 3D Homes', `
<h1>CLAWEngineering 3D Homes</h1>
<p class="sub">Walk-through 3D home tours built from listing photos and floor plans: no site visit needed.</p>
${demo ? `<a class="card" href="tour.html?l=${demo.id}"><b>See a sample tour</b><span>${demo.data.address || 'Sample home'}: walk through it, switch floors, and turn the furniture on and off.</span></a>` : ''}
${pub ? '' : '<a class="card" href="designer.html"><b>Designer</b><span>The full editor: 2D plan, 3D view, walk-through, 191 Webster St and the Dream House.</span></a>'}
<footer>Works on phones and computers. Best in Chrome, Safari or Edge.</footer>`));
}
writeFileSync(join(out, '.nojekyll'), '');
console.log(`Built ${out.replace(root + '/', '')}/ (${one ? 'listing package' : pub ? 'public' : 'internal'}; listings: ${listings.map(l => l.id).join(', ') || 'none'})`);
