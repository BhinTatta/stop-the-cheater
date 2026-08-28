import * as THREE from "three";

/**
 * Locked art-direction camera (confirmed against a reference screenshot —
 * see SPEC.md "Camera & framing"). The world is wide along X (the two
 * banks + river the boat crosses) and narrow along Z (how many characters
 * stand shoulder to shoulder). A camera looking mostly along X — not a 45°
 * corner view — puts the narrow Z axis on screen-horizontal (fits a
 * portrait phone) and the wide X axis on screen-depth (banks recede
 * near-to-far), which is what lets the ground fill the frame edge to edge
 * instead of floating in empty sky. Approaches from the right (near) bank.
 *
 * Some further offset polish is still pending (deferred) — this is a good
 * baseline, not a final-final value.
 */
export const CAMERA_TARGET = new THREE.Vector3(0, 0.15, 1.1);
export const CAMERA_OFFSET = new THREE.Vector3(13.5, 3.7, -3.7);

// Tuned for a portrait phone (the primary target). A wide/landscape window
// has ample horizontal room already, so it needs less vertical frustum to
// still fill edge to edge.
export function computeFrustumSize(aspect: number): number {
  return 8.6 / Math.max(1, Math.pow(aspect, 0.6));
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
  camera.position.copy(CAMERA_TARGET).add(CAMERA_OFFSET);
  camera.lookAt(CAMERA_TARGET);
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

/** rotation.y an object needs to face the camera — same atan2 convention used for walk-facing. */
export const IDLE_FACING_Y = Math.atan2(CAMERA_OFFSET.x, CAMERA_OFFSET.z);
