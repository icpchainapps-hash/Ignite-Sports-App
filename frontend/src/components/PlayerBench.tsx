import { useState, memo } from 'react';
import { Player, TeamSize, PositionEligibility } from './PitchBoard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, ArrowUp, ArrowDown, Edit2, Check, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ROLE_BG_COLORS, ROLE_LABELS, ROLE_ABBREVIATIONS } from '../lib/constants';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PlayerBenchProps {
  players: Player[];
  fieldPlayers: Player[];
  onPlayerUpdate: (playerId: string, updates: Partial<Player>) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (playerId: string) => void;
  onPromotePlayer: (playerId: string) => void;
  onDemotePlayer: (playerId: string) => void;
  onSubstitutePlayer?: (fieldPlayerId: string, benchPlayerId: string) => void;
  teamSize: TeamSize;
}

interface EditForm {
  name: string;
  number: string;
  role: string;
}

interface SubstitutionDialogState {
  isOpen: boolean;
  fieldPlayer: Player | null;
  selectedBenchPlayer: Player | null;
}

interface PlayerRowProps {
  player: Player;
  showPromote?: boolean;
  isEditing: boolean;
  editForm: EditForm;
  onEditFormChange: (updates: Partial<EditForm>) => void;
  onStartEditing: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onPromoteClick: () => void;
  onDemoteClick: () => void;
  onRemoveClick: () => void;
  onPositionEligibilityChange: (position: keyof PositionEligibility, checked: boolean) => void;
}

