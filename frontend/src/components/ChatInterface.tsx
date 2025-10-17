import { useState, useEffect, useRef } from 'react';
import { Send, X, ArrowLeft, AlertCircle, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { ChatThread, MessageType } from '../backend';
import { useGetMessagesByThread, useCreateMessage } from '../hooks/useMessagesQueries';
import { useGetMessageReactions, useAddEmojiReaction, useRemoveEmojiReaction, aggregateReactions } from '../hooks/useEmojiReactionsQueries';
import EmojiReactionPicker from './EmojiReactionPicker';
import EmojiPicker from './EmojiPicker';

interface ChatInterfaceProps {
  thread: ChatThread;
  onClose: () => void;
  scrollToMessageId?: string;
}

export default function ChatInterface({ thread, onClose, scrollToMessageId }: ChatInterfaceProps) {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();
  const { data: messages = [], isLoading, error } = useGetMessagesByThread(thread.id);
  const createMessage = useCreateMessage();
  const addReaction = useAddEmojiReaction();
  const removeReaction = useRemoveEmojiReaction();
  
  const [messageInput, setMessageInput] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!scrollToMessageId && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, scrollToMessageId]);

  useEffect(() => {
    if (scrollToMessageId && messages.length > 0) {
      const messageElement = messageRefs.current.get(scrollToMessageId);
      if (messageElement) {
        setTimeout(() => {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          messageElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            messageElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 2000);
        }, 100);
      }
    }
  }, [scrollToMessageId, messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !principal) return;

    try {
      await createMessage.mutateAsync({
        threadId: thread.id,
        content: messageInput.trim(),
      });
      
      setMessageInput('');
      toast.success('Message sent');
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage = error?.message || 'Failed to send message';
      
      if (errorMessage.includes('not have permission') || errorMessage.includes('Unauthorized')) {
        toast.error('You do not have permission to send messages in this thread');
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const input = messageInputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const text = messageInput;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    setMessageInput(before + emoji + after);
    setShowEmojiPicker(false);
    
    setTimeout(() => {
      input.focus();
      const newPosition = start + emoji.length;
      input.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleLongPressStart = (messageId: string) => {
    const timer = setTimeout(() => {
      setShowReactionPicker(messageId);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!principal) {
      toast.error('You must be logged in to react to messages');
      return;
    }

    try {
      await addReaction.mutateAsync({ 
        threadId: thread.id, 
        messageId, 
        emoji 
      });
      setShowReactionPicker(null);
    } catch (error: any) {
      console.error('Error adding reaction:', error);
      const errorMessage = error?.message || 'Failed to add reaction';
      toast.error(errorMessage);
    }
  };

  const handleRemoveReaction = async (messageId: string) => {
    if (!principal) return;

    try {
      await removeReaction.mutateAsync({ 
        threadId: thread.id, 
        messageId 
      });
    } catch (error: any) {
      console.error('Error removing reaction:', error);
      const errorMessage = error?.message || 'Failed to remove reaction';
      toast.error(errorMessage);
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

  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isUnauthorizedError = !!error && (
    error.message.includes('not have access') || 
    error.message.includes('Unauthorized') ||
    error.message.includes('not authorized')
  );

  return (
    <div className="chat-thread-fullscreen">
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="chat-back-button"
        aria-label="Go back"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>

      <div className="chat-header">
        <div className="flex items-center gap-3 flex-1 min-w-0 ml-14">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{thread.title}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">
                {getThreadTypeLabel(thread.threadType)}
              </Badge>
              <span>
                Created {new Date(Number(thread.createdAt) / 1000000).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="shrink-0"
          aria-label="Close chat"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="chat-messages-container">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Loading messages...</p>
              </div>
            </div>
          ) : isUnauthorizedError ? (
            <div className="flex items-center justify-center py-12 px-4">
              <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You do not have access to this chat thread. Only members of the associated team or club can view and participate in this conversation.
                </AlertDescription>
              </Alert>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 px-4">
              <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load messages. Please try again later.
                </AlertDescription>
              </Alert>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4 max-w-md">
                <p className="text-sm text-muted-foreground">
                  No messages yet. Be the first to send a message in this thread!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((message) => {
                const isOwnMessage = !!(principal && message.senderId === principal.toString());
                
                return (
                  <MessageWithReactions
                    key={message.id}
                    message={message}
                    threadId={thread.id}
                    isOwnMessage={isOwnMessage}
                    currentUserId={principal?.toString()}
                    showReactionPicker={showReactionPicker === message.id}
                    onLongPressStart={() => handleLongPressStart(message.id)}
                    onLongPressEnd={handleLongPressEnd}
                    onReactionSelect={(emoji) => handleReaction(message.id, emoji)}
                    onReactionRemove={() => handleRemoveReaction(message.id)}
                    onCloseReactionPicker={() => setShowReactionPicker(null)}
                    messageRef={(el) => {
                      if (el) {
                        messageRefs.current.set(message.id, el);
                      } else {
                        messageRefs.current.delete(message.id);
                      }
                    }}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="chat-input-container">
        {isUnauthorizedError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              You cannot send messages in this thread. Only members have access.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex gap-2">
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 touch-manipulation"
                  disabled={!principal || isUnauthorizedError}
                  aria-label="Insert emoji"
                >
                  <Smile className="w-5 h-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start" side="top">
                <EmojiPicker onSelect={handleEmojiSelect} />
              </PopoverContent>
            </Popover>
            <Input
              ref={messageInputRef}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={!principal || isUnauthorizedError}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || !principal || createMessage.isPending || isUnauthorizedError}
              className="shrink-0 touch-manipulation"
              aria-label="Send message"
            >
              {createMessage.isPending ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface MessageWithReactionsProps {
  message: any;
  threadId: string;
  isOwnMessage: boolean;
  currentUserId?: string;
  showReactionPicker: boolean;
  onLongPressStart: () => void;
  onLongPressEnd: () => void;
  onReactionSelect: (emoji: string) => void;
  onReactionRemove: () => void;
  onCloseReactionPicker: () => void;
  messageRef: (el: HTMLDivElement | null) => void;
}

function MessageWithReactions({
  message,
  threadId,
  isOwnMessage,
  currentUserId,
  showReactionPicker,
  onLongPressStart,
  onLongPressEnd,
  onReactionSelect,
  onReactionRemove,
  onCloseReactionPicker,
  messageRef,
}: MessageWithReactionsProps) {
  const { data: reactions = [], isLoading: reactionsLoading } = useGetMessageReactions(threadId, message.id);
  const aggregatedReactions = aggregateReactions(reactions);
  
  const userReaction = reactions.find(r => r.userId === currentUserId);

  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      ref={messageRef}
      className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} transition-all duration-300 rounded-lg`}
    >
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback className="text-xs">
          {getInitials(message.senderName)}
        </AvatarFallback>
      </Avatar>

      <div className={`flex-1 min-w-0 ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{message.senderName}</span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>

        <div className={`max-w-[85%] sm:max-w-[80%] ${isOwnMessage ? 'ml-auto' : 'mr-auto'} relative`}>
          <div
            className={`rounded-lg px-4 py-2 ${
              isOwnMessage
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            } cursor-pointer select-none touch-manipulation`}
            onTouchStart={onLongPressStart}
            onTouchEnd={onLongPressEnd}
            onMouseDown={onLongPressStart}
            onMouseUp={onLongPressEnd}
            onMouseLeave={onLongPressEnd}
          >
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          </div>

          {showReactionPicker && (
            <div className={`absolute ${isOwnMessage ? 'right-0' : 'left-0'} top-full mt-2 z-50`}>
              <EmojiReactionPicker
                onSelect={onReactionSelect}
                onClose={onCloseReactionPicker}
              />
            </div>
          )}

          {aggregatedReactions.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {aggregatedReactions.map((reaction) => {
                const isUserReaction = userReaction?.emoji === reaction.emoji;
                return (
                  <button
                    key={reaction.emoji}
                    onClick={() => {
                      if (isUserReaction) {
                        onReactionRemove();
                      } else {
                        onReactionSelect(reaction.emoji);
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all touch-manipulation ${
                      isUserReaction
                        ? 'bg-primary/20 border-2 border-primary ring-1 ring-primary/50'
                        : 'bg-muted hover:bg-muted/80 border border-border'
                    }`}
                    aria-label={`${reaction.emoji} reaction (${reaction.count})`}
                  >
                    <span className="text-base leading-none">{reaction.emoji}</span>
                    <span className="font-medium">{reaction.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
