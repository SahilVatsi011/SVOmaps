import { dist, EDGES, NODES, NODE_BY_ID, type FloorId, type NavNode, type Point } from './floor'

const ADJ: Record<string, { id: string; cost: number }[]> = {}
for (const n of NODES) ADJ[n.id] = []
for (const e of EDGES) {
  // Stair edges get a fixed traversal cost (~one short flight)
  const cost = e.stairs ? 6 : dist(NODE_BY_ID[e.a].pos, NODE_BY_ID[e.b].pos)
  ADJ[e.a].push({ id: e.b, cost })
  ADJ[e.b].push({ id: e.a, cost })
}

// A* over the multi-floor node graph. Heuristic is 0 across floors (admissible).
export function findPath(startId: string, goalId: string): NavNode[] {
  if (startId === goalId) return [NODE_BY_ID[startId]]
  const goal = NODE_BY_ID[goalId]
  const open = new Set<string>([startId])
  const cameFrom: Record<string, string> = {}
  const g: Record<string, number> = { [startId]: 0 }
  const h = (id: string) => {
    const n = NODE_BY_ID[id]
    return n.floor === goal.floor ? dist(n.pos, goal.pos) : 0
  }
  const f: Record<string, number> = { [startId]: h(startId) }

  while (open.size) {
    let current = ''
    let best = Infinity
    for (const id of open) if ((f[id] ?? Infinity) < best) { best = f[id]; current = id }
    if (current === goalId) {
      const out: NavNode[] = [NODE_BY_ID[current]]
      while (cameFrom[current]) { current = cameFrom[current]; out.unshift(NODE_BY_ID[current]) }
      return out
    }
    open.delete(current)
    for (const nb of ADJ[current] ?? []) {
      const tentative = (g[current] ?? Infinity) + nb.cost
      if (tentative < (g[nb.id] ?? Infinity)) {
        cameFrom[nb.id] = current
        g[nb.id] = tentative
        f[nb.id] = tentative + h(nb.id)
        open.add(nb.id)
      }
    }
  }
  return []
}

// Find nearest graph node on the given floor.
export function nearestNodeId(pos: Point, floor: FloorId): string {
  let best = ''
  let bestD = Infinity
  for (const n of NODES) {
    if (n.floor !== floor) continue
    const d = dist(n.pos, pos)
    if (d < bestD) { bestD = d; best = n.id }
  }
  return best || NODES[0].id
}
