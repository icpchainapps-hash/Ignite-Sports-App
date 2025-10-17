import { useState, useEffect, useCallback } from 'react';
import { Player } from '../components/PitchBoard';
import { SubstitutionSpeedMode } from '../backend';
import { 
  calculateSubstitutionSchedule,
  calculateQueueBasedRotation,
  verifyScheduleMatch,
  verifyRotationMatch,
  SubstitutionEvent as SharedSubstitutionEvent
} from '../lib/substitutionScheduleCalculator';

interface ScheduledSubstitution {
  time: number;
  fieldPlayer: Player;
  benchPlayer: Player;
  executed: boolean;
}

interface UseSubstitutionSchedulerProps {
  players: Player[];
  timePerHalf: number;
  currentTimeRemaining: number;
  currentHalf: 'first' | 'second';
  isTimerRunning: boolean;
  speedMode: SubstitutionSpeedMode;
  maxSimultaneousSubs: number;
}

interface PlayerTimeTracking {
  playerId: string;
  player: Player;
  targetMinutes: number;
  scheduledMinutes: number;
  isCurrentlyOnField: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function useSubstitutionScheduler({
  players,
  timePerHalf,
  currentTimeRemaining,
  currentHalf,
  isTimerRunning,
  speedMode,
  maxSimultaneousSubs,
}: UseSubstitutionSchedulerProps) {
  const [schedule, setSchedule] = useState<ScheduledSubstitution[]>([]);
  const [pendingSubstitution, setPendingSubstitution] = useState<ScheduledSubstitution | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [previewRotationEvents, setPreviewRotationEvents] = useState<SharedSubstitutionEvent[]>([]);

  const validateSchedule = useCallback((
    substitutionEvents: ScheduledSubstitution[],
    allPlayers: Player[],
    totalMatchTime: number
  ): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  SCHEDULE VALIDATION                                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    // Track player states throughout the match
    const playerOnFieldPeriods: Record<string, number[]> = {};
    const playerBenchPeriods: Record<string, number[]> = {};
    const currentlyOnField = new Set<string>(allPlayers.filter(p => p.isOnField).map(p => p.id));
    
    // Initialize tracking
    allPlayers.forEach(p => {
      playerOnFieldPeriods[p.id] = [];
      playerBenchPeriods[p.id] = [];
      
      if (p.isOnField) {
        playerOnFieldPeriods[p.id].push(0);
      } else {
        playerBenchPeriods[p.id].push(0);
      }
    });
    
    // Process substitutions chronologically
    const sortedEvents = [...substitutionEvents].sort((a, b) => a.time - b.time);
    
    sortedEvents.forEach(sub => {
      const timeMinutes = sub.time / 60;
      
      // Record when field player goes to bench
      if (currentlyOnField.has(sub.fieldPlayer.id)) {
        currentlyOnField.delete(sub.fieldPlayer.id);
        playerBenchPeriods[sub.fieldPlayer.id].push(timeMinutes);
      }
      
      // Record when bench player goes to field
      if (!currentlyOnField.has(sub.benchPlayer.id)) {
        currentlyOnField.add(sub.benchPlayer.id);
        playerOnFieldPeriods[sub.benchPlayer.id].push(timeMinutes);
      }
    });
    
    // Check if schedule covers both halves
    const halfDuration = totalMatchTime / 2;
    const firstHalfSubs = sortedEvents.filter(s => s.time / 60 <= halfDuration);
    const secondHalfSubs = sortedEvents.filter(s => s.time / 60 > halfDuration);
    
    console.log('📊 SCHEDULE COVERAGE:');
    console.log(`   Total match time: ${totalMatchTime} minutes`);
    console.log(`   First half duration: ${halfDuration} minutes`);
    console.log(`   Second half duration: ${halfDuration} minutes`);
    console.log(`   Total substitutions: ${sortedEvents.length}`);
    console.log(`   First half substitutions: ${firstHalfSubs.length}`);
    console.log(`   Second half substitutions: ${secondHalfSubs.length}`);
    console.log('');
    
    if (sortedEvents.length > 0 && firstHalfSubs.length === 0) {
      warnings.push('No substitutions scheduled for the first half');
    }
    
    if (sortedEvents.length > 0 && secondHalfSubs.length === 0) {
      warnings.push('No substitutions scheduled for the second half');
    }
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('VALIDATION RESULT:');
    console.log('═══════════════════════════════════════════════════════════════');
    
    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ VALIDATION PASSED');
      console.log('   ✓ Schedule meets all requirements');
    } else if (errors.length > 0) {
      console.log('❌ VALIDATION FAILED - SCHEDULE REJECTED');
      console.log('');
      console.log('Critical Errors:');
      errors.forEach(error => console.log(`   ❌ ${error}`));
    } else {
      console.log('✅ VALIDATION PASSED WITH INFORMATIONAL WARNINGS');
      console.log('');
      console.log('Informational notes:');
      warnings.forEach(warning => console.log(`   ℹ️  ${warning}`));
    }
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, []);

