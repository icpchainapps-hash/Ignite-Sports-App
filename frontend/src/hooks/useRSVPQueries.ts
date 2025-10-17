import { useQuery } from '@tanstack/react-query';
import { useActor } from './useActor';
import { Principal } from '@dfinity/principal';
import { UserProfile, RSVP as BackendRSVP, ChildProfile } from '../backend';

export interface RSVPWithUser {
  eventId: string;
  userId: string;
  userName: string;
  status: any;
  timestamp: bigint;
  isChildProfile?: boolean;
  childProfileId?: string;
}

export function useGetRSVPsByEvent(eventId: string) {
  const { actor, isFetching } = useActor();
  
  return useQuery<RSVPWithUser[]>({
    queryKey: ['rsvps', 'event', eventId],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('🔍 [GET RSVPs] Fetching RSVPs for event:', eventId);
      
      try {
        const rsvps: BackendRSVP[] = await actor.getRSVPsByEvent(eventId);
        console.log('✅ [GET RSVPs] Received RSVPs:', rsvps.length);
        
        // Deduplicate RSVPs by userId, keeping the most recent
        const rsvpMap = new Map<string, BackendRSVP>();
        for (const rsvp of rsvps) {
          const userId = rsvp.userId.toString();
          const existing = rsvpMap.get(userId);
          
          if (!existing || rsvp.timestamp > existing.timestamp) {
            rsvpMap.set(userId, rsvp);
          }
        }
        
        const deduplicatedRsvps = Array.from(rsvpMap.values());
        console.log('✅ [GET RSVPs] Deduplicated RSVPs:', deduplicatedRsvps.length);
        
        // Get unique user IDs
        const userIds = [...new Set(deduplicatedRsvps.map(rsvp => rsvp.userId.toString()))];
        
        // Fetch user profiles
        const userProfiles = new Map<string, UserProfile | null>();
        for (const userId of userIds) {
          try {
            const userPrincipal = Principal.fromText(userId);
            const profile = await actor.getUserProfile(userPrincipal);
            userProfiles.set(userId, profile);
          } catch (error) {
            console.error(`Failed to fetch profile for user ${userId}:`, error);
            userProfiles.set(userId, null);
          }
        }
        
        // Fetch all child profiles to match RSVPs
        let allChildProfiles: ChildProfile[] = [];
        try {
          // Get child profiles for all parents who have RSVPs
          for (const userId of userIds) {
            try {
              const userPrincipal = Principal.fromText(userId);
              const childProfiles = await actor.getChildProfilesByParent();
              allChildProfiles = [...allChildProfiles, ...childProfiles];
            } catch (error) {
              // User might not have child profiles or not be a parent
              console.log(`No child profiles for user ${userId}`);
            }
          }
        } catch (error) {
          console.error('Error fetching child profiles:', error);
        }
        
        // Map RSVPs to include user names and child profile information
        const rsvpsWithUsers: RSVPWithUser[] = deduplicatedRsvps.map(rsvp => {
          const userId = rsvp.userId.toString();
          const profile = userProfiles.get(userId);
          
          // Check if this RSVP is for a child profile
          // Child RSVPs are stored with the parent's userId
          const matchingChild = allChildProfiles.find(child => 
            child.parentId.toString() === userId
          );
          
          let userName: string;
          let isChildProfile = false;
          let childProfileId: string | undefined;
          
          if (matchingChild) {
            // This is a child profile RSVP
            userName = `${matchingChild.name} (child)`;
            isChildProfile = true;
            childProfileId = matchingChild.id;
          } else {
            // Regular user RSVP
            userName = profile?.displayName || `User ${userId.slice(0, 8)}...`;
          }
          
          return {
            eventId: rsvp.eventId,
            userId,
            userName,
            status: rsvp.status,
            timestamp: rsvp.timestamp,
            isChildProfile,
            childProfileId,
          };
        });
        
        console.log('✅ [GET RSVPs] Processed RSVPs with user names:', rsvpsWithUsers.length);
        return rsvpsWithUsers;
      } catch (error: any) {
        console.error('❌ [GET RSVPs] Error fetching RSVPs:', error);
        throw new Error(`Failed to fetch RSVPs: ${error.message || String(error)}`);
      }
    },
    enabled: !!actor && !isFetching && !!eventId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}
