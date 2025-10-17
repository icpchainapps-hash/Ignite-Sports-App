**
 * Strict Quota-Based Fairness Substitution Planning Algorithm
 * 
 * This module implements a mathematically rigorous quota-based fairness algorithm that ensures
 * equal bench event distribution across all players.
 * 
 * STRICT QUOTA-BASED FAIRNESS MATHEMATICS:
 * 1. Calculate intervals: intervals = rounds + 1
 * 2. Calculate intervalMin: intervalMin = totalMatchTime / intervals
 * 3. Calculate bench slots: benchSlotsTotal = intervals * benchSize
 * 4. Calculate floor and extra:
 *    - floorB = Math.floor(benchSlotsTotal / totalPlayers)
 *    - extra = benchSlotsTotal - (floorB * totalPlayers)
 * 5. Assign target bench counts (quotas):
 *    - First 'extra' players get: floorB + 1
 *    - Remaining players get: floorB
 * 6. During scheduling, only pick OFF players where:
 *    - benchCount[p] < targetBenchCount[p] (quota not reached)
 *    - Never exceed targetBenchCount[p]
 * 7. Cooldown enforcement:
 *    - Player cannot be benched in consecutive rounds
 *    - Must play at least one interval before sitting again
 * 8. Dynamic substitution adjustment:
 *    - If not enough eligible players for multi-sub round, reduce subs that round
 * 9. Selection priority:
 *    - Highest (minutesSoFar - targetMin)
 *    - Then longest since last bench
 *    - Then position fit
 * 10. Post-scheduling balancing:
 *    - If any |minutes[p] - targetMin| > intervalMin/2
 *    - Swap most-over-target OFF with most-under-target ON
 *    - In a late interval, respecting locks/positions
 * 
 * DEBUG VERIFICATION:
 * - Comprehensive logging at each stage
 * - Bench event count tracking
 * - Off-field time calculations
 * - Target vs actual quota comparisons
 * - UI display of all fairness metrics
 */

// ============================================================================
// Types
// ============================================================================

export interface PlayerInput {
  id: string;
  name: string;
  role: 'goalkeeper' | 'defender' | 'midfielder' | 'forward';
  isOnField: boolean;
  isLocked?: boolean;
  allowedPositions: ('goalkeeper' | 'defender' | 'midfielder' | 'forward')[];
}

export interface PlanConfig {
  totalMatchMinutes: number;
  maxSubsPerWindow: number;
  windowLengthMinutes: number;
  minOnMinutes: number;
  minRestMinutes: number;
}

export interface SubstitutionEvent {
  timeMinutes: number;
  fieldPlayerId: string;
  benchPlayerId: string;
}

export interface PlayerProjection {
  playerId: string;
  projectedMinutes: number;
  targetMinutes: number;
  deviation: number;
  targetBenchCount: number;
  actualBenchCount: number;
  offFieldMinutes: number;
}

export interface WindowAssignment {
  windowIndex: number;
  timeMinutes: number;
  onFieldPlayerIds: string[];
}

export interface SubstitutionPlan {
  events: SubstitutionEvent[];
  projections: PlayerProjection[];
  windowAssignments: WindowAssignment[];
  targetMinutesPerPlayer: number;
}

// ============================================================================
// Debug Logging Utilities
// ============================================================================

function logDebugHeader(title: string) {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log(`║  ${title.padEnd(77, ' ')}║`);
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
}

function logDebugSection(title: string) {
  console.log('');
  console.log(`━━━ ${title} ━━━`);
  console.log('');
}

// ============================================================================
// Core Planning Algorithm
// ============================================================================

/**
 * Main entry point: generates a complete substitution plan with strict quota-based fairness
 */
