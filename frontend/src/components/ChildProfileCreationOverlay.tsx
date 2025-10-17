import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import { useCreateChildProfile } from '../hooks/useChildProfileQueries';
import { useGetAllClubs } from '../hooks/useClubsQueries';
import { useGetAllTeams } from '../hooks/useTeamsQueries';
import { Team } from '../backend';
import { Club } from '../types';
import { toast } from 'sonner';

interface ChildProfileCreationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChildProfileCreationOverlay({ isOpen, onClose }: ChildProfileCreationOverlayProps) {
  const [childName, setChildName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const { data: allClubs = [], isLoading: clubsLoading } = useGetAllClubs();
  const { data: allTeams = [], isLoading: teamsLoading } = useGetAllTeams();
  const createChildProfile = useCreateChildProfile();

  // Filter teams by selected club
  const clubTeams = selectedClubId 
    ? allTeams.filter((team: Team) => team.clubId === selectedClubId)
    : [];

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

  // Clear team selection when club changes
  useEffect(() => {
    setSelectedTeamId('');
  }, [selectedClubId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!childName.trim()) {
      toast.error('Please enter child\'s name');
      return;
    }

    if (!dateOfBirth) {
      toast.error('Please select date of birth');
      return;
    }

    // Validate date is not in the future
    const selectedDate = new Date(dateOfBirth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate > today) {
      toast.error('Date of birth cannot be in the future');
      return;
    }

    if (!selectedClubId) {
      toast.error('Please select a club');
      return;
    }

    if (!selectedTeamId) {
      toast.error('Please select a team');
      return;
    }

    try {
      await createChildProfile.mutateAsync({
        name: childName.trim(),
        dateOfBirth,
        clubId: selectedClubId,
        teamId: selectedTeamId,
      });

      toast.success('Child profile created successfully');
      
      // Reset form
      setChildName('');
      setDateOfBirth('');
      setSelectedClubId('');
      setSelectedTeamId('');
      
      onClose();
    } catch (error: any) {
      console.error('Failed to create child profile:', error);
      toast.error(error.message || 'Failed to create child profile');
    }
  };

  const handleClose = () => {
    // Reset form on close
    setChildName('');
    setDateOfBirth('');
    setSelectedClubId('');
    setSelectedTeamId('');
    onClose();
  };

  // Get today's date in YYYY-MM-DD format for max date validation
  const today = new Date().toISOString().split('T')[0];

  if (!isOpen) return null;

  const overlayContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-background flex flex-col"
      style={{
        height: '100svh',
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
            <h2 className="text-xl sm:text-2xl font-semibold">Create Child Profile</h2>
            <p className="text-sm text-muted-foreground hidden sm:block">Add your child to a team</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
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
              <Label htmlFor="childName" className="text-base">
                Child's Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="childName"
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="Enter child's full name"
                className="h-12 text-base"
                required
              />
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth" className="text-base">
                Date of Birth <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={today}
                className="h-12 text-base"
                required
              />
              <p className="text-xs text-muted-foreground">
                Date cannot be in the future
              </p>
            </div>

            {/* Club Selection */}
            <div className="space-y-2">
              <Label htmlFor="club" className="text-base">
                Club <span className="text-destructive">*</span>
              </Label>
              <Select 
                value={selectedClubId} 
                onValueChange={setSelectedClubId}
                disabled={clubsLoading}
              >
                <SelectTrigger id="club" className="h-12 text-base">
                  <SelectValue placeholder={clubsLoading ? "Loading clubs..." : "Select a club"} />
                </SelectTrigger>
                <SelectContent>
                  {clubsLoading ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Loading clubs...
                    </div>
                  ) : allClubs.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      No clubs available
                    </div>
                  ) : (
                    allClubs.map((club: Club) => (
                      <SelectItem key={club.id} value={club.id} className="h-12 text-base">
                        {club.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Team Selection - Only shown after club is selected */}
            {selectedClubId && (
              <div className="space-y-2">
                <Label htmlFor="team" className="text-base">
                  Team <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={selectedTeamId} 
                  onValueChange={setSelectedTeamId}
                  disabled={teamsLoading || clubTeams.length === 0}
                >
                  <SelectTrigger id="team" className="h-12 text-base">
                    <SelectValue 
                      placeholder={
                        teamsLoading 
                          ? "Loading teams..." 
                          : clubTeams.length === 0 
                            ? "No teams available for this club" 
                            : "Select a team"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {teamsLoading ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        Loading teams...
                      </div>
                    ) : clubTeams.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        No teams available for this club
                      </div>
                    ) : (
                      clubTeams.map((team: Team) => (
                        <SelectItem key={team.id} value={team.id} className="h-12 text-base">
                          {team.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedClubId && clubTeams.length === 0 && !teamsLoading && (
                  <p className="text-xs text-muted-foreground">
                    Please create a team for this club first
                  </p>
                )}
              </div>
            )}

            {/* Validation Messages */}
            {!selectedClubId && (
              <div className="flex items-start space-x-2 p-3 rounded-lg bg-muted">
                <img 
                  src="/assets/generated/child-profile-error-icon-transparent.dim_16x16.png" 
                  alt="Info" 
                  className="w-4 h-4 mt-0.5 shrink-0"
                />
                <p className="text-sm text-muted-foreground">
                  Please select a club to see available teams
                </p>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 p-4 sm:p-6 border-t bg-background shrink-0">
        <Button 
          type="button"
          variant="outline" 
          onClick={handleClose}
          className="h-12 sm:h-14 px-6 sm:px-8 text-base"
        >
          Cancel
        </Button>
        <Button 
          type="submit"
          onClick={handleSubmit}
          disabled={
            !childName.trim() || 
            !dateOfBirth || 
            !selectedClubId || 
            !selectedTeamId || 
            createChildProfile.isPending
          }
          className="h-12 sm:h-14 px-6 sm:px-8 text-base"
        >
          {createChildProfile.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
