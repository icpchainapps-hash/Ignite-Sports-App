import { useState, useEffect } from 'react';
import { useCreateUserProfile } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserRole } from '../backend';
import { toast } from 'sonner';
import { User } from 'lucide-react';

export default function ProfileSetupModal() {
  const { identity } = useInternetIdentity();
  const createProfile = useCreateUserProfile();
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('👤 [PROFILE SETUP] ProfileSetupModal mounted');
    console.log('👤 [PROFILE SETUP] This should ONLY appear for NEW USERS');
    console.log('👤 [PROFILE SETUP] Identity:', identity ? 'Present' : 'None');
    console.log('👤 [PROFILE SETUP] Principal:', identity?.getPrincipal().toString() || 'N/A');
  }, [identity]);

  const handleCreateProfile = async () => {
    console.log('👤 [PROFILE SETUP] Create profile button clicked');
    console.log('👤 [PROFILE SETUP] Display name:', displayName);

    if (!displayName.trim()) {
      console.log('❌ [PROFILE SETUP] Display name is empty');
      setError('Display name is required');
      return;
    }

    if (!identity) {
      console.log('❌ [PROFILE SETUP] Identity not available');
      setError('Authentication required');
      return;
    }

    setError(null);

    try {
      const username = identity.getPrincipal().toString().slice(0, 10);
      
      console.log('👤 [PROFILE SETUP] Creating profile with:', {
        username,
        displayName: displayName.trim(),
        roles: [UserRole.appAdmin]
      });

      await createProfile.mutateAsync({
        username,
        displayName: displayName.trim(),
        roles: [UserRole.appAdmin],
      });

      console.log('✅ [PROFILE SETUP] Profile created successfully');
      toast.success('Profile created successfully!');
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to create profile';
      console.error('❌ [PROFILE SETUP] Profile creation error:', err);
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md space-y-6 sm:space-y-8">
        <div className="flex flex-col items-center space-y-3 sm:space-y-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
          </div>
          <div className="text-center space-y-1 sm:space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary">Welcome to Ignite</h1>
            <p className="text-xs sm:text-sm text-muted-foreground/70 font-medium tracking-wide">Football</p>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground px-4">Let's set up your profile to get started</p>
          </div>
        </div>

        <div className="space-y-5 sm:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm font-medium">
              Display Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="displayName"
              placeholder="Enter your name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && displayName.trim()) {
                  handleCreateProfile();
                }
              }}
              disabled={createProfile.isPending}
              autoFocus
              className="h-11 sm:h-12 text-base"
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border border-border/50">
            <p className="text-xs sm:text-sm text-muted-foreground">
              <strong className="text-foreground">Note:</strong> As the app creator, you'll be assigned the <strong className="text-primary">App Admin</strong> role with full access to all features.
            </p>
          </div>

          <Button
            onClick={handleCreateProfile}
            disabled={createProfile.isPending || !displayName.trim()}
            className="w-full h-12 sm:h-14 text-base sm:text-lg font-medium touch-manipulation"
            size="lg"
          >
            {createProfile.isPending ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-3"></div>
                Creating Profile...
              </>
            ) : (
              'Create Profile'
            )}
          </Button>

          {createProfile.isError && (
            <div className="p-3 sm:p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-xs sm:text-sm text-destructive text-center">
                Failed to create profile. Please try again.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
