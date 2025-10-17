import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';

export interface EmojiReaction {
  messageId: string;
  userId: string;
  emoji: string;
  timestamp: bigint;
}

export interface EmojiReactionCount {
  emoji: string;
  count: number;
  userIds: string[];
}

/**
 * Hook to get all emoji reactions for a specific message
 */
export function useGetMessageReactions(threadId: string, messageId: string) {
  const { actor, isFetching } = useActor();

  return useQuery<EmojiReaction[]>({
    queryKey: ['emojiReactions', threadId, messageId],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      
      try {
        // Call backend method to get reactions for a message
        const reactions = await (actor as any).getMessageReactions(threadId, messageId);
        return reactions || [];
      } catch (error: any) {
        console.error('Error fetching reactions:', error);
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('not authorized')) {
          console.warn('User not authorized to view reactions for this message');
          return [];
        }
        return [];
      }
    },
    enabled: !!actor && !isFetching && !!threadId && !!messageId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
    retry: false,
  });
}

/**
 * Hook to add or update an emoji reaction to a message
 * If the user already has a reaction, it will be replaced with the new one
 * Backend signature: addEmojiReaction(threadId: Text, messageId: Text, emoji: Text) : async ()
 * The user/caller is automatically determined by the backend from the authentication context
 */
export function useAddEmojiReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, messageId, emoji }: { threadId: string; messageId: string; emoji: string }) => {
      if (!actor) throw new Error('Actor not available');
      
      try {
        // Call backend method with signature: addEmojiReaction(threadId: Text, messageId: Text, emoji: Text) : async ()
        // The caller/user is implicit and handled by the backend
        await (actor as any).addEmojiReaction(threadId, messageId, emoji);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('not authorized')) {
          throw new Error('You do not have permission to react to this message');
        }
        throw new Error(`Failed to add reaction: ${errorMessage}`);
      }
    },
    onSuccess: async (_, variables) => {
      // Invalidate reactions for this message
      await queryClient.invalidateQueries({ queryKey: ['emojiReactions', variables.threadId, variables.messageId] });
      await queryClient.refetchQueries({ queryKey: ['emojiReactions', variables.threadId, variables.messageId] });
      
      // Also invalidate messages to get updated reaction data
      await queryClient.invalidateQueries({ queryKey: ['messages', variables.threadId] });
    },
    onError: (error: any) => {
      console.error('[Add Emoji Reaction] Error:', error);
    },
  });
}

/**
 * Hook to remove an emoji reaction from a message
 * Backend automatically determines which user's reaction to remove based on the caller
 */
export function useRemoveEmojiReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, messageId }: { threadId: string; messageId: string }) => {
      if (!actor) throw new Error('Actor not available');
      
      try {
        // Backend method to remove the caller's reaction from the message
        await (actor as any).removeEmojiReaction(threadId, messageId);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('not authorized')) {
          throw new Error('You do not have permission to remove this reaction');
        }
        throw new Error(`Failed to remove reaction: ${errorMessage}`);
      }
    },
    onSuccess: async (_, variables) => {
      // Invalidate reactions for this message
      await queryClient.invalidateQueries({ queryKey: ['emojiReactions', variables.threadId, variables.messageId] });
      await queryClient.refetchQueries({ queryKey: ['emojiReactions', variables.threadId, variables.messageId] });
      
      // Also invalidate messages to get updated reaction data
      await queryClient.invalidateQueries({ queryKey: ['messages', variables.threadId] });
    },
    onError: (error: any) => {
      console.error('[Remove Emoji Reaction] Error:', error);
    },
  });
}

/**
 * Helper function to aggregate reactions by emoji type
 */
export function aggregateReactions(reactions: EmojiReaction[]): EmojiReactionCount[] {
  const reactionMap = new Map<string, { count: number; userIds: string[] }>();

  reactions.forEach((reaction) => {
    const existing = reactionMap.get(reaction.emoji);
    if (existing) {
      existing.count += 1;
      existing.userIds.push(reaction.userId);
    } else {
      reactionMap.set(reaction.emoji, {
        count: 1,
        userIds: [reaction.userId],
      });
    }
  });

  return Array.from(reactionMap.entries()).map(([emoji, data]) => ({
    emoji,
    count: data.count,
    userIds: data.userIds,
  }));
}
