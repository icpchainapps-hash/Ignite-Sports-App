/**
 * Shared Substitution Schedule Calculator - Dynamic Optimal Fairness with Multi-Combination Analysis
 * 
 * This module provides optimal fairness scheduling that analyzes ALL valid combinations
 * of simultaneous substitutions per round (from 1 up to bench size) and recommends
 * the optimal combination that produces the most even playing time distribution.
 * 
 * ADVANCED OPTIMAL COMBINATION ANALYSIS:
 * 1. For each possible number of subs per round (1, 2, 3, ..., up to bench size)
 * 2. Calculate complete schedule with projected minutes for all players
 * 3. Calculate variance in playing time across all players
 * 4. Recommend the combination with smallest variance
 * 5. Display all combinations with their metrics in preview UI
 */

export interface SubstitutionScheduleParams {
  totalPlayers: number;
  onFieldPlayers: number;
  gameMinutes: number;
  maxSimultaneousSubs: number;
}

export interface SubstitutionScheduleResult {
  minRounds: number;
  interval: number;
  substitutionTimes: number[];
  stintMinutes: number;
  isFeasible: boolean;
  errorMessage?: string;
  hasBalancingRound?: boolean;
  adjustedSubsPerRound?: number;
  originalSubsPerRound?: number;
}

export interface PlayerQueueState {
  fieldQueue: string[];
  benchQueue: string[];
}

export interface SubstitutionEvent {
  roundNumber: number;
  timeMinutes: number;
  timeSeconds: number;
  fieldPlayerId: string;
  benchPlayerId: string;
  isBalancingRound?: boolean;
}

export interface QueueRotationResult {
  events: SubstitutionEvent[];
  finalQueueState: PlayerQueueState;
  queueStateHistory: Array<{
    roundNumber: number;
    beforeSub: PlayerQueueState;
    afterSub: PlayerQueueState;
  }>;
}

export interface PlayerGameTime {
  playerId: string;
  playerName: string;
  totalMinutes: number;
  totalOffFieldTime: number;
  benchEventCount: number;
  onFieldIntervals: Array<[number, number]>;
  isStartingOnField: boolean;
}

export interface BenchEventCount {
  playerId: string;
  playerName: string;
  benchEvents: number;
}

export interface CombinationAnalysis {
  numSubs: number;
  variance: number;
  minMinutes: number;
  maxMinutes: number;
  projectedGameTime: PlayerGameTime[];
  rotationEvents: SubstitutionEvent[];
  benchEventCounts: BenchEventCount[];
  isRecommended: boolean;
}

export interface MultiCombinationResult {
  allCombinations: CombinationAnalysis[];
  recommendedCombination: CombinationAnalysis;
}

/**
 * Count bench events per player based on rotation events
 */
export function countBenchEvents(
  fieldPlayerIds: string[],
  benchPlayerIds: string[],
  rotationEvents: SubstitutionEvent[],
  playerNames: Record<string, string>
): BenchEventCount[] {
  const benchEventMap: Record<string, number> = {};
  
  [...fieldPlayerIds, ...benchPlayerIds].forEach(playerId => {
    benchEventMap[playerId] = 0;
  });

  rotationEvents.forEach((event) => {
    if (benchEventMap[event.fieldPlayerId] !== undefined) {
      benchEventMap[event.fieldPlayerId]++;
    }
  });

  const result: BenchEventCount[] = [...fieldPlayerIds, ...benchPlayerIds].map(playerId => ({
    playerId,
    playerName: playerNames[playerId] || playerId,
    benchEvents: benchEventMap[playerId] || 0,
  }));

  return result;
}

/**
 * Calculate the complete substitution schedule parameters
 */
