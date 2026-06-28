// Demo floor plan with TWO floors. Coordinates in meters per floor. Origin = top-left.
// Heading convention: degrees clockwise from "map north" (up). 0=N, 90=E, 180=S, 270=W.

export type FloorId = 1 | 2
export interface Point { x: number; y: number }

export interface Room {
  id: string
  name: string
  floor: FloorId
  rect: { x: number; y: number; w: number; h: number }
  doorNodeId: string
}

export interface Anchor {
  id: string         // short code stored in the QR (e.g. "A1")
  pos: Point
  floor: FloorId
  headingDeg: number // direction phone is facing when scanning this QR
  label: string
}

export interface NavNode { id: string; pos: Point; floor: FloorId; stair?: boolean }
export interface NavEdge { a: string; b: string; stairs?: boolean }

export const FLOOR_W = 30
export const FLOOR_H = 20

// ───────── Floor 1 ─────────
const ROOMS_F1: Room[] = [
  { id: 'reception', floor: 1, name: 'Reception',  rect: { x: 1,  y: 1,  w: 6, h: 7 }, doorNodeId: 'd_reception' },
  { id: 'meetingA',  floor: 1, name: 'Meeting A',  rect: { x: 8,  y: 1,  w: 6, h: 7 }, doorNodeId: 'd_meetingA' },
  { id: 'meetingB',  floor: 1, name: 'Meeting B',  rect: { x: 15, y: 1,  w: 6, h: 7 }, doorNodeId: 'd_meetingB' },
  { id: 'office1',   floor: 1, name: 'Office 1',   rect: { x: 22, y: 1,  w: 7, h: 7 }, doorNodeId: 'd_office1' },
  { id: 'kitchen',   floor: 1, name: 'Kitchen',    rect: { x: 1,  y: 12, w: 6, h: 7 }, doorNodeId: 'd_kitchen' },
  { id: 'office2',   floor: 1, name: 'Office 2',   rect: { x: 8,  y: 12, w: 6, h: 7 }, doorNodeId: 'd_office2' },
  { id: 'restroom',  floor: 1, name: 'Restroom',   rect: { x: 15, y: 12, w: 6, h: 7 }, doorNodeId: 'd_restroom' },
  { id: 'office3',   floor: 1, name: 'Office 3',   rect: { x: 22, y: 12, w: 5, h: 7 }, doorNodeId: 'd_office3' },
]

const NODES_F1: NavNode[] = [
  { id: 'c1', floor: 1, pos: { x: 4,  y: 10 } },
  { id: 'c2', floor: 1, pos: { x: 11, y: 10 } },
  { id: 'c3', floor: 1, pos: { x: 18, y: 10 } },
  { id: 'c4', floor: 1, pos: { x: 25, y: 10 } },
  { id: 'c0', floor: 1, pos: { x: 1.5, y: 10 } },
  { id: 'd_reception', floor: 1, pos: { x: 4,  y: 8 } },
  { id: 'd_meetingA',  floor: 1, pos: { x: 11, y: 8 } },
  { id: 'd_meetingB',  floor: 1, pos: { x: 18, y: 8 } },
  { id: 'd_office1',   floor: 1, pos: { x: 25, y: 8 } },
  { id: 'd_kitchen',   floor: 1, pos: { x: 4,  y: 12 } },
  { id: 'd_office2',   floor: 1, pos: { x: 11, y: 12 } },
  { id: 'd_restroom',  floor: 1, pos: { x: 18, y: 12 } },
  { id: 'd_office3',   floor: 1, pos: { x: 25, y: 12 } },
  // Stair landing (floor 1)
  { id: 'stair_f1', floor: 1, pos: { x: 28.5, y: 10 }, stair: true },
]

const EDGES_F1: NavEdge[] = [
  { a: 'c0', b: 'c1' }, { a: 'c1', b: 'c2' }, { a: 'c2', b: 'c3' }, { a: 'c3', b: 'c4' },
  { a: 'c4', b: 'stair_f1' },
  { a: 'd_reception', b: 'c1' },
  { a: 'd_meetingA',  b: 'c2' },
  { a: 'd_meetingB',  b: 'c3' },
  { a: 'd_office1',   b: 'c4' },
  { a: 'd_kitchen',   b: 'c1' },
  { a: 'd_office2',   b: 'c2' },
  { a: 'd_restroom',  b: 'c3' },
  { a: 'd_office3',   b: 'c4' },
]

