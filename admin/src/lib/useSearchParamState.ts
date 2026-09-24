import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Read enum-like filters and a page number from the URL, so filters survive reloads and back/forward. */
export function useUrlFilters<K extends string>(defaults: Record<K, string>) {
  const [params, setParams] = useSearchParams();

  const get = useCallback(
    <T extends string>(key: K, allowed: readonly T[]): T => {
      const v = params.get(key);
      return (allowed as readonly string[]).includes(v ?? '') ? (v as T) : (defaults[key] as T);
    },
    [params, defaults],
  );

  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  /** Set one or more params; any change other than `page` resets to page 1. */
  const set = useCallback(
    (updates: Partial<Record<K | 'page', string | number>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(updates) as [string, string | number][]) {
            const isDefault = k === 'page' ? Number(v) === 1 : defaults[k as K] === String(v);
            if (v === '' || isDefault) next.delete(k);
            else next.set(k, String(v));
          }
          if (!('page' in updates)) next.delete('page');
          return next;
        },
        { replace: !('page' in updates) },
      );
    },
    [setParams, defaults],
  );

  return { params, get, page, set };
}
