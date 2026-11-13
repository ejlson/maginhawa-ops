/**
 * Where a dragged row lands: the position whose middle its own middle has passed. `tops` and
 * `heights` are the rows' places when the drag started; `dy` is how far it has moved.
 */
export function dropIndex(from: number, dy: number, tops: number[], heights: number[]): number {
  const centre = (tops[from] ?? 0) + (heights[from] ?? 0) / 2 + dy;
  let to = from;
  for (let k = from + 1; k < tops.length; k++) if (centre > (tops[k] ?? 0) + (heights[k] ?? 0) / 2) to = k;
  for (let k = from - 1; k >= 0; k--) if (centre < (tops[k] ?? 0) + (heights[k] ?? 0) / 2) to = k;
  return to;
}

/**
 * How fast to scroll while dragging near an edge, in pixels per frame: nothing inside the safe band,
 * then faster the further past the edge the finger goes, up to `max`. Negative scrolls up.
 */
export function edgeSpeed(y: number, top: number, bottom: number, max = 16): number {
  if (y < top) return -Math.min(max, Math.ceil((top - y) / 5));
  if (y > bottom) return Math.min(max, Math.ceil((y - bottom) / 5));
  return 0;
}
