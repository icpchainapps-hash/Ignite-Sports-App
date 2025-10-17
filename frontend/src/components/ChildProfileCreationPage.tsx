import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateChildProfile } from '../hooks/useChildProfileQueries';
import { useGetAllClubs } from '../hooks/useClubsQueries';
import { useGetAllTeams } from '../hooks/useTeamsQueries';
import { Club, Team } from '../backend';
import { toast } from 'sonner';
import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChildProfileCreationPageProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ChildProfileCreationPage({ onClose, onSuccess }: ChildProfileCreationPageProps) {
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [clubId, setClubId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const { data: allClubs = [], isLoading: clubsLoading } = useGetAllClubs();
  const { data: allTeams = [], isLoading: teamsLoading } = useGetAllTeams();
  const createChildProfile = useCreateChildProfile();

  // Lock body scroll when component mounts
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  // Filter teams by selected club
  const availableTeams = clubId
    ? allTeams.filter((team: Team) => team.clubId === clubId)
    : [];

  // Clear team selection when club changes
  useEffect(() => {
    if (clubId && teamId) {
      const teamBelongsToClub = allTeams.some(
        (team: Team) => team.id === teamId && team.clubId === clubId
      );
      if (!teamBelongsToClub) {
        setTeamId('');
      }
    }
  }, [clubId, teamId, allTeams]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = "Child's name is required";
    }

    if (!dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(dateOfBirth);
      if (selectedDate > today) {
        newErrors.dateOfBirth = 'Date of birth cannot be in the future';
      }
    }

    if (!clubId) {
      newErrors.clubId = 'Club selection is required';
    }

    if (!teamId) {
      newErrors.teamId = 'Team selection is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fill in all required fields correctly');
      return;
    }

    try {
      await createChildProfile.mutateAsync({
        name: name.trim(),
        dateOfBirth,
        clubId,
        teamId,
      });

      toast.success('Child profile created successfully');
      
      // Reset form
      setName('');
      setDateOfBirth('');
      setClubId('');
      setTeamId('');
      setErrors({});

      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
    } catch (error: any) {
      console.error('[Child Profile Creation] Error:', error);
      toast.error(error.message || 'Failed to create child profile');
    }
  };

  const handleCancel = () => {
    setName('');
    setDateOfBirth('');
    setClubId('');
    setTeamId('');
    setErrors({});
    onClose();
  };

  // Get today's date in YYYY-MM-DD format for max date validation
  const today = new Date().toISOString().split('T')[0];

  const overlayContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-background flex flex-col"
      style={{
        height: '100svh',
        minHeight: '100dvh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b bg-background shrink-0">
        <div className="flex items-center space-x-3">
          <img 
            src="/assets/generated/child-profile-creation-icon-transparent.dim_64x64.png" 
            alt="Child Profile" 
            className="w-8 h-8 sm:w-10 sm:h-10"
          />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Create Child Profile</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">Add your child to a team</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          className="shrink-0 h-10 w-10 sm:h-12 sm:w-12"
        >
          <X className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Child's Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-semibold">
                Child's Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    setErrors({ ...errors, name: '' });
                  }
                }}
                placeholder="Enter child's full name"
                className="h-12 text-base"
                disabled={createChildProfile.isPending}
              />
              {errors.name && (
                <div className="flex items-center space-x-2 text-destructive text-sm">
                  <img 
                    src="/assets/generated/child-profile-error-icon-transparent.dim_16x16.png" 
                    alt="Error" 
                    className="w-4 h-4"
                  />
                  <span>{errors.name}</span>
                </div>
              )}
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth" className="text-base font-semibold">
                Date of Birth <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => {
                  setDateOfBirth(e.target.value);
                  if (errors.dateOfBirth) {
                    setErrors({ ...errors, dateOfBirth: '' });
                  }
                }}
                max={today}
                className="h-12 text-base"
                disabled={createChildProfile.isPending}
              />
              {errors.dateOfBirth && (
                <div className="flex items-center space-x-2 text-destructive text-sm">
                  <img 
                    src="/assets/generated/child-profile-error-icon-transparent.dim_16x16.png" 
                    alt="Error" 
                    className="w-4 h-4"
                  />
                  <span>{errors.dateOfBirth}</span>
                </div>
              )}
            </div>

            {/* Club Selection - Button Group */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Club <span className="text-destructive">*</span>
              </Label>
              {clubsLoading ? (
                <div className="flex items-center justify-center p-6 border rounded-lg bg-muted">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-3 text-sm text-muted-foreground">Loading clubs...</span>
                </div>
              ) : allClubs.length === 0 ? (
                <div className="p-4 border rounded-lg bg-muted text-center">
                  <p className="text-sm text-muted-foreground">
                    No clubs available. Please create a club first.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allClubs.map((club: Club) => (
                    <button
                      key={club.id}
                      type="button"
                      onClick={() => {
                        setClubId(club.id);
                        if (errors.clubId) {
                          setErrors({ ...errors, clubId: '' });
                        }
                      }}
                      disabled={createChildProfile.isPending}
                      className={cn(
                        "relative flex items-center justify-between p-4 h-auto min-h-[3rem] rounded-lg border-2 transition-all",
                        "text-left text-base font-medium",
                        "hover:bg-accent hover:border-primary/50",
                        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        clubId === club.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background"
                      )}
                    >
                      <span className="flex-1 pr-2 break-words">{club.name}</span>
                      {clubId === club.id && (
                        <Check className="h-5 w-5 shrink-0 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {errors.clubId && (
                <div className="flex items-center space-x-2 text-destructive text-sm">
                  <img 
                    src="/assets/generated/child-profile-error-icon-transparent.dim_16x16.png" 
                    alt="Error" 
                    className="w-4 h-4"
                  />
                  <span>{errors.clubId}</span>
                </div>
              )}
            </div>

            {/* Team Selection - Button Group */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Team <span className="text-destructive">*</span>
              </Label>
              {!clubId ? (
                <div className="p-4 border rounded-lg bg-muted text-center">
                  <p className="text-sm text-muted-foreground">
                    Please select a club first
                  </p>
                </div>
              ) : teamsLoading ? (
                <div className="flex items-center justify-center p-6 border rounded-lg bg-muted">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-3 text-sm text-muted-foreground">Loading teams...</span>
                </div>
              ) : availableTeams.length === 0 ? (
                <div className="p-4 border rounded-lg bg-muted text-center">
                  <p className="text-sm text-muted-foreground">
                    No teams available for this club. Please create a team first.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableTeams.map((team: Team) => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => {
                        setTeamId(team.id);
                        if (errors.teamId) {
                          setErrors({ ...errors, teamId: '' });
                        }
                      }}
                      disabled={createChildProfile.isPending}
                      className={cn(
                        "relative flex items-center justify-between p-4 h-auto min-h-[3rem] rounded-lg border-2 transition-all",
                        "text-left text-base font-medium",
                        "hover:bg-accent hover:border-primary/50",
                        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        teamId === team.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background"
                      )}
                    >
                      <span className="flex-1 pr-2 break-words">{team.name}</span>
                      {teamId === team.id && (
                        <Check className="h-5 w-5 shrink-0 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {errors.teamId && (
                <div className="flex items-center space-x-2 text-destructive text-sm">
                  <img 
                    src="/assets/generated/child-profile-error-icon-transparent.dim_16x16.png" 
                    alt="Error" 
                    className="w-4 h-4"
                  />
                  <span>{errors.teamId}</span>
                </div>
              )}
            </div>

            {/* Info Message */}
            <div className="rounded-lg border bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold">Note:</span> After creating the profile, your child will be added as a player to the selected team and will be automatically invited to team events.
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 p-4 sm:p-6 border-t bg-background shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={createChildProfile.isPending}
          className="h-12 sm:h-14 px-6 sm:px-8 text-base"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          onClick={handleSubmit}
          disabled={createChildProfile.isPending || clubsLoading || teamsLoading}
          className="h-12 sm:h-14 px-6 sm:px-8 text-base"
        >
          {createChildProfile.isPending ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Creating...
            </>
          ) : (
            <>
              <img 
                src="/assets/generated/child-profile-success-icon-transparent.dim_20x20.png" 
                alt="Create" 
                className="w-5 h-5 mr-2"
              />
              Create Profile
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return createPortal(overlayContent, document.body);
}
