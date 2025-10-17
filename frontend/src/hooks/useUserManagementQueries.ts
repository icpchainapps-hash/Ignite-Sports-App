import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useGetCallerUserProfile } from './useProfileQueries';
import { UserProfile, UserRole } from '../backend';
import { Principal } from '@dfinity/principal';

export function useGetAllUsers() {
  const { actor, isFetching } = useActor();
  const { data: userProfile } = useGetCallerUserProfile();
  
  return useQuery<UserProfile[]>({
    queryKey: ['allUsers'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      
      try {
        const users = await actor.getAllUsers();
        return users;
      } catch (error: any) {
        throw new Error(`Failed to fetch users: ${error.message || String(error)}`);
      }
    },
    enabled: !!actor && !isFetching && !!userProfile && userProfile.roles?.includes(UserRole.appAdmin),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useAssignRoleToUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ user, role }: { user: Principal; role: UserRole }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.assignRoleToUser(user, role);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      await queryClient.refetchQueries({ queryKey: ['allUsers'] });
    },
  });
}

export function useRemoveRoleFromUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ user, role }: { user: Principal; role: UserRole }) => {
      if (!actor) throw new Error('Actor not available');
      
      // Use removeRoleFromUserProfile which is the available backend method
      await actor.removeRoleFromUserProfile(role);
      
      const updatedUsers = await actor.getAllUsers();
      const targetUser = updatedUsers.find((u: UserProfile) => u.username === user.toString());
      
      if (targetUser && targetUser.roles?.includes(role)) {
        throw new Error('Role removal failed due to a backend issue. The role was not actually removed. Please contact support.');
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      await queryClient.refetchQueries({ queryKey: ['allUsers'], type: 'active' });
    },
  });
}

export function useAssignTeamRoleToUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ user, role, teamId, clubId }: { user: Principal; role: UserRole; teamId: string; clubId: string | null }) => {
      if (!actor) throw new Error('Actor not available');
      // Use assignTeamRole which is the available backend method
      await actor.assignTeamRole(role, teamId, clubId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      await queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      await queryClient.invalidateQueries({ queryKey: ['clubMembers'] });
      await queryClient.refetchQueries({ queryKey: ['allUsers'] });
    },
  });
}

export function useRemoveTeamRoleFromUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ user, role, teamId }: { user: Principal; role: UserRole; teamId: string }) => {
      if (!actor) throw new Error('Actor not available');
      // Use removeTeamRole which is the available backend method
      await actor.removeTeamRole(role, teamId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      await queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      await queryClient.invalidateQueries({ queryKey: ['clubMembers'] });
      await queryClient.refetchQueries({ queryKey: ['allUsers'] });
    },
  });
}
