/** GPS helpers for activity recording: distance, jitter filtering and elevation gain. */

export interface GpsFix {
  lat: number;
  lng: number;
  accuracy: number; // metres (68% confidence radius reported by the browser)
  altitude: number | null; // metres, when the device provides it
  timestamp: number; // ms since epoch
}

export interface TrackState {
  points: GpsFix[];
  distanceM: number;
  elevationGainM: number;
  /** Last altitude used as the baseline for elevation gain (smoothed against noise). */
  altitudeBaseline: number | null;
}

export const emptyTrack = (): TrackState => ({
  points: [],
  distanceM: 0,
  elevationGainM: 0,
  altitudeBaseline: null,
});

/** Fixes worse than this are ignored while recording. */
export const MAX_ACCURACY_M = 35;
/** Fixes good enough to let the user start recording. */
export const READY_ACCURACY_M = 50;
/** Ignore movement smaller than this (GPS drift while standing still). */
const MIN_STEP_M = 3;
/** Ignore jumps faster than this (~43 km/h): GPS spikes, not running. */
const MAX_SPEED_MPS = 12;
/** Altitude must change by this much before it counts as a climb. */
const ELEVATION_NOISE_M = 3;

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Adds a fix to the track if it is trustworthy. Returns the same object when the
 * fix was rejected, so callers can cheaply detect "no change".
 */
export function addFix(track: TrackState, fix: GpsFix): TrackState {
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return track;
  if (fix.accuracy > MAX_ACCURACY_M) return track;

  const last = track.points[track.points.length - 1];
  if (!last) {
    return {
      points: [fix],
      distanceM: 0,
      elevationGainM: 0,
      altitudeBaseline: fix.altitude,
    };
  }

  const step = haversineM(last, fix);
  if (step < Math.max(MIN_STEP_M, Math.min(fix.accuracy, last.accuracy) * 0.5)) return track;

  const dt = (fix.timestamp - last.timestamp) / 1000;
  if (dt > 0 && step / dt > MAX_SPEED_MPS) return track;

  let { elevationGainM, altitudeBaseline } = track;
  if (fix.altitude !== null) {
    if (altitudeBaseline === null) {
      altitudeBaseline = fix.altitude;
    } else if (fix.altitude - altitudeBaseline >= ELEVATION_NOISE_M) {
      elevationGainM += fix.altitude - altitudeBaseline;
      altitudeBaseline = fix.altitude;
    } else if (altitudeBaseline - fix.altitude >= ELEVATION_NOISE_M) {
      altitudeBaseline = fix.altitude; // descending: move the baseline down, no gain
    }
  }

  return {
    points: [...track.points, fix],
    distanceM: track.distanceM + step,
    elevationGainM,
    altitudeBaseline,
  };
}

export function fixFromPosition(pos: GeolocationPosition): GpsFix {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    altitude: pos.coords.altitude ?? null,
    timestamp: pos.timestamp || Date.now(),
  };
}

/** Pace as "m:ss" per km, or "--:--" when not moving yet. */
export function formatPace(distanceM: number, elapsedSec: number): string {
  if (distanceM < 10 || elapsedSec <= 0) return '--:--';
  const secPerKm = elapsedSec / (distanceM / 1000);
  if (!Number.isFinite(secPerKm) || secPerKm > 60 * 60) return '--:--';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Moves a point `metres` along `bearingDeg`. Used by demo mode only. */
export function offsetPoint(lat: number, lng: number, metres: number, bearingDeg: number) {
  const d = metres / EARTH_RADIUS_M;
  const br = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lng1 = toRad(lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lng2 =
    lng1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}
