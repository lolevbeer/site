/**
 * The homepage scroll tour's 3D scene: the Lawrenceville brewery model
 * (lib/hq, copied from lolevbeer/hq) with our can standing in it, drawn on one
 * canvas by one renderer. The caller (scroll-tour.tsx) owns the canvas and the
 * scrolling; it calls `renderAt` with the tour's progress whenever that or the
 * size changes. Nothing here runs on its own between those calls.
 *
 * three.js, the model and the can are imported dynamically, so importing this
 * file costs nothing until `createTourScene` is called.
 */
import type { TextureSource } from '@/components/beer/can-scene'
import { poseAt } from '@/lib/tour/pose'

/** Height of a 16 oz can in the model's units (feet). */
const CAN_FEET = 0.52
/** The camera's vertical field of view in degrees: the lens HQ's own viewer
 *  uses, so its named views frame the same. */
const FOV = 50
const PORTRAIT_MAX_FOV = 70

export interface TourSceneOptions {
  canvas: HTMLCanvasElement
  quality: 'full' | 'lite'
  /** The featured beer's label textures (beer.labelBase, beer.labelMetalness). */
  label: { base: TextureSource; metalness?: TextureSource }
}

export interface TourScene {
  /** Draw one frame at `progress`: 0 at the first stop, 1 at the last. */
  renderAt: (progress: number) => void
  /** Match the drawing buffer and camera to the canvas's CSS size. */
  setSize: (width: number, height: number) => void
  /** Free everything and release the WebGL context. */
  dispose: () => void
}

export async function createTourScene({
  canvas,
  quality,
  label,
}: TourSceneOptions): Promise<TourScene> {
  const [
    THREE,
    { GLTFLoader },
    { RoomEnvironment },
    { Reflector },
    { RectAreaLightUniformsLib },
    { mergeGeometries },
    { buildModel },
    { createCanObject, CAN_HEIGHT },
  ] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/environments/RoomEnvironment.js'),
    import('three/addons/objects/Reflector.js'),
    import('three/addons/lights/RectAreaLightUniformsLib.js'),
    import('three/addons/utils/BufferGeometryUtils.js'),
    import('@/lib/hq/lolev-model'),
    import('@/components/beer/can-scene'),
  ])

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'full' })
  renderer.setPixelRatio(quality === 'full' ? Math.min(window.devicePixelRatio, 1.5) : 1)
  const scene = new THREE.Scene()
  // Near and far as HQ's viewer has them: a tight range keeps depth precise.
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 600)

  const [model, can] = await Promise.all([
    buildModel({
      THREE,
      addons: { mergeGeometries, RoomEnvironment, Reflector, RectAreaLightUniformsLib },
      renderer,
      scene,
      textureUrl: (name) => `/3d/hq/${name}`,
      quality,
    }),
    createCanObject({
      THREE,
      GLTFLoader,
      base: label.base,
      metalness: label.metalness,
      maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
      bump: false, // the model's lights leave the label's shader no texture slot for it
    }),
  ]).catch((error: unknown) => {
    // No handle reaches the caller, so release the context here; that frees
    // whatever the half that did load had put on the GPU.
    renderer.dispose()
    renderer.forceContextLoss()
    throw error
  })

  can.object.scale.setScalar(CAN_FEET / CAN_HEIGHT)
  scene.add(can.object)

  // buildModel leaves the model as its Overview shows it: ceilings and upper floor off.
  let ceil = false
  let up = false

  return {
    renderAt: (progress) => {
      const pose = poseAt(progress)
      // Only on a change: with the ceilings on, show() retakes the room's reflections.
      if (pose.ceil !== ceil || pose.up !== up) {
        ;({ ceil, up } = pose)
        model.show(pose)
      }
      camera.position.set(...pose.p)
      camera.lookAt(...pose.t)
      can.object.visible = pose.can !== null
      // A stop gives where the can's base stands; the object's origin is its middle.
      if (pose.can) {
        const [x, y, z] = pose.can
        can.object.position.set(x, y + CAN_FEET / 2, z)
        // Keep the middle of the label turned to the camera as it moves round.
        can.object.rotation.y = Math.atan2(pose.p[0] - x, pose.p[2] - z)
      }
      renderer.render(scene, camera)
    },
    setSize: (width, height) => {
      camera.aspect = width / height
      // On a screen taller than wide, widen the lens so the view keeps its
      // width (a phone would otherwise see a thin slice of each stop), up to
      // PORTRAIT_MAX_FOV, past which the edges stretch.
      const portrait = 2 * Math.atan(Math.tan((FOV * Math.PI) / 360) / camera.aspect)
      camera.fov = Math.min(Math.max(FOV, (portrait * 180) / Math.PI), PORTRAIT_MAX_FOV)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false) // the canvas's CSS size is the caller's
    },
    dispose: () => {
      scene.remove(can.object)
      can.dispose()
      model.dispose()
      renderer.dispose()
      // One WebGL context on the page, released with the tour (as can-scene does).
      renderer.forceContextLoss()
    },
  }
}
