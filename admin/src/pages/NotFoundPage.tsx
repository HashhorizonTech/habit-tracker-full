import { Link } from 'react-router-dom';
import { EmptyState } from '../components/States';
import { usePageTitle } from '../lib/usePageTitle';

export function NotFoundPage() {
  usePageTitle('Not found');
  return (
    <EmptyState title="Page not found">
      <Link to="/">Back to the dashboard</Link>
    </EmptyState>
  );
}
