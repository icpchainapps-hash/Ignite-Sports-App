import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date formatting utilities
export function formatTimestamp(timestamp: bigint): string {
  const date = new Date(Number(timestamp) / 1000000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatDate(timestamp: bigint): string {
  const date = new Date(Number(timestamp) / 1000000);
  return date.toLocaleDateString();
}

export function formatDateTime(timestamp: bigint): { date: string; time: string } {
  const date = new Date(Number(timestamp) / 1000000);
  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}

// User initials helper
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Address formatting
export function formatAddress(location: { street: string; city: string; state: string; postcode: string }): string {
  return `${location.street}, ${location.city}, ${location.state} ${location.postcode}`;
}

// Map URL generator
export function getMapUrl(coords: { latitude: number; longitude: number }): string {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${coords.longitude - 0.01},${coords.latitude - 0.01},${coords.longitude + 0.01},${coords.latitude + 0.01}&layer=mapnik&marker=${coords.latitude},${coords.longitude}`;
}

// Pluralization helper
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || `${singular}s`);
}

