import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface EmojiReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const COMMON_REACTIONS = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '😮', label: 'Surprised' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '🎉', label: 'Celebrate' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '👏', label: 'Clap' },
];

export default function EmojiReactionPicker({ onSelect, onClose }: EmojiReactionPickerProps) {
  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
        aria-hidden="true"
      />
      <Card className="relative z-50 p-2 shadow-lg border-2 bg-background">
        <div className="grid grid-cols-4 gap-1">
          {COMMON_REACTIONS.map(({ emoji, label }) => (
            <Button
              key={emoji}
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 text-2xl hover:scale-110 transition-transform touch-manipulation"
              onClick={() => onSelect(emoji)}
              aria-label={label}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </Card>
    </>
  );
}
