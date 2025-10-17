import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useGetTimePerHalf, useSetTimePerHalf, useGetSubstitutionSpeedMode, useSetSubstitutionSpeedMode, useGetMaxSimultaneousSubs, useSetMaxSimultaneousSubs, useGenerateSubstitutionSchedule, useGetSubstitutionSchedule, useClearSubstitutionSchedule, useEnsureLineupExists, useGetCallerTeamsAndClubs, useGetAllClubs, useGetCallerUserProfile } from '../hooks/useQueries';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';
import { useViewportHeight } from '../hooks/useViewportHeight';
import { useSidePanelSwipe } from '../hooks/useSidePanelSwipe';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { LogOut, RotateCcw, ZoomIn, ZoomOut, Grid3X3, Users, Menu, Settings, Pencil, ArrowUpRight, Minus, X, Eraser, Calendar, ClipboardList, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SubstitutionSpeedMode, Formation, PlayerRole, Player as BackendPlayer, PositionEligibility as BackendPositionEligibility, UserRole } from '../backend';
import SoccerPitch from './SoccerPitch';
import PlayerBench from './PlayerBench';
import MatchTimer, { MatchTimerData } from './MatchTimer';
import ScheduleReviewDialog from './ScheduleReviewDialog';
import MinSubRoundsDisplay from './MinSubRoundsDisplay';
import { DrawingElement } from './DrawingLayer';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface PositionEligibility {
  goalkeeper: boolean;
  defender: boolean;
  midfielder: boolean;
  forward: boolean;
}

export interface Player {
  id: string;
  name: string;
  number: number;
  role: 'goalkeeper' | 'defender' | 'midfielder' | 'forward';
  position: { x: number; y: number };
  isOnField: boolean;
  positionEligibility: PositionEligibility;
}

export interface SoccerBall {
  position: { x: number; y: number };
}

export type TeamSize = 7 | 9 | 11;
export type Formation7 = '2-3-1' | '3-2-1' | '2-2-2' | 'Custom';
export type Formation9 = '3-3-2' | '3-4-1' | '4-3-1' | '2-4-2' | 'Custom';
export type Formation11 = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1' | 'Custom';
export type FormationType = Formation7 | Formation9 | Formation11;
export type PitchOrientation = 'portrait' | 'landscape';

const LINEUP_ID = 'default';

// Helper functions to convert between frontend and backend types
const roleToBackendRole = (role: Player['role']): PlayerRole => {
  const roleMap: Record<Player['role'], PlayerRole> = {
    'goalkeeper': PlayerRole.goalkeeper,
    'defender': PlayerRole.defender,
    'midfielder': PlayerRole.midfielder,
    'forward': PlayerRole.forward
  };
  return roleMap[role];
};

const backendRoleToRole = (role: PlayerRole): Player['role'] => {
  const roleMap: Record<PlayerRole, Player['role']> = {
    [PlayerRole.goalkeeper]: 'goalkeeper',
    [PlayerRole.defender]: 'defender',
    [PlayerRole.midfielder]: 'midfielder',
    [PlayerRole.forward]: 'forward'
  };
  return roleMap[role];
};

const playerToBackendPlayer = (player: Player): BackendPlayer => {
  return {
    id: player.id,
    name: player.name,
    number: BigInt(player.number),
    role: roleToBackendRole(player.role),
    position: player.position,
    isOnField: player.isOnField,
    positionEligibility: player.positionEligibility
  };
};

const backendPlayerToPlayer = (player: BackendPlayer): Player => {
  return {
    id: player.id,
    name: player.name,
    number: Number(player.number),
    role: backendRoleToRole(player.role),
    position: player.position,
    isOnField: player.isOnField,
    positionEligibility: player.positionEligibility
  };
};

const createDefaultPositionEligibilityForRole = (role: Player['role']): PositionEligibility => {
  return {
    goalkeeper: role === 'goalkeeper',
    defender: role === 'defender',
    midfielder: role === 'midfielder',
    forward: role === 'forward'
  };
};

const createDefaultPositionEligibility = (): PositionEligibility => ({
  goalkeeper: false,
  defender: false,
  midfielder: false,
  forward: false
});

const ensurePositionEligibility = (player: Partial<Player>): Player => {
  const basePlayer = player as Player;
  
  if (!basePlayer.positionEligibility || 
      typeof basePlayer.positionEligibility !== 'object' ||
      typeof basePlayer.positionEligibility.goalkeeper !== 'boolean') {
    
    if (basePlayer.isOnField === false) {
      basePlayer.positionEligibility = createDefaultPositionEligibilityForRole(basePlayer.role);
    } else {
      basePlayer.positionEligibility = createDefaultPositionEligibility();
    }
  }
  
  return basePlayer;
};

const FORMATION_ROLE_REQUIREMENTS: Record<TeamSize, Record<string, { defenders: number; midfielders: number; forwards: number }>> = {
  7: {
    '2-3-1': { defenders: 2, midfielders: 3, forwards: 1 },
    '3-2-1': { defenders: 3, midfielders: 2, forwards: 1 },
    '2-2-2': { defenders: 2, midfielders: 2, forwards: 2 },
    'Custom': { defenders: 0, midfielders: 0, forwards: 0 }
  },
  9: {
    '3-3-2': { defenders: 3, midfielders: 3, forwards: 2 },
    '3-4-1': { defenders: 3, midfielders: 4, forwards: 1 },
    '4-3-1': { defenders: 4, midfielders: 3, forwards: 1 },
    '2-4-2': { defenders: 2, midfielders: 4, forwards: 2 },
    'Custom': { defenders: 0, midfielders: 0, forwards: 0 }
  },
  11: {
    '4-4-2': { defenders: 4, midfielders: 4, forwards: 2 },
    '4-3-3': { defenders: 4, midfielders: 3, forwards: 3 },
    '3-5-2': { defenders: 3, midfielders: 5, forwards: 2 },
    '4-2-3-1': { defenders: 4, midfielders: 5, forwards: 1 },
    'Custom': { defenders: 0, midfielders: 0, forwards: 0 }
  }
};

const PORTRAIT_FORMATION_POSITIONS: Record<TeamSize, Record<string, { x: number; y: number }[]>> = {
  7: {
    '2-3-1': [
      { x: 50, y: 95 },
      { x: 30, y: 75 }, { x: 70, y: 75 },
      { x: 25, y: 55 }, { x: 50, y: 55 }, { x: 75, y: 55 },
      { x: 50, y: 35 }
    ],
    '3-2-1': [
      { x: 50, y: 95 },
      { x: 25, y: 75 }, { x: 50, y: 75 }, { x: 75, y: 75 },
      { x: 35, y: 55 }, { x: 65, y: 55 },
      { x: 50, y: 35 }
    ],
    '2-2-2': [
      { x: 50, y: 95 },
      { x: 35, y: 75 }, { x: 65, y: 75 },
      { x: 35, y: 55 }, { x: 65, y: 55 },
      { x: 35, y: 35 }, { x: 65, y: 35 }
    ],
    'Custom': []
  },
  9: {
    '3-3-2': [
      { x: 50, y: 95 },
      { x: 25, y: 75 }, { x: 50, y: 75 }, { x: 75, y: 75 },
      { x: 25, y: 55 }, { x: 50, y: 55 }, { x: 75, y: 55 },
      { x: 40, y: 35 }, { x: 60, y: 35 }
    ],
    '3-4-1': [
      { x: 50, y: 95 },
      { x: 25, y: 75 }, { x: 50, y: 75 }, { x: 75, y: 75 },
      { x: 20, y: 55 }, { x: 40, y: 55 }, { x: 60, y: 55 }, { x: 80, y: 55 },
      { x: 50, y: 35 }
    ],
    '4-3-1': [
      { x: 50, y: 95 },
      { x: 20, y: 75 }, { x: 40, y: 75 }, { x: 60, y: 75 }, { x: 80, y: 75 },
      { x: 30, y: 55 }, { x: 50, y: 55 }, { x: 70, y: 55 },
      { x: 50, y: 35 }
    ],
    '2-4-2': [
      { x: 50, y: 95 },
      { x: 35, y: 75 }, { x: 65, y: 75 },
      { x: 20, y: 55 }, { x: 40, y: 55 }, { x: 60, y: 55 }, { x: 80, y: 55 },
      { x: 40, y: 35 }, { x: 60, y: 35 }
    ],
    'Custom': []
  },
  11: {
    '4-4-2': [
      { x: 50, y: 95 },
      { x: 20, y: 75 }, { x: 40, y: 75 }, { x: 60, y: 75 }, { x: 80, y: 75 },
      { x: 25, y: 55 }, { x: 40, y: 55 }, { x: 60, y: 55 }, { x: 75, y: 55 },
      { x: 40, y: 35 }, { x: 60, y: 35 }
    ],
    '4-3-3': [
      { x: 50, y: 95 },
      { x: 20, y: 75 }, { x: 40, y: 75 }, { x: 60, y: 75 }, { x: 80, y: 75 },
      { x: 30, y: 55 }, { x: 50, y: 55 }, { x: 70, y: 55 },
      { x: 25, y: 35 }, { x: 50, y: 35 }, { x: 75, y: 35 }
    ],
    '3-5-2': [
      { x: 50, y: 95 },
      { x: 30, y: 75 }, { x: 50, y: 75 }, { x: 70, y: 75 },
      { x: 15, y: 55 }, { x: 35, y: 55 }, { x: 50, y: 55 }, { x: 65, y: 55 }, { x: 85, y: 55 },
      { x: 40, y: 35 }, { x: 60, y: 35 }
    ],
    '4-2-3-1': [
      { x: 50, y: 95 },
      { x: 20, y: 75 }, { x: 40, y: 75 }, { x: 60, y: 75 }, { x: 80, y: 75 },
      { x: 35, y: 65 }, { x: 65, y: 65 },
      { x: 25, y: 45 }, { x: 50, y: 45 }, { x: 75, y: 45 },
      { x: 50, y: 30 }
    ],
    'Custom': []
  }
};

