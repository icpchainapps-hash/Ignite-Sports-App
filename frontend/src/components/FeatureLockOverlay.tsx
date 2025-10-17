import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface FeatureLockOverlayProps {
  featureName: string;
  requiredPlan: string;
  onUpgrade: () => void;
}

export default function FeatureLockOverlay({ featureName, requiredPlan, onUpgrade }: FeatureLockOverlayProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Feature Locked</CardTitle>
          <CardDescription className="text-base">
            {featureName} requires a {requiredPlan} subscription
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Upgrade your club's subscription to unlock this feature and many more.
          </p>
          <Button onClick={onUpgrade} className="w-full" size="lg">
            <img 
              src="/assets/generated/upgrade-button-icon-emerald-transparent.dim_24x24.png" 
              alt="Upgrade" 
              className="w-5 h-5 mr-2"
            />
            Upgrade Now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

