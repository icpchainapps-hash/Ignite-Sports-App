// Role color definitions - centralized for consistency
export const ROLE_BG_COLORS = {
  goalkeeper: 'bg-yellow-500',
  defender: 'bg-blue-500',
  midfielder: 'bg-green-500',
  forward: 'bg-red-500'
} as const;

export const ROLE_COLORS = {
  goalkeeper: '#eab308',
  defender: '#3b82f6',
  midfielder: '#22c55e',
  forward: '#ef4444',
  // User role colors for badges
  appAdmin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  coach: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  player: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  parent: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  teamAdmin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  clubAdmin: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
} as const;

export const ROLE_LABELS = {
  goalkeeper: 'Goalkeeper',
  defender: 'Defender',
  midfielder: 'Midfielder',
  forward: 'Forward',
  // User role labels
  appAdmin: 'App Admin',
  coach: 'Coach',
  player: 'Player',
  parent: 'Parent',
  teamAdmin: 'Team Admin',
  clubAdmin: 'Club Admin'
} as const;

export const ROLE_ABBREVIATIONS = {
  goalkeeper: 'GK',
  defender: 'DEF',
  midfielder: 'MID',
  forward: 'FWD'
} as const;

// Event type icons mapping
export const EVENT_TYPE_ICONS = {
  game: '/assets/generated/match-event-icon-transparent.dim_24x24.png',
  match: '/assets/generated/match-event-icon-transparent.dim_24x24.png',
  socialEvent: '/assets/generated/social-event-icon-transparent.dim_24x24.png',
  training: '/assets/generated/training-event-icon-transparent.dim_24x24.png'
} as const;

// Event type labels
export const EVENT_TYPE_LABELS = {
  game: 'Game',
  match: 'Match',
  socialEvent: 'Social Event',
  training: 'Training'
} as const;

// RSVP icons
export const RSVP_ICONS = {
  yes: '/assets/generated/rsvp-yes-icon-transparent.dim_16x16.png',
  no: '/assets/generated/rsvp-no-icon-transparent.dim_16x16.png',
  maybe: '/assets/generated/rsvp-maybe-icon-transparent.dim_16x16.png',
  pending: '/assets/generated/event-calendar-icon-transparent.dim_24x24.png'
} as const;

