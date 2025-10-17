import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, AlertCircle, Loader2, Check } from 'lucide-react';
import { UserRole } from '../backend';
import { Club } from '../types';
import { toast } from 'sonner';
import ChildProfileCreationPage from './ChildProfileCreationPage';
import { cn } from '@/lib/utils';

const ROLE_OPTIONS: { value: UserRole; label: string; requiresContext: 'club' | 'team' | 'none' }[] = [
  { value: UserRole.appAdmin, label: 'App Admin', requiresContext: 'none' },
  { value: UserRole.clubAdmin, label: 'Club Admin', requiresContext: 'club' },
  { value: UserRole.teamAdmin, label: 'Team Admin', requiresContext: 'team' },
  { value: UserRole.coach, label: 'Coach', requiresContext: 'team' },
  { value: UserRole.player, label: 'Player', requiresContext: 'team' },
  { value: UserRole.parent, label: 'Parent', requiresContext: 'team' },
];

interface AddRoleOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (role: UserRole, clubId: string, teamId: string) => Promise<void>;
  allClubs: Club[] | undefined;
  availableTeams: Array<{ id: string; name: string; clubId: string }>;
  isSubmitting: boolean;
  clubsLoading?: boolean;
  teamsLoading?: boolean;
}

export default function AddRoleOverlay({
  isOpen,
  onClose,
  onSubmit,
  allClubs,
  availableTeams,
  isSubmitting,
  clubsLoading = false,
  teamsLoading = false,
}: AddRoleOverlayProps) {
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedClub, setSelectedClub] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [showChildProfileCreation, setShowChildProfileCreation] = useState(false);

  // Lock body scroll when overlay is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, [isOpen]);

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedRole('');
      setSelectedClub('');
      setSelectedTeam('');
      setShowChildProfileCreation(false);
    }
  }, [isOpen]);

  // Clear team when club changes
  useEffect(() => {
    setSelectedTeam('');
  }, [selectedClub]);

  const handleSubmit = async () => {
    if (!selectedRole) {
      toast.error('Please select a role');
      return;
    }

    const roleOption = ROLE_OPTIONS.find(opt => opt.value === selectedRole);
    
    if (roleOption?.requiresContext === 'club') {
      if (!selectedClub) {
        toast.error('Please select a club');
        return;
      }
      
      toast.error('Club admin role assignment not yet implemented');
      return;
    } else if (roleOption?.requiresContext === 'team') {
      if (!selectedClub || !selectedTeam) {
        toast.error('Please select both club and team');
        return;
      }

      try {
        await onSubmit(selectedRole as UserRole, selectedClub, selectedTeam);
        
        // If parent role was assigned, immediately show child profile creation
        if (selectedRole === UserRole.parent) {
          console.log('[Add Role] Parent role assigned, showing child profile creation');
          setShowChildProfileCreation(true);
        } else {
          // For non-parent roles, close the overlay
          onClose();
        }
      } catch (error: any) {
        console.error('[Add Role] Error:', error);
      }
    }
  };

  const handleChildProfileCreationClose = () => {
    console.log('[Add Role] Child profile creation closed');
    setShowChildProfileCreation(false);
    onClose();
  };

  const handleChildProfileCreationSuccess = () => {
    console.log('[Add Role] Child profile created successfully');
    setShowChildProfileCreation(false);
    onClose();
  };

  // Safely get clubs array
  const clubsArray = Array.isArray(allClubs) ? allClubs : [];
  
  // Filter teams based on selected club
  const filteredTeams = selectedClub && Array.isArray(availableTeams)
    ? availableTeams.filter(team => team.clubId === selectedClub)
    : [];

  // Determine what to show
  const selectedRoleOption = ROLE_OPTIONS.find(opt => opt.value === selectedRole);
  const showClubSelect = Boolean(selectedRole && selectedRoleOption);
  const showTeamSelect = Boolean(
    selectedRole && 
    selectedRoleOption && 
    selectedRoleOption.requiresContext === 'team' && 
    selectedClub
  );

  // Check data availability
  const hasClubs = clubsArray.length > 0;
  const hasTeams = filteredTeams.length > 0;

  // Calculate if submit should be disabled
  const canSubmit = (() => {
    if (!selectedRole || isSubmitting || clubsLoading || teamsLoading) {
      return false;
    }

    const roleOption = ROLE_OPTIONS.find(opt => opt.value === selectedRole);
    if (!roleOption) return false;

    if (roleOption.requiresContext === 'none') {
      return true;
    }

    if (roleOption.requiresContext === 'club') {
      return Boolean(selectedClub && hasClubs);
    }

    if (roleOption.requiresContext === 'team') {
      return Boolean(selectedClub && selectedTeam && hasClubs && hasTeams);
    }

    return false;
  })();

  if (!isOpen) return null;

  // Show child profile creation overlay if parent role was just assigned
  if (showChildProfileCreation) {
    return (
      <ChildProfileCreationPage
        onClose={handleChildProfileCreationClose}
        onSuccess={handleChildProfileCreationSuccess}
      />
    );
  }

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-background"
      style={{
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        minHeight: '100svh',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b bg-background safe-top">
        <div className="flex-1 min-w-0 mr-4">
          <h2 className="text-xl sm:text-2xl font-semibold truncate">
            Add Role
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select a role and its associated club or team
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="shrink-0 h-12 w-12"
          disabled={isSubmitting}
        >
          <X className="h-6 w-6" />
        </Button>
      </div>
      
      {/* Content */}
      <div 
        className="overflow-y-auto overflow-x-hidden"
        style={{
          height: 'calc(100vh - 140px)',
          maxHeight: 'calc(100dvh - 140px)',
        }}
      >
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
          {/* Role Selection - Button Group */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Role <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ROLE_OPTIONS.map((option) => {
                const isSelected = selectedRole === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedRole(option.value)}
                    disabled={isSubmitting}
                    className={cn(
                      "relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200",
                      "min-h-[80px] sm:min-h-[90px] touch-manipulation",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-md"
                        : "border-border bg-background hover:border-primary/50 hover:bg-accent"
                    )}
                    aria-pressed={isSelected}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="rounded-full bg-primary p-1">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                    <span className={cn(
                      "text-sm sm:text-base font-medium text-center",
                      isSelected ? "text-primary" : "text-foreground"
                    )}>
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Tap a role to select it
            </p>
          </div>

          {/* Club Selection - Button Group */}
          {showClubSelect && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Club <span className="text-destructive">*</span></Label>
              {clubsLoading ? (
                <div className="p-6 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2 border rounded-lg bg-muted/50">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm">Loading clubs...</span>
                </div>
              ) : !hasClubs ? (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-destructive">No clubs available</p>
                    <p className="text-sm text-destructive/80">
                      You need to create a club before assigning roles.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {clubsArray.map((club) => {
                      const isSelected = selectedClub === club.id;
                      return (
                        <button
                          key={club.id}
                          type="button"
                          onClick={() => setSelectedClub(club.id)}
                          disabled={isSubmitting}
                          className={cn(
                            "relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200",
                            "min-h-[80px] touch-manipulation",
                            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-md"
                              : "border-border bg-background hover:border-primary/50 hover:bg-accent"
                          )}
                          aria-pressed={isSelected}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2">
                              <div className="rounded-full bg-primary p-1">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            </div>
                          )}
                          <span className={cn(
                            "text-sm sm:text-base font-medium text-center break-words w-full px-2",
                            isSelected ? "text-primary" : "text-foreground"
                          )}>
                            {club.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {clubsArray.length} {clubsArray.length === 1 ? 'club' : 'clubs'} available - tap to select
                  </p>
                </>
              )}
            </div>
          )}

          {/* Team Selection - Button Group */}
          {showTeamSelect && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Team <span className="text-destructive">*</span></Label>
              {teamsLoading ? (
                <div className="p-6 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2 border rounded-lg bg-muted/50">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm">Loading teams...</span>
                </div>
              ) : !hasTeams ? (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-destructive">No teams available</p>
                    <p className="text-sm text-destructive/80">
                      No teams available for this club. Create a team first.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredTeams.map((team) => {
                      const isSelected = selectedTeam === team.id;
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => setSelectedTeam(team.id)}
                          disabled={isSubmitting}
                          className={cn(
                            "relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200",
                            "min-h-[80px] touch-manipulation",
                            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-md"
                              : "border-border bg-background hover:border-primary/50 hover:bg-accent"
                          )}
                          aria-pressed={isSelected}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2">
                              <div className="rounded-full bg-primary p-1">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            </div>
                          )}
                          <span className={cn(
                            "text-sm sm:text-base font-medium text-center break-words w-full px-2",
                            isSelected ? "text-primary" : "text-foreground"
                          )}>
                            {team.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {filteredTeams.length} {filteredTeams.length === 1 ? 'team' : 'teams'} available for this club - tap to select
                  </p>
                </>
              )}
            </div>
          )}

          {/* Parent Role Info */}
          {selectedRole === UserRole.parent && selectedClub && selectedTeam && (
            <div className="rounded-lg border bg-muted p-4">
              <div className="flex items-start space-x-3">
                <img 
                  src="/assets/generated/child-profile-icon-transparent.dim_64x64.png" 
                  alt="Info" 
                  className="w-6 h-6 mt-0.5 shrink-0"
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Parent Role Selected</p>
                  <p className="text-sm text-muted-foreground">
                    After adding this role, you'll be immediately prompted to create a child profile for the selected team.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 p-4 sm:p-6 border-t bg-background safe-bottom">
        <Button 
          variant="outline" 
          onClick={onClose}
          className="h-12 px-6 text-base min-w-[100px]"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={!canSubmit}
          className="h-12 px-6 text-base min-w-[120px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Adding...
            </>
          ) : (
            'Add Role'
          )}
        </Button>
      </div>
    </div>,
    document.body
  );
}

