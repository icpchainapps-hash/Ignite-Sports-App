import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import { Team, TeamMember, Club } from '../backend';
import { useGetCallerUserProfile } from './useProfileQueries';
import { useGetAllClubs } from './useClubsQueries';

export function useGetTeamsByUser() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();

  return useQuery<Team[]>({
    queryKey: ['teams', 'user'],
    queryFn: async () => {
      if (!actor || !identity || !userProfile) return [];
      
      console.log('[Teams Query] Fetching user teams using profile teamRoles...');
      console.log('[Teams Query] User profile teamRoles:', userProfile.teamRoles);
      
      // Get all teams
      const allTeams = await actor.getAllTeams();
      console.log('[Teams Query] All teams from backend:', allTeams.length);
      
      // Filter teams where user has a role (from teamRoles in profile)
      const userTeamIds = new Set(userProfile.teamRoles.map(tr => tr.teamId));
      console.log('[Teams Query] User team IDs from profile:', Array.from(userTeamIds));
      
      const userTeams = allTeams.filter(team => userTeamIds.has(team.id));
      console.log('[Teams Query] Filtered user teams:', userTeams.length, userTeams.map(t => ({ id: t.id, name: t.name })));
      
      return userTeams;
    },
    enabled: !!actor && !isFetching && !!identity && !!userProfile && !profileLoading,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useGetTeamsForAdmin() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<Team[]>({
    queryKey: ['teams', 'admin'],
    queryFn: async () => {
      if (!actor || !identity) {
        console.log('[Teams Admin Query] Missing requirements:', { actor: !!actor, identity: !!identity });
        return [];
      }
      
      console.log('[Teams Admin Query] Fetching teams where user is admin...');
      
      // Get all teams
      const allTeams = await actor.getAllTeams();
      console.log('[Teams Admin Query] All teams from backend:', allTeams.length);
      
      // Filter teams where user is an admin
      const principal = identity.getPrincipal();
      const adminTeams = allTeams.filter(team => 
        team.admins.some(admin => admin.toString() === principal.toString())
      );
      console.log('[Teams Admin Query] Admin teams:', adminTeams.length, adminTeams.map(t => ({ id: t.id, name: t.name, clubId: t.clubId })));
      
      return adminTeams;
    },
    enabled: !!actor && !isFetching && !!identity,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useGetTeamsWithClubs() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
  const { data: allClubs = [], isLoading: clubsLoading } = useGetAllClubs();

  return useQuery<Array<{ team: Team; club: Club | null }>>({
    queryKey: ['teamsWithClubs', 'user'],
    queryFn: async () => {
      if (!actor || !identity || !userProfile) return [];
      
      console.log('[Teams With Clubs Query] Fetching user teams with club details...');
      console.log('[Teams With Clubs Query] User profile teamRoles:', userProfile.teamRoles);
      
      // Get all teams
      const allTeams = await actor.getAllTeams();
      console.log('[Teams With Clubs Query] All teams from backend:', allTeams.length);
      
      // Filter teams where user has a role (from teamRoles in profile)
      const userTeamIds = new Set(userProfile.teamRoles.map(tr => tr.teamId));
      console.log('[Teams With Clubs Query] User team IDs from profile:', Array.from(userTeamIds));
      
      const userTeams = allTeams.filter(team => userTeamIds.has(team.id));
      console.log('[Teams With Clubs Query] Filtered user teams:', userTeams.length);
      
      // Map each team to include its club information
      const teamsWithClubs = userTeams.map(team => {
        const club = allClubs.find(c => c.id === team.clubId) || null;
        return { team, club };
      });
      
      console.log('[Teams With Clubs Query] Processed result:', teamsWithClubs.map(r => ({
        teamId: r.team.id,
        teamName: r.team.name,
        clubId: r.team.clubId,
        clubName: r.club?.name || 'Unknown',
      })));
      
      return teamsWithClubs;
    },
    enabled: !!actor && !isFetching && !!identity && !!userProfile && !profileLoading && !clubsLoading,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useGetCallerTeamsAndClubs() {
  const { actor, isFetching } = useActor();
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
  const { data: allClubs = [], isLoading: clubsLoading } = useGetAllClubs();

  return useQuery<{ teams: Team[]; clubs: Club[] }>({
    queryKey: ['callerTeamsAndClubs'],
    queryFn: async () => {
      if (!actor || !userProfile) return { teams: [], clubs: [] };
      
      const result = await actor.getMyTeamsAndClubs();
      return result;
    },
    enabled: !!actor && !isFetching && !!userProfile && !profileLoading && !clubsLoading,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useGetAllTeams() {
  const { actor, isFetching } = useActor();

  return useQuery<Team[]>({
    queryKey: ['teams', 'all'],
    queryFn: async () => {
      if (!actor) return [];
      const teams = await actor.getAllTeams();
      console.log('[All Teams Query] Fetched all teams:', teams.length);
      return teams;
    },
    enabled: !!actor && !isFetching,
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useGetTeamMembers(teamId: string) {
  const { actor, isFetching } = useActor();

  return useQuery<TeamMember[]>({
    queryKey: ['teamMembers', teamId],
    queryFn: async () => {
      if (!actor) return [];
      console.log('[Team Members Query] Fetching members for team:', teamId);
      const members = await actor.getTeamMembers(teamId);
      console.log('[Team Members Query] Fetched members:', members.length, members);
      return members;
    },
    enabled: !!actor && !isFetching && !!teamId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useGetAllTeamMembers() {
  const { actor, isFetching } = useActor();

  return useQuery<TeamMember[]>({
    queryKey: ['allTeamMembers'],
    queryFn: async () => {
      if (!actor) return [];
      console.log('[All Team Members Query] Fetching all team members');
      const members = await actor.getAllTeamMembers();
      console.log('[All Team Members Query] Fetched members:', members.length);
      return members;
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ name, clubId }: { name: string; clubId: string }) => {
      if (!actor) throw new Error('Actor not available');
      console.log('[Create Team] Creating team:', name, 'for club:', clubId);
      const teamId = await actor.createTeam(name, clubId);
      console.log('[Create Team] Team created with ID:', teamId);
      
      return { teamId, clubId };
    },
    onSuccess: async ({ teamId, clubId }) => {
      console.log('[Create Team] Invalidating and refetching queries after team creation');
      
      // Invalidate all relevant queries
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      await queryClient.invalidateQueries({ queryKey: ['teamsWithClubs'] });
      await queryClient.invalidateQueries({ queryKey: ['callerTeamsAndClubs'] });
      await queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      await queryClient.invalidateQueries({ queryKey: ['clubMembers'] });
      await queryClient.invalidateQueries({ queryKey: ['allTeamMembers'] });
      await queryClient.invalidateQueries({ queryKey: ['allClubMembers'] });
      await queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      await queryClient.invalidateQueries({ queryKey: ['clubs'] });
      
      // Refetch in sequence
      await queryClient.refetchQueries({ queryKey: ['currentUserProfile'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['teams', 'user'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['teams', 'admin'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['teamsWithClubs', 'user'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['teams', 'all'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['teamMembers', teamId], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['clubMembers', clubId], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['allClubMembers'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['allTeamMembers'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['clubs', 'teamAdmin'], type: 'active' });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ teamId, updatedTeam }: { teamId: string; updatedTeam: Team }) => {
      if (!actor) throw new Error('Actor not available');
      console.log('[Update Team] Updating team:', teamId);
      await actor.updateTeam(teamId, updatedTeam);
    },
    onSuccess: async (_, { teamId, updatedTeam }) => {
      console.log('[Update Team] Invalidating queries after team update');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
        queryClient.invalidateQueries({ queryKey: ['teamsWithClubs'] }),
        queryClient.invalidateQueries({ queryKey: ['teamMembers', teamId] }),
        queryClient.invalidateQueries({ queryKey: ['clubMembers', updatedTeam.clubId] }),
        queryClient.invalidateQueries({ queryKey: ['allTeamMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['clubs'] }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['teams', 'user'] }),
        queryClient.refetchQueries({ queryKey: ['teams', 'admin'] }),
        queryClient.refetchQueries({ queryKey: ['teamsWithClubs', 'user'] }),
        queryClient.refetchQueries({ queryKey: ['teams', 'all'] }),
        queryClient.refetchQueries({ queryKey: ['teamMembers', teamId] }),
        queryClient.refetchQueries({ queryKey: ['allTeamMembers'] }),
        queryClient.refetchQueries({ queryKey: ['clubs', 'teamAdmin'] }),
      ]);
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (teamId: string) => {
      if (!actor) throw new Error('Actor not available');
      console.log('[Delete Team] Deleting team and all associated data:', teamId);
      await actor.deleteTeam(teamId);
      console.log('[Delete Team] Team deleted successfully');
    },
    onSuccess: async () => {
      console.log('[Delete Team] Invalidating queries after team deletion');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
        queryClient.invalidateQueries({ queryKey: ['teamsWithClubs'] }),
        queryClient.invalidateQueries({ queryKey: ['teamMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['clubMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] }),
        queryClient.invalidateQueries({ queryKey: ['allTeamMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['clubs'] }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        queryClient.invalidateQueries({ queryKey: ['chatThreads'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['teams', 'user'] }),
        queryClient.refetchQueries({ queryKey: ['teams', 'admin'] }),
        queryClient.refetchQueries({ queryKey: ['teamsWithClubs', 'user'] }),
        queryClient.refetchQueries({ queryKey: ['teams', 'all'] }),
        queryClient.refetchQueries({ queryKey: ['allTeamMembers'] }),
        queryClient.refetchQueries({ queryKey: ['clubs', 'teamAdmin'] }),
        queryClient.refetchQueries({ queryKey: ['currentUserProfile'] }),
      ]);
      console.log('[Delete Team] All queries invalidated and refetched successfully');
    },
    onError: (error: any) => {
      console.error('[Delete Team] Error during team deletion:', error);
      throw error;
    },
  });
}
