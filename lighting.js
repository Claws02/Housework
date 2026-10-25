// Atmosphere (sky, sun, time of day, fixture lights) and the render pipeline (AO, bloom, quality levels).
// Scene units are feet, so light intensities are tuned for feet rather than metres.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LAMP_MATS } from './models3d.js';

// ── Time of day ──────────────────────────────────────────────────────────────
// elevation/azimuth in degrees; azimuth 0 = from +z (the street side), 90 = from +x.
export const TIMES = {
  day:     { label: '☀ Day',     elev: 50, azim: 210, sun: '#fff1dc', sunI: 2.5, hemiSky: '#d6e6fa', hemiGround: '#8a7f70', hemiI: 0.7, env: 0.75, exposure: 0.95, inHemi: 1.25, inEnv: 0.3,
             sky: { turbidity: 3.5, rayleigh: 1.1, mie: 0.003, mieG: 0.78 }, fog: '#c4d8ea', lights: false },
  evening: { label: '🌇 Evening', elev: 7,  azim: 255, sun: '#ffb46b', sunI: 2.2, hemiSky: '#f2c9a6', hemiGround: '#5b4b40', hemiI: 0.42, env: 0.5, exposure: 1.05, inHemi: 0.45, inEnv: 0.12,
             sky: { turbidity: 9, rayleigh: 2.6, mie: 0.006, mieG: 0.88 }, fog: '#e5b996', lights: true },
  night:   { label: '🌙 Night',   elev: 38, azim: 140, sun: '#a9bdff', sunI: 0.4, hemiSky: '#34486e', hemiGround: '#1c1c1c', hemiI: 0.34, env: 0.15, exposure: 1.3, inHemi: 0.25, inEnv: 0.05,
             sky: null, fog: '#0d1422', lights: true },
};

// ── Quality levels ──────────────────────────────────────────────────────────
export const QUALITY = {
  low:    { label: 'Low',    pixelRatio: 1,   shadow: 2048, soft: false, ao: false, bloom: false, lamps: 2, msaa: 0 },
  medium: { label: 'Medium', pixelRatio: 1.5, shadow: 2048, soft: true,  ao: true,  bloom: false, lamps: 4, msaa: 4 },
  high:   { label: 'High',   pixelRatio: 2,   shadow: 4096, soft: true,  ao: true,  bloom: true,  lamps: 8, msaa: 4 },
};

export function defaultQuality() {
  const coarse = matchMedia('(pointer: coarse)').matches, small = Math.min(screen.width, screen.height) < 820;
  return coarse || small ? 'medium' : 'high';
}

// Fixture models that emit light, with the bulb position (fraction of item height) and brightness.
const FIXTURES = {
  ceilingLight: { at: 0.2, I: 38, dist: 22 },
  pendant:      { at: 0.45, I: 26, dist: 18 },
  lantern:      { at: 0.5, I: 20, dist: 18 },
  floorLamp:    { at: 0.88, I: 24, dist: 16 },
  tableLamp:    { at: 0.75, I: 16, dist: 12 },
  lampPost:     { at: 0.9, I: 30, dist: 22 },
};
export const isFixture = model => !!FIXTURES[model];

