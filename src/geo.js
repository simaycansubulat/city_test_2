// Turn longitude/latitude into flat metres around the kit centre.
// Over 2 km the error of this local projection is far below a metre.

export function makeProjection([lon0, lat0]) {
  const phi = (lat0 * Math.PI) / 180
  const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi)
  const mPerDegLon = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi)
  // x points east, y points north, both in metres
  return ([lon, lat]) => [(lon - lon0) * mPerDegLon, (lat - lat0) * mPerDegLat]
}

// Shoelace area of a ring of [x, y] points, in m² (sign follows winding)
export function ringArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  }
  return a / 2
}
