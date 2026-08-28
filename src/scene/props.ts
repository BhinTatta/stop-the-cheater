import * as THREE from "three";
import { PALETTE, darken, lighten, mat, addBlobShadow } from "./palette";

/**
 * Every prop is a fraction of character height (~1 unit) and uses a
 * variant of the curated palette — nothing new, muddy, or gray creeps in.
 */

const grassDarkMat = mat(PALETTE.grassDark);

export function buildFlower(color: THREE.ColorRepresentation): THREE.Group {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), grassDarkMat);
  stem.position.y = 0.08;
  const bloom = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), mat(color));
  bloom.rotation.y = Math.PI / 4;
  bloom.position.y = 0.13;
  group.add(stem, bloom);
  return group;
}

export function buildPebble(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035 + Math.random() * 0.018, 0), mat(lighten(PALETTE.dirt[1], 0.32)));
  m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  m.position.y = 0.028;
  return m;
}

export function buildTuft(): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const h = 0.09 + Math.random() * 0.04;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, 0.02), grassDarkMat);
    blade.position.set((Math.random() - 0.5) * 0.08, h / 2, (Math.random() - 0.5) * 0.08);
    blade.rotation.z = (Math.random() - 0.5) * 0.5;
    group.add(blade);
  }
  return group;
}

export function buildReed(): THREE.Group {
  const group = new THREE.Group();
  const stalkMat = mat(darken(PALETTE.grassDark, 0.05));
  const tipMat = mat(PALETTE.dirt[1]);
  for (let i = 0; i < 3; i++) {
    const h = 0.2 + Math.random() * 0.09;
    const sx = (Math.random() - 0.5) * 0.13;
    const sz = (Math.random() - 0.5) * 0.13;
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, 0.02), stalkMat);
    stalk.position.set(sx, h / 2, sz);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.05, 0.032), tipMat);
    tip.position.set(sx, h, sz);
    group.add(stalk, tip);
  }
  return group;
}

export function buildBush(): THREE.Group {
  const group = new THREE.Group();
  const m = mat(darken(PALETTE.grassDark, 0.1));
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(0.1 + Math.random() * 0.04, 0.09 + Math.random() * 0.04, 0.1 + Math.random() * 0.04),
      m,
    );
    s.rotation.y = Math.random() * 0.5;
    s.position.set((Math.random() - 0.5) * 0.16, 0.08 + Math.random() * 0.04, (Math.random() - 0.5) * 0.16);
    group.add(s);
  }
  return group;
}

/**
 * Stacked-cube tree — trunk + tapering, layered foliage. Sized clearly
 * larger than the characters on purpose: it's background scenery set back
 * from the play tiles, the one prop exempt from the "smaller than
 * characters" rule.
 */
export function buildTree(): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), mat(PALETTE.dirt[2]));
  trunk.position.y = 0.21;
  group.add(trunk);

  const foliageColors = [darken(PALETTE.grassDark, 0.08), new THREE.Color(PALETTE.grassDark), new THREE.Color(PALETTE.grassLight)];
  const sizes = [0.62, 0.48, 0.34];
  let y = 0.42;
  for (let i = 0; i < 3; i++) {
    const s = sizes[i];
    const block = new THREE.Mesh(new THREE.BoxGeometry(s, 0.3, s), mat(foliageColors[i]));
    block.position.y = y + 0.15;
    group.add(block);
    y += 0.28;
  }
  addBlobShadow(group, 0.46, 0.46, 0.01);
  return group;
}

export function buildFoamChevron(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.07), mat("#FFFFFF"));
  m.rotation.y = Math.PI / 4;
  return m;
}
