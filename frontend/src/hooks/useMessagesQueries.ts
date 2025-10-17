import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { Principal } from '@dfinity/principal';
import { ChatThread, MessageType, UserProfile, UserRole } from '../backend';

export interface Message {
  id: string;
  threadId: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: bigint;
}

export function useGetChatThreadsByClub(clubId: string) {
  const { actor, isFetching } = useActor();
  
  return useQuery<ChatThread[]>({
    queryKey: ['chatThreads', 'club', clubId],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      try {
        return await actor.getChatThreadsByClub(clubId);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('not a member')) {
          throw new Error('You are not a member of this club');
        }
        throw error;
      }
    },
    enabled: !!actor && !isFetching && !!clubId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useGetChatThreadsByTeam(teamId: string) {
  const { actor, isFetching } = useActor();
  
  return useQuery<ChatThread[]>({
    queryKey: ['chatThreads', 'team', teamId],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      try {
        return await actor.getChatThreadsByTeam(teamId);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('not a member')) {
          throw new Error('You are not a member of this team');
        }
        throw error;
      }
    },
    enabled: !!actor && !isFetching && !!teamId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useCreateChatThread() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      title, 
      threadType, 
      clubId, 
      teamId,
      roleFilters 
    }: { 
      title: string; 
      threadType: MessageType; 
      clubId?: string; 
      teamId?: string;
      roleFilters?: UserRole[];
    }) => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('[Create Chat Thread] Starting thread creation');
      
      if (!title || title.trim().length === 0) {
        throw new Error('Thread title is required');
      }
      
      // Note: roleFilters are accepted in the frontend but not yet passed to backend
      // Backend needs to be updated to support role-based filtering
      if (roleFilters && roleFilters.length > 0) {
        console.warn('[Create Chat Thread] Role filters selected but not yet supported by backend:', roleFilters);
      }
      
      const backendClubId = clubId ?? null;
      const backendTeamId = teamId ?? null;
      
      try {
        const threadId = await actor.createChatThread(
          title, 
          threadType, 
          backendClubId, 
          backendTeamId
        );
        
        console.log('[Create Chat Thread] Thread created successfully');
        return { threadId, clubId, teamId };
      } catch (error: any) {
        console.error('[Create Chat Thread] Backend error:', error);
        
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized')) {
          throw new Error('You do not have permission to create this type of thread');
        } else if (errorMessage.includes('not found')) {
          throw new Error('The selected club or team could not be found');
        } else if (errorMessage.includes('No eligible members')) {
          throw new Error('No members with the selected roles exist. Please adjust your role filters.');
        } else {
          throw new Error(`Failed to create thread: ${errorMessage}`);
        }
      }
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
      await queryClient.invalidateQueries({ queryKey: ['allChatThreads'] });
      
      if (data.clubId) {
        await queryClient.refetchQueries({ queryKey: ['chatThreads', 'club', data.clubId] });
      }
      if (data.teamId) {
        await queryClient.refetchQueries({ queryKey: ['chatThreads', 'team', data.teamId] });
      }
    },
  });
}

export function useDeleteChatThread() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (threadId: string) => {
      if (!actor) throw new Error('Actor not available');
      try {
        await actor.deleteChatThread(threadId);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized')) {
          throw new Error('You do not have permission to delete this thread');
        }
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
      await queryClient.invalidateQueries({ queryKey: ['allChatThreads'] });
    },
  });
}

export function useGetMessagesByThread(threadId: string) {
  const { actor, isFetching } = useActor();

  return useQuery<Message[]>({
    queryKey: ['messages', threadId],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      
      try {
        const backendMessages = await actor.getMessagesByThread(threadId);
        
        const senderIds = [...new Set(backendMessages.map(msg => msg.sender.toString()))];
        
        const userProfiles = new Map<string, UserProfile | null>();
        for (const senderId of senderIds) {
          try {
            const senderPrincipal = Principal.fromText(senderId);
            const profile = await actor.getUserProfile(senderPrincipal);
            userProfiles.set(senderId, profile);
          } catch (error) {
            userProfiles.set(senderId, null);
          }
        }
        
        const messages: Message[] = backendMessages.map(msg => {
          const senderId = msg.sender.toString();
          const profile = userProfiles.get(senderId);
          const senderName = profile?.displayName || `User ${senderId.slice(0, 8)}...`;
          
          return {
            id: msg.id,
            threadId: msg.threadId,
            content: msg.content,
            senderId,
            senderName,
            timestamp: msg.timestamp,
          };
        });
        
        return messages;
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('not authorized')) {
          throw new Error('You do not have access to this chat thread');
        }
        throw error;
      }
    },
    enabled: !!actor && !isFetching && !!threadId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
    retry: false,
  });
}

/**
 * Hook to create a message in a chat thread
 * Automatically triggers notification creation via the dedicated notifications service
 */
export function useCreateMessage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ threadId, content }: { threadId: string; content: string }) => {
      if (!actor) throw new Error('Actor not available');
      try {
        // Send message - backend will automatically create notifications via NotificationsService
        await actor.sendMessage(threadId, content);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('not authorized')) {
          throw new Error('You do not have permission to send messages in this thread');
        }
        throw error;
      }
    },
    onSuccess: async (_, variables) => {
      // Invalidate messages for this thread
      await queryClient.invalidateQueries({ queryKey: ['messages', variables.threadId] });
      await queryClient.refetchQueries({ queryKey: ['messages', variables.threadId] });
      
      // Invalidate notifications as new message notifications have been created by the backend
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] });
    },
  });
}
