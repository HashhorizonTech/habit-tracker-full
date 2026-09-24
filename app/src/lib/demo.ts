import { buildDemo } from '@/data/demo';
import type { CollectionKey, Collections } from '@/data/types';
import { COLLECTION_KEYS, useData } from '@/store/data';
import { toast } from '@/store/ui';

/**
 * Dev toggle (SPEC §7): replace this account's data with the demo account. Existing
 * records are kept as deletions so the server (and other devices) drop them too.
 */
export function loadDemoData() {
  const s = useData.getState();
  const demo = buildDemo(undefined, s.profile.name || 'Ravi');
  const now = Date.now();
  const merged = { ...demo } as Collections & { profile: typeof demo.profile };
  for (const key of COLLECTION_KEYS) {
    const col = { ...(demo[key] as Record<string, Collections[CollectionKey][string]>) };
    for (const [id, rec] of Object.entries(s[key])) {
      if (!col[id]) col[id] = { ...rec, deleted: true, updatedAt: Math.max(now, rec.updatedAt + 1) };
    }
    // Demo rows must also beat any server copy with the same deterministic id.
    for (const id of Object.keys(col)) col[id] = { ...col[id], updatedAt: Math.max(col[id].updatedAt, (s[key][id]?.updatedAt ?? 0) + 1, now) };
    (merged as unknown as Record<string, unknown>)[key] = col;
  }
  s.replaceAll(s.ownerId, merged);
  if (s.ownerId) {
    useData.getState().claim(s.ownerId);
    // Demo replaces the profile deliberately, so push it (claim alone never does).
    useData.getState().updateProfile({});
  }
  toast('Demo data loaded', 'sparkle');
}
