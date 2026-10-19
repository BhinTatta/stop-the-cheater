import * as THREE from "three";
import { PORTRAIT_ASPECT, tuning } from "./tuning";

/**
 * Art-direction camera. The world is wide along X (the two banks + river
 * the boat crosses) and narrow along Z (how many characters stand
 * shoulder to shoulder). A camera looking mostly along X — not a 45°
 * corner view — puts the narrow Z axis on screen-horizontal (fits a
 * portrait phone) and the wide X axis on screen-depth (banks recede
 * near-to-far), which is what lets the ground fill the frame edge to edge
 * instead of floating in empty sky. Approaches from the right (near) bank.
 *
 * The exact angle, pan and zoom are not baked in here: they come from
 * src/scene/tuning.ts so the on-screen harness can drive them live. Every
 * value below is derived on demand rather than cached at module load, so
 * a harness change takes effect on the next frame.
 */
export function cameraTarget(out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(tuning.targetX, tuning.targetY, tuning.targetZ);
}

/** Camera position relative to the target, from the spherical tuning values. */
export function cameraOffset(out = new THREE.Vector3()): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(tuning.camAzimuthDeg);
  const el = THREE.MathUtils.degToRad(tuning.camElevationDeg);
  const horizontal = tuning.camDistance * Math.cos(el);
  return out.set(horizontal * Math.sin(az), tuning.camDistance * Math.sin(el), horizontal * Math.cos(az));
}

/**
 * Vertical frustum height. Above the portrait reference the tuned
 * aspect compensation applies: a wide window has horizontal room already
 * and needs less vertical frustum to still fill edge to edge.
 *
 * Below it, the frustum instead grows to hold the *width* constant.
 * The portrait preset is dialled to about 0.90 of the frame half-width,
 * so without this a narrower window (a tall foldable, a squeezed
 * browser) would clip the outer couples — frustum alone is vertical, and
 * holding it fixed shrinks the horizontal with the aspect. This leaves
 * both tuned viewports untouched and only ever zooms out.
 */
export function computeFrustumSize(aspect: number): number {
  if (aspect < PORTRAIT_ASPECT) return tuning.zoomBase * (PORTRAIT_ASPECT / Math.max(aspect, 0.05));
  return tuning.zoomBase / Math.max(1, Math.pow(aspect, tuning.zoomAspectPow));
}

const scratchTarget = new THREE.Vector3();
const scratchOffset = new THREE.Vector3();

/** Point the camera at the target from the tuned angle, and keep the clip planes around it. */
export function syncCameraPose(camera: THREE.OrthographicCamera): void {
  cameraTarget(scratchTarget);
  cameraOffset(scratchOffset);
  camera.position.copy(scratchTarget).add(scratchOffset);
  camera.lookAt(scratchTarget);
  // Clip planes bracket the target so the whole scene stays inside them at
  // any distance the harness dials in.
  camera.near = Math.max(0.1, tuning.camDistance - 40);
  camera.far = tuning.camDistance + 60;
  camera.updateProjectionMatrix();
}

export function createCamera(aspect: number): THREE.OrthographicCamera {
  const frustumSize = computeFrustumSize(aspect);
  const camera = new THREE.OrthographicCamera(
    (-frustumSize * aspect) / 2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    -frustumSize / 2,
    0.1,
    100,
  );
  syncCameraPose(camera);
  return camera;
}

export function resizeCamera(camera: THREE.OrthographicCamera, aspect: number): void {
  const frustumSize = computeFrustumSize(aspect);
  camera.left = (-frustumSize * aspect) / 2;
  camera.right = (frustumSize * aspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = -frustumSize / 2;
  camera.updateProjectionMatrix();
}

/**
 * rotation.y an object needs to face the camera — same atan2 convention
 * used for walk-facing. Tracks the tuned azimuth, so characters keep
 * looking at the camera when the angle is dialled around.
 */
export function idleFacingY(): number {
  return THREE.MathUtils.degToRad(tuning.camAzimuthDeg);
}
