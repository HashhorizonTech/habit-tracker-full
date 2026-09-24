import { useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '../api/queryKeys';
import { useToast } from '../components/toast-context';
import { errorMessage } from './errors';

interface Options<TVars, TResult> {
  mutationFn: (vars: TVars) => Promise<TResult>;
  success: string | ((result: TResult, vars: TVars) => string);
  onSuccess?: (result: TResult, vars: TVars) => void;
}

/** Admin write: toast on success/failure and refresh every admin query (lists, stats, audit). */
export function useAdminMutation<TVars, TResult>({ mutationFn, success, onSuccess }: Options<TVars, TResult>) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn,
    onSuccess: async (result, vars) => {
      onSuccess?.(result, vars);
      toast.show(typeof success === 'function' ? success(result, vars) : success, 'success');
      await queryClient.invalidateQueries({ queryKey: qk.all });
    },
    onError: (e) => toast.show(errorMessage(e), 'error'),
  });
}
