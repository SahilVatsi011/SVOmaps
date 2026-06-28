import { useNav, usePathToDestination } from '@/store/nav'
import { bearingDeg, dist, NODE_BY_ID, STAIR_NODE_BY_FLOOR } from '@/lib/floor'

// Overlay arrow + distance, rotated to point toward the next waypoint
// relative to the user's current heading. Cross-floor aware.
export function ARArrow() {
  const pos = useNav((s) => s.pos)
  const heading = useNav((s) => s.heading)
  const floor = useNav((s) => s.floor)
  const stairStepCount = useNav((s) => s.stairStepCount)
  const onStairs = useNav((s) => s.onStairs)
  const path = usePathToDestination()

  if (!pos || !path) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="rounded-full bg-background/80 px-4 py-2 text-xs text-muted-foreground backdrop-blur">
          Scan a QR anchor and pick a destination to begin
        </div>
      </div>
    )
  }

  const room = path.room
  // If we still need stairs to reach goal, target the stair landing on this floor.
  let nextPoint = path.next.pos
  let prompt: string | null = null
  if (path.needsStairs) {
    const stair = NODE_BY_ID[STAIR_NODE_BY_FLOOR[floor]]
    nextPoint = stair.pos
    prompt = floor < room.floor ? 'Take the stairs UP' : 'Take the stairs DOWN'
  }

  const bearing = bearingDeg(pos, nextPoint)
  const relative = ((bearing - heading) % 360 + 360) % 360
  const arrived = !path.needsStairs && path.totalDistance < 1.2

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <div className="flex flex-1 items-center justify-center">
        {arrived ? (
          <div className="rounded-2xl bg-primary px-6 py-4 text-center text-primary-foreground shadow-2xl">
            <div className="text-2xl font-semibold">You've arrived</div>
            <div className="text-sm opacity-80">{room.name}</div>
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
                  <filter id="arrowShadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.5" />
                  </filter>
                </defs>
                <polygon
                  points="0,-40 28,20 10,20 10,40 -10,40 -10,20 -28,20"
                  fill="var(--color-primary)"
                  stroke="var(--color-primary-foreground)"
                  strokeWidth="2"
                  filter="url(#arrowShadow)"
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
            {room.name} {room.floor !== floor ? `(F${room.floor})` : ''}
          </div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground">Distance</div>
          <div className="font-semibold text-foreground">{path.totalDistance.toFixed(1)} m</div>
        </div>
      </div>
    </div>
  )
}

// Re-export for callers that still want raw helpers
export { bearingDeg, dist }