export class Atmosphere {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.sky = new Sky();
    this.sky.scale.setScalar(1200);
    scene.add(this.sky);
    this.hemi = new THREE.HemisphereLight(0xdfefff, 0x9a8f80, 0.85);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.035;
    scene.add(this.sun, this.sun.target);
    this.sunDir = new THREE.Vector3();
    this._pmrem = new THREE.PMREMGenerator(renderer);
    this._skyScene = new THREE.Scene();
    this.lamps = [];                // pooled point lights
    this.fixtures = [];             // [{pos, I, dist}] gathered on scene build
    this.lightsOn = null;           // null = follow time of day
  }

  setTime(key) {
    const t = TIMES[key] || TIMES.day;
    this.timeKey = key;
    const phi = THREE.MathUtils.degToRad(90 - t.elev), theta = THREE.MathUtils.degToRad(t.azim);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    this.sun.color.set(t.sun); this.sun.intensity = t.sunI;
    this._applyFill(t);
    this.renderer.toneMappingExposure = t.exposure;
    this.shadowDirty = true;
    this.scene.fog = new THREE.Fog(t.fog, 260, 900);

    const u = this.sky.material.uniforms;
    if (t.sky) {
      this.sky.visible = true;
      u.turbidity.value = t.sky.turbidity; u.rayleigh.value = t.sky.rayleigh;
      u.mieCoefficient.value = t.sky.mie; u.mieDirectionalG.value = t.sky.mieG;
      u.sunPosition.value.copy(this.sunDir);
      this.scene.background = null;
    } else {
      this.sky.visible = false;
      this.scene.background = new THREE.Color('#0b1020');
    }
    // Environment lighting & reflections from the sky (or a dim night gradient)
    this._skyScene.clear();
    if (t.sky) {
      const s = new Sky(); s.scale.setScalar(1000);
      for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) s.material.uniforms[k].value = u[k].value;
      s.material.uniforms.sunPosition.value.copy(this.sunDir);
      this._skyScene.add(s);
    } else {
      this._skyScene.background = new THREE.Color('#141c30');
    }
    const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 24), new THREE.MeshBasicMaterial({ color: t.hemiGround }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -2;
    this._skyScene.add(ground);
    this.scene.environment?.dispose?.();
    this.scene.environment = this._pmrem.fromScene(this._skyScene, 0.02, 1, 2000).texture;
    this.applyEnv();
    this._applyLamps();
  }

  /** Sky fill: outdoors it's the open sky; indoors (walking) the roof blocks most of it, so the
   *  fill gets dimmer and warmer and daylight comes mainly through the windows. */
  _applyFill(t = TIMES[this.timeKey]) {
    this.hemi.color.set(t.hemiSky); this.hemi.groundColor.set(t.hemiGround);
    if (this.indoor) { this.hemi.color.lerp(new THREE.Color('#f4e7d3'), 0.85); this.hemi.groundColor.lerp(new THREE.Color('#bfa385'), 0.7); }
    this.hemi.intensity = this.indoor ? t.inHemi : t.hemiI;
    this.applyEnv();
  }

  /** three r160 has no scene.environmentIntensity, so scale each material's envMapIntensity. */
  applyEnv() {
    const t = TIMES[this.timeKey]; if (!t) return;
    const v = this.indoor ? t.inEnv : t.env;
    this.scene.traverse(o => {
      if (!o.isMesh || o === this.sky) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && 'envMapIntensity' in m) m.envMapIntensity = v;
    });
  }

  setIndoor(v) { if (this.indoor === v) return; this.indoor = v; if (this.timeKey) this._applyFill(); }

  get lampsLit() { return this.lightsOn ?? TIMES[this.timeKey]?.lights ?? false; }

  setLightsOn(v) { this.lightsOn = v; this._applyLamps(); }

  _applyLamps() {
    const on = this.lampsLit;
    for (const m of LAMP_MATS) m.emissiveIntensity = (m.userData.base ?? 1) * (on ? 1.6 : 0.12);
    for (const l of this.lamps) l.visible = on;
  }

  /** Keep a fixed pool of point lights (shader recompiles happen when the count changes). */
  setLampCount(n) {
    while (this.lamps.length < n) {
      const l = new THREE.PointLight(0xffd29a, 0, 18, 2);   // ~2700 K
      l.castShadow = false;
      this.scene.add(l); this.lamps.push(l);
    }
    while (this.lamps.length > n) this.scene.remove(this.lamps.pop());
    this._applyLamps();
  }

  /** Fixture list is rebuilt with the scene: node = the item's 3D group, model key from the catalog. */
  setFixtures(list) {
    this.fixtures = list.map(({ node, model, h }) => {
      const f = FIXTURES[model];
      const p = node.getWorldPosition(new THREE.Vector3());
      p.y += h * f.at;
      return { pos: p, I: f.I, dist: f.dist };
    });
    this._lampTimer = 0;
  }

  /** Each frame: move the sun's shadow box to the area of interest; hand lamps to the nearest fixtures. */
  update(dt, focus, focusSize, camPos) {
    // sun + shadow frustum centred on the focus, snapped to texels to avoid shimmer
    const half = THREE.MathUtils.clamp(focusSize, 30, 120);
    const cam = this.sun.shadow.camera;
    if (cam.right !== half) { cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.near = 1; cam.far = 600; cam.updateProjectionMatrix(); }
    const texel = (2 * half) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
    // Shadows are only re-rendered when something changed (big saving on phones)
    const key = `${fx.toFixed(2)},${focus.y.toFixed(1)},${fz.toFixed(2)},${half}`;
    if (key !== this._shadowKey) { this._shadowKey = key; this.shadowDirty = true; }
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx, focus.y, fz).addScaledVector(this.sunDir, 250);
    this.sun.target.updateMatrixWorld();
    if (this.shadowDirty) { this.renderer.shadowMap.needsUpdate = true; this.shadowDirty = false; }

    this._lampTimer = (this._lampTimer ?? 0) - dt;
    if (this._lampTimer > 0 || !this.lamps.length) return;
    this._lampTimer = 0.25;
    const ranked = this.fixtures.map(f => ({ f, d: f.pos.distanceToSquared(camPos) })).sort((a, b) => a.d - b.d);
    this.lamps.forEach((l, i) => {
      const r = ranked[i];
      if (!r) { l.intensity = 0; return; }
      l.position.copy(r.f.pos); l.intensity = r.f.I; l.distance = r.f.dist;
    });
  }
}

export class Pipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.composer = null;
  }

  setQuality(key, atmosphere) {
    const q = QUALITY[key] || QUALITY.medium;
    this.key = key; this.q = q;
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    r.shadowMap.type = q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    const sh = atmosphere.sun.shadow;
    if (sh.mapSize.x !== q.shadow) { sh.mapSize.set(q.shadow, q.shadow); sh.map?.dispose(); sh.map = null; }
    r.shadowMap.needsUpdate = true;
    atmosphere.shadowDirty = true;
    atmosphere.setLampCount(q.lamps);

    this.composer?.dispose?.();
    this.composer = null;
    if (q.ao || q.bloom) {
      const size = r.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.msaa });
      const c = new EffectComposer(r, rt);
      c.addPass(new RenderPass(this.scene, this.camera));
      if (q.ao) {
        const ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
        ao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: key === 'high' ? 16 : 10 });
        ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: key === 'high' ? 16 : 8 });
        ao.blendIntensity = 0.85;
        c.addPass(ao); this.ao = ao;
      } else this.ao = null;
      if (q.bloom) {
        this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.5, 0.92);
        c.addPass(this.bloom);
      } else this.bloom = null;
      c.addPass(new OutputPass());
      this.composer = c;
      this.resize();
    }
  }

  resize() {
    if (!this.composer) return;
    const s = this.renderer.getSize(new THREE.Vector2());
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(s.x, s.y);
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
