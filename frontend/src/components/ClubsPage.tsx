import { useState } from 'react';
import { Plus, Upload, Trash2, Edit, Users, MessageSquare, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useFileUpload, useFileUrl, useFileDelete } from '../blob-storage/FileStorage';
import { useCreateClub, useUpdateClub, useDeleteClub, useGetClubMembers, useGetChatThreadsByClub } from '../hooks/useQueries';
import { useGetClubsByUser } from '../hooks/useClubsQueries';
import { Club, ClubMember } from '../backend';
import { ROLE_COLORS, ROLE_LABELS } from '../lib/constants';
import ChatThreadsView from './ChatThreadsView';

const SPORTS = [
  { value: 'soccer', label: 'Soccer' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'tennis', label: 'Tennis' },
  { value: 'baseball', label: 'Baseball' },
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'hockey', label: 'Hockey' },
];

function ClubLogo({ logoPath, clubName, size = 'md' }: { logoPath?: string; clubName: string; size?: 'sm' | 'md' | 'lg' }) {
  const { data: logoUrl } = useFileUrl(logoPath || '');
  
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };
  
  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
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
      <img 
        src="/assets/generated/default-club-logo-transparent.dim_64x64.png" 
        alt="Default" 
        className={iconSizeClasses[size]}
      />
    </div>
  );
}

