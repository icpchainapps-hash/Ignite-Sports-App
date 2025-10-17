import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { Lineup, Player, Formation } from '../backend';

// Common query options
const COMMON_QUERY_OPTIONS = {
  staleTime: 0,
  gcTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: true,
  retry: 2,
};

export function useGetAllLineups() {
  const { actor, isFetching } = useActor();
  
  return useQuery<Lineup[]>({
    queryKey: ['lineups'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getAllLineups();
    },
    enabled: !!actor && !isFetching,
    ...COMMON_QUERY_OPTIONS,
  });
}

export function useGetLineup(id: string) {
  const { actor, isFetching } = useActor();
  
  return useQuery<Lineup | null>({
    queryKey: ['lineup', id],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getLineup(id);
    },
    enabled: !!actor && !isFetching && !!id,
    ...COMMON_QUERY_OPTIONS,
  });
}

export function useCreateLineup() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, name, formation }: { id: string; name: string; formation: Formation }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createLineup(id, name, formation);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lineups'] });
    },
  });
}

export function useUpdateLineup() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, lineup }: { id: string; lineup: Lineup }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateLineup(id, lineup);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lineups'] });
      queryClient.invalidateQueries({ queryKey: ['lineup'] });
    },
  });
}

export function useDeleteLineup() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.deleteLineup(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lineups'] });
    },
  });
}

export function useAddPlayer() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ lineupId, player }: { lineupId: string; player: Player }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.addPlayer(lineupId, player);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lineup'] });
      queryClient.invalidateQueries({ queryKey: ['lineups'] });
    },
  });
}

export function useUpdatePlayer() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ lineupId, playerId, player }: { lineupId: string; playerId: string; player: Player }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updatePlayer(lineupId, playerId, player);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lineup'] });
      queryClient.invalidateQueries({ queryKey: ['lineups'] });
    },
  });
}

export function useRemovePlayer() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ lineupId, playerId }: { lineupId: string; playerId: string }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.removePlayer(lineupId, playerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lineup'] });
      queryClient.invalidateQueries({ queryKey: ['lineups'] });
    },
  });
}

export function useSubstitutePlayer() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ lineupId, fieldPlayerId, benchPlayerId }: { lineupId: string; fieldPlayerId: string; benchPlayerId: string }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.substitutePlayer(lineupId, fieldPlayerId, benchPlayerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lineup'] });
      queryClient.invalidateQueries({ queryKey: ['lineups'] });
    },
  });
}

export function useEnsureLineupExists() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lineupId, name, formation, players }: { 
      lineupId: string; 
      name: string; 
      formation: Formation;
      players: Player[];
    }) => {
      if (!actor) throw new Error('Actor not available');
      
      const exists = await actor.lineupExists(lineupId);
      
      if (!exists) {
        await actor.createLineup(lineupId, name, formation);
        
        for (const player of players) {
          await actor.addPlayer(lineupId, player);
        }
      } else {
        const existingLineup = await actor.getLineup(lineupId);
        if (existingLineup) {
          const updatedLineup: Lineup = {
            ...existingLineup,
            name,
            formation,
            players,
            updatedAt: BigInt(Date.now())
          };
          await actor.updateLineup(lineupId, updatedLineup);
        }
      }
      
      return { lineupId, exists };
    },
    onSuccess: (_, { lineupId }) => {
      queryClient.invalidateQueries({ queryKey: ['lineup', lineupId] });
      queryClient.invalidateQueries({ queryKey: ['lineups'] });
    },
  });
}

