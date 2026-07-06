/**
 * Shared 3D can scene assembly (port of captiva's CanScene essentials):
 * can model + label cylinder with the full foil material stack, studio
 * lighting. Used by BeerCan3D (live spinning can on beer pages) and
 * record-can-video (admin-side sweep video for menu displays).
 *
 * three.js is dynamically imported so neither consumer pays for it until
 * a can actually renders (the type-only import below is erased at compile
 * time and does not affect bundling).
 */
import type { Mesh, PerspectiveCamera, WebGLRenderer } from 'three'

// Geometry/material constants lifted from captiva's proven setup.
const CAN_HEIGHT = 0.12 // normalized model height in scene units
const CAMERA_DISTANCE = 0.275
const LABEL_HEIGHT_RATIO = 0.75
const LABEL_OFFSET_RATIO = -0.02
const LABEL_RADIUS_BUMP = 1.005 // label sits just off the can surface
const MAX_WRAP_ANGLE = Math.PI * 1.8
const FOIL_ROUGHNESS = 0.33
const MATTE_ROUGHNESS = 0.8

// Utility maps (rounded-corner alpha, roughness remap) don't need label-art
// resolution — GPU texture filtering upscales them invisibly, while full-size
// copies would cost tens of MB of RAM/VRAM each plus a multi-megapixel CPU
// loop on every beer-page mount.
const MAX_UTILITY_MAP_SIZE = 512

/** Size a low-res utility canvas preserving the artwork's aspect ratio. */
function utilityMapSize(w: number, h: number) {
  const scale = Math.min(1, MAX_UTILITY_MAP_SIZE / Math.max(w, h))
  return {
    uw: Math.max(1, Math.round(w * scale)),
    uh: Math.max(1, Math.round(h * scale)),
  }
}

/** Drop-shadow sprite (captiva's _createDropShadow): a tight dark core plus
 *  a wide faint falloff, painted as two stacked radial gradients. Content
 *  depends only on constants, so it's painted once per page load and shared
 *  by every scene (each scene still owns/disposes its own CanvasTexture). */
