import { useState, useRef } from 'react';
import { Plus, Building2, X, Upload, Users, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useGetClubsByUser, useCreateClub, useUpdateClub, useDeleteClub, useGetClubMembers } from '../hooks/useClubsQueries';
import { useGetTeamsWithClubs, useCreateTeam, useUpdateTeam, useDeleteTeam, useGetTeamMembers, useGetAllTeams } from '../hooks/useTeamsQueries';
import { useGetAllClubs } from '../hooks/useClubsQueries';
import { useGetChatThreadsByClub, useGetChatThreadsByTeam, useAddPlayer, useSubmitJoinRequest } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useFileUpload, useFileUrl } from '../blob-storage/FileStorage';
import { toast } from 'sonner';
import { Club, Team, Player, PlayerRole, PositionEligibility, UserRole, TeamMember, ClubMember } from '../backend';
import ChatThreadsView from './ChatThreadsView';
import { ROLE_COLORS, ROLE_LABELS } from '../lib/constants';

const SPORTS = [
  { value: 'soccer', label: 'Soccer', icon: '/assets/generated/sport-soccer-icon-transparent.dim_32x32.png' },
  { value: 'basketball', label: 'Basketball', icon: '/assets/generated/sport-basketball-icon-transparent.dim_32x32.png' },
  { value: 'tennis', label: 'Tennis', icon: '/assets/generated/sport-tennis-icon-transparent.dim_32x32.png' },
  { value: 'baseball', label: 'Baseball', icon: '/assets/generated/sport-baseball-icon-transparent.dim_32x32.png' },
  { value: 'volleyball', label: 'Volleyball', icon: '/assets/generated/sport-volleyball-icon-transparent.dim_32x32.png' },
  { value: 'hockey', label: 'Hockey', icon: '/assets/generated/sport-hockey-icon-transparent.dim_32x32.png' },
];

function ClubLogo({ logoPath, clubName, size = 'md' }: { logoPath?: string; clubName: string; size?: 'sm' | 'md' | 'lg' }) {
  const { data: logoUrl } = useFileUrl(logoPath || '');
  
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };
  
  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  if (logoPath && logoUrl) {
    return (
      <img 
        src={logoUrl} 
        alt={`${clubName} logo`}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-primary/20`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-primary/10 flex items-center justify-center`}>
      <Building2 className={`${iconSizeClasses[size]} text-primary`} />
    </div>
  );
}

