import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { SubstitutionSchedule, Substitution, SubstitutionSpeedMode, Formation, Player as BackendPlayer } from '../backend';
import { calculateSubstitutionSchedule, convertTimesToSeconds, verifyScheduleMatch, verifyRotationMatch } from '../lib/substitutionScheduleCalculator';
import { toast } from 'sonner';

// Common query options
const COMMON_QUERY_OPTIONS = {
  staleTime: 0,
  gcTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: true,
  retry: 2,
};

// Frontend-friendly version of MinSubRoundsResult with numbers instead of bigints
export interface MinSubRoundsResultUI {
  R: number;
  stintMinutes: number;
  details: {
    totalPlayers: number;
    onField: number;
    gameMinutes: number;
    maxSubsPerRound: number;
    targetMinutesPerPlayer: number;
    lockedOnFieldCount: number;
    lockedOffFieldCount: number;
    benchSize: number;
    totalFieldMinutes: number;
    totalBenchMinutes: number;
    minRounds: number;
    minStintMinutes: number;
    isFeasible: boolean;
    errorMessage?: string;
  };
}

export function useGetSubstitutionSchedule(lineupId: string) {
  const { actor, isFetching } = useActor();
  
  return useQuery<SubstitutionSchedule | null>({
    queryKey: ['substitutionSchedule', lineupId],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getSubstitutionSchedule(lineupId);
    },
    enabled: !!actor && !isFetching && !!lineupId,
    ...COMMON_QUERY_OPTIONS,
  });
}

export function useCreateSubstitutionSchedule() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ lineupId, substitutions }: { lineupId: string; substitutions: Substitution[] }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createSubstitutionSchedule(lineupId, substitutions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutionSchedule'] });
    },
  });
}

export function useUpdateSubstitutionSchedule() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ lineupId, substitutions }: { lineupId: string; substitutions: Substitution[] }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateSubstitutionSchedule(lineupId, substitutions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutionSchedule'] });
    },
  });
}

export function useDeleteSubstitutionSchedule() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (lineupId: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.deleteSubstitutionSchedule(lineupId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutionSchedule'] });
    },
  });
}

export function useClearSubstitutionSchedule() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (lineupId: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.clearSubstitutionSchedule(lineupId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutionSchedule'] });
      queryClient.invalidateQueries({ queryKey: ['playerMinutesSummary'] });
    },
  });
}

export function useGenerateSubstitutionSchedule() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      lineupId, 
      players, 
      formation,
      timePerHalf,
      maxSimultaneousSubs,
      onFieldCount,
      previewRotationEvents
    }: { 
      lineupId: string;
      players: BackendPlayer[];
      formation: Formation;
      timePerHalf: number;
      maxSimultaneousSubs: number;
      onFieldCount: number;
      previewRotationEvents?: Array<{ roundNumber: number; timeMinutes: number; timeSeconds: number; fieldPlayerId: string; benchPlayerId: string }>;
    }) => {
      if (!actor) throw new Error('Actor not available');
      
      try {
        const exists = await actor.lineupExists(lineupId);
        
        if (!exists) {
          await actor.createLineup(lineupId, 'Default Lineup', formation);
          
          for (const player of players) {
            await actor.addPlayer(lineupId, player);
          }
        } else {
          const existingLineup = await actor.getLineup(lineupId);
          if (existingLineup) {
            const updatedLineup = {
              ...existingLineup,
              formation,
              players,
              updatedAt: BigInt(Date.now())
            };
            await actor.updateLineup(lineupId, updatedLineup);
          }
        }
        
        const totalMatchTime = timePerHalf * 2;
        
        const scheduleResult = calculateSubstitutionSchedule({
          totalPlayers: players.length,
          onFieldPlayers: onFieldCount,
          gameMinutes: totalMatchTime,
          maxSimultaneousSubs,
        });

        if (!scheduleResult.isFeasible) {
          throw new Error(scheduleResult.errorMessage || 'Schedule calculation failed');
        }

        const { minRounds, substitutionTimes } = scheduleResult;
        
        const previewedIntervalsSeconds = convertTimesToSeconds(substitutionTimes).map(t => BigInt(t));
        
        const schedule = await actor.generateStrictFifoRotationSchedule(
          lineupId,
          previewedIntervalsSeconds
        );
        
        const substitutionsByTime = new Map<string, typeof schedule.substitutions>();
        schedule.substitutions.forEach(sub => {
          const timeKey = sub.time.toString();
          if (!substitutionsByTime.has(timeKey)) {
            substitutionsByTime.set(timeKey, []);
          }
          substitutionsByTime.get(timeKey)!.push(sub);
        });
        
        const uniqueTimes = Array.from(substitutionsByTime.keys()).map(k => Number(k)).sort((a, b) => a - b);
        const actualTimesMinutes = uniqueTimes.map(t => t / 60);
        
        const actualResult = {
          minRounds: uniqueTimes.length,
          interval: uniqueTimes.length > 1 ? (actualTimesMinutes[actualTimesMinutes.length - 1] - actualTimesMinutes[0]) / (uniqueTimes.length - 1) : 0,
          substitutionTimes: actualTimesMinutes,
          stintMinutes: totalMatchTime / uniqueTimes.length,
          isFeasible: true,
        };
        
        verifyScheduleMatch(scheduleResult, actualResult, 'Backend Generation');
        
        if (previewRotationEvents && previewRotationEvents.length > 0) {
          const backendEvents = schedule.substitutions.map(sub => ({
            time: Number(sub.time),
            fieldPlayerId: sub.fieldPlayerId,
            benchPlayerId: sub.benchPlayerId,
          }));
          
          verifyRotationMatch(previewRotationEvents, backendEvents, 'Preview vs Backend');
        }
        
        if (!schedule || !schedule.substitutions || schedule.substitutions.length === 0) {
          throw new Error('Schedule generation failed: No substitutions were created. Please check your squad composition and settings.');
        }
        
        return schedule;
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        
        if (errorMessage.includes('Lineup not found')) {
          throw new Error('Unable to create lineup. Please try refreshing the page and setting up your team again.');
        } else if (errorMessage.includes('No bench players')) {
          throw new Error('Cannot generate schedule: No bench players available. Add players to the bench first.');
        } else if (errorMessage.includes('No field players')) {
          throw new Error('Cannot generate schedule: No field players available. Add players to the field first.');
        } else if (errorMessage.includes('Minimum required substitution rounds cannot be 0')) {
          throw new Error('Cannot generate schedule: Unable to calculate substitution rounds. Check your max simultaneous substitutions setting.');
        } else if (errorMessage.includes('Stint minutes cannot be 0')) {
          throw new Error('Cannot generate schedule: Match duration is too short for the current settings. Increase time per half or reduce max simultaneous substitutions.');
        } else if (errorMessage.includes('not feasible')) {
          throw new Error('Cannot generate schedule: The current settings are not feasible. Try adjusting time per half or max simultaneous substitutions.');
        } else if (errorMessage.includes('Time per half must be between')) {
          throw new Error('Invalid time per half setting. Please set a value between 20 and 45 minutes.');
        } else {
          throw new Error(`Schedule generation failed: ${errorMessage}`);
        }
      }
    },
    onSuccess: (_, { lineupId }) => {
      queryClient.invalidateQueries({ queryKey: ['substitutionSchedule', lineupId] });
      queryClient.invalidateQueries({ queryKey: ['playerMinutesSummary', lineupId] });
      queryClient.invalidateQueries({ queryKey: ['lineup', lineupId] });
    },
  });
}

