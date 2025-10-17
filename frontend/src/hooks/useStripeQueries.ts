import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { StripeConfiguration } from '../backend';

const COMMON_QUERY_OPTIONS = {
  staleTime: 0,
  gcTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: true,
  retry: 2,
};

// Frontend type that matches what we need
export interface StripeConfigurationUI {
  secretKey: string;
  publishableKey?: string;
  connected?: boolean;
}

export function useGetStripeConfiguration() {
  const { actor, isFetching } = useActor();
  
  return useQuery<StripeConfigurationUI | null>({
    queryKey: ['stripeConfiguration'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      const config = await actor.getStripeConfiguration();
      if (!config) return null;
      
      // Map backend type to frontend type
      return {
        secretKey: config.secretKey,
        publishableKey: config.publishableKey,
        connected: config.connected,
      };
    },
    enabled: !!actor && !isFetching,
    ...COMMON_QUERY_OPTIONS,
  });
}

export function useSetStripeConfiguration() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (config: StripeConfiguration) => {
      if (!actor) throw new Error('Actor not available');
      return actor.setStripeConfiguration(config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stripeConfiguration'] });
      queryClient.invalidateQueries({ queryKey: ['stripeConnected'] });
    },
  });
}

export function useIsStripeConnected() {
  const { actor, isFetching } = useActor();
  
  const query = useQuery<boolean>({
    queryKey: ['stripeConnected'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.isStripeConnected();
    },
    enabled: !!actor && !isFetching,
    ...COMMON_QUERY_OPTIONS,
  });
  
  return {
    ...query,
    data: query.data ?? false,
  };
}
