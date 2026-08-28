import * as THREE from "three";

/**
 * A small curated set of fully-saturated colors — everything in the scene
 * is one of these or a close variant (via darken()/lighten()). The only
 * exception is the dirt/soil trim, which is allowed to be an earthy brown.
 * Locked from the look-dev art-direction pass (see SPEC.md).
 */
export const PALETTE = {
  grassLight: "#7EE84B",
  grassDark: "#4FC72A",
  water: "#2FE0EA",
  wood: "#B5651D",
  trim: "#FFCC29",
  red: "#FF3B30",
  green: "#1FCB6B",
  blue: "#2D8CFF",
  sky: "#8ED9F5",
  skin: "#FFCB8E",
  ink: "#1A1310",
  dirt: ["#8B5A2E", "#79491F", "#67391A"],
} as const;

export function darken(hex: THREE.ColorRepresentation, amount: number): THREE.Color {
  return new THREE.Color(hex).lerp(new THREE.Color(0x000000), amount);
}

export function lighten(hex: THREE.ColorRepresentation, amount: number): THREE.Color {
  return new THREE.Color(hex).lerp(new THREE.Color(0xffffff), amount);
}

/**
 * flatShading (not smooth PBR gradients) is what actually produces the
 * voxel read — rounded or blocky, smooth shading on any geometry gives the
 * generic "stock 3D icon" gradient look.
 */
export function mat(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.92, metalness: 0.02 });
}

/** Deterministic pseudo-random in [0,1), used for tile checker/prop placement so re-renders don't reshuffle the world. */
export function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Flat, solid-color rectangles — not a soft radial blob — so contact
 * shadows read as hard-edged blocky shapes consistent with the voxel
 * world, matching each object's actual footprint.
 */
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x081210, transparent: true, opacity: 0.32, depthWrite: false });

export function addBlobShadow(parent: THREE.Object3D, sizeX: number, sizeZ: number, y: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sizeX, sizeZ), shadowMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  parent.add(mesh);
  return mesh;
}

export function place<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number): T {
  obj.position.x += x;
  obj.position.y += y;
  obj.position.z += z;
  return obj;
}
