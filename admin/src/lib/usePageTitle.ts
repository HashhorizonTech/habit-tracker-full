import { useEffect } from 'react';
import { APP_NAME } from '../brand';

export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME} Admin`;
  }, [title]);
}
