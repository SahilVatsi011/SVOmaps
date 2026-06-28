# Demo Hospital Map

A 2-floor demo hospital layout for testing the navigation system.

## Layout

```
                  North (y=4)
    Pharmacy      Lab            Office
    (5, 4)       (12, 4)        (19, 4)
        |            |              |
ENTRY---|------5------10-----15-----20-----25-----STAIRS
(0,10)  (5,10) (10,10) (15,10)(20,10)(25,10) (30,10)
        |            |              |            |
    Reception    Exam 1         Exam 2        X-Ray
    (5, 16)     (12, 16)       (19, 16)      (27, 16)
                  South (y=16)
```

Floor 2 has the same corridor layout with Ward A/B/C, ICU, Nurses Station, Supplies, Consultation.

## How to Load

### Option A — Via /plan page (recommended — test corridor tracing)
1. Start dev server: `npm run dev`
2. Open `http://localhost:3000/plan`
3. Click "Choose file" → select `demo-hospital-floorplan.svg`
4. **Calibrate scale:** Click the **📏 Scale A→B** tool
   - Tap on the left end of the corridor (near ENTRANCE)
   - Tap on the right end of the corridor (near STAIRS)
   - Enter `30` in the "meters" box
   - Click **Apply**
5. **Set origin:** Click **📍 Origin** tool → tap on the left edge of the building at corridor height (world 0,0 goes here)
6. **Trace corridors:** Click **🧵 Trace corridor** → click along the corridor centerline every ~30px → click **Finish trace** when done
7. **Drop room nodes:** Click **🚪 Room** → tap on each room area to place room nodes with names
8. **Add stairs:** Click **↕ Stair btm** → tap on stairs area (floor 1) → switch to floor 2 → click **↕ Stair top** → tap on stairs area (floor 2)
9. **Save** → then open `/my-map` to navigate

### Option B — Dev tools paste (quickest — skip corridor tracing)
1. Open the app in your browser
2. Open dev tools → Console
3. Paste:

```js
fetch('/demo-map/demo-hospital.json')
  .then(r => r.json())
  .then(m => localStorage.setItem('wayfinder.customMap.v1', JSON.stringify(m)))
  .then(() => location.href = '/my-map')
```

If running locally on dev server (`localhost:3000`), this works.

### Option C — Manual paste
1. Open the app in your browser
2. Open dev tools → Console
3. Open `demo-hospital.json` in a text editor, copy all
4. Paste:
```js
localStorage.setItem('wayfinder.customMap.v1', JSON.stringify(PASTE_JSON_HERE))
location.href = '/my-map'
```

## How to Navigate

1. Open `/my-map` — the demo map loads
2. **Calibrate:** Select "I'm standing at" → "Main Entrance" and "I'm facing toward" → "Pharmacy" (this sets heading ~90°, eastward into the corridor)
3. Tap **"Calibrate & start"**
4. Pick a destination from the dropdown (e.g., "X-Ray")
5. Walk! The arrow points the way.

## QR Stickers

Go to `/my-anchors` to print QR codes. Key nodes:
- **entrance** — facing east (90°), into the corridor
- **stair_1 / stair_2** — at stairwells for floor transition

QR format: `wfcm:{nodeId}` (e.g., `wfcm:entrance`)
