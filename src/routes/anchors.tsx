import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ANCHORS } from '@/lib/floor'

export const Route = createFileRoute('/anchors')({
  head: () => ({ meta: [{ title: 'Test QR anchors — Wayfinder' }] }),
  component: AnchorsPage,
})

function AnchorsPage() {
  const [qrs, setQrs] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    Promise.all(
      ANCHORS.map((a) =>
        QRCode.toDataURL(a.id, { margin: 1, width: 320, errorCorrectionLevel: 'M' })
          .then((url) => [a.id, url] as const),
      ),
    ).then((pairs) => {
      if (cancelled) return
      setQrs(Object.fromEntries(pairs))
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/" className="text-xs font-medium text-muted-foreground">← Home</Link>
        <h1 className="text-sm font-semibold text-foreground">Test QR anchors</h1>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
        >
          Print
        </button>
      </header>

      <p className="px-4 pt-3 text-xs text-muted-foreground">
        Print this sheet and tape each code at its labeled location, oriented so the arrow on the
        sticker matches the listed heading. Scanning a code locks your position + calibrates the compass.
      </p>

      {[1, 2].map((f) => (
        <div key={f}>
          <h2 className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Floor {f}</h2>
          <div className="grid grid-cols-2 gap-3 p-4 print:grid-cols-2">
            {ANCHORS.filter((a) => a.floor === f).map((a) => (
              <div
                key={a.id}
                className="flex flex-col items-center rounded-xl border border-border bg-card p-3 print:break-inside-avoid"
              >
                {qrs[a.id] ? (
                  <img src={qrs[a.id]} alt={a.id} className="size-32" />
                ) : (
                  <div className="size-32 animate-pulse rounded bg-muted" />
                )}
                <div className="mt-2 text-base font-bold text-foreground">{a.id}</div>
                <div className="text-xs text-muted-foreground">{a.label}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  F{a.floor} · ({a.pos.x}, {a.pos.y}) · {a.headingDeg}°
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="px-4 pb-8 text-[11px] text-muted-foreground">
        Tip: for desktop testing without a phone, open this page on one device and the scanner on another —
        or just point your phone camera at this screen to scan.
      </div>
    </div>
  )
}