// ───────── Floor 2 ─────────
const ROOMS_F2: Room[] = [
  { id: 'lounge',   floor: 2, name: 'Lounge',      rect: { x: 1,  y: 1,  w: 8, h: 7 }, doorNodeId: 'd_lounge' },
  { id: 'lab',      floor: 2, name: 'Lab',         rect: { x: 10, y: 1,  w: 7, h: 7 }, doorNodeId: 'd_lab' },
  { id: 'classA',   floor: 2, name: 'Class A',     rect: { x: 18, y: 1,  w: 5, h: 7 }, doorNodeId: 'd_classA' },
  { id: 'classB',   floor: 2, name: 'Class B',     rect: { x: 24, y: 1,  w: 5, h: 7 }, doorNodeId: 'd_classB' },
  { id: 'library',  floor: 2, name: 'Library',     rect: { x: 1,  y: 12, w: 10, h: 7 }, doorNodeId: 'd_library' },
  { id: 'serverRm', floor: 2, name: 'Server Room', rect: { x: 12, y: 12, w: 6, h: 7 }, doorNodeId: 'd_serverRm' },
  { id: 'ceo',      floor: 2, name: 'CEO Office',  rect: { x: 19, y: 12, w: 5, h: 7 }, doorNodeId: 'd_ceo' },
  { id: 'rooftop',  floor: 2, name: 'Rooftop',     rect: { x: 25, y: 12, w: 4, h: 7 }, doorNodeId: 'd_rooftop' },
]

const NODES_F2: NavNode[] = [
  { id: 'c1_f2', floor: 2, pos: { x: 5,  y: 10 } },
  { id: 'c2_f2', floor: 2, pos: { x: 13, y: 10 } },
  { id: 'c3_f2', floor: 2, pos: { x: 20, y: 10 } },
  { id: 'c4_f2', floor: 2, pos: { x: 26, y: 10 } },
  { id: 'd_lounge',  floor: 2, pos: { x: 5,  y: 8 } },
  { id: 'd_lab',     floor: 2, pos: { x: 13, y: 8 } },
  { id: 'd_classA',  floor: 2, pos: { x: 20, y: 8 } },
  { id: 'd_classB',  floor: 2, pos: { x: 26, y: 8 } },
  { id: 'd_library', floor: 2, pos: { x: 5,  y: 12 } },
  { id: 'd_serverRm',floor: 2, pos: { x: 14, y: 12 } },
  { id: 'd_ceo',     floor: 2, pos: { x: 21, y: 12 } },
  { id: 'd_rooftop', floor: 2, pos: { x: 26, y: 12 } },
  // Stair landing (floor 2) — same xy as floor 1 stair landing
  { id: 'stair_f2', floor: 2, pos: { x: 28.5, y: 10 }, stair: true },
]

const EDGES_F2: NavEdge[] = [
  { a: 'c1_f2', b: 'c2_f2' }, { a: 'c2_f2', b: 'c3_f2' }, { a: 'c3_f2', b: 'c4_f2' },
  { a: 'c4_f2', b: 'stair_f2' },
  { a: 'd_lounge',  b: 'c1_f2' },
  { a: 'd_lab',     b: 'c2_f2' },
  { a: 'd_classA',  b: 'c3_f2' },
  { a: 'd_classB',  b: 'c4_f2' },
  { a: 'd_library', b: 'c1_f2' },
  { a: 'd_serverRm',b: 'c2_f2' },
  { a: 'd_ceo',     b: 'c3_f2' },
  { a: 'd_rooftop', b: 'c4_f2' },
]

// ───────── Combined ─────────
export const ROOMS: Room[] = [...ROOMS_F1, ...ROOMS_F2]
export const NODES: NavNode[] = [...NODES_F1, ...NODES_F2]
export const EDGES: NavEdge[] = [
  ...EDGES_F1,
  ...EDGES_F2,
  { a: 'stair_f1', b: 'stair_f2', stairs: true },
]

export const ANCHORS: Anchor[] = [
  { id: 'A1', floor: 1, label: 'Entrance',         pos: { x: 1.5, y: 10 },  headingDeg: 90 },
  { id: 'A2', floor: 1, label: 'Mid corridor',     pos: { x: 14.5, y: 10 }, headingDeg: 90 },
  { id: 'A3', floor: 1, label: 'Stairs (F1)',      pos: { x: 28.5, y: 10 }, headingDeg: 0 },
  { id: 'A4', floor: 1, label: 'Kitchen door',     pos: { x: 4,  y: 11.5 }, headingDeg: 180 },
  { id: 'A5', floor: 1, label: 'Office 1 door',    pos: { x: 25, y: 8.5 },  headingDeg: 0 },
  { id: 'B1', floor: 2, label: 'Stairs (F2)',      pos: { x: 28.5, y: 10 }, headingDeg: 270 },
  { id: 'B2', floor: 2, label: 'F2 mid corridor',  pos: { x: 16, y: 10 },   headingDeg: 270 },
  { id: 'B3', floor: 2, label: 'Library door',     pos: { x: 5,  y: 11.5 }, headingDeg: 180 },
]

export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r]))
export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]))
export const ANCHOR_BY_ID = Object.fromEntries(ANCHORS.map((a) => [a.id, a]))

export const STAIR_NODE_BY_FLOOR: Record<FloorId, string> = { 1: 'stair_f1', 2: 'stair_f2' }

export function dist(a: Point, b: Point) {
  const dx = a.x - b.x, dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function bearingDeg(from: Point, to: Point) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const rad = Math.atan2(dx, -dy)
  let deg = (rad * 180) / Math.PI
  if (deg < 0) deg += 360
  return deg
}
