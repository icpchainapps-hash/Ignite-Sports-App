import { useState } from 'react';
import { MessageSquare, Calendar, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { useActor } from '../hooks/useActor';
import { useDeleteChatThread } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { ChatThread, MessageType } from '../backend';
import FullscreenChatOverlay from './FullscreenChatOverlay';

interface MessageInboxProps {
  filterType: 'broadcast' | 'clubWide' | 'teamWide' | null;
}

export default function MessageInbox({ filterType }: MessageInboxProps) {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();
  const { actor, isFetching: actorFetching } = useActor();
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);

  const deleteThread = useDeleteChatThread();

  // Fetch all chat threads (backend already filters by membership)
  const { data: allThreads = [], isLoading, error } = useQuery<ChatThread[]>({
    queryKey: ['allChatThreads'],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.getAllChatThreads();
      } catch (error: any) {
        console.error('Error fetching chat threads:', error);
        throw error;
      }
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  // Filter threads based on type
  const threads = filterType 
    ? allThreads.filter(thread => {
        if (filterType === 'broadcast') return thread.threadType === MessageType.broadcast;
        if (filterType === 'clubWide') return thread.threadType === MessageType.clubWide;
        if (filterType === 'teamWide') return thread.threadType === MessageType.teamWide;
        return false;
      })
    : allThreads;

  const handleThreadClick = (thread: ChatThread) => {
    setSelectedThread(thread);
  };

  const handleDeleteThread = async () => {
    if (!deleteThreadId) return;

    try {
      await deleteThread.mutateAsync(deleteThreadId);
      toast.success('Thread deleted successfully');
      setDeleteThreadId(null);
    } catch (error: any) {
      console.error('Error deleting thread:', error);
      const errorMessage = error?.message || 'Failed to delete thread';
      
      if (errorMessage.includes('not have permission') || errorMessage.includes('Unauthorized')) {
        toast.error('You do not have permission to delete this thread');
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const canDeleteThread = (thread: ChatThread): boolean => {
    if (!principal) return false;
    return thread.creator.toString() === principal.toString();
  };

  const getThreadTypeIcon = (type: MessageType) => {
    switch (type) {
      case MessageType.broadcast:
        return '/assets/generated/broadcast-message-icon-transparent.dim_24x24.png';
      case MessageType.clubWide:
        return '/assets/generated/club-message-icon-transparent.dim_24x24.png';
      case MessageType.teamWide:
        return '/assets/generated/team-message-icon-transparent.dim_24x24.png';
      default:
        return '/assets/generated/message-inbox-icon-transparent.dim_24x24.png';
    }
  };

  const getThreadTypeLabel = (type: MessageType) => {
    switch (type) {
      case MessageType.broadcast:
        return 'Broadcast';
      case MessageType.clubWide:
        return 'Club';
      case MessageType.teamWide:
        return 'Team';
      default:
        return 'Thread';
    }
  };

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading threads...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 px-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load chat threads. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
            <MessageSquare className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-foreground">No threads</p>
            <p className="text-sm text-muted-foreground">
              {filterType ? `You don't have any ${getThreadTypeLabel(filterType === 'broadcast' ? MessageType.broadcast : filterType === 'clubWide' ? MessageType.clubWide : MessageType.teamWide)} threads yet` : "You don't have any threads yet"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-2">
          {threads.map((thread) => (
            <Card
              key={thread.id}
              className="cursor-pointer transition-all hover:shadow-md bg-card"
              onClick={() => handleThreadClick(thread)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Thread Type Icon */}
                    <div className="flex-shrink-0 mt-1">
                      <img
                        src={getThreadTypeIcon(thread.threadType)}
                        alt={getThreadTypeLabel(thread.threadType)}
                        className="w-5 h-5"
                      />
                    </div>

                    {/* Thread Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm text-foreground">
                          {thread.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
                        <Badge variant="outline" className="text-xs">
                          {getThreadTypeLabel(thread.threadType)}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(thread.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {canDeleteThread(thread) && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteThreadId(thread.id);
                        }}
                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Fullscreen Chat Overlay */}
      {selectedThread && (
        <FullscreenChatOverlay
          thread={selectedThread}
          onClose={() => setSelectedThread(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteThreadId} onOpenChange={(open) => !open && setDeleteThreadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Thread</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this thread? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteThread}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
