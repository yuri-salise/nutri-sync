import { SportType } from '../types';
import { formatDuration } from './gps';

export interface SportInfo {
  id: SportType;
  label: string;
  verb: string;
  /** Rides are shown as speed (km/h); everything else as pace (min/km). */
  showSpeed: boolean;
  surface: 'road' | 'trail';
  color: string;
}

export const SPORTS: SportInfo[] = [
  { id: 'run', label: 'Run', verb: 'ran', showSpeed: false, surface: 'road', color: '#2F74E8' },
  { id: 'walk', label: 'Walk', verb: 'walked', showSpeed: false, surface: 'road', color: '#0891B2' },
  { id: 'ride', label: 'Ride', verb: 'rode', showSpeed: true, surface: 'road', color: '#C2700C' },
  { id: 'hike', label: 'Hike', verb: 'hiked', showSpeed: false, surface: 'trail', color: '#059669' },
];

export const sportInfo = (id?: string | null): SportInfo => SPORTS.find((s) => s.id === id) ?? SPORTS[0];

const rideMet = (kmh: number) => (kmh < 16 ? 6.8 : kmh < 20 ? 8.0 : kmh < 25 ? 10.0 : 12.0);

/** Same formulas as backend/app/services/activity_calories.py, for the live estimate. */
export function estimateKcal(
  sport: SportType,
  weightKg: number,
  distanceKm: number,
  durationSec: number,
  elevationGainM = 0,
  surface: 'road' | 'trail' = 'road'
): number {
  const hours = Math.max(durationSec, 1) / 3600;
  let base: number;
  if (sport === 'walk') base = 0.53 * weightKg * distanceKm;
  else if (sport === 'ride') base = rideMet(distanceKm / hours) * weightKg * hours;
  else if (sport === 'hike') base = 6.0 * weightKg * hours;
  else base = 1.036 * weightKg * distanceKm * (surface === 'trail' ? 1.15 : 1.0);
  return Math.round((base + elevationGainM * (sport === 'ride' ? 0.02 : 0.05)) * 10) / 10;
}

export function formatSpeed(distanceM: number, elapsedSec: number): string {
  if (distanceM < 10 || elapsedSec <= 0) return '--';
  return ((distanceM / 1000) / (elapsedSec / 3600)).toFixed(1);
}

export function formatDistance(km: number): string {
  return km >= 100 ? km.toFixed(0) : km.toFixed(2);
}

/**
 * The API sends UTC. Some databases (SQLite in dev) return timestamps without a "Z",
 * which browsers would read as local time, so treat a missing zone as UTC.
 */
export function parseApiDate(iso: string): Date {
  return new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`);
}

/** "just now", "5m ago", "3h ago", "2d ago", then a short date. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, Math.floor((now - parseApiDate(iso).getTime()) / 1000));
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.round(diff / 86400)}d ago`;
  return parseApiDate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
