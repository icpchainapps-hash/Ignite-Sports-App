import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { SubstitutionSpeedMode } from '../backend';

const COMMON_QUERY_OPTIONS = {
  staleTime: 0,
  gcTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: true,
  retry: 2,
};

export function useGetTimePerHalf() {
  const { actor, isFetching } = useActor();
  
  const query = useQuery<number>({
    queryKey: ['timePerHalf'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      const result = await actor.getTimePerHalf();
      return Number(result);
    },
    enabled: !!actor && !isFetching,
    ...COMMON_QUERY_OPTIONS,
  });
  
  return {
    ...query,
    data: query.data ?? 45,
  };
}

export function useSetTimePerHalf() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newTime: number) => {
      if (!actor) throw new Error('Actor not available');
      return actor.setTimePerHalf(BigInt(newTime));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timePerHalf'] });
    },
  });
}

export function useGetSubstitutionSpeedMode() {
  const { actor, isFetching } = useActor();
  
  const query = useQuery<SubstitutionSpeedMode>({
    queryKey: ['substitutionSpeedMode'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getSubstitutionSpeedMode();
    },
    enabled: !!actor && !isFetching,
    ...COMMON_QUERY_OPTIONS,
  });
  
  return {
    ...query,
    data: query.data ?? SubstitutionSpeedMode.medium,
  };
}

export function useSetSubstitutionSpeedMode() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (mode: SubstitutionSpeedMode) => {
      if (!actor) throw new Error('Actor not available');
      return actor.setSubstitutionSpeedMode(mode);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutionSpeedMode'] });
    },
  });
}

export function useGetMaxSimultaneousSubs() {
  const { actor, isFetching } = useActor();
  
  const query = useQuery<number>({
    queryKey: ['maxSimultaneousSubs'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      const result = await actor.getMaxSimultaneousSubs();
      return Number(result);
    },
    enabled: !!actor && !isFetching,
    ...COMMON_QUERY_OPTIONS,
  });
  
  return {
    ...query,
    data: query.data ?? 2,
  };
}

export function useSetMaxSimultaneousSubs() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (maxSubs: number) => {
      if (!actor) throw new Error('Actor not available');
      return actor.setMaxSimultaneousSubs(BigInt(maxSubs));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maxSimultaneousSubs'] });
    },
  });
}