export default function ClubsAndTeamsPage() {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();

  const { data: myClubs = [], isLoading: clubsLoading, error: clubsError } = useGetClubsByUser();
  const { data: myTeamsWithClubs = [], isLoading: teamsLoading, error: teamsError } = useGetTeamsWithClubs();
  const { data: allClubs = [], isLoading: allClubsLoading, error: allClubsError } = useGetAllClubs();
  const { data: allTeams = [], isLoading: allTeamsLoading, error: allTeamsError } = useGetAllTeams();
  const createClub = useCreateClub();
  const createTeam = useCreateTeam();
  const updateClub = useUpdateClub();
  const updateTeam = useUpdateTeam();
  const deleteClub = useDeleteClub();
  const deleteTeam = useDeleteTeam();
  const { uploadFile, isUploading } = useFileUpload();
  const addPlayer = useAddPlayer();
  const submitJoinRequest = useSubmitJoinRequest();

  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isCreateClubOpen, setIsCreateClubOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isEditClubOpen, setIsEditClubOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [isDeleteClubDialogOpen, setIsDeleteClubDialogOpen] = useState(false);
  const [isDeleteTeamDialogOpen, setIsDeleteTeamDialogOpen] = useState(false);
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [isJoinTeamOpen, setIsJoinTeamOpen] = useState(false);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [clubName, setClubName] = useState('');
  const [clubSport, setClubSport] = useState('');
  const [teamName, setTeamName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedClubForView, setSelectedClubForView] = useState<Club | null>(null);
  const [selectedTeamForView, setSelectedTeamForView] = useState<{ team: Team; club: Club | null } | null>(null);
  const [selectedClubId, setSelectedClubId] = useState('');
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [clubFilterId, setClubFilterId] = useState<string>('all');
  const [requestedRole, setRequestedRole] = useState<UserRole>(UserRole.player);
  const [playerName, setPlayerName] = useState('');
  const [positionEligibility, setPositionEligibility] = useState<PositionEligibility>({
    goalkeeper: false,
    defender: false,
    midfielder: false,
    forward: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredTeamsForSearch = allTeams.filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(teamSearchQuery.toLowerCase());
    const matchesClub = clubFilterId === 'all' || team.clubId === clubFilterId;
    const notMyTeam = !myTeamsWithClubs.some(item => item.team.id === team.id);
    return matchesSearch && matchesClub && notMyTeam;
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a valid image file (PNG, JPG, JPEG, or GIF)');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Image file size must be less than 5MB');
      return;
    }

    setLogoFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenCreateClub = () => {
    setIsCreateMenuOpen(false);
    setClubName('');
    setClubSport('');
    setLogoFile(null);
    setLogoPreview(null);
    setIsCreateClubOpen(true);
  };

  const handleOpenCreateTeam = () => {
    setIsCreateMenuOpen(false);
    setIsCreateTeamOpen(true);
  };

  const handleCreateClub = async () => {
    if (!clubName.trim()) {
      toast.error('Please enter a club name');
      return;
    }

    if (!clubSport) {
      toast.error('Please select a sport');
      return;
    }

    try {
      let logoPath: string | null = null;

      if (logoFile) {
        const timestamp = Date.now();
        const fileName = `club-logo-${timestamp}-${logoFile.name}`;
        const filePath = `clubs/${fileName}`;

        const result = await uploadFile(filePath, logoFile);
        logoPath = result.path;
      }

      await createClub.mutateAsync({ name: clubName, sport: clubSport, logoPath });
      toast.success('Club created successfully');
      setIsCreateClubOpen(false);
      setClubName('');
      setClubSport('');
      setLogoFile(null);
      setLogoPreview(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create club');
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast.error('Please enter a team name');
      return;
    }

    if (!selectedClubId) {
      toast.error('Please select a club');
      return;
    }

    try {
      await createTeam.mutateAsync({ name: teamName, clubId: selectedClubId });
      toast.success('Team created successfully');
      setIsCreateTeamOpen(false);
      setTeamName('');
      setSelectedClubId('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create team');
    }
  };

  const handleEditClub = (club: Club) => {
    setSelectedClub(club);
    setClubName(club.name);
    const clubAny = club as any;
    setClubSport(clubAny.sport || '');
    setLogoPreview(null);
    setLogoFile(null);
    setIsEditClubOpen(true);
  };

  const handleUpdateClub = async () => {
    if (!selectedClub) return;
    
    if (!clubName.trim()) {
      toast.error('Please enter a club name');
      return;
    }

    if (!clubSport) {
      toast.error('Please select a sport');
      return;
    }

    try {
      let logoPath = selectedClub.logoPath;

      if (logoFile) {
        const timestamp = Date.now();
        const fileName = `club-logo-${timestamp}-${logoFile.name}`;
        const filePath = `clubs/${fileName}`;

        const result = await uploadFile(filePath, logoFile);
        logoPath = result.path;
      }

      const updatedClub: Club = {
        ...selectedClub,
        name: clubName,
        logoPath: logoPath || undefined,
      };

      await updateClub.mutateAsync({ clubId: selectedClub.id, updatedClub });
      toast.success('Club updated successfully');
      handleCloseEditClubModal();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update club');
    }
  };

  const handleEditTeam = (team: Team, club: Club | null) => {
    setSelectedTeam(team);
    setTeamName(team.name);
    setSelectedClubId(team.clubId);
    setIsEditTeamOpen(true);
  };

  const handleUpdateTeam = async () => {
    if (!selectedTeam) return;

    if (!teamName.trim()) {
      toast.error('Please enter a team name');
      return;
    }

    if (!selectedClubId) {
      toast.error('Please select a club');
      return;
    }

    try {
      const updatedTeam: Team = {
        ...selectedTeam,
        name: teamName,
        clubId: selectedClubId,
      };

      await updateTeam.mutateAsync({ teamId: selectedTeam.id, updatedTeam });
      toast.success('Team updated successfully');
      setIsEditTeamOpen(false);
      setSelectedTeam(null);
      setTeamName('');
      setSelectedClubId('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update team');
    }
  };

  const handleDeleteClub = (club: Club) => {
    setSelectedClub(club);
    setIsDeleteClubDialogOpen(true);
  };

  const confirmDeleteClub = async () => {
    if (!selectedClub) return;

    try {
      await deleteClub.mutateAsync(selectedClub.id);
      toast.success('Club and associated teams deleted successfully');
      setIsDeleteClubDialogOpen(false);
      setSelectedClub(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete club');
    }
  };

  const handleDeleteTeam = (team: Team) => {
    setSelectedTeam(team);
    setIsDeleteTeamDialogOpen(true);
  };

  const confirmDeleteTeam = async () => {
    if (!selectedTeam) return;

    try {
      await deleteTeam.mutateAsync(selectedTeam.id);
      toast.success('Team deleted successfully');
      setIsDeleteTeamDialogOpen(false);
      setSelectedTeam(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete team');
    }
  };

  const handleCloseEditClubModal = () => {
    setIsEditClubOpen(false);
    setSelectedClub(null);
    setClubName('');
    setClubSport('');
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleAddPlayer = async () => {
    if (!selectedTeam) return;

    if (!playerName.trim()) {
      toast.error('Please enter a player name');
      return;
    }

    const hasAtLeastOnePosition = Object.values(positionEligibility).some(v => v);
    if (!hasAtLeastOnePosition) {
      toast.error('Please select at least one position');
      return;
    }

    try {
      const newPlayer: Player = {
        id: `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: playerName,
        number: BigInt(selectedTeam.players.length + 1),
        role: positionEligibility.goalkeeper ? PlayerRole.goalkeeper :
              positionEligibility.defender ? PlayerRole.defender :
              positionEligibility.midfielder ? PlayerRole.midfielder :
              PlayerRole.forward,
        position: { x: 0, y: 0 },
        isOnField: false,
        positionEligibility,
      };

      await addPlayer.mutateAsync({ lineupId: selectedTeam.id, player: newPlayer });
      toast.success('Player added successfully');
      setIsAddPlayerOpen(false);
      setPlayerName('');
      setPositionEligibility({
        goalkeeper: false,
        defender: false,
        midfielder: false,
        forward: false,
      });
      setSelectedTeam(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add player');
    }
  };

  const handleSubmitJoinRequest = async () => {
    if (!selectedTeam) return;

    try {
      await submitJoinRequest.mutateAsync({
        teamId: selectedTeam.id,
        requestedRole,
      });
      toast.success('Join request submitted successfully');
      setIsJoinTeamOpen(false);
      setSelectedTeam(null);
      setRequestedRole(UserRole.player);
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit join request');
    }
  };

  const isClubAdmin = (club: Club): boolean => {
    if (!principal) return false;
    return club.admins.some(admin => admin.toString() === principal.toString());
  };

  const isTeamAdmin = (team: Team): boolean => {
    if (!principal) return false;
    return team.admins.some(admin => admin.toString() === principal.toString());
  };

  const getAssociatedTeamsCount = (clubId: string): number => {
    return myTeamsWithClubs.filter(item => item.team.clubId === clubId).length;
  };

  const getClubName = (clubId: string): string => {
    const club = allClubs.find(c => c.id === clubId);
    return club?.name || 'Unknown Club';
  };

  const getSportLabel = (sportValue?: string): string => {
    if (!sportValue) return '';
    const sport = SPORTS.find(s => s.value === sportValue);
    return sport?.label || sportValue;
  };

  const deduplicateClubMembers = (members: ClubMember[]): ClubMember[] => {
    const memberMap = new Map<string, Set<UserRole>>();
    const displayNameMap = new Map<string, string>();

    members.forEach(member => {
      if (!memberMap.has(member.userId)) {
        memberMap.set(member.userId, new Set());
        displayNameMap.set(member.userId, member.displayName);
      }
      member.roles.forEach(role => memberMap.get(member.userId)!.add(role));
    });

    return Array.from(memberMap.entries()).map(([userId, rolesSet]): ClubMember => ({
      userId,
      displayName: displayNameMap.get(userId)!,
      roles: Array.from(rolesSet),
    }));
  };

  const deduplicateTeamMembers = (members: TeamMember[]): TeamMember[] => {
    const memberMap = new Map<string, Set<UserRole>>();
    const displayNameMap = new Map<string, string>();

    members.forEach(member => {
      if (!memberMap.has(member.userId)) {
        memberMap.set(member.userId, new Set());
        displayNameMap.set(member.userId, member.displayName);
      }
      member.roles.forEach(role => memberMap.get(member.userId)!.add(role));
    });

    return Array.from(memberMap.entries()).map(([userId, rolesSet]): TeamMember => ({
      userId,
      displayName: displayNameMap.get(userId)!,
      roles: Array.from(rolesSet),
    }));
  };

  // Show error state if there's an error loading data
  if (clubsError || teamsError || allClubsError || allTeamsError) {
    return (
      <div className="flex items-center justify-center h-full bg-background p-4">
        <div className="text-center max-w-md">
          <div className="text-destructive mb-4">
            <X className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Failed to Load Data</h2>
          <p className="text-muted-foreground mb-4">
            {clubsError?.message || teamsError?.message || allClubsError?.message || allTeamsError?.message || 'An error occurred while loading clubs and teams.'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (clubsLoading || teamsLoading || allClubsLoading || allTeamsLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-background p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading clubs and teams...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col bg-background overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="w-full max-w-6xl mx-auto p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Clubs & Teams</h1>
                <p className="text-sm text-muted-foreground/70 font-medium tracking-wide">Manage your sports organizations</p>
              </div>
              <DropdownMenu open={isCreateMenuOpen} onOpenChange={setIsCreateMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-4 w-4" />
                    <span>Create</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleOpenCreateClub} className="cursor-pointer">
                    <Building2 className="mr-2 h-4 w-4" />
                    <span>Create Club</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleOpenCreateTeam} className="cursor-pointer">
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Create Team</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Tabs defaultValue="my-clubs-teams" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="my-clubs-teams">My Clubs & Teams</TabsTrigger>
                <TabsTrigger value="search">Search & Join</TabsTrigger>
              </TabsList>

              <TabsContent value="my-clubs-teams" className="space-y-6 mt-4">
                {/* My Clubs Section */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    My Clubs
                  </h2>
                  {myClubs.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-8">
                        <Building2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">No clubs yet</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Create a club to get started</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {myClubs.map((club) => {
                        const clubAny = club as any;
                        const sport = clubAny.sport;
                        return (
                          <Card key={club.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedClubForView(club)}>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-3">
                                <ClubLogo logoPath={club.logoPath} clubName={club.name} size="md" />
                                <span className="truncate">{club.name}</span>
                              </CardTitle>
                              {sport && (
                                <CardDescription className="text-xs">
                                  {getSportLabel(sport)}
                                </CardDescription>
                              )}
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div className="text-sm text-muted-foreground">
                                  <p>{getAssociatedTeamsCount(club.id)} team{getAssociatedTeamsCount(club.id) !== 1 ? 's' : ''}</p>
                                </div>
                                {isClubAdmin(club) && (
                                  <div className="flex gap-2 pt-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="flex-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditClub(club);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="flex-1 text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteClub(club);
                                      }}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* My Teams Section */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    My Teams
                  </h2>
                  {myTeamsWithClubs.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-8">
                        <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">No teams yet</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Create a team or join an existing one</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {myTeamsWithClubs.map((item) => (
                        <TeamCard 
                          key={item.team.id} 
                          team={item.team} 
                          club={item.club}
                          isAdmin={isTeamAdmin(item.team)}
                          onView={() => setSelectedTeamForView(item)}
                          onEdit={() => handleEditTeam(item.team, item.club)}
                          onDelete={() => handleDeleteTeam(item.team)}
                          onAddPlayer={() => {
                            setSelectedTeam(item.team);
                            setIsAddPlayerOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="search" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search teams..."
                        value={teamSearchQuery}
                        onChange={(e) => setTeamSearchQuery(e.target.value)}
                        className="pl-9 h-12 text-base"
                      />
                    </div>
                    <Select value={clubFilterId} onValueChange={setClubFilterId}>
                      <SelectTrigger className="w-full sm:w-[200px] h-12">
                        <SelectValue placeholder="Filter by club" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Clubs</SelectItem>
                        {allClubs.map((club) => (
                          <SelectItem key={club.id} value={club.id}>
                            {club.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {filteredTeamsForSearch.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Search className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No teams found</h3>
                      <p className="text-sm text-muted-foreground text-center px-4">
                        Try adjusting your search or filters
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTeamsForSearch.map((team) => {
                      const club = allClubs.find(c => c.id === team.clubId) || null;
                      return (
                        <TeamCard 
                          key={team.id} 
                          team={team} 
                          club={club}
                          isAdmin={false}
                          showJoinButton
                          onJoin={() => {
                            setSelectedTeam(team);
                            setRequestedRole(UserRole.player);
                            setIsJoinTeamOpen(true);
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedClubForView && (
        <ClubViewModal 
          club={selectedClubForView} 
          onClose={() => setSelectedClubForView(null)}
          isAdmin={isClubAdmin(selectedClubForView)}
          deduplicateMembers={deduplicateClubMembers}
          getSportLabel={getSportLabel}
        />
      )}

      {selectedTeamForView && (
        <TeamViewModal 
          team={selectedTeamForView.team} 
          club={selectedTeamForView.club}
          onClose={() => setSelectedTeamForView(null)}
          isAdmin={isTeamAdmin(selectedTeamForView.team)}
          deduplicateMembers={deduplicateTeamMembers}
        />
      )}

      {/* Create Club Dialog */}
      {isCreateClubOpen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold">Create New Club</h2>
              <p className="text-sm text-muted-foreground">Create a new club to organize your teams</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsCreateClubOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="clubName" className="text-base">Club Name *</Label>
                  <Input
                    id="clubName"
                    placeholder="Enter club name"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    className="h-12 text-base"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base">Sport *</Label>
                  <p className="text-sm text-muted-foreground">Select the primary sport for this club</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {SPORTS.map((sport) => (
                      <Button
                        key={sport.value}
                        type="button"
                        variant={clubSport === sport.value ? 'default' : 'outline'}
                        className="h-auto py-4 flex flex-col items-center gap-2"
                        onClick={() => setClubSport(sport.value)}
                      >
                        <img src={sport.icon} alt={sport.label} className="h-8 w-8" />
                        <span className="text-sm font-medium">{sport.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clubLogo" className="text-base">Club Logo (Optional)</Label>
                  <p className="text-sm text-muted-foreground">Upload a logo for your club (PNG, JPG, JPEG, or GIF, max 5MB)</p>
                  
                  {logoPreview ? (
                    <div className="relative w-full">
                      <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
                        <img 
                          src={logoPreview} 
                          alt="Logo preview" 
                          className="h-20 w-20 rounded-lg object-cover border-2 border-primary/20"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{logoFile?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {logoFile ? `${(logoFile.size / 1024).toFixed(1)} KB` : ''}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleRemoveLogo}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        ref={fileInputRef}
                        type="file"
                        id="clubLogo"
                        accept="image/png,image/jpeg,image/jpg,image/gif"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-32 border-dashed"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Upload className="h-6 w-6 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium">Click to upload logo</p>
                            <p className="text-xs text-muted-foreground">PNG, JPG, JPEG, or GIF (max 5MB)</p>
                          </div>
                        </div>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t p-4 sm:p-6 bg-background">
            <div className="max-w-2xl mx-auto flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <Button variant="outline" onClick={() => setIsCreateClubOpen(false)} className="w-full sm:w-auto h-12 sm:h-10">
                Cancel
              </Button>
              <Button
                onClick={handleCreateClub}
                disabled={createClub.isPending || isUploading || !clubName.trim() || !clubSport}
                className="w-full sm:w-auto h-12 sm:h-10 bg-emerald-600 hover:bg-emerald-700"
              >
                {isUploading ? 'Uploading...' : createClub.isPending ? 'Creating...' : 'Create Club'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Club Dialog */}
      {isEditClubOpen && selectedClub && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold">Edit Club</h2>
              <p className="text-sm text-muted-foreground">Update club details</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleCloseEditClubModal}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="editClubName" className="text-base">Club Name *</Label>
                  <Input
                    id="editClubName"
                    placeholder="Enter club name"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    className="h-12 text-base"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base">Sport *</Label>
                  <p className="text-sm text-muted-foreground">Select the primary sport for this club</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {SPORTS.map((sport) => (
                      <Button
                        key={sport.value}
                        type="button"
                        variant={clubSport === sport.value ? 'default' : 'outline'}
                        className="h-auto py-4 flex flex-col items-center gap-2"
                        onClick={() => setClubSport(sport.value)}
                      >
                        <img src={sport.icon} alt={sport.label} className="h-8 w-8" />
                        <span className="text-sm font-medium">{sport.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editClubLogo" className="text-base">Club Logo</Label>
                  <p className="text-sm text-muted-foreground">Upload a new logo or keep the existing one (PNG, JPG, JPEG, or GIF, max 5MB)</p>
                  
                  <ClubLogoPreview 
                    logoPreview={logoPreview}
                    currentLogoPath={selectedClub.logoPath}
                    logoFile={logoFile}
                    onRemove={handleRemoveLogo}
                  />
                  
                  {!logoPreview && (
                    <div className="relative">
                      <input
                        ref={fileInputRef}
                        type="file"
                        id="editClubLogo"
                        accept="image/png,image/jpeg,image/jpg,image/gif"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-32 border-dashed"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Upload className="h-6 w-6 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium">Click to upload new logo</p>
                            <p className="text-xs text-muted-foreground">PNG, JPG, JPEG, or GIF (max 5MB)</p>
                          </div>
                        </div>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t p-4 sm:p-6 bg-background">
            <div className="max-w-2xl mx-auto flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <Button variant="outline" onClick={handleCloseEditClubModal} className="w-full sm:w-auto h-12 sm:h-10">
                Cancel
              </Button>
              <Button
                onClick={handleUpdateClub}
                disabled={updateClub.isPending || isUploading || !clubName.trim() || !clubSport}
                className="w-full sm:w-auto h-12 sm:h-10 bg-emerald-600 hover:bg-emerald-700"
              >
                {isUploading ? 'Uploading...' : updateClub.isPending ? 'Updating...' : 'Update Club'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Other dialogs remain the same */}
      {isCreateTeamOpen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold">Create New Team</h2>
              <p className="text-sm text-muted-foreground">Create a new team for a club</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsCreateTeamOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="teamName" className="text-base">Team Name</Label>
                  <Input
                    id="teamName"
                    placeholder="Enter team name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="h-12 text-base"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base">Select Club</Label>
                  {myClubs.length === 0 ? (
                    <div className="p-4 border rounded-lg bg-muted/30 text-center">
                      <p className="text-sm text-muted-foreground">No clubs available. Create a club first.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {myClubs.map((club) => (
                        <Button
                          key={club.id}
                          variant={selectedClubId === club.id ? 'default' : 'outline'}
                          className="w-full justify-start h-auto py-3"
                          onClick={() => setSelectedClubId(club.id)}
                        >
                          <div className="flex items-center gap-3">
                            <ClubLogo logoPath={club.logoPath} clubName={club.name} size="sm" />
                            <span>{club.name}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t p-4 sm:p-6 bg-background">
            <div className="max-w-2xl mx-auto flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <Button variant="outline" onClick={() => setIsCreateTeamOpen(false)} className="w-full sm:w-auto h-12 sm:h-10">
                Cancel
              </Button>
              <Button
                onClick={handleCreateTeam}
                disabled={createTeam.isPending || !selectedClubId || myClubs.length === 0}
                className="w-full sm:w-auto h-12 sm:h-10 bg-emerald-600 hover:bg-emerald-700"
              >
                {createTeam.isPending ? 'Creating...' : 'Create Team'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isEditTeamOpen && selectedTeam && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold">Edit Team</h2>
              <p className="text-sm text-muted-foreground">Update team name and club</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsEditTeamOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="editTeamName" className="text-base">Team Name</Label>
                  <Input
                    id="editTeamName"
                    placeholder="Enter team name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="h-12 text-base"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base">Select Club</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {myClubs.map((club) => (
                      <Button
                        key={club.id}
                        variant={selectedClubId === club.id ? 'default' : 'outline'}
                        className="w-full justify-start h-auto py-3"
                        onClick={() => setSelectedClubId(club.id)}
                      >
                        <div className="flex items-center gap-3">
                          <ClubLogo logoPath={club.logoPath} clubName={club.name} size="sm" />
                          <span>{club.name}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t p-4 sm:p-6 bg-background">
            <div className="max-w-2xl mx-auto flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <Button variant="outline" onClick={() => setIsEditTeamOpen(false)} className="w-full sm:w-auto h-12 sm:h-10">
                Cancel
              </Button>
              <Button
                onClick={handleUpdateTeam}
                disabled={updateTeam.isPending || !selectedClubId}
                className="w-full sm:w-auto h-12 sm:h-10 bg-emerald-600 hover:bg-emerald-700"
              >
                {updateTeam.isPending ? 'Updating...' : 'Update Team'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={isDeleteClubDialogOpen} onOpenChange={setIsDeleteClubDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Club</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to delete <strong>{selectedClub?.name}</strong>?</p>
              {selectedClub && getAssociatedTeamsCount(selectedClub.id) > 0 && (
                <p className="text-destructive font-medium">
                  Warning: This will also delete {getAssociatedTeamsCount(selectedClub.id)} associated team{getAssociatedTeamsCount(selectedClub.id) !== 1 ? 's' : ''} and all their data.
                </p>
              )}
              <p>This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteClub}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteClub.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteTeamDialogOpen} onOpenChange={setIsDeleteTeamDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedTeam?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTeam}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTeam.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Player</DialogTitle>
            <DialogDescription>
              Add a new player to {selectedTeam?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="playerName">Player Name</Label>
              <Input
                id="playerName"
                placeholder="Enter player name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Position Eligibility</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="goalkeeper"
                    checked={positionEligibility.goalkeeper}
                    onCheckedChange={(checked) =>
                      setPositionEligibility({ ...positionEligibility, goalkeeper: checked as boolean })
                    }
                  />
                  <Label htmlFor="goalkeeper" className="cursor-pointer">Goalkeeper</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="defender"
                    checked={positionEligibility.defender}
                    onCheckedChange={(checked) =>
                      setPositionEligibility({ ...positionEligibility, defender: checked as boolean })
                    }
                  />
                  <Label htmlFor="defender" className="cursor-pointer">Defender</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="midfielder"
                    checked={positionEligibility.midfielder}
                    onCheckedChange={(checked) =>
                      setPositionEligibility({ ...positionEligibility, midfielder: checked as boolean })
                    }
                  />
                  <Label htmlFor="midfielder" className="cursor-pointer">Midfielder</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="forward"
                    checked={positionEligibility.forward}
                    onCheckedChange={(checked) =>
                      setPositionEligibility({ ...positionEligibility, forward: checked as boolean })
                    }
                  />
                  <Label htmlFor="forward" className="cursor-pointer">Forward</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddPlayerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPlayer} disabled={addPlayer.isPending}>
              {addPlayer.isPending ? 'Adding...' : 'Add Player'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isJoinTeamOpen} onOpenChange={setIsJoinTeamOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Request to Join Team</DialogTitle>
            <DialogDescription>
              Submit a request to join {selectedTeam?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="requestedRole">Requested Role</Label>
              <Select
                value={requestedRole}
                onValueChange={(value) => setRequestedRole(value as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.player}>Player</SelectItem>
                  <SelectItem value={UserRole.coach}>Coach</SelectItem>
                  <SelectItem value={UserRole.parent}>Parent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsJoinTeamOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitJoinRequest} disabled={submitJoinRequest.isPending}>
              {submitJoinRequest.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ClubLogoPreview({ logoPreview, currentLogoPath, logoFile, onRemove }: { logoPreview: string | null; currentLogoPath?: string; logoFile: File | null; onRemove: () => void }) {
  const { data: currentLogoUrl } = useFileUrl(currentLogoPath || '');
  
  if (!logoPreview && !currentLogoUrl) {
    return null;
  }

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
        <img 
          src={logoPreview || currentLogoUrl || ''} 
          alt="Logo preview" 
          className="h-20 w-20 rounded-lg object-cover border-2 border-primary/20"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{logoFile?.name || 'Current logo'}</p>
          {logoFile && (
            <p className="text-xs text-muted-foreground">
              {`${(logoFile.size / 1024).toFixed(1)} KB`}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function TeamCard({ 
  team, 
  club,
  isAdmin, 
  showJoinButton = false,
  onView,
  onEdit,
  onDelete,
  onAddPlayer,
  onJoin,
}: { 
  team: Team; 
  club: Club | null;
  isAdmin: boolean;
  showJoinButton?: boolean;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onAddPlayer?: () => void;
  onJoin?: () => void;
}) {
  const { data: rawMembers = [], isLoading: membersLoading } = useGetTeamMembers(team.id);

  const deduplicateMembers = (members: TeamMember[]): TeamMember[] => {
    const memberMap = new Map<string, Set<UserRole>>();
    const displayNameMap = new Map<string, string>();

    members.forEach(member => {
      if (!memberMap.has(member.userId)) {
        memberMap.set(member.userId, new Set());
        displayNameMap.set(member.userId, member.displayName);
      }
      member.roles.forEach(role => memberMap.get(member.userId)!.add(role));
    });

    return Array.from(memberMap.entries()).map(([userId, rolesSet]): TeamMember => ({
      userId,
      displayName: displayNameMap.get(userId)!,
      roles: Array.from(rolesSet),
    }));
  };

  const members = deduplicateMembers(rawMembers);
  const playerCount = members.filter(m => m.roles.includes(UserRole.player)).length;
  const clubName = club?.name || 'Unknown Club';

  return (
    <Card 
      className={onView ? "cursor-pointer hover:bg-muted/50 transition-colors" : "hover:bg-muted/50 transition-colors"}
      onClick={onView}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {team.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5 mt-1">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{clubName}</span>
            </CardDescription>
          </div>
          {isAdmin && onEdit && onDelete && (
            <div className="flex gap-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {membersLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
              <span>Loading...</span>
            </div>
          ) : (
            <p>{playerCount} player{playerCount !== 1 ? 's' : ''}</p>
          )}
        </div>
        {isAdmin && onAddPlayer && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={(e) => {
              e.stopPropagation();
              onAddPlayer();
            }}
          >
            <Plus className="h-4 w-4" />
            Add Player
          </Button>
        )}
        {showJoinButton && onJoin && (
          <Button
            variant="default"
            className="w-full gap-2"
            onClick={(e) => {
              e.stopPropagation();
              onJoin();
            }}
          >
            <UserPlus className="h-4 w-4" />
            Request to Join
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ClubViewModal({ club, onClose, isAdmin, deduplicateMembers, getSportLabel }: { club: Club; onClose: () => void; isAdmin: boolean; deduplicateMembers: (members: ClubMember[]) => ClubMember[]; getSportLabel: (sport?: string) => string }) {
  const { data: threads = [] } = useGetChatThreadsByClub(club.id);
  const { data: rawMembers = [], isLoading: membersLoading } = useGetClubMembers(club.id);

  const members = deduplicateMembers(rawMembers);

  const adminCount = members.filter(m => m.roles.includes(UserRole.clubAdmin)).length;
  const playerCount = members.filter(m => m.roles.includes(UserRole.player)).length;

  const clubAny = club as any;
  const sport = clubAny.sport;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between p-4 sm:p-6 border-b">
        <div className="flex items-center gap-3">
          <ClubLogo logoPath={club.logoPath} clubName={club.name} size="md" />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">{club.name}</h2>
            <p className="text-sm text-muted-foreground">{getSportLabel(sport)}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Information</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="chat">Chat Threads</TabsTrigger>
            </TabsList>
            
            <TabsContent value="info" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Club Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {sport && (
                    <div>
                      <p className="text-sm text-muted-foreground">Sport</p>
                      <p className="font-medium">{getSportLabel(sport)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">{new Date(Number(club.createdAt) / 1000000).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Admins</p>
                    <p className="font-medium">{adminCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Players</p>
                    <p className="font-medium">{playerCount}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="members" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Club Members
                  </CardTitle>
                  <CardDescription>
                    All members of {club.name} and their roles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {membersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : members.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium mb-2">No members yet</p>
                      <p className="text-sm">Members will appear here once they join the club</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-3">
                        {members.map((member) => (
                          <div
                            key={member.userId}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Users className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">
                                  {member.displayName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {member.userId.slice(0, 20)}...
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 sm:ml-2">
                              {member.roles.map((role) => (
                                <Badge 
                                  key={role}
                                  variant="secondary"
                                  className={`${ROLE_COLORS[role]} text-xs whitespace-nowrap`}
                                >
                                  {ROLE_LABELS[role]}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="chat" className="mt-4">
              <ChatThreadsView 
                threads={threads}
                clubId={club.id}
                canCreateThread={isAdmin}
                entityName={club.name}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function TeamViewModal({ team, club, onClose, isAdmin, deduplicateMembers }: { team: Team; club: Club | null; onClose: () => void; isAdmin: boolean; deduplicateMembers: (members: TeamMember[]) => TeamMember[] }) {
  const { data: threads = [] } = useGetChatThreadsByTeam(team.id);
  const { data: rawMembers = [], isLoading: membersLoading } = useGetTeamMembers(team.id);

  const members = deduplicateMembers(rawMembers);

  const adminCount = members.filter(m => m.roles.includes(UserRole.teamAdmin)).length;
  const playerCount = members.filter(m => m.roles.includes(UserRole.player)).length;
  const clubName = club?.name || 'Unknown Club';

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between p-4 sm:p-6 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">{team.name}</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              <span>{clubName}</span>
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Information</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="chat">Chat Threads</TabsTrigger>
            </TabsList>
            
            <TabsContent value="info" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Team Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Club</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{clubName}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Club ID</p>
                    <p className="font-mono text-xs bg-muted px-2 py-1 rounded">{team.clubId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">{new Date(Number(team.createdAt) / 1000000).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Players</p>
                    <p className="font-medium">{membersLoading ? '...' : playerCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Admins</p>
                    <p className="font-medium">{membersLoading ? '...' : adminCount}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="members" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Team Members
                  </CardTitle>
                  <CardDescription>
                    All members of {team.name} and their roles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {membersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : members.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium mb-2">No members yet</p>
                      <p className="text-sm">Members will appear here once they join the team</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-3">
                        {members.map((member) => (
                          <div
                            key={member.userId}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Users className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">
                                  {member.displayName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {member.userId.slice(0, 20)}...
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 sm:ml-2">
                              {member.roles.map((role) => (
                                <Badge 
                                  key={role}
                                  variant="secondary"
                                  className={`${ROLE_COLORS[role]} text-xs whitespace-nowrap`}
                                >
                                  {ROLE_LABELS[role]}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="chat" className="mt-4">
              <ChatThreadsView 
                threads={threads}
                teamId={team.id}
                canCreateThread={isAdmin}
                entityName={team.name}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
