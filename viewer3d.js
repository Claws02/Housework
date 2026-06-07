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

export class Viewer3D {
  constructor(container, state) {
    this.container = container;
    this.state = state;
    this._objects = [];

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
      new THREE.PlaneGeometry(300,300),
      new THREE.MeshLambertMaterial({ color: 0x111827 })
    );
    floor.rotation.x = -Math.PI/2; floor.receiveShadow = true;
    this.scene.add(floor);
  }

  buildScene() {
    for (const o of this._objects) this.scene.remove(o);
    this._objects = [];

    for (const room of (this.state.rooms || [])) this._addRoom(room);
    for (const w of this.state.walls)      this._addWall(w);
    for (const f of this.state.furniture)  this._addFurniture(f);
  }

  _addRoom(room) {
    // Floor fill
    const floorMat = new THREE.MeshLambertMaterial({ color: lighten(room.color, 0.45), side: THREE.FrontSide });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.width, room.height), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(room.x + room.width/2, 0.006, room.y + room.height/2);
    floor.receiveShadow = true;
    this._add(floor);

    // Perimeter walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xCBD5E0 });
    const sides = [
      { w: room.width, x: room.x+room.width/2, z: room.y,              ry: 0          },
      { w: room.width, x: room.x+room.width/2, z: room.y+room.height,  ry: 0          },
      { w: room.height,x: room.x,              z: room.y+room.height/2, ry: Math.PI/2  },
      { w: room.height,x: room.x+room.width,   z: room.y+room.height/2, ry: Math.PI/2  },
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
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent:true, opacity:0.12 })
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
    let minX=Infinity, maxX=-Infinity, minZ=Infinity, maxZ=-Infinity;
    for (const r of (this.state.rooms||[])) {
      minX=Math.min(minX,r.x); maxX=Math.max(maxX,r.x+r.width);
      minZ=Math.min(minZ,r.y); maxZ=Math.max(maxZ,r.y+r.height);
    }
    for (const w of this.state.walls) {
      minX=Math.min(minX,w.x1,w.x2); maxX=Math.max(maxX,w.x1,w.x2);
      minZ=Math.min(minZ,w.y1,w.y2); maxZ=Math.max(maxZ,w.y1,w.y2);
    }
    for (const f of this.state.furniture) {
      minX=Math.min(minX,f.x-f.width/2); maxX=Math.max(maxX,f.x+f.width/2);
      minZ=Math.min(minZ,f.y-f.depth/2); maxZ=Math.max(maxZ,f.y+f.depth/2);
    }
    if (!isFinite(minX)) return;
    const cx=(minX+maxX)/2, cz=(minZ+maxZ)/2;
    const span=Math.max(maxX-minX, maxZ-minZ, 10);
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
