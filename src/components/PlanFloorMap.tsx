import type { CMFloor, CMNode, CustomMap, Plan } from '@/lib/customMap'
import { metersToPx } from '@/lib/customMap'
import { useNav } from '@/store/nav'

interface Props {
  map: CustomMap
  plan: Plan
  floor: CMFloor
  pathIds?: string[]
  highlightNodeId?: string | null
  className?: string
  showUser?: boolean
  /** Optional click handler — receives image pixel coords. */
  onPixelClick?: (px: number, py: number) => void
  /** Optional extra overlays (e.g. scale endpoints) in image px space. */
  markers?: Array<{ x: number; y: number; color?: string; label?: string }>
}

export function PlanFloorMap({
  map, plan, floor, pathIds, highlightNodeId, className,
  showUser = true, onPixelClick, markers,
}: Props) {
  const userPos = useNav((s) => s.pos)
  const userFloor = useNav((s) => s.floor)
  const heading = useNav((s) => s.heading)

  const W = plan.widthPx, H = plan.heightPx
  const byId: Record<string, CMNode> = Object.fromEntries(map.nodes.map((n) => [n.id, n]))
  const nodesOnFloor = map.nodes.filter((n) => n.floor === floor)
  const edgesOnFloor = map.edges.filter((e) => {
    const a = byId[e.a], c = byId[e.b]
    return a && c && a.floor === floor && c.floor === floor
  })
  const pathSet = new Set(pathIds ?? [])
  const pathPx = (pathIds ?? [])
    .map((id) => byId[id])
    .filter((n) => n && n.floor === floor)
    .map((n) => metersToPx(plan, n.pos))

  const userPx = showUser && userPos && userFloor === floor ? metersToPx(plan, userPos) : null

  // Scale node graphics with image size so they stay readable.
  const nodeR = Math.max(6, Math.min(W, H) * 0.012)
  const roomW = nodeR * 4
  const roomH = nodeR * 2.4
  const stroke = Math.max(1.5, nodeR * 0.25)

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!onPixelClick) return
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const py = ((e.clientY - rect.top) / rect.height) * H
    onPixelClick(px, py)
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      onClick={handleClick}
      style={{ cursor: onPixelClick ? 'crosshair' : undefined, touchAction: 'manipulation' }}
    >
      <image href={plan.imageDataUrl} x={0} y={0} width={W} height={H} />

      {/* Edges */}
      {edgesOnFloor.map((e, i) => {
        const a = metersToPx(plan, byId[e.a].pos)
        const b = metersToPx(plan, byId[e.b].pos)
        return (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="rgba(0,0,0,0.35)" strokeWidth={stroke} strokeLinecap="round" />
        )
      })}

      {/* Path */}
      {pathPx.length > 1 && (
        <polyline
          points={pathPx.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={stroke * 2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${nodeR * 1.4} ${nodeR}`}
        />
      )}

      {/* Nodes */}
      {nodesOnFloor.map((n) => {
        const p = metersToPx(plan, n.pos)
        const isPath = pathSet.has(n.id)
        const isHL = n.id === highlightNodeId
        if (n.kind === 'room') {
          return (
            <g key={n.id} transform={`translate(${p.x} ${p.y})`}>
              <rect x={-roomW / 2} y={-roomH / 2} width={roomW} height={roomH} rx={nodeR * 0.4}
                fill={isHL ? 'var(--color-primary)' : 'var(--color-card)'}
                stroke={isPath ? 'var(--color-primary)' : 'var(--color-border)'}
                strokeWidth={isPath ? stroke * 1.6 : stroke} />
              <text x={0} y={nodeR * 0.4} textAnchor="middle" fontSize={nodeR * 1.5}
                fill={isHL ? 'var(--color-primary-foreground)' : 'var(--color-foreground)'}
                style={{ fontWeight: 600 }}>
                {n.name ?? 'Room'}
              </text>
            </g>
          )
        }
        if (n.kind === 'stair') {
          return (
            <g key={n.id} transform={`translate(${p.x} ${p.y})`}>
              <rect x={-nodeR} y={-nodeR} width={nodeR * 2} height={nodeR * 2} rx={nodeR * 0.3}
                fill="var(--color-accent)" stroke="var(--color-border)" strokeWidth={stroke * 0.7} />
              <text x={0} y={nodeR * 0.6} textAnchor="middle" fontSize={nodeR * 1.8}
                fill="var(--color-accent-foreground)" style={{ fontWeight: 700 }}>↕</text>
            </g>
          )
        }
        return (
          <circle key={n.id} cx={p.x} cy={p.y} r={nodeR * 0.55}
            fill={isPath ? 'var(--color-primary)' : 'var(--color-foreground)'} opacity={0.7} />
        )
      })}

      {/* Extra markers (e.g. scale endpoints) */}
      {markers?.map((m, i) => (
        <g key={i}>
          <circle cx={m.x} cy={m.y} r={nodeR * 0.9} fill={m.color ?? 'var(--color-destructive)'} stroke="white" strokeWidth={stroke * 0.6} />
          {m.label && (
            <text x={m.x + nodeR * 1.2} y={m.y + nodeR * 0.4} fontSize={nodeR * 1.5}
              fill={m.color ?? 'var(--color-destructive)'} style={{ fontWeight: 700 }}>{m.label}</text>
          )}
        </g>
      ))}

      {/* User */}
      {userPx && (
        <g transform={`translate(${userPx.x} ${userPx.y}) rotate(${heading})`}>
          <circle r={nodeR * 2.2} fill="var(--color-primary)" opacity={0.2} />
          <circle r={nodeR * 1.3} fill="var(--color-primary)" />
          <polygon points={`0,${-nodeR * 3.2} ${nodeR * 1.2},${-nodeR * 0.8} ${-nodeR * 1.2},${-nodeR * 0.8}`}
            fill="var(--color-primary)" />
        </g>
      )}
    </svg>
  )
}
