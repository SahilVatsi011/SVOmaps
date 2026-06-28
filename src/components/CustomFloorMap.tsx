import type { CMFloor, CMNode, CustomMap } from '@/lib/customMap'
import { boundsForFloor } from '@/lib/customMap'
import { useNav } from '@/store/nav'

interface Props {
  map: { nodes: CMNode[]; edges: { a: string; b: string; stairs?: boolean }[] } | CustomMap
  floor: CMFloor
  pathIds?: string[]
  highlightNodeId?: string | null
  className?: string
  showUser?: boolean
}

const PAD = 2

export function CustomFloorMap({ map, floor, pathIds, highlightNodeId, className, showUser = true }: Props) {
  const userPos = useNav((s) => s.pos)
  const userFloor = useNav((s) => s.floor)
  const heading = useNav((s) => s.heading)

  const b = boundsForFloor(map as CustomMap, floor)
  // Include user pos in bounds so they stay visible while walking
  let { minX, minY, maxX, maxY } = b
  if (showUser && userPos && userFloor === floor) {
    minX = Math.min(minX, userPos.x)
    minY = Math.min(minY, userPos.y)
    maxX = Math.max(maxX, userPos.x)
    maxY = Math.max(maxY, userPos.y)
  }
  const w = Math.max(4, maxX - minX)
  const h = Math.max(4, maxY - minY)

  const nodesOnFloor = map.nodes.filter((n) => n.floor === floor)
  const byId: Record<string, CMNode> = Object.fromEntries(map.nodes.map((n) => [n.id, n]))
  const edgesOnFloor = map.edges.filter((e) => {
    const a = byId[e.a], c = byId[e.b]
    return a && c && a.floor === floor && c.floor === floor
  })

  const pathSet = new Set(pathIds ?? [])
  const pathPoints: { x: number; y: number }[] = []
  if (pathIds) {
    for (const id of pathIds) {
      const n = byId[id]
      if (n && n.floor === floor) pathPoints.push(n.pos)
    }
  }

  return (
    <svg
      viewBox={`${minX - PAD} ${minY - PAD} ${w + PAD * 2} ${h + PAD * 2}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={minX - PAD} y={minY - PAD} width={w + PAD * 2} height={h + PAD * 2} fill="var(--color-muted)" />

      {/* Edges */}
      {edgesOnFloor.map((e, i) => {
        const a = byId[e.a].pos, c = byId[e.b].pos
        return (
          <line key={i} x1={a.x} y1={a.y} x2={c.x} y2={c.y}
            stroke="var(--color-border)" strokeWidth={0.15} strokeLinecap="round" />
        )
      })}

      {/* Path overlay */}
      {pathPoints.length > 1 && (
        <polyline
          points={pathPoints.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={0.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="0.6 0.4"
        />
      )}

      {/* Nodes */}
      {nodesOnFloor.map((n) => {
        const isPath = pathSet.has(n.id)
        const isHL = n.id === highlightNodeId
        if (n.kind === 'room') {
          return (
            <g key={n.id} transform={`translate(${n.pos.x} ${n.pos.y})`}>
              <rect x={-1.1} y={-0.7} width={2.2} height={1.4} rx={0.25}
                fill={isHL ? 'var(--color-primary)' : 'var(--color-card)'}
                stroke={isPath ? 'var(--color-primary)' : 'var(--color-border)'}
                strokeWidth={isPath ? 0.15 : 0.08} />
              <text x={0} y={0.18} textAnchor="middle" fontSize={0.55}
                fill={isHL ? 'var(--color-primary-foreground)' : 'var(--color-foreground)'}
                style={{ fontWeight: 600 }}>
                {n.name ?? 'Room'}
              </text>
            </g>
          )
        }
        if (n.kind === 'stair') {
          return (
            <g key={n.id} transform={`translate(${n.pos.x} ${n.pos.y})`}>
              <rect x={-0.7} y={-0.7} width={1.4} height={1.4} rx={0.2}
                fill="var(--color-accent)" stroke="var(--color-border)" strokeWidth={0.08} />
              <text x={0} y={0.22} textAnchor="middle" fontSize={0.8}
                fill="var(--color-accent-foreground)" style={{ fontWeight: 700 }}>↕</text>
            </g>
          )
        }
        // waypoint
        return (
          <circle key={n.id} cx={n.pos.x} cy={n.pos.y} r={0.22}
            fill={isPath ? 'var(--color-primary)' : 'var(--color-foreground)'} opacity={0.7} />
        )
      })}

      {/* User */}
      {showUser && userPos && userFloor === floor && (
        <g transform={`translate(${userPos.x} ${userPos.y}) rotate(${heading})`}>
          <circle r={0.55} fill="var(--color-primary)" opacity={0.25} />
          <circle r={0.35} fill="var(--color-primary)" />
          <polygon points="0,-0.9 0.35,-0.2 -0.35,-0.2" fill="var(--color-primary)" />
        </g>
      )}
    </svg>
  )
}
