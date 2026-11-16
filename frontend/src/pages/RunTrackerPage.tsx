import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { RunActivity } from '../types';
import {
  Play,
  Pause,
  Square,
  Clock,
  CheckCircle2,
  Navigation,
  Sparkles,
  LocateFixed,
  AlertTriangle,
  Trash2,
  FlaskConical,
} from 'lucide-react';
import L from 'leaflet';
import {
  GpsFix,
  READY_ACCURACY_M,
  TrackState,
  addFix,
  emptyTrack,
  fixFromPosition,
  formatDuration,
  formatPace,
  offsetPoint,
} from '../utils/gps';

type GpsStatus = 'locating' | 'ready' | 'weak' | 'denied' | 'unavailable' | 'insecure';
type Phase = 'idle' | 'recording' | 'paused';

// Only used to frame the map before the first GPS fix (whole Philippines view).
const COUNTRY_VIEW: [number, number] = [12.8797, 121.774];
// Demo-mode start point when no GPS fix is available at all (Rizal Park, Manila).
const DEMO_FALLBACK = { lat: 14.5831, lng: 120.9794 };

export const RunTrackerPage: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const accuracyRef = useRef<L.Circle | null>(null);
  const centeredRef = useRef(false);

  const [runs, setRuns] = useState<RunActivity[]>([]);
  const [surfaceType, setSurfaceType] = useState<'road' | 'trail'>('road');
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('locating');
  const [currentFix, setCurrentFix] = useState<GpsFix | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [demoMode, setDemoMode] = useState(false);
  const [track, setTrack] = useState<TrackState>(emptyTrack());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Refs mirror state for use inside geolocation/timer callbacks.
  const phaseRef = useRef<Phase>('idle');
  const demoRef = useRef(false);
  const trackRef = useRef<TrackState>(emptyTrack());
  const lastFixRef = useRef<GpsFix | null>(null);
  const accumulatedMsRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoStateRef = useRef({ lat: 0, lng: 0, bearing: 45, alt: 20 });
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    demoRef.current = demoMode;
  }, [demoMode]);

  const loadRuns = async () => {
    try {
      const res = await api.getRuns({ limit: 20 });
      setRuns(res.data);
    } catch (err) {
      console.error('Failed to load activities:', err);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const recordFix = useCallback((fix: GpsFix) => {
    if (phaseRef.current !== 'recording') return;
    const next = addFix(trackRef.current, fix);
    if (next !== trackRef.current) {
      trackRef.current = next;
      setTrack(next);
    }
  }, []);

  // ---------------------------------------------------------------- map setup
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(COUNTRY_VIEW, 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'dark-tiles',
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    polylineRef.current = L.polyline([], {
      color: '#C8FF00',
      weight: 5,
      opacity: 0.95,
      lineJoin: 'round',
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      accuracyRef.current = null;
    };
  }, []);

  const showPosition = useCallback((fix: GpsFix) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const latlng: [number, number] = [fix.lat, fix.lng];

    if (!markerRef.current) {
      markerRef.current = L.circleMarker(latlng, {
        radius: 8,
        fillColor: '#C8FF00',
        fillOpacity: 1,
        color: '#000000',
        weight: 3,
      }).addTo(map);
      accuracyRef.current = L.circle(latlng, {
        radius: fix.accuracy,
        color: '#00E5FF',
        weight: 1,
        fillOpacity: 0.08,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(latlng);
      accuracyRef.current?.setLatLng(latlng).setRadius(fix.accuracy);
    }

    if (!centeredRef.current) {
      map.setView(latlng, 17);
      centeredRef.current = true;
    } else if (phaseRef.current === 'recording') {
      map.panTo(latlng);
    }
  }, []);

  // ------------------------------------------------------- live GPS location
  useEffect(() => {
    if (!window.isSecureContext) {
      setGpsStatus('insecure');
      return;
    }
    if (!('geolocation' in navigator)) {
      setGpsStatus('unavailable');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = fixFromPosition(pos);
        if (demoRef.current) return; // demo mode drives the marker itself
        lastFixRef.current = fix;
        setCurrentFix(fix);
        setGpsStatus(fix.accuracy <= READY_ACCURACY_M ? 'ready' : 'weak');
        showPosition(fix);
        recordFix(fix);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGpsStatus('denied');
        else if (err.code === err.POSITION_UNAVAILABLE) setGpsStatus('unavailable');
        else setGpsStatus((s) => (s === 'ready' ? s : 'weak'));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [recordFix, showPosition]);

  // Keep the route line in sync with the recorded track.
  useEffect(() => {
    polylineRef.current?.setLatLngs(track.points.map((p) => [p.lat, p.lng] as [number, number]));
  }, [track]);

  // ------------------------------------------------------------- timer
  const currentElapsedMs = () =>
    accumulatedMsRef.current + (segmentStartRef.current ? Date.now() - segmentStartRef.current : 0);

  const startTicking = () => {
    segmentStartRef.current = Date.now();
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setElapsedSec(Math.floor(currentElapsedMs() / 1000)), 500);
  };

  const stopTicking = () => {
    accumulatedMsRef.current = currentElapsedMs();
    segmentStartRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setElapsedSec(Math.floor(accumulatedMsRef.current / 1000));
  };

  // ------------------------------------------------------------- demo mode
  const startDemoFeed = () => {
    const origin = lastFixRef.current ?? DEMO_FALLBACK;
    demoStateRef.current = { lat: origin.lat, lng: origin.lng, bearing: Math.random() * 360, alt: 20 };
    if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    demoTimerRef.current = setInterval(() => {
      if (phaseRef.current !== 'recording') return;
      const s = demoStateRef.current;
      s.bearing += (Math.random() - 0.5) * 30;
      const next = offsetPoint(s.lat, s.lng, 2.6 + Math.random() * 0.8, s.bearing);
      s.lat = next.lat;
      s.lng = next.lng;
      s.alt += (Math.random() - 0.45) * 1.5;
      const fix: GpsFix = { lat: s.lat, lng: s.lng, accuracy: 5, altitude: s.alt, timestamp: Date.now() };
      showPosition(fix);
      recordFix(fix);
    }, 1000);
  };

  const stopDemoFeed = () => {
    if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    demoTimerRef.current = null;
  };

  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
      stopDemoFeed();
      wakeLockRef.current?.release?.();
    },
    []
  );

  // ------------------------------------------------------------- controls
  const canStart = demoMode || gpsStatus === 'ready';

  const requestWakeLock = async () => {
    try {
      wakeLockRef.current = await (navigator as any).wakeLock?.request('screen');
    } catch {
      /* not supported or denied: recording still works while the screen is on */
    }
  };

  const startActivity = () => {
    if (!canStart) return;
    setSuccessMsg(null);
    setErrorMsg(null);
    accumulatedMsRef.current = 0;
    setElapsedSec(0);

    const fresh = emptyTrack();
    trackRef.current = lastFixRef.current && !demoMode ? addFix(fresh, lastFixRef.current) : fresh;
    setTrack(trackRef.current);

    phaseRef.current = 'recording';
    setPhase('recording');
    startTicking();
    if (demoMode) startDemoFeed();
    requestWakeLock();
  };

  const pauseActivity = () => {
    phaseRef.current = 'paused';
    setPhase('paused');
    stopTicking();
  };

  const resumeActivity = () => {
    phaseRef.current = 'recording';
    setPhase('recording');
    startTicking();
  };

  const resetActivity = () => {
    stopTicking();
    stopDemoFeed();
    wakeLockRef.current?.release?.();
    wakeLockRef.current = null;
    phaseRef.current = 'idle';
    setPhase('idle');
    trackRef.current = emptyTrack();
    setTrack(trackRef.current);
    accumulatedMsRef.current = 0;
    setElapsedSec(0);
  };

  const finishActivity = async () => {
    stopTicking();
    const finalTrack = trackRef.current;
    const durationSec = Math.floor(accumulatedMsRef.current / 1000);

    if (finalTrack.distanceM < 50 || durationSec < 30) {
      phaseRef.current = 'paused';
      setPhase('paused');
      setErrorMsg(
        'That’s a bit short to save. Keep going, or tap Discard if you want to start over.'
      );
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await api.createRun({
        surface_type: surfaceType,
        distance_km: Math.round(finalTrack.distanceM) / 1000,
        duration_sec: durationSec,
        elevation_gain_m: Math.round(finalTrack.elevationGainM),
        route_geojson: JSON.stringify({
          type: 'LineString',
          coordinates: finalTrack.points.map((p) => [p.lng, p.lat]),
        }),
        is_public: true,
      });
      setSuccessMsg(
        `Nice work! ${(finalTrack.distanceM / 1000).toFixed(2)} km saved. Your calorie target for today has been updated.`
      );
      resetActivity();
      loadRuns();
    } catch (err: any) {
      phaseRef.current = 'paused';
      setPhase('paused');
      setErrorMsg(err.message || 'We couldn’t save your run. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------- derived
  const distanceKm = track.distanceM / 1000;
  const estCalories = Math.round(distanceKm * 65 * (surfaceType === 'trail' ? 1.25 : 1.0));

  const statusText: Record<GpsStatus, string> = {
    locating: 'Finding your location…',
    ready: `GPS ready${currentFix ? ` (±${Math.round(currentFix.accuracy)} m)` : ''}`,
    weak: `Weak GPS signal${currentFix ? ` (±${Math.round(currentFix.accuracy)} m)` : ''}. Try moving outdoors.`,
    denied: 'Location access is blocked',
    unavailable: 'Location isn’t available on this device',
    insecure: 'GPS needs a secure (https) connection',
  };

  const statusColor =
    demoMode ? 'bg-[#B37FEB]' : gpsStatus === 'ready' ? 'bg-[#00D26A]' : gpsStatus === 'weak' || gpsStatus === 'locating' ? 'bg-[#FFB800]' : 'bg-[#F6465D]';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Navigation className="h-6 w-6 text-[#C8FF00]" />
            <span>Record a Run</span>
          </h1>
          <p className="text-sm text-[#848E9C] mt-1">
            {phase === 'idle'
              ? 'Head outside, wait for the GPS to lock on, then tap Start.'
              : phase === 'recording'
              ? 'Recording. Keep this screen open for the best accuracy.'
              : 'Paused. Resume when you’re ready, or finish to save.'}
          </p>
        </div>

        {phase === 'idle' && (
          <div role="group" aria-label="Surface" className="flex items-center gap-1 bg-[#12151b] p-1 rounded-xl border border-[#1e232d] text-sm self-start">
            {(['road', 'trail'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSurfaceType(s)}
                aria-pressed={surfaceType === s}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  surfaceType === s ? 'bg-[#C8FF00] text-black' : 'text-[#848E9C] hover:text-white'
                }`}
              >
                {s === 'road' ? 'Road' : 'Trail'}
              </button>
            ))}
          </div>
        )}
      </div>

      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-[#00D26A]/10 border border-[#00D26A]/30 text-[#00D26A] text-sm flex items-center gap-2.5"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </motion.div>
      )}

      {errorMsg && (
        <div role="alert" className="p-4 rounded-2xl bg-[#F6465D]/10 border border-[#F6465D]/30 text-[#F6465D] text-sm">
          {errorMsg}
        </div>
      )}

      {/* GPS problems: explain what to do instead of failing silently */}
      {!demoMode && (gpsStatus === 'denied' || gpsStatus === 'unavailable' || gpsStatus === 'insecure') && (
        <div className="p-4 rounded-2xl bg-[#FFB800]/10 border border-[#FFB800]/30 text-sm text-[#FFB800] space-y-2">
          <p className="font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {statusText[gpsStatus]}
          </p>
          <p className="text-[#EAECEF]">
            {gpsStatus === 'denied'
              ? 'Allow location for this site in your browser settings, then reload the page.'
              : gpsStatus === 'insecure'
              ? 'Open the app through its https:// address to use GPS.'
              : 'Try again outdoors, or on a phone with GPS.'}{' '}
            You can also try the tracker in demo mode.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 rounded-3xl overflow-hidden border border-[#1e232d] shadow-cyber-card relative h-[55vh] min-h-[320px] lg:h-[460px]">
          <div ref={mapContainerRef} className="w-full h-full" />

          <div className="absolute top-3 left-3 right-14 z-[500] flex">
            <div className="px-3 py-2 rounded-xl bg-black/80 backdrop-blur-md border border-[#1e232d] text-sm text-white flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${statusColor} ${phase === 'recording' ? 'animate-pulse' : ''}`} />
              <span>
                {demoMode
                  ? phase === 'recording'
                    ? 'Demo mode: simulated route'
                    : 'Demo mode on'
                  : phase === 'recording'
                  ? 'Recording'
                  : phase === 'paused'
                  ? 'Paused'
                  : statusText[gpsStatus]}
              </span>
            </div>
          </div>

          {currentFix && !demoMode && (
            <button
              onClick={() => mapInstanceRef.current?.setView([currentFix.lat, currentFix.lng], 17)}
              aria-label="Center map on my location"
              className="absolute bottom-3 right-3 z-[500] h-11 w-11 rounded-xl bg-black/80 border border-[#1e232d] text-white flex items-center justify-center"
            >
              <LocateFixed className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Stats + controls */}
        <div className="space-y-4">
          <div className="p-4 sm:p-6 rounded-3xl bg-[#12151b] border border-[#1e232d] space-y-4 shadow-cyber-card">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Distance', value: distanceKm.toFixed(2), unit: 'km', color: 'text-white' },
                { label: 'Time', value: formatDuration(elapsedSec), unit: '', color: 'text-white' },
                { label: 'Avg pace', value: formatPace(track.distanceM, elapsedSec), unit: '/km', color: 'text-[#00E5FF]' },
                { label: 'Climb', value: Math.round(track.elevationGainM).toString(), unit: 'm', color: 'text-[#FFB800]' },
              ].map((s) => (
                <div key={s.label} className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d]">
                  <span className="text-xs font-medium text-[#848E9C]">{s.label}</span>
                  <p className={`text-2xl font-black font-mono mt-1 ${s.color}`}>
                    {s.value}
                    {s.unit && <span className="text-xs text-[#848E9C] ml-1">{s.unit}</span>}
                  </p>
                </div>
              ))}
            </div>

            {/* Controls */}
            {phase === 'idle' && (
              <button
                onClick={startActivity}
                disabled={!canStart}
                className="w-full py-4 rounded-2xl bg-[#C8FF00] text-black font-bold text-base flex items-center justify-center gap-2 shadow-glow-lime hover:bg-[#d4ff33] transition-all disabled:opacity-40 disabled:shadow-none"
              >
                <Play className="h-5 w-5 fill-black" />
                {canStart ? 'Start' : 'Waiting for GPS…'}
              </button>
            )}

            {phase === 'recording' && (
              <button
                onClick={pauseActivity}
                className="w-full py-4 rounded-2xl bg-[#FFB800] text-black font-bold text-base flex items-center justify-center gap-2"
              >
                <Pause className="h-5 w-5 fill-black" /> Pause
              </button>
            )}

            {phase === 'paused' && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={resumeActivity}
                  disabled={saving}
                  className="py-4 rounded-2xl bg-[#C8FF00] text-black font-bold text-base flex items-center justify-center gap-2"
                >
                  <Play className="h-5 w-5 fill-black" /> Resume
                </button>
                <button
                  onClick={finishActivity}
                  disabled={saving}
                  className="py-4 rounded-2xl bg-[#F6465D] text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Square className="h-5 w-5 fill-white" /> {saving ? 'Saving…' : 'Finish'}
                </button>
                <button
                  onClick={resetActivity}
                  disabled={saving}
                  className="col-span-2 py-2.5 rounded-xl text-sm text-[#848E9C] hover:text-[#F6465D] flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="h-4 w-4" /> Discard this run
                </button>
              </div>
            )}

            {phase === 'idle' && (
              <label className="flex items-start gap-3 p-3 rounded-2xl bg-[#07080a] border border-[#1e232d] cursor-pointer">
                <input
                  type="checkbox"
                  checked={demoMode}
                  onChange={(e) => setDemoMode(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#B37FEB]"
                />
                <span className="text-sm">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <FlaskConical className="h-4 w-4 text-[#B37FEB]" /> Demo mode
                  </span>
                  <span className="text-[#848E9C]">
                    Simulates a run from your current spot. For trying the app indoors; demo runs
                    are saved like real ones.
                  </span>
                </span>
              </label>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-[#0d1015] border border-[#1e232d] space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#C8FF00]">
              <Sparkles className="h-4 w-4" />
              <span>Calorie bonus: ~{estCalories} kcal</span>
            </div>
            <p className="text-sm text-[#848E9C] leading-relaxed">
              When you save this run, these calories are added to today’s food target so you can
              refuel properly.
            </p>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="space-y-4 pt-2">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#C8FF00]" />
          <span>Your past runs ({runs.length})</span>
        </h2>

        {runs.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-[#12151b] border border-[#1e232d] text-sm text-[#848E9C]">
            No runs yet. Your first one will show up here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {runs.map((r) => (
              <div
                key={r.id}
                className="p-4 sm:p-5 rounded-3xl bg-[#12151b] border border-[#1e232d] shadow-cyber-card space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        r.surface_type === 'trail'
                          ? 'bg-[#C8FF00]/15 text-[#C8FF00] border border-[#C8FF00]/30'
                          : 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30'
                      }`}
                    >
                      {r.surface_type}
                    </span>
                    <span className="text-sm text-[#848E9C] truncate">
                      {new Date(r.recorded_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-bold text-[#C8FF00] shrink-0">
                    +{Math.round(r.burned_kcal)} kcal
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-[#848E9C] block">Distance</span>
                    <span className="font-bold font-mono text-white">{r.distance_km.toFixed(2)} km</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#848E9C] block">Time</span>
                    <span className="font-bold font-mono text-white">{formatDuration(r.duration_sec)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#848E9C] block">Pace</span>
                    <span className="font-bold font-mono text-white">
                      {formatPace(r.distance_km * 1000, r.duration_sec)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
