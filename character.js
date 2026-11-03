// A small stylized person (~5.6 ft tall) with a procedural walk cycle.
// Local frame: feet at y = 0, facing +z.
import * as THREE from 'three';

export const SHIRT_COLORS = ['#2f6fb5', '#d9534f', '#3a9a5b', '#f0ad4e', '#7b5ea7', '#20a8a8', '#f3f1ec', '#2b2b2e'];

export function makeCharacter({ shirt = SHIRT_COLORS[0], pants = '#2b3a55', skin = '#e3b590', hair = '#3b2a1e', shoes = '#1f1f22' } = {}) {
  const std = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const mShirt = std(shirt, 0.85), mPants = std(pants, 0.9), mSkin = std(skin, 0.6), mHair = std(hair, 0.9), mShoe = std(shoes, 0.5);
  const mEye = std('#111111', 0.3);

  const root = new THREE.Group();     // yaw lives here
  const body = new THREE.Group();     // bob lives here
  root.add(body);

  const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o; };
  const limb = (radius, length, m) => {
    // capsule hanging down from its pivot at y = 0
    const g = new THREE.CapsuleGeometry(radius, length - radius * 2, 4, 10);
    g.translate(0, -length / 2, 0);
    return g;
  };

  // Legs (pivot at the hip)
  const hipY = 2.7, legLen = 2.6;
  const legs = [-1, 1].map(s => {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.3, hipY, 0);
    pivot.add(mesh(limb(0.21, legLen), mPants));
    const shoe = mesh(new THREE.BoxGeometry(0.36, 0.22, 0.62), mShoe, 0, -legLen + 0.1, 0.1);
    pivot.add(shoe);
    body.add(pivot);
    return pivot;
  });

  // Torso + hips
  const torso = mesh(new THREE.CapsuleGeometry(0.55, 1.1, 4, 12), mShirt, 0, 3.75, 0);
  torso.scale.set(1.1, 1, 0.68);
  body.add(torso);
  const hips = mesh(new THREE.CapsuleGeometry(0.5, 0.15, 4, 12), mPants, 0, 2.85, 0);
  hips.scale.set(1.1, 1, 0.68);
  body.add(hips);

  // Arms (pivot at the shoulder)
  const shoulderY = 4.55, armLen = 2.0;
  const arms = [-1, 1].map(s => {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.72, shoulderY, 0);
    pivot.add(mesh(limb(0.16, armLen * 0.55), mShirt));                 // sleeve
    const fore = mesh(limb(0.14, armLen * 0.5), mSkin, 0, -armLen * 0.5, 0);
    pivot.add(fore);
    pivot.rotation.z = s * 0.08;
    body.add(pivot);
    return pivot;
  });

  // Head
  const neck = mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.3, 10), mSkin, 0, 4.85, 0);
  body.add(neck);
  const head = new THREE.Group(); head.position.set(0, 5.25, 0); body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.42, 20, 16), mSkin));
  const hairCap = mesh(new THREE.SphereGeometry(0.45, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mHair, 0, 0.04, -0.03);
  head.add(hairCap);
  for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.055, 8, 6), mEye, s * 0.15, 0.03, 0.38));
  head.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), mSkin, 0, -0.06, 0.42));        // nose

  // Soft blob shadow so the character reads on any floor even with shadows off
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; root.add(blob);

  let phase = 0;
  return {
    group: root,
    setShirt(c) { mShirt.color.set(c); },
    /** speed: ft/s actually moved this frame */
    animate(dt, speed, airborne = false) {
      const s = Math.min(1, speed / 11);
      if (speed > 0.2) phase += dt * (4.5 + speed * 0.75);
      else phase *= Math.pow(0.001, dt);               // ease back to standing
      const swing = Math.sin(phase) * (0.25 + s * 0.6) * (speed > 0.2 ? 1 : Math.min(1, Math.abs(phase)));
      legs[0].rotation.x = swing; legs[1].rotation.x = -swing;
      arms[0].rotation.x = -swing * 0.9; arms[1].rotation.x = swing * 0.9;
      body.position.y = Math.abs(Math.cos(phase)) * 0.12 * s;
      body.rotation.x = s * 0.12;                        // lean into the run
      if (airborne) { legs[0].rotation.x = 0.5; legs[1].rotation.x = -0.2; }
      const t = performance.now() / 1000;
      torso.scale.y = 1 + Math.sin(t * 2) * 0.012;       // idle breathing
      head.rotation.y = speed > 0.2 ? 0 : Math.sin(t * 0.6) * 0.25;
    },
  };
}