// Move PlayerRow outside and memoize it to prevent unnecessary re-renders
const PlayerRow = memo(({ 
  player, 
  showPromote,
  isEditing,
  editForm,
  onEditFormChange,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  onPromoteClick,
  onDemoteClick,
  onRemoveClick,
  onPositionEligibilityChange
}: PlayerRowProps) => {
  const eligibility: PositionEligibility = player.positionEligibility || {
    goalkeeper: player.role === 'goalkeeper',
    defender: player.role === 'defender',
    midfielder: player.role === 'midfielder',
    forward: player.role === 'forward'
  };

  return (
    <div className="flex flex-col p-3 md:p-2 rounded-lg bg-muted/50 space-y-2">
      {isEditing ? (
        <div className="flex-1 space-y-3 md:space-y-2">
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
            <Input
              value={editForm.name}
              onChange={(e) => onEditFormChange({ name: e.target.value })}
              placeholder="Name"
              className="h-10 md:h-8"
              autoFocus
            />
            <Input
              value={editForm.number}
              onChange={(e) => onEditFormChange({ number: e.target.value })}
              placeholder="No."
              type="number"
              min="1"
              className="h-10 md:h-8 w-full md:w-16"
            />
          </div>
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
            <Select value={editForm.role} onValueChange={(value) => onEditFormChange({ role: value })}>
              <SelectTrigger className="h-10 md:h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="goalkeeper">Goalkeeper</SelectItem>
                <SelectItem value="defender">Defender</SelectItem>
                <SelectItem value="midfielder">Midfielder</SelectItem>
                <SelectItem value="forward">Forward</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex space-x-2">
              <Button size="sm" variant="outline" onClick={onSaveEdit} className="h-10 md:h-8 flex-1 md:flex-none">
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={onCancelEdit} className="h-10 md:h-8 flex-1 md:flex-none">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 md:space-x-2 flex-1">
              <div className={`w-8 h-8 md:w-6 md:h-6 rounded-full ${ROLE_BG_COLORS[player.role]} flex items-center justify-center text-white text-sm md:text-xs font-bold flex-shrink-0`}>
                {player.number}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-base md:text-sm truncate">{player.name}</div>
                <div className="text-sm md:text-xs text-muted-foreground">{ROLE_LABELS[player.role]}</div>
              </div>
            </div>
            <div className="flex space-x-1 flex-shrink-0">
              <Button size="sm" variant="ghost" onClick={onStartEditing} className="h-10 w-10 md:h-8 md:w-8">
                <Edit2 className="w-4 h-4 md:w-3 md:h-3" />
              </Button>
              {showPromote ? (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={onPromoteClick}
                  className="h-10 w-10 md:h-8 md:w-8"
                  title="Add to field or substitute"
                >
                  <ArrowUp className="w-4 h-4 md:w-3 md:h-3" />
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={onDemoteClick} 
                  className="h-10 w-10 md:h-8 md:w-8"
                  title="Substitute player"
                >
                  <ArrowDown className="w-4 h-4 md:w-3 md:h-3" />
                </Button>
              )}
              {showPromote && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={onRemoveClick} 
                  className="h-10 w-10 md:h-8 md:w-8"
                  title="Remove player"
                >
                  <Trash2 className="w-4 h-4 md:w-3 md:h-3" />
                </Button>
              )}
            </div>
          </div>
          
          {showPromote && (
            <div className="pl-10 md:pl-8">
              <div className="text-xs text-muted-foreground mb-1.5">Can substitute for:</div>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <Checkbox
                    checked={eligibility.goalkeeper}
                    onCheckedChange={(checked) => onPositionEligibilityChange('goalkeeper', checked as boolean)}
                    className="h-4 w-4"
                  />
                  <span className="text-xs font-medium">{ROLE_ABBREVIATIONS.goalkeeper}</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <Checkbox
                    checked={eligibility.defender}
                    onCheckedChange={(checked) => onPositionEligibilityChange('defender', checked as boolean)}
                    className="h-4 w-4"
                  />
                  <span className="text-xs font-medium">{ROLE_ABBREVIATIONS.defender}</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <Checkbox
                    checked={eligibility.midfielder}
                    onCheckedChange={(checked) => onPositionEligibilityChange('midfielder', checked as boolean)}
                    className="h-4 w-4"
                  />
                  <span className="text-xs font-medium">{ROLE_ABBREVIATIONS.midfielder}</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <Checkbox
                    checked={eligibility.forward}
                    onCheckedChange={(checked) => onPositionEligibilityChange('forward', checked as boolean)}
                    className="h-4 w-4"
                  />
                  <span className="text-xs font-medium">{ROLE_ABBREVIATIONS.forward}</span>
                </label>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

PlayerRow.displayName = 'PlayerRow';

export default function PlayerBench({
  players,
  fieldPlayers,
  onPlayerUpdate,
  onAddPlayer,
  onRemovePlayer,
  onPromotePlayer,
  onDemotePlayer,
  onSubstitutePlayer,
  teamSize
}: PlayerBenchProps) {
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', number: '', role: '' });
  const [substitutionDialog, setSubstitutionDialog] = useState<SubstitutionDialogState>({
    isOpen: false,
    fieldPlayer: null,
    selectedBenchPlayer: null,
  });

  const startEditing = (player: Player) => {
    setEditingPlayer(player.id);
    setEditForm({
      name: player.name,
      number: player.number.toString(),
      role: player.role
    });
  };

  const saveEdit = () => {
    if (!editingPlayer) return;
    
    const parsedNumber = parseInt(editForm.number);
    if (isNaN(parsedNumber) || parsedNumber < 1) {
      return;
    }
    
    onPlayerUpdate(editingPlayer, {
      name: editForm.name.trim() || 'Player',
      number: parsedNumber,
      role: editForm.role as Player['role']
    });
    
    setEditingPlayer(null);
  };

  const cancelEdit = () => {
    setEditingPlayer(null);
  };

  const handleEditFormChange = (updates: Partial<EditForm>) => {
    setEditForm(prev => ({ ...prev, ...updates }));
  };

  const handlePositionEligibilityChange = (playerId: string, position: keyof PositionEligibility, checked: boolean) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const currentEligibility: PositionEligibility = player.positionEligibility || {
      goalkeeper: false,
      defender: false,
      midfielder: false,
      forward: false
    };

    const updatedEligibility: PositionEligibility = {
      ...currentEligibility,
      [position]: checked
    };

    onPlayerUpdate(playerId, {
      positionEligibility: updatedEligibility
    });
  };

  const isEligibleForPosition = (benchPlayer: Player, position: Player['role']): boolean => {
    const eligibility = benchPlayer.positionEligibility || {
      goalkeeper: false,
      defender: false,
      midfielder: false,
      forward: false
    };

    return eligibility[position] === true;
  };

  const getEligibleBenchPlayers = (fieldPlayer: Player): Player[] => {
    return players.filter(benchPlayer => 
      isEligibleForPosition(benchPlayer, fieldPlayer.role)
    );
  };

  const handlePromotePlayerClick = (benchPlayer: Player) => {
    if (fieldPlayers.length >= teamSize) {
      const eligiblePlayers = fieldPlayers.filter(fieldPlayer => 
        isEligibleForPosition(benchPlayer, fieldPlayer.role)
      );
      
      setSubstitutionDialog({
        isOpen: true,
        fieldPlayer: eligiblePlayers.length > 0 ? eligiblePlayers[0] : null,
        selectedBenchPlayer: benchPlayer,
      });
    } else {
      onPromotePlayer(benchPlayer.id);
    }
  };

  const handleDemotePlayerClick = (fieldPlayer: Player) => {
    // Always open substitution dialog when removing a field player
    setSubstitutionDialog({
      isOpen: true,
      fieldPlayer,
      selectedBenchPlayer: null,
    });
  };

  const handleSubstitutionConfirm = () => {
    if (!substitutionDialog.fieldPlayer || !substitutionDialog.selectedBenchPlayer) {
      return;
    }

    if (onSubstitutePlayer) {
      onSubstitutePlayer(
        substitutionDialog.fieldPlayer.id,
        substitutionDialog.selectedBenchPlayer.id
      );
    }

    setSubstitutionDialog({
      isOpen: false,
      fieldPlayer: null,
      selectedBenchPlayer: null,
    });
  };

  const handleSubstitutionCancel = () => {
    setSubstitutionDialog({
      isOpen: false,
      fieldPlayer: null,
      selectedBenchPlayer: null,
    });
  };

  const eligibleBenchPlayers = substitutionDialog.fieldPlayer 
    ? getEligibleBenchPlayers(substitutionDialog.fieldPlayer)
    : [];

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg flex items-center justify-between">
              On Field
              <Badge variant="outline">{fieldPlayers.length}/{teamSize}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 md:h-48">
              <div className="space-y-2">
                {fieldPlayers.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No players on field. Add players from the bench below.
                  </div>
                ) : (
                  fieldPlayers.map((player) => (
                    <PlayerRow 
                      key={player.id} 
                      player={player}
                      isEditing={editingPlayer === player.id}
                      editForm={editForm}
                      onEditFormChange={handleEditFormChange}
                      onStartEditing={() => startEditing(player)}
                      onSaveEdit={saveEdit}
                      onCancelEdit={cancelEdit}
                      onPromoteClick={() => {}}
                      onDemoteClick={() => handleDemotePlayerClick(player)}
                      onRemoveClick={() => {}}
                      onPositionEligibilityChange={(position, checked) => 
                        handlePositionEligibilityChange(player.id, position, checked)
                      }
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg flex items-center justify-between">
              Bench
              <Badge variant="outline">{players.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 md:h-64">
              <div className="space-y-2">
                {players.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No players on bench. Add a player below.
                  </div>
                ) : (
                  players.map((player) => (
                    <PlayerRow 
                      key={player.id} 
                      player={player} 
                      showPromote
                      isEditing={editingPlayer === player.id}
                      editForm={editForm}
                      onEditFormChange={handleEditFormChange}
                      onStartEditing={() => startEditing(player)}
                      onSaveEdit={saveEdit}
                      onCancelEdit={cancelEdit}
                      onPromoteClick={() => handlePromotePlayerClick(player)}
                      onDemoteClick={() => {}}
                      onRemoveClick={() => onRemovePlayer(player.id)}
                      onPositionEligibilityChange={(position, checked) => 
                        handlePositionEligibilityChange(player.id, position, checked)
                      }
                    />
                  ))
                )}
              </div>
            </ScrollArea>
            
            <Separator className="my-4" />
            
            <Button onClick={onAddPlayer} className="w-full h-12 md:h-10 text-base md:text-sm" variant="outline">
              <Plus className="w-5 h-5 md:w-4 md:h-4 mr-2" />
              Add Player
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={substitutionDialog.isOpen} onOpenChange={(open) => {
        if (!open) {
          handleSubstitutionCancel();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Replacement Player</DialogTitle>
            <DialogDescription>
              {substitutionDialog.fieldPlayer && eligibleBenchPlayers.length === 0 ? (
                <>
                  No eligible bench players available to replace{' '}
                  <span className="font-semibold">{substitutionDialog.fieldPlayer.name}</span>{' '}
                  ({ROLE_LABELS[substitutionDialog.fieldPlayer.role]}).
                </>
              ) : (
                <>
                  Choose a bench player to replace{' '}
                  <span className="font-semibold">{substitutionDialog.fieldPlayer?.name}</span>{' '}
                  ({ROLE_LABELS[substitutionDialog.fieldPlayer?.role || 'midfielder']}).
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {substitutionDialog.fieldPlayer && eligibleBenchPlayers.length === 0 ? (
            <div className="space-y-3 py-2">
              <div className="text-sm text-muted-foreground">
                To substitute <span className="font-semibold">{substitutionDialog.fieldPlayer.name}</span>, you need a bench player eligible for the{' '}
                <span className="font-semibold">{ROLE_LABELS[substitutionDialog.fieldPlayer.role]}</span> position.
              </div>
              <div className="text-sm text-muted-foreground">
                Please assign position eligibility to bench players before attempting substitutions.
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="text-sm font-medium">
                Select a replacement from the bench:
              </div>
              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {eligibleBenchPlayers.map((benchPlayer) => (
                    <button
                      key={benchPlayer.id}
                      onClick={() => setSubstitutionDialog(prev => ({
                        ...prev,
                        selectedBenchPlayer: benchPlayer,
                      }))}
                      className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                        substitutionDialog.selectedBenchPlayer?.id === benchPlayer.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full ${ROLE_BG_COLORS[benchPlayer.role]} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                          {benchPlayer.number}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{benchPlayer.name}</div>
                          <div className="text-xs text-muted-foreground">{ROLE_LABELS[benchPlayer.role]}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleSubstitutionCancel}
            >
              Cancel
            </Button>
            {eligibleBenchPlayers.length > 0 && (
              <Button
                onClick={handleSubstitutionConfirm}
                disabled={!substitutionDialog.selectedBenchPlayer}
              >
                Confirm Substitution
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