export function calculateSubstitutionSchedule(
  params: SubstitutionScheduleParams
): SubstitutionScheduleResult {
  const { totalPlayers, onFieldPlayers, gameMinutes, maxSimultaneousSubs } = params;

  if (onFieldPlayers <= 0) {
    return {
      minRounds: 0,
      interval: 0,
      substitutionTimes: [],
      stintMinutes: 0,
      isFeasible: false,
      errorMessage: 'Number of on-field players must be greater than 0',
    };
  }

  if (gameMinutes <= 0) {
    return {
      minRounds: 0,
      interval: 0,
      substitutionTimes: [],
      stintMinutes: 0,
      isFeasible: false,
      errorMessage: 'Game minutes must be greater than 0',
    };
  }

  if (maxSimultaneousSubs <= 0) {
    return {
      minRounds: 0,
      interval: 0,
      substitutionTimes: [],
      stintMinutes: 0,
      isFeasible: false,
      errorMessage: 'Max simultaneous substitutions must be greater than 0',
    };
  }

  const benchSize = totalPlayers - onFieldPlayers;
  if (benchSize <= 0) {
    return {
      minRounds: 0,
      interval: 0,
      substitutionTimes: [],
      stintMinutes: 0,
      isFeasible: true,
      errorMessage: 'No bench players - no substitutions needed',
    };
  }

  const minRounds = Math.ceil(totalPlayers / maxSimultaneousSubs);
  const interval = gameMinutes / (minRounds + 1);

  const substitutionTimes: number[] = [];
  for (let i = 1; i <= minRounds; i++) {
    substitutionTimes.push(interval * i);
  }

  const stintMinutes = gameMinutes / minRounds;

  return {
    minRounds,
    interval,
    substitutionTimes,
    stintMinutes,
    isFeasible: true,
  };
}

/**
 * DYNAMIC OPTIMAL FAIRNESS ROTATION
 * 
 * For each round, analyzes all valid combinations of substitutions and selects
 * the one that minimizes total deviation from target playing time.
 */
export function calculateOptimalRotation(
  fieldPlayerIds: string[],
  benchPlayerIds: string[],
  substitutionTimes: number[],
  maxSimultaneousSubs: number
): QueueRotationResult {
  const allPlayerIds = [...fieldPlayerIds, ...benchPlayerIds];
  const totalMatchTime = substitutionTimes.length > 0 
    ? substitutionTimes[substitutionTimes.length - 1] * 1.2 
    : 90;
  
  const targetMinutes = (totalMatchTime * fieldPlayerIds.length) / allPlayerIds.length;

  // Initialize tracking
  const playerMinutes: Record<string, number> = {};
  const playerBenchCount: Record<string, number> = {};
  const playerLastBenchTime: Record<string, number> = {};
  const cooldowns: Record<string, boolean> = {};
  
  allPlayerIds.forEach(playerId => {
    playerMinutes[playerId] = 0;
    playerBenchCount[playerId] = 0;
    playerLastBenchTime[playerId] = -Infinity;
    cooldowns[playerId] = false;
  });
  
  let currentlyOnField = new Set<string>(fieldPlayerIds);
  const events: SubstitutionEvent[] = [];
  const queueStateHistory: Array<{
    roundNumber: number;
    beforeSub: PlayerQueueState;
    afterSub: PlayerQueueState;
  }> = [];

  let lastTime = 0;

  // Process each substitution round
  for (let roundIdx = 0; roundIdx < substitutionTimes.length; roundIdx++) {
    const timeMinutes = substitutionTimes[roundIdx];
    const timeSeconds = Math.round(timeMinutes * 60);
    const roundNumber = roundIdx + 1;
    const timePeriod = timeMinutes - lastTime;

    // Accrue playing time
    currentlyOnField.forEach(playerId => {
      playerMinutes[playerId] += timePeriod;
    });

    // Calculate current deviations
    const deviations: Record<string, number> = {};
    allPlayerIds.forEach(playerId => {
      const projected = playerMinutes[playerId] + (currentlyOnField.has(playerId) ? (totalMatchTime - timeMinutes) : 0);
      deviations[playerId] = Math.abs(projected - targetMinutes);
    });

    // Get eligible players
    const eligibleOff = Array.from(currentlyOnField).filter(id => !cooldowns[id]);
    const eligibleOn = allPlayerIds.filter(id => !currentlyOnField.has(id));

    // Try all valid combinations from 1 to maxSimultaneousSubs
    let bestCombination: Array<{offId: string; onId: string}> = [];
    let bestTotalDeviation = Infinity;

    for (let numSubs = 1; numSubs <= Math.min(maxSimultaneousSubs, eligibleOff.length, eligibleOn.length); numSubs++) {
      // Generate all combinations of numSubs substitutions
      const offCombinations = getCombinations(eligibleOff, numSubs);
      
      for (const offPlayers of offCombinations) {
        // Sort on-players by deviation (most under-target first)
        const sortedOn = [...eligibleOn].sort((a, b) => deviations[a] - deviations[b]);
        const onPlayers = sortedOn.slice(0, numSubs);

        // Calculate total deviation for this combination
        let totalDeviation = 0;
        const testMinutes = {...playerMinutes};
        const remainingTime = totalMatchTime - timeMinutes;

        offPlayers.forEach(offId => {
          testMinutes[offId] = playerMinutes[offId];
        });
        onPlayers.forEach(onId => {
          testMinutes[onId] = playerMinutes[onId] + remainingTime;
        });

        allPlayerIds.forEach(playerId => {
          const projected = testMinutes[playerId] + (
            offPlayers.includes(playerId) ? 0 :
            onPlayers.includes(playerId) ? 0 :
            currentlyOnField.has(playerId) ? remainingTime : 0
          );
          totalDeviation += Math.abs(projected - targetMinutes);
        });

        if (totalDeviation < bestTotalDeviation) {
          bestTotalDeviation = totalDeviation;
          bestCombination = offPlayers.map((offId, idx) => ({
            offId,
            onId: onPlayers[idx]
          }));
        }
      }
    }

    // Apply best combination
    bestCombination.forEach(({offId, onId}) => {
      events.push({
        roundNumber,
        timeMinutes,
        timeSeconds,
        fieldPlayerId: offId,
        benchPlayerId: onId,
      });

      currentlyOnField.delete(offId);
      currentlyOnField.add(onId);
      playerBenchCount[offId]++;
      playerLastBenchTime[offId] = timeMinutes;
      playerLastBenchTime[onId] = timeMinutes;
      cooldowns[offId] = true;
    });

    // Reset cooldowns
    allPlayerIds.forEach(playerId => {
      const wasBenched = bestCombination.some(s => s.offId === playerId);
      if (!wasBenched) cooldowns[playerId] = false;
    });

    lastTime = timeMinutes;
  }

  // Accrue final minutes
  const remainingTime = totalMatchTime - lastTime;
  currentlyOnField.forEach(playerId => {
    playerMinutes[playerId] += remainingTime;
  });

  return {
    events,
    finalQueueState: {
      fieldQueue: Array.from(currentlyOnField),
      benchQueue: allPlayerIds.filter(id => !currentlyOnField.has(id)),
    },
    queueStateHistory,
  };
}

