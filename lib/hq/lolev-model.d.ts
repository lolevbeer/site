/**
 * Types for lolev-model.js, the brewery 3D model copied from lolevbeer/hq by
 * scripts/sync-hq-model.mjs. Written by hand: if hq changes what buildModel takes
 * or returns (its README, "The model as a module"), change this file in the same
 * commit as the re-sync.
 */
import type { Group, Scene, WebGLRenderer } from 'three'

/** A named camera view: where it stands (p) and looks (t), in feet, and whether
 *  the ceilings and the upper floor show. */
export interface HqView {
  p: [number, number, number]
  t: [number, number, number]
  ceil: boolean
  up: boolean
}

export const VIEWS: Record<string, HqView>

export interface HqModel {
  groups: Record<string, Group>
  /** Show or hide the ceilings and the upper floor, and relight the room to match.
   *  Setting the groups' `visible` directly would leave the lighting stale. */
  show: (view: { ceil: boolean; up: boolean }) => void
  /** Free everything the model added and reset the scene's background,
   *  environment and onBeforeRender. The renderer stays the caller's. */
  dispose: () => void
}

/**
 * Build the brewery into `scene`. Units are feet: x east, y up, z south.
 * Resolves once the photos have loaded and the meshes are merged.
 *
 * It also sets the renderer's shadow map and tone mapping, and the scene's
 * background, environment and `onBeforeRender` (which keeps the mirrors fresh).
 */
export function buildModel(deps: {
  THREE: typeof import('three')
  addons: {
    mergeGeometries: typeof import('three/addons/utils/BufferGeometryUtils.js').mergeGeometries
    RoomEnvironment: typeof import('three/addons/environments/RoomEnvironment.js').RoomEnvironment
    Reflector: typeof import('three/addons/objects/Reflector.js').Reflector
    RectAreaLightUniformsLib: typeof import('three/addons/lights/RectAreaLightUniformsLib.js').RectAreaLightUniformsLib
  }
  renderer: WebGLRenderer
  scene: Scene
  /** URL of a photo by file name, e.g. `brick-color.webp` or `brick-color.lite.webp`. */
  textureUrl: (name: string) => string
  quality: 'full' | 'lite'
}): Promise<HqModel>
