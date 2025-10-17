import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Info, CalendarClock, ArrowRightLeft, ArrowDown, ArrowUp, User, Scale, TrendingDown, Timer, Star, BarChart3 } from 'lucide-react';
import { useMemo } from 'react';
import { analyzeAllCombinations, calculateSubstitutionSchedule, calculateOptimalRotation, calculateProjectedGameTime, applyPlayingTimeBalancing, formatTime, getHalfLabel, getTimeWithinHalf, SubstitutionEvent, CombinationAnalysis } from '../lib/substitutionScheduleCalculator';

interface SubstitutionTimingPreviewProps {
  timePerHalf: number;
  minRounds: number;
  maxSubsPerRound: number;
  onFieldPlayers?: number;
  totalPlayers?: number;
  fieldPlayerIds?: string[];
  benchPlayerIds?: string[];
  playerNames?: Record<string, string>;
}

export default function SubstitutionTimingPreview({
  timePerHalf,
  minRounds,
  maxSubsPerRound,
  onFieldPlayers,
  totalPlayers,
  fieldPlayerIds = [],
  benchPlayerIds = [],
  playerNames = {},
}: SubstitutionTimingPreviewProps) {
  const timingDetails = useMemo(() => {
    const totalMatchTime = timePerHalf * 2;
    const calculatedTotalPlayers = totalPlayers || ((onFieldPlayers || 0) + benchPlayerIds.length);
    
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  SUBSTITUTION TIMING PREVIEW - MULTI-COMBINATION ANALYSIS     ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('🎯 PREVIEW COMPONENT: Starting multi-combination analysis');
    console.log('');
    
    // Analyze all combinations if we have player data
    let multiCombinationResult: ReturnType<typeof analyzeAllCombinations> | null = null;
    
    if (fieldPlayerIds.length > 0 && benchPlayerIds.length > 0) {
      multiCombinationResult = analyzeAllCombinations(
        fieldPlayerIds,
        benchPlayerIds,
        totalMatchTime,
        playerNames
      );
      
      console.log('✅ MULTI-COMBINATION ANALYSIS COMPLETE');
      console.log(`   Total combinations analyzed: ${multiCombinationResult.allCombinations.length}`);
      console.log(`   Recommended: ${multiCombinationResult.recommendedCombination.numSubs} simultaneous sub(s)`);
      console.log('');
    }
    
    // Use recommended combination for display
    const recommendedNumSubs = multiCombinationResult?.recommendedCombination.numSubs || maxSubsPerRound;
    
    const scheduleResult = calculateSubstitutionSchedule({
      totalPlayers: calculatedTotalPlayers,
      onFieldPlayers: onFieldPlayers || minRounds * recommendedNumSubs,
      gameMinutes: totalMatchTime,
      maxSimultaneousSubs: recommendedNumSubs,
    });
    
    console.log('✅ PREVIEW COMPONENT: Received timing data from shared calculator');
    console.log(`   Rounds: ${scheduleResult.minRounds}`);
    console.log(`   Interval: ${scheduleResult.interval.toFixed(4)} minutes`);
    console.log('');
    
    // Calculate rotation for recommended combination
    let rotationEvents: SubstitutionEvent[] | null = null;
    let projectedGameTime: ReturnType<typeof calculateProjectedGameTime> | null = null;
    let hasBalancingRound = false;
    
    if (multiCombinationResult) {
      rotationEvents = multiCombinationResult.recommendedCombination.rotationEvents;
      projectedGameTime = multiCombinationResult.recommendedCombination.projectedGameTime;
      
      // Apply balancing
      const balancingResult = applyPlayingTimeBalancing(
        rotationEvents,
        projectedGameTime,
        totalMatchTime,
        scheduleResult.interval,
        recommendedNumSubs,
        playerNames
      );
      
      rotationEvents = balancingResult.events;
      projectedGameTime = balancingResult.projectedGameTime;
      hasBalancingRound = balancingResult.hasBalancingRound;
    }
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    
    return {
      totalMatchTime,
      interval: scheduleResult.interval,
      substitutionTimes: scheduleResult.substitutionTimes,
      rotationEvents,
      projectedGameTime,
      hasBalancingRound,
      recommendedNumSubs,
      multiCombinationResult,
    };
  }, [timePerHalf, minRounds, maxSubsPerRound, onFieldPlayers, totalPlayers, fieldPlayerIds, benchPlayerIds, playerNames]);

  // Group rotation events by round
  const eventsByRound = useMemo(() => {
    if (!timingDetails.rotationEvents) return {};
    
    const grouped: Record<number, SubstitutionEvent[]> = {};
    timingDetails.rotationEvents.forEach(event => {
      if (!grouped[event.roundNumber]) {
        grouped[event.roundNumber] = [];
      }
      grouped[event.roundNumber].push(event);
    });
    
    return grouped;
  }, [timingDetails.rotationEvents]);

  // Calculate target minutes per player
  const targetMinutesPerPlayer = useMemo(() => {
    if (!onFieldPlayers || fieldPlayerIds.length === 0) return 0;
    const calculatedTotalPlayers = totalPlayers || (fieldPlayerIds.length + benchPlayerIds.length);
    if (calculatedTotalPlayers === 0) return 0;
    return (onFieldPlayers * timingDetails.totalMatchTime) / calculatedTotalPlayers;
  }, [onFieldPlayers, totalPlayers, fieldPlayerIds.length, benchPlayerIds.length, timingDetails.totalMatchTime]);

  const calculatedTotalPlayers = totalPlayers || ((onFieldPlayers || 0) + benchPlayerIds.length);
  const actualMinRounds = Math.ceil(calculatedTotalPlayers / (timingDetails.recommendedNumSubs || maxSubsPerRound));

  return (
    <Card className="border-primary/20 bg-primary/5 mt-3">
      <CardContent className="p-3">
        <div className="flex items-start gap-2 mb-3">
          <Clock className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">Substitution Timing Preview (Advanced Optimal Analysis)</h3>
            <p className="text-xs text-muted-foreground">
              Analyzing all valid combinations of simultaneous substitutions to find the optimal strategy that minimizes playing time variance
            </p>
          </div>
        </div>

        {/* Multi-Combination Analysis Results */}
        {timingDetails.multiCombinationResult && (
          <div className="mb-3">
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-3">
                <div className="flex items-start gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm mb-1 text-blue-700 dark:text-blue-400">
                      Combination Analysis Results
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Analyzed {timingDetails.multiCombinationResult.allCombinations.length} different combinations of simultaneous substitutions
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {timingDetails.multiCombinationResult.allCombinations.map((combination) => {
                    const range = combination.maxMinutes - combination.minMinutes;
                    
                    return (
                      <div 
                        key={combination.numSubs}
                        className={`flex flex-col gap-1.5 p-2 rounded-md border ${
                          combination.isRecommended
                            ? 'bg-emerald-500/10 border-emerald-500/30 ring-2 ring-emerald-500/20'
                            : 'bg-background/50 border-border/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {combination.isRecommended && (
                              <Star className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-emerald-600 dark:fill-emerald-400" />
                            )}
                            <span className={`text-xs font-medium ${
                              combination.isRecommended
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-foreground'
                            }`}>
                              {combination.numSubs} simultaneous sub{combination.numSubs !== 1 ? 's' : ''}
                            </span>
                            {combination.isRecommended && (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                                Recommended
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div>
                            <div className="text-muted-foreground">Variance</div>
                            <div className={`font-semibold ${
                              combination.isRecommended
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-foreground'
                            }`}>
                              {combination.variance.toFixed(2)}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-muted-foreground">Range</div>
                            <div className={`font-semibold ${
                              combination.isRecommended
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-foreground'
                            }`}>
                              {range.toFixed(1)} min
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-muted-foreground">Min-Max</div>
                            <div className={`font-semibold ${
                              combination.isRecommended
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-foreground'
                            }`}>
                              {combination.minMinutes.toFixed(0)}-{combination.maxMinutes.toFixed(0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 p-2 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-2">
                    <Info className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-blue-700 dark:text-blue-400">
                      The recommended combination produces the smallest variance in playing time, ensuring the most even distribution across all players.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Prominent Rounds Summary */}
        <div className="mb-3 p-3 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/30">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <CalendarClock className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-primary mb-0.5">
                {actualMinRounds} Round{actualMinRounds !== 1 ? 's' : ''} Needed
              </div>
              <div className="text-xs text-muted-foreground">
                {calculatedTotalPlayers > 0 && (
                  <>
                    Based on {calculatedTotalPlayers} total player{calculatedTotalPlayers !== 1 ? 's' : ''} with {timingDetails.recommendedNumSubs || maxSubsPerRound} simultaneous sub{(timingDetails.recommendedNumSubs || maxSubsPerRound) !== 1 ? 's' : ''}
                    {timingDetails.multiCombinationResult && ' (optimal)'}
                  </>
                )}
                {calculatedTotalPlayers === 0 && (
                  <>
                    With {timingDetails.recommendedNumSubs || maxSubsPerRound} simultaneous sub{(timingDetails.recommendedNumSubs || maxSubsPerRound) !== 1 ? 's' : ''} per round
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-3 p-2 rounded-md bg-background/50 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total match time:</span>
            <span className="font-semibold text-primary">{timingDetails.totalMatchTime} minutes</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Substitution rounds:</span>
            <span className="font-semibold text-primary">{actualMinRounds}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Interval between rounds:</span>
            <span className="font-semibold text-primary">{timingDetails.interval.toFixed(2)} min</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Recommended subs per round:</span>
            <span className="font-semibold text-primary">
              {timingDetails.recommendedNumSubs || maxSubsPerRound}
              {timingDetails.multiCombinationResult && ' (optimal)'}
            </span>
          </div>
        </div>

        {/* Balancing Round Indicator */}
        {timingDetails.hasBalancingRound && (
          <div className="mb-3 p-2 rounded-md bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-start gap-2">
              <Scale className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1">
                  ⚖️ Automatic Balancing Applied
                </p>
                <p className="text-xs text-purple-700/90 dark:text-purple-400/90">
                  An extra balancing round has been added near the end of the match to ensure all players are within ±5% of target playing time.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Projected Game Time Summary */}
        {timingDetails.projectedGameTime && timingDetails.projectedGameTime.length > 0 && (
          <div className="mb-3">
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-3">
                <div className="flex items-start gap-2 mb-2">
                  <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm mb-1 text-emerald-700 dark:text-emerald-400">
                      Projected Game Time Per Player (Optimal Strategy)
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Expected playing time with recommended {timingDetails.recommendedNumSubs} simultaneous substitution{timingDetails.recommendedNumSubs !== 1 ? 's' : ''} strategy
                    </p>
                  </div>
                </div>

                {targetMinutesPerPlayer > 0 && (
                  <div className="mb-2 p-2 rounded-md bg-background/50 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Target per player:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {targetMinutesPerPlayer.toFixed(1)} min
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  {timingDetails.projectedGameTime.map((player) => {
                    const deviation = targetMinutesPerPlayer > 0 
                      ? ((player.totalMinutes - targetMinutesPerPlayer) / targetMinutesPerPlayer) * 100 
                      : 0;
                    const isWithinTolerance = Math.abs(deviation) <= 5;
                    
                    return (
                      <div 
                        key={player.playerId}
                        className={`flex flex-col gap-1.5 p-2 rounded-md border ${
                          player.totalMinutes === 0 
                            ? 'bg-yellow-500/10 border-yellow-500/20'
                            : isWithinTolerance 
                              ? 'bg-green-500/10 border-green-500/20' 
                              : 'bg-orange-500/10 border-orange-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-xs font-medium truncate">
                              {player.playerName}
                            </span>
                            {player.isStartingOnField && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-primary/10">
                                Starting
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                            {player.totalMinutes === 0 && (
                              <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
                                ⚠️
                              </Badge>
                            )}
                            {player.totalMinutes > 0 && isWithinTolerance && (
                              <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                                ✓
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <div>
                              <div className={`font-semibold ${
                                player.totalMinutes === 0 
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {player.totalMinutes.toFixed(1)} min
                              </div>
                              <div className="text-muted-foreground">On-field</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Timer className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                            <div>
                              <div className="font-semibold text-orange-600 dark:text-orange-400">
                                {player.totalOffFieldTime.toFixed(1)} min
                              </div>
                              <div className="text-muted-foreground">Off-field</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            <div>
                              <div className="font-semibold text-blue-600 dark:text-blue-400">
                                {player.benchEventCount}×
                              </div>
                              <div className="text-muted-foreground">Benched</div>
                            </div>
                          </div>
                        </div>
                        
                        {targetMinutesPerPlayer > 0 && player.totalMinutes > 0 && (
                          <div className={`text-[10px] text-center ${
                            isWithinTolerance 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-orange-600 dark:text-orange-400'
                          }`}>
                            {deviation >= 0 ? '+' : ''}{deviation.toFixed(1)}% from target
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 p-2 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-2">
                    <Info className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-blue-700 dark:text-blue-400">
                      These projections use the recommended optimal strategy that minimizes variance in playing time across all players.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground mb-2">
            Planned Substitution Times (Optimal Strategy):
          </div>
          <div className="space-y-2">
            {timingDetails.substitutionTimes.map((time, index) => {
              const halfLabel = getHalfLabel(time, timePerHalf);
              const halfTime = getTimeWithinHalf(time, timePerHalf);
              const roundNumber = index + 1;
              const roundEvents = eventsByRound[roundNumber] || [];
              const isBalancingRound = roundEvents.some(e => e.isBalancingRound);
              
              return (
                <div 
                  key={index}
                  className={`rounded-md border overflow-hidden ${
                    isBalancingRound 
                      ? 'bg-purple-500/5 border-purple-500/30' 
                      : 'bg-background/70 border-border/50'
                  }`}
                >
                  {/* Round Header */}
                  <div className={`flex items-center justify-between p-2 ${
                    isBalancingRound ? 'bg-purple-500/10' : 'bg-primary/5'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs font-mono ${
                        isBalancingRound ? 'bg-purple-500/20 border-purple-500/30' : ''
                      }`}>
                        Round {roundNumber}
                      </Badge>
                      {isBalancingRound && (
                        <Badge variant="outline" className="text-xs bg-purple-500/20 border-purple-500/30 text-purple-700 dark:text-purple-400">
                          <Scale className="w-3 h-3 mr-1" />
                          Balancing
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {halfLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold font-mono">
                        {formatTime(time)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({halfTime.toFixed(1)}' into half)
                      </span>
                    </div>
                  </div>
                  
                  {/* Player Substitutions */}
                  {roundEvents.length > 0 && (
                    <div className="p-2 space-y-1.5 bg-background/30">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Substitutions (Optimal):</span>
                      </div>
                      {roundEvents.map((event, eventIdx) => {
                        const fieldPlayerName = playerNames[event.fieldPlayerId] || event.fieldPlayerId;
                        const benchPlayerName = playerNames[event.benchPlayerId] || event.benchPlayerId;
                        
                        return (
                          <div 
                            key={eventIdx}
                            className="flex items-center gap-2 p-1.5 rounded bg-background/50 border border-border/30"
                          >
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              {eventIdx + 1}
                            </Badge>
                            <div className="flex-1 flex items-center gap-2 text-xs">
                              <div className="flex items-center gap-1.5 flex-1">
                                <ArrowDown className="w-3 h-3 text-red-500" />
                                <span className="font-medium text-red-600 dark:text-red-400">
                                  {fieldPlayerName}
                                </span>
                                <span className="text-muted-foreground text-[10px]">OFF</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-1">
                                <ArrowUp className="w-3 h-3 text-green-500" />
                                <span className="font-medium text-green-600 dark:text-green-400">
                                  {benchPlayerName}
                                </span>
                                <span className="text-muted-foreground text-[10px]">ON</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* No player data available */}
                  {roundEvents.length === 0 && fieldPlayerIds.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground italic bg-background/30">
                      Player names will be displayed when lineup is configured
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 p-2 rounded-md bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                <strong>Advanced Optimal Analysis:</strong> The system analyzed all valid combinations of simultaneous substitutions (from 1 up to {benchPlayerIds.length}) and selected the strategy that produces the smallest variance in playing time.
              </p>
              <p className="text-xs text-blue-700/90 dark:text-blue-400/90 mt-1">
                This ensures the most even playing time distribution possible while respecting all constraints (quotas, cooldowns, position compatibility).
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
