import { useState, useEffect } from 'react';
import { useGetCallerUserProfile, useUpdateDisplayName, useAssignTeamRole, useRemoveTeamRole, useGetStripeConfiguration, useSetStripeConfiguration, useIsStripeConnected, useGetAllMetrics, useGetMetrics, useGetAllClubs, useGetCallerTeamsAndClubs, useGetAllUsers, useAssignRoleToUser, useRemoveRoleFromUser, useAssignTeamRoleToUser, useRemoveTeamRoleFromUser } from '../hooks/useQueries';
import { useGetAllTeams } from '../hooks/useTeamsQueries';
import { useGetChildProfilesByParent, useDeleteChildProfile } from '../hooks/useChildProfileQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserRole, StripeConfiguration, UserProfile as BackendUserProfile } from '../backend';
import { Club } from '../types';
import { toast } from 'sonner';
import { Principal } from '@dfinity/principal';
import { X, Trash2, Copy } from 'lucide-react';
import AddRoleOverlay from './AddRoleOverlay';
import ChildProfileCreationPage from './ChildProfileCreationPage';

const ROLE_OPTIONS: { value: UserRole; label: string; requiresContext: 'club' | 'team' | 'none' }[] = [
  { value: UserRole.appAdmin, label: 'App Admin', requiresContext: 'none' },
  { value: UserRole.clubAdmin, label: 'Club Admin', requiresContext: 'club' },
  { value: UserRole.teamAdmin, label: 'Team Admin', requiresContext: 'team' },
  { value: UserRole.coach, label: 'Coach', requiresContext: 'team' },
  { value: UserRole.player, label: 'Player', requiresContext: 'team' },
  { value: UserRole.parent, label: 'Parent', requiresContext: 'team' },
];

function getRoleLabel(role: UserRole): string {
  const option = ROLE_OPTIONS.find(opt => opt.value === role);
  return option?.label || role.toString();
}

// Helper function to deduplicate roles
function deduplicateRoles(roles: UserRole[]): UserRole[] {
  const seen = new Set<string>();
  return roles.filter(role => {
    const roleStr = role.toString();
    if (seen.has(roleStr)) {
      return false;
    }
    seen.add(roleStr);
    return true;
  });
}

