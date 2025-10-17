import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock, Play, Pause, RotateCcw } from 'lucide-react';
import { useTimerBeep } from '@/hooks/useTimerBeep';

export type TimerState = 'idle' | 'running' | 'paused' | 'halftime' | 'finished';
export type Half = 'first' | 'second';

export interface MatchTimerData {
  halfDuration: number; // in minutes
  currentHalf: Half;
  timeRemaining: number; // in seconds
  state: TimerState;
}

interface MatchTimerProps {
  timerData: MatchTimerData;
  onTimerUpdate: (data: MatchTimerData) => void;
  isMobile?: boolean;
  isLandscape?: boolean;
}

export default function MatchTimer({ timerData, onTimerUpdate, isMobile = false, isLandscape = false }: MatchTimerProps) {
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const { playBeep, initAudioContext } = useTimerBeep();
  const hasPlayedHalftimeBeepRef = useRef(false);
  const hasPlayedFullTimeBeepRef = useRef(false);

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Get display text for current state
  const getStateDisplay = useCallback((): string => {
    switch (timerData.state) {
      case 'idle':
        return 'Ready';
      case 'running':
        return timerData.currentHalf === 'first' ? '1st' : '2nd';
      case 'paused':
        return `${timerData.currentHalf === 'first' ? '1st' : '2nd'} (Paused)`;
      case 'halftime':
        return 'Halftime';
      case 'finished':
        return 'Finished';
      default:
        return 'Ready';
    }
  }, [timerData.state, timerData.currentHalf]);

  // Timer countdown logic
  useEffect(() => {
    if (timerData.state === 'running') {
      const id = setInterval(() => {
        onTimerUpdate({
          ...timerData,
          timeRemaining: Math.max(0, timerData.timeRemaining - 1)
        });
      }, 1000);
      setIntervalId(id);
      
      return () => {
        clearInterval(id);
        setIntervalId(null);
      };
    } else {
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
    }
  }, [timerData.state, timerData.timeRemaining, onTimerUpdate]);

  // Handle automatic half transitions and beep sounds
  useEffect(() => {
    if (timerData.timeRemaining === 0 && timerData.state === 'running') {
      if (timerData.currentHalf === 'first') {
        // First half ended, go to halftime
        onTimerUpdate({
          ...timerData,
          state: 'halftime',
          timeRemaining: timerData.halfDuration * 60
        });
        
        // Play halftime beep
        if (!hasPlayedHalftimeBeepRef.current) {
          playBeep();
          hasPlayedHalftimeBeepRef.current = true;
        }
      } else {
        // Second half ended, match finished
        onTimerUpdate({
          ...timerData,
          state: 'finished',
          timeRemaining: 0
        });
        
        // Play full time beep
        if (!hasPlayedFullTimeBeepRef.current) {
          playBeep();
          hasPlayedFullTimeBeepRef.current = true;
        }
      }
    }
  }, [timerData.timeRemaining, timerData.state, timerData.currentHalf, timerData.halfDuration, onTimerUpdate, playBeep]);

  // Reset beep flags when timer is reset
  useEffect(() => {
    if (timerData.state === 'idle') {
      hasPlayedHalftimeBeepRef.current = false;
      hasPlayedFullTimeBeepRef.current = false;
    }
  }, [timerData.state]);

  const handleStart = useCallback(() => {
    // Initialize audio context on user interaction (required for mobile browsers)
    initAudioContext();
    
    if (timerData.state === 'idle') {
      onTimerUpdate({
        ...timerData,
        state: 'running',
        currentHalf: 'first',
        timeRemaining: timerData.halfDuration * 60
      });
    } else if (timerData.state === 'paused') {
      onTimerUpdate({
        ...timerData,
        state: 'running'
      });
    } else if (timerData.state === 'halftime') {
      onTimerUpdate({
        ...timerData,
        state: 'running',
        currentHalf: 'second',
        timeRemaining: timerData.halfDuration * 60
      });
    }
  }, [timerData, onTimerUpdate, initAudioContext]);

  const handlePause = useCallback(() => {
    if (timerData.state === 'running') {
      onTimerUpdate({
        ...timerData,
        state: 'paused'
      });
    }
  }, [timerData, onTimerUpdate]);

  const handleReset = useCallback(() => {
    onTimerUpdate({
      ...timerData,
      state: 'idle',
      currentHalf: 'first',
      timeRemaining: timerData.halfDuration * 60
    });
  }, [timerData, onTimerUpdate]);

  // Mobile timer display (compact) - always show controls directly
  if (isMobile) {
    return (
      <div className="flex items-center space-x-2 bg-card border rounded-lg px-3 py-2 shadow-sm min-w-0">
        {/* Timer Display */}
        <div className="flex items-center space-x-2 min-w-0">
          <Clock className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="text-sm font-mono font-bold text-foreground whitespace-nowrap">
            {formatTime(timerData.timeRemaining)}
          </div>
          <Badge variant="outline" className="text-xs px-2 py-0.5 bg-background flex-shrink-0">
            {timerData.currentHalf === 'first' ? '1st' : '2nd'}
          </Badge>
        </div>
        
        {/* Always visible controls */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          {/* Play/Pause Button */}
          {timerData.state === 'running' ? (
            <Button
              variant="default"
              size="sm"
              onClick={handlePause}
              className="bg-orange-500 hover:bg-orange-600 border-2 border-orange-600 shadow-lg transition-all duration-200 text-white font-semibold h-8 w-8 p-0"
              title="Pause Timer"
            >
              <Pause className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleStart}
              className="bg-green-500 hover:bg-green-600 border-2 border-green-600 shadow-lg transition-all duration-200 text-white font-semibold h-8 w-8 p-0"
              title={timerData.state === 'halftime' ? 'Start 2nd Half' : 'Start Timer'}
              disabled={timerData.state === 'finished'}
            >
              <Play className="w-3.5 h-3.5" />
            </Button>
          )}
          
          {/* Reset Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="border-2 shadow-lg hover:bg-accent transition-all duration-200 font-semibold h-8 w-8 p-0"
            title="Reset Timer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // Landscape mode - compact single-row layout with proper spacing and alignment
  if (isLandscape) {
    return (
      <div className="w-full bg-card border rounded-lg shadow-sm">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          {/* Left: Timer and Icon */}
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <Clock className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="text-base font-mono font-bold text-foreground whitespace-nowrap">
              {formatTime(timerData.timeRemaining)}
            </div>
          </div>
          
          {/* Center: Status Badge */}
          <div className="flex-shrink-0">
            <Badge 
              variant={timerData.state === 'running' ? 'default' : 'outline'} 
              className="text-xs px-2.5 py-0.5 whitespace-nowrap font-medium"
            >
              {getStateDisplay()}
            </Badge>
          </div>
          
          {/* Right: Controls - always visible and properly spaced */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Play/Pause Button */}
            {timerData.state === 'running' ? (
              <Button
                variant="default"
                size="sm"
                onClick={handlePause}
                className="bg-orange-500 hover:bg-orange-600 border-2 border-orange-600 shadow-lg transition-all duration-200 text-white font-semibold h-8 w-8 p-0 flex-shrink-0"
                title="Pause Timer"
              >
                <Pause className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleStart}
                className="bg-green-500 hover:bg-green-600 border-2 border-green-600 shadow-lg transition-all duration-200 text-white font-semibold h-8 w-8 p-0 flex-shrink-0"
                title={timerData.state === 'halftime' ? 'Start 2nd Half' : 'Start Timer'}
                disabled={timerData.state === 'finished'}
              >
                <Play className="w-3.5 h-3.5" />
              </Button>
            )}
            
            {/* Reset Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="border-2 shadow-lg hover:bg-accent transition-all duration-200 font-semibold h-8 w-8 p-0 flex-shrink-0"
              title="Reset Timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop timer display
  return (
    <Card className="w-80">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center space-x-2">
          <Clock className="w-5 h-5" />
          <span>Match Timer</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timer Display - clickable to reveal controls */}
        <div className="text-center space-y-4">
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-4xl font-mono font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer p-2 rounded-lg hover:bg-accent">
                {formatTime(timerData.timeRemaining)}
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-0" 
              align="center" 
              side="bottom"
            >
              <div className="space-y-2 p-2">
                <div className="text-center text-sm font-medium text-muted-foreground">
                  Timer Controls
                </div>
                <div className="flex items-center justify-center space-x-3 p-2">
                  {/* Play/Pause Button */}
                  {timerData.state === 'running' ? (
                    <Button
                      variant="default"
                      size="default"
                      onClick={handlePause}
                      className="bg-orange-500 hover:bg-orange-600 border-2 border-orange-600 shadow-lg transition-all duration-200 text-white font-semibold"
                      title="Pause Timer"
                    >
                      <Pause className="w-5 h-5 mr-2" />
                      Pause
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="default"
                      onClick={handleStart}
                      className="bg-green-500 hover:bg-green-600 border-2 border-green-600 shadow-lg transition-all duration-200 text-white font-semibold"
                      title={timerData.state === 'halftime' ? 'Start 2nd Half' : 'Start Timer'}
                      disabled={timerData.state === 'finished'}
                    >
                      <Play className="w-5 h-5 mr-2" />
                      {timerData.state === 'halftime' ? 'Start' : 'Play'}
                    </Button>
                  )}
                  
                  {/* Reset Button */}
                  <Button
                    variant="outline"
                    size="default"
                    onClick={handleReset}
                    className="border-2 shadow-lg hover:bg-accent transition-all duration-200 font-semibold"
                    title="Reset Timer"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Status Display */}
          <div className="flex items-center justify-center space-x-2">
            <Badge variant={timerData.state === 'running' ? 'default' : 'outline'} className="text-sm px-3 py-1">
              {getStateDisplay()}
            </Badge>
            {timerData.state !== 'idle' && timerData.state !== 'finished' && (
              <Badge variant="outline" className="text-sm px-3 py-1">
                {timerData.halfDuration} min halves
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Match Status Messages */}
        {timerData.state === 'halftime' && (
          <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            Click the timer to access controls and start the 2nd half
          </div>
        )}
        {timerData.state === 'finished' && (
          <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            Match completed! Click the timer to access reset controls
          </div>
        )}
        {timerData.state === 'idle' && (
          <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            Click the timer to access controls and start the match
          </div>
        )}
      </CardContent>
    </Card>
  );
}
