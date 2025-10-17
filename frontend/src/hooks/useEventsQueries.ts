import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { Event, EventType, Address, Coordinates, RSVPStatus } from '../backend';

export function useGetEventsByTeam(teamId: string) {
  const { actor, isFetching } = useActor();
  
  return useQuery<Event[]>({
    queryKey: ['events', 'team', teamId],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('🔍 [GET EVENTS] Fetching events for team:', teamId);
      
      try {
        const events = await actor.getEventsByTeam(teamId);
        console.log('✅ [GET EVENTS] Received events:', events.length);
        
        const filteredEvents = events.filter((event: Event) => event.teamId === teamId);
        console.log('✅ [GET EVENTS] Filtered events for team:', filteredEvents.length);
        
        return filteredEvents;
      } catch (error: any) {
        console.error('❌ [GET EVENTS] Error fetching events:', error);
        throw new Error(`Failed to fetch events: ${error.message || String(error)}`);
      }
    },
    enabled: !!actor && !isFetching && !!teamId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function useGetEvent(eventId: string) {
  const { actor, isFetching } = useActor();
  
  return useQuery<Event | null>({
    queryKey: ['event', eventId],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getEvent(eventId);
    },
    enabled: !!actor && !isFetching && !!eventId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreateEvent() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      title, 
      eventType, 
      dateTime, 
      location, 
      coordinates, 
      description, 
      teamId 
    }: { 
      title: string; 
      eventType: EventType; 
      dateTime: bigint; 
      location: Address; 
      coordinates: Coordinates; 
      description: string; 
      teamId: string;
    }) => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('➕ [CREATE EVENT MUTATION] Starting event creation');
      
      try {
        const eventId = await actor.createEvent(
          title, 
          eventType, 
          dateTime, 
          location, 
          coordinates, 
          description, 
          teamId
        );
        
        console.log('✅ [CREATE EVENT MUTATION] Event created successfully with ID:', eventId);
        
        return { eventId, teamId };
      } catch (error: any) {
        console.error('❌ [CREATE EVENT MUTATION] Backend error:', error);
        
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized')) {
          throw new Error('You do not have permission to create events for this team');
        } else if (errorMessage.includes('not found')) {
          throw new Error('The selected team could not be found');
        } else {
          throw new Error(`Failed to create event: ${errorMessage}`);
        }
      }
    },
    onSuccess: async (data) => {
      console.log('✅ [CREATE EVENT MUTATION] Success callback - invalidating queries');
      
      await queryClient.invalidateQueries({ queryKey: ['events', 'team', data.teamId] });
      await queryClient.invalidateQueries({ queryKey: ['rsvps'] });
      await queryClient.refetchQueries({ queryKey: ['events', 'team', data.teamId] });
    },
  });
}

export function useUpdateEvent() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ eventId, updatedEvent }: { eventId: string; updatedEvent: Event }) => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('✏️ [UPDATE EVENT MUTATION] Updating event:', eventId);
      
      try {
        await actor.updateEvent(eventId, updatedEvent);
        console.log('✅ [UPDATE EVENT MUTATION] Event updated successfully');
        return { eventId, teamId: updatedEvent.teamId };
      } catch (error: any) {
        console.error('❌ [UPDATE EVENT MUTATION] Backend error:', error);
        throw new Error(`Failed to update event: ${error.message || String(error)}`);
      }
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['event', data.eventId] });
      await queryClient.invalidateQueries({ queryKey: ['events', 'team', data.teamId] });
      await queryClient.refetchQueries({ queryKey: ['events', 'team', data.teamId] });
    },
  });
}

export function useDeleteEvent() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ eventId, teamId }: { eventId: string; teamId: string }) => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('🗑️ [DELETE EVENT MUTATION] Deleting event:', eventId);
      
      try {
        await actor.deleteEvent(eventId);
        console.log('✅ [DELETE EVENT MUTATION] Event deleted successfully');
        return { eventId, teamId };
      } catch (error: any) {
        console.error('❌ [DELETE EVENT MUTATION] Backend error:', error);
        throw new Error(`Failed to delete event: ${error.message || String(error)}`);
      }
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['event', data.eventId] });
      await queryClient.invalidateQueries({ queryKey: ['events', 'team', data.teamId] });
      await queryClient.refetchQueries({ queryKey: ['events', 'team', data.teamId] });
    },
  });
}

export function useUpdateRSVP() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation<{ eventId: string; status: RSVPStatus }, Error, { eventId: string; status: RSVPStatus }>({
    mutationFn: async ({ eventId, status }: { eventId: string; status: RSVPStatus }): Promise<{ eventId: string; status: RSVPStatus }> => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('📝 [UPDATE RSVP] Updating RSVP for event:', eventId, 'with status:', status);
      
      try {
        await actor.updateRSVPStatus(eventId, status);
        console.log('✅ [UPDATE RSVP] RSVP updated successfully');
        return { eventId, status };
      } catch (error: any) {
        console.error('❌ [UPDATE RSVP] Backend error:', error);
        const errorMessage = error?.message || String(error);
        throw new Error(`Failed to update RSVP: ${errorMessage}`);
      }
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['rsvps', 'event', data.eventId] });
      await queryClient.refetchQueries({ 
        queryKey: ['rsvps', 'event', data.eventId],
        type: 'active'
      });
    },
  });
}
