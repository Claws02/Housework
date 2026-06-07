import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FURNITURE_CATALOG } from './furniture.js';

const WALL_H = 8;
const WALL_T = 0.4;

export class Viewer3D {
  constructor(container, state) {
    this.container = container;
    this.state = state;
    this._objects = [];

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111827);
    this.scene.fog = new THREE.FogExp2(0x111827, 0.012);

    const w = container.clientWidth, h = container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 500);
    this.camera.position.set(15, 20, 25);
    this.camera.lookAt(0, 0, 0);

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
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 300;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.15;
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
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.0);
    sun.position.set(25, 40, 20);
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, { near: 0.1, far: 300, left: -80, right: 80, top: 80, bottom: -80 });
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8090C0, 0.25);
    fill.position.set(-20, 15, -10);
    this.scene.add(fill);
  }

  _setupBase() {
    const grid = new THREE.GridHelper(300, 300, 0x243045, 0x1a2535);
    grid.position.y = -0.01;
    this.scene.add(grid);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshLambertMaterial({ color: 0x111827 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  buildScene() {
    for (const obj of this._objects) this.scene.remove(obj);
    this._objects = [];

    if (this.state.walls.length > 0) this._buildFloor();

    for (const w of this.state.walls) this._addWall(w);
    for (const f of this.state.furniture) this._addFurniture(f);
  }

  _buildFloor() {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const w of this.state.walls) {
      minX = Math.min(minX, w.x1, w.x2); maxX = Math.max(maxX, w.x1, w.x2);
      minZ = Math.min(minZ, w.y1, w.y2); maxZ = Math.max(maxZ, w.y1, w.y2);
    }
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(maxX - minX, maxZ - minZ),
      new THREE.MeshLambertMaterial({ color: 0xC8B89A })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((minX + maxX) / 2, 0.005, (minZ + maxZ) / 2);
    mesh.receiveShadow = true;
    this._add(mesh);
  }

  _addWall(w) {
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(len, WALL_H, WALL_T),
      new THREE.MeshLambertMaterial({ color: 0xCBD5E0 })
    );
    mesh.position.set((w.x1 + w.x2) / 2, WALL_H / 2, (w.y1 + w.y2) / 2);
    mesh.rotation.y = -Math.atan2(dy, dx);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this._add(mesh);
  }

  _addFurniture(item) {
    const cat = FURNITURE_CATALOG.find(c => c.type === item.type);
    const h3d = cat ? cat.height3d : 2.5;
    const hex = parseInt(item.color.replace('#', ''), 16);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(item.width, h3d, item.depth),
      new THREE.MeshLambertMaterial({ color: hex })
    );
    mesh.position.set(item.x, h3d / 2, item.y);
    mesh.rotation.y = -item.rotation;
    mesh.castShadow = true; mesh.receiveShadow = true;

    // Edge outline
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 })
    );
    mesh.add(edges);

    this._add(mesh);
  }

  _add(obj) { this.scene.add(obj); this._objects.push(obj); }

  _resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    this._animId = requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  refresh() { this.buildScene(); }

  focusOnLayout() {
    if (this.state.walls.length === 0 && this.state.furniture.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const w of this.state.walls) {
      minX = Math.min(minX, w.x1, w.x2); maxX = Math.max(maxX, w.x1, w.x2);
      minZ = Math.min(minZ, w.y1, w.y2); maxZ = Math.max(maxZ, w.y1, w.y2);
    }
    for (const f of this.state.furniture) {
      minX = Math.min(minX, f.x - f.width / 2); maxX = Math.max(maxX, f.x + f.width / 2);
      minZ = Math.min(minZ, f.y - f.depth / 2); maxZ = Math.max(maxZ, f.y + f.depth / 2);
    }
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxZ - minZ);
    this.camera.position.set(cx + span * 0.7, span * 0.8, cz + span);
    this.controls.target.set(cx, 0, cz);
    this.controls.update();
  }

  destroy() {
    if (this._animId) cancelAnimationFrame(this._animId);
    this._ro.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode)
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
  }
}
