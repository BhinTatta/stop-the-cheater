import * as THREE from "three";
import { PALETTE, lighten } from "./palette";
import { buildFoamChevron } from "./props";

export function makeSkyTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#4FB6EE");
  g.addColorStop(0.55, "#8ED9F5");
  g.addColorStop(1, "#EAF8FF");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * One dominant warm directional sun, ambient kept low relative to it —
 * every face reads as "hit by the same sun" instead of evenly,
 * sourcelessly lit. The sun sits on the SAME side as the camera (+X,-Z
 * matching camDefaultOffset in camera.ts) — the camera looks mostly along
 * X, and characters are rotated to face the camera, so a key light on the
 * opposite side would light their backs and leave the camera-facing side
 * (the side the player actually sees) in shadow.
 */
export function addLights(scene: THREE.Scene): void {
  const hemi = new THREE.HemisphereLight(0xbfeafb, 0x5c4020, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1ce, 2.1);
  sun.position.set(9, 16, -7);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfe0ff, 0.16);
  fill.position.set(-9, 5, 6);
  scene.add(fill);
}

export const WATER_LEN = 9;

export interface WaterHandle {
  mesh: THREE.Mesh;
  uniforms: { uTime: { value: number }; uColor: { value: THREE.Color }; uColorLight: { value: THREE.Color } };
}

/**
 * Flat, single saturated turquoise — no deep/shallow gradient, no
 * wave-driven brightness. Just a coarse, stepped (not smooth) mottle so it
 * isn't a completely inert flat color, plus real foam-chevron geometry
 * scattered on top for hard-edged surface detail.
 */
export function buildWater(): WaterHandle {
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(PALETTE.water) },
    uColorLight: { value: lighten(PALETTE.water, 0.22) },
  };
  const geo = new THREE.PlaneGeometry(4, WATER_LEN, 48, 54);
  geo.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main(){
        vUv = uv;
        vec3 p = position;
        p.y += sin(p.x*1.6 + uTime*1.1)*0.035 + sin(p.z*1.1 - uTime*1.5)*0.035;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform vec3 uColorLight;
      uniform float uTime;
      float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        float cell = hash2(floor(vUv*vec2(11.0,24.0)) + floor(uTime*0.6));
        vec3 base = mix(uColor, uColorLight, step(0.72, cell));
        gl_FragColor = vec4(base, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, material);
  return { mesh, uniforms };
}

export function scatterFoam(scene: THREE.Scene, count = 20): void {
  for (let i = 0; i < count; i++) {
    const chevron = buildFoamChevron();
    chevron.position.set(-1.7 + Math.random() * 3.4, 0.035, -WATER_LEN / 2 + Math.random() * WATER_LEN);
    scene.add(chevron);
  }
}

interface CloudHandle {
  mesh: THREE.Group;
}

function buildCloud(): THREE.Group {
  const group = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 });
  const n = 4 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.3, 0), cloudMat);
    s.position.set((Math.random() - 0.5) * 1.4, Math.random() * 0.25, (Math.random() - 0.5) * 0.6);
    group.add(s);
  }
  return group;
}

export function scatterClouds(scene: THREE.Scene, count = 5): CloudHandle[] {
  const clouds: CloudHandle[] = [];
  for (let i = 0; i < count; i++) {
    const cloud = buildCloud();
    cloud.position.set(-11 + Math.random() * 22, 10.5 + Math.random() * 2.2, -9 + Math.random() * 18);
    cloud.scale.setScalar(0.7 + Math.random() * 0.45);
    scene.add(cloud);
    clouds.push({ mesh: cloud });
  }
  return clouds;
}

export function updateClouds(clouds: CloudHandle[], dt: number): void {
  clouds.forEach(({ mesh }) => {
    mesh.position.x += dt * 0.15;
    if (mesh.position.x > 14) mesh.position.x = -14;
  });
}

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,230,160,0.85)");
  g.addColorStop(1, "rgba(255,230,160,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function addSunGlow(scene: THREE.Scene): void {
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), transparent: true, depthWrite: false }));
  glow.scale.set(7, 7, 1);
  glow.position.set(16, 19, 9);
  scene.add(glow);
}
