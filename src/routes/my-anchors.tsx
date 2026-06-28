import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  type CustomMap, calibrationForNode, encodeNodeQR, floorsInMap, loadCustomMap,
} from '@/lib/customMap'

export const Route = createFileRoute('/my-anchors')({
  head: () => ({
    meta: [
      { title: 'My map QR anchors' },
      { name: 'description', content: 'Print QR codes for every room in your custom map.' },
    ],
  }),
  component: MyAnchorsPage,
})

function MyAnchorsPage() {
  const [map, setMap] = useState<CustomMap | null>(null)
  const [qrs, setQrs] = useState<Record<string, string>>({})

  useEffect(() => { setMap(loadCustomMap()) }, [])

  const printableNodes = useMemo(
    () => (map?.nodes ?? []).filter((n) => n.kind !== 'waypoint'),
    [map],
  )

  useEffect(() => {
    let cancelled = false
    if (!printableNodes.length) return
    Promise.all(
      printableNodes.map((n) =>
        QRCode.toDataURL(encodeNodeQR(n.id), { margin: 1, width: 320, errorCorrectionLevel: 'M' })
          .then((url) => [n.id, url] as const),
      ),
    ).then((pairs) => { if (!cancelled) setQrs(Object.fromEntries(pairs)) })
    return () => { cancelled = true }
  }, [printableNodes])

  if (!map) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="p-4">
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-foreground">
            No saved map yet. Survey your building first.
          </div>
          <Link to="/survey" className="mt-4 block rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground">
            Start surveying →
          </Link>
        </div>
      </div>
    )
  }

  const floors = floorsInMap(map)

  return (
    <div className="min-h-screen bg-background">
      <Header name={map.name} />

      <p className="px-4 pt-3 text-xs text-muted-foreground">
        Print and stick one QR at each marked spot. Each sticker locks your position,
        floor, and compass when scanned. The arrow ⬆ on the sticker should point toward the
        listed reference room — that's how the compass is zeroed.
      </p>

      <div className="px-4 pt-2 print:hidden">
        <button onClick={() => window.print()}
          className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          Print all
        </button>
      </div>

      {floors.map((f) => {
        const onFloor = printableNodes.filter((n) => n.floor === f)
        if (!onFloor.length) return null
        return (
          <div key={f}>
            <h2 className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Floor {f}</h2>
            <div className="grid grid-cols-2 gap-3 p-4 print:grid-cols-2">
              {onFloor.map((n) => {
                const cal = calibrationForNode(map, n.id)
                return (
                  <div key={n.id}
                    className="flex flex-col items-center rounded-xl border border-border bg-card p-3 print:break-inside-avoid">
                    {qrs[n.id] ? (
                      <img src={qrs[n.id]} alt={n.id} className="size-32" />
                    ) : (
                      <div className="size-32 animate-pulse rounded bg-muted" />
                    )}
                    <div className="mt-2 text-center text-sm font-bold text-foreground">
                      {n.name ?? (n.kind === 'stair' ? 'Stairs' : n.id)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      F{n.floor} · ({n.pos.x.toFixed(1)}, {n.pos.y.toFixed(1)})
                    </div>
                    <div className="mt-1 text-center text-[10px] text-muted-foreground">
                      ⬆ point toward:{' '}
                      <b>{cal?.neighborName ?? (cal ? `${cal.headingDeg.toFixed(0)}°` : '—')}</b>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="px-4 pb-8 text-[11px] text-muted-foreground">
        Tip: for testing, you can point your phone camera at this screen — no printing needed.
      </div>
    </div>
  )
}

function Header({ name }: { name?: string } = {}) {
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <Link to="/" className="text-xs font-medium text-muted-foreground">← Home</Link>
      <h1 className="text-sm font-semibold text-foreground">{name ? `${name} — QRs` : 'My map QRs'}</h1>
      <Link to="/my-map" className="text-xs font-medium text-muted-foreground">Map →</Link>
    </header>
  )
}
