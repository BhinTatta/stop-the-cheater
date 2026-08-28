import * as THREE from "three";
import { PALETTE, darken, mat, addBlobShadow } from "./palette";

export interface CharacterRig {
  root: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group | null;
  legR: THREE.Group | null;
  isWoman: boolean;
  idlePhase: number;
  baseScale: number;
}

const BASE_SCALE = 0.85;

/**
 * Built entirely from BoxGeometry — no capsules or spheres anywhere. Head,
 * arms and (for men) legs are each their own pivot group so idle gestures
 * and the walk cycle can move them naturally from a joint instead of the
 * whole body faking it. flatShading (via mat()) plus the hard cube edges
 * is what produces the voxel read.
 */
export function buildCharacter(bodyColor: THREE.ColorRepresentation, isWoman: boolean): CharacterRig {
  const group = new THREE.Group();
  const skin = mat(PALETTE.skin);
  const bodyMat = mat(bodyColor);
  const waistMat = mat(darken(bodyColor, 0.32));
  const hairMat = mat(PALETTE.ink);
  const inkMat = mat(PALETTE.ink);
  const soleMat = mat(darken(PALETTE.ink, 0.4));
  const whiteMat = mat("#FFFFFF");
  const trimMat = mat(PALETTE.trim);

  // torso
  const waistH = 0.11;
  const shirtH = 0.25;
  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.41, waistH, 0.25), waistMat);
  waist.position.y = 0.4 + waistH / 2;
  group.add(waist);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.4, shirtH, 0.24), bodyMat);
  shirt.position.y = 0.4 + waistH + shirtH / 2;
  group.add(shirt);

  // head group — pivots at the neck for a natural idle glance
  const headSize = 0.32;
  const hairH = 0.1;
  const faceH = headSize - hairH;
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.76;
  const face = new THREE.Mesh(new THREE.BoxGeometry(headSize, faceH, headSize), skin);
  face.position.y = faceH / 2;
  headGroup.add(face);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(headSize + 0.02, hairH, headSize + 0.02), hairMat);
  hair.position.y = faceH + hairH / 2;
  headGroup.add(hair);
  const eyeY = faceH * 0.55;
  const eyeZ = headSize / 2 - 0.003;
  for (const ex of [0.085, -0.085]) {
    const eyeWhite = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.018), whiteMat);
    eyeWhite.position.set(ex, eyeY, eyeZ);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.04, 0.01), inkMat);
    pupil.position.set(ex, eyeY, eyeZ + 0.009);
    headGroup.add(eyeWhite, pupil);
  }
  if (isWoman) {
    const bowCenter = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.08), trimMat);
    bowCenter.position.set(0, 0.35, 0);
    headGroup.add(bowCenter);
    const bowL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.045), trimMat);
    bowL.position.set(0.1, 0.36, 0);
    bowL.rotation.z = 0.45;
    const bowR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.045), trimMat);
    bowR.position.set(-0.1, 0.36, 0);
    bowR.rotation.z = -0.45;
    headGroup.add(bowL, bowR);
  } else {
    const tuft = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.07), hairMat);
    tuft.position.set(0.04, 0.34, 0.1);
    tuft.rotation.set(0.3, 0, -0.2);
    headGroup.add(tuft);
  }
  group.add(headGroup);

  // arm groups — pivot at the shoulder
  const armGeo = new THREE.BoxGeometry(0.12, 0.3, 0.13);
  const cuffGeo = new THREE.BoxGeometry(0.13, 0.05, 0.14);
  const handGeo = new THREE.BoxGeometry(0.12, 0.08, 0.13);
  const shoulderY = 0.74;
  const arms: Record<"L" | "R", THREE.Group> = {} as Record<"L" | "R", THREE.Group>;
  for (const [side, ax] of [["L", 0.26], ["R", -0.26]] as const) {
    const armGroup = new THREE.Group();
    armGroup.position.set(ax, shoulderY, 0);
    const arm = new THREE.Mesh(armGeo, bodyMat);
    arm.position.y = 0.59 - shoulderY;
    const cuff = new THREE.Mesh(cuffGeo, waistMat);
    cuff.position.y = 0.46 - shoulderY;
    const hand = new THREE.Mesh(handGeo, skin);
    hand.position.y = 0.4 - shoulderY;
    armGroup.add(arm, cuff, hand);
    group.add(armGroup);
    arms[side] = armGroup;
  }

  // lower body — flared skirt for women (reads female at a glance without
  // losing the couple color), separate leg pivots for men so a walk cycle
  // has a real stride.
  let legs: Record<"L" | "R", THREE.Group> | null = null;
  const footGeo = new THREE.BoxGeometry(0.17, 0.07, 0.21);
  const soleGeo = new THREE.BoxGeometry(0.18, 0.035, 0.22);
  if (isWoman) {
    const skirtMat = mat(darken(bodyColor, 0.14));
    const skirtUpper = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.28), bodyMat);
    skirtUpper.position.y = 0.35;
    group.add(skirtUpper);
    const skirtLower = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.42), skirtMat);
    skirtLower.position.y = 0.22;
    group.add(skirtLower);
    const hem = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.03, 0.44), trimMat);
    hem.position.y = 0.145;
    group.add(hem);
    for (const lx of [0.1, -0.1]) {
      const shoe = new THREE.Mesh(footGeo, inkMat);
      shoe.position.set(lx, 0.055, 0.02);
      const sole = new THREE.Mesh(soleGeo, soleMat);
      sole.position.set(lx, 0.0175, 0.02);
      group.add(shoe, sole);
    }
  } else {
    const legGeo = new THREE.BoxGeometry(0.15, 0.26, 0.15);
    const hipY = 0.4;
    legs = {} as Record<"L" | "R", THREE.Group>;
    for (const [side, lx] of [["L", 0.11], ["R", -0.11]] as const) {
      const legGroup = new THREE.Group();
      legGroup.position.set(lx, hipY, 0);
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.y = 0.27 - hipY;
      const shoe = new THREE.Mesh(footGeo, inkMat);
      shoe.position.set(0, 0.095 - hipY, 0.02);
      const sole = new THREE.Mesh(soleGeo, soleMat);
      sole.position.set(0, 0.0425 - hipY, 0.02);
      legGroup.add(leg, shoe, sole);
      group.add(legGroup);
      legs[side] = legGroup;
    }
  }

  addBlobShadow(group, 0.44, 0.36, 0.012);
  group.scale.setScalar(BASE_SCALE);

  return {
    root: group,
    head: headGroup,
    armL: arms.L,
    armR: arms.R,
    legL: legs ? legs.L : null,
    legR: legs ? legs.R : null,
    isWoman,
    idlePhase: Math.random() * Math.PI * 2,
    baseScale: BASE_SCALE,
  };
}
