import { describe, expect, it } from 'vitest';
import { GpsFix, addFix, emptyTrack, formatPace, haversineM, offsetPoint } from '../utils/gps';

const fix = (lat: number, lng: number, t: number, extra: Partial<GpsFix> = {}): GpsFix => ({
  lat,
  lng,
  accuracy: 5,
  altitude: null,
  timestamp: t * 1000,
  ...extra,
});

describe('gps utils', () => {
  it('measures real distance with haversine', () => {
    // One degree of latitude is ~111.2 km.
    expect(haversineM({ lat: 14, lng: 121 }, { lat: 15, lng: 121 })).toBeGreaterThan(111000);
    expect(haversineM({ lat: 14, lng: 121 }, { lat: 15, lng: 121 })).toBeLessThan(111400);
  });

  it('sums distance along a straight 100 m route', () => {
    let track = emptyTrack();
    for (let i = 0; i <= 10; i++) {
      const p = offsetPoint(14.55, 121.05, i * 10, 90);
      track = addFix(track, fix(p.lat, p.lng, i * 4));
    }
    expect(track.distanceM).toBeGreaterThan(99);
    expect(track.distanceM).toBeLessThan(101);
  });

  it('ignores inaccurate fixes, standing-still jitter and teleport spikes', () => {
    let track = addFix(emptyTrack(), fix(14.55, 121.05, 0));
    const start = track;

    track = addFix(track, fix(14.5501, 121.05, 5, { accuracy: 80 })); // poor accuracy
    expect(track).toBe(start);

    const jitter = offsetPoint(14.55, 121.05, 1, 0); // 1 m drift
    track = addFix(track, fix(jitter.lat, jitter.lng, 10));
    expect(track).toBe(start);

    const spike = offsetPoint(14.55, 121.05, 500, 0); // 500 m in 1 s
    track = addFix(track, fix(spike.lat, spike.lng, 1));
    expect(track).toBe(start);
  });

  it('counts climbing but not GPS altitude noise', () => {
    let track = emptyTrack();
    const alts = [10, 11, 10, 15, 14, 20, 12, 18];
    alts.forEach((alt, i) => {
      const p = offsetPoint(14.55, 121.05, i * 10, 0);
      track = addFix(track, fix(p.lat, p.lng, i * 5, { altitude: alt }));
    });
    // 10 -> 15 (+5), 15 -> 20 (+5), drop to 12, 12 -> 18 (+6)
    expect(Math.round(track.elevationGainM)).toBe(16);
  });

  it('formats pace per km', () => {
    expect(formatPace(5000, 1500)).toBe('5:00');
    expect(formatPace(0, 100)).toBe('--:--');
  });
});
