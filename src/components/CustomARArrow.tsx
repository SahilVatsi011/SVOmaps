import { bearingDegCM, type CMPoint } from '@/lib/customMap'

interface PathInfo {
  nodes: { id: string; pos: CMPoint; floor: number; kind: string; name?: string; stairPairId?: string }[]
  dest: { id: string; pos: CMPoint; floor: number; kind: string; name?: string }
  totalDistance: number
  next: { id: string; pos: CMPoint; floor: number; kind: string }
  needsStairs: boolean
}

interface Props {
  pos: CMPoint
  heading: number
  floor: number
  path: PathInfo
  stairStepCount: number
  onStairs: boolean
}

export function CustomARArrow({ pos, heading, floor, path, stairStepCount, onStairs }: Props) {
  const { nodes, dest, totalDistance, next, needsStairs } = path

  let nextPoint = next.pos
  let prompt: string | null = null
  if (needsStairs) {
    const stairNode = nodes.find((n) => n.kind === 'stair' && n.floor === floor)
    if (stairNode) nextPoint = stairNode.pos
    prompt = floor < dest.floor ? 'Take the stairs UP' : 'Take the stairs DOWN'
  }

  const bearing = bearingDegCM(pos, nextPoint)
  const relative = ((bearing - heading) % 360 + 360) % 360
  const arrived = !needsStairs && totalDistance < 1.2

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <div className="flex flex-1 items-center justify-center">
        {arrived ? (
          <div className="rounded-2xl bg-primary px-6 py-4 text-center text-primary-foreground shadow-2xl">
            <div className="text-2xl font-semibold">You've arrived</div>
            <div className="text-sm opacity-80">{dest.name ?? 'Destination'}</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {prompt && (
              <div className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground shadow">
                {prompt}
              </div>
            )}
            <div
              className="transition-transform duration-150"
              style={{ transform: `rotate(${relative}deg)` }}
            >
              <svg width="140" height="140" viewBox="-50 -50 100 100">
                <defs>
                  <filter id="arrowShadowCm" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.5" />
                  </filter>
                </defs>
                <polygon
                  points="0,-40 28,20 10,20 10,40 -10,40 -10,20 -28,20"
                  fill="var(--color-primary)"
                  stroke="var(--color-primary-foreground)"
                  strokeWidth="2"
                  filter="url(#arrowShadowCm)"
                />
              </svg>
            </div>
            {onStairs && (
              <div className="rounded-full bg-background/85 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
                Climbing stairs… {stairStepCount}/12
              </div>
            )}
          </div>
        )}
      </div>

      <div className="m-3 flex items-center justify-between rounded-xl bg-background/85 px-4 py-2 text-xs backdrop-blur">
        <div>
          <div className="text-muted-foreground">Heading to</div>
          <div className="font-semibold text-foreground">
            {dest.name ?? 'Destination'} {dest.floor !== floor ? `(F${dest.floor})` : ''}
          </div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground">Distance</div>
          <div className="font-semibold text-foreground">{totalDistance.toFixed(1)} m</div>
        </div>
      </div>
    </div>
  )
}
