/**
 * Browsers cap live WebGL contexts, so a can whose assets fail to load must
 * release the renderer it already created instead of waiting for garbage collection.
 */
import { describe, expect, it, vi } from 'vitest'

const gpu = vi.hoisted(() => ({
  renderer: { dispose: vi.fn(), forceContextLoss: vi.fn() },
  envTexture: { dispose: vi.fn() },
}))

vi.mock('three', () => {
  class Positioned {
    position = { set: vi.fn() }
  }
  return {
    ACESFilmicToneMapping: 1,
    Scene: class {
      add = vi.fn()
    },
    PerspectiveCamera: Positioned,
    DirectionalLight: Positioned,
    WebGLRenderer: class {
      setSize = vi.fn()
      setPixelRatio = vi.fn()
      dispose = gpu.renderer.dispose
      forceContextLoss = gpu.renderer.forceContextLoss
    },
    PMREMGenerator: class {
      fromScene = () => ({ texture: gpu.envTexture })
      dispose = vi.fn()
    },
    TextureLoader: class {
      loadAsync = async () => ({})
    },
  }
})
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    loadAsync = async () => {
      throw new Error('model missing')
    }
  },
}))
vi.mock('three/addons/environments/RoomEnvironment.js', () => ({
  RoomEnvironment: class {
    dispose = vi.fn()
  },
}))

import { createCanScene } from '@/components/beer/can-scene'

describe('createCanScene', () => {
  it('releases the WebGL context and rethrows when assets fail to load', async () => {
    await expect(
      createCanScene({ width: 100, height: 100, base: '/label.png' } as Parameters<
        typeof createCanScene
      >[0]),
    ).rejects.toThrow('model missing')

    expect(gpu.renderer.dispose).toHaveBeenCalledOnce()
    expect(gpu.renderer.forceContextLoss).toHaveBeenCalledOnce()
    expect(gpu.envTexture.dispose).toHaveBeenCalledOnce()
  })
})
