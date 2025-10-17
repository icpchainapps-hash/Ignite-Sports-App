import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { UserProfile, UserRole } from '../backend';

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      console.log('[User Profile Query] Fetching caller user profile...');
      const profile = await actor.getCallerUserProfile();
      console.log('[User Profile Query] Fetched profile:', profile);
      return profile;
    },
    enabled: !!actor && !actorFetching,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && !actorFetching && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const queryClient = useQueryClient();
  const { actor } = useActor();
  
  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error('Actor not available');
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      await queryClient.refetchQueries({ queryKey: ['currentUserProfile'], type: 'active' });
    },
  });
}

export function useCreateUserProfile() {
  const queryClient = useQueryClient();
  const { actor } = useActor();
  
  return useMutation({
    mutationFn: async ({ username, displayName, roles }: { username: string; displayName: string; roles: UserRole[] }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createUserProfile(username, displayName, roles);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      await queryClient.refetchQueries({ queryKey: ['currentUserProfile'], type: 'active' });
    },
  });
}

export function useUpdateDisplayName() {
  const queryClient = useQueryClient();
  const { actor } = useActor();
  
  return useMutation({
    mutationFn: async ({ currentProfile, newDisplayName }: { currentProfile: UserProfile; newDisplayName: string }) => {
      if (!actor) throw new Error('Actor not available');
      const updatedProfile: UserProfile = {
        ...currentProfile,
        displayName: newDisplayName,
      };
      return actor.saveCallerUserProfile(updatedProfile);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      await queryClient.refetchQueries({ queryKey: ['currentUserProfile'], type: 'active' });
    },
  });
}

export function useAssignTeamRole() {
  const queryClient = useQueryClient();
  const { actor } = useActor();
  
  return useMutation({
    mutationFn: async ({ role, teamId, clubId }: { role: UserRole; teamId: string; clubId: string | null }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.assignTeamRole(role, teamId, clubId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] }),
        queryClient.invalidateQueries({ queryKey: ['teamMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['clubMembers'] }),
      ]);
      await queryClient.refetchQueries({ queryKey: ['currentUserProfile'], type: 'active' });
    },
  });
}

export function useRemoveTeamRole() {
  const queryClient = useQueryClient();
  const { actor } = useActor();
  
  return useMutation({
    mutationFn: async ({ role, teamId, clubId }: { role: UserRole; teamId: string; clubId: string | null }) => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('[Remove Team Role] Removing role:', { role, teamId, clubId });
      
      await actor.removeTeamRole(role, teamId);
      
      console.log('[Remove Team Role] Role removed from profile, now updating indexes');
      
      return { role, teamId, clubId };
    },
    onSuccess: async (data) => {
      console.log('[Remove Team Role] Invalidating queries after role removal');
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] }),
        queryClient.invalidateQueries({ queryKey: ['teamMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['teamMembers', data.teamId] }),
        queryClient.invalidateQueries({ queryKey: ['clubMembers'] }),
        data.clubId ? queryClient.invalidateQueries({ queryKey: ['clubMembers', data.clubId] }) : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: ['allClubMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['allTeamMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
      ]);
      
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['currentUserProfile'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['teams', 'user'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['teamMembers', data.teamId], type: 'active' }),
        data.clubId ? queryClient.refetchQueries({ queryKey: ['clubMembers', data.clubId], type: 'active' }) : Promise.resolve(),
      ]);
      
      console.log('[Remove Team Role] All queries invalidated and refetched');
    },
  });
}

