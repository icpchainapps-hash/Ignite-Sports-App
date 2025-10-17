import { useQuery } from '@tanstack/react-query';
import { useActor } from './useActor';
import { Metrics } from '../backend';

const COMMON_QUERY_OPTIONS = {
  staleTime: 0,
  gcTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: true,
  retry: 2,
};

export function useGetMetrics(year: number, month: number) {
  const { actor, isFetching } = useActor();
  
  return useQuery<Metrics | null>({
    queryKey: ['metrics', year, month],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getMetrics(BigInt(year), BigInt(month));
    },
    enabled: !!actor && !isFetching,
    ...COMMON_QUERY_OPTIONS,
  });
}

export function useGetAllMetrics() {
  const { actor, isFetching } = useActor();
  
  return useQuery<Metrics[]>({
    queryKey: ['allMetrics'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getAllMetrics();
    },
    enabled: !!actor && !isFetching,
    ...COMMON_QUERY_OPTIONS,
  });
}
