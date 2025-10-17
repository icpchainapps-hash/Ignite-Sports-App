import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { ChildProfile, RSVPStatus } from '../backend';

export function useGetChildProfilesByParent() {
  const { actor, isFetching } = useActor();

  return useQuery<ChildProfile[]>({
    queryKey: ['childProfiles', 'parent'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('[Child Profiles Query] Fetching child profiles for parent');
      
      try {
        const profiles = await actor.getChildProfilesByParent();
        console.log('[Child Profiles Query] Received profiles:', profiles.length);
        return profiles;
      } catch (error: any) {
        console.error('[Child Profiles Query] Error:', error);
        throw new Error(`Failed to fetch child profiles: ${error.message || String(error)}`);
      }
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function useGetChildProfile(childId: string) {
  const { actor, isFetching } = useActor();

  return useQuery<ChildProfile | null>({
    queryKey: ['childProfile', childId],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('[Child Profile Query] Fetching child profile:', childId);
      
      try {
        const profile = await actor.getChildProfile(childId);
        console.log('[Child Profile Query] Received profile:', profile);
        return profile;
      } catch (error: any) {
        console.error('[Child Profile Query] Error:', error);
        throw new Error(`Failed to fetch child profile: ${error.message || String(error)}`);
      }
    },
    enabled: !!actor && !isFetching && !!childId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function useCreateChildProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      name, 
      dateOfBirth, 
      clubId, 
      teamId 
    }: { 
      name: string; 
      dateOfBirth: string; 
      clubId: string; 
      teamId: string;
    }) => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('[Create Child Profile] Creating profile:', { name, dateOfBirth, clubId, teamId });
      
      try {
        const childId = await actor.createChildProfile(name, dateOfBirth, clubId, teamId);
        console.log('[Create Child Profile] Profile created with ID:', childId);
        return { childId, teamId, clubId };
      } catch (error: any) {
        console.error('[Create Child Profile] Backend error:', error);
        
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Club not found')) {
          throw new Error('Selected club not found. Please select a valid club.');
        } else if (errorMessage.includes('Team not found')) {
          throw new Error('Selected team not found. Please select a valid team.');
        } else if (errorMessage.includes('does not belong to')) {
          throw new Error('Selected team does not belong to the selected club. Please choose a team from the selected club.');
        } else if (errorMessage.includes('Unauthorized')) {
          throw new Error('You do not have permission to create child profiles. Parent role required.');
        } else {
          throw new Error(`Failed to create child profile: ${errorMessage}`);
        }
      }
    },
    onSuccess: async (data) => {
      console.log('[Create Child Profile] Success callback - invalidating queries');
      
      // Invalidate and refetch child profiles
      await queryClient.invalidateQueries({ queryKey: ['childProfiles'] });
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      await queryClient.invalidateQueries({ queryKey: ['teamMembers', data.teamId] });
      await queryClient.invalidateQueries({ queryKey: ['clubMembers', data.clubId] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
      // Force immediate refetch
      await queryClient.refetchQueries({ queryKey: ['childProfiles', 'parent'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['teams'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['teamMembers', data.teamId], type: 'active' });
      
      console.log('[Create Child Profile] Query invalidation and refetch complete');
    },
    onError: (error: any) => {
      console.error('[Create Child Profile] Mutation error:', error);
    },
  });
}

export function useUpdateChildProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      childId, 
      updatedProfile 
    }: { 
      childId: string; 
      updatedProfile: ChildProfile;
    }) => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('[Update Child Profile] Updating profile:', childId);
      
      try {
        await actor.updateChildProfile(childId, updatedProfile);
        console.log('[Update Child Profile] Profile updated successfully');
        return { childId, teamId: updatedProfile.teamId, clubId: updatedProfile.clubId };
      } catch (error: any) {
        console.error('[Update Child Profile] Backend error:', error);
        throw new Error(`Failed to update child profile: ${error.message || String(error)}`);
      }
    },
    onSuccess: async (data) => {
      console.log('[Update Child Profile] Success callback - invalidating queries');
      
      await queryClient.invalidateQueries({ queryKey: ['childProfiles'] });
      await queryClient.invalidateQueries({ queryKey: ['childProfile', data.childId] });
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      await queryClient.invalidateQueries({ queryKey: ['teamMembers', data.teamId] });
      await queryClient.invalidateQueries({ queryKey: ['clubMembers', data.clubId] });
      
      await queryClient.refetchQueries({ queryKey: ['childProfiles', 'parent'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['childProfile', data.childId], type: 'active' });
      
      console.log('[Update Child Profile] Query invalidation complete');
    },
  });
}

export function useDeleteChildProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (childId: string) => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('[Delete Child Profile] Deleting profile:', childId);
      
      try {
        await actor.deleteChildProfile(childId);
        console.log('[Delete Child Profile] Profile deleted successfully');
        return { childId };
      } catch (error: any) {
        console.error('[Delete Child Profile] Backend error:', error);
        throw new Error(`Failed to delete child profile: ${error.message || String(error)}`);
      }
    },
    onSuccess: async (data) => {
      console.log('[Delete Child Profile] Success callback - invalidating queries');
      
      await queryClient.invalidateQueries({ queryKey: ['childProfiles'] });
      await queryClient.invalidateQueries({ queryKey: ['childProfile', data.childId] });
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      await queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      await queryClient.invalidateQueries({ queryKey: ['clubMembers'] });
      
      await queryClient.refetchQueries({ queryKey: ['childProfiles', 'parent'], type: 'active' });
      
      console.log('[Delete Child Profile] Query invalidation complete');
    },
  });
}

export function useUpdateChildRSVP() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      childId, 
      eventId, 
      status 
    }: { 
      childId: string; 
      eventId: string; 
      status: RSVPStatus;
    }) => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('[Update Child RSVP] Updating RSVP for child:', childId, 'event:', eventId, 'status:', status);
      
      try {
        await actor.updateChildRSVP(childId, eventId, status);
        console.log('[Update Child RSVP] RSVP updated successfully');
        return { childId, eventId, status };
      } catch (error: any) {
        console.error('[Update Child RSVP] Backend error:', error);
        throw new Error(`Failed to update child RSVP: ${error.message || String(error)}`);
      }
    },
    onSuccess: async (data) => {
      console.log('[Update Child RSVP] Success callback - invalidating queries');
      
      await queryClient.invalidateQueries({ queryKey: ['rsvps', 'event', data.eventId] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
      await queryClient.refetchQueries({ queryKey: ['rsvps', 'event', data.eventId], type: 'active' });
      
      console.log('[Update Child RSVP] Query invalidation complete');
    },
  });
}
