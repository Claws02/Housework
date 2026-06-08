import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FURNITURE_CATALOG } from './furniture.js';

const WALL_H = 8;
const WALL_T = 0.4;

function hexToInt(hex) { return parseInt(hex.replace('#',''), 16); }

function lighten(hex, factor) {
  const n = hexToInt(hex);
  const r = Math.min(255, Math.round(((n>>16)&0xff) * factor));
  const g = Math.min(255, Math.round(((n>>8)&0xff)  * factor));
  const b = Math.min(255, Math.round((n&0xff)        * factor));
  return (r<<16)|(g<<8)|b;
}

function makeWoodTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c8966e';
  ctx.fillRect(0, 0, 512, 512);
  const plankH = 64;
  for (let row = 0; row < 8; row++) {
    const y = row * plankH;
    ctx.fillStyle = row % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, y, 512, plankH);
    // grain lines
    for (let g = 2; g < plankH - 2; g += 5) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.05})`;
      ctx.lineWidth = 0.8;
      ctx.moveTo(0, y + g);
      const cp1x = 128, cp1y = y + g + (Math.random() - 0.5) * 4;
      const cp2x = 384, cp2y = y + g + (Math.random() - 0.5) * 4;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, 512, y + g + (Math.random() - 0.5) * 3);
      ctx.stroke();
    }
    // plank gap
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, y, 512, 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class Viewer3D {
  constructor(container, state) {
    this.container = container;
    this.state = state;
    this._objects = [];
    this._woodTex = makeWoodTexture();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111827);
    this.scene.fog = new THREE.FogExp2(0x111827, 0.01);

    const w = container.clientWidth || 300, h = container.clientHeight || 200;
    this.camera = new THREE.PerspectiveCamera(55, w/h, 0.1, 500);
    this.camera.position.set(15, 20, 25);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 300;
    this.controls.maxPolarAngle = Math.PI/2 + 0.12;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    this._setupLights();
    this._setupBase();

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(container);
    this._animId = null;
    this.buildScene();
    this._animate();
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.0);
    sun.position.set(25, 40, 20);
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, { near:0.1, far:300, left:-80, right:80, top:80, bottom:-80 });
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);
    this.scene.add(Object.assign(new THREE.DirectionalLight(0x8090C0, 0.2), { position: new THREE.Vector3(-20,15,-10) }));
  }

  _setupBase() {
    const grid = new THREE.GridHelper(300, 300, 0x243045, 0x1a2535);
    grid.position.y = -0.01;
    this.scene.add(grid);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshLambertMaterial({ color: 0x111827 })
    );
    floor.rotation.x = -Math.PI/2; floor.receiveShadow = true;
    this.scene.add(floor);
  }

  buildScene() {
    for (const o of this._objects) this.scene.remove(o);
    this._objects = [];
    for (const room of (this.state.rooms || [])) this._addRoom(room);
    for (const w of this.state.walls)     this._addWall(w);
    for (const f of this.state.furniture) this._addFurniture(f);
  }

  _addRoom(room) {
    const tex = this._woodTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(room.width / 5, room.height / 5);
    const floorMat = new THREE.MeshLambertMaterial({ map: tex, color: lighten(room.color, 0.55) });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.width, room.height), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(room.x + room.width/2, 0.006, room.y + room.height/2);
    floor.receiveShadow = true;
    this._add(floor);

    const wallMat = new THREE.MeshLambertMaterial({ color: 0xCBD5E0 });
    const sides = [
      { w:room.width,  x:room.x+room.width/2,  z:room.y,               ry:0         },
      { w:room.width,  x:room.x+room.width/2,  z:room.y+room.height,   ry:0         },
      { w:room.height, x:room.x,               z:room.y+room.height/2, ry:Math.PI/2 },
      { w:room.height, x:room.x+room.width,    z:room.y+room.height/2, ry:Math.PI/2 },
    ];
    for (const s of sides) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, WALL_H, WALL_T), wallMat);
      mesh.position.set(s.x, WALL_H/2, s.z);
      mesh.rotation.y = s.ry;
      mesh.castShadow = true; mesh.receiveShadow = true;
      this._add(mesh);
    }
  }

  _addWall(w) {
    const dx = w.x2-w.x1, dy = w.y2-w.y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(len, WALL_H, WALL_T),
      new THREE.MeshLambertMaterial({ color: 0xCBD5E0 })
    );
    mesh.position.set((w.x1+w.x2)/2, WALL_H/2, (w.y1+w.y2)/2);
    mesh.rotation.y = -Math.atan2(dy, dx);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this._add(mesh);
  }

  _addFurniture(item) {
    const cat  = FURNITURE_CATALOG.find(c => c.type === item.type);
    const h3d  = cat ? cat.height3d : 2.5;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(item.width, h3d, item.depth),
      new THREE.MeshLambertMaterial({ color: hexToInt(item.color) })
    );
    mesh.position.set(item.x, h3d/2, item.y);
    mesh.rotation.y = -item.rotation;
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 })
    ));
    this._add(mesh);
  }

  _add(o) { this.scene.add(o); this._objects.push(o); }

  _resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w/h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    this._animId = requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  refresh() { this.buildScene(); }

  focusOnLayout() {
    let mnX=Infinity, mxX=-Infinity, mnZ=Infinity, mxZ=-Infinity;
    for (const r of (this.state.rooms||[])) {
      mnX=Math.min(mnX,r.x); mxX=Math.max(mxX,r.x+r.width);
      mnZ=Math.min(mnZ,r.y); mxZ=Math.max(mxZ,r.y+r.height);
    }
    for (const w of this.state.walls) {
      mnX=Math.min(mnX,w.x1,w.x2); mxX=Math.max(mxX,w.x1,w.x2);
      mnZ=Math.min(mnZ,w.y1,w.y2); mxZ=Math.max(mxZ,w.y1,w.y2);
    }
    for (const f of this.state.furniture) {
      mnX=Math.min(mnX,f.x-f.width/2); mxX=Math.max(mxX,f.x+f.width/2);
      mnZ=Math.min(mnZ,f.y-f.depth/2); mxZ=Math.max(mxZ,f.y+f.depth/2);
    }
    if (!isFinite(mnX)) return;
    const cx=(mnX+mxX)/2, cz=(mnZ+mxZ)/2;
    const span = Math.max(mxX-mnX, mxZ-mnZ, 10);
    this.camera.position.set(cx+span*.6, span*.7, cz+span*.9);
    this.controls.target.set(cx, 0, cz);
    this.controls.update();
  }

  destroy() {
    if (this._animId) cancelAnimationFrame(this._animId);
    this._ro.disconnect(); this.controls.dispose(); this.renderer.dispose();
    this.renderer.domElement.parentNode?.removeChild(this.renderer.domElement);
  }
}
