import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { JoinRequest, UserRole } from '../backend';
import { useGetCallerUserProfile } from './useProfileQueries';
import { useGetAllClubs } from './useClubsQueries';
import { useGetAllTeams } from './useTeamsQueries';

export function useGetJoinRequestsByTeam(teamId: string) {
  const { actor, isFetching } = useActor();

  return useQuery<JoinRequest[]>({
    queryKey: ['joinRequests', 'team', teamId],
    queryFn: async () => {
      if (!actor) return [];
      console.log('[Join Requests Query] Fetching join requests for team:', teamId);
      const requests = await actor.getJoinRequestsByTeam(teamId);
      console.log('[Join Requests Query] Fetched requests:', requests.length);
      return requests;
    },
    enabled: !!actor && !isFetching && !!teamId,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useGetJoinRequestsByUser() {
  const { actor, isFetching } = useActor();

  return useQuery<JoinRequest[]>({
    queryKey: ['joinRequests', 'user'],
    queryFn: async () => {
      if (!actor) return [];
      console.log('[Join Requests Query] Fetching join requests for current user');
      const requests = await actor.getJoinRequestsByUser();
      console.log('[Join Requests Query] Fetched requests:', requests.length);
      return requests;
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useGetJoinRequestsByTeamAdmin() {
  const { actor, isFetching } = useActor();
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
  const { data: allClubs = [], isLoading: clubsLoading } = useGetAllClubs();
  const { data: allTeams = [], isLoading: teamsLoading } = useGetAllTeams();

  return useQuery({
    queryKey: ['joinRequests', 'teamAdmin'],
    queryFn: async () => {
      if (!actor || !userProfile) return [];
      
      const adminTeamIds = userProfile.teamRoles
        .filter(tr => tr.role === 'teamAdmin')
        .map(tr => tr.teamId);
      
      if (adminTeamIds.length === 0) {
        return [];
      }
      
      const allRequests: any[] = [];
      for (const teamId of adminTeamIds) {
        const requests = await actor.getJoinRequestsByTeam(teamId);
        allRequests.push(...requests);
      }
      
      // Fetch user profiles to get display names
      const userProfilesMap = new Map<string, string>();
      for (const request of allRequests) {
        try {
          const profile = await actor.getUserProfile(request.userId);
          if (profile) {
            userProfilesMap.set(request.userId.toString(), profile.displayName);
          }
        } catch (error) {
          console.error('Failed to fetch user profile for:', request.userId.toString(), error);
        }
      }
      
      const enhancedRequests = allRequests.map(request => {
        const team = allTeams.find(t => t.id === request.teamId);
        const club = team ? allClubs.find(c => c.id === team.clubId) : null;
        const userIdStr = request.userId.toString();
        const displayName = userProfilesMap.get(userIdStr);
        
        return {
          ...request,
          userName: displayName || (userIdStr.slice(0, 10) + '...'),
          teamName: team?.name || 'Unknown Team',
          clubName: club?.name || 'Unknown Club',
          createdAt: request.timestamp,
        };
      });
      
      return enhancedRequests;
    },
    enabled: !!actor && !isFetching && !!userProfile && !profileLoading && !clubsLoading && !teamsLoading,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useSubmitJoinRequest() {
  const queryClient = useQueryClient();
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ teamId, requestedRole }: { teamId: string; requestedRole: UserRole }) => {
      if (!actor) throw new Error('Actor not available');
      
      // Get the team to find its clubId
      const allTeams = await actor.getAllTeams();
      const team = allTeams.find(t => t.id === teamId);
      if (!team) throw new Error('Team not found');
      
      console.log('[Submit Join Request] Submitting request for team:', teamId, 'club:', team.clubId, 'role:', requestedRole);
      await actor.submitJoinRequest(teamId, team.clubId, requestedRole);
    },
    onSuccess: async () => {
      console.log('[Submit Join Request] Invalidating queries after request submission');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['joinRequests'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
  });
}

export function useApproveJoinRequest() {
  const queryClient = useQueryClient();
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (requestId: string) => {
      if (!actor) throw new Error('Actor not available');
      console.log('[Approve Join Request] Approving request:', requestId);
      await actor.approveJoinRequest(requestId);
    },
    onSuccess: async () => {
      console.log('[Approve Join Request] Request approved, invalidating and refetching all related queries');
      
      // Immediately invalidate all relevant queries to ensure fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['joinRequests'] }),
        queryClient.invalidateQueries({ queryKey: ['teamMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['clubMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['allTeamMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['allClubMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
        queryClient.invalidateQueries({ queryKey: ['teamsWithClubs'] }),
        queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] }),
        queryClient.invalidateQueries({ queryKey: ['clubs'] }),
      ]);
      
      // Wait a moment for backend to complete all updates
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refetch in sequence to ensure data consistency
      console.log('[Approve Join Request] Refetching queries in sequence');
      await queryClient.refetchQueries({ queryKey: ['joinRequests'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['notifications'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['unreadNotificationCount'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['teams', 'user'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['teams', 'admin'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['teamsWithClubs', 'user'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['allTeamMembers'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['allClubMembers'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['clubs', 'user'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['clubs', 'teamAdmin'], type: 'active' });
      
      console.log('[Approve Join Request] All queries refetched successfully');
    },
  });
}

export function useRejectJoinRequest() {
  const queryClient = useQueryClient();
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (requestId: string) => {
      if (!actor) throw new Error('Actor not available');
      console.log('[Reject Join Request] Rejecting request:', requestId);
      await actor.rejectJoinRequest(requestId);
    },
    onSuccess: async () => {
      console.log('[Reject Join Request] Invalidating queries after rejection');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['joinRequests'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] }),
      ]);
    },
  });
}

export function useRejectAllJoinRequests() {
  const queryClient = useQueryClient();
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (requestIds: string[]) => {
      if (!actor) throw new Error('Actor not available');
      console.log('[Reject All Join Requests] Rejecting requests:', requestIds);
      
      // Reject all requests in parallel
      await Promise.all(
        requestIds.map(requestId => actor.rejectJoinRequest(requestId))
      );
    },
    onSuccess: async () => {
      console.log('[Reject All Join Requests] All requests rejected, invalidating queries');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['joinRequests'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] }),
      ]);
    },
  });
}
