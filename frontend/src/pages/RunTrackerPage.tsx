import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { RunActivity, SportType } from '../types';
import { useAuth } from '../context/AuthContext';
import { Overlay } from '../components/common/Overlay';
import { SportIcon } from '../components/activity/SportIcon';
import { RouteThumb, parseRoute } from '../components/activity/RouteThumb';
import { SPORTS, estimateKcal, formatSpeed, parseApiDate, sportInfo } from '../utils/activity';
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
  Globe,
  Lock,
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
  const { user } = useAuth();
  const [sport, setSport] = useState<SportType>('run');
  const info = sportInfo(sport);
  const surfaceType = info.surface;
  const [finishOpen, setFinishOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [shareToFeed, setShareToFeed] = useState(true);
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
      zoomControl: false,
      attributionControl: true,
    }).setView(COUNTRY_VIEW, 6);
    // Top right: the status pill sits top left and would cover the buttons there.
    L.control.zoom({ position: 'topright' }).addTo(map);

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

  const defaultTitle = () => {
    const h = new Date().getHours();
    const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
    return `${part} ${info.label}`;
  };

  const requestFinish = () => {
    stopTicking();
    const durationSec = Math.floor(accumulatedMsRef.current / 1000);
    phaseRef.current = 'paused';
    setPhase('paused');

    if (trackRef.current.distanceM < 50 || durationSec < 30) {
      setErrorMsg('That’s a bit short to save. Keep going, or tap Discard if you want to start over.');
      return;
    }
    setErrorMsg(null);
    setTitle(defaultTitle());
    setFinishOpen(true);
  };

  const saveActivity = async () => {
    const finalTrack = trackRef.current;
    const durationSec = Math.floor(accumulatedMsRef.current / 1000);
    setSaving(true);
    setErrorMsg(null);
    try {
      await api.createRun({
        sport_type: sport,
        title: title.trim() || undefined,
        surface_type: surfaceType,
        distance_km: Math.round(finalTrack.distanceM) / 1000,
        duration_sec: durationSec,
        elevation_gain_m: Math.round(finalTrack.elevationGainM),
        route_geojson: JSON.stringify({
          type: 'LineString',
          coordinates: finalTrack.points.map((p) => [p.lng, p.lat]),
        }),
        is_public: shareToFeed,
      });
      setSuccessMsg(
        `Nice work! ${(finalTrack.distanceM / 1000).toFixed(2)} km saved${shareToFeed ? ' and shared to the feed' : ''}. Your calorie target for today has been updated.`
      );
      setFinishOpen(false);
      resetActivity();
      loadRuns();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setFinishOpen(false);
      setErrorMsg(err.message || 'We couldn’t save your activity. Your route is still here, so try Finish again.');
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------- derived
  const distanceKm = track.distanceM / 1000;
  const estCalories = Math.round(
    estimateKcal(sport, user?.weight_kg ?? 70, distanceKm, Math.max(elapsedSec, 1), track.elevationGainM, surfaceType)
  );

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
      {/* Sticky Active Activity Bar when recording or paused */}
      {phase !== 'idle' && (
        <div
          data-testid="sticky-recording-bar"
          className="sticky top-16 z-30 -mt-2 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 bg-[#07080a]/95 backdrop-blur-md border-b border-[#1e232d] shadow-lg flex items-center justify-between transition-all"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: `${info.color}20`,
                borderColor: `${info.color}50`,
                color: info.color,
              }}
            >
              <SportIcon sport={sport} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-white truncate">
                  {phase === 'recording' ? `Recording ${info.label}` : `${info.label} (Paused)`}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    phase === 'recording'
                      ? 'bg-[#00D26A]/15 text-[#00D26A] border border-[#00D26A]/30'
                      : 'bg-[#FFB800]/15 text-[#FFB800] border border-[#FFB800]/30'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      phase === 'recording' ? 'bg-[#00D26A] animate-pulse' : 'bg-[#FFB800]'
                    }`}
                  />
                  {phase === 'recording' ? 'Live' : 'Paused'}
                </span>
              </div>
              <p className="text-xs text-[#848E9C] font-mono">
                {formatDuration(elapsedSec)} · {distanceKm.toFixed(2)} km
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {phase === 'recording' ? (
              <button
                onClick={pauseActivity}
                className="px-3.5 py-1.5 rounded-xl bg-[#FFB800] text-black text-xs font-bold flex items-center gap-1.5 hover:bg-[#ffc633] transition-all"
              >
                <Pause className="h-3.5 w-3.5 fill-black" /> Pause
              </button>
            ) : (
              <button
                onClick={resumeActivity}
                className="px-3.5 py-1.5 rounded-xl bg-[#C8FF00] text-black text-xs font-bold flex items-center gap-1.5 hover:bg-[#d4ff33] transition-all"
              >
                <Play className="h-3.5 w-3.5 fill-black" /> Resume
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Navigation className="h-6 w-6 text-[#C8FF00]" />
            <span>Record an Activity</span>
          </h1>
          <p className="text-sm text-[#848E9C] mt-1">
            {phase === 'idle'
              ? 'Pick your activity, wait for the GPS to lock on, then tap Start.'
              : phase === 'recording'
              ? `Recording your ${info.label.toLowerCase()} live. Keep this screen open for the best accuracy.`
              : `${info.label} paused. Resume when you’re ready, or finish to save.`}
          </p>
        </div>

        {phase === 'idle' ? (
          <div role="group" aria-label="Activity type" className="grid grid-cols-4 gap-2 sm:w-96">
            {SPORTS.map((sp) => (
              <button
                key={sp.id}
                onClick={() => setSport(sp.id)}
                aria-pressed={sport === sp.id}
                className={`h-16 rounded-2xl border flex flex-col items-center justify-center gap-1 text-sm font-semibold transition-all ${
                  sport === sp.id
                    ? 'bg-[#C8FF00] text-black border-[#C8FF00]'
                    : 'bg-[#12151b] text-[#B7BDC6] border-[#1e232d] hover:text-white'
                }`}
              >
                <SportIcon sport={sp.id} className="h-5 w-5" />
                {sp.label}
              </button>
            ))}
          </div>
        ) : (
          <div
            data-testid="header-active-activity"
            className="flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-[#12151b] border border-[#1e232d] sm:min-w-[240px] shadow-cyber-card"
          >
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: `${info.color}20`,
                borderColor: `${info.color}50`,
                color: info.color,
              }}
            >
              <SportIcon sport={sport} className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[#848E9C]">
                  Active Activity
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    phase === 'recording'
                      ? 'bg-[#00D26A]/15 text-[#00D26A] border border-[#00D26A]/30'
                      : 'bg-[#FFB800]/15 text-[#FFB800] border border-[#FFB800]/30'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      phase === 'recording' ? 'bg-[#00D26A] animate-pulse' : 'bg-[#FFB800]'
                    }`}
                  />
                  {phase === 'recording' ? 'Live' : 'Paused'}
                </span>
              </div>
              <p className="text-lg font-black text-white truncate flex items-center gap-1.5">
                <span>{info.label}</span>
                <span className="text-xs font-normal text-[#848E9C] capitalize">({surfaceType})</span>
              </p>
            </div>
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
        <div className="lg:col-span-2 rounded-3xl overflow-hidden border border-[#1e232d] shadow-cyber-card relative isolate h-[55vh] min-h-[320px] lg:h-[460px]">
          <div ref={mapContainerRef} className="w-full h-full" />

          <div className="absolute top-3 left-3 right-14 z-[500] flex flex-wrap gap-2 items-center">
            <div className="px-3 py-2 rounded-xl bg-black/85 backdrop-blur-md border border-[#1e232d] text-sm text-white flex items-center gap-2 shadow-lg">
              <span className={`h-2.5 w-2.5 rounded-full ${statusColor} ${phase === 'recording' ? 'animate-pulse' : ''}`} />
              <span className="font-semibold">
                {demoMode
                  ? phase === 'recording'
                    ? `Simulated ${info.label}`
                    : 'Demo mode on'
                  : phase === 'recording'
                  ? `Recording ${info.label}`
                  : phase === 'paused'
                  ? `${info.label} (Paused)`
                  : statusText[gpsStatus]}
              </span>
            </div>
            {phase !== 'idle' && (
              <div
                className="px-2.5 py-1.5 rounded-xl bg-black/85 backdrop-blur-md border border-[#1e232d] text-xs font-bold flex items-center gap-1.5 shadow-lg"
                style={{ color: info.color }}
              >
                <SportIcon sport={sport} className="h-4 w-4" />
                <span>{info.label}</span>
              </div>
            )}
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
            {/* Active Activity banner inside stats & controls card */}
            {phase !== 'idle' && (
              <div
                data-testid="stats-active-activity"
                className="p-3.5 rounded-2xl bg-[#07080a] border border-[#1e232d] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center border shrink-0"
                    style={{
                      backgroundColor: `${info.color}15`,
                      borderColor: `${info.color}40`,
                      color: info.color,
                    }}
                  >
                    <SportIcon sport={sport} className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#848E9C] block">
                      Currently Recording
                    </span>
                    <span className="text-base font-extrabold text-white flex items-center gap-1.5">
                      {info.label}
                      <span className="text-xs font-normal text-[#848E9C]">({surfaceType})</span>
                    </span>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    phase === 'recording'
                      ? 'bg-[#00D26A]/15 text-[#00D26A] border border-[#00D26A]/30'
                      : 'bg-[#FFB800]/15 text-[#FFB800] border border-[#FFB800]/30'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      phase === 'recording' ? 'bg-[#00D26A] animate-pulse' : 'bg-[#FFB800]'
                    }`}
                  />
                  {phase === 'recording' ? 'Live' : 'Paused'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Distance', value: distanceKm.toFixed(2), unit: 'km', color: 'text-white' },
                { label: 'Time', value: formatDuration(elapsedSec), unit: '', color: 'text-white' },
                info.showSpeed
                  ? { label: 'Avg speed', value: formatSpeed(track.distanceM, elapsedSec), unit: 'km/h', color: 'text-[#00E5FF]' }
                  : { label: 'Avg pace', value: formatPace(track.distanceM, elapsedSec), unit: '/km', color: 'text-[#00E5FF]' },
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
                {canStart ? `Start ${info.label}` : 'Waiting for GPS…'}
              </button>
            )}

            {phase === 'recording' && (
              <button
                onClick={pauseActivity}
                className="w-full py-4 rounded-2xl bg-[#FFB800] text-black font-bold text-base flex items-center justify-center gap-2"
              >
                <Pause className="h-5 w-5 fill-black" /> Pause {info.label}
              </button>
            )}

            {phase === 'paused' && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={resumeActivity}
                  disabled={saving}
                  className="py-4 rounded-2xl bg-[#C8FF00] text-black font-bold text-base flex items-center justify-center gap-2"
                >
                  <Play className="h-5 w-5 fill-black" /> Resume {info.label}
                </button>
                <button
                  onClick={requestFinish}
                  disabled={saving}
                  className="py-4 rounded-2xl bg-[#F6465D] text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Square className="h-5 w-5 fill-white" /> Finish
                </button>
                <button
                  onClick={resetActivity}
                  disabled={saving}
                  className="col-span-2 py-2.5 rounded-xl text-sm text-[#848E9C] hover:text-[#F6465D] flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="h-4 w-4" /> Discard this {info.label.toLowerCase()}
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
                    Simulates an activity from your current spot. For trying the app indoors; demo
                    activities are saved like real ones.
                  </span>
                </span>
              </label>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-[#0d1015] border border-[#1e232d] space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#C8FF00]">
              <Sparkles className="h-4 w-4" />
              <span>{info.label} calorie bonus: ~{estCalories} kcal</span>
            </div>
            <p className="text-sm text-[#848E9C] leading-relaxed">
              When you save this {info.label.toLowerCase()}, these calories are added to today’s food target so you can
              refuel properly.
            </p>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="space-y-4 pt-2">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#C8FF00]" />
          <span>Your activities ({runs.length})</span>
        </h2>

        {runs.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-[#12151b] border border-[#1e232d] text-sm text-[#848E9C]">
            Nothing recorded yet. Your first activity will show up here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {runs.map((r) => {
              const sp = sportInfo(r.sport_type);
              const route = parseRoute(r.route_geojson);
              return (
                <div key={r.id} className="p-4 rounded-3xl bg-[#12151b] border border-[#1e232d] shadow-cyber-card flex gap-4">
                  <div className="h-24 w-24 shrink-0 rounded-2xl bg-[#07080a] border border-[#1e232d] flex items-center justify-center overflow-hidden">
                    {route.length > 1 ? (
                      <RouteThumb points={route} color={sp.color} />
                    ) : (
                      <span style={{ color: sp.color }}>
                        <SportIcon sport={r.sport_type} className="h-8 w-8" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                        <span style={{ color: sp.color }}>
                          <SportIcon sport={r.sport_type} className="h-4 w-4" />
                        </span>
                        {r.title || sp.label}
                      </p>
                      <p className="text-xs text-[#848E9C] flex items-center gap-1.5">
                        {parseApiDate(r.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        <span aria-hidden="true">·</span>
                        {r.is_public ? <Globe className="h-3 w-3" aria-label="Shared" /> : <Lock className="h-3 w-3" aria-label="Private" />}
                        <span>{Math.round(r.burned_kcal)} kcal</span>
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-xs text-[#848E9C] block">Distance</span>
                        <span className="font-bold font-mono text-white">
                          {r.distance_km.toFixed(2)}
                          <span className="text-xs text-[#848E9C]"> km</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-[#848E9C] block">Time</span>
                        <span className="font-bold font-mono text-white">{formatDuration(r.duration_sec)}</span>
                      </div>
                      <div>
                        <span className="text-xs text-[#848E9C] block">{sp.showSpeed ? 'Speed' : 'Pace'}</span>
                        <span className="font-bold font-mono text-white">
                          {sp.showSpeed
                            ? formatSpeed(r.distance_km * 1000, r.duration_sec)
                            : formatPace(r.distance_km * 1000, r.duration_sec)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Name it and share it, like finishing an activity in Strava */}
      {finishOpen && (
        <Overlay>
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="save-activity-title">
            <div className="absolute inset-0 bg-black/70" onClick={() => !saving && setFinishOpen(false)} aria-hidden="true" />
            <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#0d1015] border border-[#1e232d] p-5 space-y-4">
              <h2 id="save-activity-title" className="text-lg font-bold text-white">
                Save your {info.label.toLowerCase()}
              </h2>

              <div className="h-40 rounded-2xl bg-[#07080a] border border-[#1e232d] flex items-center justify-center overflow-hidden">
                {track.points.length > 1 ? (
                  <RouteThumb points={track.points.map((pt) => [pt.lat, pt.lng] as [number, number])} color={info.color} />
                ) : (
                  <span className="text-sm text-[#848E9C]">No route to show</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Distance', value: `${distanceKm.toFixed(2)} km` },
                  { label: 'Time', value: formatDuration(elapsedSec) },
                  { label: 'Calories', value: `${estCalories}` },
                ].map((m) => (
                  <div key={m.label} className="p-3 rounded-2xl bg-[#12151b] border border-[#1e232d]">
                    <p className="text-xs text-[#848E9C]">{m.label}</p>
                    <p className="text-base font-black font-mono text-white">{m.value}</p>
                  </div>
                ))}
              </div>

              <label className="block text-sm text-[#848E9C] space-y-1">
                <span>Name</span>
                <input
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-12 rounded-xl bg-[#07080a] border border-[#1e232d] px-3 text-base text-white focus:border-[#C8FF00] focus:outline-none"
                />
              </label>

              <label className="flex items-start gap-3 text-sm text-white">
                <input
                  type="checkbox"
                  checked={shareToFeed}
                  onChange={(e) => setShareToFeed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#C8FF00]"
                />
                <span>
                  Share to the community feed
                  <span className="block text-xs text-[#848E9C]">Others won’t see the first and last 200 m of your route.</span>
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setFinishOpen(false)}
                  disabled={saving}
                  className="h-12 rounded-2xl bg-[#12151b] border border-[#1e232d] text-white font-semibold text-sm"
                >
                  Keep going
                </button>
                <button
                  onClick={saveActivity}
                  disabled={saving}
                  className="h-12 rounded-2xl bg-[#C8FF00] text-black font-bold text-sm disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save activity'}
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
};
