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
