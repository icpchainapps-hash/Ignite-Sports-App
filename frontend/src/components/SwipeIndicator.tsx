import { useEffect, useState } from 'react';

interface SwipeIndicatorProps {
  isOpen: boolean;
  position: 'left' | 'right';
}

export default function SwipeIndicator({ isOpen, position }: SwipeIndicatorProps) {
  const [isPulsing, setIsPulsing] = useState(true);

  // Stop pulsing after 5 seconds to avoid distraction
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPulsing(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Emerald green arrow SVG component
  const ArrowSVG = ({ direction }: { direction: 'left' | 'right' }) => (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-lg"
    >
      {direction === 'right' ? (
        // Right-pointing arrow (for opening panel)
        <path
          d="M18 12L30 24L18 36"
          stroke="oklch(0.696 0.17 162.48)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        // Left-pointing arrow (for closing panel)
        <path
          d="M30 12L18 24L30 36"
          stroke="oklch(0.696 0.17 162.48)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );

  // Show right arrow on right edge when panel is closed (to open)
  if (position === 'right' && !isOpen) {
    return (
      <div
        className={`
          fixed top-1/2 -translate-y-1/2
          right-2
          pointer-events-none
          ${isPulsing ? 'animate-subtle-pulse' : ''}
        `}
        style={{ zIndex: 45 }}
      >
        <ArrowSVG direction="right" />
      </div>
    );
  }

  // Show left arrow on left edge of panel when panel is open (to close)
  if (position === 'left' && isOpen) {
    return (
      <div
        className={`
          absolute top-1/2 -translate-y-1/2
          left-2
          pointer-events-none
          ${isPulsing ? 'animate-subtle-pulse' : ''}
        `}
        style={{ zIndex: 45 }}
      >
        <ArrowSVG direction="left" />
      </div>
    );
  }

  return null;
}

