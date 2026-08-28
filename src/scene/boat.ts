import * as THREE from "three";
import { PALETTE, darken, lighten, mat, addBlobShadow } from "./palette";

export const BOAT_FLOOR_H = 0.16;

/** Local (boat-space) seat positions — two bench seats, matching the boat's 2-person capacity. */
export const BOAT_LOCAL_SEATS: THREE.Vector3[] = [
  new THREE.Vector3(-0.62, 0, 0.16),
  new THREE.Vector3(0.5, 0, -0.16),
];

// Water spans x -2..2, and the bank's innermost tile edge sits right at
// that boundary. Dock position = bank edge minus half the boat's own
// length, so the hull's outer edge just touches the bank instead of
// clipping through it.
export const DOCK_LEFT_X = -0.7;
export const DOCK_RIGHT_X = 0.7;

/**
 * A real stepped hull, not one flat slab: the cross-section width tapers
 * toward the bow across several stacked segments (a flat stern, a rounder
 * pointed bow), with raised side walls, a trim stripe, and two bench
 * seats — many small blocks reading as one boat shape.
 */
export function buildBoat(): THREE.Group {
  const group = new THREE.Group();
  const hullMat = mat(PALETTE.wood);
  const trimMat = mat(PALETTE.trim);
  const darkWood = mat(darken(PALETTE.wood, 0.3));
  const lightWood = mat(lighten(PALETTE.wood, 0.15));

  const totalLen = 2.6;
  const widths = [1.1, 1.1, 1.02, 0.9, 0.68, 0.38]; // flat stern -> rounder bow
  const segCount = widths.length;
  const segLen = totalLen / segCount;
  const wallH = 0.16;
  const wallThick = 0.06;
  let x = -totalLen / 2;

  for (let i = 0; i < segCount; i++) {
    const w = widths[i];
    const cx = x + segLen / 2;

    const floorSeg = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.015, BOAT_FLOOR_H, w), hullMat);
    floorSeg.position.set(cx, BOAT_FLOOR_H / 2, 0);
    group.add(floorSeg);

    if (w > 0.3) {
      for (const side of [1, -1]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.015, wallH, wallThick), hullMat);
        wall.position.set(cx, BOAT_FLOOR_H + wallH / 2, side * (w / 2 - wallThick / 2));
        group.add(wall);
        const trimStripe = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.02, 0.045, wallThick + 0.012), trimMat);
        trimStripe.position.set(cx, BOAT_FLOOR_H + wallH + 0.02, side * (w / 2 - wallThick / 2));
        group.add(trimStripe);
      }
    }
    x += segLen;
  }

  for (const seat of BOAT_LOCAL_SEATS) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.7), darkWood);
    plank.position.set(seat.x, BOAT_FLOOR_H + 0.06, seat.z);
    group.add(plank);
  }

  const bowTrim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.14), trimMat);
  bowTrim.position.set(totalLen / 2 - 0.04, BOAT_FLOOR_H + 0.03, 0);
  group.add(bowTrim);

  const oarHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.05), darkWood);
  oarHandle.rotation.z = Math.PI / 3.2;
  oarHandle.position.set(0.05, 0.5, 0.68);
  const oarBlade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.44), lightWood);
  oarBlade.position.set(0.62, 0.78, 0.7);
  oarBlade.rotation.z = Math.PI / 3.2;
  group.add(oarHandle, oarBlade);

  addBlobShadow(group, 2.5, 1.15, -0.16);
  return group;
}
