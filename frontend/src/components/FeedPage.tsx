import { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useGetCallerTeamsAndClubs } from '../hooks/useQueries';

export default function FeedPage() {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();
  const { data: teamsAndClubs, isLoading: isLoadingTeamsAndClubs } = useGetCallerTeamsAndClubs();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const clubs = teamsAndClubs?.clubs || [];
  const allTeams = teamsAndClubs?.teams || [];
  const filteredTeams = selectedClubId 
    ? allTeams.filter((team) => team.clubId === selectedClubId)
    : [];

  // Reset team selection when club changes
  useEffect(() => {
    if (selectedClubId && selectedTeamId) {
      const teamStillValid = filteredTeams.some(team => team.id === selectedTeamId);
      if (!teamStillValid) {
        setSelectedTeamId('');
      }
    }
  }, [selectedClubId, selectedTeamId, filteredTeams]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedClubId) {
      toast.error('Please select a club and an image');
      return;
    }

    toast.info('Photo upload feature will be available once backend support is added');
    
    // Reset form
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption('');
    setSelectedClubId('');
    setSelectedTeamId('');
    setIsUploadOpen(false);
  };

  const handleClubChange = (clubId: string) => {
    setSelectedClubId(clubId);
    setSelectedTeamId('');
  };

  if (isLoadingTeamsAndClubs) {
    return (
      <div className="h-full w-full flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading feed...</p>
        </div>
      </div>
    );
  }

  if (clubs.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ImageIcon className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No clubs available</h3>
            <p className="text-sm text-muted-foreground text-center px-4">
              Join or create a club to start sharing photos
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="h-full w-full flex flex-col overflow-hidden">
        {/* Header Section - Fixed */}
        <div className="flex-shrink-0 border-b bg-background">
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Feed</h1>
              <p className="text-sm text-muted-foreground/70 font-medium tracking-wide">Share moments with your team</p>
            </div>

            <div className="flex justify-end">
              <Button className="gap-2 w-full sm:w-auto h-10" onClick={() => setIsUploadOpen(true)}>
                <Upload className="h-4 w-4" />
                <span>Upload Photo</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content Section - Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <ImageIcon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No photos yet</h3>
                <p className="text-sm text-muted-foreground mb-4 text-center px-4">
                  Be the first to share a photo with your team
                </p>
                <Button onClick={() => setIsUploadOpen(true)} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Photo
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Upload Photo Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
            <div className="space-y-1 min-w-0 flex-1 pr-4">
              <h2 className="text-lg sm:text-xl font-bold truncate">Upload Photo</h2>
              <p className="text-sm text-muted-foreground truncate">Share a photo with your club or team</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsUploadOpen(false)} className="shrink-0 h-9 w-9">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-4 pb-24 space-y-6 max-w-2xl mx-auto w-full">
              <div className="space-y-2">
                <Label htmlFor="photo" className="text-base">Photo</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                  <input
                    id="photo"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label htmlFor="photo" className="cursor-pointer">
                    {previewUrl ? (
                      <div className="space-y-4">
                        <img src={previewUrl} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                        <Button variant="outline" size="sm" onClick={(e) => {
                          e.preventDefault();
                          setSelectedFile(null);
                          setPreviewUrl(null);
                        }}>
                          Change Photo
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base">Club *</Label>
                <div className="grid grid-cols-1 gap-2">
                  {clubs.map((club) => (
                    <Button
                      key={club.id}
                      type="button"
                      variant={selectedClubId === club.id ? "default" : "outline"}
                      className="w-full h-auto min-h-[3rem] py-3 px-4 text-left justify-start whitespace-normal"
                      onClick={() => handleClubChange(club.id)}
                    >
                      <span className="text-base font-medium break-words">{club.name}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base">Team (Optional)</Label>
                {!selectedClubId ? (
                  <div className="h-12 flex items-center justify-center border rounded-md bg-muted/50">
                    <p className="text-sm text-muted-foreground">Select a club first</p>
                  </div>
                ) : filteredTeams.length === 0 ? (
                  <div className="h-12 flex items-center justify-center border rounded-md bg-muted/50">
                    <p className="text-sm text-muted-foreground">No teams available for this club</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {filteredTeams.map((team) => (
                      <Button
                        key={team.id}
                        type="button"
                        variant={selectedTeamId === team.id ? "default" : "outline"}
                        className="w-full h-auto min-h-[3rem] py-3 px-4 text-left justify-start whitespace-normal"
                        onClick={() => setSelectedTeamId(team.id)}
                      >
                        <span className="text-base font-medium break-words">{team.name}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="caption" className="text-base">Caption (Optional)</Label>
                <Textarea
                  id="caption"
                  placeholder="Add a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="min-h-[100px] text-base"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">{caption.length}/500</p>
              </div>
            </div>
          </div>

          <div className="border-t p-4 bg-background flex-shrink-0 sticky bottom-0 z-10">
            <div className="max-w-2xl mx-auto flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <Button variant="outline" onClick={() => setIsUploadOpen(false)} className="w-full sm:w-auto h-12 sm:h-10">
                Cancel
              </Button>
              <Button onClick={handleUpload} className="w-full sm:w-auto h-12 sm:h-10" disabled={!selectedFile || !selectedClubId}>
                Upload
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
