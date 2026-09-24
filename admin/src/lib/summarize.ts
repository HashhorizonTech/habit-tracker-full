/** One-line summary of an audit `details` payload (shape is action-specific). */
export function summarizeDetails(details: unknown, max = 120): string {
  if (details === null || details === undefined || details === '') return '';
  let text: string;
  if (typeof details === 'string') text = details;
  else if (typeof details === 'number' || typeof details === 'boolean') text = String(details);
  else if (Array.isArray(details)) text = details.map((d) => summarizeDetails(d, max)).join(', ');
  else if (typeof details === 'object') {
    text = Object.entries(details as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' · ');
  } else text = '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function fullDetails(details: unknown): string {
  if (details === null || details === undefined) return '';
  return typeof details === 'string' ? details : JSON.stringify(details, null, 2);
}