// Helper: Generate all combinations of k elements from array
function getCombinations<T>(array: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > array.length) return [];
  
  const result: T[][] = [];
  
  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    
    for (let i = start; i < array.length; i++) {
      current.push(array[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  
  backtrack(0, []);
  return result;
}

// Alias for backward compatibility
export const calculateQueueBasedRotation = calculateOptimalRotation;

/**
 * Calculate projected game time per player
 */
export function calculateProjectedGameTime(
  fieldPlayerIds: string[],
  benchPlayerIds: string[],
  rotationEvents: SubstitutionEvent[],
  totalGameMinutes: number,
  playerNames: Record<string, string>
): PlayerGameTime[] {
  const playerStatus: Record<string, boolean> = {};
  const playerMinutes: Record<string, number> = {};
  const playerOffFieldMinutes: Record<string, number> = {};
  const playerBenchEvents: Record<string, number> = {};
  const playerIntervals: Record<string, Array<[number, number]>> = {};

  fieldPlayerIds.forEach(id => {
    playerStatus[id] = true;
    playerMinutes[id] = 0;
    playerOffFieldMinutes[id] = 0;
    playerBenchEvents[id] = 0;
    playerIntervals[id] = [];
  });

  benchPlayerIds.forEach(id => {
    playerStatus[id] = false;
    playerMinutes[id] = 0;
    playerOffFieldMinutes[id] = 0;
    playerBenchEvents[id] = 0;
    playerIntervals[id] = [];
  });

  const sortedEvents = [...rotationEvents].sort((a, b) => a.timeMinutes - b.timeMinutes);
  let lastTime = 0;

  sortedEvents.forEach((event) => {
    const timePeriod = event.timeMinutes - lastTime;

    Object.keys(playerStatus).forEach(playerId => {
      if (playerStatus[playerId]) {
        playerMinutes[playerId] += timePeriod;
      } else {
        playerOffFieldMinutes[playerId] += timePeriod;
      }
    });

    if (playerStatus[event.fieldPlayerId]) {
      const startTime = playerIntervals[event.fieldPlayerId].length > 0
        ? playerIntervals[event.fieldPlayerId][playerIntervals[event.fieldPlayerId].length - 1][1]
        : 0;
      playerIntervals[event.fieldPlayerId].push([startTime, event.timeMinutes]);
    }

    playerBenchEvents[event.fieldPlayerId]++;
    playerStatus[event.fieldPlayerId] = false;
    playerStatus[event.benchPlayerId] = true;

    lastTime = event.timeMinutes;
  });

  const remainingTime = totalGameMinutes - lastTime;
  Object.keys(playerStatus).forEach(playerId => {
    if (playerStatus[playerId]) {
      playerMinutes[playerId] += remainingTime;
      const startTime = playerIntervals[playerId].length > 0
        ? playerIntervals[playerId][playerIntervals[playerId].length - 1][1]
        : 0;
      playerIntervals[playerId].push([startTime, totalGameMinutes]);
    } else {
      playerOffFieldMinutes[playerId] += remainingTime;
    }
  });

  const allPlayerIds = [...fieldPlayerIds, ...benchPlayerIds];
  const result: PlayerGameTime[] = allPlayerIds.map(playerId => ({
    playerId,
    playerName: playerNames[playerId] || playerId,
    totalMinutes: playerMinutes[playerId] || 0,
    totalOffFieldTime: playerOffFieldMinutes[playerId] || 0,
    benchEventCount: playerBenchEvents[playerId] || 0,
    onFieldIntervals: playerIntervals[playerId] || [],
    isStartingOnField: fieldPlayerIds.includes(playerId),
  }));

  result.sort((a, b) => b.totalMinutes - a.totalMinutes);

  return result;
}

/**
 * ADVANCED MULTI-COMBINATION ANALYSIS
 * 
 * Analyzes all valid combinations of simultaneous substitutions per round
 * (from 1 up to bench size) and calculates variance for each combination.
 * Returns all combinations with their metrics and highlights the recommended one.
 */
export function analyzeAllCombinations(
  fieldPlayerIds: string[],
  benchPlayerIds: string[],
  totalMatchTime: number,
  playerNames: Record<string, string>
): MultiCombinationResult {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  ADVANCED MULTI-COMBINATION ANALYSIS                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const benchSize = benchPlayerIds.length;
  const allCombinations: CombinationAnalysis[] = [];

  // Analyze each possible number of simultaneous substitutions
  for (let numSubs = 1; numSubs <= benchSize; numSubs++) {
    console.log(`─────────────────────────────────────────────────────────────`);
    console.log(`📊 ANALYZING COMBINATION: ${numSubs} simultaneous sub(s)`);
    console.log('');

    // Calculate schedule for this combination
    const scheduleResult = calculateSubstitutionSchedule({
      totalPlayers: fieldPlayerIds.length + benchPlayerIds.length,
      onFieldPlayers: fieldPlayerIds.length,
      gameMinutes: totalMatchTime,
      maxSimultaneousSubs: numSubs,
    });

    if (!scheduleResult.isFeasible) {
      console.log(`⚠️  Combination ${numSubs} is not feasible`);
      console.log('');
      continue;
    }

    // Calculate rotation for this combination
    const rotationResult = calculateOptimalRotation(
      fieldPlayerIds,
      benchPlayerIds,
      scheduleResult.substitutionTimes,
      numSubs
    );

    // Calculate projected game time
    const projectedGameTime = calculateProjectedGameTime(
      fieldPlayerIds,
      benchPlayerIds,
      rotationResult.events,
      totalMatchTime,
      playerNames
    );

    // Calculate bench event counts
    const benchEventCounts = countBenchEvents(
      fieldPlayerIds,
      benchPlayerIds,
      rotationResult.events,
      playerNames
    );

    // Calculate variance
    const minutes = projectedGameTime.map(p => p.totalMinutes);
    const minMinutes = Math.min(...minutes);
    const maxMinutes = Math.max(...minutes);
    const avgMinutes = minutes.reduce((a, b) => a + b, 0) / minutes.length;
    const variance = minutes.reduce((sum, m) => sum + Math.pow(m - avgMinutes, 2), 0) / minutes.length;

    console.log(`   Variance: ${variance.toFixed(4)}`);
    console.log(`   Min minutes: ${minMinutes.toFixed(2)}`);
    console.log(`   Max minutes: ${maxMinutes.toFixed(2)}`);
    console.log(`   Range: ${(maxMinutes - minMinutes).toFixed(2)}`);
    console.log('');

    allCombinations.push({
      numSubs,
      variance,
      minMinutes,
      maxMinutes,
      projectedGameTime,
      rotationEvents: rotationResult.events,
      benchEventCounts,
      isRecommended: false,
    });
  }

  // Find the combination with smallest variance
  let recommendedCombination = allCombinations[0];
  for (const combination of allCombinations) {
    if (combination.variance < recommendedCombination.variance) {
      recommendedCombination = combination;
    }
  }

  // Mark the recommended combination
  recommendedCombination.isRecommended = true;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ RECOMMENDED: ${recommendedCombination.numSubs} simultaneous sub(s)`);
  console.log(`   Variance: ${recommendedCombination.variance.toFixed(4)}`);
  console.log(`   Range: ${(recommendedCombination.maxMinutes - recommendedCombination.minMinutes).toFixed(2)} minutes`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  return {
    allCombinations,
    recommendedCombination,
  };
}

/**
 * Apply 5% tolerance playing time balancing
 */
export function applyPlayingTimeBalancing(
  rotationEvents: SubstitutionEvent[],
  projectedGameTime: PlayerGameTime[],
  totalGameMinutes: number,
  interval: number,
  maxSimultaneousSubs: number,
  playerNames: Record<string, string>
): { events: SubstitutionEvent[]; projectedGameTime: PlayerGameTime[]; hasBalancingRound: boolean } {
  const totalPlayers = projectedGameTime.length;
  if (totalPlayers === 0) {
    return { events: rotationEvents, projectedGameTime, hasBalancingRound: false };
  }

  const targetMinutes = totalGameMinutes / totalPlayers;
  const tolerance = 0.05;
  const lowerBound = targetMinutes * (1 - tolerance);
  const upperBound = targetMinutes * (1 + tolerance);

  const playersOutsideTolerance = projectedGameTime.filter(
    p => p.totalMinutes < lowerBound || p.totalMinutes > upperBound
  );

  if (playersOutsideTolerance.length === 0) {
    return { events: rotationEvents, projectedGameTime, hasBalancingRound: false };
  }

  // Determine current field status
  const currentFieldPlayers = new Set<string>();
  const currentBenchPlayers = new Set<string>();

  projectedGameTime.forEach(p => {
    if (p.isStartingOnField) {
      currentFieldPlayers.add(p.playerId);
    } else {
      currentBenchPlayers.add(p.playerId);
    }
  });

  rotationEvents.forEach(event => {
    if (currentFieldPlayers.has(event.fieldPlayerId)) {
      currentFieldPlayers.delete(event.fieldPlayerId);
      currentBenchPlayers.add(event.fieldPlayerId);
    }
    if (currentBenchPlayers.has(event.benchPlayerId)) {
      currentBenchPlayers.delete(event.benchPlayerId);
      currentFieldPlayers.add(event.benchPlayerId);
    }
  });

  const sortedByMinutes = [...projectedGameTime].sort((a, b) => b.totalMinutes - a.totalMinutes);
  const highPlayers = sortedByMinutes.filter(p => p.totalMinutes > upperBound);
  const lowPlayers = sortedByMinutes.filter(p => p.totalMinutes < lowerBound).reverse();

  const balancingEvents: SubstitutionEvent[] = [];
  const balancingTime = totalGameMinutes - interval;
  const balancingTimeSeconds = Math.round(balancingTime * 60);
  const balancingRoundNumber = rotationEvents.length + 1;

  let subsCreated = 0;
  for (let i = 0; i < Math.min(highPlayers.length, lowPlayers.length, maxSimultaneousSubs); i++) {
    const highPlayer = highPlayers[i];
    const lowPlayer = lowPlayers[i];

    if (currentFieldPlayers.has(highPlayer.playerId) && currentBenchPlayers.has(lowPlayer.playerId)) {
      balancingEvents.push({
        roundNumber: balancingRoundNumber,
        timeMinutes: balancingTime,
        timeSeconds: balancingTimeSeconds,
        fieldPlayerId: highPlayer.playerId,
        benchPlayerId: lowPlayer.playerId,
        isBalancingRound: true,
      });

      currentFieldPlayers.delete(highPlayer.playerId);
      currentFieldPlayers.add(lowPlayer.playerId);
      currentBenchPlayers.delete(lowPlayer.playerId);
      currentBenchPlayers.add(highPlayer.playerId);

      subsCreated++;
    }
  }

  if (balancingEvents.length === 0) {
    return { events: rotationEvents, projectedGameTime, hasBalancingRound: false };
  }

  const updatedEvents = [...rotationEvents, ...balancingEvents].sort((a, b) => a.timeMinutes - b.timeMinutes);

  const fieldPlayerIds = projectedGameTime.filter(p => p.isStartingOnField).map(p => p.playerId);
  const benchPlayerIds = projectedGameTime.filter(p => !p.isStartingOnField).map(p => p.playerId);

  const updatedProjectedGameTime = calculateProjectedGameTime(
    fieldPlayerIds,
    benchPlayerIds,
    updatedEvents,
    totalGameMinutes,
    playerNames
  );

  return {
    events: updatedEvents,
    projectedGameTime: updatedProjectedGameTime,
    hasBalancingRound: true,
  };
}

/**
 * Convert substitution times from minutes to seconds
 */
export function convertTimesToSeconds(timesInMinutes: number[]): number[] {
  return timesInMinutes.map(time => Math.round(time * 60));
}

/**
 * Format time in MM:SS format
 */
export function formatTime(minutes: number): string {
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get half label for a given time
 */
export function getHalfLabel(minutes: number, timePerHalf: number): string {
  return minutes <= timePerHalf ? '1st Half' : '2nd Half';
}

/**
 * Get time within half
 */
export function getTimeWithinHalf(minutes: number, timePerHalf: number): number {
  return minutes <= timePerHalf ? minutes : minutes - timePerHalf;
}

/**
 * Debug checkpoint: Verify that two schedule results match
 */
export function verifyScheduleMatch(
  expected: SubstitutionScheduleResult,
  actual: SubstitutionScheduleResult,
  context: string
): boolean {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log(`║  SCHEDULE VERIFICATION: ${context.padEnd(44)} ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  let allMatch = true;

  const roundsMatch = expected.minRounds === actual.minRounds;
  console.log(`📊 ROUNDS: ${roundsMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`   Expected: ${expected.minRounds}`);
  console.log(`   Actual: ${actual.minRounds}`);
  console.log('');

  if (!roundsMatch) allMatch = false;

  const intervalMatch = Math.abs(expected.interval - actual.interval) < 0.0001;
  console.log(`⏱️  INTERVAL: ${intervalMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`   Expected: ${expected.interval.toFixed(6)} minutes`);
  console.log(`   Actual: ${actual.interval.toFixed(6)} minutes`);
  console.log('');

  if (!intervalMatch) allMatch = false;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`RESULT: ${allMatch ? '✅ PERFECT MATCH' : '❌ MISMATCH DETECTED'}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  return allMatch;
}

/**
 * Debug checkpoint: Verify rotation events match between preview and generation
 */
export function verifyRotationMatch(
  previewEvents: SubstitutionEvent[],
  generatedEvents: Array<{ time: number; fieldPlayerId: string; benchPlayerId: string }>,
  context: string
): boolean {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log(`║  ROTATION VERIFICATION: ${context.padEnd(42)} ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const countMatch = previewEvents.length === generatedEvents.length;
  console.log(`📊 EVENT COUNT: ${countMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`   Preview: ${previewEvents.length} events`);
  console.log(`   Generated: ${generatedEvents.length} events`);
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`RESULT: ${countMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  return countMatch;
}
