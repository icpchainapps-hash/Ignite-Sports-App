import { useState, useEffect } from 'react';
import { MessageSquare, X, AlertCircle, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useGetClubsForTeamAdmin } from '../hooks/useClubsQueries';
import { useGetTeamsForAdmin } from '../hooks/useTeamsQueries';
import { useCreateChatThread } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { MessageType, UserRole } from '../backend';

interface CreateThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAppAdmin: boolean;
  isClubAdmin: boolean;
  isTeamAdmin: boolean;
}

const ROLE_OPTIONS = [
  { value: UserRole.coach, label: 'Coaches' },
  { value: UserRole.teamAdmin, label: 'Team Admins' },
  { value: UserRole.parent, label: 'Parents' },
  { value: UserRole.player, label: 'Players' },
  { value: UserRole.clubAdmin, label: 'Club Admins' },
];

export default function CreateThreadDialog({
  open,
  onOpenChange,
  isAppAdmin,
  isClubAdmin,
  isTeamAdmin,
}: CreateThreadDialogProps) {
  const { identity } = useInternetIdentity();
  const [threadType, setThreadType] = useState<'broadcast' | 'clubWide' | 'teamWide'>('broadcast');
  const [title, setTitle] = useState('');
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);

  const { data: adminClubs = [], isLoading: clubsLoading, error: clubsError } = useGetClubsForTeamAdmin();
  const { data: adminTeams = [], isLoading: teamsLoading, error: teamsError } = useGetTeamsForAdmin();
  const createThread = useCreateChatThread();

  // Filter teams by selected club when creating team-wide threads
  const filteredTeams = threadType === 'teamWide' && selectedClubId
    ? adminTeams.filter(team => team.clubId === selectedClubId)
    : adminTeams;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTitle('');
      setSelectedClubId('');
      setSelectedTeamId('');
      setSelectedRoles([]);
      // Set default thread type based on permissions
      if (isAppAdmin) {
        setThreadType('broadcast');
      } else if (isClubAdmin) {
        setThreadType('clubWide');
      } else if (isTeamAdmin) {
        setThreadType('teamWide');
      }
    }
  }, [open, isAppAdmin, isClubAdmin, isTeamAdmin]);

  // Reset team selection when club changes
  useEffect(() => {
    if (threadType === 'teamWide') {
      setSelectedTeamId('');
    }
  }, [selectedClubId, threadType]);

  // Reset role filters when thread type changes
  useEffect(() => {
    setSelectedRoles([]);
  }, [threadType]);

  // Auto-select club if only one is available
  useEffect(() => {
    if (open && (threadType === 'clubWide' || threadType === 'teamWide') && adminClubs.length === 1 && !selectedClubId) {
      console.log('[CreateThreadDialog] Auto-selecting single club:', adminClubs[0].id);
      setSelectedClubId(adminClubs[0].id);
    }
  }, [open, threadType, adminClubs, selectedClubId]);

  const handleRoleToggle = (role: UserRole) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a thread title');
      return;
    }

    // Validate permissions
    if (threadType === 'broadcast' && !isAppAdmin) {
      toast.error('Only app administrators can create broadcast threads');
      return;
    }

    if (threadType === 'clubWide' && !isClubAdmin && !isAppAdmin) {
      toast.error('Only club administrators can create club-wide threads');
      return;
    }

    if (threadType === 'teamWide' && !isTeamAdmin && !isAppAdmin) {
      toast.error('Only team administrators can create team-wide threads');
      return;
    }

    if (threadType === 'clubWide' && !selectedClubId) {
      toast.error('Please select a club');
      return;
    }

    if (threadType === 'teamWide' && !selectedClubId) {
      toast.error('Please select a club');
      return;
    }

    if (threadType === 'teamWide' && !selectedTeamId) {
      toast.error('Please select a team');
      return;
    }

    // Validate role filters for club and broadcast threads
    if ((threadType === 'clubWide' || threadType === 'broadcast') && selectedRoles.length === 0) {
      toast.error('Please select at least one role to filter by, or leave all unchecked to include all members');
    }

    try {
      const backendThreadType: MessageType = 
        threadType === 'broadcast' ? MessageType.broadcast :
        threadType === 'clubWide' ? MessageType.clubWide :
        MessageType.teamWide;

      console.log('[CreateThreadDialog] Creating thread:', {
        title,
        threadType: backendThreadType,
        clubId: (threadType === 'clubWide' || threadType === 'teamWide') ? selectedClubId : undefined,
        teamId: threadType === 'teamWide' ? selectedTeamId : undefined,
        roleFilters: selectedRoles.length > 0 ? selectedRoles : undefined,
      });

      await createThread.mutateAsync({
        title,
        threadType: backendThreadType,
        clubId: (threadType === 'clubWide' || threadType === 'teamWide') ? selectedClubId : undefined,
        teamId: threadType === 'teamWide' ? selectedTeamId : undefined,
        roleFilters: selectedRoles.length > 0 ? selectedRoles : undefined,
      });

      toast.success('Thread created successfully');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating thread:', error);
      toast.error(error?.message || 'Failed to create thread');
    }
  };

  const getThreadTypeOptions = () => {
    const options: Array<{ value: 'broadcast' | 'clubWide' | 'teamWide'; label: string; icon: string }> = [];
    
    if (isAppAdmin) {
      options.push({ 
        value: 'broadcast', 
        label: 'Broadcast (All Users)', 
        icon: '/assets/generated/broadcast-message-icon-transparent.dim_24x24.png' 
      });
    }
    
    if (isClubAdmin || isAppAdmin) {
      options.push({ 
        value: 'clubWide', 
        label: 'Club-Wide', 
        icon: '/assets/generated/club-message-icon-transparent.dim_24x24.png' 
      });
    }
    
    if (isTeamAdmin || isAppAdmin) {
      options.push({ 
        value: 'teamWide', 
        label: 'Team-Wide', 
        icon: '/assets/generated/team-message-icon-transparent.dim_24x24.png' 
      });
    }
    
    return options;
  };

  const threadTypeOptions = getThreadTypeOptions();

  const isLoading = clubsLoading || teamsLoading;
  const hasError = !!clubsError || !!teamsError;

  // Check if user has permission to create the selected thread type
  const hasPermissionForSelectedType = 
    (threadType === 'broadcast' && isAppAdmin) ||
    (threadType === 'clubWide' && (isClubAdmin || isAppAdmin)) ||
    (threadType === 'teamWide' && (isTeamAdmin || isAppAdmin));

  // Show role filter for club-wide and broadcast threads
  const showRoleFilter = threadType === 'clubWide' || threadType === 'broadcast';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm" />
        <DialogContent 
          className="fixed inset-0 z-[10000] w-screen h-screen max-w-none m-0 p-0 rounded-none border-0 flex flex-col bg-background overflow-hidden [&>button]:hidden"
          style={{
            width: '100vw',
            height: '100vh',
            maxWidth: '100vw',
            maxHeight: '100vh',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: 'none',
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            if (!createThread.isPending) {
              onOpenChange(false);
            } else {
              e.preventDefault();
            }
          }}
        >
          {/* Header - Fixed */}
          <div className="flex-shrink-0 border-b border-border bg-card/50 backdrop-blur-sm safe-top">
            <div className="flex items-center justify-between p-3 sm:p-4 md:p-6">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">
                  Create Thread
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block truncate">
                  Create a new message thread for club members, team members, or all users
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                disabled={createThread.isPending}
                className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-muted"
                aria-label="Close"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </Button>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="w-full max-w-4xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8">
              <div className="space-y-4 sm:space-y-5 md:space-y-6">
                {/* Loading State */}
                {isLoading && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Loading clubs and teams...
                    </AlertDescription>
                  </Alert>
                )}

                {/* Error State */}
                {hasError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Failed to load clubs or teams. Please try again.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Permission Warning */}
                {!hasPermissionForSelectedType && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You do not have permission to create {threadType === 'broadcast' ? 'broadcast' : threadType === 'clubWide' ? 'club-wide' : 'team-wide'} threads.
                      {threadType === 'broadcast' && ' Only app administrators can create broadcast threads.'}
                      {threadType === 'clubWide' && ' Only club administrators can create club-wide threads.'}
                      {threadType === 'teamWide' && ' Only team administrators can create team-wide threads.'}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Thread Type */}
                <div className="space-y-2">
                  <Label htmlFor="threadType" className="text-sm sm:text-base font-semibold">
                    Thread Type
                  </Label>
                  <Select value={threadType} onValueChange={(v) => setThreadType(v as typeof threadType)}>
                    <SelectTrigger id="threadType" className="h-11 sm:h-12 text-sm sm:text-base w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[10001]">
                      {threadTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-sm sm:text-base py-2 sm:py-3">
                          <div className="flex items-center gap-2">
                            <img src={option.icon} alt={option.label} className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                            <span className="truncate">{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Club Selection (if club-wide or team-wide) */}
                {(threadType === 'clubWide' || threadType === 'teamWide') && (
                  <div className="space-y-2">
                    <Label htmlFor="club" className="text-sm sm:text-base font-semibold">
                      Select Club
                    </Label>
                    {clubsLoading ? (
                      <div className="flex items-center justify-center h-12 border rounded-md bg-muted/30">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                      </div>
                    ) : adminClubs.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No clubs available. You need to be a club admin to create {threadType === 'clubWide' ? 'club-wide' : 'team-wide'} threads.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Select value={selectedClubId} onValueChange={setSelectedClubId}>
                        <SelectTrigger id="club" className="h-11 sm:h-12 text-sm sm:text-base w-full">
                          <SelectValue placeholder="Choose a club..." />
                        </SelectTrigger>
                        <SelectContent className="z-[10001]">
                          {adminClubs.map((club) => (
                            <SelectItem key={club.id} value={club.id} className="text-sm sm:text-base py-2 sm:py-3">
                              <span className="truncate">{club.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {/* Team Selection (if team-wide) */}
                {threadType === 'teamWide' && (
                  <div className="space-y-2">
                    <Label htmlFor="team" className="text-sm sm:text-base font-semibold">
                      Select Team
                    </Label>
                    {teamsLoading ? (
                      <div className="flex items-center justify-center h-12 border rounded-md bg-muted/30">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                      </div>
                    ) : !selectedClubId ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Please select a club first.
                        </AlertDescription>
                      </Alert>
                    ) : filteredTeams.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No teams available for the selected club. You need to be a team admin to create team-wide threads.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Select 
                        value={selectedTeamId} 
                        onValueChange={setSelectedTeamId}
                        disabled={!selectedClubId}
                      >
                        <SelectTrigger id="team" className="h-11 sm:h-12 text-sm sm:text-base w-full">
                          <SelectValue placeholder={selectedClubId ? "Choose a team..." : "Select a club first..."} />
                        </SelectTrigger>
                        <SelectContent className="z-[10001]">
                          {filteredTeams.map((team) => (
                            <SelectItem key={team.id} value={team.id} className="text-sm sm:text-base py-2 sm:py-3">
                              <span className="truncate">{team.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {/* Role Filter (for club-wide and broadcast threads) */}
                {showRoleFilter && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <Label className="text-sm sm:text-base font-semibold">
                        Filter by Role (Optional)
                      </Label>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Select specific roles to limit who can see and participate in this thread. Leave all unchecked to include all members.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-border bg-muted/30">
                      {ROLE_OPTIONS.map((role) => (
                        <div key={role.value} className="flex items-center space-x-3">
                          <Checkbox
                            id={`role-${role.value}`}
                            checked={selectedRoles.includes(role.value)}
                            onCheckedChange={() => handleRoleToggle(role.value)}
                            className="h-5 w-5"
                          />
                          <Label
                            htmlFor={`role-${role.value}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {role.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {selectedRoles.length > 0 && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <AlertCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-primary">
                          Only users with the selected role(s) will be able to see and participate in this thread.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Thread Title */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm sm:text-base font-semibold">
                    Thread Title
                  </Label>
                  <Input
                    id="title"
                    placeholder="Enter thread title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={100}
                    className="h-11 sm:h-12 text-sm sm:text-base w-full"
                  />
                  <p className="text-xs sm:text-sm text-muted-foreground">{title.length}/100 characters</p>
                </div>

                {/* Info Message */}
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        About Message Threads
                      </p>
                      <p className="text-xs text-muted-foreground">
                        After creating this thread, users will be able to post messages within it. 
                        {showRoleFilter && selectedRoles.length > 0 
                          ? ' Only users with the selected roles will have access to this thread.'
                          : ' The thread will be accessible to all members of the selected club, team, or all users depending on the thread type.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="flex-shrink-0 border-t border-border bg-card/50 backdrop-blur-sm safe-bottom">
            <div className="w-full max-w-4xl mx-auto p-3 sm:p-4 md:p-6">
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={createThread.isPending}
                  className="h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto sm:min-w-[120px]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createThread.isPending || !title.trim() || isLoading || hasError || !hasPermissionForSelectedType}
                  className="bg-primary hover:bg-primary/90 h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto sm:min-w-[140px]"
                >
                  {createThread.isPending ? (
                    <>Creating...</>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      Create Thread
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
