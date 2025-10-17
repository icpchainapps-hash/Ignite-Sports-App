import { useState, useEffect } from 'react';
import { Player } from './PitchBoard';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, Users } from 'lucide-react';
import { ROLE_BG_COLORS, ROLE_LABELS } from '../lib/constants';

interface AutomatedSubstitutionDialogProps {
  isOpen: boolean;
  fieldPlayer: Player | null;
  benchPlayer: Player | null;
  scheduledTime: number; // in seconds
  onConfirm: () => void;
  onDecline: () => void;
}

export default function AutomatedSubstitutionDialog({
  isOpen,
  fieldPlayer,
  benchPlayer,
  scheduledTime,
  onConfirm,
  onDecline,
}: AutomatedSubstitutionDialogProps) {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(30);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onDecline]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!fieldPlayer || !benchPlayer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDecline()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-primary" />
            <span>Scheduled Substitution</span>
          </DialogTitle>
          <DialogDescription>
            Automated substitution suggestion at {formatTime(scheduledTime)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field Player - Coming Off */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Coming Off</span>
            </div>
            <div className="p-3 rounded-lg border-2 border-destructive/50 bg-destructive/5">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-10 h-10 rounded-full ${ROLE_BG_COLORS[fieldPlayer.role]} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}
                >
                  {fieldPlayer.number}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-base">{fieldPlayer.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {ROLE_LABELS[fieldPlayer.role]}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bench Player - Coming On */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Coming On</span>
            </div>
            <div className="p-3 rounded-lg border-2 border-primary bg-primary/5">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-10 h-10 rounded-full ${ROLE_BG_COLORS[benchPlayer.role]} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}
                >
                  {benchPlayer.number}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-base">{benchPlayer.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {ROLE_LABELS[benchPlayer.role]}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Auto-decline countdown */}
          <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Auto-declining in {countdown}s</span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onDecline} className="w-full sm:w-auto">
            Decline
          </Button>
          <Button onClick={onConfirm} className="w-full sm:w-auto">
            Confirm Substitution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

