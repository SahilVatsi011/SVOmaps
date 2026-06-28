# Navigation Accuracy Improvements — Phase 1

## Overview

Three incremental improvements to reduce PDR drift and make navigation more reliable, especially for custom maps.

---

## Phase 1 — Graph-Based Position Snapping

**Problem:** The PDR position floats freely in continuous space. After a few steps, the dot can drift off the walkable path network (into walls, rooms, outside the building). `nearestNodeIdCM` then snaps to the wrong graph node because the position is far from any correct node.

**Solution:** After each step, snap the position to the nearest point on any walkable edge (line segment between two connected nodes) on the same floor.

**Implementation:**
- `snapToNearestEdgeCM(map, pos, floor)` — brute-force search over all same-floor edges, finds closest point using perpendicular projection onto each segment
- Called from the Nav store's `registerStep` via an injectable `snapFn` callback
- In `my-map.tsx`, a `useEffect` sets `snapFn` whenever a custom map is loaded

**Files changed:**
| File | Change |
|---|---|
| `src/lib/customMap.ts` | Added `snapToNearestEdgeCM()` export |
| `src/store/nav.ts` | Added `snapFn` + `setSnapFn` to store; `registerStep` calls `snapFn` after step |
| `src/routes/my-map.tsx` | `useEffect` sets `snapFn` from map; import `snapToNearestEdgeCM` |

**Benefit:** Keeps the user on the path network at all times. The dot moves along corridors, not through walls. `nearestNodeIdCM` returns far more accurate results.

---

## Phase 2 — Step Length Adaptation

**Problem:** Step length is hardcoded at 0.7 m. Different people walk differently (tall/short, fast/slow). A 10% error in step length × 100 steps = 7 m drift.

**Solution:** Estimate step length from acceleration magnitude using the Weinberg formula:
```
stepLength = K * (peakAccel - valleyAccel)^(1/4)
```
where `K = 0.45` (calibrated for average height).

**Implementation:**
- `magWindow` ref keeps a rolling 20-sample window of total acceleration magnitude
- At each detected step, take the last 8 samples before the peak, compute peak-to-valley difference
- Apply Weinberg formula, clamp result to `[0.3, 1.2]` m
- Pass via optional `stepLengthOverride` parameter to `registerStep`

**Files changed:**
| File | Change |
|---|---|
| `src/hooks/usePDR.ts` | Added `magWindow` ref; computes `stepLenOverride` at each step |
| `src/store/nav.ts` | `registerStep` accepts optional `stepLengthOverride` parameter |

**Benefit:** Step length adapts to the user's gait automatically. Walking fast → longer steps, shuffling → shorter steps.

---

## Phase 3 — Gyroscope Heading Stabilization

**Problem:** Magnetometer compass heading is noisy and jittery, especially indoors near metal structures and electronics. The raw `webkitCompassHeading` can fluctuate ±5-10° even when standing still.

**Solution:** Complementary filter that blends gyroscope short-term prediction with magnetometer long-term correction:
```
heading = 0.88 × gyroPrediction + 0.12 × magnetometer
```

**Implementation:**
- `gyroHeading` ref integrates `rotationRate.alpha` (z-axis rotation, rad/s) from each `devicemotion` event into a continuous heading
- At each `deviceorientation` event, blend gyro heading with raw compass using an 88/12 ratio
- Reset gyro heading to the blended value to prevent long-term gyro drift

**Files changed:**
| File | Change |
|---|---|
| `src/hooks/usePDR.ts` | Added `gyroHeading`, `lastGyroTime`, `gyroInited` refs; gyro integration in `onMotion`; complementary filter in `onOrientation` |

**Benefit:** Heading is smooth between compass updates (gyro fills the gaps). Jitter from magnetic interference is heavily filtered. The compass still corrects long-term drift.

---

## Summary of Changes

| Improvement | Complexity | Impact | Files Touched |
|---|---|---|---|
| Graph position snap | Low | High — immediately keeps dot on path network | `customMap.ts`, `nav.ts`, `my-map.tsx` |
| Step length adaptation | Low | Medium — reduces distance drift per step | `usePDR.ts`, `nav.ts` |
| Gyro heading smoothing | Medium | Medium — smoother compass, less jitter | `usePDR.ts` |

All three are independent and can be enabled/disabled individually by removing the relevant code.
