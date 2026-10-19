// Small route helpers for the imagined 2077 layers (flight lanes, maglev lines, light trails).
// They use the real street graph, but have nothing to do with the walking calculation in reach.js.

// Shortest path between two node indices, along the street graph
export function shortestPath(city, source, target) {
  const dist = new Float64Array(city.nodes.length).fill(Infinity)
  const prev = new Int32Array(city.nodes.length).fill(-1)
  const done = new Uint8Array(city.nodes.length)
  dist[source] = 0
  for (;;) {
    let u = -1
    for (let i = 0; i < dist.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i
    if (u < 0 || u === target) break
    done[u] = 1
    for (const k of city.adjacency[u]) {
      const e = city.edges[k]
      const v = e.u === u ? e.v : e.u
      if (dist[u] + e.length < dist[v]) {
        dist[v] = dist[u] + e.length
        prev[v] = u
      }
    }
  }
  const path = []
  for (let v = target; v >= 0; v = prev[v]) path.unshift(v)
  return path
}

// Index of the walkable street node nearest to a point in metres
export function nearestNode(city, [x, y]) {
  let best = -1
  let bd = Infinity
  for (const i of city.walkableNodes) {
    const n = city.nodes[i]
    const d = Math.hypot(n.x - x, n.y - y)
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return best
}

// Douglas–Peucker: fewer points, same course
export function simplify(pts, tol) {
  if (pts.length < 3) return pts
  const [ax, ay] = pts[0]
  const [bx, by] = pts[pts.length - 1]
  let worst = 0
  let index = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i]
    const l = Math.hypot(bx - ax, by - ay) || 1
    const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / l
    if (d > worst) {
      worst = d
      index = i
    }
  }
  if (worst <= tol) return [pts[0], pts[pts.length - 1]]
  return [...simplify(pts.slice(0, index + 1), tol).slice(0, -1), ...simplify(pts.slice(index), tol)]
}
