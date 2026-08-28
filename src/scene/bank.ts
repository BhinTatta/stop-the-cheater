import * as THREE from "three";
import { PALETTE, darken, hash, mat, place } from "./palette";
import { buildBush, buildFlower, buildPebble, buildReed, buildTree, buildTuft } from "./props";

const GRASS_LIGHT = mat(PALETTE.grassLight);
const GRASS_DARK = mat(PALETTE.grassDark);
const GRASS_WET_LIGHT = mat(darken(PALETTE.grassLight, 0.18));
const GRASS_WET_DARK = mat(darken(PALETTE.grassDark, 0.18));
const dirtBands = PALETTE.dirt.map((c) => mat(c));

const ROWS_Z = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
const FLOWER_COLORS = ["#FFFFFF", PALETTE.trim, "#FF6FA8"];

export interface BankSpec {
  xs: number[];
  riverEdgeX: number;
  treeSpots: [number, number][];
  bushSpots?: [number, number][];
}

export function buildBank(spec: BankSpec): THREE.Group {
  const group = new THREE.Group();
  spec.xs.forEach((x) => {
    ROWS_Z.forEach((z) => {
      const isEdge = Math.abs(x - spec.riverEdgeX) < 0.01;
      // Alternating two-tone checker, not random jitter — the flat,
      // deliberately-patterned ground read is what the reference has and a
      // noisy random tint doesn't.
      const checker = (Math.round(x) + Math.round(z)) % 2 === 0;
      const topMat = isEdge ? (checker ? GRASS_WET_LIGHT : GRASS_WET_DARK) : checker ? GRASS_LIGHT : GRASS_DARK;

      // Three stacked dirt bands under the grass cap — visible strata like
      // the reference, and none of the three drops toward black.
      const bandHeight = 0.11 + (hash(x * 2, z * 2) - 0.5) * 0.015;
      const capHeight = 0.18;
      let y = 0;
      for (let b = 0; b < 3; b++) {
        const bandMat = dirtBands[(b + Math.floor(hash(x + 50, z) * 3)) % 3];
        const band = new THREE.Mesh(new THREE.BoxGeometry(1, bandHeight, 1), bandMat);
        band.position.set(x, y + bandHeight / 2, z);
        group.add(band);
        y += bandHeight;
      }

      const capTile = new THREE.Mesh(
        new THREE.BoxGeometry(1, capHeight, 1),
        [dirtBands[0], dirtBands[0], topMat, dirtBands[0], dirtBands[0], dirtBands[0]],
      );
      capTile.position.set(x, y + capHeight / 2, z);
      group.add(capTile);

      const topY = y + capHeight;
      const r = hash(x * 3.1, z * 7.7);
      if (r > 0.9) {
        group.add(place(buildFlower(FLOWER_COLORS[Math.floor(r * 97) % 3]), x, topY, z));
      } else if (r > 0.82) {
        group.add(place(buildPebble(), x, topY, z));
      } else if (r > 0.72) {
        group.add(place(buildTuft(), x, topY, z));
      }

      if (isEdge && hash(x + 9, z + 9) > 0.62) {
        const edgeSign = spec.riverEdgeX > 0 ? -1 : 1;
        group.add(place(buildReed(), x + edgeSign * 0.42, topY, z));
      }
    });
  });

  spec.treeSpots.forEach((spot) => {
    const tree = buildTree();
    const scale = 0.85 + hash(spot[0] * 5.1, spot[1] * 3.7) * 0.5;
    tree.scale.setScalar(scale);
    group.add(place(tree, spot[0], 0.5, spot[1]));
  });
  (spec.bushSpots ?? []).forEach((spot) => {
    group.add(place(buildBush(), spot[0], 0.5, spot[1]));
  });

  return group;
}

// Both banks extend well past x=+/-9 — far past where the camera frame's
// edge actually falls — so there's no point at which the ground visibly
// stops and sky shows through underneath it.
const LEFT_BANK_XS = [-11.5, -10.5, -9.5, -8.5, -7.5, -6.5, -5.5, -4.5, -3.5, -2.5];
const RIGHT_BANK_XS = [2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5];

// Trees only go on the far bank (background, away from the fixed camera).
// The near bank — the one between the camera and the play area — gets low
// bushes instead, so nothing tall sits in the sightline and blocks the
// boat/characters. Thinned out and kept clear of x=-4.1 (where the
// green/blue couples' back-corner slots land once they cross over).
export const LEFT_BANK_SPEC: BankSpec = {
  xs: LEFT_BANK_XS,
  riverEdgeX: -2.5,
  treeSpots: [
    [-11.5, -2.6], [-11.5, 1.8], [-10.3, -1.0], [-10.3, 3.0],
    [-9.2, -3.4], [-9.2, 0.4], [-8.0, 2.2], [-8.0, -2.0],
    [-6.7, 0.6], [-6.7, -3.0],
  ],
  bushSpots: [[-3.4, -3.2], [-3.4, 3.2]],
};

export const RIGHT_BANK_SPEC: BankSpec = {
  xs: RIGHT_BANK_XS,
  riverEdgeX: 2.5,
  treeSpots: [],
  bushSpots: [
    [3.5, -1.9], [3.5, 1.9], [5.5, -3.4], [5.5, 3.4],
    [6.5, -1.6], [6.5, 1.6], [8.0, -3.0], [8.0, 3.0],
    [9.5, -1.9], [9.5, 1.9], [10.8, -3.2], [10.8, 3.2],
  ],
};
