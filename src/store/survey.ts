import { create } from 'zustand'
import type { CMEdge, CMNode, CustomMap, CMFloor } from '@/lib/customMap'
import { saveCustomMap } from '@/lib/customMap'
import { useNav } from '@/store/nav'

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`
}

interface SurveyState {
  nodes: CMNode[]
  edges: CMEdge[]
  lastNodeId: string | null
  pendingStairBottomId: string | null // node id awaiting "top" pairing
  mapName: string
  history: Array<{ nodes: CMNode[]; edges: CMEdge[]; lastNodeId: string | null; pendingStairBottomId: string | null }>

  beginSurvey: () => void
  pushSnapshot: () => void
  undo: () => void
  setMapName: (n: string) => void
  dropRoom: (name: string) => CMNode
  dropWaypoint: () => CMNode
  dropStairBottom: () => CMNode
  dropStairTop: () => CMNode | null
  clear: () => void
  saveAs: (name: string) => CustomMap
  toCustomMap: () => CustomMap
}

export const useSurvey = create<SurveyState>((set, get) => ({
  nodes: [],
  edges: [],
  lastNodeId: null,
  pendingStairBottomId: null,
  mapName: 'My Building',
  history: [],

  beginSurvey: () => set({ nodes: [], edges: [], lastNodeId: null, pendingStairBottomId: null, history: [] }),

  pushSnapshot: () => {
    const { nodes, edges, lastNodeId, pendingStairBottomId, history } = get()
    const snap = { nodes: [...nodes], edges: [...edges], lastNodeId, pendingStairBottomId }
    const next = [...history, snap]
    if (next.length > 50) next.shift()
    set({ history: next })
  },

  undo: () => {
    const { history } = get()
    if (!history.length) return
    const prev = history[history.length - 1]
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      lastNodeId: prev.lastNodeId,
      pendingStairBottomId: prev.pendingStairBottomId,
      history: history.slice(0, -1),
    })
  },

  setMapName: (n) => set({ mapName: n }),

  dropRoom: (name) => {
    get().pushSnapshot()
    const { pos, floor } = useNav.getState()
    const p = pos ?? { x: 0, y: 0 }
    const node: CMNode = { id: uid('room'), pos: { ...p }, floor: floor as CMFloor, kind: 'room', name: name.trim() || 'Room' }
    const { nodes, edges, lastNodeId } = get()
    const newEdges = lastNodeId ? [...edges, { a: lastNodeId, b: node.id }] : edges
    set({ nodes: [...nodes, node], edges: newEdges, lastNodeId: node.id })
    return node
  },

  dropWaypoint: () => {
    get().pushSnapshot()
    const { pos, floor } = useNav.getState()
    const p = pos ?? { x: 0, y: 0 }
    const node: CMNode = { id: uid('wp'), pos: { ...p }, floor: floor as CMFloor, kind: 'waypoint' }
    const { nodes, edges, lastNodeId } = get()
    const newEdges = lastNodeId ? [...edges, { a: lastNodeId, b: node.id }] : edges
    set({ nodes: [...nodes, node], edges: newEdges, lastNodeId: node.id })
    return node
  },

  dropStairBottom: () => {
    get().pushSnapshot()
    const { pos, floor } = useNav.getState()
    const p = pos ?? { x: 0, y: 0 }
    const node: CMNode = { id: uid('stair'), pos: { ...p }, floor: floor as CMFloor, kind: 'stair' }
    const { nodes, edges, lastNodeId } = get()
    const newEdges = lastNodeId ? [...edges, { a: lastNodeId, b: node.id }] : edges
    set({
      nodes: [...nodes, node],
      edges: newEdges,
      lastNodeId: node.id,
      pendingStairBottomId: node.id,
    })
    return node
  },

  dropStairTop: () => {
    const { pendingStairBottomId } = get()
    if (!pendingStairBottomId) return null
    get().pushSnapshot()
    const { pos, floor } = useNav.getState()
    const p = pos ?? { x: 0, y: 0 }
    const node: CMNode = {
      id: uid('stair'),
      pos: { ...p },
      floor: floor as CMFloor,
      kind: 'stair',
      stairPairId: pendingStairBottomId,
    }
    const { nodes, edges, lastNodeId } = get()
    // Tag the bottom with its pair too
    const updatedNodes = nodes.map((n) =>
      n.id === pendingStairBottomId ? { ...n, stairPairId: node.id } : n
    )
    const newEdges: CMEdge[] = [...edges]
    if (lastNodeId && lastNodeId !== pendingStairBottomId) {
      newEdges.push({ a: lastNodeId, b: node.id })
    }
    newEdges.push({ a: pendingStairBottomId, b: node.id, stairs: true })
    set({
      nodes: [...updatedNodes, node],
      edges: newEdges,
      lastNodeId: node.id,
      pendingStairBottomId: null,
    })
    return node
  },

  clear: () => set({ nodes: [], edges: [], lastNodeId: null, pendingStairBottomId: null, history: [] }),

  toCustomMap: () => {
    const { nodes, edges, mapName } = get()
    return { name: mapName, createdAt: Date.now(), nodes, edges }
  },

  saveAs: (name) => {
    set({ mapName: name })
    const m = get().toCustomMap()
    saveCustomMap(m)
    return m
  },
}))
