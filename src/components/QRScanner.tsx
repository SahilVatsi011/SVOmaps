import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>
}

const getBarcodeDetector = () => {
  if (typeof window === 'undefined') return null
  return (window as typeof window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null
}

interface Props {
  onDecode: (text: string) => void
  active: boolean
  className?: string
}

// Lightweight QR scanner. Owns its <video> + offscreen <canvas>; calls onDecode
// each time a QR is read. Caller is responsible for deduping rapid repeat reads.
export function QRScanner({ onDecode, active, className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const startingRef = useRef(false)
  const onDecodeRef = useRef(onDecode)
  const detectorRef = useRef<InstanceType<BarcodeDetectorCtor> | null>(null)
  const scanBusyRef = useRef(false)
  const lastScanAtRef = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [needsTap, setNeedsTap] = useState(false)

  useEffect(() => { onDecodeRef.current = onDecode }, [onDecode])

  // Single effect: own the camera lifecycle. Only re-runs when `active` flips.
  useEffect(() => {
    if (!active) return
    let cancelled = false

    const scanFrame = async (v: HTMLVideoElement, c: HTMLCanvasElement) => {
      scanBusyRef.current = true
      try {
        const sourceW = v.videoWidth
        const sourceH = v.videoHeight
        const maxDim = 900
        const scale = Math.min(1, maxDim / Math.max(sourceW, sourceH))
        const w = Math.max(1, Math.round(sourceW * scale))
        const h = Math.max(1, Math.round(sourceH * scale))
        c.width = w; c.height = h
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (!ctx) return
        ctx.drawImage(v, 0, 0, w, h)

        if (detectorRef.current) {
          try {
            const [barcode] = await detectorRef.current.detect(c)
            if (barcode?.rawValue) {
              onDecodeRef.current(barcode.rawValue)
              return
            }
          } catch {
            detectorRef.current = null
          }
        }

        const img = ctx.getImageData(0, 0, w, h)
        const code = jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' })
        if (code?.data) onDecodeRef.current(code.data)
      } finally {
        scanBusyRef.current = false
      }
    }

    const tick = () => {
      const v = videoRef.current
      const c = canvasRef.current
      const now = performance.now()
      if (v && c && !scanBusyRef.current && now - lastScanAtRef.current > 120 && v.readyState >= v.HAVE_CURRENT_DATA && v.videoWidth > 0) {
        lastScanAtRef.current = now
        void scanFrame(v, c)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    const start = async () => {
      if (startingRef.current || streamRef.current) return
      startingRef.current = true
      setError(null)
      try {
        const Detector = getBarcodeDetector()
        detectorRef.current = Detector ? new Detector({ formats: ['qr_code'] }) : null
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API unavailable. Open over HTTPS in Chrome or Safari.')
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const v = videoRef.current
        if (!v) { stream.getTracks().forEach((t) => t.stop()); streamRef.current = null; return }
        v.srcObject = stream
        v.setAttribute('playsinline', 'true')
        v.muted = true
        try {
          await v.play()
          setNeedsTap(false)
        } catch {
          setNeedsTap(true)
        }
        tick()
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Camera unavailable')
      } finally {
        startingRef.current = false
      }
    }

    start()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      const v = videoRef.current
      if (v) v.srcObject = null
    }
  }, [active])

  const handleTap = async () => {
    const v = videoRef.current
    if (needsTap && v) {
      try { await v.play(); setNeedsTap(false) } catch { /* ignore */ }
    }
  }

  return (
    <div className={className}>
      <video ref={videoRef} className="size-full object-cover" muted playsInline autoPlay />
      <canvas ref={canvasRef} className="hidden" />
      {(needsTap || error) && (
        <button
          onClick={handleTap}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-4 text-center text-xs text-white"
        >
          <span className="text-sm font-semibold">
            {error ? 'Camera error' : 'Tap to enable camera'}
          </span>
          {error && <span className="max-w-xs opacity-80">{error}</span>}
        </button>
      )}
    </div>
  )
}
