import { useCallback, useMemo } from 'react';
import { Player, PositionEligibility } from '../components/PitchBoard';

export function usePlayerManagement(
  players: Player[],
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>,
  pitchOrientation: 'portrait' | 'landscape',
  teamSize: number
) {
  const fieldPlayers = useMemo(() => players.filter(p => p.isOnField), [players]);
  const benchPlayers = useMemo(() => players.filter(p => !p.isOnField), [players]);

  const handlePlayerUpdate = useCallback((playerId: string, updates: Partial<Player>) => {
    setPlayers(prev => prev.map(player => {
      if (player.id === playerId) {
        const updatedPlayer = { ...player, ...updates };
        // Ensure position eligibility exists
        if (!updatedPlayer.positionEligibility || typeof updatedPlayer.positionEligibility !== 'object') {
          updatedPlayer.positionEligibility = {
            goalkeeper: updatedPlayer.role === 'goalkeeper',
            defender: updatedPlayer.role === 'defender',
            midfielder: updatedPlayer.role === 'midfielder',
            forward: updatedPlayer.role === 'forward'
          };
        }
        return updatedPlayer;
      }
      return player;
    }));
  }, [setPlayers]);

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
    setPlayers(prev => [...prev, newPlayer]);
  }, [players, setPlayers]);

  const handleRemovePlayer = useCallback((playerId: string) => {
    setPlayers(prev => prev.filter(p => p.id !== playerId));
  }, [setPlayers]);

  const handlePromotePlayer = useCallback((playerId: string) => {
    const player = players.find(p => p.id === playerId);
    let defaultPosition = { x: 50, y: 50 };
    
    if (player?.role === 'goalkeeper') {
      defaultPosition = pitchOrientation === 'portrait' 
        ? { x: 50, y: 95 } 
        : { x: 5, y: 50 };
    }

    setPlayers(prev => prev.map(p => 
      p.id === playerId 
        ? { ...p, isOnField: true, position: defaultPosition }
        : p
    ));
  }, [players, pitchOrientation, setPlayers]);

  const handleDemotePlayer = useCallback((playerId: string) => {
    setPlayers(prev => prev.map(p => 
      p.id === playerId 
        ? { ...p, isOnField: false, position: { x: 0, y: 0 } }
        : p
    ));
  }, [setPlayers]);

  const handleSubstitutePlayer = useCallback((fieldPlayerId: string, benchPlayerId: string) => {
    const fieldPlayer = players.find(p => p.id === fieldPlayerId);
    const benchPlayer = players.find(p => p.id === benchPlayerId);

    if (!fieldPlayer || !benchPlayer) return;

    const eligibility = benchPlayer.positionEligibility || {
      goalkeeper: false,
      defender: false,
      midfielder: false,
      forward: false
    };

    const isEligible = eligibility[fieldPlayer.role];
    if (!isEligible) return;

    setPlayers(prev => prev.map(p => {
      if (p.id === fieldPlayerId) {
        return { ...p, isOnField: false, position: { x: 0, y: 0 } };
      }
      if (p.id === benchPlayerId) {
        return { ...p, isOnField: true, position: fieldPlayer.position };
      }
      return p;
    }));
  }, [players, setPlayers]);

  return {
    fieldPlayers,
    benchPlayers,
    handlePlayerUpdate,
    handleAddPlayer,
    handleRemovePlayer,
    handlePromotePlayer,
    handleDemotePlayer,
    handleSubstitutePlayer
  };
}
