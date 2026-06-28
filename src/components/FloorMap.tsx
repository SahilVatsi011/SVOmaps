import { ANCHORS, FLOOR_H, FLOOR_W, NODE_BY_ID, NODES, ROOMS, type FloorId, type NavNode } from '@/lib/floor'
import { useNav } from '@/store/nav'

interface Props {
  path?: NavNode[]
  highlightRoomId?: string | null
  showAnchors?: boolean
  className?: string
  floor?: FloorId            // which floor to render (defaults to user's current floor)
}

const PAD = 1 // meters

export function FloorMap({ path, highlightRoomId, showAnchors = true, className, floor }: Props) {
  const userPos = useNav((s) => s.pos)
  const userFloor = useNav((s) => s.floor)
  const heading = useNav((s) => s.heading)
  const shownFloor: FloorId = floor ?? userFloor

  const vbW = FLOOR_W + PAD * 2
  const vbH = FLOOR_H + PAD * 2
  const rooms = ROOMS.filter((r) => r.floor === shownFloor)
  const anchors = ANCHORS.filter((a) => a.floor === shownFloor)
  const stairNodes = NODES.filter((n) => n.floor === shownFloor && n.stair)
  const showUser = userPos && userFloor === shownFloor
  const pathHere = (path ?? []).filter((n) => n.floor === shownFloor)

  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${vbW} ${vbH}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={0} width={FLOOR_W} height={FLOOR_H} fill="var(--color-muted)" />

      {rooms.map((r) => {
        const hl = r.id === highlightRoomId
        return (
          <g key={r.id}>
            <rect
              x={r.rect.x} y={r.rect.y} width={r.rect.w} height={r.rect.h}
              fill={hl ? 'var(--color-primary)' : 'var(--color-card)'}
              stroke="var(--color-border)"
              strokeWidth={0.1}
              rx={0.2}
              opacity={hl ? 0.85 : 1}
            />
            <text
              x={r.rect.x + r.rect.w / 2}
              y={r.rect.y + r.rect.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={0.9}
              fill={hl ? 'var(--color-primary-foreground)' : 'var(--color-foreground)'}
              style={{ fontWeight: hl ? 600 : 400 }}
            >
              {r.name}
            </text>
          </g>
        )
      })}

      {/* Stair icons */}
      {stairNodes.map((s) => (
        <g key={s.id} transform={`translate(${s.pos.x} ${s.pos.y})`}>
          <rect x={-0.9} y={-0.9} width={1.8} height={1.8} rx={0.2}
            fill="var(--color-accent)" stroke="var(--color-border)" strokeWidth={0.08} />
          <text x={0} y={0.25} textAnchor="middle" fontSize={0.9}
            fill="var(--color-accent-foreground)" style={{ fontWeight: 700 }}>↕</text>
        </g>
      ))}

      {pathHere.length > 1 && (
        <polyline
          points={pathHere.map((n) => `${n.pos.x},${n.pos.y}`).join(' ')}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={0.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="0.6 0.4"
        />
      )}

      {showAnchors && anchors.map((a) => (
        <g key={a.id}>
          <rect
            x={a.pos.x - 0.35} y={a.pos.y - 0.35}
            width={0.7} height={0.7}
            fill="var(--color-foreground)"
            opacity={0.85}
            rx={0.1}
          />
          <text
            x={a.pos.x} y={a.pos.y + 0.18}
            textAnchor="middle"
            fontSize={0.4}
            fill="var(--color-background)"
            style={{ fontWeight: 700 }}
          >
            {a.id}
          </text>
        </g>
      ))}

      {showUser && (
        <g transform={`translate(${userPos.x} ${userPos.y}) rotate(${heading})`}>
          <circle r={0.55} fill="var(--color-primary)" opacity={0.25} />
          <circle r={0.35} fill="var(--color-primary)" />
          <polygon
            points="0,-0.9 0.35,-0.2 -0.35,-0.2"
            fill="var(--color-primary)"
          />
        </g>
      )}
    </svg>
  )
}

export function nodesFromIds(ids: string[]): NavNode[] {
  return ids.map((id) => NODE_BY_ID[id]).filter(Boolean)
}