export default function SettingsPage() {
  const { identity } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
  const updateDisplayName = useUpdateDisplayName();
  const assignTeamRole = useAssignTeamRole();
  const removeTeamRole = useRemoveTeamRole();

  const { data: stripeConfig } = useGetStripeConfiguration();
  const setStripeConfig = useSetStripeConfiguration();
  const { data: isStripeConnected } = useIsStripeConnected();

  const { data: allMetrics } = useGetAllMetrics();
  const { data: teamsAndClubs } = useGetCallerTeamsAndClubs();
  const { data: allClubs, isLoading: clubsLoading } = useGetAllClubs();
  const { data: allTeams = [], isLoading: teamsLoading } = useGetAllTeams();

  // User management queries (app admin only)
  const { data: allUsers = [], isLoading: usersLoading } = useGetAllUsers();
  const assignRoleToUser = useAssignRoleToUser();
  const removeRoleFromUser = useRemoveRoleFromUser();
  const assignTeamRoleToUser = useAssignTeamRoleToUser();
  const removeTeamRoleFromUser = useRemoveTeamRoleFromUser();

  // Child profile queries (parent role only)
  const { data: childProfiles = [], isLoading: childProfilesLoading } = useGetChildProfilesByParent();
  const deleteChildProfile = useDeleteChildProfile();

  const [displayName, setDisplayName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isAddRoleOverlayOpen, setIsAddRoleOverlayOpen] = useState(false);
  const [isChildProfileCreationOpen, setIsChildProfileCreationOpen] = useState(false);
  const [childProfileToDelete, setChildProfileToDelete] = useState<string | null>(null);

  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [stripeAllowedCountries, setStripeAllowedCountries] = useState('US,CA,GB');

  // Invite code management (app admin only)
  const [inviteCode, setInviteCode] = useState('PRO2025');
  const [isEditingInviteCode, setIsEditingInviteCode] = useState(false);
  const [newInviteCode, setNewInviteCode] = useState('');

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const { data: filteredMetrics } = useGetMetrics(selectedYear, selectedMonth);

  // User management state
  const [selectedUser, setSelectedUser] = useState<BackendUserProfile | null>(null);
  const [isUserManagementDialogOpen, setIsUserManagementDialogOpen] = useState(false);
  const [userManagementRole, setUserManagementRole] = useState<UserRole | ''>('');
  const [userManagementClub, setUserManagementClub] = useState<string>('');
  const [userManagementTeam, setUserManagementTeam] = useState<string>('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'add' | 'remove'; role: UserRole; teamId?: string; clubId?: string } | null>(null);

  const isAppAdmin = userProfile?.roles?.includes(UserRole.appAdmin) || false;
  const isParent = userProfile?.roles?.includes(UserRole.parent) || 
                   userProfile?.teamRoles?.some(tr => tr.role === UserRole.parent) || false;

  const principalId = identity?.getPrincipal().toString() || '';

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName);
    }
  }, [userProfile]);

  useEffect(() => {
    if (stripeConfig) {
      setStripeSecretKey(stripeConfig.secretKey || '');
      setStripePublishableKey('');
    }
  }, [stripeConfig]);

  const handleSaveDisplayName = () => {
    if (!userProfile) return;

    updateDisplayName.mutate(
      { currentProfile: userProfile, newDisplayName: displayName },
      {
        onSuccess: () => {
          toast.success('Display name updated successfully');
          setIsEditingName(false);
        },
        onError: (error) => {
          toast.error(`Failed to update display name: ${error.message}`);
        },
      }
    );
  };

  const handleAddRole = async (role: UserRole, clubId: string, teamId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      assignTeamRole.mutate(
        { role, teamId, clubId },
        {
          onSuccess: () => {
            toast.success('Role added successfully');
            setIsAddRoleOverlayOpen(false);
            resolve();
          },
          onError: (error) => {
            toast.error(`Failed to add role: ${error.message}`);
            reject(error);
          },
        }
      );
    });
  };

  const handleRemoveTeamRole = (role: UserRole, teamId: string, clubId: string | null | undefined) => {
    removeTeamRole.mutate(
      { role, teamId, clubId: clubId || null },
      {
        onSuccess: () => {
          toast.success('Role removed successfully');
        },
        onError: (error) => {
          toast.error(`Failed to remove role: ${error.message}`);
        },
      }
    );
  };

  const handleConnectStripe = () => {
    if (!stripeSecretKey) {
      toast.error('Please enter Stripe secret key');
      return;
    }

    const countries = stripeAllowedCountries.split(',').map(c => c.trim()).filter(c => c.length > 0);

    const config: StripeConfiguration = {
      secretKey: stripeSecretKey,
      allowedCountries: countries,
    };

    setStripeConfig.mutate(config, {
      onSuccess: () => {
        toast.success('Stripe configuration saved successfully');
      },
      onError: (error) => {
        toast.error(`Failed to save Stripe configuration: ${error.message}`);
      },
    });
  };

  const handleDeleteChildProfile = (childId: string) => {
    setChildProfileToDelete(childId);
  };

  const confirmDeleteChildProfile = () => {
    if (!childProfileToDelete) return;

    deleteChildProfile.mutate(childProfileToDelete, {
      onSuccess: () => {
        toast.success('Child profile deleted successfully');
        setChildProfileToDelete(null);
      },
      onError: (error) => {
        toast.error(`Failed to delete child profile: ${error.message}`);
        setChildProfileToDelete(null);
      },
    });
  };

  const handleSaveInviteCode = () => {
    if (!newInviteCode.trim()) {
      toast.error('Please enter a valid invite code');
      return;
    }

    // Mock implementation - in production this would call backend
    setInviteCode(newInviteCode.toUpperCase());
    setIsEditingInviteCode(false);
    toast.success('Invite code updated successfully');
  };

  const handleCopyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success('Invite code copied to clipboard');
  };

  const handleCopyPrincipalId = () => {
    navigator.clipboard.writeText(principalId);
    toast.success('Principal ID copied to clipboard');
  };

  // User management handlers
  const handleOpenUserManagement = (user: BackendUserProfile) => {
    setSelectedUser(user);
    setUserManagementRole('');
    setUserManagementClub('');
    setUserManagementTeam('');
    setIsUserManagementDialogOpen(true);
  };

  const handleAddRoleToUser = () => {
    if (!selectedUser || !userManagementRole) {
      toast.error('Please select a role');
      return;
    }

    const roleOption = ROLE_OPTIONS.find(opt => opt.value === userManagementRole);
    
    if (roleOption?.requiresContext === 'team') {
      if (!userManagementClub || !userManagementTeam) {
        toast.error('Please select both club and team');
        return;
      }

      setConfirmAction({
        type: 'add',
        role: userManagementRole,
        teamId: userManagementTeam,
        clubId: userManagementClub,
      });
    } else {
      setConfirmAction({
        type: 'add',
        role: userManagementRole,
      });
    }
  };

  const handleRemoveRoleFromUser = (role: UserRole, teamId?: string) => {
    // Check if trying to remove app admin role from self
    if (role === UserRole.appAdmin && selectedUser?.username === userProfile?.username) {
      toast.error('You cannot remove your own app admin role');
      return;
    }

    setConfirmAction({
      type: 'remove',
      role,
      teamId,
    });
  };

  const handleConfirmAction = () => {
    if (!confirmAction || !selectedUser) return;

    const userPrincipal = Principal.fromText(selectedUser.username);

    if (confirmAction.type === 'add') {
      if (confirmAction.teamId && confirmAction.clubId) {
        assignTeamRoleToUser.mutate(
          {
            user: userPrincipal,
            role: confirmAction.role,
            teamId: confirmAction.teamId,
            clubId: confirmAction.clubId,
          },
          {
            onSuccess: () => {
              toast.success('Role added successfully');
              setConfirmAction(null);
              setUserManagementRole('');
              setUserManagementClub('');
              setUserManagementTeam('');
            },
            onError: (error) => {
              toast.error(`Failed to add role: ${error.message}`);
              setConfirmAction(null);
            },
          }
        );
      } else {
        assignRoleToUser.mutate(
          { user: userPrincipal, role: confirmAction.role },
          {
            onSuccess: () => {
              toast.success('Role added successfully');
              setConfirmAction(null);
              setUserManagementRole('');
            },
            onError: (error) => {
              toast.error(`Failed to add role: ${error.message}`);
              setConfirmAction(null);
            },
          }
        );
      }
    } else {
      // Handle role removal
      if (confirmAction.teamId) {
        removeTeamRoleFromUser.mutate(
          {
            user: userPrincipal,
            role: confirmAction.role,
            teamId: confirmAction.teamId,
          },
          {
            onSuccess: () => {
              toast.success('Role removed successfully');
              setConfirmAction(null);
            },
            onError: (error) => {
              toast.error(`Failed to remove role: ${error.message}`);
              setConfirmAction(null);
            },
          }
        );
      } else {
        // Remove app-level role (e.g., appAdmin)
        removeRoleFromUser.mutate(
          { user: userPrincipal, role: confirmAction.role },
          {
            onSuccess: () => {
              toast.success('Role removed successfully');
              setConfirmAction(null);
            },
            onError: (error) => {
              toast.error(`Failed to remove role: ${error.message}`);
              setConfirmAction(null);
            },
          }
        );
      }
    }
  };

  const getClubName = (clubId: string | undefined | null): string => {
    if (!clubId) return 'Unknown Club';
    const club = (allClubs as Club[] | undefined)?.find(c => c.id === clubId);
    return club?.name || 'Unknown Club';
  };

  const getTeamName = (teamId: string): string => {
    const team = teamsAndClubs?.teams?.find(t => t.id === teamId) || allTeams.find(t => t.id === teamId);
    return team?.name || 'Unknown Team';
  };

  const getClubInfoFromTeamId = (teamId: string): { clubId: string | null; clubName: string } => {
    const team = teamsAndClubs?.teams?.find(t => t.id === teamId) || allTeams.find(t => t.id === teamId);
    if (!team) {
      return { clubId: null, clubName: 'Unknown Club' };
    }
    const club = (allClubs as Club[] | undefined)?.find(c => c.id === team.clubId);
    return {
      clubId: team.clubId,
      clubName: club?.name || 'Unknown Club',
    };
  };

  const aggregatedMetrics = (allMetrics as any[] | undefined)?.reduce(
    (acc, metric) => ({
      clubs: acc.clubs + Number(metric.clubs),
      teams: acc.teams + Number(metric.teams),
      logins: acc.logins + Number(metric.logins),
      users: acc.users + Number(metric.users),
      revenue: acc.revenue + metric.revenue,
    }),
    { clubs: 0, teams: 0, logins: 0, users: 0, revenue: 0 }
  ) || { clubs: 0, teams: 0, logins: 0, users: 0, revenue: 0 };

  const availableTeamsForUserManagement = userManagementClub
    ? allTeams.filter(team => team.clubId === userManagementClub)
    : [];

  if (profileLoading) {
    return (
      <div className="h-[calc(100vh-72px)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="h-[calc(100vh-72px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No user profile found. Please create a profile first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-6 space-y-6">
          <div className="flex flex-col space-y-2">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your profile, roles, and application settings</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Profile Section */}
            <Card>
              <CardHeader>
                <CardTitle>User Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  {isEditingName ? (
                    <div className="flex space-x-2">
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter display name"
                      />
                      <Button onClick={handleSaveDisplayName} disabled={updateDisplayName.isPending}>
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setDisplayName(userProfile.displayName);
                        setIsEditingName(false);
                      }}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-medium">{userProfile.displayName}</p>
                      <Button variant="outline" size="sm" onClick={() => setIsEditingName(true)}>
                        Edit
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Principal ID</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 bg-muted rounded-lg font-mono text-xs break-all">
                      {principalId}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyPrincipalId}
                      className="h-10 w-10 shrink-0"
                      title="Copy to clipboard"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Roles</Label>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsAddRoleOverlayOpen(true)}
                    >
                      Add Role
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {userProfile.roles?.includes(UserRole.appAdmin) && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                        <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          App Admin
                        </Badge>
                        <span className="text-xs text-muted-foreground">System role</span>
                      </div>
                    )}

                    {userProfile.teamRoles && userProfile.teamRoles.length > 0 && (
                      <div className="space-y-2">
                        {userProfile.teamRoles.map((teamRole, index) => {
                          const teamName = getTeamName(teamRole.teamId);
                          const clubInfo = teamRole.clubId 
                            ? { clubId: teamRole.clubId, clubName: getClubName(teamRole.clubId) }
                            : getClubInfoFromTeamId(teamRole.teamId);
                          const displayText = `${getRoleLabel(teamRole.role)} — ${teamName} / ${clubInfo.clubName}`;
                          
                          return (
                            <div key={`${teamRole.role}-${teamRole.teamId}-${index}`} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                              <Badge variant="outline" className="max-w-[calc(100%-80px)] truncate" title={displayText}>
                                {displayText}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveTeamRole(teamRole.role, teamRole.teamId, clubInfo.clubId)}
                                disabled={removeTeamRole.isPending}
                              >
                                Remove
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(!userProfile.roles || userProfile.roles.length === 0 || (userProfile.roles.length === 1 && userProfile.roles[0] === UserRole.appAdmin)) &&
                     (!userProfile.teamRoles || userProfile.teamRoles.length === 0) && (
                      <p className="text-sm text-muted-foreground">No roles assigned yet.</p>
                    )}
                  </div>
                </div>

                {/* Child Profiles Section - Only visible to parents */}
                {isParent && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center space-x-2">
                          <img 
                            src="/assets/generated/child-profile-icon-transparent.dim_64x64.png" 
                            alt="Child Profiles" 
                            className="w-5 h-5"
                          />
                          <span>Child Profiles</span>
                        </Label>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setIsChildProfileCreationOpen(true)}
                        >
                          Create Child Profile
                        </Button>
                      </div>

                      {childProfilesLoading ? (
                        <div className="text-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                          <p className="text-sm text-muted-foreground">Loading child profiles...</p>
                        </div>
                      ) : childProfiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No child profiles yet. Create one to get started.</p>
                      ) : (
                        <div className="space-y-2">
                          {childProfiles.map((child) => (
                            <div key={child.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{child.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Born: {new Date(child.dateOfBirth).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {getTeamName(child.teamId)} / {getClubName(child.clubId)}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteChildProfile(child.id)}
                                disabled={deleteChildProfile.isPending}
                                className="ml-2 shrink-0"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Invite Code Management - App Admin Only */}
          {isAppAdmin && (
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <img src="/assets/generated/admin-invite-code-management.dim_400x200.png" alt="Invite Code" className="w-6 h-6" />
                  <CardTitle>Invite Code Management</CardTitle>
                </div>
                <CardDescription>Manage the invite code that grants Pro access to clubs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Invite Code</Label>
                  {isEditingInviteCode ? (
                    <div className="flex space-x-2">
                      <Input
                        value={newInviteCode}
                        onChange={(e) => setNewInviteCode(e.target.value.toUpperCase())}
                        placeholder="Enter new invite code"
                        className="h-12 text-base"
                      />
                      <Button onClick={handleSaveInviteCode} className="h-12">
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setNewInviteCode('');
                        setIsEditingInviteCode(false);
                      }} className="h-12">
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-lg font-bold">
                        {inviteCode}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyInviteCode}
                        className="h-12 w-12"
                        title="Copy to clipboard"
                      >
                        <Copy className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setNewInviteCode(inviteCode);
                          setIsEditingInviteCode(true);
                        }}
                        className="h-12"
                      >
                        Edit
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Club admins can use this code to unlock Pro features for their clubs
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* User Management Section - App Admin Only */}
          {isAppAdmin && (
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <img src="/assets/generated/user-management-icon-emerald-transparent.dim_24x24.png" alt="User Management" className="w-6 h-6" />
                  <CardTitle>User Management</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {usersLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading users...</p>
                  </div>
                ) : allUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No users found.</p>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {allUsers.map((user) => {
                        // Deduplicate roles for display
                        const uniqueRoles = deduplicateRoles(user.roles || []);
                        
                        return (
                          <div key={user.username} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{user.displayName}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.username}</p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {uniqueRoles.map((role, idx) => (
                                  <Badge key={`${role}-${idx}`} variant="outline" className="text-xs">
                                    {getRoleLabel(role)}
                                  </Badge>
                                ))}
                                {user.teamRoles?.map((teamRole, idx) => {
                                  const teamName = getTeamName(teamRole.teamId);
                                  const clubInfo = teamRole.clubId 
                                    ? { clubName: getClubName(teamRole.clubId) }
                                    : getClubInfoFromTeamId(teamRole.teamId);
                                  return (
                                    <Badge key={`${teamRole.role}-${teamRole.teamId}-${idx}`} variant="outline" className="text-xs">
                                      {getRoleLabel(teamRole.role)} — {teamName} / {clubInfo.clubName}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenUserManagement(user)}
                              className="ml-2 shrink-0 h-10 min-h-[2.5rem]"
                            >
                              Manage
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stripe Configuration - App Admin Only */}
          {isAppAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Stripe Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Stripe Secret Key</Label>
                  <Input
                    type="password"
                    value={stripeSecretKey}
                    onChange={(e) => setStripeSecretKey(e.target.value)}
                    placeholder="sk_test_..."
                    disabled={isStripeConnected}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Allowed Countries (comma-separated)</Label>
                  <Input
                    value={stripeAllowedCountries}
                    onChange={(e) => setStripeAllowedCountries(e.target.value)}
                    placeholder="US,CA,GB"
                    disabled={isStripeConnected}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter country codes separated by commas (e.g., US,CA,GB)
                  </p>
                </div>

                <Button
                  onClick={handleConnectStripe}
                  disabled={setStripeConfig.isPending || isStripeConnected}
                >
                  {isStripeConnected ? 'Stripe Connected' : 'Connect Stripe'}
                </Button>

                {isStripeConnected && (
                  <p className="text-sm text-green-600">
                    ✓ Stripe is connected and configured
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Metrics Dashboard - App Admin Only */}
          {isAppAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Metrics Dashboard</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-4">
                  <div className="space-y-2 flex-1">
                    <Label>Year</Label>
                    <Select
                      value={selectedYear.toString()}
                      onValueChange={(value) => setSelectedYear(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026].map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 flex-1">
                    <Label>Month</Label>
                    <Select
                      value={selectedMonth.toString()}
                      onValueChange={(value) => setSelectedMonth(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                          <SelectItem key={month} value={month.toString()}>
                            {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Clubs</p>
                    <p className="text-2xl font-bold">
                      {filteredMetrics ? Number(filteredMetrics.clubs) : aggregatedMetrics.clubs}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Teams</p>
                    <p className="text-2xl font-bold">
                      {filteredMetrics ? Number(filteredMetrics.teams) : aggregatedMetrics.teams}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Logins</p>
                    <p className="text-2xl font-bold">
                      {filteredMetrics ? Number(filteredMetrics.logins) : aggregatedMetrics.logins}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Users</p>
                    <p className="text-2xl font-bold">
                      {filteredMetrics ? Number(filteredMetrics.users) : aggregatedMetrics.users}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Revenue</p>
                    <p className="text-2xl font-bold">
                      ${(filteredMetrics ? filteredMetrics.revenue : aggregatedMetrics.revenue).toFixed(2)}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {!filteredMetrics && (allMetrics as any[] | undefined) && (allMetrics as any[]).length > 0 && 'Showing aggregated data from all periods.'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Role Overlay */}
      <AddRoleOverlay
        isOpen={isAddRoleOverlayOpen}
        onClose={() => setIsAddRoleOverlayOpen(false)}
        onSubmit={handleAddRole}
        allClubs={allClubs as Club[] | undefined}
        availableTeams={teamsAndClubs?.teams || []}
        isSubmitting={assignTeamRole.isPending}
        clubsLoading={clubsLoading}
        teamsLoading={teamsLoading}
      />

      {/* Child Profile Creation Overlay */}
      {isChildProfileCreationOpen && (
        <ChildProfileCreationPage
          onClose={() => setIsChildProfileCreationOpen(false)}
          onSuccess={() => {
            // Profiles will be automatically refetched by the query
          }}
        />
      )}

      {/* User Management Dialog - Full Screen & Mobile Responsive */}
      {isUserManagementDialogOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-background">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b bg-background">
            <div className="flex-1 min-w-0 mr-4">
              <h2 className="text-xl sm:text-2xl font-semibold truncate">
                Manage User Roles
              </h2>
              <p className="text-sm text-muted-foreground truncate mt-1">
                {selectedUser.displayName}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsUserManagementDialogOpen(false)}
              className="shrink-0 h-10 w-10 sm:h-12 sm:w-12"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          </div>
          
          {/* Content */}
          <div className="h-[calc(100vh-140px)] sm:h-[calc(100vh-160px)] overflow-y-auto">
            <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
              {/* Current Roles */}
              <div className="space-y-3">
                <Label className="text-base sm:text-lg font-semibold">Current Roles</Label>
                <div className="rounded-lg border bg-card">
                  <ScrollArea className="h-[200px] sm:h-[280px] p-4">
                    <div className="space-y-2">
                      {deduplicateRoles(selectedUser.roles || []).map((role, idx) => {
                        const isOwnAppAdmin = role === UserRole.appAdmin && selectedUser.username === userProfile?.username;
                        return (
                          <div key={`${role}-${idx}`} className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-muted min-h-[3rem]">
                            <Badge variant="outline" className="text-sm sm:text-base">{getRoleLabel(role)}</Badge>
                            {!isOwnAppAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveRoleFromUser(role)}
                                className="h-10 w-10 sm:h-12 sm:w-12 p-0 shrink-0"
                              >
                                <img src="/assets/generated/role-removal-icon-red-transparent.dim_16x16.png" alt="Remove" className="w-5 h-5" />
                              </Button>
                            )}
                            {isOwnAppAdmin && (
                              <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Protected</span>
                            )}
                          </div>
                        );
                      })}
                      {selectedUser.teamRoles?.map((teamRole, idx) => {
                        const teamName = getTeamName(teamRole.teamId);
                        const clubInfo = teamRole.clubId 
                          ? { clubName: getClubName(teamRole.clubId) }
                          : getClubInfoFromTeamId(teamRole.teamId);
                        return (
                          <div key={`${teamRole.role}-${teamRole.teamId}-${idx}`} className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-muted min-h-[3rem]">
                            <Badge variant="outline" className="text-sm sm:text-base max-w-[calc(100%-60px)] truncate">
                              {getRoleLabel(teamRole.role)} — {teamName} / {clubInfo.clubName}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRoleFromUser(teamRole.role, teamRole.teamId)}
                              className="h-10 w-10 sm:h-12 sm:w-12 p-0 shrink-0"
                            >
                              <img src="/assets/generated/role-removal-icon-red-transparent.dim_16x16.png" alt="Remove" className="w-5 h-5" />
                            </Button>
                          </div>
                        );
                      })}
                      {(!selectedUser.roles || selectedUser.roles.length === 0) && 
                       (!selectedUser.teamRoles || selectedUser.teamRoles.length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-6">No roles assigned</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <Separator />

              {/* Add New Role */}
              <div className="space-y-4">
                <Label className="text-base sm:text-lg font-semibold">Add New Role</Label>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">Role</Label>
                    <Select value={userManagementRole} onValueChange={(value) => setUserManagementRole(value as UserRole)}>
                      <SelectTrigger className="h-12 sm:h-14 text-base">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="h-12 sm:h-14 text-base">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {userManagementRole && (
                    <div className="space-y-2">
                      <Label className="text-sm sm:text-base">Club</Label>
                      <Select value={userManagementClub} onValueChange={setUserManagementClub}>
                        <SelectTrigger className="h-12 sm:h-14 text-base">
                          <SelectValue placeholder="Select club" />
                        </SelectTrigger>
                        <SelectContent>
                          {(allClubs as Club[] | undefined)?.length === 0 ? (
                            <div className="p-3 text-sm text-muted-foreground">
                              No clubs available. Create a club first.
                            </div>
                          ) : (
                            (allClubs as Club[] | undefined)?.map((club) => (
                              <SelectItem key={club.id} value={club.id} className="h-12 sm:h-14 text-base">
                                {club.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {userManagementRole && userManagementRole !== UserRole.clubAdmin && userManagementClub && (
                    <div className="space-y-2">
                      <Label className="text-sm sm:text-base">Team</Label>
                      <Select value={userManagementTeam} onValueChange={setUserManagementTeam}>
                        <SelectTrigger className="h-12 sm:h-14 text-base">
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTeamsForUserManagement.length === 0 ? (
                            <div className="p-3 text-sm text-muted-foreground">
                              No teams available for this club. Create a team first.
                            </div>
                          ) : (
                            availableTeamsForUserManagement.map((team) => (
                              <SelectItem key={team.id} value={team.id} className="h-12 sm:h-14 text-base">
                                {team.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 p-4 sm:p-6 border-t bg-background">
            <Button 
              variant="outline" 
              onClick={() => setIsUserManagementDialogOpen(false)}
              className="h-12 sm:h-14 px-6 sm:px-8 text-base"
            >
              Close
            </Button>
            <Button 
              onClick={handleAddRoleToUser} 
              disabled={!userManagementRole || assignRoleToUser.isPending || assignTeamRoleToUser.isPending}
              className="h-12 sm:h-14 px-6 sm:px-8 text-base"
            >
              <img src="/assets/generated/role-addition-icon-emerald-transparent.dim_16x16.png" alt="Add" className="w-5 h-5 mr-2" />
              Add Role
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent className="max-w-md mx-4 sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">Confirm Action</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {confirmAction?.type === 'add' 
                ? `Are you sure you want to add the role "${getRoleLabel(confirmAction.role)}" to ${selectedUser?.displayName}?`
                : confirmAction?.role === UserRole.appAdmin
                  ? `Are you sure you want to remove the app admin role from ${selectedUser?.displayName}? This action will revoke their administrative privileges.`
                  : `Are you sure you want to remove the role "${getRoleLabel(confirmAction?.role || UserRole.player)}" from ${selectedUser?.displayName}?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="h-12 sm:h-14 w-full sm:w-auto text-base">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmAction} 
              className="h-12 sm:h-14 w-full sm:w-auto text-base"
              disabled={assignRoleToUser.isPending || removeRoleFromUser.isPending || assignTeamRoleToUser.isPending || removeTeamRoleFromUser.isPending}
            >
              {assignRoleToUser.isPending || removeRoleFromUser.isPending || assignTeamRoleToUser.isPending || removeTeamRoleFromUser.isPending ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Child Profile Confirmation Dialog */}
      <AlertDialog open={!!childProfileToDelete} onOpenChange={() => setChildProfileToDelete(null)}>
        <AlertDialogContent className="max-w-md mx-4 sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">Delete Child Profile</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to delete this child profile? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="h-12 sm:h-14 w-full sm:w-auto text-base">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteChildProfile} 
              className="h-12 sm:h-14 w-full sm:w-auto text-base bg-destructive hover:bg-destructive/90"
              disabled={deleteChildProfile.isPending}
            >
              {deleteChildProfile.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
