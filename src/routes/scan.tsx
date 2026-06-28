import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useRef, useState } from 'react'
import { QRScanner } from '@/components/QRScanner'
import { ANCHOR_BY_ID } from '@/lib/floor'
import { usePDR } from '@/hooks/usePDR'
import { useNav } from '@/store/nav'
import { calibrationForNode, decodeNodeQR, loadCustomMap } from '@/lib/customMap'

export const Route = createFileRoute('/scan')({
  head: () => ({ meta: [{ title: 'Scan anchor — Wayfinder' }] }),
  component: ScanPage,
})

function ScanPage() {
  const navigate = useNavigate()
  const { status, requestPermission, rawHeading } = usePDR()
  const applyAnchor = useNav((s) => s.applyAnchor)
  const calibrate = useNav((s) => s.calibrate)
  const [feedback, setFeedback] = useState<string | null>(null)
  const lastHandledAt = useRef(0)

  const handleDecode = useCallback((text: string) => {
    const now = performance.now()
    if (now - lastHandledAt.current < 1500) return

    // 1) Custom-map QR (from /my-anchors)
    const cmId = decodeNodeQR(text)
    if (cmId) {
      const map = loadCustomMap()
      const cal = map ? calibrationForNode(map, cmId) : null
      if (!map || !cal) {
        lastHandledAt.current = now
        setFeedback('Custom map QR found but no saved map on this device.')
        return
      }
      lastHandledAt.current = now
      calibrate(rawHeading, { pos: cal.pos, floor: cal.floor as 1 | 2, headingDeg: cal.headingDeg })
      const node = map.nodes.find((n) => n.id === cmId)
      setFeedback(`Locked at ${node?.name ?? cmId}`)
      setTimeout(() => navigate({ to: '/my-map' }), 600)
      return
    }

    // 2) Demo anchor (A1–B3)
    const anchor = ANCHOR_BY_ID[text.trim()]
    if (!anchor) {
      lastHandledAt.current = now
      setFeedback(`Unknown code: ${text.slice(0, 20)}`)
      return
    }
    lastHandledAt.current = now
    const ok = applyAnchor(anchor.id, rawHeading)
    if (ok) {
      setFeedback(`Locked at ${anchor.label}`)
      setTimeout(() => navigate({ to: '/navigate' }), 600)
    }
  }, [applyAnchor, calibrate, rawHeading, navigate])

  const ready = status === 'granted'

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-background/95 to-transparent px-4 pb-6 pt-4">
        <button
          onClick={() => navigate({ to: '/' })}
          className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground backdrop-blur"
        >
          ← Back
        </button>
        <div className="rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          Heading {Math.round(rawHeading)}°
        </div>
      </header>

      {!ready ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-lg font-semibold text-foreground">Enable motion sensors</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            We need motion and orientation access to track your steps and direction.
            Camera permission comes next when we open the scanner.
          </p>
          <button
            onClick={requestPermission}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            {status === 'requesting' ? 'Requesting…' : 'Grant access'}
          </button>
          {status === 'denied' && (
            <p className="text-xs text-destructive">
              Denied. Reload and allow motion/orientation when prompted.
            </p>
          )}
          {status === 'unsupported' && (
            <p className="text-xs text-destructive">
              This device doesn't expose motion sensors to the browser.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="relative flex-1 overflow-hidden bg-black">
            <QRScanner active={ready} onDecode={handleDecode} className="relative size-full" />
            {/* Reticle */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="size-56 rounded-2xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>
          </div>
          <div className="bg-background p-4 text-center">
            <p className="text-sm font-medium text-foreground">
              Point at any anchor sticker
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {feedback ?? 'Demo (A1–B3) or your own map QRs both work.'}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
