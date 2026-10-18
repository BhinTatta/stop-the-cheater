import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Collapse a tree of static meshes into one mesh per render signature.
 *
 * The scenery is built the readable way — a mesh per tile, per band, per
 * blade of grass — which on a deep bank means thousands of draw calls a
 * frame, and draw calls are what a mid-range Android actually runs out
 * of. Merging keeps the authoring style and pays the cost once at build
 * time: each source mesh's colour moves into a vertex-colour attribute,
 * so a single material can stand in for the hundreds that differed only
 * by colour.
 *
 * Only for geometry that never moves again — a merged mesh has no
 * individual parts left to animate or frustum-cull.
 */

/** Materials that can share one draw call once colour moves to vertices. */
function signature(material: THREE.Material): string {
  const m = material as THREE.MeshStandardMaterial;
  return [
    material.type,
    material.transparent ? `t${material.opacity}` : "o",
    material.depthWrite ? "dw" : "nw",
    material.side,
    m.flatShading ? "flat" : "smooth",
    m.roughness ?? "-",
    m.metalness ?? "-",
  ].join(":");
}

/** Per-vertex colours from the mesh's material(s), so one material can replace many. */
function bakeColors(geometry: THREE.BufferGeometry, materials: THREE.Material[]): void {
  if (geometry.getAttribute("color")) return;
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);

  const colorOf = (i: number): THREE.Color =>
    ((materials[i] ?? materials[0]) as THREE.MeshStandardMaterial).color ?? new THREE.Color(0xffffff);

  const fill = (vertex: number, c: THREE.Color): void => {
    // material.color is already linear-space, which is exactly what a
    // vertex-colour attribute wants — no conversion, no colour shift.
    colors[vertex * 3] = c.r;
    colors[vertex * 3 + 1] = c.g;
    colors[vertex * 3 + 2] = c.b;
  };

  const index = geometry.getIndex();
  if (materials.length > 1 && geometry.groups.length && index) {
    // Per-face materials (the grass-capped dirt tiles): colour through the
    // index buffer rather than by assuming a vertex order, then let
    // toNonIndexed() expand it alongside the positions.
    for (const group of geometry.groups) {
      const c = colorOf(group.materialIndex ?? 0);
      for (let i = group.start; i < group.start + group.count; i++) fill(index.getX(i), c);
    }
  } else {
    const c = colorOf(0);
    for (let v = 0; v < count; v++) fill(v, c);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

const KEEP_ATTRIBUTES = new Set(["position", "normal", "color"]);

export interface MergeResult {
  group: THREE.Group;
  /** Draw calls saved — how many meshes went in versus came out. */
  sourceMeshes: number;
  mergedMeshes: number;
}

export function mergeStatic(root: THREE.Object3D, name = "merged"): MergeResult {
  root.updateMatrixWorld(true);

  const buckets = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>();
  const sources: THREE.Mesh[] = [];

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry.getAttribute("position")) return;
    sources.push(mesh);

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let geometry = mesh.geometry.clone();
    bakeColors(geometry, materials);
    if (geometry.getIndex()) {
      const expanded = geometry.toNonIndexed();
      geometry.dispose();
      geometry = expanded;
    }
    // mergeGeometries demands identical attribute sets; nothing here is
    // textured, so UVs are dead weight that would only have to match.
    for (const key of Object.keys(geometry.attributes)) {
      if (!KEEP_ATTRIBUTES.has(key)) geometry.deleteAttribute(key);
    }
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.clearGroups();

    const key = signature(materials[0]);
    const bucket = buckets.get(key) ?? { material: materials[0], geometries: [] };
    bucket.geometries.push(geometry);
    buckets.set(key, bucket);
  });

  const group = new THREE.Group();
  group.name = name;
  buckets.forEach((bucket, key) => {
    const merged = mergeGeometries(bucket.geometries, false);
    bucket.geometries.forEach((g) => g.dispose());
    if (!merged) return;
    const material = bucket.material.clone();
    (material as THREE.MeshStandardMaterial).color = new THREE.Color(0xffffff);
    material.vertexColors = true;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `${name}:${key}`;
    // One mesh spanning the whole bank is always on screen; skipping the
    // per-frame bounds test costs nothing and avoids a pointless matrix.
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  });

  sources.forEach((mesh) => mesh.geometry.dispose());

  return { group, sourceMeshes: sources.length, mergedMeshes: group.children.length };
}

/** Release everything a merged group owns — its geometry and its stand-in materials are not shared. */
export function disposeMerged(group: THREE.Object3D): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
  });
}