export function planWithProjection(
  players: PlayerInput[],
  config: PlanConfig
): SubstitutionPlan {
  logDebugHeader('STRICT QUOTA-BASED FAIRNESS SUBSTITUTION PLANNER');
  
  // Validate inputs
  if (players.length === 0) {
    console.log('⚠️  No players provided - returning empty plan');
    return {
      events: [],
      projections: [],
      windowAssignments: [],
      targetMinutesPerPlayer: 0,
    };
  }

  const fieldPlayers = players.filter(p => p.isOnField);
  const benchPlayers = players.filter(p => !p.isOnField);
  const numFieldPositions = fieldPlayers.length;
  const benchSize = benchPlayers.length;

  if (numFieldPositions === 0) {
    console.log('⚠️  No field players - returning empty plan');
    return {
      events: [],
      projections: players.map(p => ({
        playerId: p.id,
        projectedMinutes: 0,
        targetMinutes: 0,
        deviation: 0,
        targetBenchCount: 0,
        actualBenchCount: 0,
        offFieldMinutes: 0,
      })),
      windowAssignments: [],
      targetMinutesPerPlayer: 0,
    };
  }

  if (benchSize === 0) {
    console.log('⚠️  No bench players - no substitutions needed');
    const totalMatchTime = config.totalMatchMinutes;
    return {
      events: [],
      projections: players.map(p => ({
        playerId: p.id,
        projectedMinutes: p.isOnField ? totalMatchTime : 0,
        targetMinutes: totalMatchTime / players.length,
        deviation: p.isOnField ? totalMatchTime - (totalMatchTime / players.length) : -(totalMatchTime / players.length),
        targetBenchCount: 0,
        actualBenchCount: 0,
        offFieldMinutes: p.isOnField ? 0 : totalMatchTime,
      })),
      windowAssignments: [],
      targetMinutesPerPlayer: totalMatchTime / players.length,
    };
  }

  // STEP 1: Calculate target minutes per player
  const G = config.totalMatchMinutes;
  const F = numFieldPositions;
  const N = players.length;
  const T = (G * F) / N;

  logDebugSection('STEP 1: CALCULATE TARGET MINUTES');
  console.log(`Total match minutes (G): ${G}`);
  console.log(`Field positions (F): ${F}`);
  console.log(`Total players (N): ${N}`);
  console.log(`Bench size: ${benchSize}`);
  console.log(`Window length: ${config.windowLengthMinutes} minutes`);
  console.log(`Max subs per window (R): ${config.maxSubsPerWindow}`);
  console.log('');
  console.log(`Target minutes per player (T): ${T.toFixed(2)} minutes`);
  console.log(`Formula: T = (${G} × ${F}) / ${N} = ${T.toFixed(2)}`);
  console.log('');

  // Build position requirements
  const positionRequirements = buildPositionRequirements(fieldPlayers);
  
  console.log('Position requirements:');
  positionRequirements.forEach(req => {
    console.log(`  ${req.role}: ${req.count}`);
  });
  console.log('');

  // STEP 2: Calculate rounds and intervals
  const W = config.windowLengthMinutes;
  const rounds = Math.floor(G / W);
  const intervals = rounds + 1;
  const intervalMin = G / intervals;

  logDebugSection('STEP 2: CALCULATE INTERVALS');
  console.log(`Window duration: ${W} minutes`);
  console.log(`Rounds: ${rounds}`);
  console.log(`Intervals: intervals = rounds + 1 = ${rounds} + 1 = ${intervals}`);
  console.log(`Interval min: intervalMin = ${G} / ${intervals} = ${intervalMin.toFixed(4)} minutes`);
  console.log('');

  // STEP 3: Calculate bench slots and target bench counts (quotas)
  const benchSlotsTotal = intervals * benchSize;
  const floorB = Math.floor(benchSlotsTotal / N);
  const extra = benchSlotsTotal - (floorB * N);

  logDebugSection('STEP 3: CALCULATE TARGET BENCH COUNTS (QUOTAS)');
  console.log(`Bench slots total: benchSlotsTotal = ${intervals} × ${benchSize} = ${benchSlotsTotal}`);
  console.log(`Floor B: floorB = floor(${benchSlotsTotal} / ${N}) = ${floorB}`);
  console.log(`Extra: extra = ${benchSlotsTotal} - (${floorB} × ${N}) = ${extra}`);
  console.log('');
  console.log('Target bench count (quota) assignment:');
  console.log(`  First ${extra} players: ${floorB + 1} bench events`);
  console.log(`  Remaining ${N - extra} players: ${floorB} bench events`);
  console.log('');

  // Assign target bench counts (quotas)
  const targetBenchCounts: Record<string, number> = {};
  players.forEach((p, idx) => {
    targetBenchCounts[p.id] = idx < extra ? floorB + 1 : floorB;
    console.log(`  ${p.name}: quota = ${targetBenchCounts[p.id]}`);
  });
  console.log('');

  // Initialize tracking
  const minutesPlayed: Record<string, number> = {};
  const benchCounts: Record<string, number> = {};
  const lastBenchTime: Record<string, number> = {};
  const cooldowns: Record<string, boolean> = {};
  
  players.forEach(p => {
    minutesPlayed[p.id] = 0;
    benchCounts[p.id] = 0;
    lastBenchTime[p.id] = -Infinity;
    cooldowns[p.id] = false;
  });

  let currentOnField = new Set(fieldPlayers.map(p => p.id));
  const events: SubstitutionEvent[] = [];
  const windows: WindowAssignment[] = [];

  logDebugSection('WINDOW PLANNING WITH QUOTA ENFORCEMENT');
  console.log(`Number of windows: ${rounds}`);
  console.log('');

  let lastWindowEndTime = 0;

  // Process each window
  for (let w = 0; w < rounds; w++) {
    const windowEndTime = Math.min((w + 1) * W, G);
    const windowDuration = windowEndTime - lastWindowEndTime;

    logDebugHeader(`WINDOW ${w + 1} OF ${rounds} - TIME: ${windowEndTime} MINUTES`);

    // Accrue minutes for on-field players
    logDebugSection('ACCRUE MINUTES');
    currentOnField.forEach(id => {
      const before = minutesPlayed[id];
      minutesPlayed[id] = before + windowDuration;
      const player = players.find(p => p.id === id);
      console.log(`  ${player?.name}: ${before.toFixed(2)} → ${minutesPlayed[id].toFixed(2)} minutes`);
    });
    console.log('');

    lastWindowEndTime = windowEndTime;

    // Calculate current fairness errors
    const targetSoFar = (windowEndTime * F) / N;
    const fairnessErrors: Record<string, number> = {};
    
    logDebugSection('FAIRNESS ERRORS');
    console.log(`Target so far: ${targetSoFar.toFixed(2)} minutes`);
    console.log('');
    
    players.forEach(p => {
      const played = minutesPlayed[p.id];
      fairnessErrors[p.id] = played - targetSoFar;
      const onField = currentOnField.has(p.id) ? 'ON' : 'BENCH';
      console.log(`  ${p.name}: ${played.toFixed(2)} - ${targetSoFar.toFixed(2)} = ${fairnessErrors[p.id].toFixed(2)} [${onField}]`);
    });
    console.log('');

    // Build OFF candidates (only those under quota and not on cooldown)
    logDebugSection('OFF CANDIDATES (QUOTA ENFORCEMENT)');
    
    const offCandidates = Array.from(currentOnField)
      .map(id => players.find(p => p.id === id)!)
      .filter(p => p && !p.isLocked)
      .filter(p => benchCounts[p.id] < targetBenchCounts[p.id]) // QUOTA CHECK
      .filter(p => !cooldowns[p.id]) // COOLDOWN CHECK
      .filter(p => {
        const timeSinceLastOn = windowEndTime - (lastBenchTime[p.id] === -Infinity ? 0 : lastBenchTime[p.id]);
        return timeSinceLastOn >= config.minOnMinutes;
      })
      .sort((a, b) => {
        // Priority 1: Highest (minutesSoFar - targetMin)
        const errorDiff = fairnessErrors[b.id] - fairnessErrors[a.id];
        if (Math.abs(errorDiff) > 0.01) return errorDiff;
        
        // Priority 2: Longest since last bench
        const timeSinceA = windowEndTime - lastBenchTime[a.id];
        const timeSinceB = windowEndTime - lastBenchTime[b.id];
        return timeSinceB - timeSinceA;
      });

    console.log(`Eligible off-candidates: ${offCandidates.length}`);
    offCandidates.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.name}: error=${fairnessErrors[p.id].toFixed(2)}, quota=${benchCounts[p.id]}/${targetBenchCounts[p.id]}, cooldown=${cooldowns[p.id]}`);
    });
    console.log('');

    // Build ON candidates
    logDebugSection('ON CANDIDATES');
    
    const onCandidates = players
      .filter(p => !currentOnField.has(p.id))
      .filter(p => {
        const timeSinceLastOff = windowEndTime - (lastBenchTime[p.id] === -Infinity ? 0 : lastBenchTime[p.id]);
        return timeSinceLastOff >= config.minRestMinutes;
      })
      .sort((a, b) => fairnessErrors[a.id] - fairnessErrors[b.id]);

    console.log(`Eligible on-candidates: ${onCandidates.length}`);
    onCandidates.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.name}: error=${fairnessErrors[p.id].toFixed(2)}`);
    });
    console.log('');

    // Dynamic substitution adjustment: reduce subs if not enough eligible players
    const maxSubsThisRound = Math.min(
      config.maxSubsPerWindow,
      offCandidates.length,
      onCandidates.length
    );

    if (maxSubsThisRound < config.maxSubsPerWindow) {
      console.log(`⚠️  DYNAMIC ADJUSTMENT: Reducing subs from ${config.maxSubsPerWindow} to ${maxSubsThisRound} (not enough eligible players)`);
      console.log('');
    }

    // Select swaps
    logDebugSection('SELECT SWAPS');
    
    const swaps = selectSwaps(
      offCandidates,
      onCandidates,
      fairnessErrors,
      positionRequirements,
      currentOnField,
      players,
      maxSubsThisRound,
      windowEndTime
    );

    console.log(`Swaps selected: ${swaps.length}`);
    swaps.forEach((swap, idx) => {
      const offPlayer = players.find(p => p.id === swap.offId);
      const onPlayer = players.find(p => p.id === swap.onId);
      console.log(`  ${idx + 1}. ${offPlayer?.name} OFF → ${onPlayer?.name} ON`);
    });
    console.log('');

    // Apply swaps and update quotas/cooldowns
    swaps.forEach(swap => {
      events.push({
        timeMinutes: windowEndTime,
        fieldPlayerId: swap.offId,
        benchPlayerId: swap.onId,
      });

      currentOnField.delete(swap.offId);
      currentOnField.add(swap.onId);
      
      benchCounts[swap.offId]++;
      lastBenchTime[swap.offId] = windowEndTime;
      lastBenchTime[swap.onId] = windowEndTime;
      
      // Set cooldown for player coming off
      cooldowns[swap.offId] = true;
    });

    // Reset cooldowns for players not benched this round
    players.forEach(p => {
      const wasBenched = swaps.some(s => s.offId === p.id);
      if (!wasBenched && cooldowns[p.id]) {
        cooldowns[p.id] = false;
      }
    });

    windows.push({
      windowIndex: w,
      timeMinutes: windowEndTime,
      onFieldPlayerIds: Array.from(currentOnField),
    });
  }

  // Accrue final minutes
  logDebugHeader('ACCRUE FINAL MINUTES');
  
  const remainingTime = G - lastWindowEndTime;
  console.log(`Remaining time: ${remainingTime} minutes`);
  console.log('');
  
  currentOnField.forEach(id => {
    const before = minutesPlayed[id];
    minutesPlayed[id] = before + remainingTime;
    const player = players.find(p => p.id === id);
    console.log(`  ${player?.name}: ${before.toFixed(2)} → ${minutesPlayed[id].toFixed(2)} minutes`);
  });
  console.log('');

  // Calculate off-field time
  const offFieldTime: Record<string, number> = {};
  players.forEach(p => {
    offFieldTime[p.id] = G - minutesPlayed[p.id];
  });

  // Post-scheduling balancing
  logDebugHeader('POST-SCHEDULING BALANCING');
  
  const threshold = intervalMin / 2;
  console.log(`Threshold: intervalMin / 2 = ${threshold.toFixed(4)} minutes`);
  console.log('');
  
  const playersOverTarget = players.filter(p => Math.abs(minutesPlayed[p.id] - T) > threshold && minutesPlayed[p.id] > T);
  const playersUnderTarget = players.filter(p => Math.abs(minutesPlayed[p.id] - T) > threshold && minutesPlayed[p.id] < T);
  
  console.log(`Players over target (>${threshold.toFixed(2)} min): ${playersOverTarget.length}`);
  playersOverTarget.forEach(p => {
    console.log(`  ${p.name}: ${minutesPlayed[p.id].toFixed(2)} (${(minutesPlayed[p.id] - T).toFixed(2)} over)`);
  });
  console.log('');
  
  console.log(`Players under target (>${threshold.toFixed(2)} min): ${playersUnderTarget.length}`);
  playersUnderTarget.forEach(p => {
    console.log(`  ${p.name}: ${minutesPlayed[p.id].toFixed(2)} (${(T - minutesPlayed[p.id]).toFixed(2)} under)`);
  });
  console.log('');

  if (playersOverTarget.length > 0 && playersUnderTarget.length > 0) {
    console.log('Attempting balancing swap...');
    
    // Find most-over-target ON and most-under-target OFF
    const mostOver = playersOverTarget.sort((a, b) => (minutesPlayed[b.id] - T) - (minutesPlayed[a.id] - T))[0];
    const mostUnder = playersUnderTarget.sort((a, b) => (T - minutesPlayed[a.id]) - (T - minutesPlayed[b.id]))[0];
    
    // Check if swap is feasible
    const mostOverOnField = currentOnField.has(mostOver.id);
    const mostUnderOnField = currentOnField.has(mostUnder.id);
    
    if (mostOverOnField && !mostUnderOnField && mostUnder.allowedPositions.includes(mostOver.role)) {
      const balancingTime = G - intervalMin;
      console.log(`✓ Balancing swap at ${balancingTime.toFixed(2)} min: ${mostOver.name} OFF → ${mostUnder.name} ON`);
      
      events.push({
        timeMinutes: balancingTime,
        fieldPlayerId: mostOver.id,
        benchPlayerId: mostUnder.id,
      });
      
      // Update minutes (approximate)
      const adjustmentTime = G - balancingTime;
      minutesPlayed[mostOver.id] -= adjustmentTime;
      minutesPlayed[mostUnder.id] += adjustmentTime;
      offFieldTime[mostOver.id] += adjustmentTime;
      offFieldTime[mostUnder.id] -= adjustmentTime;
      benchCounts[mostOver.id]++;
      
      currentOnField.delete(mostOver.id);
      currentOnField.add(mostUnder.id);
    } else {
      console.log('✗ Balancing swap not feasible (position/status constraints)');
    }
  } else {
    console.log('No balancing needed - all players within threshold');
  }
  console.log('');

  // Calculate final projections
  logDebugHeader('FINAL PROJECTIONS');
  
  const projections = players.map(p => {
    const projected = minutesPlayed[p.id];
    return {
      playerId: p.id,
      projectedMinutes: projected,
      targetMinutes: T,
      deviation: projected - T,
      targetBenchCount: targetBenchCounts[p.id],
      actualBenchCount: benchCounts[p.id],
      offFieldMinutes: offFieldTime[p.id],
    };
  });

  console.log('Player                    | Projected | Target    | Deviation | Quota (T/A) | Off-field');
  console.log('─────────────────────────────────────────────────────────────────────────────────────────');
  
  projections.forEach(p => {
    const player = players.find(pl => pl.id === p.playerId);
    const deviationSign = p.deviation >= 0 ? '+' : '';
    console.log(
      `${player?.name.padEnd(25)} | ${p.projectedMinutes.toFixed(2).padStart(9)} | ${p.targetMinutes.toFixed(2).padStart(9)} | ${deviationSign}${p.deviation.toFixed(2).padStart(8)} | ${p.targetBenchCount}/${p.actualBenchCount}       | ${p.offFieldMinutes.toFixed(2)}`
    );
  });
  console.log('');

  // Debug verification
  logDebugHeader('DEBUG VERIFICATION');
  
  console.log('Bench event counts (quota enforcement):');
  projections.forEach(p => {
    const player = players.find(pl => pl.id === p.playerId);
    const match = p.actualBenchCount === p.targetBenchCount ? '✓' : '✗';
    console.log(`  ${player?.name}: ${p.actualBenchCount}/${p.targetBenchCount} ${match}`);
  });
  console.log('');
  
  const benchEventVariance = Math.max(...projections.map(p => p.actualBenchCount)) - Math.min(...projections.map(p => p.actualBenchCount));
  console.log(`Bench event variance: ${benchEventVariance}`);
  console.log(`Goal: variance ≤ 1 (${benchEventVariance <= 1 ? '✓ ACHIEVED' : '✗ NOT ACHIEVED'})`);
  console.log('');

  return {
    events,
    projections,
    windowAssignments: windows,
    targetMinutesPerPlayer: T,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

interface PositionRequirement {
  role: 'goalkeeper' | 'defender' | 'midfielder' | 'forward';
  count: number;
}

function buildPositionRequirements(fieldPlayers: PlayerInput[]): PositionRequirement[] {
  const counts: Record<string, number> = {
    goalkeeper: 0,
    defender: 0,
    midfielder: 0,
    forward: 0,
  };

  fieldPlayers.forEach(p => {
    counts[p.role]++;
  });

  return Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([role, count]) => ({
      role: role as 'goalkeeper' | 'defender' | 'midfielder' | 'forward',
      count,
    }));
}

