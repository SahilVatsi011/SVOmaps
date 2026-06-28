import { useEffect, useRef, useState } from 'react'
import { useNav } from '@/store/nav'

type IOSMotionEvent = DeviceMotionEvent
type IOSMotionCtor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }
type IOSOrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

export type SensorStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'

export function usePDR() {
  const [status, setStatus] = useState<SensorStatus>('idle')
  const [stepCount, setStepCount] = useState(0)
  const [rawHeading, setRawHeading] = useState(0)
  const [stairMode, setStairMode] = useState(false)

  const lastPeakAt = useRef(0)
  const lastStepAt = useRef(0)
  const accelHistory = useRef<number[]>([])
  const baseline = useRef(9.8)
  // Gravity-axis variance tracker — high while climbing stairs.
  const vertHistory = useRef<number[]>([])
  // Low-pass of gravity vector (used to extract user vertical accel).
  const gravity = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 9.8 })
  // Step length estimation: accel magnitudes around each step peak
  const magWindow = useRef<number[]>([])

  const registerStep = useNav((s) => s.registerStep)
  const updateRawCompass = useNav((s) => s.updateRawCompass)

  async function requestPermission() {
    setStatus('requesting')
    try {
      const M = DeviceMotionEvent as IOSMotionCtor
      const O = DeviceOrientationEvent as IOSOrientationCtor
      if (typeof M.requestPermission === 'function') {
        const r = await M.requestPermission()
        if (r !== 'granted') return setStatus('denied')
      }
      if (typeof O.requestPermission === 'function') {
        const r = await O.requestPermission()
        if (r !== 'granted') return setStatus('denied')
      }
      setStatus('granted')
    } catch {
      setStatus('denied')
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('DeviceMotionEvent' in window)) { setStatus('unsupported'); return }
  }, [])

  useEffect(() => {
    if (status !== 'granted') return

    function onMotion(e: IOSMotionEvent) {
      const a = e.accelerationIncludingGravity
      if (!a) return
      const ax = a.x ?? 0, ay = a.y ?? 0, az = a.z ?? 0

      // Update low-pass gravity estimate
      const g = gravity.current
      g.x = g.x * 0.92 + ax * 0.08
      g.y = g.y * 0.92 + ay * 0.08
      g.z = g.z * 0.92 + az * 0.08
      const gMag = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z) || 9.8

      // User acceleration = total − gravity
      const ux = ax - g.x, uy = ay - g.y, uz = az - g.z
      // Project onto gravity unit vector → vertical component (signed)
      const vert = (ux * g.x + uy * g.y + uz * g.z) / gMag

      // Step detection on total-acc magnitude (unchanged)
      const mag = Math.sqrt(ax * ax + ay * ay + az * az)
      baseline.current = baseline.current * 0.95 + mag * 0.05
      const delta = mag - baseline.current
      const buf = accelHistory.current
      buf.push(delta)
      if (buf.length > 10) buf.shift()

      // Track vertical-component amplitude history
      const vbuf = vertHistory.current
      vbuf.push(Math.abs(vert))
      if (vbuf.length > 40) vbuf.shift()

      const now = performance.now()
      if (
        buf.length >= 5 &&
        delta > 1.2 &&
        delta >= Math.max(...buf.slice(-5)) &&
        now - lastPeakAt.current > 320
      ) {
        lastPeakAt.current = now
        // Compute recent vertical RMS and cadence to decide stair vs flat.
        const vRMS = Math.sqrt(vbuf.reduce((s, v) => s + v * v, 0) / vbuf.length)
        const cadence = now - lastStepAt.current
        lastStepAt.current = now
        // Heuristic: stair steps have stronger sustained vertical motion + slower cadence.
        const isStair = vRMS > 1.6 && cadence > 480 && cadence < 1400
        setStairMode(isStair)

        // Phase 2 — step length estimation
        const stepMagWindow = magWindow.current.slice(-8)
        let stepLenOverride: number | undefined
        if (stepMagWindow.length >= 3) {
          const peak = Math.max(...stepMagWindow)
          const valley = Math.min(...stepMagWindow)
          const estLen = 0.45 * Math.pow(peak - valley, 0.25)
          stepLenOverride = Math.max(0.3, Math.min(1.2, estLen))
        }

        setStepCount((c) => c + 1)
        registerStep(isStair, stepLenOverride)
      }
      // Keep a rolling window of mag for step length estimation
      const mw = magWindow.current
      mw.push(mag)
      if (mw.length > 20) mw.shift()
    }

    function onOrientation(e: DeviceOrientationEvent) {
      const w = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
      let heading: number | null = null
      if (typeof w === 'number') heading = w
      else if (typeof e.alpha === 'number') heading = (360 - e.alpha) % 360
      if (heading == null) return
      setRawHeading(heading)
      updateRawCompass(heading)
    }

    window.addEventListener('devicemotion', onMotion)
    window.addEventListener('deviceorientation', onOrientation, true)
    return () => {
      window.removeEventListener('devicemotion', onMotion)
      window.removeEventListener('deviceorientation', onOrientation, true)
    }
  }, [status, registerStep, updateRawCompass])

  return { status, stepCount, rawHeading, stairMode, requestPermission }
}
