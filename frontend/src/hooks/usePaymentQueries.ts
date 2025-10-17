import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { ShoppingItem } from '../backend';

export interface PaymentSession {
  id: string;
  url: string;
}

export function useCreateCheckoutSession() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      items, 
      successUrl, 
      cancelUrl 
    }: { 
      items: ShoppingItem[]; 
      successUrl: string; 
      cancelUrl: string;
    }): Promise<PaymentSession> => {
      if (!actor) throw new Error('Actor not available');
      
      const result = await actor.createCheckoutSession(items, successUrl, cancelUrl);
      
      // Parse the JSON result from backend
      const session = JSON.parse(result) as PaymentSession;
      return session;
    },
    onSuccess: () => {
      // Invalidate subscription queries after successful payment session creation
      queryClient.invalidateQueries({ queryKey: ['clubSubscription'] });
    },
  });
}

export function useGetStripeSessionStatus() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.getStripeSessionStatus(sessionId);
    },
  });
}
