import { Formation } from '../backend';
import { createDefaultPositionEligibility, createDefaultPositionEligibilityForRole } from './playerUtils';

export const FORMATION_ROLE_REQUIREMENTS: Record<TeamSize, Record<string, { defenders: number; midfielders: number; forwards: number }>> = {
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

export const getAvailableFormations = (teamSize: TeamSize): string[] => {
  return Object.keys(FORMATION_ROLE_REQUIREMENTS[teamSize]);
};

export const mapFormationToBackend = (formation: FormationType): Formation => {
  const formationMap: Record<string, Formation> = {
    '4-4-2': Formation.fourFourTwo,
    '4-3-3': Formation.fourThreeThree,
    '3-5-2': Formation.threeFiveTwo,
    '4-2-3-1': Formation.fourTwoThreeOne,
    'Custom': Formation.custom
  };
  
  return formationMap[formation] || Formation.custom;
};

export const reassignPlayerRoles = (
  players: Player[], 
  formation: FormationType, 
  teamSize: TeamSize
): Player[] => {
  if (formation === 'Custom') return players;

  const requirements = FORMATION_ROLE_REQUIREMENTS[teamSize][formation];
  if (!requirements) return players;

  const fieldPlayers = players.filter(p => p.isOnField);
  const benchPlayers = players.filter(p => !p.isOnField);
  
  const goalkeeper = fieldPlayers.find(p => p.role === 'goalkeeper');
  const outfieldPlayers = fieldPlayers.filter(p => p.role !== 'goalkeeper');
  
  if (!goalkeeper || outfieldPlayers.length !== teamSize - 1) return players;

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

export const createPlayersForFormation = (teamSize: TeamSize, formation: FormationType): Player[] => {
  const requirements = FORMATION_ROLE_REQUIREMENTS[teamSize][formation];
  if (!requirements || formation === 'Custom') {
    return createDefaultPlayersForSize(teamSize);
  }

  const players: Player[] = [];
  let playerId = 1;
  let playerNumber = 1;

  // Goalkeeper
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

  // Defenders
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

  // Midfielders
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

  // Forwards
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

  // Substitutes
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

const createDefaultPlayersForSize = (teamSize: TeamSize): Player[] => {
  const defaultFormations: Record<TeamSize, FormationType> = {
    7: '2-2-2',
    9: '3-3-2',
    11: '4-4-2'
  };
  return createPlayersForFormation(teamSize, defaultFormations[teamSize]);
};