const LANDSCAPE_FORMATION_POSITIONS: Record<TeamSize, Record<string, { x: number; y: number }[]>> = {
  7: {
    '2-3-1': [
      { x: 5, y: 50 },
      { x: 25, y: 30 }, { x: 25, y: 70 },
      { x: 45, y: 25 }, { x: 45, y: 50 }, { x: 45, y: 75 },
      { x: 65, y: 50 }
    ],
    '3-2-1': [
      { x: 5, y: 50 },
      { x: 25, y: 25 }, { x: 25, y: 50 }, { x: 25, y: 75 },
      { x: 45, y: 35 }, { x: 45, y: 65 },
      { x: 65, y: 50 }
    ],
    '2-2-2': [
      { x: 5, y: 50 },
      { x: 25, y: 35 }, { x: 25, y: 65 },
      { x: 45, y: 35 }, { x: 45, y: 65 },
      { x: 65, y: 35 }, { x: 65, y: 65 }
    ],
    'Custom': []
  },
  9: {
    '3-3-2': [
      { x: 5, y: 50 },
      { x: 25, y: 25 }, { x: 25, y: 50 }, { x: 25, y: 75 },
      { x: 45, y: 25 }, { x: 45, y: 50 }, { x: 45, y: 75 },
      { x: 65, y: 40 }, { x: 65, y: 60 }
    ],
    '3-4-1': [
      { x: 5, y: 50 },
      { x: 25, y: 25 }, { x: 25, y: 50 }, { x: 25, y: 75 },
      { x: 45, y: 20 }, { x: 45, y: 40 }, { x: 45, y: 60 }, { x: 45, y: 80 },
      { x: 65, y: 50 }
    ],
    '4-3-1': [
      { x: 5, y: 50 },
      { x: 25, y: 20 }, { x: 25, y: 40 }, { x: 25, y: 60 }, { x: 25, y: 80 },
      { x: 45, y: 30 }, { x: 45, y: 50 }, { x: 45, y: 70 },
      { x: 65, y: 50 }
    ],
    '2-4-2': [
      { x: 5, y: 50 },
      { x: 25, y: 35 }, { x: 25, y: 65 },
      { x: 45, y: 20 }, { x: 45, y: 40 }, { x: 45, y: 60 }, { x: 45, y: 80 },
      { x: 65, y: 40 }, { x: 65, y: 60 }
    ],
    'Custom': []
  },
  11: {
    '4-4-2': [
      { x: 5, y: 50 },
      { x: 25, y: 20 }, { x: 25, y: 40 }, { x: 25, y: 60 }, { x: 25, y: 80 },
      { x: 45, y: 25 }, { x: 45, y: 40 }, { x: 45, y: 60 }, { x: 45, y: 75 },
      { x: 65, y: 40 }, { x: 65, y: 60 }
    ],
    '4-3-3': [
      { x: 5, y: 50 },
      { x: 25, y: 20 }, { x: 25, y: 40 }, { x: 25, y: 60 }, { x: 25, y: 80 },
      { x: 45, y: 30 }, { x: 45, y: 50 }, { x: 45, y: 70 },
      { x: 65, y: 25 }, { x: 65, y: 50 }, { x: 65, y: 75 }
    ],
    '3-5-2': [
      { x: 5, y: 50 },
      { x: 25, y: 30 }, { x: 25, y: 50 }, { x: 25, y: 70 },
      { x: 45, y: 15 }, { x: 45, y: 35 }, { x: 45, y: 50 }, { x: 45, y: 65 }, { x: 45, y: 85 },
      { x: 65, y: 40 }, { x: 65, y: 60 }
    ],
    '4-2-3-1': [
      { x: 5, y: 50 },
      { x: 25, y: 20 }, { x: 25, y: 40 }, { x: 25, y: 60 }, { x: 25, y: 80 },
      { x: 35, y: 35 }, { x: 35, y: 65 },
      { x: 55, y: 25 }, { x: 55, y: 50 }, { x: 55, y: 75 },
      { x: 70, y: 50 }
    ],
    'Custom': []
  }
};

