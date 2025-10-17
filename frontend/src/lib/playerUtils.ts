import { Player, PositionEligibility } from '../components/PitchBoard';
import { PlayerRole as BackendPlayerRole, Player as BackendPlayer } from '../backend';

// Type conversion utilities
export const roleToBackendRole = (role: Player['role']): BackendPlayerRole => {
  const roleMap: Record<Player['role'], BackendPlayerRole> = {
    'goalkeeper': BackendPlayerRole.goalkeeper,
    'defender': BackendPlayerRole.defender,
    'midfielder': BackendPlayerRole.midfielder,
    'forward': BackendPlayerRole.forward
  };
  return roleMap[role];
};

export const backendRoleToRole = (role: BackendPlayerRole): Player['role'] => {
  const roleMap: Record<BackendPlayerRole, Player['role']> = {
    [BackendPlayerRole.goalkeeper]: 'goalkeeper',
    [BackendPlayerRole.defender]: 'defender',
    [BackendPlayerRole.midfielder]: 'midfielder',
    [BackendPlayerRole.forward]: 'forward'
  };
  return roleMap[role];
};

export const playerToBackendPlayer = (player: Player): BackendPlayer => ({
  id: player.id,
  name: player.name,
  number: BigInt(player.number),
  role: roleToBackendRole(player.role),
  position: player.position,
  isOnField: player.isOnField,
  positionEligibility: player.positionEligibility
});

export const backendPlayerToPlayer = (player: BackendPlayer): Player => ({
  id: player.id,
  name: player.name,
  number: Number(player.number),
  role: backendRoleToRole(player.role),
  position: player.position,
  isOnField: player.isOnField,
  positionEligibility: player.positionEligibility
});

// Position eligibility utilities
export const createDefaultPositionEligibilityForRole = (role: Player['role']): PositionEligibility => ({
  goalkeeper: role === 'goalkeeper',
  defender: role === 'defender',
  midfielder: role === 'midfielder',
  forward: role === 'forward'
});

export const createDefaultPositionEligibility = (): PositionEligibility => ({
  goalkeeper: false,
  defender: false,
  midfielder: false,
  forward: false
});

export const ensurePositionEligibility = (player: Partial<Player>): Player => {
  const basePlayer = player as Player;
  
  if (!basePlayer.positionEligibility || 
      typeof basePlayer.positionEligibility !== 'object' ||
      typeof basePlayer.positionEligibility.goalkeeper !== 'boolean') {
    
    basePlayer.positionEligibility = basePlayer.isOnField === false
      ? createDefaultPositionEligibilityForRole(basePlayer.role)
      : createDefaultPositionEligibility();
  }
  
  return basePlayer;
};

// Goalkeeper position enforcement
export const enforceGoalkeeperPosition = (
  players: Player[], 
  orientation: 'portrait' | 'landscape'
): Player[] => {
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