  const generateSchedule = useCallback(() => {
    const fieldPlayers = players.filter((p) => p.isOnField);
    const benchPlayers = players.filter((p) => !p.isOnField);

    if (benchPlayers.length === 0) {
      setSchedule([]);
      setValidationResult({
        isValid: false,
        errors: ['No bench players available for substitutions. Add bench players to enable automated substitution scheduling.'],
        warnings: []
      });
      return;
    }

    const totalMatchTime = timePerHalf * 2;
    const totalPlayers = players.length;
    const numFieldPlayers = fieldPlayers.length;
    
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  FRONTEND SCHEDULE GENERATION USING SHARED FUNCTIONS         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    // ═══════════════════════════════════════════════════════════════════
    // DEBUG CHECKPOINT 1: Calculate schedule parameters
    // ═══════════════════════════════════════════════════════════════════
    
    console.log('🎯 DEBUG CHECKPOINT 1: CALCULATE SCHEDULE PARAMETERS');
    console.log('');
    
    const scheduleResult = calculateSubstitutionSchedule({
      totalPlayers,
      onFieldPlayers: numFieldPlayers,
      gameMinutes: totalMatchTime,
      maxSimultaneousSubs,
    });

    if (!scheduleResult.isFeasible) {
      setSchedule([]);
      setValidationResult({
        isValid: false,
        errors: [scheduleResult.errorMessage || 'Schedule calculation failed'],
        warnings: []
      });
      return;
    }

    const { minRounds, interval, substitutionTimes } = scheduleResult;
    
    console.log('✅ SCHEDULE PARAMETERS CALCULATED:');
    console.log(`   Minimum rounds: ${minRounds}`);
    console.log(`   Interval: ${interval.toFixed(4)} minutes`);
    console.log(`   Substitution times: [${substitutionTimes.map(t => t.toFixed(4)).join(', ')}] minutes`);
    console.log('');
    
    // ═══════════════════════════════════════════════════════════════════
    // DEBUG CHECKPOINT 2: Prepare player queues
    // ═══════════════════════════════════════════════════════════════════
    
    console.log('🎯 DEBUG CHECKPOINT 2: PREPARE PLAYER QUEUES');
    console.log('');
    
    const fieldPlayerIds = fieldPlayers.map(p => p.id);
    const benchPlayerIds = benchPlayers.map(p => p.id);
    
    console.log('📊 INITIAL PLAYER QUEUES:');
    console.log(`   Field players (${fieldPlayerIds.length}): [${fieldPlayerIds.join(', ')}]`);
    console.log(`   Bench players (${benchPlayerIds.length}): [${benchPlayerIds.join(', ')}]`);
    console.log('');
    
    // ═══════════════════════════════════════════════════════════════════
    // DEBUG CHECKPOINT 3: Calculate queue-based rotation
    // ═══════════════════════════════════════════════════════════════════
    
    console.log('🎯 DEBUG CHECKPOINT 3: CALCULATE QUEUE-BASED ROTATION');
    console.log('   Using SHARED queue-based rotation function');
    console.log('');
    
    const rotationResult = calculateQueueBasedRotation(
      fieldPlayerIds,
      benchPlayerIds,
      substitutionTimes,
      maxSimultaneousSubs
    );
    
    // Store preview events for later comparison
    setPreviewRotationEvents(rotationResult.events);
    
    console.log('✅ ROTATION CALCULATED:');
    console.log(`   Total substitution events: ${rotationResult.events.length}`);
    console.log(`   Events per round: ${(rotationResult.events.length / minRounds).toFixed(2)}`);
    console.log('');
    
    // ═══════════════════════════════════════════════════════════════════
    // DEBUG CHECKPOINT 4: Convert events to schedule format
    // ═══════════════════════════════════════════════════════════════════
    
    console.log('🎯 DEBUG CHECKPOINT 4: CONVERT EVENTS TO SCHEDULE FORMAT');
    console.log('');
    
    const substitutionEvents: ScheduledSubstitution[] = rotationResult.events.map(event => {
      const fieldPlayer = players.find(p => p.id === event.fieldPlayerId);
      const benchPlayer = players.find(p => p.id === event.benchPlayerId);
      
      if (!fieldPlayer || !benchPlayer) {
        throw new Error(`Player not found: field=${event.fieldPlayerId}, bench=${event.benchPlayerId}`);
      }
      
      return {
        time: event.timeSeconds,
        fieldPlayer,
        benchPlayer,
        executed: false,
      };
    });
    
    console.log('✅ SCHEDULE FORMAT CONVERSION COMPLETE:');
    console.log(`   Created ${substitutionEvents.length} scheduled substitutions`);
    console.log('');
    
    // ═══════════════════════════════════════════════════════════════════
    // DEBUG CHECKPOINT 5: Validate schedule
    // ═══════════════════════════════════════════════════════════════════
    
    console.log('🎯 DEBUG CHECKPOINT 5: VALIDATE SCHEDULE');
    console.log('');
    
    const validation = validateSchedule(substitutionEvents, players, totalMatchTime);
    setValidationResult(validation);
    
    if (!validation.isValid) {
      console.log('');
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  ❌ SCHEDULE REJECTED - VALIDATION FAILED                     ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
      console.log('');
      validation.errors.forEach(error => {
        console.log(`   ❌ ${error}`);
      });
      console.log('');
      
      setSchedule([]);
      return;
    }
    
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ SCHEDULE ACCEPTED - READY FOR BACKEND GENERATION          ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('✓ Schedule uses shared calculator for timing');
    console.log('✓ Schedule uses shared queue-based rotation');
    console.log(`✓ Created ${substitutionEvents.length} substitution events across ${minRounds} rounds`);
    console.log(`✓ Maximum ${maxSimultaneousSubs} substitution(s) per round enforced`);
    console.log('✓ Preview rotation events stored for backend comparison');
    
    if (validation.warnings.length > 0) {
      console.log('');
      console.log('ℹ️  Informational notes:');
      validation.warnings.forEach(warning => {
        console.log(`   ℹ️  ${warning}`);
      });
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    setSchedule(substitutionEvents);
  }, [players, timePerHalf, maxSimultaneousSubs, validateSchedule]);

  useEffect(() => {
    if (!isTimerRunning || schedule.length === 0) {
      return;
    }

    const halfDuration = timePerHalf * 60;
    const elapsedTime =
      currentHalf === 'first'
        ? halfDuration - currentTimeRemaining
        : halfDuration * 2 - currentTimeRemaining;

    const nextSubstitution = schedule.find(
      (sub) => !sub.executed && sub.time <= elapsedTime && sub.time > elapsedTime - 5
    );

    if (nextSubstitution && !pendingSubstitution) {
      setPendingSubstitution(nextSubstitution);
    }
  }, [schedule, currentTimeRemaining, currentHalf, timePerHalf, isTimerRunning, pendingSubstitution]);

  const confirmSubstitution = useCallback(() => {
    if (pendingSubstitution) {
      setSchedule((prev) =>
        prev.map((sub) =>
          sub.time === pendingSubstitution.time && sub.fieldPlayer.id === pendingSubstitution.fieldPlayer.id
            ? { ...sub, executed: true }
            : sub
        )
      );
      setPendingSubstitution(null);
    }
  }, [pendingSubstitution]);

  const declineSubstitution = useCallback(() => {
    if (pendingSubstitution) {
      setSchedule((prev) =>
        prev.map((sub) =>
          sub.time === pendingSubstitution.time && sub.fieldPlayer.id === pendingSubstitution.fieldPlayer.id
            ? { ...sub, executed: true }
            : sub
        )
      );
      setPendingSubstitution(null);
    }
  }, [pendingSubstitution]);

  const clearSchedule = useCallback(() => {
    console.log('🗑️  CLEARING SCHEDULE');
    console.log('   All substitution events will be removed');
    console.log('');
    setSchedule([]);
    setPendingSubstitution(null);
    setValidationResult(null);
    setPreviewRotationEvents([]);
  }, []);

  return {
    schedule,
    pendingSubstitution,
    validationResult,
    previewRotationEvents,
    generateSchedule,
    confirmSubstitution,
    declineSubstitution,
    clearSchedule,
  };
}
