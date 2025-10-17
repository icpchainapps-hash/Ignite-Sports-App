import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import { useGetCallerUserProfile } from './useProfileQueries';
import { Club as BackendClub, ClubMember } from '../backend';
import { Club } from '../types';

export function useGetClubsByUser() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<Club[]>({
    queryKey: ['clubs', 'user'],
    queryFn: async () => {
      if (!actor || !identity) return [];
      
      console.log('[Clubs Query] Fetching clubs where user has a role...');
      
      // Use getMyTeamsAndClubs to get only clubs where user has a role
      const result = await actor.getMyTeamsAndClubs();
      console.log('[Clubs Query] User clubs from backend:', result.clubs.length, result.clubs.map(c => ({ id: c.id, name: c.name })));
      
      // Map backend clubs to frontend Club type with sport field
      const clubs: Club[] = result.clubs.map(club => ({
        ...club,
        sport: (club as any).sport || undefined,
      }));
      
      return clubs;
    },
    enabled: !!actor && !isFetching && !!identity,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function useGetClubsForTeamAdmin() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();

  return useQuery<Club[]>({
    queryKey: ['clubs', 'teamAdmin'],
    queryFn: async () => {
      if (!actor || !identity || !userProfile) {
        console.log('[Clubs Team Admin Query] Missing requirements:', { actor: !!actor, identity: !!identity, userProfile: !!userProfile });
        return [];
      }
      
      console.log('[Clubs Team Admin Query] Fetching clubs for team admin...');
      console.log('[Clubs Team Admin Query] User profile teamRoles:', userProfile.teamRoles);
      
      // Use getMyTeamsAndClubs to get only clubs where user has a role
      const result = await actor.getMyTeamsAndClubs();
      console.log('[Clubs Team Admin Query] User clubs from backend:', result.clubs.length);
      
      // Get all teams
      const allTeams = await actor.getAllTeams();
      console.log('[Clubs Team Admin Query] All teams from backend:', allTeams.length);
      
      // Find teams where user is an admin
      const principal = identity.getPrincipal();
      const adminTeams = allTeams.filter(team => 
        team.admins.some(admin => admin.toString() === principal.toString())
      );
      console.log('[Clubs Team Admin Query] Admin teams:', adminTeams.length, adminTeams.map(t => ({ id: t.id, name: t.name, clubId: t.clubId })));
      
      // Extract unique club IDs from admin teams
      const adminClubIds = new Set(adminTeams.map(team => team.clubId));
      console.log('[Clubs Team Admin Query] Admin club IDs:', Array.from(adminClubIds));
      
      // Filter user's clubs to only those where they are a team admin
      const adminClubs = result.clubs.filter(club => adminClubIds.has(club.id));
      console.log('[Clubs Team Admin Query] Filtered admin clubs:', adminClubs.length, adminClubs.map(c => ({ id: c.id, name: c.name })));
      
      // Map backend clubs to frontend Club type with sport field
      const clubs: Club[] = adminClubs.map(club => ({
        ...club,
        sport: (club as any).sport || undefined,
      }));
      
      return clubs;
    },
    enabled: !!actor && !isFetching && !!identity && !!userProfile && !profileLoading,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function useGetAllClubs() {
  const { actor, isFetching } = useActor();

  return useQuery<Club[]>({
    queryKey: ['clubs', 'all'],
    queryFn: async () => {
      if (!actor) return [];
      const clubs = await actor.getClubs();
      console.log('[All Clubs Query] Fetched clubs:', clubs.length);
      
      // Map backend clubs to frontend Club type with sport field
      const mappedClubs: Club[] = clubs.map(club => ({
        ...club,
        sport: (club as any).sport || undefined,
      }));
      
      return mappedClubs;
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function useGetClubMembers(clubId: string) {
  const { actor, isFetching } = useActor();

  return useQuery<ClubMember[]>({
    queryKey: ['clubMembers', clubId],
    queryFn: async () => {
      if (!actor) return [];
      console.log('[Club Members Query] Fetching members for club:', clubId);
      const members = await actor.getClubMembers(clubId);
      console.log('[Club Members Query] Fetched members:', members.length, members);
      return members;
    },
    enabled: !!actor && !isFetching && !!clubId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function useCreateClub() {
  const queryClient = useQueryClient();
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ name, sport, logoPath }: { name: string; sport: string; logoPath: string | null }) => {
      if (!actor) throw new Error('Actor not available');
      console.log('[Create Club] Creating club:', name, 'sport:', sport);
      const clubId = await actor.createClub(name, sport, logoPath ? logoPath : null);
      console.log('[Create Club] Club created with ID:', clubId);
      return clubId;
    },
    onSuccess: async (clubId) => {
      console.log('[Create Club] Invalidating queries after club creation');
      
      // Invalidate all club-related queries
      await queryClient.invalidateQueries({ queryKey: ['clubs'] });
      await queryClient.invalidateQueries({ queryKey: ['clubMembers'] });
      await queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      
      // Force immediate refetch of critical queries
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['clubs', 'user'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['clubs', 'teamAdmin'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['clubs', 'all'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['clubMembers', clubId], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['currentUserProfile'], type: 'active' }),
      ]);
      
      console.log('[Create Club] All queries refetched successfully');
    },
  });
}

export function useUpdateClub() {
  const queryClient = useQueryClient();
  const { actor } = useActor();

  return useMutation({
    mutationFn: async ({ clubId, updatedClub }: { clubId: string; updatedClub: BackendClub }) => {
      if (!actor) throw new Error('Actor not available');
      console.log('[Update Club] Updating club:', clubId);
      await actor.updateClub(clubId, updatedClub);
    },
    onSuccess: async (_, { clubId }) => {
      console.log('[Update Club] Invalidating queries after club update');
      await queryClient.invalidateQueries({ queryKey: ['clubs'] });
      await queryClient.invalidateQueries({ queryKey: ['clubMembers', clubId] });
      
      // Force immediate refetch of queries
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['clubs', 'user'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['clubs', 'teamAdmin'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['clubs', 'all'], type: 'active' }),
      ]);
    },
  });
}

export function useDeleteClub() {
  const queryClient = useQueryClient();
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (clubId: string) => {
      if (!actor) throw new Error('Actor not available');
      console.log('[Delete Club] Deleting club and all associated data (teams, events, threads, roles):', clubId);
      await actor.deleteClub(clubId);
      console.log('[Delete Club] Club and all associated data deleted successfully');
    },
    onSuccess: async () => {
      console.log('[Delete Club] Invalidating all related queries after cascading club deletion');
      // Invalidate all queries that might be affected by club deletion
      await Promise.all([
        // Club-related queries
        queryClient.invalidateQueries({ queryKey: ['clubs'] }),
        queryClient.invalidateQueries({ queryKey: ['clubMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['allClubMembers'] }),
        
        // Team-related queries (teams are deleted with the club)
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
        queryClient.invalidateQueries({ queryKey: ['teamMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['allTeamMembers'] }),
        queryClient.invalidateQueries({ queryKey: ['teamsWithClubs'] }),
        queryClient.invalidateQueries({ queryKey: ['callerTeamsAndClubs'] }),
        
        // User profile queries (roles are removed)
        queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] }),
        queryClient.invalidateQueries({ queryKey: ['userProfile'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        
        // Event queries (events are deleted)
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        queryClient.invalidateQueries({ queryKey: ['rsvps'] }),
        
        // Message queries (threads are deleted)
        queryClient.invalidateQueries({ queryKey: ['chatThreads'] }),
        queryClient.invalidateQueries({ queryKey: ['messages'] }),
        
        // Child profile queries (associations are removed)
        queryClient.invalidateQueries({ queryKey: ['childProfiles'] }),
        
        // Join request queries (requests are deleted)
        queryClient.invalidateQueries({ queryKey: ['joinRequests'] }),
        
        // Notification queries (notifications are cleaned up)
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] }),
      ]);
      
      // Refetch active queries to update UI immediately
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['clubs', 'user'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['clubs', 'teamAdmin'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['clubs', 'all'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['teams', 'user'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['teams', 'admin'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['teamsWithClubs', 'user'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['currentUserProfile'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['notifications'], type: 'active' }),
      ]);
      
      console.log('[Delete Club] All queries invalidated and refetched successfully');
    },
    onError: (error: any) => {
      console.error('[Delete Club] Error during club deletion:', error);
      throw error;
    },
  });
}
