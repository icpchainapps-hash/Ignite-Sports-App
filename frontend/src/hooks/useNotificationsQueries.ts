import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { UserRole } from '../backend';
import { useGetAllTeams } from './useTeamsQueries';

// Frontend-friendly notification types
export interface EventInvitationNotification {
  id: string;
  eventId: string;
  eventTitle: string;
  eventType: any;
  eventDateTime: bigint;
  teamId: string;
  teamName: string;
  timestamp: bigint;
  read: boolean;
}

export interface JoinRequestNotification {
  id: string;
  teamId: string;
  teamName: string;
  requestedRole: UserRole;
  message: string;
  timestamp: bigint;
  read: boolean;
}

export interface JoinRequestApprovalNotification {
  id: string;
  teamId: string;
  teamName: string;
  approvedRole: UserRole;
  message: string;
  timestamp: bigint;
  read: boolean;
}

export interface MessageNotification {
  id: string;
  threadId: string;
  threadTitle: string;
  messageId: string;
  senderId: string;
  senderName: string;
  messagePreview: string;
  timestamp: bigint;
  read: boolean;
}

export interface RSVPResponseNotification {
  id: string;
  eventId: string;
  eventTitle: string;
  eventType: any;
  eventDateTime: bigint;
  responderName: string;
  rsvpStatus: string;
  timestamp: bigint;
  read: boolean;
  isTeamAdminNotification?: boolean;
}

export interface Notification {
  id: string;
  type: 'eventInvitation' | 'joinRequest' | 'joinRequestApproval' | 'messageNotification' | 'rsvpResponse';
  data: EventInvitationNotification | JoinRequestNotification | JoinRequestApprovalNotification | MessageNotification | RSVPResponseNotification;
  timestamp: bigint;
  read: boolean;
}

// Persistent storage key for cleared notification IDs
const CLEARED_NOTIFICATIONS_KEY = 'ignite_cleared_notifications';

// Load cleared notification IDs from localStorage
function loadClearedNotificationIds(): Set<string> {
  try {
    const stored = localStorage.getItem(CLEARED_NOTIFICATIONS_KEY);
    if (stored) {
      const ids = JSON.parse(stored);
      return new Set(ids);
    }
  } catch (error) {
    console.error('Failed to load cleared notification IDs:', error);
  }
  return new Set<string>();
}

// Save cleared notification IDs to localStorage
function saveClearedNotificationIds(ids: Set<string>): void {
  try {
    localStorage.setItem(CLEARED_NOTIFICATIONS_KEY, JSON.stringify(Array.from(ids)));
  } catch (error) {
    console.error('Failed to save cleared notification IDs:', error);
  }
}

// Track cleared notification IDs to prevent them from reappearing
let clearedNotificationIds = loadClearedNotificationIds();

// Add notification IDs to the cleared set
function addClearedNotificationIds(ids: string[]): void {
  ids.forEach(id => clearedNotificationIds.add(id));
  saveClearedNotificationIds(clearedNotificationIds);
}

// Clear all cleared notification IDs (for testing/debugging)
export function clearAllClearedNotificationIds(): void {
  clearedNotificationIds.clear();
  localStorage.removeItem(CLEARED_NOTIFICATIONS_KEY);
}

/**
 * Hook to fetch all notifications for the current user from the dedicated notifications service
 * Enriches notifications with team/event/thread data for display
 * Notifications are sorted by timestamp in descending order (most recent first)
 * 
 * NOTE: Currently returns empty array as backend notification getter methods are not yet exposed
 */
export function useGetNotifications() {
  const { actor, isFetching: actorFetching } = useActor();
  const { data: allTeams = [], isLoading: teamsLoading } = useGetAllTeams();

  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');

      try {
        // TODO: Backend needs to expose getNotificationsByUser() method
        // For now, return empty array
        console.warn('Notification getter methods not yet available in backend interface');
        return [];
      } catch (error: any) {
        console.error('Failed to fetch notifications:', error);
        return [];
      }
    },
    enabled: !!actor && !actorFetching && !teamsLoading,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
    retry: 2,
  });
}

/**
 * Hook to fetch the count of unread notifications from the dedicated notifications service
 * 
 * NOTE: Currently returns 0 as backend notification count method is not yet exposed
 */
export function useGetUnreadNotificationCount() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<number>({
    queryKey: ['unreadNotificationCount'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');

      try {
        // TODO: Backend needs to expose getUnreadNotificationsCount() method
        // For now, return 0
        console.warn('Notification count method not yet available in backend interface');
        return 0;
      } catch (error: any) {
        console.error('Failed to fetch unread notification count:', error);
        return 0;
      }
    },
    enabled: !!actor && !actorFetching,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
    retry: 2,
  });
}

/**
 * Hook to mark a notification as read via the dedicated notifications service
 * NOTE: Backend method not yet exposed, so this is a no-op for now
 */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      // TODO: Backend needs to expose markNotificationAsRead() method
      console.warn('markNotificationAsRead not yet available in backend interface');
      // For now, just return success
      return;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] });
    },
    onError: (error: any) => {
      console.error('Error marking notification as read:', error);
    },
  });
}

/**
 * Hook to clear all notifications in a specific category with immediate UI updates
 */
