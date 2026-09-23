import { useId } from 'react';

/** A DOM/SVG-safe unique id prefix, so gradients and masks never collide across instances. */
export function useSvgId(prefix: string): string {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, '');
}
