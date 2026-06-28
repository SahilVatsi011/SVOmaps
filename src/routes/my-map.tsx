import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePDR } from '@/hooks/usePDR'
import { useNav } from '@/store/nav'
import { CustomFloorMap } from '@/components/CustomFloorMap'
import { PlanFloorMap } from '@/components/PlanFloorMap'
import { QRScanner } from '@/components/QRScanner'
import { CustomARArrow } from '@/components/CustomARArrow'
import {
  type CustomMap, type CMNode, bearingDegCM, calibrationForNode, decodeNodeQR,
  distCM, findPathCM, floorsInMap, loadCustomMap, nearestNodeIdCM, clearCustomMap,
} from '@/lib/customMap'

export const Route = createFileRoute('/my-map')({
  head: () => ({
    meta: [
      { title: 'My building map' },
      { name: 'description', content: 'Navigate your saved custom indoor map.' },
    ],
  }),
  component: MyMapPage,
})

function MyMapPage() {
  const { status, stepCount, rawHeading, stairMode, requestPermission } = usePDR()
  const pos = useNav((s) => s.pos)
  const floor = useNav((s) => s.floor)
  const heading = useNav((s) => s.heading)
  const onStairs = useNav((s) => s.onStairs)
  const stairStepCount = useNav((s) => s.stairStepCount)
  const setSurveyMode = useNav((s) => s.setSurveyMode)
  const calibrate = useNav((s) => s.calibrate)
  const setFloor = useNav((s) => s.setFloor)

  const [map, setMap] = useState<CustomMap | null>(null)
  const [destId, setDestId] = useState<string | null>(null)
  const [startId, setStartId] = useState<string | null>(null)
  const [facingId, setFacingId] = useState<string | null>(null)
  const [previewFloor, setPreviewFloor] = useState<number>(1)
  const [showCamera, setShowCamera] = useState(false)
  const [showCalibScanner, setShowCalibScanner] = useState(false)
  const [showRescan, setShowRescan] = useState(false)
  const [scanFeedback, setScanFeedback] = useState<string | null>(null)
  const [miniMapExpanded, setMiniMapExpanded] = useState(false)
  const lastScanAt = useRef(0)

  const handleQRDecode = useCallback((text: string) => {
    const now = performance.now()
    if (now - lastScanAt.current < 1500) return
    const cmId = decodeNodeQR(text)
    if (!cmId) return
    const m = map
    if (!m) return
    const cal = calibrationForNode(m, cmId)
    if (!cal) return
    lastScanAt.current = now
    calibrate(rawHeading, { pos: cal.pos, floor: cal.floor as 1 | 2, headingDeg: cal.headingDeg })
    const node = m.nodes.find((n) => n.id === cmId)
    setScanFeedback(`Locked at ${node?.name ?? cmId}`)
    setTimeout(() => setScanFeedback(null), 2000)
  }, [map, calibrate, rawHeading])

  useEffect(() => { setMap(loadCustomMap()) }, [])
  useEffect(() => { setSurveyMode(true); return () => setSurveyMode(false) }, [setSurveyMode])
  useEffect(() => { if (pos && floor !== previewFloor) setPreviewFloor(floor) }, [floor]) // eslint-disable-line
  useEffect(() => { if (status === 'idle') { requestPermission().catch(() => {}) } }, [status, requestPermission])

  const rooms = useMemo(() => (map?.nodes ?? []).filter((n) => n.kind === 'room'), [map])
  const floors = useMemo(() => map ? floorsInMap(map) : [], [map])

  useEffect(() => {
    if (map && floors.length && !floors.includes(previewFloor)) setPreviewFloor(floors[0])
  }, [map, floors, previewFloor])

  const path = useMemo(() => {
    if (!map || !pos || !destId) return null
    const sId = nearestNodeIdCM(map, pos, floor)
    if (!sId) return null
    const dest = map.nodes.find((n) => n.id === destId)
    if (!dest) return null
    const nodes = findPathCM(map, sId, dest.id)
    if (nodes.length === 0) return null
    const totalDistance = nodes.reduce((acc, n, i) => i === 0 ? 0 : acc + distCM(nodes[i - 1].pos, n.pos), 0)
    const next = nodes[1] ?? nodes[0]
    const needsStairs = dest.floor !== floor
    return { nodes, dest, totalDistance, next, needsStairs }
  }, [map, pos, destId, floor])

  async function startNavigation() {
    if (!map || !startId || !facingId) return
    const startNode = map.nodes.find((n) => n.id === startId)
    const faceNode = map.nodes.find((n) => n.id === facingId)
    if (!startNode || !faceNode) return
    await requestPermission()
    const desiredHeading = bearingDegCM(startNode.pos, faceNode.pos)
    calibrate(rawHeading || 0, { pos: startNode.pos, floor: startNode.floor as 1 | 2, headingDeg: desiredHeading })
  }

  if (!map) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <div className="p-4">
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-foreground">
            No saved map yet. Walk through your building first.
          </div>
          <Link to="/survey" className="mt-4 block rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground">
            Start surveying →
          </Link>
        </div>
      </div>
    )
  }

  const pathIds = path?.nodes.map((n) => n.id) ?? []
  const arrowDeg = path && pos
    ? (((bearingDegCM(pos, (path.needsStairs
        ? (map.nodes.find((n) => n.kind === 'stair' && n.floor === floor) as CMNode | undefined)?.pos ?? path.next.pos
        : path.next.pos)) - heading) % 360) + 360) % 360
    : 0

  const arrived = path && !path.needsStairs && path.totalDistance < 1.2

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header name={map.name} />

      {!pos ? (
        <section className="space-y-3 p-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Start navigation</h2>
            <p className="mt-1 text-xs text-muted-foreground">Tell us where you are, and which room you're facing.</p>
            <label className="mt-3 block text-xs text-muted-foreground">I'm standing at:</label>
            <select value={startId ?? ''} onChange={(e) => setStartId(e.target.value || null)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
              <option value="">— pick a room —</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>F{r.floor} · {r.name}</option>)}
            </select>
            <label className="mt-3 block text-xs text-muted-foreground">I'm facing toward:</label>
            <select value={facingId ?? ''} onChange={(e) => setFacingId(e.target.value || null)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
              <option value="">— pick any nearby room —</option>
              {rooms.filter((r) => r.id !== startId).map((r) => <option key={r.id} value={r.id}>F{r.floor} · {r.name}</option>)}
            </select>
            <button onClick={startNavigation}
              disabled={!startId || !facingId}
              className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              Calibrate & start
            </button>
            {status === 'denied' && <p className="mt-2 text-xs text-destructive">Motion permission denied.</p>}

            <div className="mt-4 border-t border-border pt-4">
              <p className="text-center text-xs text-muted-foreground mb-3">— or scan a QR sticker —</p>
              {!showCalibScanner ? (
                <button onClick={() => setShowCalibScanner(true)}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                  📷 Scan QR sticker
                </button>
              ) : (
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
                  <QRScanner active={showCalibScanner} onDecode={handleQRDecode} className="size-full" />
                  <button onClick={() => setShowCalibScanner(false)}
                    className="absolute top-2 right-2 rounded-full bg-background/80 px-2 py-1 text-xs text-foreground backdrop-blur">
                    ✕ Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : showCamera ? (
        <div className="relative flex flex-1 flex-col bg-black">
          <div className="absolute inset-0">
            <QRScanner active={showCamera} onDecode={handleQRDecode} className="size-full" />
            {pos && path && (
              <CustomARArrow pos={pos} heading={heading} floor={floor}
                path={path} stairStepCount={stairStepCount} onStairs={onStairs} />
            )}
            {scanFeedback && (
              <div className="absolute inset-x-0 top-2 mx-auto w-max rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                {scanFeedback}
              </div>
            )}
          </div>

          <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-3">
            <div className="flex items-center gap-3 text-[11px] text-white/90">
              <span className="font-semibold">F{floor}</span>
              <span>{pos.x.toFixed(1)},{pos.y.toFixed(1)}</span>
              <span>{heading.toFixed(0)}°</span>
              <span>{stepCount}s</span>
              {stairMode && <span>↕</span>}
            </div>
            {status !== 'granted' && (
              <div className="mt-1 rounded bg-accent/80 px-2 py-0.5 text-[10px] text-accent-foreground">
                Motion sensors not active
              </div>
            )}
          </div>

          <div className="absolute inset-x-0 top-14 z-10 flex justify-center">
            <select value={destId ?? ''} onChange={(e) => setDestId(e.target.value || null)}
              className="w-4/5 rounded-lg border border-white/30 bg-black/60 px-3 py-1.5 text-[11px] text-white backdrop-blur">
              <option value="" className="text-black">— destination —</option>
              {rooms.map((r) => <option key={r.id} value={r.id} className="text-black">F{r.floor} · {r.name}</option>)}
            </select>
          </div>

          {onStairs && (
            <div className="absolute inset-x-0 top-24 z-10 flex justify-center">
              <div className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground shadow">
                Climbing stairs… {stairStepCount}/12
              </div>
            </div>
          )}

          <div
            onClick={() => setMiniMapExpanded(true)}
            className="absolute bottom-16 right-3 z-20 w-24 h-32 overflow-hidden rounded-lg border-2 border-white/40 shadow-xl bg-card cursor-pointer hover:scale-105 transition-transform"
          >
            {map.plans?.[previewFloor] ? (
              <PlanFloorMap map={map} plan={map.plans[previewFloor]} floor={previewFloor}
                pathIds={pathIds} highlightNodeId={destId} className="size-full" />
            ) : (
              <CustomFloorMap map={map} floor={previewFloor} pathIds={pathIds} highlightNodeId={destId} className="size-full" />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[8px] text-white/80 text-center py-0.5">tap to expand</div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/60 to-transparent p-3">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-1 rounded-md bg-white/20 px-2 py-1 text-[10px] text-white/90">
                {floors.map((f) => (
                  <button key={f} onClick={() => { setPreviewFloor(f); setFloor(f as 1 | 2) }}
                    className={`rounded px-2 py-0.5 font-semibold ${previewFloor === f ? 'bg-white/30 text-white' : 'text-white/60'}`}>
                    F{f}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowCamera(false)}
                className="rounded-lg bg-white/20 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur">
                🗺 2D Map
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`fixed inset-0 z-50 flex flex-col bg-background transition-all duration-300 ease-in-out ${
          miniMapExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <button onClick={() => setMiniMapExpanded(false)}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
            ← Back to AR
          </button>
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-[11px]">
            {floors.map((f) => (
              <button key={f} onClick={() => { setPreviewFloor(f); setFloor(f as 1 | 2) }}
                className={`rounded px-2 py-0.5 font-semibold ${previewFloor === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                F{f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 p-2">
          {map.plans?.[previewFloor] ? (
            <PlanFloorMap map={map} plan={map.plans[previewFloor]} floor={previewFloor}
              pathIds={pathIds} highlightNodeId={destId} className="size-full" />
          ) : (
            <CustomFloorMap map={map} floor={previewFloor} pathIds={pathIds} highlightNodeId={destId} className="size-full" />
          )}
        </div>
      </div>

      {pos && !showCamera && (
        <>
          <section className="border-b border-border bg-muted/40 px-4 py-3">
            <div className="grid grid-cols-4 gap-2 text-xs">
              <Stat label="Floor" value={`F${floor}`} />
              <Stat label="Position" value={`${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}`} />
              <Stat label="Heading" value={`${heading.toFixed(0)}°`} />
              <Stat label="Steps" value={`${stepCount}`} />
            </div>
            {status !== 'granted' && (
              <div className="mt-2 rounded-md bg-accent px-2 py-1 text-center text-[11px] font-medium text-accent-foreground">
                Motion sensors not active. {status === 'denied' ? 'Please allow motion access in browser settings.' : 'Tap to enable sensors.'}
              </div>
            )}
            {onStairs && (
              <div className="mt-2 rounded-md bg-accent px-2 py-1 text-center text-[11px] font-medium text-accent-foreground">
                Climbing stairs… {stairStepCount}/12
              </div>
            )}
            {stairMode && !onStairs && (
              <div className="mt-2 text-center text-[10px] text-muted-foreground">vertical motion detected</div>
            )}
          </section>

          <section className="p-4">
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Where are you going?</label>
            <select value={destId ?? ''} onChange={(e) => setDestId(e.target.value || null)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
              <option value="">— pick a destination —</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>F{r.floor} · {r.name}</option>)}
            </select>
          </section>

          {path && (
            <section className="px-4">
              <div className="rounded-xl border border-border bg-card p-4">
                {arrived ? (
                  <div className="text-center text-sm font-semibold text-primary">You've arrived at {path.dest.name} 🎉</div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="relative size-20 shrink-0">
                      <div className="absolute inset-0 rounded-full bg-primary/10" />
                      <div className="absolute inset-0 flex items-center justify-center"
                        style={{ transform: `rotate(${arrowDeg}deg)` }}>
                        <div className="text-3xl">⬆️</div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">Next</div>
                      <div className="truncate text-sm font-semibold text-foreground">
                        {path.needsStairs ? (floor < path.dest.floor ? 'Take stairs UP' : 'Take stairs DOWN')
                          : `Continue ${path.totalDistance.toFixed(1)} m`}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Destination: F{path.dest.floor} · {path.dest.name}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Map</span>
              <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-[11px]">
                {floors.map((f) => (
                  <button key={f}
                    onClick={() => setPreviewFloor(f)}
                    className={`rounded px-2 py-0.5 font-semibold ${previewFloor === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                    F{f}
                  </button>
                ))}
                <button onClick={() => setFloor((floor === 1 ? 2 : 1) as 1 | 2)}
                  className="ml-1 rounded px-2 py-0.5 text-muted-foreground hover:text-foreground" title="Manually set my floor">
                  set
                </button>
              </div>
            </div>
            <div className="aspect-square w-full overflow-hidden rounded-xl border border-border bg-card">
              {map.plans?.[previewFloor] ? (
                <PlanFloorMap map={map} plan={map.plans[previewFloor]} floor={previewFloor}
                  pathIds={pathIds} highlightNodeId={destId} className="size-full" />
              ) : (
                <CustomFloorMap map={map} floor={previewFloor} pathIds={pathIds} highlightNodeId={destId} className="size-full" />
              )}
            </div>
          </section>

          <section className="px-4 pb-2">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowCamera(true)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">
                📷 AR Camera navigation
              </button>
              <button onClick={() => setShowRescan((c) => !c)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">
                📷 Re-scan sticker
              </button>
            </div>
            {showRescan && (
              <div className="relative mt-2 aspect-video rounded-xl overflow-hidden bg-black">
                <QRScanner active={showRescan} onDecode={handleQRDecode} className="size-full" />
                <button onClick={() => setShowRescan(false)}
                  className="absolute top-2 right-2 rounded-full bg-background/80 px-2 py-1 text-xs text-foreground backdrop-blur">
                  ✕ Cancel
                </button>
              </div>
            )}
          </section>

          <section className="mt-auto grid grid-cols-2 gap-2 p-4">
            <Link to="/my-anchors"
              className="col-span-2 rounded-xl bg-primary px-3 py-3 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              🖨 Print QR stickers for my map
            </Link>
            <Link to="/survey"
              className="rounded-xl border border-border bg-card px-3 py-3 text-center text-sm font-medium text-foreground hover:bg-accent">
              Edit / re-survey
            </Link>
            <button onClick={() => { if (confirm('Delete saved map?')) { clearCustomMap(); setMap(null) } }}
              className="col-span-2 rounded-xl border border-destructive/40 bg-card px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10">
              Delete map
            </button>
          </section>
        </>
      )}

      {!pos && (
        <section className="mt-auto grid grid-cols-2 gap-2 p-4">
          <Link to="/my-anchors"
            className="col-span-2 rounded-xl bg-primary px-3 py-3 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            🖨 Print QR stickers for my map
          </Link>
          <Link to="/survey"
            className="rounded-xl border border-border bg-card px-3 py-3 text-center text-sm font-medium text-foreground hover:bg-accent">
            Edit / re-survey
          </Link>
          <button onClick={() => { if (confirm('Delete saved map?')) { clearCustomMap(); setMap(null) } }}
            className="col-span-2 rounded-xl border border-destructive/40 bg-card px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10">
            Delete map
          </button>
        </section>
      )}

      {pos && showCamera && !miniMapExpanded && (
        <section className="mt-auto grid grid-cols-2 gap-2 p-4">
          <Link to="/my-anchors"
            className="col-span-2 rounded-xl bg-primary px-3 py-3 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            🖨 Print QR stickers for my map
          </Link>
          <Link to="/survey"
            className="rounded-xl border border-border bg-card px-3 py-3 text-center text-sm font-medium text-foreground hover:bg-accent">
            Edit / re-survey
          </Link>
          <button onClick={() => { if (confirm('Delete saved map?')) { clearCustomMap(); setMap(null) } }}
            className="col-span-2 rounded-xl border border-destructive/40 bg-card px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10">
            Delete map
          </button>
        </section>
      )}
    </div>
  )
}

function Header({ name }: { name?: string } = {}) {
  return (
    <header className="flex items-center justify-between border-b border-border px-4 pb-3 pt-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{name ?? 'My building map'}</h1>
        <p className="text-xs text-muted-foreground">Your custom indoor map</p>
      </div>
      <Link to="/" className="text-xs text-muted-foreground underline">Back</Link>
    </header>
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