export function useGetPlayerMinutesSummary(lineupId: string) {
  const { actor, isFetching } = useActor();
  
  return useQuery<Array<[string, bigint]>>({
    queryKey: ['playerMinutesSummary', lineupId],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getPlayerMinutesSummary(lineupId);
    },
    enabled: !!actor && !isFetching && !!lineupId,
    ...COMMON_QUERY_OPTIONS,
  });
}

export function useComputeMinSubRounds(
  totalPlayers: number,
  onField: number,
  gameMinutes: number,
  maxSubsPerRound: number,
  targetMinutesPerPlayer?: number,
  lockedOnFieldCount?: number,
  lockedOffFieldCount?: number
) {
  const { actor, isFetching } = useActor();

  return useQuery<MinSubRoundsResultUI>({
    queryKey: [
      'computeMinSubRounds',
      totalPlayers,
      onField,
      gameMinutes,
      maxSubsPerRound,
      targetMinutesPerPlayer,
      lockedOnFieldCount,
      lockedOffFieldCount,
    ],
    queryFn: async (): Promise<MinSubRoundsResultUI> => {
      if (!actor) {
        throw new Error('Actor not available');
      }
      
      const result = await actor.computeMinSubRounds(
        BigInt(totalPlayers),
        BigInt(onField),
        BigInt(gameMinutes),
        BigInt(maxSubsPerRound),
        targetMinutesPerPlayer ?? null,
        lockedOnFieldCount !== undefined ? BigInt(lockedOnFieldCount) : null,
        lockedOffFieldCount !== undefined ? BigInt(lockedOffFieldCount) : null
      );

      return {
        R: Number(result.R),
        stintMinutes: result.stintMinutes,
        details: {
          totalPlayers: Number(result.details.totalPlayers),
          onField: Number(result.details.onField),
          gameMinutes: Number(result.details.gameMinutes),
          maxSubsPerRound: Number(result.details.maxSubsPerRound),
          targetMinutesPerPlayer: result.details.targetMinutesPerPlayer,
          lockedOnFieldCount: Number(result.details.lockedOnFieldCount),
          lockedOffFieldCount: Number(result.details.lockedOffFieldCount),
          benchSize: Number(result.details.benchSize),
          totalFieldMinutes: Number(result.details.totalFieldMinutes),
          totalBenchMinutes: Number(result.details.totalBenchMinutes),
          minRounds: Number(result.details.minRounds),
          minStintMinutes: result.details.minStintMinutes,
          isFeasible: result.details.isFeasible,
          errorMessage: result.details.errorMessage,
        },
      };
    },
    enabled: !!actor && !isFetching && totalPlayers > 0 && onField > 0 && gameMinutes > 0 && maxSubsPerRound > 0,
    retry: false,
  });
}

