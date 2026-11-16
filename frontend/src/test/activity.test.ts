import { describe, expect, it } from 'vitest';
import { estimateKcal, formatDistance, formatSpeed, parseApiDate, sportInfo, timeAgo } from '../utils/activity';
import { parseRoute } from '../components/activity/RouteThumb';

describe('activity helpers', () => {
  it('estimates calories per sport like the backend', () => {
    // Same numbers as backend/tests/test_community.py::test_calorie_estimates_differ_by_sport
    expect(estimateKcal('run', 70, 10, 3000)).toBeCloseTo(725.2, 1);
    expect(estimateKcal('walk', 70, 10, 7200)).toBeCloseTo(371.0, 1);
    expect(estimateKcal('ride', 70, 10, 2400)).toBeCloseTo(317.3, 1);
    expect(estimateKcal('run', 70, 10, 3000, 0, 'trail')).toBeGreaterThan(estimateKcal('run', 70, 10, 3000));
  });

  it('shows speed for rides and pace for everything else', () => {
    expect(sportInfo('ride').showSpeed).toBe(true);
    expect(sportInfo('run').showSpeed).toBe(false);
    expect(sportInfo('hike').surface).toBe('trail');
    expect(sportInfo('unknown').id).toBe('run');
    expect(formatSpeed(30000, 3600)).toBe('30.0');
    expect(formatSpeed(0, 100)).toBe('--');
  });

  it('formats distance and relative time', () => {
    expect(formatDistance(5.234)).toBe('5.23');
    const now = new Date('2026-11-17T12:00:00Z').getTime();
    expect(timeAgo('2026-11-17T11:59:50Z', now)).toBe('just now');
    expect(timeAgo('2026-11-17T11:30:00Z', now)).toBe('30m ago');
    expect(timeAgo('2026-11-17T09:00:00Z', now)).toBe('3h ago');
    expect(timeAgo('2026-11-15T12:00:00Z', now)).toBe('2d ago');
    // a timestamp without a zone is UTC, not the viewer's local time
    expect(timeAgo('2026-11-17T11:30:00', now)).toBe('30m ago');
    expect(parseApiDate('2026-11-17T11:30:00+08:00').toISOString()).toBe('2026-11-17T03:30:00.000Z');
  });

  it('parses a GeoJSON route into [lat, lng] and survives bad input', () => {
    const geo = JSON.stringify({ type: 'LineString', coordinates: [[121.0, 14.5], [121.1, 14.6]] });
    expect(parseRoute(geo)).toEqual([[14.5, 121.0], [14.6, 121.1]]);
    expect(parseRoute('nope')).toEqual([]);
    expect(parseRoute(null)).toEqual([]);
  });
});
