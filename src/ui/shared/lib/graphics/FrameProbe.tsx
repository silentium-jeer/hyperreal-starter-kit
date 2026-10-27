import { addAfterEffect, addEffect, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'


export type FrameSample = {
  readonly calls: number
  readonly delta: number
  readonly geometries: number
  readonly programs: number
  readonly segment: string
  readonly textures: number
  readonly triangles: number
  readonly heap: number | null
  readonly gpu: number | null
}

export type FrameProbeInfo = {
  readonly calls: number
  readonly dpr: number
  readonly drawingBuffer: readonly [number, number]
  readonly geometries: number
  readonly lights: readonly { readonly castShadow: boolean; readonly mapSize: readonly [number, number] | null; readonly type: string }[]
  readonly programs: number
  readonly shadowAutoUpdate: boolean
  readonly shadowNeedsUpdate: boolean
  readonly textures: number
  readonly triangles: number
}

export type CensusRow = {
  readonly drawn: number
  readonly geometry: string
  readonly material: string
  readonly kind: string
  readonly name: string
  readonly total: number
  readonly triangles: number
}

export type FrameProbeApi = {
  scene: () => import('three').Scene
  census: () => readonly CensusRow[]
  info: () => FrameProbeInfo
  mark: (segment: string) => void
  setPixelRatio: (ratio: number) => void
  recording: () => boolean
  start: (segment?: string) => void
  stop: () => readonly FrameSample[]
}

declare global {
  interface Window {
    __frameProbe?: FrameProbeApi
  }
}

export function FrameProbe() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const viewport = useThree((state) => state.viewport)
  const samples = useRef<FrameSample[]>([])
  const recording = useRef(false)
  const segment = useRef('default')
  const frameStart = useRef(0)

  // eslint-disable-next-line react-hooks/immutability -- the probe owns renderer bookkeeping (info.autoReset) for the length of a recording and restores it on cleanup.
  useEffect(() => {
    if (!import.meta.env.DEV) return

    const previousAutoReset = gl.info.autoReset
    // eslint-disable-next-line react-hooks/immutability -- the probe owns render-info resetting for the length of a recording and restores it on cleanup.
    gl.info.autoReset = false

    const context = gl.getContext() as WebGL2RenderingContext
    const timer = (context.getExtension?.('EXT_disjoint_timer_query_webgl2') ?? null) as
      { readonly GPU_DISJOINT_EXT: number; readonly TIME_ELAPSED_EXT: number } | null
    let pending: WebGLQuery | null = null
    let queryActive = false
    let lastGpuMs: number | null = null

    const readGpu = () => {
      if (!timer || !pending) return
      const available = context.getQueryParameter(pending, context.QUERY_RESULT_AVAILABLE)
      const disjoint = context.getParameter(timer.GPU_DISJOINT_EXT)
      if (available && !disjoint) lastGpuMs = context.getQueryParameter(pending, context.QUERY_RESULT) / 1e6
      if (available || disjoint) { context.deleteQuery(pending); pending = null }
    }

    const unsubscribeBefore = addEffect(() => {
      gl.info.reset()
      readGpu()
      if (timer && recording.current && !pending) {
        pending = context.createQuery()
        if (pending) {
          context.beginQuery(timer.TIME_ELAPSED_EXT, pending)
          queryActive = true
        }
      }
    })

    const unsubscribeAfter = addAfterEffect(() => {
      const now = performance.now()
      const previous = frameStart.current
      frameStart.current = now
      if (timer && queryActive) {
        context.endQuery(timer.TIME_ELAPSED_EXT)
        queryActive = false
      }
      if (!recording.current) return
      const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
      samples.current.push({
        calls: gl.info.render.calls,
        delta: previous === 0 ? 0 : now - previous,
        geometries: gl.info.memory.geometries,
        gpu: lastGpuMs,
        heap: memory ? memory.usedJSHeapSize : null,
        programs: gl.info.programs?.length ?? 0,
        segment: segment.current,
        textures: gl.info.memory.textures,
        triangles: gl.info.render.triangles,
      })
    })

    window.__frameProbe = {
      census: () => {
        const rows = new Map<string, { drawn: number; geometry: string; material: string; kind: string; name: string; total: number; triangles: number }>()
        scene.traverse((object) => {
          const mesh = object as unknown as {
            count?: number
            geometry?: { index?: { count: number } | null; attributes?: { position?: { count: number } }; type: string }
            isInstancedMesh?: boolean
            isLine?: boolean
            isMesh?: boolean
            isPoints?: boolean
            isSkinnedMesh?: boolean
            material?: { type: string } | { type: string }[]
            name: string
            type: string
            visible: boolean
          }
          if (!mesh.isMesh && !mesh.isPoints && !mesh.isLine) return
          let visible = mesh.visible
          let parent = (object as unknown as { parent: { visible: boolean; parent: unknown } | null }).parent
          while (visible && parent) { visible = parent.visible; parent = parent.parent as typeof parent }

          const geometry = mesh.geometry
          const vertices = geometry?.index?.count ?? geometry?.attributes?.position?.count ?? 0
          const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
          const kind = mesh.isInstancedMesh ? `instanced x${mesh.count ?? 0}` : mesh.isSkinnedMesh ? 'skinned' : mesh.type
          const key = `${mesh.name}|${kind}|${geometry?.type}|${materials.map((m) => m.type).join('+')}`
          const row = rows.get(key) ?? {
            drawn: 0,
            geometry: geometry?.type ?? 'none',
            kind,
            material: materials.map((m) => m.type).join('+') || 'none',
            name: mesh.name || '(unnamed)',
            total: 0,
            triangles: 0,
          }
          const groups = Math.max(1, materials.length)
          row.total += groups
          if (visible) {
            row.drawn += groups
            row.triangles += Math.round(vertices / 3) * (mesh.isInstancedMesh ? (mesh.count ?? 1) : 1)
          }
          rows.set(key, row)
        })
        return [...rows.values()].sort((a, b) => b.drawn - a.drawn)
      },
      info: () => {
        const lights: { castShadow: boolean; mapSize: readonly [number, number] | null; type: string }[] = []
        scene.traverse((object) => {
          const light = object as unknown as {
            castShadow?: boolean
            isLight?: boolean
            shadow?: { mapSize: { x: number; y: number } }
            type: string
          }
          if (!light.isLight) return
          lights.push({
            castShadow: Boolean(light.castShadow),
            mapSize: light.shadow ? [light.shadow.mapSize.x, light.shadow.mapSize.y] : null,
            type: light.type,
          })
        })
        return {
          calls: gl.info.render.calls,
          dpr: viewport.dpr,
          drawingBuffer: [gl.domElement.width, gl.domElement.height] as const,
          geometries: gl.info.memory.geometries,
          lights,
          programs: gl.info.programs?.length ?? 0,
          shadowAutoUpdate: gl.shadowMap.autoUpdate,
          shadowNeedsUpdate: gl.shadowMap.needsUpdate,
          textures: gl.info.memory.textures,
          triangles: gl.info.render.triangles,
        }
      },
      mark: (next) => { segment.current = next },
      scene: () => scene,
      setPixelRatio: (ratio) => { gl.setPixelRatio(ratio) },
      recording: () => recording.current,
      start: (next = 'default') => { segment.current = next; samples.current = []; recording.current = true },
      stop: () => { recording.current = false; return samples.current },
    }

    return () => {
      unsubscribeBefore()
      unsubscribeAfter()
      if (timer && queryActive) context.endQuery(timer.TIME_ELAPSED_EXT)
      if (pending) context.deleteQuery(pending)
      gl.info.autoReset = previousAutoReset
      delete window.__frameProbe
    }
  }, [gl, scene, viewport])

  return null
}