export default function ClubsPage() {
  const { data: clubs = [], isLoading } = useGetClubsByUser();
  const createClub = useCreateClub();
  const updateClub = useUpdateClub();
  const deleteClub = useDeleteClub();
  const { uploadFile, isUploading } = useFileUpload();
  const { deleteFile, isDeleting } = useFileDelete();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [clubName, setClubName] = useState('');
  const [clubSport, setClubSport] = useState('soccer');
  const [clubDescription, setClubDescription] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please select a valid image file (PNG, JPG, JPEG, or GIF)');
        return;
      }

      // Validate file size (max 5MB)
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
    }
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
        const uploadPath = `clubs/${Date.now()}_${logoFile.name}`;
        const result = await uploadFile(uploadPath, logoFile);
        logoPath = result.path;
      }

      console.log('[ClubsPage] Creating club with sport:', clubSport);
      await createClub.mutateAsync({ name: clubName, sport: clubSport, logoPath });
      toast.success('Club created successfully');
      setIsCreateDialogOpen(false);
      setClubName('');
      setClubSport('soccer');
      setClubDescription('');
      setLogoFile(null);
      setLogoPreview(null);
    } catch (error: any) {
      console.error('[ClubsPage] Error creating club:', error);
      toast.error(error.message || 'Failed to create club');
    }
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
      let logoPath: string | undefined = selectedClub.logoPath;

      // If user uploaded a new logo, replace the old one
      if (logoFile) {
        // Delete the old logo file if it exists
        if (selectedClub.logoPath) {
          try {
            await deleteFile(selectedClub.logoPath);
          } catch (error) {
            console.error('Failed to delete old logo file:', error);
            // Continue anyway - we'll upload the new one
          }
        }
        
        const uploadPath = `clubs/${Date.now()}_${logoFile.name}`;
        const result = await uploadFile(uploadPath, logoFile);
        logoPath = result.path;
      }

      const updatedClub: Club = {
        ...selectedClub,
        name: clubName,
        logoPath,
      };

      console.log('[ClubsPage] Updating club with sport:', clubSport);
      await updateClub.mutateAsync({ clubId: selectedClub.id, updatedClub });
      toast.success('Club updated successfully');
      setIsDetailsDialogOpen(false);
      setIsEditMode(false);
      setSelectedClub(null);
      setClubName('');
      setClubSport('soccer');
      setLogoFile(null);
      setLogoPreview(null);
    } catch (error: any) {
      console.error('[ClubsPage] Error updating club:', error);
      toast.error(error.message || 'Failed to update club');
    }
  };

  const handleDeleteClub = async () => {
    if (!selectedClub) return;

    try {
      // Delete the logo file if it exists
      if (selectedClub.logoPath) {
        try {
          await deleteFile(selectedClub.logoPath);
        } catch (error) {
          console.error('Failed to delete logo file:', error);
          // Continue with club deletion anyway
        }
      }

      await deleteClub.mutateAsync(selectedClub.id);
      toast.success('Club deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedClub(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete club');
    }
  };

  const openDetailsDialog = (club: Club) => {
    setSelectedClub(club);
    setClubName(club.name);
    const clubAny = club as any;
    // Pre-select the sport when opening the details dialog, default to soccer if not set
    const currentSport = clubAny.sport || 'soccer';
    console.log('[ClubsPage] Opening details for club:', club.name, 'sport:', currentSport);
    setClubSport(currentSport);
    setLogoPreview(null);
    setLogoFile(null);
    setIsEditMode(false);
    setIsDetailsDialogOpen(true);
  };

  const openDeleteDialog = (club: Club) => {
    setSelectedClub(club);
    setIsDeleteDialogOpen(true);
  };

  const getSportLabel = (sportValue?: string): string => {
    if (!sportValue) return '';
    const sport = SPORTS.find(s => s.value === sportValue);
    return sport?.label || sportValue;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading clubs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Clubs</h2>
          <p className="text-sm text-muted-foreground">Manage your clubs and teams</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
          <img 
            src="/assets/generated/create-button-icon-emerald-transparent.dim_24x24.png" 
            alt="Create" 
            className="h-4 w-4"
          />
          Create Club
        </Button>
      </div>

      {clubs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <img 
                src="/assets/generated/club-icon-transparent.dim_64x64.png" 
                alt="Club" 
                className="w-8 h-8"
              />
            </div>
            <p className="text-lg font-medium mb-2">No clubs yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first club to get started</p>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Club
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.map((club) => {
            const clubAny = club as any;
            const sport = clubAny.sport;
            return (
              <Card key={club.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDetailsDialog(club)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <ClubLogo logoPath={club.logoPath} clubName={club.name} size="md" />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{club.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {sport && <span className="mr-2">{getSportLabel(sport)}</span>}
                          Created {new Date(Number(club.createdAt) / 1000000).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Club Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Club</DialogTitle>
            <DialogDescription>Create a new club to organize your teams</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clubName">Club Name *</Label>
              <Input
                id="clubName"
                placeholder="Enter club name"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clubSport">Sport *</Label>
              <select
                id="clubSport"
                value={clubSport}
                onChange={(e) => setClubSport(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                {SPORTS.map((sport) => (
                  <option key={sport.value} value={sport.value}>
                    {sport.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Select the primary sport for this club</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clubLogo">Club Logo (Optional)</Label>
              <p className="text-xs text-muted-foreground">PNG, JPG, JPEG, or GIF (max 5MB)</p>
              <div className="space-y-3">
                {logoPreview && (
                  <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/30">
                    <img src={logoPreview} alt="Logo preview" className="w-16 h-16 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{logoFile?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {logoFile ? `${(logoFile.size / 1024).toFixed(1)} KB` : ''}
                      </p>
                    </div>
                  </div>
                )}
                <Input
                  id="clubLogo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleCreateClub} disabled={createClub.isPending || isUploading} className="w-full sm:w-auto">
              {createClub.isPending || isUploading ? 'Creating...' : 'Create Club'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Club Details Dialog */}
      {selectedClub && (
        <ClubDetailsDialog
          club={selectedClub}
          isOpen={isDetailsDialogOpen}
          onClose={() => {
            setIsDetailsDialogOpen(false);
            setIsEditMode(false);
            setSelectedClub(null);
            setClubName('');
            setClubSport('soccer');
            setLogoFile(null);
            setLogoPreview(null);
          }}
          onUpdate={handleUpdateClub}
          onDelete={() => openDeleteDialog(selectedClub)}
          clubName={clubName}
          setClubName={setClubName}
          clubSport={clubSport}
          setClubSport={setClubSport}
          logoFile={logoFile}
          logoPreview={logoPreview}
          handleLogoChange={handleLogoChange}
          isUpdating={updateClub.isPending || isUploading || isDeleting}
          getSportLabel={getSportLabel}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Club</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedClub?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedClub(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClub}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteClub.isPending || isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ClubDetailsDialogProps {
  club: Club;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  clubName: string;
  setClubName: (name: string) => void;
  clubSport: string;
  setClubSport: (sport: string) => void;
  logoFile: File | null;
  logoPreview: string | null;
  handleLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUpdating: boolean;
  getSportLabel: (sport?: string) => string;
  isEditMode: boolean;
  setIsEditMode: (mode: boolean) => void;
}

function ClubDetailsDialog({
  club,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  clubName,
  setClubName,
  clubSport,
  setClubSport,
  logoFile,
  logoPreview,
  handleLogoChange,
  isUpdating,
  getSportLabel,
  isEditMode,
  setIsEditMode,
}: ClubDetailsDialogProps) {
  const { data: members = [] } = useGetClubMembers(club.id);
  const { data: chatThreads = [], isLoading: threadsLoading, error: threadsError } = useGetChatThreadsByClub(club.id);
  const { data: currentLogoUrl } = useFileUrl(club.logoPath || '');

  // Deduplicate members
  const uniqueMembers = members.reduce((acc, member) => {
    const existing = acc.find(m => m.userId === member.userId);
    if (!existing) {
      acc.push(member);
    } else {
      // Merge roles
      const mergedRoles = [...new Set([...existing.roles, ...member.roles])];
      existing.roles = mergedRoles;
    }
    return acc;
  }, [] as ClubMember[]);

  const adminCount = uniqueMembers.filter(m => m.roles.some(r => r === 'clubAdmin')).length;
  const playerCount = uniqueMembers.filter(m => m.roles.some(r => r === 'player')).length;

  const clubAny = club as any;
  const sport = clubAny.sport || 'soccer';

  // Determine what to show in the logo preview area
  const showLogoPreview = logoPreview || currentLogoUrl;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <ClubLogo logoPath={club.logoPath} clubName={club.name} size="lg" />
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl sm:text-2xl truncate">{club.name}</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  {sport && <span className="mr-2">{getSportLabel(sport)}</span>}
                  Created {new Date(Number(club.createdAt) / 1000000).toLocaleDateString()}
                </DialogDescription>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {!isEditMode && (
                <Button variant="outline" size="icon" onClick={() => setIsEditMode(true)}>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 sm:mx-6 mt-4">
            <TabsTrigger value="info" className="gap-2 text-xs sm:text-sm">
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">Information</span>
              <span className="sm:hidden">Info</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2 text-xs sm:text-sm">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Chat Threads</span>
              <span className="sm:hidden">Chat</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="info" className="h-full m-0 p-4 sm:p-6 overflow-y-auto">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Admins</CardDescription>
                      <CardTitle className="text-2xl sm:text-3xl">{adminCount}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Players</CardDescription>
                      <CardTitle className="text-2xl sm:text-3xl">{playerCount}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {isEditMode ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="editClubName">Club Name *</Label>
                      <Input
                        id="editClubName"
                        value={clubName}
                        onChange={(e) => setClubName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editClubSport">Sport *</Label>
                      <select
                        id="editClubSport"
                        value={clubSport}
                        onChange={(e) => setClubSport(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        required
                      >
                        {SPORTS.map((sport) => (
                          <option key={sport.value} value={sport.value}>
                            {sport.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">Sport selection is required and cannot be left blank</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editClubLogo">Club Logo</Label>
                      <p className="text-xs text-muted-foreground">Upload a new logo to replace the current one (PNG, JPG, JPEG, or GIF, max 5MB)</p>
                      <div className="space-y-3">
                        {showLogoPreview && (
                          <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/30">
                            <img 
                              src={logoPreview || currentLogoUrl || ''} 
                              alt="Logo preview" 
                              className="w-16 h-16 rounded-full object-cover" 
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{logoFile?.name || 'Current logo'}</p>
                              {logoFile && (
                                <p className="text-xs text-muted-foreground">
                                  {`${(logoFile.size / 1024).toFixed(1)} KB`}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        <Input
                          id="editClubLogo"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setIsEditMode(false)} className="w-full sm:w-auto">
                        Cancel
                      </Button>
                      <Button onClick={onUpdate} disabled={isUpdating || !clubName.trim() || !clubSport} className="w-full sm:w-auto">
                        {isUpdating ? 'Updating...' : 'Update Club'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Club Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Name</p>
                          <p className="font-medium">{club.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Sport</p>
                          <p className="font-medium">{getSportLabel(sport)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Created</p>
                          <p className="font-medium">{new Date(Number(club.createdAt) / 1000000).toLocaleDateString()}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="members" className="h-full m-0 p-4 sm:p-6 overflow-y-auto">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {uniqueMembers.map((member) => (
                    <Card key={member.userId}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{member.displayName}</p>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {member.roles.map((role) => (
                                <Badge key={role} style={{ backgroundColor: ROLE_COLORS[role] }} className="text-xs">
                                  {ROLE_LABELS[role]}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="chat" className="h-full m-0 p-4 sm:p-6 overflow-y-auto">
              <ChatThreadsView
                threads={chatThreads}
                clubId={club.id}
                canCreateThread={true}
                entityName={club.name}
                isLoading={threadsLoading}
                error={threadsError}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
