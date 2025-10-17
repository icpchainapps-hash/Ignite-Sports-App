import { useState } from 'react';
import { Bell, Calendar, Users, MessageSquare, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useGetNotifications, useGetUnreadNotificationCount, useMarkNotificationAsRead, useClearAllNotifications, EventInvitationNotification, JoinRequestApprovalNotification, JoinRequestNotification, RSVPResponseNotification } from '../hooks/useNotificationsQueries';
import { useGetJoinRequestsByTeamAdmin, useApproveJoinRequest, useRejectJoinRequest, useRejectAllJoinRequests } from '../hooks/useJoinRequestsQueries';
import { MessageNotification } from '../hooks/useNotificationsQueries';
import { useActor } from '../hooks/useActor';
import { toast } from 'sonner';
import { EventType, ChatThread } from '../backend';

interface NotificationBellProps {
  onOpenChatThread?: (thread: ChatThread) => void;
  onNavigateToEvents?: () => void;
  onNavigateToTeamDetails?: (teamId?: string) => void;
}

export default function NotificationBell({ onOpenChatThread, onNavigateToEvents, onNavigateToTeamDetails }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const { actor } = useActor();
  const { data: notifications = [], isLoading: isLoadingNotifications, error: notificationsError } = useGetNotifications();
  const { data: joinRequests = [], isLoading: isLoadingJoinRequests } = useGetJoinRequestsByTeamAdmin();
  const { data: unreadCount = 0 } = useGetUnreadNotificationCount();
  const markAsRead = useMarkNotificationAsRead();
  const clearAllNotifications = useClearAllNotifications();
  const approveRequest = useApproveJoinRequest();
  const rejectRequest = useRejectJoinRequest();
  const rejectAllRequests = useRejectAllJoinRequests();

  const eventNotifications = notifications.filter(n => n.type === 'eventInvitation' || n.type === 'rsvpResponse');
  const messageNotifications = notifications.filter(n => n.type === 'messageNotification');
  const approvalNotifications = notifications.filter(n => n.type === 'joinRequestApproval');
  const joinRequestNotifications = notifications.filter(n => n.type === 'joinRequest');
  
  const unreadEventNotifications = eventNotifications.filter(n => !n.read);
  const unreadMessageNotifications = messageNotifications.filter(n => !n.read);
  const unreadApprovalNotifications = approvalNotifications.filter(n => !n.read);
  const unreadJoinRequestNotifications = joinRequestNotifications.filter(n => !n.read);

  const totalNotifications = notifications.length + joinRequests.length;

  const handleApprove = async (requestId: string, notificationId?: string) => {
    try {
      await approveRequest.mutateAsync(requestId);
      
      if (notificationId) {
        await markAsRead.mutateAsync(notificationId);
      }
      
      toast.success('Join request approved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve request');
    }
  };

  const handleReject = async (requestId: string, notificationId?: string) => {
    try {
      await rejectRequest.mutateAsync(requestId);
      
      if (notificationId) {
        await markAsRead.mutateAsync(notificationId);
      }
      
      toast.success('Join request rejected');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject request');
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead.mutateAsync(notificationId);
    } catch (error: any) {
      console.error('Failed to mark notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const handleClearAll = () => {
    setClearDialogOpen(true);
  };

  const confirmClearAll = async () => {
    if (!actor) return;

    try {
      console.log('[Clear All] Starting to clear all notifications');
      
      await clearAllNotifications.mutateAsync();
      
      const requestIds = joinRequests.map(r => r.id);
      if (requestIds.length > 0) {
        console.log('[Clear All] Rejecting all join requests');
        await rejectAllRequests.mutateAsync(requestIds);
      }
      
      console.log('[Clear All] Successfully cleared all notifications');
      toast.success('All notifications cleared');
      
      setClearDialogOpen(false);
    } catch (error: any) {
      console.error('Failed to clear all notifications:', error);
      toast.error(error.message || 'Failed to clear all notifications');
    }
  };

  const handleMessageNotificationClick = async (notification: MessageNotification) => {
    handleMarkAsRead(notification.id);
    setIsOpen(false);
    
    if (onOpenChatThread && actor) {
      try {
        const allThreads = await actor.getAllChatThreads();
        const thread = allThreads.find(t => t.id === notification.threadId);
        
        if (thread) {
          onOpenChatThread(thread);
        } else {
          toast.error('Chat thread not found');
        }
      } catch (error) {
        console.error('Failed to fetch chat thread:', error);
        toast.error('Failed to open chat thread');
      }
    } else {
      toast.info('Opening chat thread...');
    }
  };

  const handleEventNotificationClick = (notification: EventInvitationNotification | RSVPResponseNotification) => {
    handleMarkAsRead(notification.id);
    setIsOpen(false);
    
    if (onNavigateToEvents) {
      onNavigateToEvents();
      toast.success('Opening event details...');
    } else {
      toast.info('Navigate to Events page to view this event');
    }
  };

  const handleApprovalNotificationClick = (notification: JoinRequestApprovalNotification) => {
    handleMarkAsRead(notification.id);
    setIsOpen(false);
    
    if (onNavigateToTeamDetails) {
      onNavigateToTeamDetails(notification.teamId);
      toast.success('Opening team details...');
    } else {
      toast.info('Navigate to Clubs & Teams page to view your team');
    }
  };

  const handleBack = () => {
    setIsOpen(false);
  };

  const getRoleLabel = (role: string): string => {
    const roleLabels: Record<string, string> = {
      player: 'Player',
      parent: 'Parent',
      coach: 'Coach',
      teamAdmin: 'Team Admin',
      clubAdmin: 'Club Admin',
    };
    return roleLabels[role] || role;
  };

  const getEventTypeLabel = (type: EventType): string => {
    switch (type) {
      case EventType.game:
        return 'Game';
      case EventType.match:
        return 'Match';
      case EventType.socialEvent:
        return 'Social Event';
      case EventType.training:
        return 'Training';
      default:
        return type;
    }
  };

  const getEventTypeIcon = (type: EventType): string => {
    switch (type) {
      case EventType.game:
      case EventType.match:
        return '/assets/generated/match-event-icon-transparent.dim_24x24.png';
      case EventType.socialEvent:
        return '/assets/generated/social-event-icon-transparent.dim_24x24.png';
      case EventType.training:
        return '/assets/generated/training-event-icon-transparent.dim_24x24.png';
      default:
        return '/assets/generated/event-calendar-icon-transparent.dim_24x24.png';
    }
  };

  const getRSVPStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('going') || statusLower.includes('yes')) {
      return <Badge className="bg-green-500">Going</Badge>;
    } else if (statusLower.includes('maybe')) {
      return <Badge className="bg-yellow-500">Maybe</Badge>;
    } else if (statusLower.includes('not going') || statusLower.includes('no')) {
      return <Badge className="bg-red-500">Not Going</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const formatTimestamp = (timestamp: bigint) => {
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
    
    return date.toLocaleDateString();
  };

  const totalUnread = unreadCount + joinRequests.length;
  const isLoading = isLoadingNotifications || isLoadingJoinRequests;
  const isClearingAll = clearAllNotifications.isPending || rejectAllRequests.isPending;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {totalUnread > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {totalUnread > 9 ? '9+' : totalUnread}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:w-[400px] flex flex-col">
          <SheetHeader className="mb-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-9 w-9 flex-shrink-0 hover:bg-accent"
                aria-label="Close notifications"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <SheetTitle className="flex-1 truncate">Notifications</SheetTitle>
            </div>
          </SheetHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : notificationsError ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Failed to load notifications</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                {notificationsError instanceof Error ? notificationsError.message : 'An error occurred'}
              </p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Retry
              </Button>
            </div>
          ) : (
            <>
              <Tabs defaultValue="messages" className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="messages" className="relative text-xs">
                    Messages
                    {unreadMessageNotifications.length > 0 && (
                      <Badge variant="destructive" className="ml-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]">
                        {unreadMessageNotifications.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="events" className="relative text-xs">
                    Events
                    {unreadEventNotifications.length > 0 && (
                      <Badge variant="destructive" className="ml-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]">
                        {unreadEventNotifications.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="approvals" className="relative text-xs">
                    Approvals
                    {unreadApprovalNotifications.length > 0 && (
                      <Badge variant="destructive" className="ml-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]">
                        {unreadApprovalNotifications.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="requests" className="relative text-xs">
                    Requests
                    {joinRequests.length > 0 && (
                      <Badge variant="destructive" className="ml-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]">
                        {joinRequests.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="messages" className="mt-4 flex-1 min-h-0">
                  {messageNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <MessageSquare className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No message notifications</h3>
                      <p className="text-sm text-muted-foreground text-center">
                        You'll see notifications here when you receive new messages
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-full">
                      <div className="space-y-4 pr-4">
                        {messageNotifications.map((notification) => {
                          const messageData = notification.data as MessageNotification;
                          
                          return (
                            <Card 
                              key={notification.id} 
                              className={`cursor-pointer transition-all hover:shadow-md ${notification.read ? 'opacity-60' : ''}`}
                              onClick={() => handleMessageNotificationClick(messageData)}
                            >
                              <CardHeader>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <img 
                                      src="/assets/generated/message-notification-icon-transparent.dim_24x24.png" 
                                      alt="Message" 
                                      className="h-5 w-5 flex-shrink-0" 
                                    />
                                    <div className="flex-1 min-w-0">
                                      <CardTitle className="text-base truncate">{messageData.threadTitle}</CardTitle>
                                    </div>
                                  </div>
                                  {!notification.read && (
                                    <Badge variant="default" className="flex-shrink-0">New</Badge>
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {messageData.messagePreview}
                                </p>
                                <div className="text-xs text-muted-foreground">
                                  {formatTimestamp(messageData.timestamp)}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="events" className="mt-4 flex-1 min-h-0">
                  {eventNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Calendar className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No event notifications</h3>
                      <p className="text-sm text-muted-foreground text-center">
                        You'll see event invitations and RSVP responses here
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-full">
                      <div className="space-y-4 pr-4">
                        {eventNotifications.map((notification) => {
                          if (notification.type === 'rsvpResponse') {
                            const rsvpData = notification.data as RSVPResponseNotification;
                            const date = new Date(Number(rsvpData.eventDateTime / BigInt(1_000_000)));
                            
                            return (
                              <Card 
                                key={notification.id} 
                                className={`cursor-pointer transition-all hover:shadow-md ${notification.read ? 'opacity-60' : ''}`}
                                onClick={() => handleEventNotificationClick(rsvpData)}
                              >
                                <CardHeader>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <img 
                                        src="/assets/generated/rsvp-confirmation-icon-transparent.dim_20x20.png" 
                                        alt="RSVP" 
                                        className="h-5 w-5 flex-shrink-0" 
                                      />
                                      <div className="flex-1 min-w-0">
                                        <CardTitle className="text-base truncate">
                                          {rsvpData.isTeamAdminNotification ? 'Team Member RSVP' : 'RSVP Response'}
                                        </CardTitle>
                                        <CardDescription className="truncate">{rsvpData.eventTitle}</CardDescription>
                                      </div>
                                    </div>
                                    {!notification.read && (
                                      <Badge variant="default" className="flex-shrink-0">New</Badge>
                                    )}
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  <div className="space-y-2 text-sm">
                                    <p className="text-muted-foreground">
                                      <span className="font-medium text-foreground">{rsvpData.responderName}</span> has responded
                                    </p>
                                    <div className="flex items-center gap-2">
                                      {getRSVPStatusBadge(rsvpData.rsvpStatus)}
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Calendar className="h-4 w-4 flex-shrink-0" />
                                      <span>{date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatTimestamp(notification.timestamp)}
                                  </div>
                                  <Button
                                    size="sm"
                                    className="w-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEventNotificationClick(rsvpData);
                                    }}
                                  >
                                    View Event Details
                                  </Button>
                                </CardContent>
                              </Card>
                            );
                          } else {
                            const eventData = notification.data as EventInvitationNotification;
                            const date = new Date(Number(eventData.eventDateTime / BigInt(1_000_000)));
                            
                            return (
                              <Card 
                                key={notification.id} 
                                className={`cursor-pointer transition-all hover:shadow-md ${notification.read ? 'opacity-60' : ''}`}
                                onClick={() => handleEventNotificationClick(eventData)}
                              >
                                <CardHeader>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <img 
                                        src={getEventTypeIcon(eventData.eventType)} 
                                        alt={eventData.eventType} 
                                        className="h-5 w-5 flex-shrink-0" 
                                      />
                                      <div className="flex-1 min-w-0">
                                        <CardTitle className="text-base truncate">Event Invitation</CardTitle>
                                        <CardDescription className="truncate">{eventData.eventTitle}</CardDescription>
                                      </div>
                                    </div>
                                    {!notification.read && (
                                      <Badge variant="default" className="flex-shrink-0">New</Badge>
                                    )}
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  <div className="space-y-2 text-sm">
                                    <p className="text-muted-foreground">
                                      You have been invited to <span className="font-medium text-foreground">{eventData.eventTitle}</span>
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline">{getEventTypeLabel(eventData.eventType)}</Badge>
                                      <Badge variant="outline">{eventData.teamName}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Calendar className="h-4 w-4 flex-shrink-0" />
                                      <span>{date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatTimestamp(notification.timestamp)}
                                  </div>
                                  <Button
                                    size="sm"
                                    className="w-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEventNotificationClick(eventData);
                                    }}
                                  >
                                    Click here to RSVP
                                  </Button>
                                </CardContent>
                              </Card>
                            );
                          }
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="approvals" className="mt-4 flex-1 min-h-0">
                  {approvalNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No approval notifications</h3>
                      <p className="text-sm text-muted-foreground text-center">
                        You'll see notifications here when your join requests are approved
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-full">
                      <div className="space-y-4 pr-4">
                        {approvalNotifications.map((notification) => {
                          const approvalData = notification.data as JoinRequestApprovalNotification;
                          
                          return (
                            <Card 
                              key={notification.id} 
                              className={`cursor-pointer transition-all hover:shadow-md ${notification.read ? 'opacity-60' : ''}`}
                              onClick={() => handleApprovalNotificationClick(approvalData)}
                            >
                              <CardHeader>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-500" />
                                    <div className="flex-1 min-w-0">
                                      <CardTitle className="text-base truncate">Join Request Approved</CardTitle>
                                      <CardDescription className="truncate">{approvalData.teamName}</CardDescription>
                                    </div>
                                  </div>
                                  {!notification.read && (
                                    <Badge variant="default" className="flex-shrink-0">New</Badge>
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div className="space-y-2 text-sm">
                                  <p className="text-muted-foreground">{approvalData.message}</p>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{getRoleLabel(approvalData.approvedRole)}</Badge>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatTimestamp(notification.timestamp)}
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprovalNotificationClick(approvalData);
                                  }}
                                >
                                  View Team Details
                                </Button>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="requests" className="mt-4 flex-1 min-h-0">
                  {joinRequests.length === 0 && joinRequestNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Users className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No join requests</h3>
                      <p className="text-sm text-muted-foreground text-center">
                        You'll see join requests here when users want to join your teams
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-full">
                      <div className="space-y-4 pr-4">
                        {joinRequests.map((request) => {
                          const correspondingNotification = joinRequestNotifications.find(
                            n => {
                              const notifData = n.data as JoinRequestNotification;
                              return notifData.teamId === request.teamId;
                            }
                          );
                          
                          return (
                            <Card key={request.id}>
                              <CardHeader>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Users className="h-5 w-5 flex-shrink-0 text-primary" />
                                    <div className="flex-1 min-w-0">
                                      <CardTitle className="text-base truncate">Join Request</CardTitle>
                                      <CardDescription className="truncate">
                                        {request.userName} wants to join {request.teamName}
                                      </CardDescription>
                                    </div>
                                  </div>
                                  {correspondingNotification && !correspondingNotification.read && (
                                    <Badge variant="default" className="flex-shrink-0">New</Badge>
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Club:</p>
                                    <p className="font-medium">{request.clubName}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Team:</p>
                                    <p className="font-medium">{request.teamName}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Requested Role:</p>
                                    <p className="font-medium">{getRoleLabel(request.requestedRole)}</p>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(Number(request.createdAt) / 1000000).toLocaleString()}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleApprove(request.id, correspondingNotification?.id)}
                                    disabled={approveRequest.isPending || rejectRequest.isPending || isClearingAll}
                                  >
                                    {approveRequest.isPending ? 'Approving...' : 'Approve'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => handleReject(request.id, correspondingNotification?.id)}
                                    disabled={approveRequest.isPending || rejectRequest.isPending || isClearingAll}
                                  >
                                    {rejectRequest.isPending ? 'Rejecting...' : 'Reject'}
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>

              {totalNotifications > 0 && (
                <div className="pt-4 border-t mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAll}
                    disabled={isClearingAll}
                    className="w-full gap-2"
                  >
                    <img 
                      src="/assets/generated/clear-all-notifications-icon-emerald-transparent.dim_24x24.png" 
                      alt="Clear All" 
                      className="h-4 w-4" 
                    />
                    {isClearingAll ? 'Clearing...' : 'Clear All'}
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all {totalNotifications} notification{totalNotifications !== 1 ? 's' : ''} from all categories (Messages, Events, Approvals, and Requests). All pending join requests will also be rejected. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmClearAll} 
              disabled={isClearingAll}
            >
              {isClearingAll ? 'Processing...' : 'Clear All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
