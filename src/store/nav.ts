import { create } from 'zustand'
import {
  ANCHOR_BY_ID, bearingDeg, dist, NODE_BY_ID, ROOM_BY_ID,
  STAIR_NODE_BY_FLOOR, type FloorId, type Point,
} from '@/lib/floor'
import { findPath, nearestNodeId } from '@/lib/pathfinding'

// One climbed flight ≈ this many stair steps before we register a floor change.
const STAIR_STEPS_PER_FLIGHT = 12
// Distance (m) from a stair landing within which stair steps actually count.
const STAIR_NODE_RADIUS_M = 3.5

interface NavState {
  pos: Point | null
  floor: FloorId
  heading: number          // map-frame heading (degrees from north, CW)
  compassOffset: number
  stepLengthM: number
  destinationId: string | null
  lastAnchorId: string | null
  stairStepCount: number
  onStairs: boolean
  surveyMode: boolean              // free-roam: stair detection flips floor without needing a demo landing

  setStepLength: (m: number) => void
  setDestination: (id: string | null) => void
  setFloor: (f: FloorId) => void                       // manual override
  setSurveyMode: (on: boolean) => void
  applyAnchor: (anchorId: string, rawCompass: number) => boolean
  calibrate: (rawCompass: number, opts?: { pos?: Point; floor?: FloorId; headingDeg?: number }) => void
  setPose: (pos: Point, floor: FloorId) => void
  updateRawCompass: (rawCompass: number) => void
  snapFn: ((pos: Point) => Point) | null
  setSnapFn: (fn: ((pos: Point) => Point) | null) => void
  registerStep: (isStair?: boolean, stepLengthOverride?: number) => void
  reset: () => void
}

export const useNav = create<NavState>((set, get) => ({
  pos: null,
  floor: 1,
  heading: 0,
  compassOffset: 0,
  stepLengthM: 0.7,
  destinationId: null,
  lastAnchorId: null,
  stairStepCount: 0,
  onStairs: false,
  surveyMode: false,
  snapFn: null,

  setStepLength: (m) => set({ stepLengthM: m }),
  setSnapFn: (fn) => set({ snapFn: fn }),
  setDestination: (id) => set({ destinationId: id }),
  setSurveyMode: (on) => set({ surveyMode: on }),

  setFloor: (f) => {
    const { surveyMode, pos } = get()
    if (surveyMode) {
      // Free-roam: just flip floor, keep horizontal position.
      set({ floor: f, stairStepCount: 0, onStairs: false, pos: pos ?? { x: 0, y: 0 } })
      return
    }
    const stair = NODE_BY_ID[STAIR_NODE_BY_FLOOR[f]]
    set({ floor: f, pos: { ...stair.pos }, stairStepCount: 0, onStairs: false })
  },

  applyAnchor: (anchorId, rawCompass) => {
    const a = ANCHOR_BY_ID[anchorId]
    if (!a) return false
    const offset = ((rawCompass - a.headingDeg) % 360 + 360) % 360
    set({
      pos: { ...a.pos },
      floor: a.floor,
      heading: a.headingDeg,
      compassOffset: offset,
      lastAnchorId: anchorId,
      stairStepCount: 0,
      onStairs: false,
    })
    return true
  },

  calibrate: (rawCompass, opts) => {
    const headingDeg = opts?.headingDeg ?? 0
    const offset = ((rawCompass - headingDeg) % 360 + 360) % 360
    set({
      pos: { ...(opts?.pos ?? { x: 0, y: 0 }) },
      floor: opts?.floor ?? 1,
      heading: headingDeg,
      compassOffset: offset,
      lastAnchorId: null,
      stairStepCount: 0,
      onStairs: false,
    })
  },

  setPose: (pos, floor) => set({ pos: { ...pos }, floor, stairStepCount: 0, onStairs: false }),

  updateRawCompass: (rawCompass) => {
    const { compassOffset } = get()
    const h = ((rawCompass - compassOffset) % 360 + 360) % 360
    set({ heading: h })
  },

  registerStep: (isStair = false, stepLengthOverride?: number) => {
    const { pos, heading, stepLengthM, floor, stairStepCount, surveyMode, snapFn } = get()
    if (!pos) return
    const stepLen = stepLengthOverride ?? stepLengthM

    if (isStair) {
      if (surveyMode) {
        // Free-roam survey: any stair-detected steps count; auto-flip floor at threshold.
        const next = stairStepCount + 1
        if (next >= STAIR_STEPS_PER_FLIGHT) {
          const newFloor: FloorId = floor === 1 ? 2 : 1
          set({ floor: newFloor, stairStepCount: 0, onStairs: false })
        } else {
          set({ stairStepCount: next, onStairs: true })
        }
        return
      }
      // Demo mode: only count near a known stair landing on this floor.
      const stair = NODE_BY_ID[STAIR_NODE_BY_FLOOR[floor]]
      if (dist(pos, stair.pos) <= STAIR_NODE_RADIUS_M) {
        const next = stairStepCount + 1
        if (next >= STAIR_STEPS_PER_FLIGHT) {
          const newFloor: FloorId = floor === 1 ? 2 : 1
          const landing = NODE_BY_ID[STAIR_NODE_BY_FLOOR[newFloor]]
          set({
            floor: newFloor,
            pos: { ...landing.pos },
            stairStepCount: 0,
            onStairs: false,
          })
        } else {
          set({ stairStepCount: next, onStairs: true })
        }
        return
      }
    }

    // Normal horizontal step.
    const rad = (heading * Math.PI) / 180
    const dx = Math.sin(rad) * stepLen
    const dy = -Math.cos(rad) * stepLen
    let newPos = { x: pos.x + dx, y: pos.y + dy }
    if (snapFn) newPos = snapFn(newPos)
    set({
      pos: newPos,
      onStairs: false,
      stairStepCount: 0,
    })
  },

  reset: () => set({
    pos: null, floor: 1, heading: 0, compassOffset: 0,
    destinationId: null, lastAnchorId: null,
    stairStepCount: 0, onStairs: false, surveyMode: false,
  }),
}))

// Convenience: compute current path to destination (across floors if needed).
export function usePathToDestination() {
  const pos = useNav((s) => s.pos)
  const floor = useNav((s) => s.floor)
  const destinationId = useNav((s) => s.destinationId)
  if (!pos || !destinationId) return null
  const room = ROOM_BY_ID[destinationId]
  if (!room) return null
  const start = nearestNodeId(pos, floor)
  const nodes = findPath(start, room.doorNodeId)
  if (nodes.length === 0) return null

  // Nodes on the user's current floor (for drawing on the visible map).
  const nodesOnFloor = nodes.filter((n) => n.floor === floor)

  const totalDistance = nodes.reduce(
    (acc, n, i) => i === 0 ? 0 : acc + dist(nodes[i - 1].pos, n.pos),
    0,
  )
  // Pick the next node that's on this floor (or the stair landing).
  const next = nodes[1] ?? nodes[0]
  const bearing = bearingDeg(pos, next.pos)
  const needsStairs = room.floor !== floor
  return { nodes, nodesOnFloor, room, totalDistance, next, bearing, needsStairs }
}
