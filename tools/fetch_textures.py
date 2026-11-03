#!/usr/bin/env python3
"""Download CC0 photo textures from Poly Haven into assets/tex/ and write assets/tex/manifest.json.

    python3 tools/fetch_textures.py            # all slots
    python3 tools/fetch_textures.py oak grass   # just these

Each slot is a texture name the app already uses (textures.js); when the manifest lists it, the photo set
replaces the procedural texture everywhere that name is used, tinted to the finish colour you pick.
Big surfaces (floors, siding, roof, lawn) get 1K colour + normal + roughness maps; small furniture
materials get 512 px colour + normal, to keep the tour light on phones.

Poly Haven assets are CC0 (public domain): https://polyhaven.com/license
Needs network access to api.polyhaven.com and dl.polyhaven.org. Pillow (PIL) is optional: with it the
script resizes the small sets and records each image's average colour (used for tinting).
"""
import json
import os
import sys
import urllib.parse
import urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'tex')
API = 'https://api.polyhaven.com'
UA = {'User-Agent': 'CLAWEngineering-house-designer/1.0 (texture fetch script)'}

# slot: (candidate Poly Haven ids in order of preference, search words if none exist, big surface?)
SLOTS = {
    'oak':      (['wood_floor_worn', 'laminate_floor_02', 'wood_floor', 'oak_veneer_01'], ['floor', 'wood'], True),
    'deck':     (['weathered_planks', 'wood_planks_grey', 'old_wood_floor'], ['planks'], True),
    'tile':     (['floor_tiles_06', 'large_floor_tiles_02', 'tiles_white'], ['tiles', 'floor'], True),
    'carpet':   (['carpet', 'rough_carpet'], ['carpet'], True),
    'grass':    (['grass_medium_01', 'aerial_grass_rock', 'forrest_ground_01'], ['grass'], True),
    'asphalt':  (['asphalt_02', 'asphalt_01'], ['asphalt'], True),
    'gravel':   (['gravel_floor_02', 'gravel_floor'], ['gravel'], True),
    'concrete': (['concrete_floor_02', 'concrete_floor_worn_001'], ['concrete', 'floor'], True),
    'siding':   (['painted_planks', 'wood_planks'], ['planks', 'painted'], True),
    'shingle':  (['roof_tiles_14', 'roofing_shingles'], ['roof'], True),
    'cedar':    (['wood_shingles', 'wooden_shingles'], ['shingles'], True),
    'brick':    (['red_brick_03', 'red_brick'], ['brick'], False),
    'stone':    (['stone_wall', 'castle_wall_slates'], ['stone', 'wall'], False),
    'quartz':   (['marble_01', 'white_marble_03'], ['marble'], False),
    'wood':     (['fine_grained_wood', 'wood_table_001', 'dark_wood'], ['wood'], False),
    'butcher':  (['wood_table_worn', 'wood_table_001'], ['wood', 'table'], False),
    'fabric':   (['fabric_pattern_05', 'denim_fabric', 'linen_fabric'], ['fabric'], False),
    'leather':  (['brown_leather', 'leather_red_02', 'leather_white'], ['leather'], False),
    'subway':   (['white_tiles', 'square_tiles'], ['tiles', 'white'], False),
}


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def download(url, path):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, open(path, 'wb') as f:
        f.write(r.read())


_catalog = None


def find_asset(ids, words):
    global _catalog
    for i in ids:
        try:
            return i, get_json(f'{API}/files/{urllib.parse.quote(i)}')
        except Exception:
            continue
    if _catalog is None:
        _catalog = get_json(f'{API}/assets?t=textures')
    for aid, info in _catalog.items():
        text = (aid + ' ' + ' '.join(info.get('tags', [])) + ' ' + ' '.join(info.get('categories', []))).lower()
        if all(w in text for w in words):
            return aid, get_json(f'{API}/files/{urllib.parse.quote(aid)}')
    return None, None


def pick(files, keys, res):
    for k in keys:
        m = files.get(k, {})
        for r in (res, '1k', '2k'):
            u = m.get(r, {}).get('jpg', {}).get('url') or m.get(r, {}).get('png', {}).get('url')
            if u:
                return u
    return None


def main(only):
    os.makedirs(OUT, exist_ok=True)
    man_path = os.path.join(OUT, 'manifest.json')
    try:
        manifest = json.load(open(man_path))
    except Exception:
        manifest = {}
    try:
        from PIL import Image  # optional
    except Exception:
        Image = None
    for slot, (ids, words, big) in SLOTS.items():
        if only and slot not in only:
            continue
        aid, files = find_asset(ids, words)
        if not files:
            print(f'{slot}: no Poly Haven texture found, keeping the procedural one')
            continue
        info = get_json(f'{API}/info/{urllib.parse.quote(aid)}')
        dims = info.get('dimensions') or [2000, 2000]          # millimetres
        ft = round(dims[0] / 304.8, 2)
        entry = {'source': f'https://polyhaven.com/a/{aid}', 'license': 'CC0', 'ft': ft}
        wanted = [('map', ['Diffuse', 'diffuse', 'diff']), ('normal', ['nor_gl', 'Normal'])]
        if big:
            wanted.append(('rough', ['Rough', 'rough', 'arm']))
        for key, names in wanted:
            url = pick(files, names, '1k')
            if not url:
                continue
            fn = f'{slot}_{key}.jpg'
            path = os.path.join(OUT, fn)
            download(url, path)
            if Image is not None:
                im = Image.open(path).convert('RGB')
                if not big and max(im.size) > 512:
                    im = im.resize((512, 512), Image.LANCZOS)
                    im.save(path, quality=85)
                if key == 'map':
                    r, g, b = im.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
                    entry['avg'] = '#%02x%02x%02x' % (r, g, b)
            entry[key] = fn
        if 'map' in entry:
            manifest[slot] = entry
            print(f'{slot}: {aid} ({ft} ft per tile)')
    json.dump(manifest, open(man_path, 'w'), indent=2)
    print('wrote', man_path)


if __name__ == '__main__':
    main(set(sys.argv[1:]))
