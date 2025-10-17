import { useState } from 'react';
import { MessageSquare, Plus, X, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useCreateChatThread, useDeleteChatThread } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { toast } from 'sonner';
import { ChatThread, MessageType } from '../backend';
import FullscreenChatOverlay from './FullscreenChatOverlay';

interface ChatThreadsViewProps {
  threads: ChatThread[];
  clubId?: string;
  teamId?: string;
  canCreateThread: boolean;
  entityName: string;
  isLoading?: boolean;
  error?: Error | null;
}

export default function ChatThreadsView({ threads, clubId, teamId, canCreateThread, entityName, isLoading, error }: ChatThreadsViewProps) {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();
  const createThread = useCreateChatThread();
  const deleteThread = useDeleteChatThread();

  const [isCreateThreadOpen, setIsCreateThreadOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [threadTitle, setThreadTitle] = useState('');
  const [selectedThreadForView, setSelectedThreadForView] = useState<ChatThread | null>(null);

  const handleCreateThread = async () => {
    if (!threadTitle.trim()) {
      toast.error('Please enter a thread title');
      return;
    }

    try {
      // Determine thread type based on whether clubId or teamId is provided
      const threadType: MessageType = clubId ? MessageType.clubWide : teamId ? MessageType.teamWide : MessageType.broadcast;
      
      await createThread.mutateAsync({ 
        title: threadTitle, 
        threadType,
        clubId, 
        teamId 
      });
      toast.success('Chat thread created successfully');
      setIsCreateThreadOpen(false);
      setThreadTitle('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create chat thread');
    }
  };

  const handleDeleteThread = (thread: ChatThread) => {
    setSelectedThread(thread);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteThread = async () => {
    if (!selectedThread) return;

    try {
      await deleteThread.mutateAsync(selectedThread.id);
      toast.success('Chat thread deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedThread(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete chat thread');
    }
  };

  const canDeleteThread = (thread: ChatThread): boolean => {
    if (!principal) return false;
    return thread.creator.toString() === principal.toString();
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Chat Threads</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading chat threads...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state with clear message
  if (error) {
    const isUnauthorized = error.message.includes('not a member') || error.message.includes('Unauthorized');
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Chat Threads</h3>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {isUnauthorized 
              ? `You do not have access to chat threads for this ${clubId ? 'club' : 'team'}. Only members can view and participate in chat threads.`
              : error.message || 'Failed to load chat threads'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Chat Threads</h3>
          {canCreateThread && (
            <Button size="sm" className="gap-2" onClick={() => setIsCreateThreadOpen(true)}>
              <img 
                src="/assets/generated/create-chat-thread-icon-transparent.dim_24x24.png" 
                alt="Create" 
                className="h-4 w-4"
              />
              New Thread
            </Button>
          )}
        </div>

        {threads.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center">No chat threads yet</p>
              {canCreateThread && (
                <Button size="sm" className="mt-3 gap-2" onClick={() => setIsCreateThreadOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create Thread
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => (
              <Card key={thread.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedThreadForView(thread)}>
                <CardHeader className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <img 
                          src="/assets/generated/chat-thread-icon-transparent.dim_64x64.png" 
                          alt="Thread" 
                          className="h-5 w-5"
                        />
                        {thread.title}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Created {new Date(Number(thread.createdAt) / 1000000).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    {canDeleteThread(thread) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteThread(thread);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Thread Modal */}
      {isCreateThreadOpen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold">Create Chat Thread</h2>
              <p className="text-sm text-muted-foreground">Create a new chat thread for {entityName}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsCreateThreadOpen(false);
                setThreadTitle('');
              }}
              className="shrink-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="threadTitle" className="text-base">Thread Title</Label>
                  <Input
                    id="threadTitle"
                    placeholder="Enter thread title"
                    value={threadTitle}
                    onChange={(e) => setThreadTitle(e.target.value)}
                    className="h-12 text-base"
                    autoFocus
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t p-4 sm:p-6 bg-background">
            <div className="max-w-2xl mx-auto flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateThreadOpen(false);
                  setThreadTitle('');
                }}
                className="w-full sm:w-auto h-12 sm:h-10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateThread}
                disabled={createThread.isPending}
                className="w-full sm:w-auto h-12 sm:h-10"
              >
                {createThread.isPending ? 'Creating...' : 'Create Thread'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Chat Overlay */}
      {selectedThreadForView && (
        <FullscreenChatOverlay
          thread={selectedThreadForView}
          onClose={() => setSelectedThreadForView(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat Thread</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedThread?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedThread(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteThread}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteThread.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
