// Custom map built by the user via the Survey flow.
// Coordinates are in meters relative to the calibration origin (0,0 = where you started).

export type CMFloor = number
export interface CMPoint { x: number; y: number }

export type CMNodeKind = 'room' | 'waypoint' | 'stair'

export interface CMNode {
  id: string
  pos: CMPoint
  floor: CMFloor
  kind: CMNodeKind
  name?: string          // populated for rooms
  stairPairId?: string   // for stair nodes: id of the matching node on the other floor
}

export interface CMEdge { a: string; b: string; stairs?: boolean }

export interface Plan {
  imageDataUrl: string
  widthPx: number
  heightPx: number
  mPerPx: number                       // 1 pixel = X meters
  originPx: { x: number; y: number }   // pixel position where world (0,0) sits
  rotationDeg?: number                 // reserved, currently 0
}

export interface CustomMap {
  name: string
  createdAt: number
  nodes: CMNode[]
  edges: CMEdge[]
  plans?: Record<number, Plan>         // optional uploaded floor plans per floor
}

export function pxToMeters(plan: Plan, px: number, py: number): CMPoint {
  return { x: (px - plan.originPx.x) * plan.mPerPx, y: (py - plan.originPx.y) * plan.mPerPx }
}
export function metersToPx(plan: Plan, p: CMPoint): { x: number; y: number } {
  return { x: p.x / plan.mPerPx + plan.originPx.x, y: p.y / plan.mPerPx + plan.originPx.y }
}

const STORAGE_KEY = 'wayfinder.customMap.v1'

export function saveCustomMap(m: CustomMap) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(m))
}

export function loadCustomMap(): CustomMap | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as CustomMap } catch { return null }
}

export function clearCustomMap() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export function distCM(a: CMPoint, b: CMPoint) {
  const dx = a.x - b.x, dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function bearingDegCM(from: CMPoint, to: CMPoint) {
  const dx = to.x - from.x, dy = to.y - from.y
  const rad = Math.atan2(dx, -dy)
  let deg = (rad * 180) / Math.PI
  if (deg < 0) deg += 360
  return deg
}

// A* over a custom map.
export function findPathCM(map: CustomMap, startId: string, goalId: string): CMNode[] {
  const byId: Record<string, CMNode> = Object.fromEntries(map.nodes.map((n) => [n.id, n]))
  if (!byId[startId] || !byId[goalId]) return []
  if (startId === goalId) return [byId[startId]]

  const adj: Record<string, { id: string; cost: number }[]> = {}
  for (const n of map.nodes) adj[n.id] = []
  for (const e of map.edges) {
    if (!byId[e.a] || !byId[e.b]) continue
    const cost = e.stairs ? 6 : distCM(byId[e.a].pos, byId[e.b].pos)
    adj[e.a].push({ id: e.b, cost })
    adj[e.b].push({ id: e.a, cost })
  }

  const goal = byId[goalId]
  const open = new Set<string>([startId])
  const cameFrom: Record<string, string> = {}
  const g: Record<string, number> = { [startId]: 0 }
  const h = (id: string) => (byId[id].floor === goal.floor ? distCM(byId[id].pos, goal.pos) : 0)
  const f: Record<string, number> = { [startId]: h(startId) }

  while (open.size) {
    let current = ''
    let best = Infinity
    for (const id of open) if ((f[id] ?? Infinity) < best) { best = f[id]; current = id }
    if (current === goalId) {
      const out: CMNode[] = [byId[current]]
      while (cameFrom[current]) { current = cameFrom[current]; out.unshift(byId[current]) }
      return out
    }
    open.delete(current)
    for (const nb of adj[current] ?? []) {
      const t = (g[current] ?? Infinity) + nb.cost
      if (t < (g[nb.id] ?? Infinity)) {
        cameFrom[nb.id] = current
        g[nb.id] = t
        f[nb.id] = t + h(nb.id)
        open.add(nb.id)
      }
    }
  }
  return []
}

export function nearestNodeIdCM(map: CustomMap, pos: CMPoint, floor: CMFloor): string | null {
  let best: string | null = null
  let bestD = Infinity
  for (const n of map.nodes) {
    if (n.floor !== floor) continue
    const d = distCM(n.pos, pos)
    if (d < bestD) { bestD = d; best = n.id }
  }
  return best
}

export function floorsInMap(m: CustomMap): CMFloor[] {
  const set = new Set<CMFloor>()
  for (const n of m.nodes) set.add(n.floor)
  return [...set].sort((a, b) => a - b)
}

export function boundsForFloor(m: CustomMap, floor: CMFloor): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = 0, minY = 0, maxX = 0, maxY = 0, has = false
  for (const n of m.nodes) {
    if (n.floor !== floor) continue
    if (!has) { minX = maxX = n.pos.x; minY = maxY = n.pos.y; has = true; continue }
    if (n.pos.x < minX) minX = n.pos.x
    if (n.pos.y < minY) minY = n.pos.y
    if (n.pos.x > maxX) maxX = n.pos.x
    if (n.pos.y > maxY) maxY = n.pos.y
  }
  if (!has) return { minX: -5, minY: -5, maxX: 5, maxY: 5 }
  return { minX, minY, maxX, maxY }
}

export const CM_QR_PREFIX = 'wfcm:'

export function encodeNodeQR(nodeId: string) {
  return `${CM_QR_PREFIX}${nodeId}`
}

export function decodeNodeQR(text: string): string | null {
  const t = text.trim()
  if (!t.startsWith(CM_QR_PREFIX)) return null
  const id = t.slice(CM_QR_PREFIX.length)
  return id || null
}

/** Build a calibration pose for a scanned node: position + floor + a sensible facing direction. */
export function calibrationForNode(map: CustomMap, nodeId: string):
  { pos: CMPoint; floor: CMFloor; headingDeg: number; neighborName?: string } | null {
  const node = map.nodes.find((n) => n.id === nodeId)
  if (!node) return null
  // Prefer a same-floor, non-stair neighbor for a natural "facing" direction.
  const neighborIds = new Set<string>()
  for (const e of map.edges) {
    if (e.a === nodeId) neighborIds.add(e.b)
    else if (e.b === nodeId) neighborIds.add(e.a)
  }
  const neighbors = [...neighborIds]
    .map((id) => map.nodes.find((n) => n.id === id))
    .filter((n): n is CMNode => !!n && n.floor === node.floor)
  const preferred = neighbors.find((n) => n.kind !== 'stair') ?? neighbors[0]
  const headingDeg = preferred ? bearingDegCM(node.pos, preferred.pos) : 0
  return { pos: { ...node.pos }, floor: node.floor, headingDeg, neighborName: preferred?.name }
}
