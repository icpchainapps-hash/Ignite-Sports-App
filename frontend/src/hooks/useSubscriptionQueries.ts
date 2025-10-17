import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';

export type SubscriptionPlan = 'free' | 'pro' | 'proFootball';

export interface ClubSubscription {
  clubId: string;
  plan: SubscriptionPlan;
  teamCount: number;
  paymentStatus?: 'pending' | 'completed' | 'failed';
}

// Mock subscription data - in production this would come from backend
const mockSubscriptions = new Map<string, ClubSubscription>();

export function useGetClubSubscription(clubId: string | undefined) {
  return useQuery({
    queryKey: ['clubSubscription', clubId],
    queryFn: async (): Promise<ClubSubscription | null> => {
      if (!clubId) return null;
      
      // Mock implementation - return free plan by default
      const existing = mockSubscriptions.get(clubId);
      if (existing) return existing;
      
      return {
        clubId,
        plan: 'free',
        teamCount: 0,
        paymentStatus: 'completed'
      };
    },
    enabled: !!clubId,
  });
}

export function useUpdateClubSubscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      clubId, 
      plan, 
      paymentStatus 
    }: { 
      clubId: string; 
      plan: SubscriptionPlan;
      paymentStatus?: 'pending' | 'completed' | 'failed';
    }) => {
      // Mock implementation - in production this would call backend
      const subscription: ClubSubscription = {
        clubId,
        plan,
        teamCount: 0,
        paymentStatus: paymentStatus || 'completed'
      };
      mockSubscriptions.set(clubId, subscription);
      return subscription;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clubSubscription', variables.clubId] });
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function canAccessFeature(
  subscription: ClubSubscription | null | undefined,
  feature: 'clubMessaging' | 'photoFeed' | 'matchView'
): boolean {
  if (!subscription) return false;
  
  const { plan, teamCount, paymentStatus } = subscription;
  
  // Check payment status - must be completed for paid plans
  if (plan !== 'free' && paymentStatus !== 'completed') {
    return false;
  }
  
  // Free plan restrictions
  if (plan === 'free') {
    if (feature === 'clubMessaging') return false;
    if (feature === 'photoFeed') return false;
    if (feature === 'matchView') return false;
    if (teamCount >= 3) return false; // Max 3 teams on free plan
  }
  
  // Pro plan
  if (plan === 'pro') {
    if (feature === 'matchView') return false; // Match view requires Pro Football
    return true;
  }
  
  // Pro Football plan - all features
  if (plan === 'proFootball') {
    return true;
  }
  
  return false;
}

export function getPlanPrice(plan: SubscriptionPlan): number {
  switch (plan) {
    case 'free':
      return 0;
    case 'pro':
      return 10;
    case 'proFootball':
      return 20;
    default:
      return 0;
  }
}
