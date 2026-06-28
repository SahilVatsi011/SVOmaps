# Indoor Navigation Improvement — Floor-Plan-Constrained PDR

## The Problem

Current PDR (accelerometer + compass) drifts 5-10% of distance walked. Without frequent recalibration (QR stickers every 5-8m), position error after 200m of walking is 10-20m — too large for room-level navigation.

QR stickers at every intersection don't scale to real buildings (hospitals, airports, malls):
- Hundreds of stickers per floor unmaintainable
- Cleaning crews remove them
- Looks unprofessional
- User must keep camera on to auto-detect

## The Solution

Use the **floor plan image itself** as the position constraint. The uploaded floor plan tells us exactly where corridors, walls, and rooms are. After each PDR step, we don't let the position float freely — we constrain it to the walkable corridor network defined by the floor plan.

### Three Corrections Replacing Stickers

```
Without floor plan:
  PDR → drifts into walls → wrong position → wrong directions

With floor plan:
  PDR → snap to corridor centerline → correct heading toward corridor direction
       → position never leaves walkable network → accurate guidance
```

#### 1. Corridor Centerline Snapping (Position)
After each step, snap the position to the nearest point on a corridor centerline edge. The corridor network is auto-subdivided into 2m segments so the snap distance is never > 1m.

**Already implemented:** `snapToNearestEdgeCM()` in `src/lib/customMap.ts`

#### 2. Corridor-Constrained Heading
When walking along a corridor, the heading should roughly match the corridor's direction. If the compass drifts 15° while walking down a straight corridor, we gently pull it back (15% blend toward corridor direction).

**Implemented:** `headingCorrectionFn` in Nav store, `nearestEdgeDirection()` in `customMap.ts`

#### 3. Dense Waypoint Graph
Edges between user-placed nodes can be 20-40m long. Snapping to the middle of a 40m edge is inaccurate. We auto-subdivide all edges into 2m segments by generating intermediate waypoint nodes.

**Implemented:** `subdivideEdge()`, `buildDenseGraph()` in `src/lib/customMap.ts`

## Map Creation Workflow (For Building Managers)

```
1. Get the building's floor plan PDF from the architect
2. Upload to /plan → calibrate pixel-to-meter scale
3. Tap to place room nodes at each room on the image
4. Use "Trace corridor" tool: click along corridor centerlines
   → click path of points along each corridor
   → click "Finish trace" to save each corridor
5. Save → system auto-generates waypoints every 2m along all corridors
6. Print 2-3 QR stickers at main entrances only
```

## How Navigation Works (Runtime)

```
1. User scans QR at building entrance → calibrated at (x, y, heading)
2. Walk normally with phone in pocket/bag (PDR runs in background)
3. Each step:
   a. PDR estimates new position from step length + heading
   b. Heading gently corrected toward corridor direction (±45° max)
   c. Position snapped to nearest corridor centerline point
   d. Position + heading updated in store
4. At corridor intersections:
   - Pathfinding tells you which corridor to take
   - Heading change detected → position snaps to intersection node
5. Arrive at destination when position is within 2m of target room
```

## Zero Infrastructure Requirements

| Requirement | Status |
|---|---|
| Floor plan image | ✅ From architect (PDF or image) |
| QR stickers | ✅ 2-3 at building entrances only |
| Server | ❌ None — all client-side |
| Internet | ❌ Not required |
| Battery | 🔋 PDR only — lasts hours |
| Phone model | ✅ Any phone with accelerometer + compass |
| Special permissions | ✅ Only motion sensors (no camera needed during navigation) |

## Files Changed

| File | What |
|---|---|
| `src/lib/customMap.ts` | `subdivideEdge()`, `buildDenseGraph()`, `nearestEdgeDirection()` |
| `src/store/nav.ts` | `headingCorrectionFn` + `setHeadingCorrectionFn`, wired into `registerStep` |
| `src/routes/plan.tsx` | "Trace corridor" tool, `corridorTraces` in Draft, `buildDenseGraph()` on save |
| `src/routes/my-map.tsx` | Wires `headingCorrectionFn` + `snapFn` from loaded map |

## Comparison to Alternatives

| Approach | Infrastructure | Accuracy | Battery | Phone req | Scalability |
|---|---|---|---|---|---|
| **This (PDR + floor plan)** | None | 2-5m | Hours | Any | ✅ Whole hospital |
| WebXR AR tracking | None | 1-2m | 15-20 min | Flagship | ❌ Thermal limits |
| BLE beacons | 1 per 8m | 3-5m | Hours | Any | ❌ 1000+ beacons |
| WiFi fingerprinting | None | 5-15m | Hours | Any | ❌ Re-survey needed |
| QR stickers every 8m | 50+ per floor | 1-2m | Hours | Any | ❌ Maintenance nightmare |

## Future Enhancements

- **Intersection lock:** When heading changes by ~90° at an intersection, snap position to intersection node and reset heading
- **Auto-generation:** From a marked-up floor plan image, auto-detect corridors (flood-fill walkable areas) and generate the graph
- **Floor transition detection:** Use barometric pressure change (from device) to detect floor transitions without stairs
