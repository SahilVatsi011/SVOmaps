import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FloorMap } from '@/components/FloorMap'
import { QRScanner } from '@/components/QRScanner'
import { ARArrow } from '@/components/ARArrow'
import { ANCHOR_BY_ID, ROOMS } from '@/lib/floor'
import { usePDR } from '@/hooks/usePDR'
import { useNav, usePathToDestination } from '@/store/nav'

export const Route = createFileRoute('/navigate')({
  head: () => ({ meta: [{ title: 'Navigating — Wayfinder' }] }),
  component: NavigatePage,
})

function NavigatePage() {
  const navigate = useNavigate()
  const { status, requestPermission, stepCount, rawHeading, stairMode } = usePDR()
  const pos = useNav((s) => s.pos)
  const floor = useNav((s) => s.floor)
  const setFloor = useNav((s) => s.setFloor)
  const destinationId = useNav((s) => s.destinationId)
  const setDestination = useNav((s) => s.setDestination)
  const applyAnchor = useNav((s) => s.applyAnchor)
  const path = usePathToDestination()
  const lastHandledAt = useRef(0)
  const [scanFlash, setScanFlash] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'idle') {
      requestPermission().catch(() => {})
    }
  }, [status, requestPermission])

  const handleDecode = useCallback((text: string) => {
    const now = performance.now()
    if (now - lastHandledAt.current < 1500) return
    const a = ANCHOR_BY_ID[text.trim()]
    if (!a) return
    lastHandledAt.current = now
    applyAnchor(a.id, rawHeading)
    setScanFlash(`Re-anchored at ${a.label} (F${a.floor})`)
    setTimeout(() => setScanFlash(null), 1500)
  }, [applyAnchor, rawHeading])

  if (!pos) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">No position yet</h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          Scan a QR anchor first so we know where you are on the floor.
        </p>
        <Link to="/scan" className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
          Scan anchor
        </Link>
      </div>
    )
  }

  const roomsOnFloor = ROOMS // allow choosing any destination across floors

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-background/90 px-3 py-2 backdrop-blur">
        <button
          onClick={() => navigate({ to: '/' })}
          className="rounded-full px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          ← Exit
        </button>
        <select
          value={destinationId ?? ''}
          onChange={(e) => setDestination(e.target.value || null)}
          className="max-w-[45%] truncate rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
        >
          {roomsOnFloor.map((r) => (
            <option key={r.id} value={r.id}>F{r.floor} · {r.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-[10px]">
          {[1, 2].map((f) => (
            <button
              key={f}
              onClick={() => setFloor(f as 1 | 2)}
              className={`rounded px-2 py-0.5 font-semibold ${
                floor === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              F{f}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {stepCount}s {stairMode ? '· ↕' : ''}
        </div>
      </header>

      <section className="relative flex-1 overflow-hidden border-b-2 border-border bg-muted">
        <FloorMap path={path?.nodes ?? []} highlightRoomId={destinationId} className="size-full" />
        <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-background/85 px-2 py-1 text-[10px] font-semibold text-foreground backdrop-blur">
          Floor {floor}
        </div>
        {status !== 'granted' && (
          <div className="absolute inset-x-0 bottom-2 mx-3 rounded-lg bg-background/95 p-2 text-center text-xs shadow">
            <button onClick={requestPermission} className="font-semibold text-primary">
              Tap to enable motion sensors
            </button>
          </div>
        )}
      </section>

      <section className="relative flex-1 overflow-hidden bg-black">
        <QRScanner active onDecode={handleDecode} className="relative size-full" />
        <ARArrow />
        {scanFlash && (
          <div className="absolute inset-x-0 top-2 mx-auto w-max rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            {scanFlash}
          </div>
        )}
      </section>
    </div>
  )
}
