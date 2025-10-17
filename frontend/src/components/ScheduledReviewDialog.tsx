import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, User, ArrowRight, Info, AlertTriangle, Trash2, Timer, TrendingDown } from 'lucide-react';
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation';
import { useMemo } from 'react';

interface Player {
  id: string;
  name: string;
  role: string;
  isOnField: boolean;
}

interface ScheduledSubstitution {
  time: number;
  fieldPlayer: Player;
  benchPlayer: Player;
  executed: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface ScheduleReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onClearSchedule?: () => void;
  schedule: ScheduledSubstitution[];
  timePerHalf: number;
  allPlayers: Player[];
  isClearingSchedule?: boolean;
  validationResult?: ValidationResult | null;
}

export default function ScheduleReviewDialog({
  isOpen,
  onClose,
  onClearSchedule,
  schedule,
  timePerHalf,
  allPlayers,
  isClearingSchedule = false,
  validationResult = null,
}: ScheduleReviewDialogProps) {
  const orientation = useDeviceOrientation();
  const isLandscape = orientation === 'landscape';

  // Calculate target minutes per player
  const targetMinutesPerPlayer = useMemo(() => {
    const totalMatchTime = timePerHalf * 2; // in minutes
    const totalPlayers = allPlayers.length;
    const numFieldPlayers = allPlayers.filter(p => p.isOnField).length;
    
    if (totalPlayers === 0 || numFieldPlayers === 0) return 0;
    
    // Target = (total field time) / (total players)
    return (numFieldPlayers * totalMatchTime) / totalPlayers;
  }, [timePerHalf, allPlayers]);

  // Calculate playing time and off-field time for each player based on the schedule
  const playerPlayingTime = useMemo(() => {
    const totalMatchTime = timePerHalf * 2 * 60; // in seconds
    const playingTime: Record<string, number> = {};
    const offFieldTime: Record<string, number> = {};
    const benchEventCount: Record<string, number> = {};
    const fieldStatus: Record<string, boolean> = {};

    // Initialize all players with their starting status
    allPlayers.forEach(player => {
      playingTime[player.id] = 0;
      offFieldTime[player.id] = 0;
      benchEventCount[player.id] = 0;
      fieldStatus[player.id] = player.isOnField;
    });

    if (schedule.length === 0) {
      // No substitutions - players on field play the whole match, bench players stay on bench
      allPlayers.forEach(player => {
        if (fieldStatus[player.id]) {
          playingTime[player.id] = totalMatchTime;
        } else {
          offFieldTime[player.id] = totalMatchTime;
        }
      });
      return { playingTime, offFieldTime, benchEventCount };
    }

    // Process substitutions chronologically
    const sortedSchedule = [...schedule].sort((a, b) => a.time - b.time);
    let lastTime = 0;

    sortedSchedule.forEach(sub => {
      const timePeriod = sub.time - lastTime;

      // Add playing time for all players currently on field
      // Add off-field time for all players currently on bench
      Object.keys(fieldStatus).forEach(playerId => {
        if (fieldStatus[playerId]) {
          playingTime[playerId] = (playingTime[playerId] || 0) + timePeriod;
        } else {
          offFieldTime[playerId] = (offFieldTime[playerId] || 0) + timePeriod;
        }
      });

      // Count bench event for player coming off
      benchEventCount[sub.fieldPlayer.id] = (benchEventCount[sub.fieldPlayer.id] || 0) + 1;

      // Execute substitution
      fieldStatus[sub.fieldPlayer.id] = false;
      fieldStatus[sub.benchPlayer.id] = true;

      lastTime = sub.time;
    });

    // Add remaining time until end of match
    const remainingTime = totalMatchTime - lastTime;
    Object.keys(fieldStatus).forEach(playerId => {
      if (fieldStatus[playerId]) {
        playingTime[playerId] = (playingTime[playerId] || 0) + remainingTime;
      } else {
        offFieldTime[playerId] = (offFieldTime[playerId] || 0) + remainingTime;
      }
    });

    return { playingTime, offFieldTime, benchEventCount };
  }, [schedule, timePerHalf, allPlayers]);

  // Get unique players and their total playing time with percentage difference
  const playerSummary = useMemo(() => {
    const targetSeconds = targetMinutesPerPlayer * 60;
    
    const players = allPlayers.map(player => {
      const time = playerPlayingTime.playingTime[player.id] || 0;
      const offTime = playerPlayingTime.offFieldTime[player.id] || 0;
      const benchEvents = playerPlayingTime.benchEventCount[player.id] || 0;
      const difference = time - targetSeconds;
      const percentDiff = targetSeconds > 0 ? (difference / targetSeconds) * 100 : 0;
      const withinTolerance = Math.abs(percentDiff) <= 10;
      
      return {
        id: player.id,
        name: player.name,
        role: player.role,
        time,
        offTime,
        benchEvents,
        difference,
        percentDiff,
        withinTolerance,
      };
    });

    return players.sort((a, b) => b.time - a.time);
  }, [allPlayers, playerPlayingTime, targetMinutesPerPlayer]);

  // Calculate statistics
  const stats = useMemo(() => {
    const times = playerSummary.map(p => p.time);
    const totalPlayers = playerSummary.length;
    
    if (totalPlayers === 0) {
      return {
        totalPlayers: 0,
        playersWithZeroTime: 0,
        playersWithinTolerance: 0,
        playersOutsideTolerance: 0,
        minTime: 0,
        maxTime: 0,
        avgTime: 0,
        timeSpread: 0,
      };
    }
    
    const playersWithZeroTime = times.filter(t => t === 0).length;
    const playersWithinTolerance = playerSummary.filter(p => p.withinTolerance && p.time > 0).length;
    const playersOutsideTolerance = totalPlayers - playersWithinTolerance - playersWithZeroTime;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const avgTime = times.reduce((sum, t) => sum + t, 0) / totalPlayers;
    const timeSpread = maxTime - minTime;
    
    return {
      totalPlayers,
      playersWithZeroTime,
      playersWithinTolerance,
      playersOutsideTolerance,
      minTime,
      maxTime,
      avgTime,
      timeSpread,
    };
  }, [playerSummary]);

  // Count unique substitution windows and calculate intervals
  const windowStats = useMemo(() => {
    if (schedule.length === 0) {
      return {
        numWindows: 0,
        intervals: [],
        avgInterval: 0,
        minInterval: 0,
        maxInterval: 0,
      };
    }

    const uniqueTimes = Array.from(new Set(schedule.map(s => s.time))).sort((a, b) => a - b);
    const intervals: number[] = [];
    
    for (let i = 1; i < uniqueTimes.length; i++) {
      intervals.push((uniqueTimes[i] - uniqueTimes[i - 1]) / 60); // Convert to minutes
    }
    
    const avgInterval = intervals.length > 0 ? intervals.reduce((sum, val) => sum + val, 0) / intervals.length : 0;
    const minInterval = intervals.length > 0 ? Math.min(...intervals) : 0;
    const maxInterval = intervals.length > 0 ? Math.max(...intervals) : 0;
    
    return {
      numWindows: uniqueTimes.length,
      intervals,
      avgInterval,
      minInterval,
      maxInterval,
    };
  }, [schedule]);

  // Count substitutions per half
  const subsPerHalf = useMemo(() => {
    const halfDuration = timePerHalf * 60;
    const firstHalf = schedule.filter(s => s.time <= halfDuration).length;
    const secondHalf = schedule.filter(s => s.time > halfDuration).length;
    return { firstHalf, secondHalf };
  }, [schedule, timePerHalf]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMinutes = (seconds: number): string => {
    return (seconds / 60).toFixed(1);
  };

  const getHalfLabel = (seconds: number): string => {
    const halfDuration = timePerHalf * 60;
    if (seconds <= halfDuration) {
      return '1st Half';
    } else {
      return '2nd Half';
    }
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'goalkeeper':
        return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
      case 'defender':
        return 'bg-blue-500/20 text-blue-700 dark:text-blue-400';
      case 'midfielder':
        return 'bg-green-500/20 text-green-700 dark:text-green-400';
      case 'forward':
        return 'bg-red-500/20 text-red-700 dark:text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-700 dark:text-gray-400';
    }
  };

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'goalkeeper':
        return 'GK';
      case 'defender':
        return 'DEF';
      case 'midfielder':
        return 'MID';
      case 'forward':
        return 'FWD';
      default:
        return role.toUpperCase();
    }
  };

  const getToleranceColor = (percentDiff: number, hasZeroTime: boolean): string => {
    if (hasZeroTime) return 'text-yellow-600 dark:text-yellow-400';
    const absPercent = Math.abs(percentDiff);
    if (absPercent <= 10) return 'text-green-600 dark:text-green-400';
    if (absPercent <= 20) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getToleranceBgColor = (withinTolerance: boolean, hasZeroTime: boolean): string => {
    if (hasZeroTime) return 'bg-yellow-500/10 border-yellow-500/20';
    return withinTolerance 
      ? 'bg-green-500/10 border-green-500/20' 
      : 'bg-red-500/10 border-red-500/20';
  };

  const handleClearSchedule = () => {
    if (onClearSchedule) {
      onClearSchedule();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={
          isLandscape
            ? 'fixed inset-0 w-screen h-screen max-w-none rounded-none flex flex-col p-0 border-0 m-0 translate-x-0 translate-y-0 bg-background'
            : 'w-[95vw] max-w-3xl h-[90vh] sm:h-[85vh] flex flex-col p-0'
        }
        style={isLandscape ? {
          position: 'fixed',
          left: '0',
          top: '0',
          right: '0',
          bottom: '0',
          width: '100vw',
          height: '100vh',
          maxWidth: '100vw',
          maxHeight: '100vh',
          margin: '0',
          transform: 'none',
          zIndex: 100,
        } : undefined}
      >
        <DialogHeader className="flex-shrink-0 px-4 pt-4 sm:px-6 sm:pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Clock className="w-5 h-5 text-primary flex-shrink-0" />
            <span>Substitution Schedule Review</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            {schedule.length > 0 ? (
              `Evenly distributed schedule with ${windowStats.numWindows} round${windowStats.numWindows !== 1 ? 's' : ''} and ${schedule.length} total substitution${schedule.length !== 1 ? 's' : ''} across the entire match duration.`
            ) : (
              'No schedule generated'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-4 sm:px-6">
          <ScrollArea className="h-full">
            {schedule.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No substitutions scheduled</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Generate a schedule to see planned substitutions here
                </p>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {/* Even Distribution Info */}
                {windowStats.numWindows > 0 && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-2 mb-3">
                        <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm sm:text-base mb-1">Even Distribution Across Entire Match</h3>
                          <p className="text-xs text-muted-foreground">
                            Substitutions scheduled at perfectly equal intervals from kickoff to final whistle
                          </p>
                        </div>
                      </div>

                      <div className="mb-3 p-2 rounded-md bg-background/50 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total match time:</span>
                          <span className="font-semibold text-primary">{timePerHalf * 2} minutes</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Substitution rounds:</span>
                          <span className="font-semibold text-primary">{windowStats.numWindows}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Average interval:</span>
                          <span className="font-semibold text-primary">{windowStats.avgInterval.toFixed(2)} min</span>
                        </div>
                        {windowStats.intervals.length > 0 && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Interval range:</span>
                              <span className="font-semibold">{windowStats.minInterval.toFixed(2)} - {windowStats.maxInterval.toFixed(2)} min</span>
                            </div>
                            <div className="pt-2 border-t border-border/50">
                              <span className="text-muted-foreground block mb-1">Time gaps between rounds:</span>
                              <div className="flex flex-wrap gap-1">
                                {windowStats.intervals.map((interval, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {interval.toFixed(2)} min
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Playing Time Summary */}
                {playerSummary.length > 0 && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-2 mb-3">
                        <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm sm:text-base mb-1">Playing Time Distribution</h3>
                          <p className="text-xs text-muted-foreground">
                            Optimized for equal playing time across all players
                          </p>
                        </div>
                      </div>

                      {/* Informational note for players with zero time */}
                      {stats.playersWithZeroTime > 0 && (
                        <div className="mb-3 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-1">
                                Note: {stats.playersWithZeroTime} player{stats.playersWithZeroTime !== 1 ? 's' : ''} with limited playing time
                              </p>
                              <p className="text-xs text-yellow-700/90 dark:text-yellow-400/90 mb-2">
                                Some players may not receive playing time in this schedule due to position constraints or substitution limits.
                              </p>
                              <div className="text-xs text-yellow-700/80 dark:text-yellow-400/80 space-y-1 pl-3 border-l-2 border-yellow-500/30">
                                <p className="font-semibold">To improve distribution:</p>
                                <p>• Increase max simultaneous substitutions setting</p>
                                <p>• Adjust position eligibility for bench players</p>
                                <p>• Use a faster speed mode for more substitution windows</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tolerance warning (only if no zero-time players) */}
                      {stats.playersOutsideTolerance > 0 && stats.playersWithZeroTime === 0 && (
                        <div className="mb-3 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                                {stats.playersOutsideTolerance} player{stats.playersOutsideTolerance !== 1 ? 's' : ''} outside 10% tolerance
                              </p>
                              <p className="text-xs text-yellow-700/80 dark:text-yellow-400/80 mt-1">
                                With {windowStats.numWindows} substitution round{windowStats.numWindows !== 1 ? 's' : ''}, some deviation may occur due to position constraints and timing.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Success message when all players are included and within tolerance */}
                      {stats.playersWithZeroTime === 0 && stats.playersOutsideTolerance === 0 && (
                        <div className="mb-3 p-2 rounded-md bg-green-500/10 border border-green-500/20">
                          <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                                Perfect distribution achieved with {windowStats.numWindows} round{windowStats.numWindows !== 1 ? 's' : ''}!
                              </p>
                              <p className="text-xs text-green-700/80 dark:text-green-400/80 mt-1">
                                All players are receiving playing time within 10% of the target through optimized substitutions.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Statistics Summary */}
                      <div className="mb-3 p-2 rounded-md bg-background/50 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Substitution rounds:</span>
                          <span className="font-semibold text-primary">{windowStats.numWindows}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">First half substitutions:</span>
                          <span className="font-semibold text-primary">{subsPerHalf.firstHalf}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Second half substitutions:</span>
                          <span className="font-semibold text-primary">{subsPerHalf.secondHalf}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total substitutions:</span>
                          <span className="font-semibold text-primary">{schedule.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Target time per player:</span>
                          <span className="font-semibold text-primary">{targetMinutesPerPlayer.toFixed(1)} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">10% tolerance range:</span>
                          <span className="font-semibold">{(targetMinutesPerPlayer * 0.9).toFixed(1)} - {(targetMinutesPerPlayer * 1.1).toFixed(1)} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Players within tolerance:</span>
                          <span className={`font-semibold ${stats.playersWithinTolerance === stats.totalPlayers ? 'text-green-600 dark:text-green-400' : ''}`}>
                            {stats.playersWithinTolerance}/{stats.totalPlayers}
                          </span>
                        </div>
                        {stats.playersWithZeroTime > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Players with limited time:</span>
                            <span className="font-semibold text-yellow-600 dark:text-yellow-400">{stats.playersWithZeroTime}/{stats.totalPlayers}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Average allocated time:</span>
                          <span className="font-semibold">{formatMinutes(stats.avgTime)} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Time range:</span>
                          <span className="font-semibold">{formatMinutes(stats.minTime)} - {formatMinutes(stats.maxTime)} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Time spread:</span>
                          <span className="font-semibold">{formatMinutes(stats.timeSpread)} min</span>
                        </div>
                      </div>

                      {/* Player Time Details */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground mb-2">Individual Player Times:</div>
                        <div className="grid grid-cols-1 gap-2">
                          {playerSummary.map((player) => {
                            const diffMinutes = player.difference / 60;
                            const hasZeroTime = player.time === 0;
                            const toleranceColor = getToleranceColor(player.percentDiff, hasZeroTime);
                            const bgColor = getToleranceBgColor(player.withinTolerance, hasZeroTime);
                            
                            return (
                              <div 
                                key={player.id}
                                className={`flex flex-col gap-2 p-2 rounded-md border ${bgColor}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Badge 
                                      variant="secondary" 
                                      className={`text-xs flex-shrink-0 ${getRoleColor(player.role)}`}
                                    >
                                      {getRoleLabel(player.role)}
                                    </Badge>
                                    <span className="text-sm font-medium truncate">{player.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                    {hasZeroTime && (
                                      <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
                                        ℹ️
                                      </Badge>
                                    )}
                                    {!hasZeroTime && player.withinTolerance && (
                                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                                        ✓
                                      </Badge>
                                    )}
                                    {!hasZeroTime && !player.withinTolerance && (
                                      <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                                        ✗
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Clock className="w-3 h-3" />
                                      <span>On-field</span>
                                    </div>
                                    <div className={`font-semibold ${
                                      hasZeroTime ? 'text-yellow-600 dark:text-yellow-400' : 'text-primary'
                                    }`}>
                                      {formatMinutes(player.time)} min
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Timer className="w-3 h-3" />
                                      <span>Off-field</span>
                                    </div>
                                    <div className="font-semibold text-orange-600 dark:text-orange-400">
                                      {formatMinutes(player.offTime)} min
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <TrendingDown className="w-3 h-3" />
                                      <span>Benched</span>
                                    </div>
                                    <div className="font-semibold text-blue-600 dark:text-blue-400">
                                      {player.benchEvents}×
                                    </div>
                                  </div>
                                </div>
                                
                                <div className={`text-xs font-medium text-center ${toleranceColor}`}>
                                  {diffMinutes >= 0 ? '+' : ''}{diffMinutes.toFixed(1)} min ({player.percentDiff >= 0 ? '+' : ''}{player.percentDiff.toFixed(1)}%) from target
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Substitution Timeline */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm sm:text-base">Substitution Timeline ({windowStats.numWindows} round{windowStats.numWindows !== 1 ? 's' : ''})</h3>
                  {schedule.map((sub, index) => (
                    <Card 
                      key={index} 
                      className={`${sub.executed ? 'opacity-50 bg-muted/50' : 'border-primary/20'}`}
                    >
                      <CardContent className="p-3 sm:p-4">
                        {/* Mobile Layout: Stacked */}
                        <div className="flex flex-col space-y-3">
                          {/* Time and Status Row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-mono font-semibold text-base sm:text-lg">
                                {formatTime(sub.time)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {getHalfLabel(sub.time)}
                              </Badge>
                            </div>
                            <div>
                              {sub.executed ? (
                                <Badge variant="secondary" className="text-xs">
                                  Done
                                </Badge>
                              ) : (
                                <Badge variant="default" className="text-xs">
                                  Pending
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Players Row */}
                          <div className="flex items-center gap-2 sm:gap-3">
                            {/* Player Off */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2">
                                <User className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="font-medium text-sm sm:text-base truncate">
                                    {sub.fieldPlayer.name}
                                  </span>
                                  <Badge 
                                    variant="secondary" 
                                    className={`text-xs w-fit mt-1 ${getRoleColor(sub.fieldPlayer.role)}`}
                                  >
                                    {getRoleLabel(sub.fieldPlayer.role)}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            {/* Arrow */}
                            <div className="flex-shrink-0">
                              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                            </div>

                            {/* Player On */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2">
                                <User className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="font-medium text-sm sm:text-base truncate">
                                    {sub.benchPlayer.name}
                                  </span>
                                  <Badge 
                                    variant="secondary" 
                                    className={`text-xs w-fit mt-1 ${getRoleColor(sub.benchPlayer.role)}`}
                                  >
                                    {getRoleLabel(sub.benchPlayer.role)}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex-shrink-0 px-4 pb-4 sm:px-6 sm:pb-6 pt-3 border-t bg-background">
          <div className="flex flex-col gap-3">
            {/* Clear Schedule Button - ALWAYS visible at bottom regardless of schedule state */}
            {onClearSchedule && (
              <Button 
                onClick={handleClearSchedule} 
                variant="destructive" 
                size="lg"
                className="w-full font-semibold shadow-md hover:shadow-lg transition-shadow"
                disabled={isClearingSchedule}
              >
                {isClearingSchedule ? (
                  <>
                    <span className="mr-2">Clearing Schedule...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 mr-2" />
                    Clear Schedule
                  </>
                )}
              </Button>
            )}
            
            {/* Close Button */}
            <Button 
              onClick={onClose} 
              variant="outline" 
              size="lg"
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