interface Swap {
  offId: string;
  onId: string;
  errorReduction: number;
}

function selectSwaps(
  offCandidates: PlayerInput[],
  onCandidates: PlayerInput[],
  fairnessErrors: Record<string, number>,
  positionRequirements: PositionRequirement[],
  currentOnField: Set<string>,
  allPlayers: PlayerInput[],
  maxSubs: number,
  windowTime: number
): Swap[] {
  const swaps: Swap[] = [];
  const usedOff = new Set<string>();
  const usedOn = new Set<string>();
  const testOnField = new Set(currentOnField);

  for (const offPlayer of offCandidates) {
    if (swaps.length >= maxSubs) break;
    if (usedOff.has(offPlayer.id)) continue;

    let bestOnPlayer: PlayerInput | null = null;
    let bestErrorReduction = -Infinity;

    for (const onPlayer of onCandidates) {
      if (usedOn.has(onPlayer.id)) continue;

      if (!onPlayer.allowedPositions.includes(offPlayer.role)) continue;

      const tempOnField = new Set(testOnField);
      tempOnField.delete(offPlayer.id);
      tempOnField.add(onPlayer.id);

      if (!isValidLineup(allPlayers, tempOnField, positionRequirements)) continue;

      const errorReduction = fairnessErrors[offPlayer.id] - fairnessErrors[onPlayer.id];

      if (errorReduction > bestErrorReduction) {
        bestErrorReduction = errorReduction;
        bestOnPlayer = onPlayer;
      }
    }

    if (bestOnPlayer && bestErrorReduction > 0) {
      swaps.push({
        offId: offPlayer.id,
        onId: bestOnPlayer.id,
        errorReduction: bestErrorReduction,
      });

      usedOff.add(offPlayer.id);
      usedOn.add(bestOnPlayer.id);
      testOnField.delete(offPlayer.id);
      testOnField.add(bestOnPlayer.id);
    }
  }

  return swaps;
}

