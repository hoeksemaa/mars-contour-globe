// Mars-warm gradient: deep purple/blue (lowlands) → orange/red (highlands)
const STOPS: [number, [number, number, number]][] = [
  [0.0, [0.10, 0.02, 0.20]], // deep purple
  [0.2, [0.08, 0.05, 0.35]], // indigo
  [0.35, [0.05, 0.15, 0.45]], // steel blue
  [0.5, [0.40, 0.12, 0.08]], // rust
  [0.65, [0.70, 0.20, 0.05]], // burnt orange
  [0.8, [0.90, 0.35, 0.05]], // bright orange
  [1.0, [1.00, 0.55, 0.15]], // warm amber
]

export function elevationToColor(t: number): { r: number; g: number; b: number } {
  // Clamp
  t = Math.max(0, Math.min(1, t))

  // Find bracketing stops
  let lo = STOPS[0]
  let hi = STOPS[STOPS.length - 1]
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (t >= STOPS[i][0] && t <= STOPS[i + 1][0]) {
      lo = STOPS[i]
      hi = STOPS[i + 1]
      break
    }
  }

  const f = hi[0] === lo[0] ? 0 : (t - lo[0]) / (hi[0] - lo[0])
  return {
    r: lo[1][0] + f * (hi[1][0] - lo[1][0]),
    g: lo[1][1] + f * (hi[1][1] - lo[1][1]),
    b: lo[1][2] + f * (hi[1][2] - lo[1][2]),
  }
}
