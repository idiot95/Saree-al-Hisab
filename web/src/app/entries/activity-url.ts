/** /entries with every param of an old address (/inbox, /schedules) kept and `f` set to the view it now is. */
export function activityUrl(params: Record<string, string | string[] | undefined>, f: string,
  override?: (q: URLSearchParams) => string | null) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === 'f' || v === undefined) continue;
    for (const one of Array.isArray(v) ? v : [v]) q.append(k, one);
  }
  const view = override?.(q) ?? f;
  return `/entries?${new URLSearchParams([['f', view], ...q]).toString()}`;
}