const DEFAULT_PLAYERS_BY_SIZE: Record<TeamSize, Player[]> = {
  7: [
    { id: '1', name: 'Goalkeeper', number: 1, role: 'goalkeeper', position: { x: 50, y: 95 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '2', name: 'Right Back', number: 2, role: 'defender', position: { x: 65, y: 75 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '3', name: 'Left Back', number: 3, role: 'defender', position: { x: 35, y: 75 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '4', name: 'Right Mid', number: 4, role: 'midfielder', position: { x: 65, y: 55 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '5', name: 'Left Mid', number: 5, role: 'midfielder', position: { x: 35, y: 55 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '6', name: 'Right Striker', number: 6, role: 'forward', position: { x: 65, y: 35 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '7', name: 'Left Striker', number: 7, role: 'forward', position: { x: 35, y: 35 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '8', name: 'Sub GK', number: 8, role: 'goalkeeper', position: { x: 0, y: 0 }, isOnField: false, positionEligibility: { goalkeeper: true, defender: false, midfielder: false, forward: false } },
    { id: '9', name: 'Sub DEF', number: 9, role: 'defender', position: { x: 0, y: 0 }, isOnField: false, positionEligibility: { goalkeeper: false, defender: true, midfielder: false, forward: false } },
    { id: '10', name: 'Sub MID', number: 10, role: 'midfielder', position: { x: 0, y: 0 }, isOnField: false, positionEligibility: { goalkeeper: false, defender: false, midfielder: true, forward: false } },
    { id: '11', name: 'Sub FWD', number: 11, role: 'forward', position: { x: 0, y: 0 }, isOnField: false, positionEligibility: { goalkeeper: false, defender: false, midfielder: false, forward: true } },
  ],
  9: [
    { id: '1', name: 'Goalkeeper', number: 1, role: 'goalkeeper', position: { x: 50, y: 95 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '2', name: 'Right Back', number: 2, role: 'defender', position: { x: 75, y: 75 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '3', name: 'Center Back', number: 3, role: 'defender', position: { x: 50, y: 75 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '4', name: 'Left Back', number: 4, role: 'defender', position: { x: 25, y: 75 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '5', name: 'Right Mid', number: 5, role: 'midfielder', position: { x: 75, y: 55 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '6', name: 'Center Mid', number: 6, role: 'midfielder', position: { x: 50, y: 55 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '7', name: 'Left Mid', number: 7, role: 'midfielder', position: { x: 25, y: 55 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '8', name: 'Right Striker', number: 8, role: 'forward', position: { x: 60, y: 35 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '9', name: 'Left Striker', number: 9, role: 'forward', position: { x: 40, y: 35 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '10', name: 'Sub GK', number: 10, role: 'goalkeeper', position: { x: 0, y: 0 }, isOnField: false, positionEligibility: { goalkeeper: true, defender: false, midfielder: false, forward: false } },
    { id: '11', name: 'Sub DEF', number: 11, role: 'defender', position: { x: 0, y: 0 }, isOnField: false, positionEligibility: { goalkeeper: false, defender: true, midfielder: false, forward: false } },
    { id: '12', name: 'Sub MID', number: 12, role: 'midfielder', position: { x: 0, y: 0 }, isOnField: false, positionEligibility: { goalkeeper: false, defender: false, midfielder: true, forward: false } },
    { id: '13', name: 'Sub FWD', number: 13, role: 'forward', position: { x: 0, y: 0 }, isOnField: false, positionEligibility: { goalkeeper: false, defender: false, midfielder: false, forward: true } },
  ],
  11: [
    { id: '1', name: 'Goalkeeper', number: 1, role: 'goalkeeper', position: { x: 50, y: 95 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '2', name: 'Right Back', number: 2, role: 'defender', position: { x: 80, y: 75 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '3', name: 'Center Back', number: 3, role: 'defender', position: { x: 60, y: 75 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '4', name: 'Center Back', number: 4, role: 'defender', position: { x: 40, y: 75 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '5', name: 'Left Back', number: 5, role: 'defender', position: { x: 20, y: 75 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '6', name: 'Right Mid', number: 6, role: 'midfielder', position: { x: 75, y: 55 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '7', name: 'Center Mid', number: 7, role: 'midfielder', position: { x: 60, y: 55 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '8', name: 'Center Mid', number: 8, role: 'midfielder', position: { x: 40, y: 55 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '9', name: 'Left Mid', number: 9, role: 'midfielder', position: { x: 25, y: 55 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '10', name: 'Striker', number: 10, role: 'forward', position: { x: 40, y: 35 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '11', name: 'Striker', number: 11, role: 'forward', position: { x: 60, y: 35 }, isOnField: true, positionEligibility: createDefaultPositionEligibility() },
    { id: '12', name: 'Sub GK', number: 12, role: 'goalkeeper', position: { x: 0, y: 0 }, isOnField: false, positionEligibility: { goalkeeper: true, defender: false, midfielder: false, forward: false } },
    { id: '13', name: 'Sub DEF', number: 13, role: 'defender', position: { x: 0, y: 0 }, isOnField: false, positionEligibility: { goalkeeper: false, defender: true, midfielder: false, forward: false } },
    { id: '14', name: 'Sub MID', number: 14, role: 'midfielder', position: { x: 0, y: 0 }, isOnField: false, positionEligibility: { goalkeeper: false, defender: false, midfielder: true, forward: false } },
    { id: '15', name: 'Sub FWD', number: 15, role: 'forward', position: { x: 0, y: 0 }, isOnField: false, positionEligibility: { goalkeeper: false, defender: false, midfielder: false, forward: true } },
  ]
};

const DEFAULT_BALL_POSITION = { x: 50, y: 50 };

const getAvailableFormations = (teamSize: TeamSize): string[] => {
  const formations = Object.keys(FORMATION_ROLE_REQUIREMENTS[teamSize]);
  return formations;
};

const enforceGoalkeeperPosition = (players: Player[], orientation: PitchOrientation): Player[] => {
  return players.map(player => {
    if (player.role === 'goalkeeper' && player.isOnField) {
      const correctPosition = orientation === 'portrait' 
        ? { x: 50, y: 95 }
        : { x: 5, y: 50 };
      return { ...player, position: correctPosition };
    }
    return player;
  });
};

const reassignPlayerRoles = (players: Player[], formation: FormationType, teamSize: TeamSize): Player[] => {
  if (formation === 'Custom') {
    return players;
  }

  const requirements = FORMATION_ROLE_REQUIREMENTS[teamSize][formation];
  if (!requirements) {
    return players;
  }

  const fieldPlayers = players.filter(p => p.isOnField);
  const benchPlayers = players.filter(p => !p.isOnField);
  
  const goalkeeper = fieldPlayers.find(p => p.role === 'goalkeeper');
  const outfieldPlayers = fieldPlayers.filter(p => p.role !== 'goalkeeper');
  
  if (!goalkeeper || outfieldPlayers.length !== teamSize - 1) {
    return players;
  }

  const reassignedPlayers: Player[] = [goalkeeper];
  
  const roleAssignments: { role: Player['role']; count: number }[] = [
    { role: 'defender', count: requirements.defenders },
    { role: 'midfielder', count: requirements.midfielders },
    { role: 'forward', count: requirements.forwards }
  ];

  const sortedOutfieldPlayers = [...outfieldPlayers].sort((a, b) => {
    if (Math.abs(a.position.y - b.position.y) > 5) {
      return b.position.y - a.position.y;
    }
    return a.position.x - b.position.x;
  });

  let playerIndex = 0;
  
  for (const roleAssignment of roleAssignments) {
    for (let i = 0; i < roleAssignment.count; i++) {
      if (playerIndex < sortedOutfieldPlayers.length) {
        reassignedPlayers.push({
          ...sortedOutfieldPlayers[playerIndex],
          role: roleAssignment.role
        });
        playerIndex++;
      }
    }
  }

  return [...reassignedPlayers, ...benchPlayers];
};

const createPlayersForFormation = (teamSize: TeamSize, formation: FormationType): Player[] => {
  const requirements = FORMATION_ROLE_REQUIREMENTS[teamSize][formation];
  if (!requirements || formation === 'Custom') {
    return DEFAULT_PLAYERS_BY_SIZE[teamSize];
  }

  const players: Player[] = [];
  let playerId = 1;
  let playerNumber = 1;

  players.push({
    id: playerId.toString(),
    name: 'Goalkeeper',
    number: playerNumber,
    role: 'goalkeeper',
    position: { x: 50, y: 95 },
    isOnField: true,
    positionEligibility: createDefaultPositionEligibility()
  });
  playerId++;
  playerNumber++;

  for (let i = 0; i < requirements.defenders; i++) {
    players.push({
      id: playerId.toString(),
      name: `Defender ${i + 1}`,
      number: playerNumber,
      role: 'defender',
      position: { x: 30 + (i * 40 / Math.max(1, requirements.defenders - 1)), y: 75 },
      isOnField: true,
      positionEligibility: createDefaultPositionEligibility()
    });
    playerId++;
    playerNumber++;
  }

  for (let i = 0; i < requirements.midfielders; i++) {
    players.push({
      id: playerId.toString(),
      name: `Midfielder ${i + 1}`,
      number: playerNumber,
      role: 'midfielder',
      position: { x: 25 + (i * 50 / Math.max(1, requirements.midfielders - 1)), y: 55 },
      isOnField: true,
      positionEligibility: createDefaultPositionEligibility()
    });
    playerId++;
    playerNumber++;
  }

  for (let i = 0; i < requirements.forwards; i++) {
    players.push({
      id: playerId.toString(),
      name: `Forward ${i + 1}`,
      number: playerNumber,
      role: 'forward',
      position: { x: 40 + (i * 20 / Math.max(1, requirements.forwards - 1)), y: 35 },
      isOnField: true,
      positionEligibility: createDefaultPositionEligibility()
    });
    playerId++;
    playerNumber++;
  }

  const substitutes = [
    { role: 'goalkeeper' as const, name: 'Sub GK', eligibility: { goalkeeper: true, defender: false, midfielder: false, forward: false } },
    { role: 'defender' as const, name: 'Sub DEF', eligibility: { goalkeeper: false, defender: true, midfielder: false, forward: false } },
    { role: 'midfielder' as const, name: 'Sub MID', eligibility: { goalkeeper: false, defender: false, midfielder: true, forward: false } },
    { role: 'forward' as const, name: 'Sub FWD', eligibility: { goalkeeper: false, defender: false, midfielder: false, forward: true } }
  ];

  for (const sub of substitutes) {
    players.push({
      id: playerId.toString(),
      name: sub.name,
      number: playerNumber,
      role: sub.role,
      position: { x: 0, y: 0 },
      isOnField: false,
      positionEligibility: sub.eligibility
    });
    playerId++;
    playerNumber++;
  }

  return players;
};

const mapFormationToBackend = (formation: FormationType): Formation => {
  const formationMap: Record<string, Formation> = {
    '4-4-2': Formation.fourFourTwo,
    '4-3-3': Formation.fourThreeThree,
    '3-5-2': Formation.threeFiveTwo,
    '4-2-3-1': Formation.fourTwoThreeOne,
    'Custom': Formation.custom
  };
  
  return formationMap[formation] || Formation.custom;
};

export default function PitchBoard() {
  const { clear, identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();
  
  console.log('🏟️ [PITCH BOARD] Component rendering, principal:', principal?.toString());
  
  useViewportHeight();
  
  const { data: backendTimePerHalf, isLoading: isLoadingTimePerHalf } = useGetTimePerHalf();
  const setTimePerHalfMutation = useSetTimePerHalf();
  const { data: backendSpeedMode, isLoading: isLoadingSpeedMode } = useGetSubstitutionSpeedMode();
  const setSpeedModeMutation = useSetSubstitutionSpeedMode();
  const { data: backendMaxSimultaneousSubs, isLoading: isLoadingMaxSubs } = useGetMaxSimultaneousSubs();
  const setMaxSimultaneousSubsMutation = useSetMaxSimultaneousSubs();
  
  const generateScheduleMutation = useGenerateSubstitutionSchedule();
  const { data: backendSchedule } = useGetSubstitutionSchedule(LINEUP_ID);
  const clearScheduleMutation = useClearSubstitutionSchedule();
  const ensureLineupMutation = useEnsureLineupExists();
  
  // Get user profile to check if user is app admin
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
  const isAppAdmin = useMemo(() => {
    const result = userProfile?.roles?.includes(UserRole.appAdmin) || false;
    console.log('🏟️ [PITCH BOARD] isAppAdmin:', result, 'userProfile:', userProfile);
    return result;
  }, [userProfile]);
  
  // Club and team selection with proper loading states and error handling
  const { data: teamsAndClubsData, isLoading: teamsAndClubsLoading, error: teamsAndClubsError } = useGetCallerTeamsAndClubs();
  const { data: allClubs = [], isLoading: allClubsLoading, error: allClubsError } = useGetAllClubs();
  
  console.log('🏟️ [PITCH BOARD] Teams and clubs data:', teamsAndClubsData);
  console.log('🏟️ [PITCH BOARD] All clubs data:', allClubs);
  console.log('🏟️ [PITCH BOARD] Loading states - teamsAndClubs:', teamsAndClubsLoading, 'allClubs:', allClubsLoading);
  console.log('🏟️ [PITCH BOARD] Errors - teamsAndClubs:', teamsAndClubsError, 'allClubs:', allClubsError);
  
  const userClubs = teamsAndClubsData?.clubs || [];
  const userTeams = teamsAndClubsData?.teams || [];
  
  const [selectedClubId, setSelectedClubId] = useState<string | undefined>(undefined);
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(undefined);
  
  // Determine which clubs to show based on user role
  const availableClubs = useMemo(() => {
    const clubs = isAppAdmin ? allClubs : userClubs;
    console.log('🏟️ [PITCH BOARD] Available clubs:', clubs, 'isAppAdmin:', isAppAdmin);
    return clubs;
  }, [isAppAdmin, allClubs, userClubs]);
  
  // Filter teams by selected club
  const availableTeams = useMemo(() => {
    if (!selectedClubId) {
      console.log('🏟️ [PITCH BOARD] No club selected, returning empty teams array');
      return [];
    }
    const teams = userTeams.filter(team => team.clubId === selectedClubId);
    console.log('🏟️ [PITCH BOARD] Available teams for club', selectedClubId, ':', teams);
    return teams;
  }, [selectedClubId, userTeams]);
  
  const deviceOrientation = useDeviceOrientation();
  
  const [teamSize, setTeamSize] = useState<TeamSize>(7);
  const [players, setPlayers] = useState<Player[]>(DEFAULT_PLAYERS_BY_SIZE[7]);
  const [soccerBall, setSoccerBall] = useState<SoccerBall>({ position: DEFAULT_BALL_POSITION });
  const [formation, setFormation] = useState<FormationType>('2-2-2');
  const [pitchOrientation, setPitchOrientation] = useState<PitchOrientation>('portrait');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const [drawingElements, setDrawingElements] = useState<DrawingElement[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingTool, setDrawingTool] = useState<'arrow' | 'freehand'>('arrow');
  const [isDrawingToolsOpen, setIsDrawingToolsOpen] = useState(false);

  const [timerData, setTimerData] = useState<MatchTimerData>({
    halfDuration: 20,
    currentHalf: 'first',
    timeRemaining: 20 * 60,
    state: 'idle'
  });

  const [timePerHalf, setTimePerHalf] = useState<number>(20);
  const [sliderPreviewValue, setSliderPreviewValue] = useState<number | null>(null);
  const [speedMode, setSpeedMode] = useState<SubstitutionSpeedMode>(SubstitutionSpeedMode.medium);
  const [maxSimultaneousSubs, setMaxSimultaneousSubs] = useState<number>(2);
  const [isScheduleReviewOpen, setIsScheduleReviewOpen] = useState(false);

  // Side panel swipe state with callback to update CSS variable
  const sidePanelSwipe = useSidePanelSwipe({
    panelWidth: 320,
    threshold: 80,
    onStateChange: (isOpen) => {
      // Update CSS variable for responsive pitch sizing
      const panelWidth = isOpen ? 'clamp(280px, 32vw, 400px)' : '0px';
      document.documentElement.style.setProperty('--side-panel-width', panelWidth);
    }
  });

  // Initialize CSS variable on mount
  useEffect(() => {
    const panelWidth = sidePanelSwipe.isOpen ? 'clamp(280px, 32vw, 400px)' : '0px';
    document.documentElement.style.setProperty('--side-panel-width', panelWidth);
  }, [sidePanelSwipe.isOpen]);

  // Load team players when a team is selected with proper error handling
  useEffect(() => {
    console.log('🏟️ [PITCH BOARD] Team selection effect triggered');
    console.log('🏟️ [PITCH BOARD] selectedTeamId:', selectedTeamId);
    console.log('🏟️ [PITCH BOARD] teamsAndClubsLoading:', teamsAndClubsLoading);
    console.log('🏟️ [PITCH BOARD] userTeams:', userTeams);
    
    if (selectedTeamId && !teamsAndClubsLoading) {
      const selectedTeam = userTeams.find(t => t.id === selectedTeamId);
      
      console.log('🏟️ [PITCH BOARD] Selected team:', selectedTeam);
      
      if (!selectedTeam) {
        console.warn('⚠️ [PITCH BOARD] Selected team not found in available teams');
        toast.error('Team not found. Please select a different team.');
        setSelectedTeamId(undefined);
        return;
      }
      
      if (selectedTeam.players && selectedTeam.players.length > 0) {
        try {
          console.log('🏟️ [PITCH BOARD] Converting backend players to frontend format');
          // Convert backend players to frontend format
          const teamPlayers = selectedTeam.players.map(backendPlayerToPlayer);
          
          // Set all players as bench initially, user can customize
          const benchPlayers = teamPlayers.map(p => ({
            ...p,
            isOnField: false,
            position: { x: 0, y: 0 }
          }));
          
          console.log('✅ [PITCH BOARD] Loaded', teamPlayers.length, 'players from team');
          setPlayers(benchPlayers);
          toast.success(`Loaded ${teamPlayers.length} players from ${selectedTeam.name}`);
        } catch (error) {
          console.error('❌ [PITCH BOARD] Error loading team players:', error);
          toast.error('Failed to load team players. Please try again.');
        }
      } else {
        // Team has no players yet
        console.log('ℹ️ [PITCH BOARD] Team has no players yet');
        toast.info(`${selectedTeam.name} has no players yet. Add players in the Teams section.`);
        setPlayers([]);
      }
    }
  }, [selectedTeamId, userTeams, teamsAndClubsLoading]);

  // Convert backend schedule to frontend format for display
  const substitutionSchedule = useMemo(() => {
    if (!backendSchedule) return [];
    
    return backendSchedule.substitutions.map(sub => {
      const fieldPlayer = players.find(p => p.id === sub.fieldPlayerId);
      const benchPlayer = players.find(p => p.id === sub.benchPlayerId);
      
      if (!fieldPlayer || !benchPlayer) return null;
      
      return {
        time: Number(sub.time),
        fieldPlayer,
        benchPlayer,
        executed: false,
      };
    }).filter((sub): sub is NonNullable<typeof sub> => sub !== null);
  }, [backendSchedule, players]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) {
      const newPitchOrientation: PitchOrientation = deviceOrientation === 'landscape' ? 'landscape' : 'portrait';
      
      if (newPitchOrientation !== pitchOrientation) {
        handleOrientationChange(newPitchOrientation);
      }
    }
  }, [deviceOrientation, isMobile, pitchOrientation]);

  useEffect(() => {
    if (backendTimePerHalf !== undefined && !isLoadingTimePerHalf) {
      setTimePerHalf(backendTimePerHalf);
      setTimerData(prev => ({
        ...prev,
        halfDuration: backendTimePerHalf,
        timeRemaining: prev.state === 'idle' ? backendTimePerHalf * 60 : prev.timeRemaining
      }));
    }
  }, [backendTimePerHalf, isLoadingTimePerHalf]);

  useEffect(() => {
    if (backendSpeedMode !== undefined && !isLoadingSpeedMode) {
      setSpeedMode(backendSpeedMode);
    }
  }, [backendSpeedMode, isLoadingSpeedMode]);

  useEffect(() => {
    if (backendMaxSimultaneousSubs !== undefined && !isLoadingMaxSubs) {
      setMaxSimultaneousSubs(backendMaxSimultaneousSubs);
    }
  }, [backendMaxSimultaneousSubs, isLoadingMaxSubs]);

  useEffect(() => {
    const savedPlayers = localStorage.getItem('formup.players:default');
    const savedBall = localStorage.getItem('formup.ball:default');
    const savedFormation = localStorage.getItem('formup.formation:default');
    const savedOrientation = localStorage.getItem('formup.orientation:default');
    const savedTeamSize = localStorage.getItem('formup.teamSize:default');
    const savedDrawingElements = localStorage.getItem('formup.drawings:default');
    const savedTimerData = localStorage.getItem('formup.timer:default');
    const savedClubId = localStorage.getItem('formup.selectedClubId:default');
    const savedTeamId = localStorage.getItem('formup.selectedTeamId:default');
    
    const defaultOrientation: PitchOrientation = 'portrait';
    const loadedOrientation = (savedOrientation && ['portrait', 'landscape'].includes(savedOrientation)) 
      ? savedOrientation as PitchOrientation 
      : defaultOrientation;
    
    if (savedTeamSize && [7, 9, 11].includes(parseInt(savedTeamSize))) {
      const size = parseInt(savedTeamSize) as TeamSize;
      setTeamSize(size);
      
      if (savedPlayers) {
        try {
          const loadedPlayers = JSON.parse(savedPlayers);
          const validatedPlayers = loadedPlayers.map((p: any) => ensurePositionEligibility(p));
          const finalPlayers = enforceGoalkeeperPosition(validatedPlayers, loadedOrientation);
          setPlayers(finalPlayers);
        } catch (error) {
          console.error('Failed to load saved players:', error);
          toast.error('Failed to load saved players. Using defaults.');
          const defaultPlayers = enforceGoalkeeperPosition(DEFAULT_PLAYERS_BY_SIZE[size], loadedOrientation);
          setPlayers(defaultPlayers);
        }
      } else {
        const defaultPlayers = enforceGoalkeeperPosition(DEFAULT_PLAYERS_BY_SIZE[size], loadedOrientation);
        setPlayers(defaultPlayers);
      }
      
      if (savedFormation && getAvailableFormations(size).includes(savedFormation)) {
        setFormation(savedFormation as FormationType);
      } else {
        const defaultFormations: Record<TeamSize, FormationType> = {
          7: '2-2-2',
          9: '3-3-2',
          11: '4-4-2'
        };
        setFormation(defaultFormations[size]);
      }
    } else {
      setTeamSize(7);
      const defaultPlayers = enforceGoalkeeperPosition(createPlayersForFormation(7, '2-2-2'), loadedOrientation);
      setPlayers(defaultPlayers);
      setFormation('2-2-2');
    }

    if (savedBall) {
      try {
        const loadedBall = JSON.parse(savedBall);
        setSoccerBall(loadedBall);
      } catch (error) {
        console.error('Failed to load saved ball position:', error);
        setSoccerBall({ position: DEFAULT_BALL_POSITION });
      }
    }

    if (savedDrawingElements) {
      try {
        const loadedDrawings = JSON.parse(savedDrawingElements);
        setDrawingElements(loadedDrawings);
      } catch (error) {
        console.error('Failed to load saved drawings:', error);
        setDrawingElements([]);
      }
    }

    if (savedTimerData) {
      try {
        const loadedTimer = JSON.parse(savedTimerData);
        setTimerData(loadedTimer);
      } catch (error) {
        console.error('Failed to load saved timer data:', error);
      }
    }

    if (savedClubId) {
      console.log('🏟️ [PITCH BOARD] Loading saved club ID:', savedClubId);
      setSelectedClubId(savedClubId);
    }

    if (savedTeamId) {
      console.log('🏟️ [PITCH BOARD] Loading saved team ID:', savedTeamId);
      setSelectedTeamId(savedTeamId);
    }

    setPitchOrientation(loadedOrientation);
  }, []);

  useEffect(() => {
    try {
      const playersToSave = enforceGoalkeeperPosition(players, pitchOrientation);
      localStorage.setItem('formup.players:default', JSON.stringify(playersToSave));
      localStorage.setItem('formup.ball:default', JSON.stringify(soccerBall));
      localStorage.setItem('formup.formation:default', formation);
      localStorage.setItem('formup.orientation:default', pitchOrientation);
      localStorage.setItem('formup.teamSize:default', teamSize.toString());
      localStorage.setItem('formup.drawings:default', JSON.stringify(drawingElements));
      localStorage.setItem('formup.timer:default', JSON.stringify(timerData));
      if (selectedClubId) {
        localStorage.setItem('formup.selectedClubId:default', selectedClubId);
      }
      if (selectedTeamId) {
        localStorage.setItem('formup.selectedTeamId:default', selectedTeamId);
      }
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }, [players, soccerBall, formation, pitchOrientation, teamSize, drawingElements, timerData, selectedClubId, selectedTeamId]);

  const handleTimePerHalfChangeCommit = useCallback((newTimePerHalf: number) => {
    setTimePerHalfMutation.mutate(newTimePerHalf, {
      onSuccess: () => {
        setTimePerHalf(newTimePerHalf);
        setSliderPreviewValue(null);
        setTimerData(prev => ({
          ...prev,
          halfDuration: newTimePerHalf,
          timeRemaining: newTimePerHalf * 60,
          state: 'idle',
          currentHalf: 'first'
        }));
        clearScheduleMutation.mutate(LINEUP_ID, {
          onError: (error) => {
            console.error('Failed to clear schedule:', error);
          }
        });
      },
      onError: (error) => {
        console.error('Failed to update time per half in backend:', error);
        toast.error('Failed to save time setting');
        setSliderPreviewValue(null);
      }
    });
  }, [setTimePerHalfMutation, clearScheduleMutation]);

  const handleTimePerHalfChangePreview = useCallback((value: number[]) => {
    const newTimePerHalf = value[0];
    setSliderPreviewValue(newTimePerHalf);
  }, []);

  const handleSpeedModeChange = useCallback((newMode: SubstitutionSpeedMode) => {
    setSpeedMode(newMode);

    setSpeedModeMutation.mutate(newMode, {
      onError: (error) => {
        console.error('Failed to update speed mode in backend:', error);
        toast.error('Failed to save speed mode setting');
      }
    });

    clearScheduleMutation.mutate(LINEUP_ID, {
      onError: (error) => {
        console.error('Failed to clear schedule:', error);
      }
    });
  }, [setSpeedModeMutation, clearScheduleMutation]);

  const handleMaxSimultaneousSubsChange = useCallback((newMaxSubs: number) => {
    setMaxSimultaneousSubs(newMaxSubs);

    setMaxSimultaneousSubsMutation.mutate(newMaxSubs, {
      onError: (error) => {
        console.error('Failed to update max simultaneous subs in backend:', error);
        toast.error('Failed to save max simultaneous subs setting');
      }
    });

    clearScheduleMutation.mutate(LINEUP_ID, {
      onError: (error) => {
        console.error('Failed to clear schedule:', error);
      }
    });
  }, [setMaxSimultaneousSubsMutation, clearScheduleMutation]);

  const handleTeamSizeChange = useCallback((newTeamSize: TeamSize) => {
    const defaultFormations: Record<TeamSize, FormationType> = {
      7: '2-2-2',
      9: '3-3-2',
      11: '4-4-2'
    };
    
    const newFormation = defaultFormations[newTeamSize];
    
    let newPlayers = createPlayersForFormation(newTeamSize, newFormation);
    
    const currentPlayers = players;
    const updatedPlayers = newPlayers.map((newPlayer, index) => {
      const existingPlayer = currentPlayers[index];
      if (existingPlayer && existingPlayer.role === newPlayer.role) {
        return {
          ...newPlayer,
          name: existingPlayer.name,
          number: existingPlayer.number,
          positionEligibility: existingPlayer.positionEligibility || newPlayer.positionEligibility
        };
      }
      return newPlayer;
    });
    
    const finalPlayers = enforceGoalkeeperPosition(updatedPlayers, pitchOrientation);
    
    setPlayers(finalPlayers);
    setTeamSize(newTeamSize);
    setFormation(newFormation);
    
    setSoccerBall({ position: DEFAULT_BALL_POSITION });
    clearScheduleMutation.mutate(LINEUP_ID, {
      onError: (error) => {
        console.error('Failed to clear schedule:', error);
      }
    });
  }, [players, pitchOrientation, clearScheduleMutation]);

  const handleFormationChange = useCallback((newFormation: FormationType) => {
    if (newFormation === 'Custom') {
      setFormation(newFormation);
      return;
    }

    const playersWithCorrectRoles = reassignPlayerRoles(players, newFormation, teamSize);

    const formationPositions = pitchOrientation === 'portrait' 
      ? PORTRAIT_FORMATION_POSITIONS[teamSize]
      : LANDSCAPE_FORMATION_POSITIONS[teamSize];
    
    const positions = formationPositions[newFormation];
    if (!positions) return;
    
    const fieldPlayers = playersWithCorrectRoles.filter(p => p.isOnField).slice(0, teamSize);
    
    const sortedPlayers = fieldPlayers.sort((a, b) => {
      if (a.role === 'goalkeeper' && b.role !== 'goalkeeper') return -1;
      if (b.role === 'goalkeeper' && a.role !== 'goalkeeper') return 1;
      
      const roleOrder = { 'defender': 1, 'midfielder': 2, 'forward': 3 };
      const aOrder = roleOrder[a.role as keyof typeof roleOrder] || 4;
      const bOrder = roleOrder[b.role as keyof typeof roleOrder] || 4;
      
      return aOrder - bOrder;
    });
    
    const finalPositions = positions;
    
    const updatedPlayers = players.map(player => {
      const updatedPlayer = playersWithCorrectRoles.find(p => p.id === player.id) || player;
      
      if (!updatedPlayer.isOnField) return updatedPlayer;
      
      const index = sortedPlayers.findIndex(p => p.id === player.id);
      if (index >= 0 && index < finalPositions.length) {
        let newPosition = finalPositions[index];
        
        if (updatedPlayer.role === 'goalkeeper') {
          newPosition = pitchOrientation === 'portrait' 
            ? { x: 50, y: 95 } 
            : { x: 5, y: 50 };
        }
        
        return { ...updatedPlayer, position: newPosition };
      }
      return updatedPlayer;
    });
    
    const finalPlayers = enforceGoalkeeperPosition(updatedPlayers, pitchOrientation);
    setPlayers(finalPlayers);
    setFormation(newFormation);
    
    setSoccerBall({ position: DEFAULT_BALL_POSITION });
  }, [players, pitchOrientation, teamSize]);

  const handleOrientationChange = useCallback((newOrientation: PitchOrientation) => {
    setPitchOrientation(newOrientation);
    
    const updatedPlayers = players.map(player => {
      if (!player.isOnField) return player;
      
      let newPosition = player.position;
      
      if (pitchOrientation === 'portrait' && newOrientation === 'landscape') {
        if (player.role === 'goalkeeper') {
          newPosition = { x: 5, y: 50 };
        } else {
          newPosition = {
            x: 100 - player.position.y,
            y: player.position.x
          };
        }
      } else if (pitchOrientation === 'landscape' && newOrientation === 'portrait') {
        if (player.role === 'goalkeeper') {
          newPosition = { x: 50, y: 95 };
        } else {
          newPosition = {
            x: player.position.y,
            y: 100 - player.position.x
          };
        }
      }
      
      return { ...player, position: newPosition };
    });
    
    let newBallPosition = soccerBall.position;
    if (pitchOrientation === 'portrait' && newOrientation === 'landscape') {
      newBallPosition = {
        x: 100 - soccerBall.position.y,
        y: soccerBall.position.x
      };
    } else if (pitchOrientation === 'landscape' && newOrientation === 'portrait') {
      newBallPosition = {
        x: soccerBall.position.y,
        y: 100 - soccerBall.position.x
      };
    }
    
    const transformedDrawingElements = drawingElements.map(element => {
      const transformedPoints = element.points.map(point => {
        if (pitchOrientation === 'portrait' && newOrientation === 'landscape') {
          return { x: 100 - point.y, y: point.x };
        } else if (pitchOrientation === 'landscape' && newOrientation === 'portrait') {
          return { x: point.y, y: 100 - point.x };
        }
        return point;
      });
      
      return { ...element, points: transformedPoints };
    });
    
    const finalPlayers = enforceGoalkeeperPosition(updatedPlayers, newOrientation);
    setPlayers(finalPlayers);
    setSoccerBall({ position: newBallPosition });
    setDrawingElements(transformedDrawingElements);
    
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [pitchOrientation, players, soccerBall, drawingElements]);

  const handlePlayerMove = useCallback((playerId: string, newPosition: { x: number; y: number }) => {
    setPlayers(prev => prev.map(player => {
      if (player.id === playerId) {
        if (player.role === 'goalkeeper') {
          let constrainedPosition = newPosition;
          
          if (pitchOrientation === 'portrait') {
            constrainedPosition = {
              x: Math.min(98, Math.max(2, newPosition.x)),
              y: Math.min(98, Math.max(85, newPosition.y))
            };
          } else {
            constrainedPosition = {
              x: Math.min(15, Math.max(2, newPosition.x)),
              y: Math.min(98, Math.max(2, newPosition.y))
            };
          }
          
          return { ...player, position: constrainedPosition };
        }
        
        return { ...player, position: newPosition };
      }
      return player;
    }));
    
    if (formation !== 'Custom') {
      setFormation('Custom');
    }
  }, [formation, pitchOrientation]);

  const handleBallMove = useCallback((newPosition: { x: number; y: number }) => {
    setSoccerBall({ position: newPosition });
  }, []);

  const handlePlayerUpdate = useCallback((playerId: string, updates: Partial<Player>) => {
    setPlayers(prev => {
      const updated = prev.map(player => {
        if (player.id === playerId) {
          const updatedPlayer = { ...player, ...updates };
          return ensurePositionEligibility(updatedPlayer);
        }
        return player;
      });
      return updated;
    });
  }, []);

  const handleAddPlayer = useCallback(() => {
    const maxNumber = Math.max(...players.map(p => p.number), 0);
    const newPlayer: Player = {
      id: `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Player ${maxNumber + 1}`,
      number: maxNumber + 1,
      role: 'midfielder',
      position: { x: 0, y: 0 },
      isOnField: false,
      positionEligibility: { goalkeeper: false, defender: false, midfielder: true, forward: false }
    };
    
    setPlayers(prev => {
      const updated = [...prev, newPlayer];
      return updated;
    });
    
    toast.success('Player added to bench');
  }, [players]);

  const handleRemovePlayer = useCallback((playerId: string) => {
    setPlayers(prev => prev.filter(p => p.id !== playerId));
    toast.success('Player removed');
  }, []);

  const handlePromotePlayer = useCallback((playerId: string) => {
    const fieldPlayers = players.filter(p => p.isOnField);
    if (fieldPlayers.length >= teamSize) {
      toast.error(`Cannot add more than ${teamSize} players to the field`);
      return;
    }

    const player = players.find(p => p.id === playerId);
    let defaultPosition = { x: 50, y: 50 };
    
    if (player?.role === 'goalkeeper') {
      if (pitchOrientation === 'portrait') {
        defaultPosition = { x: 50, y: 95 };
      } else {
        defaultPosition = { x: 5, y: 50 };
      }
    }

    const updatedPlayers = players.map(player => 
      player.id === playerId 
        ? { ...player, isOnField: true, position: defaultPosition }
        : player
    );
    
    const finalPlayers = enforceGoalkeeperPosition(updatedPlayers, pitchOrientation);
    setPlayers(finalPlayers);
    toast.success('Player added to field');
  }, [players, pitchOrientation, teamSize]);

  const handleDemotePlayer = useCallback((playerId: string) => {
    setPlayers(prev => prev.map(player => 
      player.id === playerId 
        ? { ...player, isOnField: false, position: { x: 0, y: 0 } }
        : player
    ));
    toast.success('Player moved to bench');
  }, []);

  const handleSubstitutePlayer = useCallback((fieldPlayerId: string, benchPlayerId: string) => {
    const fieldPlayer = players.find(p => p.id === fieldPlayerId);
    const benchPlayer = players.find(p => p.id === benchPlayerId);

    if (!fieldPlayer || !benchPlayer) {
      toast.error('Player not found');
      return;
    }

    const eligibility = benchPlayer.positionEligibility || {
      goalkeeper: false,
      defender: false,
      midfielder: false,
      forward: false
    };

    const isEligible = eligibility[fieldPlayer.role];

    if (!isEligible) {
      const eligiblePositions = Object.entries(eligibility)
        .filter(([_, eligible]) => eligible)
        .map(([position]) => {
          const roleMap: Record<string, string> = {
            goalkeeper: 'Goalkeeper',
            defender: 'Defender',
            midfielder: 'Midfielder',
            forward: 'Forward'
          };
          return roleMap[position] || position;
        });

      const eligibilityText = eligiblePositions.length > 0 
        ? eligiblePositions.join(', ')
        : 'No positions';

      const roleMap: Record<string, string> = {
        goalkeeper: 'Goalkeeper',
        defender: 'Defender',
        midfielder: 'Midfielder',
        forward: 'Forward'
      };

      toast.error(
        `${benchPlayer.name} cannot substitute for ${roleMap[fieldPlayer.role]}. ` +
        `Eligible for: ${eligibilityText}.`
      );
      return;
    }

    const updatedPlayers = players.map(player => {
      if (player.id === fieldPlayerId) {
        return { ...player, isOnField: false, position: { x: 0, y: 0 } };
      }
      if (player.id === benchPlayerId) {
        return { ...player, isOnField: true, position: fieldPlayer.position };
      }
      return player;
    });

    const finalPlayers = enforceGoalkeeperPosition(updatedPlayers, pitchOrientation);
    setPlayers(finalPlayers);
    toast.success(`${benchPlayer.name} substituted for ${fieldPlayer.name}`);
  }, [players, pitchOrientation]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.2, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleToggleDrawingMode = useCallback(() => {
    setIsDrawingMode(prev => !prev);
    setIsDrawingToolsOpen(false);
  }, []);

  const handleExitDrawingMode = useCallback(() => {
    setIsDrawingMode(false);
    setIsDrawingToolsOpen(false);
  }, []);

  const handleDrawingToolChange = useCallback((tool: 'arrow' | 'freehand') => {
    setDrawingTool(tool);
    setIsDrawingMode(true);
    setIsDrawingToolsOpen(false);
  }, []);

  const handleClearDrawings = useCallback(() => {
    setDrawingElements([]);
    toast.success('Drawings cleared');
  }, []);

  const handleTimerUpdate = useCallback((newTimerData: MatchTimerData) => {
    setTimerData(newTimerData);
  }, []);

  const handleGenerateSchedule = useCallback(() => {
    const benchPlayers = players.filter(p => !p.isOnField);
    const fieldPlayers = players.filter(p => p.isOnField);
    
    if (benchPlayers.length === 0) {
      toast.error('No bench players available. Add players to the bench before generating a schedule.');
      return;
    }

    if (fieldPlayers.length === 0) {
      toast.error('No field players available. Add players to the field before generating a schedule.');
      return;
    }

    const backendFormation = mapFormationToBackend(formation);
    const backendPlayers = players.map(playerToBackendPlayer);

    generateScheduleMutation.mutate(
      { 
        lineupId: LINEUP_ID, 
        players: backendPlayers,
        formation: backendFormation,
        timePerHalf: timePerHalf,
        maxSimultaneousSubs: maxSimultaneousSubs,
        onFieldCount: fieldPlayers.length
      }, 
      {
        onSuccess: (schedule) => {
          const numSubstitutions = schedule.substitutions.length;
          toast.success(`Substitution schedule generated with ${numSubstitutions} planned substitution${numSubstitutions !== 1 ? 's' : ''}`);
          setIsScheduleReviewOpen(true);
        },
        onError: (error) => {
          console.error('Failed to generate schedule:', error);
          const errorMessage = error?.message || 'Failed to generate substitution schedule';
          toast.error(errorMessage);
        }
      }
    );
  }, [players, formation, timePerHalf, maxSimultaneousSubs, generateScheduleMutation]);

  const fieldPlayers = players.filter(p => p.isOnField);
  const benchPlayers = players.filter(p => !p.isOnField);
  const availableFormations = getAvailableFormations(teamSize);

  const maxAllowedSimultaneousSubs = Math.max(1, benchPlayers.length);

  useEffect(() => {
    if (maxSimultaneousSubs > maxAllowedSimultaneousSubs) {
      setMaxSimultaneousSubs(maxAllowedSimultaneousSubs);
      setMaxSimultaneousSubsMutation.mutate(maxAllowedSimultaneousSubs, {
        onError: (error) => {
          console.error('Failed to update max simultaneous subs in backend:', error);
        }
      });
    }
  }, [maxAllowedSimultaneousSubs, maxSimultaneousSubs, setMaxSimultaneousSubsMutation]);

  const getSpeedModeDescription = (mode: SubstitutionSpeedMode): string => {
    switch (mode) {
      case SubstitutionSpeedMode.fast:
        return 'More frequent rotations';
      case SubstitutionSpeedMode.medium:
        return 'Moderate rotation frequency';
      case SubstitutionSpeedMode.slow:
        return 'Fewer, longer stints';
      default:
        return '';
    }
  };

  const displayTimePerHalf = sliderPreviewValue !== null ? sliderPreviewValue : timePerHalf;

  const canGenerateSchedule = useMemo(() => {
    if (benchPlayers.length === 0) return false;
    if (fieldPlayers.length === 0) return false;
    return true;
  }, [benchPlayers.length, fieldPlayers.length]);

  // Create player name mapping for preview
  const playerNames = useMemo(() => {
    const names: Record<string, string> = {};
    players.forEach(p => {
      names[p.id] = p.name;
    });
    return names;
  }, [players]);

  const fieldPlayerIds = useMemo(() => fieldPlayers.map(p => p.id), [fieldPlayers]);
  const benchPlayerIds = useMemo(() => benchPlayers.map(p => p.id), [benchPlayers]);

  // Check if there are any errors loading clubs or teams
  const hasLoadingError = teamsAndClubsError || allClubsError;
  const isLoadingData = teamsAndClubsLoading || allClubsLoading || profileLoading;

  console.log('🏟️ [PITCH BOARD] Render state - hasLoadingError:', hasLoadingError, 'isLoadingData:', isLoadingData);

  // Show loading state while data is being fetched
  if (isLoadingData) {
    console.log('⏳ [PITCH BOARD] Showing loading state');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading match view...</p>
        </div>
      </div>
    );
  }

  // Show error state if data failed to load
  if (hasLoadingError) {
    console.error('❌ [PITCH BOARD] Error loading data:', { teamsAndClubsError, allClubsError });
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load clubs and teams. Please refresh the page or try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  console.log('✅ [PITCH BOARD] Rendering main content');

  const MobileControls = () => (
    <div className="flex flex-col space-y-3">
      {/* Club and Team Selection */}
      {(availableClubs.length > 0 || userTeams.length > 0) && (
        <div className="space-y-2 bg-card/50 p-3 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-primary">Match Setup</h3>
            {isAppAdmin && (
              <Badge variant="outline" className="text-xs">App Admin</Badge>
            )}
          </div>
          
          <div className="space-y-2">
            {availableClubs.length > 0 && (
              <Select 
                value={selectedClubId || undefined} 
                onValueChange={(value) => {
                  console.log('🏟️ [PITCH BOARD] Club selected:', value);
                  setSelectedClubId(value || undefined);
                  setSelectedTeamId(undefined);
                }}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Select club..." />
                </SelectTrigger>
                <SelectContent>
                  {availableClubs.map(club => (
                    <SelectItem key={club.id} value={club.id}>
                      {club.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {selectedClubId && availableTeams.length > 0 && (
              <Select 
                value={selectedTeamId || undefined} 
                onValueChange={(value) => {
                  console.log('🏟️ [PITCH BOARD] Team selected:', value);
                  setSelectedTeamId(value || undefined);
                }}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Select team..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTeams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {selectedClubId && availableTeams.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  No teams found for this club. Create a team in the Teams section.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Team Size</span>
        <Select value={teamSize.toString()} onValueChange={(value) => handleTeamSizeChange(parseInt(value) as TeamSize)}>
          <SelectTrigger className="w-32 h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7-a-side</SelectItem>
            <SelectItem value="9">9-a-side</SelectItem>
            <SelectItem value="11">11-a-side</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Formation</span>
        <Select value={formation} onValueChange={handleFormationChange}>
          <SelectTrigger className="w-32 h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableFormations.map(f => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Orientation</span>
        <Select value={pitchOrientation} onValueChange={handleOrientationChange}>
          <SelectTrigger className="w-32 h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="portrait">Portrait</SelectItem>
            <SelectItem value="landscape">Landscape</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Separator />
      
      <div className="space-y-3">
        <div className="text-sm font-semibold text-primary">Settings</div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Time per Half</span>
            <span className="text-sm font-semibold text-primary">{displayTimePerHalf} min</span>
          </div>
          <div
            onPointerUp={() => {
              if (sliderPreviewValue !== null && sliderPreviewValue !== timePerHalf) {
                handleTimePerHalfChangeCommit(sliderPreviewValue);
              }
            }}
            onTouchEnd={() => {
              if (sliderPreviewValue !== null && sliderPreviewValue !== timePerHalf) {
                handleTimePerHalfChangeCommit(sliderPreviewValue);
              }
            }}
          >
            <Slider
              value={[displayTimePerHalf]}
              onValueChange={handleTimePerHalfChangePreview}
              min={20}
              max={45}
              step={5}
              disabled={setTimePerHalfMutation.isPending}
              className="w-full"
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>20 min</span>
            <span>45 min</span>
          </div>
        </div>
        {setTimePerHalfMutation.isPending && (
          <div className="text-xs text-muted-foreground">Saving...</div>
        )}
      </div>
      
      <Separator />

      <div className="space-y-3">
        <div className="text-sm font-semibold text-primary">Automated Substitutions</div>
        <div className="text-xs text-muted-foreground">
          Distributes playing time equally among all players. Speed mode controls rotation frequency.
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Speed Mode</span>
          <Select 
            value={speedMode} 
            onValueChange={(value) => handleSpeedModeChange(value as SubstitutionSpeedMode)}
            disabled={setSpeedModeMutation.isPending}
          >
            <SelectTrigger className="w-32 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SubstitutionSpeedMode.slow}>Slow</SelectItem>
              <SelectItem value={SubstitutionSpeedMode.medium}>Medium</SelectItem>
              <SelectItem value={SubstitutionSpeedMode.fast}>Fast</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">
          {getSpeedModeDescription(speedMode)}
        </div>
        {setSpeedModeMutation.isPending && (
          <div className="text-xs text-muted-foreground">Updating...</div>
        )}
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Max Simultaneous Subs</span>
          <Select 
            value={maxSimultaneousSubs.toString()} 
            onValueChange={(value) => handleMaxSimultaneousSubsChange(parseInt(value))}
            disabled={setMaxSimultaneousSubsMutation.isPending}
          >
            <SelectTrigger className="w-32 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: maxAllowedSimultaneousSubs }, (_, i) => i + 1).map(num => (
                <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">
          Maximum number of substitutions allowed at one time (limited to {maxAllowedSimultaneousSubs} based on bench size)
        </div>
        {setMaxSimultaneousSubsMutation.isPending && (
          <div className="text-xs text-muted-foreground">Updating...</div>
        )}
        
        <MinSubRoundsDisplay
          onFieldPlayers={fieldPlayers.length}
          benchPlayers={benchPlayers.length}
          timePerHalf={timePerHalf}
          maxSimultaneousSubs={maxSimultaneousSubs}
          fieldPlayerIds={fieldPlayerIds}
          benchPlayerIds={benchPlayerIds}
          playerNames={playerNames}
        />
        
        <Button 
          onClick={handleGenerateSchedule} 
          variant="outline" 
          className="w-full h-10"
          disabled={!canGenerateSchedule || generateScheduleMutation.isPending}
        >
          <Calendar className="w-4 h-4 mr-2" />
          {generateScheduleMutation.isPending ? 'Generating...' : 'Generate Schedule'}
        </Button>
        {!canGenerateSchedule && (
          <div className="text-xs text-amber-600 dark:text-amber-400">
            {benchPlayers.length === 0 && 'Add players to the bench to generate a schedule'}
            {fieldPlayers.length === 0 && 'Add players to the field to generate a schedule'}
          </div>
        )}
        {substitutionSchedule.length > 0 && (
          <>
            <div className="text-xs text-muted-foreground">
              {substitutionSchedule.length} substitutions planned
            </div>
            <Button 
              onClick={() => setIsScheduleReviewOpen(true)} 
              variant="outline" 
              className="w-full h-10"
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Review Schedule
            </Button>
          </>
        )}
      </div>
      
      <Separator />
      
      <Button variant="outline" onClick={clear} className="w-full h-12 md:h-10">
        <LogOut className="w-4 h-4 mr-2" />
        Logout
      </Button>
    </div>
  );

  const PitchControlsLandscape = () => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleZoomIn}
          className="flex-1 h-9"
          title="Zoom In"
          disabled={isDrawingMode}
        >
          <ZoomIn className="w-4 h-4 mr-1" />
          Zoom In
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleZoomOut}
          className="flex-1 h-9"
          title="Zoom Out"
          disabled={isDrawingMode}
        >
          <ZoomOut className="w-4 h-4 mr-1" />
          Zoom Out
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleResetView}
          className="flex-1 h-9"
          title="Reset View"
          disabled={isDrawingMode}
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Center
        </Button>
        <Button 
          variant={snapToGrid ? "default" : "outline"} 
          size="sm" 
          onClick={() => setSnapToGrid(!snapToGrid)}
          className="flex-1 h-9"
          title={snapToGrid ? "Disable Grid Snap" : "Enable Grid Snap"}
          disabled={isDrawingMode}
        >
          <Grid3X3 className="w-4 h-4 mr-1" />
          {snapToGrid ? "Grid On" : "Grid Off"}
        </Button>
      </div>
      
      <Separator className="my-2" />
      
      {isDrawingMode ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button 
              variant={drawingTool === 'freehand' ? "default" : "outline"}
              size="sm" 
              onClick={() => setDrawingTool('freehand')}
              className="flex-1 h-9"
              title="Line Tool"
            >
              <Minus className="w-4 h-4 mr-1" />
              Line
            </Button>
            <Button 
              variant={drawingTool === 'arrow' ? "default" : "outline"}
              size="sm" 
              onClick={() => setDrawingTool('arrow')}
              className="flex-1 h-9"
              title="Arrow Tool"
            >
              <ArrowUpRight className="w-4 h-4 mr-1" />
              Arrow
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClearDrawings}
              className="flex-1 h-9"
              title="Clear All Drawings"
              disabled={drawingElements.length === 0}
            >
              <Eraser className="w-4 h-4 mr-1" />
              Clear
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleExitDrawingMode}
              className="flex-1 h-9"
              title="Exit Drawing Mode"
            >
              <X className="w-4 h-4 mr-1" />
              Exit
            </Button>
          </div>
        </div>
      ) : (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleToggleDrawingMode}
          className="w-full h-9"
          title="Enable Drawing Mode"
        >
          <Pencil className="w-4 h-4 mr-1" />
          Start Drawing
        </Button>
      )}
    </div>
  );

  const PitchControlsPortrait = () => (
    <div className="bg-card border-t px-4 py-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleZoomIn}
            className="h-9 w-9 hover:bg-accent flex-shrink-0"
            title="Zoom In"
            disabled={isDrawingMode}
          >
            <ZoomIn className="w-4 h-4 text-foreground" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleZoomOut}
            className="h-9 w-9 hover:bg-accent flex-shrink-0"
            title="Zoom Out"
            disabled={isDrawingMode}
          >
            <ZoomOut className="w-4 h-4 text-foreground" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleResetView}
            className="h-9 w-9 hover:bg-accent flex-shrink-0"
            title="Reset View"
            disabled={isDrawingMode}
          >
            <RotateCcw className="w-4 h-4 text-foreground" />
          </Button>
          <Button 
            variant={snapToGrid ? "default" : "outline"} 
            size="sm" 
            onClick={() => setSnapToGrid(!snapToGrid)}
            className="h-9 w-9 hover:bg-accent flex-shrink-0"
            title={snapToGrid ? "Disable Grid Snap" : "Enable Grid Snap"}
            disabled={isDrawingMode}
          >
            <Grid3X3 className="w-4 h-4 text-foreground" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-8" />
        
        {isDrawingMode ? (
          <>
            <Button 
              variant={drawingTool === 'freehand' ? "default" : "outline"}
              size="sm" 
              onClick={() => setDrawingTool('freehand')}
              className="h-9 w-9 hover:bg-accent flex-shrink-0"
              title="Line Tool"
            >
              <Minus className="w-4 h-4" />
            </Button>
            <Button 
              variant={drawingTool === 'arrow' ? "default" : "outline"}
              size="sm" 
              onClick={() => setDrawingTool('arrow')}
              className="h-9 w-9 hover:bg-accent flex-shrink-0"
              title="Arrow Tool"
            >
              <ArrowUpRight className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClearDrawings}
              className="h-9 w-9 hover:bg-accent flex-shrink-0"
              title="Clear All Drawings"
              disabled={drawingElements.length === 0}
            >
              <Eraser className="w-4 h-4 text-foreground" />
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleExitDrawingMode}
              className="h-9 w-9 hover:bg-destructive/90 flex-shrink-0"
              title="Exit Drawing Mode"
            >
              <X className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <Popover open={isDrawingToolsOpen} onOpenChange={setIsDrawingToolsOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 w-9 hover:bg-accent flex-shrink-0"
                title="Drawing Tools"
              >
                <Pencil className="w-4 h-4 text-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-2" 
              side="top"
              align="center"
            >
              <div className="flex flex-col space-y-2">
                <div className="text-sm font-medium text-center mb-2">Drawing Tools</div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDrawingToolChange('freehand')}
                    className="h-10 w-10 hover:bg-accent"
                    title="Line Tool"
                  >
                    <Minus className="w-4 h-4 text-foreground" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDrawingToolChange('arrow')}
                    className="h-10 w-10 hover:bg-accent"
                    title="Arrow Tool"
                  >
                    <ArrowUpRight className="w-4 h-4 text-foreground" />
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
        
        <Separator orientation="vertical" className="h-8" />
        
        <div className="flex-shrink-0">
          <MatchTimer
            timerData={timerData}
            onTimerUpdate={handleTimerUpdate}
            isMobile={true}
          />
        </div>
      </div>
    </div>
  );

  // Render nav controls using portal
  const navControlsSlot = document.getElementById('nav-controls-slot');
  const navControls = navControlsSlot && createPortal(
    <>
      <Badge variant="outline" className="text-xs">
        {teamSize}v{teamSize}
      </Badge>
      <Badge variant="outline" className="text-xs">
        <Users className="w-3 h-3 mr-1" />
        {fieldPlayers.length}/{teamSize}
      </Badge>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="h-10 w-10">
            <Settings className="w-4 h-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80 flex flex-col p-0 max-h-[100dvh]">
          <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
            <SheetTitle className="flex flex-col items-start gap-1">
              <span>Controls</span>
              <span className="text-xs text-muted-foreground/70 font-medium tracking-wide">Football</span>
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-4">
              <MobileControls />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>,
    navControlsSlot
  );

  if (isMobile) {
    return (
      <div className="h-screen-mobile safe-top safe-bottom app-shell">
        {navControls}
        <div className="app-main pitch-layout">
          <div className={`pitch-area ${pitchOrientation === 'landscape' && sidePanelSwipe.isOpen ? 'panel-open' : ''}`}>
            <div className="pitch-contain">
              <SoccerPitch
                players={fieldPlayers}
                soccerBall={soccerBall}
                onPlayerMove={handlePlayerMove}
                onBallMove={handleBallMove}
                zoom={zoom}
                pan={pan}
                onPanChange={setPan}
                onZoomChange={handleZoomChange}
                snapToGrid={snapToGrid}
                orientation={pitchOrientation}
                teamSize={teamSize}
                drawingElements={drawingElements}
                onDrawingElementsChange={setDrawingElements}
                isDrawingMode={isDrawingMode}
                drawingTool={drawingTool}
              />
            </div>
          </div>

          {pitchOrientation === 'portrait' && (
            <div className="pitch-controls-section">
              <PitchControlsPortrait />
            </div>
          )}

          {pitchOrientation === 'landscape' ? (
            <>
              <div 
                className="side-rail-swipeable"
                style={{
                  transform: sidePanelSwipe.isOpen 
                    ? `translateX(${sidePanelSwipe.offset}px)` 
                    : `translateX(calc(100% + ${sidePanelSwipe.offset}px))`,
                  transition: sidePanelSwipe.isDragging ? 'none' : 'transform 0.15s ease-out'
                }}
                onTouchStart={sidePanelSwipe.handleTouchStart}
                onTouchMove={sidePanelSwipe.handleTouchMove}
                onTouchEnd={sidePanelSwipe.handleTouchEnd}
              >
                <button
                  className="side-panel-toggle"
                  onClick={sidePanelSwipe.togglePanel}
                  aria-label={sidePanelSwipe.isOpen ? "Hide controls" : "Show controls"}
                >
                  {sidePanelSwipe.isOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
                
                <div className="side-rail-content">
                  <div className="flex items-center justify-center mb-2">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8">
                          <Settings className="w-3.5 h-3.5 mr-1" />
                          Settings
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right" className="w-80 flex flex-col p-0 max-h-[100dvh]">
                        <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
                          <SheetTitle className="flex flex-col items-start gap-1">
                            <span>Settings</span>
                            <span className="text-xs text-muted-foreground/70 font-medium tracking-wide">Football</span>
                          </SheetTitle>
                        </SheetHeader>
                        <ScrollArea className="flex-1 overflow-y-auto">
                          <div className="px-6 py-4">
                            <MobileControls />
                          </div>
                        </ScrollArea>
                      </SheetContent>
                    </Sheet>
                  </div>
                  
                  <Separator className="mb-2" />
                  
                  <PitchControlsLandscape />
                  
                  <Separator className="my-2" />
                  
                  <h2 className="text-base font-bold mb-2">Bench</h2>
                  
                  <div className="space-y-2">
                    <PlayerBench
                      players={benchPlayers}
                      fieldPlayers={fieldPlayers}
                      onPlayerUpdate={handlePlayerUpdate}
                      onAddPlayer={handleAddPlayer}
                      onRemovePlayer={handleRemovePlayer}
                      onPromotePlayer={handlePromotePlayer}
                      onDemotePlayer={handleDemotePlayer}
                      onSubstitutePlayer={handleSubstitutePlayer}
                      teamSize={teamSize}
                    />
                  </div>
                </div>
              </div>
              <div className="timer-bar">
                <MatchTimer
                  timerData={timerData}
                  onTimerUpdate={handleTimerUpdate}
                  isMobile={false}
                  isLandscape={true}
                />
              </div>
            </>
          ) : (
            <div className="bench-section">
              <div className="p-4">
                <Drawer>
                  <DrawerTrigger asChild>
                    <Button className="w-full h-12 text-base">
                      <Menu className="w-4 h-4 mr-2" />
                      Manage Players ({benchPlayers.length} on bench)
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-h-[80vh]">
                    <DrawerHeader>
                      <DrawerTitle className="flex flex-col items-start gap-1">
                        <span>Player Management</span>
                        <span className="text-sm text-muted-foreground/70 font-medium tracking-wide">Football</span>
                      </DrawerTitle>
                    </DrawerHeader>
                    <div className="px-4 pb-4 overflow-y-auto">
                      <PlayerBench
                        players={benchPlayers}
                        fieldPlayers={fieldPlayers}
                        onPlayerUpdate={handlePlayerUpdate}
                        onAddPlayer={handleAddPlayer}
                        onRemovePlayer={handleRemovePlayer}
                        onPromotePlayer={handlePromotePlayer}
                        onDemotePlayer={handleDemotePlayer}
                        onSubstitutePlayer={handleSubstitutePlayer}
                        teamSize={teamSize}
                      />
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>
            </div>
          )}
        </div>

        <ScheduleReviewDialog
          isOpen={isScheduleReviewOpen}
          onClose={() => setIsScheduleReviewOpen(false)}
          schedule={substitutionSchedule}
          timePerHalf={timePerHalf}
          allPlayers={players}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {navControls}
      <div className="container mx-auto px-4 py-4 md:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="relative">
                  <SoccerPitch
                    players={fieldPlayers}
                    soccerBall={soccerBall}
                    onPlayerMove={handlePlayerMove}
                    onBallMove={handleBallMove}
                    zoom={zoom}
                    pan={pan}
                    onPanChange={setPan}
                    onZoomChange={handleZoomChange}
                    snapToGrid={snapToGrid}
                    orientation={pitchOrientation}
                    teamSize={teamSize}
                    drawingElements={drawingElements}
                    onDrawingElementsChange={setDrawingElements}
                    isDrawingMode={isDrawingMode}
                    drawingTool={drawingTool}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs">
                  {teamSize}v{teamSize}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {fieldPlayers.length}/{teamSize}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              {/* Club and Team Selection */}
              {(availableClubs.length > 0 || userTeams.length > 0) && (
                <div className="space-y-2 bg-card/50 p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-primary">Match Setup</h3>
                    {isAppAdmin && (
                      <Badge variant="outline" className="text-xs">App Admin</Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {availableClubs.length > 0 && (
                      <Select 
                        value={selectedClubId || undefined} 
                        onValueChange={(value) => {
                          console.log('🏟️ [PITCH BOARD] Club selected:', value);
                          setSelectedClubId(value || undefined);
                          setSelectedTeamId(undefined);
                        }}
                      >
                        <SelectTrigger className="w-full h-9">
                          <SelectValue placeholder="Select club..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableClubs.map(club => (
                            <SelectItem key={club.id} value={club.id}>
                              {club.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    {selectedClubId && availableTeams.length > 0 && (
                      <Select 
                        value={selectedTeamId || undefined} 
                        onValueChange={(value) => {
                          console.log('🏟️ [PITCH BOARD] Team selected:', value);
                          setSelectedTeamId(value || undefined);
                        }}
                      >
                        <SelectTrigger className="w-full h-9">
                          <SelectValue placeholder="Select team..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTeams.map(team => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {selectedClubId && availableTeams.length === 0 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          No teams found for this club. Create a team in the Teams section.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              )}

              <Select value={teamSize.toString()} onValueChange={(value) => handleTeamSizeChange(parseInt(value) as TeamSize)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7-a-side</SelectItem>
                  <SelectItem value="9">9-a-side</SelectItem>
                  <SelectItem value="11">11-a-side</SelectItem>
                </SelectContent>
              </Select>

              <Select value={formation} onValueChange={handleFormationChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableFormations.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={pitchOrientation} onValueChange={handleOrientationChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>

              <Separator />

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Settings className="w-4 h-4 mr-1" />
                    Settings
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" side="bottom" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <div className="text-sm font-semibold text-primary">Settings</div>
                        <span className="text-xs text-muted-foreground/70 font-medium tracking-wide">Football</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Time per Half</span>
                        <span className="text-sm font-semibold text-primary">{displayTimePerHalf} min</span>
                      </div>
                      <div
                        onPointerUp={() => {
                          if (sliderPreviewValue !== null && sliderPreviewValue !== timePerHalf) {
                            handleTimePerHalfChangeCommit(sliderPreviewValue);
                          }
                        }}
                        onTouchEnd={() => {
                          if (sliderPreviewValue !== null && sliderPreviewValue !== timePerHalf) {
                            handleTimePerHalfChangeCommit(sliderPreviewValue);
                          }
                        }}
                      >
                        <Slider
                          value={[displayTimePerHalf]}
                          onValueChange={handleTimePerHalfChangePreview}
                          min={20}
                          max={45}
                          step={5}
                          disabled={setTimePerHalfMutation.isPending}
                          className="w-full"
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>20 min</span>
                        <span>45 min</span>
                      </div>
                      {setTimePerHalfMutation.isPending && (
                        <div className="text-xs text-muted-foreground">Saving...</div>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Automated Substitutions</div>
                      <div className="text-xs text-muted-foreground">
                        Distributes playing time equally among all players. Speed mode controls rotation frequency.
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">Speed Mode</div>
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            variant={speedMode === SubstitutionSpeedMode.slow ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSpeedModeChange(SubstitutionSpeedMode.slow)}
                            className="h-8"
                            disabled={setSpeedModeMutation.isPending}
                          >
                            Slow
                          </Button>
                          <Button
                            variant={speedMode === SubstitutionSpeedMode.medium ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSpeedModeChange(SubstitutionSpeedMode.medium)}
                            className="h-8"
                            disabled={setSpeedModeMutation.isPending}
                          >
                            Medium
                          </Button>
                          <Button
                            variant={speedMode === SubstitutionSpeedMode.fast ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSpeedModeChange(SubstitutionSpeedMode.fast)}
                            className="h-8"
                            disabled={setSpeedModeMutation.isPending}
                          >
                            Fast
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getSpeedModeDescription(speedMode)}
                        </div>
                        {setSpeedModeMutation.isPending && (
                          <div className="text-xs text-muted-foreground">Updating...</div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">Max Simultaneous Substitutions</div>
                        <Select 
                          value={maxSimultaneousSubs.toString()} 
                          onValueChange={(value) => handleMaxSimultaneousSubsChange(parseInt(value))}
                          disabled={setMaxSimultaneousSubsMutation.isPending}
                        >
                          <SelectTrigger className="w-full h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: maxAllowedSimultaneousSubs }, (_, i) => i + 1).map(num => (
                              <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-muted-foreground">
                          Maximum number of substitutions at one time (limited to {maxAllowedSimultaneousSubs} based on bench size)
                        </div>
                        {setMaxSimultaneousSubsMutation.isPending && (
                          <div className="text-xs text-muted-foreground">Updating...</div>
                        )}
                      </div>
                      
                      <MinSubRoundsDisplay
                        onFieldPlayers={fieldPlayers.length}
                        benchPlayers={benchPlayers.length}
                        timePerHalf={timePerHalf}
                        maxSimultaneousSubs={maxSimultaneousSubs}
                        fieldPlayerIds={fieldPlayerIds}
                        benchPlayerIds={benchPlayerIds}
                        playerNames={playerNames}
                      />
                      
                      <Button 
                        onClick={handleGenerateSchedule} 
                        variant="outline" 
                        size="sm"
                        className="w-full"
                        disabled={!canGenerateSchedule || generateScheduleMutation.isPending}
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        {generateScheduleMutation.isPending ? 'Generating...' : 'Generate Schedule'}
                      </Button>
                      {!canGenerateSchedule && (
                        <div className="text-xs text-amber-600 dark:text-amber-400">
                          {benchPlayers.length === 0 && 'Add players to the bench to generate a schedule'}
                          {fieldPlayers.length === 0 && 'Add players to the field to generate a schedule'}
                        </div>
                      )}
                      {substitutionSchedule.length > 0 && (
                        <>
                          <div className="text-xs text-muted-foreground">
                            {substitutionSchedule.length} substitutions planned
                          </div>
                          <Button 
                            onClick={() => setIsScheduleReviewOpen(true)} 
                            variant="outline" 
                            size="sm"
                            className="w-full"
                          >
                            <ClipboardList className="w-4 h-4 mr-2" />
                            Review Schedule
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              <Separator />
              
              <Button variant="outline" size="sm" onClick={clear} className="w-full">
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </Button>
            </div>

            <MatchTimer
              timerData={timerData}
              onTimerUpdate={handleTimerUpdate}
              isMobile={false}
            />

            <PlayerBench
              players={benchPlayers}
              fieldPlayers={fieldPlayers}
              onPlayerUpdate={handlePlayerUpdate}
              onAddPlayer={handleAddPlayer}
              onRemovePlayer={handleRemovePlayer}
              onPromotePlayer={handlePromotePlayer}
              onDemotePlayer={handleDemotePlayer}
              onSubstitutePlayer={handleSubstitutePlayer}
              teamSize={teamSize}
            />
          </div>
        </div>
      </div>

      <ScheduleReviewDialog
        isOpen={isScheduleReviewOpen}
        onClose={() => setIsScheduleReviewOpen(false)}
        schedule={substitutionSchedule}
        timePerHalf={timePerHalf}
        allPlayers={players}
      />

      <footer className="border-t bg-card/30 mt-8 md:mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>© 2025. Built with ❤️ using{' '}
              <a 
                href="https://caffeine.ai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                caffeine.ai
              </a>
            </span>
            <span className="text-muted-foreground/50">•</span>
            <span className="text-xs text-muted-foreground/70 font-medium tracking-wide">Football</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
