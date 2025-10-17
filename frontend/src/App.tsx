import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { useInternetIdentity } from './hooks/useInternetIdentity';
import { useGetCallerUserProfile } from './hooks/useProfileQueries';
import AuthGate from './components/AuthGate';
import ProfileSetupModal from './components/ProfileSetupModal';
import Navigation from './components/Navigation';
import FullscreenChatOverlay from './components/FullscreenChatOverlay';
import { useState } from 'react';
import { ChatThread } from './backend';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const { identity, isInitializing } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading, isFetched } = useGetCallerUserProfile();
  const [activeChatThread, setActiveChatThread] = useState<ChatThread | null>(null);
  const [currentSection, setCurrentSection] = useState<'messages' | 'events' | 'clubs-teams' | 'game' | 'feed' | 'settings'>('messages');

  const isAuthenticated = !!identity;

  if (isInitializing || (isAuthenticated && profileLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthGate />;
  }

  const showProfileSetup = isAuthenticated && !profileLoading && isFetched && userProfile === null;

  if (showProfileSetup) {
    return <ProfileSetupModal />;
  }

  return (
    <>
      <Navigation 
        currentSection={currentSection}
        onSectionChange={setCurrentSection}
        onOpenChatThread={setActiveChatThread}
        onNavigateToEvents={() => setCurrentSection('events')}
        onNavigateToTeamDetails={() => setCurrentSection('clubs-teams')}
      />
      {activeChatThread && (
        <FullscreenChatOverlay
          thread={activeChatThread}
          onClose={() => setActiveChatThread(null)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AppContent />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
