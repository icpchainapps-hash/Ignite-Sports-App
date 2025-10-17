import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import SubstitutionTimingPreview from './SubstitutionTimingPreview';

interface MinSubRoundsDisplayProps {
  onFieldPlayers: number;
  benchPlayers: number;
  timePerHalf: number;
  maxSimultaneousSubs: number;
  fieldPlayerIds?: string[];
  benchPlayerIds?: string[];
  playerNames?: Record<string, string>;
}

export default function MinSubRoundsDisplay({
  onFieldPlayers,
  benchPlayers,
  timePerHalf,
  maxSimultaneousSubs,
  fieldPlayerIds = [],
  benchPlayerIds = [],
  playerNames = {},
}: MinSubRoundsDisplayProps) {
  const totalMatchTime = timePerHalf * 2;
  const totalPlayers = onFieldPlayers + benchPlayers;

  // Calculate minimum rounds based on TOTAL PLAYERS (field + bench)
  const minRounds = Math.ceil(totalPlayers / maxSimultaneousSubs);

  // Check feasibility
  const isFeasible = benchPlayers > 0 && onFieldPlayers > 0 && maxSimultaneousSubs > 0;

  // Calculate for different scenarios
  const scenarios = [1, 2, 3, 4, 5].map(maxSubs => ({
    maxSubs,
    rounds: Math.ceil(totalPlayers / maxSubs),
    isCurrent: maxSubs === maxSimultaneousSubs,
  }));

  return (
    <div className="space-y-3">
      <Card className={isFeasible ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'}>
        <CardContent className="p-3">
          <div className="flex items-start gap-2 mb-3">
            {isFeasible ? (
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">Minimum Substitution Rounds</h3>
              <p className="text-xs text-muted-foreground">
                {isFeasible
                  ? 'Based on your current lineup and settings'
                  : 'Cannot calculate - check your lineup configuration'}
              </p>
            </div>
          </div>

          {isFeasible ? (
            <>
              <div className="mb-3 p-2 rounded-md bg-background/50 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">On-field players:</span>
                  <span className="font-semibold">{onFieldPlayers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bench players:</span>
                  <span className="font-semibold">{benchPlayers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total players:</span>
                  <span className="font-semibold text-primary">{totalPlayers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total match time:</span>
                  <span className="font-semibold">{totalMatchTime} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current max subs/round:</span>
                  <span className="font-semibold text-primary">{maxSimultaneousSubs}</span>
                </div>
              </div>

              <div className="mb-3 p-3 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/30">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-1">
                    {minRounds}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Minimum rounds required
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  Rounds needed for different settings:
                </div>
                <div className="space-y-1">
                  {scenarios.map(scenario => (
                    <div
                      key={scenario.maxSubs}
                      className={`flex items-center justify-between p-2 rounded-md text-xs ${
                        scenario.isCurrent
                          ? 'bg-primary/20 border-2 border-primary/40 font-semibold'
                          : 'bg-background/50 border border-border/30'
                      }`}
                    >
                      <span className={scenario.isCurrent ? 'text-primary' : 'text-muted-foreground'}>
                        {scenario.maxSubs} sub{scenario.maxSubs !== 1 ? 's' : ''} at a time
                      </span>
                      <span className={scenario.isCurrent ? 'text-primary' : ''}>
                        {scenario.rounds} round{scenario.rounds !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 p-2 rounded-md bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    <strong>Formula:</strong> minRounds = ceil(totalPlayers / maxSubsPerRound)
                    <br />
                    <strong>Example:</strong> {totalPlayers} total players ÷ {maxSimultaneousSubs} max subs = ceil({(totalPlayers / maxSimultaneousSubs).toFixed(2)}) = {minRounds} rounds
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-xs text-destructive">
                {benchPlayers === 0 && 'No bench players available. Add players to the bench to enable substitutions.'}
                {onFieldPlayers === 0 && 'No field players configured. Add players to the field to enable substitutions.'}
                {maxSimultaneousSubs === 0 && 'Maximum simultaneous substitutions must be greater than 0.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {isFeasible && (
        <SubstitutionTimingPreview
          timePerHalf={timePerHalf}
          minRounds={minRounds}
          maxSubsPerRound={maxSimultaneousSubs}
          onFieldPlayers={onFieldPlayers}
          totalPlayers={totalPlayers}
          fieldPlayerIds={fieldPlayerIds}
          benchPlayerIds={benchPlayerIds}
          playerNames={playerNames}
        />
      )}
    </div>
  );
}
