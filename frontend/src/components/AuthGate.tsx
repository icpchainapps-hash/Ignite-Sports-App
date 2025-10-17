import { useEffect } from 'react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Button } from '@/components/ui/button';

export default function AuthGate() {
  const { login, isLoggingIn } = useInternetIdentity();

  useEffect(() => {
    console.log('🚪 [AUTH GATE] AuthGate component mounted');
    console.log('🚪 [AUTH GATE] User is not authenticated');
    console.log('🚪 [AUTH GATE] isLoggingIn:', isLoggingIn);
  }, [isLoggingIn]);

  const handleLogin = async () => {
    console.log('🚪 [AUTH GATE] Login button clicked');
    try {
      await login();
      console.log('✅ [AUTH GATE] Login successful');
    } catch (error) {
      console.error('❌ [AUTH GATE] Login error:', error);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center justify-center space-y-8 max-w-lg w-full">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center">
            <img 
              src="/assets/generated/ignite-logo.png" 
              alt="Ignite Logo" 
              className="w-20 h-20 md:w-24 md:h-24 rounded-full" 
            />
          </div>
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-1">Ignite</h1>
          </div>
        </div>

        <div className="w-full space-y-4">
          <Button 
            onClick={handleLogin} 
            disabled={isLoggingIn}
            className="w-full h-14 text-lg font-medium touch-manipulation"
            size="lg"
          >
            {isLoggingIn ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-3"></div>
                Connecting...
              </>
            ) : (
              'Login to Continue'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
