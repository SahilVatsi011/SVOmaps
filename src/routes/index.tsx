import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { FloorMap } from '@/components/FloorMap'
import { ROOMS } from '@/lib/floor'
import { useNav, usePathToDestination } from '@/store/nav'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Indoor Wayfinder' },
      { name: 'description', content: 'QR-anchored indoor navigation using your phone\'s motion sensors.' },
      { property: 'og:title', content: 'Indoor Wayfinder' },
      { property: 'og:description', content: 'QR-anchored indoor navigation using your phone\'s motion sensors.' },
    ],
  }),
  component: HomePage,
})

function HomePage() {
  const destinationId = useNav((s) => s.destinationId)
  const pos = useNav((s) => s.pos)
  const floor = useNav((s) => s.floor)
  const lastAnchorId = useNav((s) => s.lastAnchorId)
  const setDestination = useNav((s) => s.setDestination)
  const path = usePathToDestination()
  const [previewFloor, setPreviewFloor] = useState<1 | 2>(1)

  useEffect(() => {
    if (!destinationId) setDestination(ROOMS[0].id)
  }, [destinationId, setDestination])

  // Follow user's floor when they're navigating
  useEffect(() => { if (pos) setPreviewFloor(floor) }, [floor, pos])

  const previewPath = useMemo(() => path?.nodes ?? [], [path])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-4 pb-3 pt-5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Indoor Wayfinder</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Scan a QR anchor, follow the arrow — climb the stairs and it auto-detects floor 2.
        </p>
      </header>

      <section className="border-b border-border bg-muted/40 px-4 py-3">
        <div className="grid grid-cols-4 gap-2 text-xs">
          <Stat label="Floor" value={pos ? `F${floor}` : '—'} />
          <Stat label="Position" value={pos ? `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}` : '—'} />
          <Stat label="Anchor" value={lastAnchorId ?? '—'} />
          <Stat label="Destination" value={path?.room ? `F${path.room.floor} ${path.room.name}` : '—'} />
        </div>
      </section>

      <section className="p-4">
        <label className="mb-2 block text-xs font-medium text-muted-foreground">
          Where are you going?
        </label>
        <select
          value={destinationId ?? ''}
          onChange={(e) => setDestination(e.target.value || null)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          {ROOMS.map((r) => (
            <option key={r.id} value={r.id}>F{r.floor} · {r.name}</option>
          ))}
        </select>
      </section>

      <section className="px-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Floor preview</span>
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-[11px]">
            {[1, 2].map((f) => (
              <button
                key={f}
                onClick={() => setPreviewFloor(f as 1 | 2)}
                className={`rounded px-2 py-0.5 font-semibold ${
                  previewFloor === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                F{f}
              </button>
            ))}
          </div>
        </div>
        <div className="aspect-[3/2] w-full overflow-hidden rounded-xl border border-border bg-card">
          <FloorMap floor={previewFloor} path={previewPath} highlightRoomId={destinationId} className="size-full" />
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Dark squares = QR anchors. ↕ = stairs connecting floors.
        </p>
      </section>

      <section className="mt-auto space-y-3 p-4">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="text-sm font-semibold text-foreground">Map your own building 🏢</div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            No blueprint? Walk room to room, drop a point at each, climb the stairs — we'll auto-detect floor 2.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link to="/plan"
              className="rounded-lg bg-primary px-3 py-2 text-center text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              📐 Upload floor plan
            </Link>
            <Link to="/survey"
              className="rounded-lg border border-border bg-card px-3 py-2 text-center text-xs font-medium text-foreground hover:bg-accent">
              Walk survey
            </Link>
            <Link to="/my-map"
              className="rounded-lg border border-border bg-card px-3 py-2 text-center text-xs font-medium text-foreground hover:bg-accent">
              Open my map
            </Link>
            <Link to="/my-anchors"
              className="rounded-lg border border-border bg-card px-3 py-2 text-center text-xs font-medium text-foreground hover:bg-accent">
              My QRs
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/anchors"
            className="rounded-xl border border-border bg-card px-4 py-3 text-center text-sm font-medium text-foreground hover:bg-accent"
          >
            Demo: Print QRs
          </Link>
          <Link
            to="/scan"
            className="rounded-xl border border-border bg-card px-4 py-3 text-center text-sm font-medium text-foreground hover:bg-accent"
          >
            Demo: Scan
          </Link>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate text-xs font-semibold text-foreground">{value}</div>
    </div>
  )
}
