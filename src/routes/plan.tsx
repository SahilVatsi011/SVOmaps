import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PlanFloorMap } from '@/components/PlanFloorMap'
import { usePDR } from '@/hooks/usePDR'
import { useNav } from '@/store/nav'
import {
  type CMEdge, type CMNode, type CMPoint, type CustomMap, type Plan,
  loadCustomMap, pxToMeters, saveCustomMap, buildDenseGraph,
} from '@/lib/customMap'

export const Route = createFileRoute('/plan')({
  head: () => ({
    meta: [
      { title: 'Upload your floor plan' },
      { name: 'description', content: 'Upload your own building map (image or PDF), set its scale, and drop rooms by tapping or walking.' },
    ],
  }),
  component: PlanPage,
})

type Tool = 'room' | 'waypoint' | 'stair-bottom' | 'stair-top' | 'scale-a' | 'scale-b' | 'origin' | 'corridor'

const STORAGE_KEY_DRAFT = 'wayfinder.planDraft.v1'

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`
}

interface Draft {
  mapName: string
  plans: Record<number, Plan>
  nodes: CMNode[]
  edges: CMEdge[]
  corridorTraces: Record<number, CMPoint[][]>  // per floor: array of polylines
}

function loadDraft(): Draft | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_DRAFT) || 'null') } catch { return null }
}
function saveDraft(d: Draft) {
  try { localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(d)) } catch { /* quota */ }
}

async function fileToImageDataUrl(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  if (file.type === 'application/pdf') {
    // Lazy-load pdf.js
    const pdfjs = await import('pdfjs-dist')
    // Set worker from CDN (matches installed version)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(pdfjs as any).GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    const buf = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: buf }).promise
    const page = await pdf.getPage(1)
    // Render at ~1600 px wide
    const v1 = page.getViewport({ scale: 1 })
    const scale = Math.min(2.5, 1600 / v1.width)
    const vp = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height)
    const ctx = canvas.getContext('2d')!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx, viewport: vp, canvas } as any).promise
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height }
  }
  // Image
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
  const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('image load failed'))
    img.src = dataUrl
  })
  // Down-scale very large images to stay under localStorage quota.
  if (dims.w > 2000) {
    const scale = 2000 / dims.w
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(dims.w * scale); canvas.height = Math.round(dims.h * scale)
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    await new Promise((res) => { img.onload = res; img.src = dataUrl })
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height }
  }
  return { dataUrl, width: dims.w, height: dims.h }
}

function PlanPage() {
  const { rawHeading, requestPermission, status } = usePDR()
  const navPos = useNav((s) => s.pos)
  const navFloor = useNav((s) => s.floor)
  const setSurveyMode = useNav((s) => s.setSurveyMode)
  const calibrate = useNav((s) => s.calibrate)

  const [draft, setDraft] = useState<Draft>(() =>
    loadDraft() ?? (() => {
      const existing = loadCustomMap()
      return existing
        ? { mapName: existing.name, plans: existing.plans ?? {}, nodes: existing.nodes, edges: existing.edges, corridorTraces: {} }
        : { mapName: 'My Building', plans: {}, nodes: [], edges: [], corridorTraces: {} }
    })()
  )
  const [floor, setFloor] = useState<number>(1)
  const [tool, setTool] = useState<Tool>('room')
  const [pendingName, setPendingName] = useState('')
  const [scaleA, setScaleA] = useState<{ x: number; y: number } | null>(null)
  const [scaleB, setScaleB] = useState<{ x: number; y: number } | null>(null)
  const [scaleDistanceM, setScaleDistanceM] = useState('5')
  const [manualMPerPx, setManualMPerPx] = useState('')
  const [walking, setWalking] = useState(false)
  const [lastNodeId, setLastNodeId] = useState<string | null>(null)
  const [pendingStairBottomId, setPendingStairBottomId] = useState<string | null>(null)
  const [currentTrace, setCurrentTrace] = useState<CMPoint[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { saveDraft(draft) }, [draft])
  useEffect(() => {
    if (walking) { setSurveyMode(true); return () => setSurveyMode(false) }
  }, [walking, setSurveyMode])

  const plan: Plan | undefined = draft.plans[floor]
  const floors = useMemo(() => {
    const s = new Set<number>(Object.keys(draft.plans).map(Number))
    for (const n of draft.nodes) s.add(n.floor)
    s.add(floor)
    return [...s].sort((a, b) => a - b)
  }, [draft, floor])

  const mapForView: CustomMap = useMemo(
    () => ({ name: draft.mapName, createdAt: Date.now(), nodes: draft.nodes, edges: draft.edges, plans: draft.plans }),
    [draft],
  )

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMessage('Loading file…')
    try {
      const { dataUrl, width, height } = await fileToImageDataUrl(file)
      const existing = draft.plans[floor]
      const newPlan: Plan = existing
        ? { ...existing, imageDataUrl: dataUrl, widthPx: width, heightPx: height }
        : { imageDataUrl: dataUrl, widthPx: width, heightPx: height, mPerPx: 0.05, originPx: { x: width / 2, y: height / 2 } }
      setDraft((d) => ({ ...d, plans: { ...d.plans, [floor]: newPlan } }))
      setMessage(`Loaded ${file.name} · ${width}×${height}px`)
    } catch (err) {
      setMessage(`Failed: ${(err as Error).message}`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function updatePlan(p: Partial<Plan>) {
    if (!plan) return
    setDraft((d) => ({ ...d, plans: { ...d.plans, [floor]: { ...plan, ...p } } }))
  }

  function applyManualScale() {
    const v = parseFloat(manualMPerPx)
    if (!v || v <= 0) { setMessage('Enter a positive meters/pixel value.'); return }
    updatePlan({ mPerPx: v })
    setMessage(`Scale set: ${v.toFixed(5)} m/px`)
  }

  function applyTwoPointScale() {
    if (!scaleA || !scaleB) { setMessage('Tap two points on the map first.'); return }
    const meters = parseFloat(scaleDistanceM)
    if (!meters || meters <= 0) { setMessage('Enter a real-world distance in meters.'); return }
    const dx = scaleA.x - scaleB.x, dy = scaleA.y - scaleB.y
    const distPx = Math.sqrt(dx * dx + dy * dy)
    if (distPx < 4) { setMessage('Points are too close together.'); return }
    const m = meters / distPx
    updatePlan({ mPerPx: m })
    setManualMPerPx(m.toFixed(5))
    setMessage(`Scale: ${meters}m / ${distPx.toFixed(1)}px = ${m.toFixed(5)} m/px`)
    setScaleA(null); setScaleB(null); setTool('room')
  }

  function addNode(kind: CMNode['kind'], pos: { x: number; y: number }, name?: string): CMNode {
    const node: CMNode = { id: uid(kind), pos, floor, kind, name: kind === 'room' ? (name || 'Room') : undefined }
    if (kind === 'stair' && pendingStairBottomId) {
      node.stairPairId = pendingStairBottomId
    }
    setDraft((d) => {
      const newEdges = [...d.edges]
      if (lastNodeId) newEdges.push({ a: lastNodeId, b: node.id })
      let nodes = [...d.nodes, node]
      if (kind === 'stair' && pendingStairBottomId) {
        nodes = nodes.map((n) => n.id === pendingStairBottomId ? { ...n, stairPairId: node.id } : n)
        newEdges.push({ a: pendingStairBottomId, b: node.id, stairs: true })
      }
      return { ...d, nodes, edges: newEdges }
    })
    setLastNodeId(node.id)
    return node
  }

  function handlePixelClick(px: number, py: number) {
    if (!plan) return
    if (tool === 'scale-a') { setScaleA({ x: px, y: py }); setTool('scale-b'); return }
    if (tool === 'scale-b') { setScaleB({ x: px, y: py }); return }
    if (tool === 'origin') {
      updatePlan({ originPx: { x: px, y: py } })
      setMessage('Origin set. World (0,0) is here.')
      setTool('room')
      return
    }
    const meters = pxToMeters(plan, px, py)
    if (tool === 'corridor') {
      setCurrentTrace((prev) => [...prev, meters])
      setMessage(`Corridor point ${currentTrace.length + 1} added. Click "Finish trace" when done.`)
      return
    }
    if (tool === 'room') {
      const name = pendingName.trim() || prompt('Room name?', 'Room ' + (draft.nodes.filter((n) => n.kind === 'room').length + 1)) || ''
      if (!name) return
      addNode('room', meters, name)
      setPendingName('')
    } else if (tool === 'waypoint') {
      addNode('waypoint', meters)
    } else if (tool === 'stair-bottom') {
      const n = addNode('stair', meters)
      setPendingStairBottomId(n.id)
      setMessage('Stair bottom dropped. Switch floor, then place "Stair top" on the other floor.')
    } else if (tool === 'stair-top') {
      if (!pendingStairBottomId) { setMessage('Place a stair bottom first.'); return }
      addNode('stair', meters)
      setPendingStairBottomId(null)
      setMessage('Stairs linked between floors ✓')
    }
  }

  async function dropAtMyLocation() {
    if (!plan || !navPos) { setMessage('No PDR position. Calibrate walking first.'); return }
    const m = navPos
    if (tool === 'room') {
      const name = pendingName.trim() || prompt('Room name?', 'Room') || ''
      if (!name) return
      addNode('room', m, name); setPendingName('')
    } else if (tool === 'waypoint') addNode('waypoint', m)
    else if (tool === 'stair-bottom') { const n = addNode('stair', m); setPendingStairBottomId(n.id) }
    else if (tool === 'stair-top') { if (pendingStairBottomId) { addNode('stair', m); setPendingStairBottomId(null) } }
  }

  async function startWalking() {
    if (!plan) return
    await requestPermission()
    // Calibrate at the plan's origin, heading 0 = up on map.
    calibrate(rawHeading || 0, { pos: { x: 0, y: 0 }, floor: floor as 1 | 2, headingDeg: 0 })
    setWalking(true)
    setMessage('Walking mode on. Stand at the map origin and walk; the dot will move on the plan.')
  }

  function undoLast() {
    setDraft((d) => {
      if (!d.nodes.length) return d
      const lastN = d.nodes[d.nodes.length - 1]
      return {
        ...d,
        nodes: d.nodes.slice(0, -1),
        edges: d.edges.filter((e) => e.a !== lastN.id && e.b !== lastN.id),
      }
    })
    setLastNodeId(null)
    setPendingStairBottomId(null)
  }

  function save() {
    const dense = buildDenseGraph(draft.nodes, draft.edges, draft.corridorTraces)
    const map: CustomMap = {
      name: draft.mapName || 'My Building',
      createdAt: Date.now(),
      nodes: dense.nodes,
      edges: dense.edges,
      plans: draft.plans,
    }
    try {
      saveCustomMap(map)
      setMessage(`Saved ✓ ${dense.nodes.length} nodes · ${dense.edges.length} edges (${draft.nodes.length} manual + ${dense.nodes.length - draft.nodes.length} auto)`)
    } catch (err) {
      setMessage(`Save failed (storage too large?): ${(err as Error).message}`)
    }
  }

  const markers = [
    ...(scaleA ? [{ x: scaleA.x, y: scaleA.y, color: 'var(--color-destructive)', label: 'A' }] : []),
    ...(scaleB ? [{ x: scaleB.x, y: scaleB.y, color: 'var(--color-destructive)', label: 'B' }] : []),
    ...(plan ? [{ x: plan.originPx.x, y: plan.originPx.y, color: 'var(--color-primary)', label: '0,0' }] : []),
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 pb-3 pt-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Upload your floor plan</h1>
          <p className="text-xs text-muted-foreground">Image or PDF · set scale · tap or walk to drop rooms</p>
        </div>
        <Link to="/" className="text-xs text-muted-foreground underline">Back</Link>
      </header>

      <section className="space-y-3 border-b border-border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={draft.mapName}
            onChange={(e) => setDraft((d) => ({ ...d, mapName: e.target.value }))}
            placeholder="Building name"
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-[11px]">
            {floors.map((f) => (
              <button key={f} onClick={() => setFloor(f)}
                className={`rounded px-2 py-1 font-semibold ${floor === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                F{f}
              </button>
            ))}
            <button onClick={() => setFloor(Math.max(...floors) + 1)}
              className="rounded px-2 py-1 text-muted-foreground hover:text-foreground">+ floor</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onUpload}
            className="text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground" />
          {plan && (
            <span className="text-[11px] text-muted-foreground">
              {plan.widthPx}×{plan.heightPx}px · {plan.mPerPx.toFixed(4)} m/px
            </span>
          )}
        </div>
      </section>

      {plan ? (
        <>
          <section className="border-b border-border p-3">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <ToolBtn active={tool === 'origin'} onClick={() => setTool('origin')}>📍 Origin</ToolBtn>
              <ToolBtn active={tool === 'scale-a' || tool === 'scale-b'} onClick={() => { setTool('scale-a'); setScaleA(null); setScaleB(null) }}>📏 Scale A→B</ToolBtn>
              <ToolBtn active={tool === 'room'} onClick={() => setTool('room')}>🚪 Room</ToolBtn>
              <ToolBtn active={tool === 'waypoint'} onClick={() => setTool('waypoint')}>• Waypoint</ToolBtn>
              <ToolBtn active={tool === 'stair-bottom'} onClick={() => setTool('stair-bottom')}>↕ Stair btm</ToolBtn>
              <ToolBtn active={tool === 'stair-top'} onClick={() => setTool('stair-top')}>↕ Stair top</ToolBtn>
              <ToolBtn active={tool === 'corridor'} onClick={() => { setTool('corridor'); setCurrentTrace([]) }}>🧵 Trace corridor</ToolBtn>
            </div>

            {(tool === 'room') && (
              <input value={pendingName} onChange={(e) => setPendingName(e.target.value)}
                placeholder="Optional: pre-fill next room name"
                className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            )}

            {tool === 'corridor' && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  {currentTrace.length === 0
                    ? 'Click on the map to trace corridor centerline'
                    : `${currentTrace.length} points traced`}
                </span>
                {currentTrace.length >= 2 && (
                  <button onClick={() => {
                    setDraft((d) => ({
                      ...d,
                      corridorTraces: {
                        ...d.corridorTraces,
                        [floor]: [...(d.corridorTraces[floor] || []), [...currentTrace]],
                      },
                    }))
                    setCurrentTrace([])
                    setMessage(`Corridor ${(draft.corridorTraces[floor]?.length ?? 0) + 1} saved ✓`)
                  }}
                    className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Finish trace
                  </button>
                )}
                {currentTrace.length > 0 && (
                  <button onClick={() => setCurrentTrace((p) => p.slice(0, -1))}
                    className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-accent">
                    Undo point
                  </button>
                )}
                <button onClick={() => setCurrentTrace([])}
                  className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-accent">
                  Clear
                </button>
              </div>
            )}

            {(tool === 'scale-a' || tool === 'scale-b') && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  {tool === 'scale-a' ? 'Tap point A on the map' : scaleB ? 'Adjust then apply' : 'Tap point B on the map'}
                </span>
                <input value={scaleDistanceM} onChange={(e) => setScaleDistanceM(e.target.value)}
                  inputMode="decimal" placeholder="meters"
                  className="w-24 rounded-md border border-input bg-background px-2 py-1 text-xs" />
                <span className="text-muted-foreground">m between A & B</span>
                <button onClick={applyTwoPointScale} disabled={!scaleA || !scaleB}
                  className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50">Apply</button>
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Or set manually:</span>
              <input value={manualMPerPx} onChange={(e) => setManualMPerPx(e.target.value)}
                inputMode="decimal" placeholder="m/px (e.g. 0.025)"
                className="w-32 rounded-md border border-input bg-background px-2 py-1 text-xs" />
              <button onClick={applyManualScale}
                className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-accent">Apply</button>
            </div>
          </section>

          <section className="p-3">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <PlanFloorMap
                map={mapForView} plan={plan} floor={floor}
                onPixelClick={handlePixelClick}
                markers={markers}
                showUser={walking && navFloor === floor}
                className="block w-full"
              />
            </div>
            {message && (
              <div className="mt-2 rounded-md bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">{message}</div>
            )}
          </section>

          <section className="space-y-2 border-t border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              {!walking ? (
                <button onClick={startWalking}
                  className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent/80">
                  🚶 Start walking mode
                </button>
              ) : (
                <>
                  <button onClick={dropAtMyLocation}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                    Drop {tool} at my location
                  </button>
                  <button onClick={() => setWalking(false)}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent">
                    Stop walking
                  </button>
                  <span className="text-[11px] text-muted-foreground">
                    Pos: {navPos ? `${navPos.x.toFixed(1)}, ${navPos.y.toFixed(1)}m` : '—'}
                  </span>
                </>
              )}
              {status === 'denied' && <span className="text-[11px] text-destructive">Motion permission denied.</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={undoLast}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent">↶ Undo last point</button>
              <button onClick={() => setLastNodeId(null)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent">Break link (start new path)</button>
              <span className="text-[11px] text-muted-foreground">
                {draft.nodes.length} nodes · {draft.edges.length} edges
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={save}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                💾 Save map
              </button>
              <Link to="/my-map"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
                Open my map →
              </Link>
              <button onClick={() => { if (confirm('Discard this draft?')) { localStorage.removeItem(STORAGE_KEY_DRAFT); setDraft({ mapName: 'My Building', plans: {}, nodes: [], edges: [], corridorTraces: {} }) } }}
                className="rounded-lg border border-destructive/40 bg-card px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10">
                Clear draft
              </button>
            </div>
          </section>
        </>
      ) : (
        <section className="p-6 text-center text-sm text-muted-foreground">
          Upload a floor plan image or PDF above to begin mapping floor F{floor}.
        </section>
      )}
    </div>
  )
}

function ToolBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg px-2 py-2 text-xs font-medium ${active ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground hover:bg-accent'}`}>
      {children}
    </button>
  )
}