export function useClearNotificationsByCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: 'messages' | 'events' | 'approvals' | 'requests') => {
      try {
        // Get current notifications from cache
        const notifications = queryClient.getQueryData<Notification[]>(['notifications']) || [];
        
        // Filter notifications by category
        let notificationsToMark: Notification[] = [];
        
        switch (category) {
          case 'messages':
            notificationsToMark = notifications.filter(n => n.type === 'messageNotification');
            break;
          case 'events':
            notificationsToMark = notifications.filter(n => n.type === 'eventInvitation' || n.type === 'rsvpResponse');
            break;
          case 'approvals':
            notificationsToMark = notifications.filter(n => n.type === 'joinRequestApproval');
            break;
          case 'requests':
            notificationsToMark = notifications.filter(n => n.type === 'joinRequest');
            break;
        }

        // Add notification IDs to the cleared set to prevent them from reappearing
        const idsToAdd = notificationsToMark.map(n => n.id);
        addClearedNotificationIds(idsToAdd);

        // TODO: Backend needs to expose markNotificationAsRead() method
        // For now, just mark them as cleared in frontend
        console.warn('markNotificationAsRead not yet available in backend interface');

        return category;
      } catch (error: any) {
        console.error('Failed to clear notifications:', error);
        throw new Error(`Failed to clear ${category} notifications: ${error.message || 'Unknown error'}`);
      }
    },
    onMutate: async (category) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      await queryClient.cancelQueries({ queryKey: ['unreadNotificationCount'] });

      // Snapshot the previous values
      const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications']);
      const previousCount = queryClient.getQueryData<number>(['unreadNotificationCount']);

      // Optimistically update the cache - remove notifications from the category immediately
      if (previousNotifications) {
        let filteredNotifications: Notification[] = [];
        
        switch (category) {
          case 'messages':
            filteredNotifications = previousNotifications.filter(n => n.type !== 'messageNotification');
            break;
          case 'events':
            filteredNotifications = previousNotifications.filter(n => n.type !== 'eventInvitation' && n.type !== 'rsvpResponse');
            break;
          case 'approvals':
            filteredNotifications = previousNotifications.filter(n => n.type !== 'joinRequestApproval');
            break;
          case 'requests':
            filteredNotifications = previousNotifications.filter(n => n.type !== 'joinRequest');
            break;
        }

        // Update notifications cache immediately
        queryClient.setQueryData(['notifications'], filteredNotifications);

        // Calculate how many unread notifications were removed
        const removedUnreadCount = previousNotifications.filter(n => {
          if (!n.read) {
            switch (category) {
              case 'messages':
                return n.type === 'messageNotification';
              case 'events':
                return n.type === 'eventInvitation' || n.type === 'rsvpResponse';
              case 'approvals':
                return n.type === 'joinRequestApproval';
              case 'requests':
                return n.type === 'joinRequest';
              default:
                return false;
            }
          }
          return false;
        }).length;

        // Update unread count immediately
        if (previousCount !== undefined) {
          const newCount = Math.max(0, previousCount - removedUnreadCount);
          queryClient.setQueryData(['unreadNotificationCount'], newCount);
        }
      }

      // Return context with previous values for rollback
      return { previousNotifications, previousCount };
    },
    onError: (error: any, category, context) => {
      // On error, we DON'T rollback because we want the UI to stay cleared
      // The clearedNotificationIds set will prevent them from reappearing on refetch
      console.error('Error clearing notifications (UI will remain cleared):', error);
    },
    onSettled: async () => {
      // Refetch to ensure consistency with backend
      // Cleared notifications won't reappear due to clearedNotificationIds filter
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] });
    },
  });
}

/**
 * Hook to clear all notifications across all categories with immediate UI updates
 */
export function useClearAllNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        // Get all current notifications from cache
        const notifications = queryClient.getQueryData<Notification[]>(['notifications']) || [];
        
        console.log('[Clear All Notifications] Clearing', notifications.length, 'notifications');

        // Add all notification IDs to the cleared set to prevent them from reappearing
        const idsToAdd = notifications.map(n => n.id);
        addClearedNotificationIds(idsToAdd);

        // TODO: Backend needs to expose markNotificationAsRead() method
        // For now, just mark them as cleared in frontend
        console.warn('markNotificationAsRead not yet available in backend interface');

        console.log('[Clear All Notifications] Successfully cleared all notifications');
        return true;
      } catch (error: any) {
        console.error('Failed to clear all notifications:', error);
        throw new Error(`Failed to clear all notifications: ${error.message || 'Unknown error'}`);
      }
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      await queryClient.cancelQueries({ queryKey: ['unreadNotificationCount'] });

      // Snapshot the previous values
      const previousNotifications = queryClient.getQueryData<Notification[]>(['notifications']);
      const previousCount = queryClient.getQueryData<number>(['unreadNotificationCount']);

      // Optimistically update the cache - clear all notifications immediately
      queryClient.setQueryData(['notifications'], []);
      queryClient.setQueryData(['unreadNotificationCount'], 0);

      // Return context with previous values for rollback
      return { previousNotifications, previousCount };
    },
    onError: (error: any, variables, context) => {
      // On error, we DON'T rollback because we want the UI to stay cleared
      // The clearedNotificationIds set will prevent them from reappearing on refetch
      console.error('Error clearing all notifications (UI will remain cleared):', error);
    },
    onSettled: async () => {
      // Refetch to ensure consistency with backend
      // Cleared notifications won't reappear due to clearedNotificationIds filter
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] });
    },
  });
}
