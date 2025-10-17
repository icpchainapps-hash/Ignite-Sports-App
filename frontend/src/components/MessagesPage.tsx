import { useState } from 'react';
import { MessageSquare, Plus, Inbox, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGetCallerUserProfile } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import CreateThreadDialog from './CreateThreadDialog';
import MessageInbox from './MessageInbox';

export default function MessagesPage() {
  const { identity } = useInternetIdentity();
  const { data: userProfile } = useGetCallerUserProfile();
  const [createThreadOpen, setCreateThreadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'broadcast' | 'club' | 'team'>('all');

  const isAppAdmin = userProfile?.roles.some(role => role === 'appAdmin') || false;
  const isClubAdmin = userProfile?.roles.some(role => role === 'clubAdmin') || false;
  const isTeamAdmin = userProfile?.roles.some(role => role === 'teamAdmin') || false;

  const canCreateThreads = isAppAdmin || isClubAdmin || isTeamAdmin;

  if (!identity) {
    return (
      <div className="flex items-center justify-center h-full bg-background p-4 sm:p-6">
        <div className="text-center space-y-6 max-w-md w-full">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-10 h-10 text-primary" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Messages</h1>
            <p className="text-sm text-muted-foreground/70 font-medium tracking-wide">Football</p>
          </div>
          
          <div className="space-y-4">
            <p className="text-xl text-muted-foreground">Please log in to view messages</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                <MessageSquare className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                Messages
              </h1>
              <p className="text-sm text-muted-foreground/70 font-medium tracking-wide">Football</p>
            </div>
            
            {canCreateThreads && (
              <Button
                onClick={() => setCreateThreadOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Thread
              </Button>
            )}
          </div>

          {/* Main Content */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Inbox className="w-5 h-5 text-primary" />
                Inbox
              </CardTitle>
              <CardDescription className="text-sm">
                View and manage your messages from clubs, teams, and administrators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6 h-auto">
                  <TabsTrigger value="all" className="flex items-center gap-2 text-xs sm:text-sm py-2">
                    <Filter className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">All</span>
                    <span className="sm:hidden">All</span>
                  </TabsTrigger>
                  <TabsTrigger value="broadcast" className="flex items-center gap-2 text-xs sm:text-sm py-2">
                    <img 
                      src="/assets/generated/broadcast-message-icon-transparent.dim_24x24.png" 
                      alt="Broadcast" 
                      className="w-3 h-3 sm:w-4 sm:h-4"
                    />
                    <span className="hidden sm:inline">Broadcast</span>
                    <span className="sm:hidden">Cast</span>
                  </TabsTrigger>
                  <TabsTrigger value="club" className="flex items-center gap-2 text-xs sm:text-sm py-2">
                    <img 
                      src="/assets/generated/club-message-icon-transparent.dim_24x24.png" 
                      alt="Club" 
                      className="w-3 h-3 sm:w-4 sm:h-4"
                    />
                    Club
                  </TabsTrigger>
                  <TabsTrigger value="team" className="flex items-center gap-2 text-xs sm:text-sm py-2">
                    <img 
                      src="/assets/generated/team-message-icon-transparent.dim_24x24.png" 
                      alt="Team" 
                      className="w-3 h-3 sm:w-4 sm:h-4"
                    />
                    Team
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-0">
                  <MessageInbox filterType={null} />
                </TabsContent>

                <TabsContent value="broadcast" className="mt-0">
                  <MessageInbox filterType="broadcast" />
                </TabsContent>

                <TabsContent value="club" className="mt-0">
                  <MessageInbox filterType="clubWide" />
                </TabsContent>

                <TabsContent value="team" className="mt-0">
                  <MessageInbox filterType="teamWide" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Thread Dialog */}
      {canCreateThreads && (
        <CreateThreadDialog
          open={createThreadOpen}
          onOpenChange={setCreateThreadOpen}
          isAppAdmin={isAppAdmin}
          isClubAdmin={isClubAdmin}
          isTeamAdmin={isTeamAdmin}
        />
      )}
    </div>
  );
}