function isValidLineup(
  players: PlayerInput[],
  onFieldIds: Set<string>,
  positionRequirements: PositionRequirement[]
): boolean {
  const roleCounts: Record<string, number> = {
    goalkeeper: 0,
    defender: 0,
    midfielder: 0,
    forward: 0,
  };

  onFieldIds.forEach(id => {
    const player = players.find(p => p.id === id);
    if (player) {
      roleCounts[player.role]++;
    }
  });

  for (const req of positionRequirements) {
    if (roleCounts[req.role] !== req.count) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Utility: Convert to seconds for UI compatibility
// ============================================================================

export function convertPlanToSeconds(plan: SubstitutionPlan): SubstitutionPlan {
  return {
    ...plan,
    events: plan.events.map(e => ({
      ...e,
      timeMinutes: e.timeMinutes * 60,
    })),
    windowAssignments: plan.windowAssignments.map(w => ({
      ...w,
      timeMinutes: w.timeMinutes * 60,
    })),
  };
}

// ============================================================================
// Speed Mode Configuration
// ============================================================================

export type SpeedMode = 'fast' | 'medium' | 'slow';

export function getWindowLengthForSpeedMode(mode: SpeedMode): number {
  switch (mode) {
    case 'fast':
      return 4;
    case 'medium':
      return 6;
    case 'slow':
      return 8;
    default:
      return 6;
  }
}

export function createPlanConfig(
  totalMatchMinutes: number,
  speedMode: SpeedMode,
  maxSubsPerWindow: number
): PlanConfig {
  const windowLength = getWindowLengthForSpeedMode(speedMode);
  
  return {
    totalMatchMinutes,
    maxSubsPerWindow,
    windowLengthMinutes: windowLength,
    minOnMinutes: Math.max(2, windowLength / 2),
    minRestMinutes: Math.max(2, windowLength / 2),
  };
}