let shadowSpriteCanvas: HTMLCanvasElement | null = null
function getShadowSprite(): HTMLCanvasElement {
  if (shadowSpriteCanvas) return shadowSpriteCanvas
  const SIZE = 256
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const paint = (radius: number, stops: [number, string][]) => {
    const grad = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, radius)
    for (const [offset, color] of stops) grad.addColorStop(offset, color)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, SIZE, SIZE)
  }
  paint(SIZE * 0.18, [
    [0, 'rgba(0, 0, 0, 1.0)'],
    [0.5, 'rgba(0, 0, 0, 0.7)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ])
  paint(SIZE / 2, [
    [0, 'rgba(0, 0, 0, 0.5)'],
    [0.25, 'rgba(0, 0, 0, 0.3)'],
    [0.5, 'rgba(0, 0, 0, 0.15)'],
    [0.75, 'rgba(0, 0, 0, 0.04)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ])
  shadowSpriteCanvas = canvas
  return canvas
}

/** A texture source: a same-origin/CORS-safe image URL or an in-memory canvas. */
export type TextureSource = string | HTMLCanvasElement

export interface CanSceneOptions {
  width: number
  height: number
  /** Label artwork (beer.labelBase URL, or the freshly generated canvas). */
  base: TextureSource
  /** Black/white metalness map; omit for a fully matte label. */
  metalness?: TextureSource
  pixelRatio?: number
}

export interface CanScene {
  renderer: WebGLRenderer
  camera: PerspectiveCamera
  /** Label wrap angle in radians (how far around the can the label reaches). */
  wrap: number
  /** Orbit the camera to the given azimuth (0 = facing the label center). */
  setAzimuth: (angle: number) => void
  /** Resize the drawing buffer and camera to new element dimensions. */
  setSize: (width: number, height: number) => void
  render: () => void
  dispose: () => void
}

export async function createCanScene({
  width,
  height,
  base,
  metalness,
  pixelRatio = 1,
}: CanSceneOptions): Promise<CanScene> {
  const [THREE, { GLTFLoader }, { RoomEnvironment }] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/environments/RoomEnvironment.js'),
  ])

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, width / height, 0.001, 10)
  camera.position.set(0, 0, CAMERA_DISTANCE)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(pixelRatio)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.9

  // Built-in studio environment instead of captiva's 380KB studio.hdr
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = new RoomEnvironment()
  const envTex = pmrem.fromScene(env).texture
  env.dispose() // baked into envTex; free the source geometry/materials
  pmrem.dispose() // the render target lives on in envTex; the generator itself is done
  scene.environment = envTex
  const key = new THREE.DirectionalLight(0xfff8f0, 2.5)
  key.position.set(1, 1, 1)
  const rim = new THREE.DirectionalLight(0xffffff, 1.5)
  rim.position.set(-0.5, 0.5, -1)
  scene.add(key, rim)

  const texLoader = new THREE.TextureLoader()
  const loadTexture = (src: TextureSource) =>
    typeof src === 'string'
      ? texLoader.loadAsync(src)
      : Promise.resolve(new THREE.CanvasTexture(src))

  const [gltf, baseTex, metalTex] = await Promise.all([
    new GLTFLoader().loadAsync('/3d/Can.gltf'),
    loadTexture(base),
    metalness ? loadTexture(metalness) : Promise.resolve(null),
  ])

  // Bare aluminum body, normalized to a fixed height so the camera
  // distance and label math don't depend on the model's units
  const can = gltf.scene
  const metal = new THREE.MeshPhysicalMaterial({
    color: '#999999',
    metalness: 1,
    roughness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  })
  can.traverse((child) => {
    const mesh = child as Mesh
    if (mesh.isMesh) mesh.material = metal
  })
  const pre = new THREE.Box3().setFromObject(can).getSize(new THREE.Vector3())
  if (pre.y < Math.max(pre.x, pre.z)) can.rotation.x = -Math.PI / 2 // stand lying-down models up
  can.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(can)
  const size = box.getSize(new THREE.Vector3())
  const scale = CAN_HEIGHT / size.y
  can.scale.setScalar(scale)
  can.position.copy(box.getCenter(new THREE.Vector3()).negate().multiplyScalar(scale))
  scene.add(can)
  const canRadius = (Math.max(size.x, size.z) / 2) * scale

  // Soft drop shadow under the can, laid flat at its base (see getShadowSprite)
  const shadowTex = new THREE.CanvasTexture(getShadowSprite())
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
  })
  const shadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(canRadius * 4, canRadius * 4),
    shadowMat,
  )
  shadowMesh.rotation.x = -Math.PI / 2
  shadowMesh.position.y = -CAN_HEIGHT / 2 - 0.0005
  scene.add(shadowMesh)

  baseTex.colorSpace = THREE.SRGBColorSpace
  const maxAniso = renderer.capabilities.getMaxAnisotropy()
  baseTex.anisotropy = maxAniso
  const img = baseTex.image as { width: number; height: number }
  const { width: w, height: h } = img

  const labelMat = new THREE.MeshStandardMaterial({
    map: baseTex,
    transparent: true,
    side: THREE.DoubleSide,
    metalness: 1,
    roughness: 1,
  })

  // Rounded label corners, like a real sticker (captiva's alpha map)
  const { uw: aw, uh: ah } = utilityMapSize(w, h)
  const alpha = document.createElement('canvas')
  alpha.width = aw
  alpha.height = ah
  const actx = alpha.getContext('2d')!
  actx.fillStyle = 'black'
  actx.fillRect(0, 0, aw, ah)
  actx.fillStyle = 'white'
  actx.beginPath()
  actx.roundRect(0, 0, aw, ah, Math.min(aw, ah) * 0.025)
  actx.fill()
  labelMat.alphaMap = new THREE.CanvasTexture(alpha)

  if (metalTex) {
    metalTex.anisotropy = maxAniso
    labelMat.metalnessMap = metalTex
    labelMat.bumpMap = metalTex // foil sits slightly proud of the paper
    labelMat.bumpScale = 0.02
    // Roughness from the mask: white (foil) → FOIL_ROUGHNESS, black →
    // MATTE_ROUGHNESS. Downscaled first — roughness is low-frequency, and
    // remapping the full 4MP mask would stall the main thread on mount.
    const { uw: rw, uh: rh } = utilityMapSize(w, h)
    const rc = document.createElement('canvas')
    rc.width = rw
    rc.height = rh
    const rctx = rc.getContext('2d')!
    rctx.drawImage(metalTex.image as CanvasImageSource, 0, 0, rw, rh)
    const d = rctx.getImageData(0, 0, rw, rh)
    const matte = Math.round(MATTE_ROUGHNESS * 255)
    const foil = Math.round(FOIL_ROUGHNESS * 255)
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.round(matte - (matte - foil) * (d.data[i] / 255))
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v
    }
    rctx.putImageData(d, 0, 0)
    labelMat.roughnessMap = new THREE.CanvasTexture(rc)
  } else {
    // No metalness map: plain matte sticker
    labelMat.metalness = 0
    labelMat.roughness = 0.5
  }

  // Label = open cylinder hugging the can; wrap angle from the artwork's
  // aspect ratio so its proportions are preserved
  const radius = canRadius * LABEL_RADIUS_BUMP
  const labelHeight = CAN_HEIGHT * LABEL_HEIGHT_RATIO
  const wrap = Math.min((labelHeight * w) / h / radius, MAX_WRAP_ANGLE)
  const labelMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, labelHeight, 64, 1, true, 0, wrap),
    labelMat,
  )
  labelMesh.position.y = CAN_HEIGHT * LABEL_OFFSET_RATIO
  labelMesh.rotation.y = -wrap / 2 // center the label toward the camera
  scene.add(labelMesh)

  return {
    renderer,
    camera,
    wrap,
    setAzimuth: (angle) => {
      camera.position.set(CAMERA_DISTANCE * Math.sin(angle), 0, CAMERA_DISTANCE * Math.cos(angle))
      camera.lookAt(0, 0, 0)
    },
    setSize: (newWidth, newHeight) => {
      camera.aspect = newWidth / newHeight
      camera.updateProjectionMatrix()
      renderer.setSize(newWidth, newHeight)
    },
    render: () => renderer.render(scene, camera),
    dispose: () => {
      // Free GPU resources, not just the renderer — the scene is rebuilt on
      // every mount/prop change, so anything skipped here leaks VRAM.
      scene.traverse((child) => {
        const mesh = child as Mesh
        if (mesh.isMesh) mesh.geometry.dispose()
      })
      for (const tex of [
        baseTex,
        metalTex,
        labelMat.alphaMap,
        labelMat.roughnessMap,
        envTex,
        shadowTex,
      ]) {
        tex?.dispose()
      }
      metal.dispose()
      labelMat.dispose()
      shadowMat.dispose()
      renderer.dispose()
      // Actually release the GL context: SPA navigation across beer pages
      // would otherwise accumulate zombie contexts (browsers cap ~8-16 per
      // page) until the browser force-loses the oldest.
      renderer.forceContextLoss()
    },
  }
}
