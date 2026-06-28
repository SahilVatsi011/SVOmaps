import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { usePDR } from '@/hooks/usePDR'
import { useNav } from '@/store/nav'
import { useSurvey } from '@/store/survey'
import { CustomFloorMap } from '@/components/CustomFloorMap'
import { floorsInMap, loadCustomMap } from '@/lib/customMap'

export const Route = createFileRoute('/survey')({
  head: () => ({
    meta: [
      { title: 'Survey · Build your own map' },
      { name: 'description', content: 'Walk through your building and drop rooms, waypoints and stairs to build a custom indoor map.' },
    ],
  }),
  component: SurveyPage,
})

function SurveyPage() {
  const navigate = useNavigate()
  const { status, stepCount, rawHeading, stairMode, requestPermission } = usePDR()
  const pos = useNav((s) => s.pos)
  const floor = useNav((s) => s.floor)
  const heading = useNav((s) => s.heading)
  const onStairs = useNav((s) => s.onStairs)
  const stairStepCount = useNav((s) => s.stairStepCount)
  const surveyMode = useNav((s) => s.surveyMode)
  const setSurveyMode = useNav((s) => s.setSurveyMode)
  const calibrate = useNav((s) => s.calibrate)
  const setFloor = useNav((s) => s.setFloor)
  const setStepLength = useNav((s) => s.setStepLength)
  const stepLengthM = useNav((s) => s.stepLengthM)

  const nodes = useSurvey((s) => s.nodes)
  const edges = useSurvey((s) => s.edges)
  const pendingStairBottomId = useSurvey((s) => s.pendingStairBottomId)
  const lastNodeId = useSurvey((s) => s.lastNodeId)
  const beginSurvey = useSurvey((s) => s.beginSurvey)
  const dropRoom = useSurvey((s) => s.dropRoom)
  const dropWaypoint = useSurvey((s) => s.dropWaypoint)
  const dropStairBottom = useSurvey((s) => s.dropStairBottom)
  const dropStairTop = useSurvey((s) => s.dropStairTop)
  const undo = useSurvey((s) => s.undo)
  const clear = useSurvey((s) => s.clear)
  const saveAs = useSurvey((s) => s.saveAs)
  const mapName = useSurvey((s) => s.mapName)
  const setMapName = useSurvey((s) => s.setMapName)

  const [calibrated, setCalibrated] = useState(false)
  const [savedHint, setSavedHint] = useState<string | null>(null)

  // Always operate in survey mode while here
  useEffect(() => {
    setSurveyMode(true)
    return () => setSurveyMode(false)
  }, [setSurveyMode])

  // Detect if existing map already loaded
  const existing = useMemo(() => loadCustomMap(), [])

  async function startSurvey() {
    await requestPermission()
    // Use whatever raw heading we currently have (0 if none yet). User is asked to face their starting forward direction.
    calibrate(rawHeading || 0, { pos: { x: 0, y: 0 }, floor: 1, headingDeg: 0 })
    beginSurvey()
    setCalibrated(true)
  }

  function recalibrateHeading() {
    // Re-align so that "current facing" becomes the bearing toward last waypoint (or just zero again)
    calibrate(rawHeading || 0, { pos: pos ?? { x: 0, y: 0 }, floor, headingDeg: heading })
  }

  function onDropRoom() {
    const name = window.prompt('Room name (e.g. "Living Room", "Class 201"):')
    if (name == null) return
    dropRoom(name)
  }

  function onSave() {
    const name = window.prompt('Name your map:', mapName) ?? mapName
    setMapName(name)
    saveAs(name)
    setSavedHint('Saved! You can now navigate it.')
    setTimeout(() => setSavedHint(null), 2500)
  }

  const liveMap = { nodes, edges }
  const presentFloors = nodes.length ? floorsInMap({ name: '', createdAt: 0, nodes, edges }) : [floor]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 pb-3 pt-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Survey your building</h1>
          <p className="text-xs text-muted-foreground">Walk room to room — drop a point at each one.</p>
        </div>
        <Link to="/" className="text-xs text-muted-foreground underline">Back</Link>
      </header>

      {!calibrated && (
        <section className="space-y-3 p-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">How it works</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Stand at your starting point (e.g. main entrance).</li>
              <li>Face the direction you'll walk first, then tap <b>Calibrate & Start</b>.</li>
              <li>Walk to each room. Tap <b>Drop room</b> when you arrive and name it.</li>
              <li>At stairs: tap <b>Mark stairs (bottom)</b>, walk up, tap <b>Mark stairs (top)</b>.</li>
              <li>Continue mapping floor 2. Tap <b>Save map</b> when finished.</li>
            </ol>
          </div>
          {existing && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
              You already have a saved map: <b>{existing.name}</b> ({existing.nodes.length} points).{' '}
              <button className="underline" onClick={() => navigate({ to: '/my-map' })}>Open it</button> or start over below.
            </div>
          )}
          <button
            onClick={startSurvey}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Calibrate & Start
          </button>
          {status === 'denied' && (
            <p className="text-xs text-destructive">Motion permission denied — survey needs your phone's sensors.</p>
          )}
        </section>
      )}

      {calibrated && (
        <>
          <section className="border-b border-border bg-muted/40 px-4 py-3">
            <div className="grid grid-cols-4 gap-2 text-xs">
              <Stat label="Floor" value={`F${floor}`} />
              <Stat label="Position" value={pos ? `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}` : '—'} />
              <Stat label="Steps" value={`${stepCount}`} />
              <Stat label="Heading" value={`${heading.toFixed(0)}°`} />
            </div>
            {onStairs && (
              <div className="mt-2 rounded-md bg-accent px-2 py-1 text-center text-[11px] font-medium text-accent-foreground">
                Climbing stairs… {stairStepCount}/12 — floor will auto-switch
              </div>
            )}
            {stairMode && !onStairs && (
              <div className="mt-2 text-center text-[10px] text-muted-foreground">vertical motion detected</div>
            )}
          </section>

          <section className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Live map preview</span>
              <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-[11px]">
                {presentFloors.map((f) => (
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
            </div>
            <div className="aspect-square w-full overflow-hidden rounded-xl border border-border bg-card">
              <CustomFloorMap map={liveMap} floor={floor} className="size-full" />
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {nodes.filter((n) => n.floor === floor).length} points on F{floor} · {nodes.length} total
            </p>
          </section>

          <section className="space-y-2 px-4 pb-2">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onDropRoom}
                className="rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                📍 Drop room
              </button>
              <button onClick={() => dropWaypoint()}
                className="rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium text-foreground hover:bg-accent">
                🚦 Drop waypoint
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => dropStairBottom()}
                disabled={!!pendingStairBottomId}
                className="rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50">
                🪜 Stairs (bottom)
              </button>
              <button onClick={() => dropStairTop()}
                disabled={!pendingStairBottomId}
                className="rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50">
                🪜 Stairs (top)
              </button>
            </div>
            {pendingStairBottomId && (
              <p className="text-center text-[11px] text-accent-foreground/80">
                Stair bottom marked — now climb the stairs and tap "Stairs (top)" at the landing.
              </p>
            )}

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button onClick={() => setFloor((floor === 1 ? 2 : 1) as 1 | 2)}
                className="rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground hover:bg-accent">
                Switch floor
              </button>
              <button onClick={undo}
                className="rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground hover:bg-accent">
                ↩ Undo
              </button>
              <button onClick={recalibrateHeading}
                className="rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground hover:bg-accent">
                Re-zero compass
              </button>
            </div>

            <details className="rounded-lg border border-border bg-card p-3 text-xs">
              <summary className="cursor-pointer font-medium text-foreground">Advanced</summary>
              <label className="mt-2 block text-muted-foreground">
                Step length (m): {stepLengthM.toFixed(2)}
                <input type="range" min={0.4} max={1.0} step={0.05}
                  value={stepLengthM}
                  onChange={(e) => setStepLength(parseFloat(e.target.value))}
                  className="mt-1 w-full" />
              </label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Tip: tweak so a known walk distance comes out right on the map.
              </p>
            </details>
          </section>

          <section className="mt-auto grid grid-cols-2 gap-2 p-4">
            <button onClick={() => { if (confirm('Clear all survey points?')) clear() }}
              className="rounded-xl border border-destructive/40 bg-card px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10">
              🗑 Clear
            </button>
            <button onClick={onSave}
              disabled={nodes.length === 0}
              className="rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              💾 Save map
            </button>
            {savedHint && (
              <div className="col-span-2 rounded-lg bg-accent/40 px-3 py-2 text-center text-xs text-accent-foreground">
                {savedHint} <Link to="/my-map" className="ml-2 underline">Open my map →</Link>
              </div>
            )}
            <p className="col-span-2 text-center text-[11px] text-muted-foreground">
              Last point: {lastNodeId ? nodes.find((n) => n.id === lastNodeId)?.name ?? lastNodeId : 'none'}
            </p>
          </section>
        </>
      )}
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
