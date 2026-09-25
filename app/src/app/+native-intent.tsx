// Rewrites incoming system URLs before routing. The https share link
// (https://hashhorizon.in/app/tend/invite/<CODE>) arrives as /app/tend/invite/<CODE>.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const m = /\/invite\/([A-Za-z0-9-]{4,20})\/?(?:[?#].*)?$/.exec(path);
    if (m) return `/invite/${m[1]}`;
  } catch {
    // fall through
  }
  return path;
}
