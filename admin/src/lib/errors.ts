import { ApiError } from '../api/client';

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'FORBIDDEN':
        return "This account doesn't have admin access.";
      case 'NOT_FOUND':
        return 'Not found.';
      default:
        return e.message || 'Something went wrong.';
    }
  }
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
