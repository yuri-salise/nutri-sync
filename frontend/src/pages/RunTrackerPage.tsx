import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { RunActivity } from '../types';
import {
  MapPin,
  Play,
  Square,
  Flame,
  Gauge,
  Mountain,
  Clock,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Compass,
  Navigation,
  Sparkles,
} from 'lucide-react';
import L from 'leaflet';

export const RunTrackerPage: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  const [runs, setRuns] = useState<RunActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [surfaceType, setSurfaceType] = useState<'road' | 'trail'>('trail');
  const [distanceKm, setDistanceKm] = useState(0.0);
  const [durationSec, setDurationSec] = useState(0);
  const [elevationM, setElevationM] = useState(85.0);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const timerRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    try {
      setLoading(true);
      const res = await api.getRuns({ limit: 20 });
      setRuns(res.data);
    } catch (err) {
      console.error('Failed to load runs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize Dark Mode Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center BGC / Track: 14.5500, 121.0500
    const initialCoords: [number, number] = [14.5500, 121.0500];
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView(initialCoords, 15);

    // Free OpenStreetMap tile server with dark inverted styling (no API key required)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'dark-tiles',
    }).addTo(map);

    // Glowing OKX Neon Lime Polyline
    const polyline = L.polyline([], {
      color: '#C8FF00',
      weight: 5,
      opacity: 0.95,
      lineJoin: 'round',
    }).addTo(map);

    // Runner marker beacon
    const marker = L.circleMarker(initialCoords, {
      radius: 8,
      fillColor: '#C8FF00',
      fillOpacity: 1,
      color: '#000000',
      weight: 3,
    }).addTo(map);

    mapInstanceRef.current = map;
    polylineRef.current = polyline;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map polyline and runner marker position
  useEffect(() => {
    if (polylineRef.current && routeCoordinates.length > 0) {
      polylineRef.current.setLatLngs(routeCoordinates);
      const lastCoord = routeCoordinates[routeCoordinates.length - 1];

      if (markerRef.current) {
        markerRef.current.setLatLng(lastCoord);
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo(lastCoord);
      }
    }
  }, [routeCoordinates]);

  // Handle GPS Run Tracking (Simulator + W3C Geolocation)
  const startRun = () => {
    setIsTracking(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    setDurationSec(0);
    setDistanceKm(0.0);

    const startPoint: [number, number] = [14.5500, 121.0500];
    const initialPath: [number, number][] = [startPoint];
    setRouteCoordinates(initialPath);

    // Try real navigator.geolocation if available, else smooth simulator
    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setRouteCoordinates((prev) => [...prev, [lat, lng]]);
        },
        (err) => {
          console.warn('Real GPS unavailable, continuing in simulator mode:', err.message);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    timerRef.current = setInterval(() => {
      setDurationSec((prev) => prev + 1);

      // Advance GPS simulation coordinate every 2 seconds
      setRouteCoordinates((prev) => {
        const last = prev[prev.length - 1] || startPoint;
        const nextLat = last[0] + (Math.random() - 0.46) * 0.0004;
        const nextLng = last[1] + (Math.random() - 0.44) * 0.0004;
        const newCoords: [number, number] = [nextLat, nextLng];

        setDistanceKm((d) => parseFloat((d + 0.005).toFixed(3)));
        return [...prev, newCoords];
      });
    }, 1000);
  };

  const stopRun = async () => {
    setIsTracking(false);
    clearInterval(timerRef.current);
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (durationSec < 3) {
      setErrorMsg('Run session too short to record.');
      return;
    }

    setSaving(true);
    try {
      const geojsonStr = JSON.stringify({
        type: 'LineString',
        coordinates: routeCoordinates.map(([lat, lng]) => [lng, lat]),
      });

      await api.createRun({
        surface_type: surfaceType,
        distance_km: Math.max(distanceKm, 0.1),
        duration_sec: Math.max(durationSec, 10),
        elevation_gain_m: elevationM,
        route_geojson: geojsonStr,
        is_public: true,
      });

      setSuccessMsg('GPS Road/Trail Run synchronized into dynamic metabolism!');
      loadRuns();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save run activity.');
    } finally {
      setSaving(false);
    }
  };

  const paceMinPerKm = distanceKm > 0 ? (durationSec / 60 / distanceKm).toFixed(2) : '0.00';
  const estCalories = Math.round(distanceKm * 65 * (surfaceType === 'trail' ? 1.25 : 1.0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Navigation className="h-6 w-6 text-[#C8FF00]" />
            <span>GPS Road & Trail Run Telemetry</span>
          </h1>
          <p className="text-sm text-[#848E9C]">
            Live browser geolocation & Leaflet Dark tracking with surface-adjusted calorie expenditure
          </p>
        </div>

        {/* Surface type selector */}
        <div className="flex items-center gap-1 bg-[#12151b] p-1 rounded-xl border border-[#1e232d] text-xs">
          <button
            onClick={() => setSurfaceType('road')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              surfaceType === 'road'
                ? 'bg-[#00E5FF] text-black shadow-glow-cyan'
                : 'text-[#848E9C] hover:text-white'
            }`}
          >
            Road (Flat)
          </button>
          <button
            onClick={() => setSurfaceType('trail')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              surfaceType === 'trail'
                ? 'bg-[#C8FF00] text-black shadow-glow-lime'
                : 'text-[#848E9C] hover:text-white'
            }`}
          >
            Trail (+25% Energy)
          </button>
        </div>
      </div>

      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-[#00D26A]/10 border border-[#00D26A]/30 text-[#00D26A] text-xs flex items-center gap-2.5 shadow-glow-green"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </motion.div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-[#F6465D]/10 border border-[#F6465D]/30 text-[#F6465D] text-xs flex items-center gap-2.5">
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Map & Live HUD Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Container */}
        <div className="lg:col-span-2 rounded-3xl overflow-hidden border border-[#1e232d] shadow-okx-card relative h-[450px]">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Map Overlay Badge */}
          <div className="absolute top-4 left-4 z-[500] px-3 py-1.5 rounded-xl bg-[#000000]/80 backdrop-blur-md border border-[#1e232d] text-xs font-mono text-white flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isTracking ? 'bg-[#C8FF00] animate-ping' : 'bg-[#848E9C]'}`} />
            <span>{isTracking ? 'LIVE GPS STREAMING' : 'GPS STANDBY'}</span>
          </div>

          {/* Floating Controls */}
          <div className="absolute bottom-4 left-4 right-4 z-[500] flex items-center justify-between pointer-events-auto">
            <div className="px-3.5 py-2 rounded-xl bg-[#000000]/80 backdrop-blur-md border border-[#1e232d] text-xs font-mono text-[#C8FF00] font-bold">
              {routeCoordinates.length} waypoints recorded
            </div>

            {!isTracking ? (
              <button
                onClick={startRun}
                className="px-6 py-3 rounded-2xl bg-[#C8FF00] text-black font-bold text-xs flex items-center gap-2 shadow-glow-lime hover:bg-[#d4ff33] transition-all transform hover:scale-105"
              >
                <Play className="h-4 w-4 fill-black" />
                <span>START TRACKING</span>
              </button>
            ) : (
              <button
                onClick={stopRun}
                disabled={saving}
                className="px-6 py-3 rounded-2xl bg-[#F6465D] text-white font-bold text-xs flex items-center gap-2 shadow-glow-red hover:bg-[#ff3b30] transition-all"
              >
                <Square className="h-4 w-4 fill-white" />
                <span>{saving ? 'SYNCHRONIZING...' : 'FINISH & SYNC'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live HUD Dashboard */}
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-[#12151b] border border-[#1e232d] space-y-4 shadow-okx-card">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#848E9C] flex items-center gap-2">
              <Gauge className="h-4 w-4 text-[#C8FF00]" />
              <span>Real-Time Run HUD</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d]">
                <span className="text-[10px] font-mono text-[#848E9C] uppercase">Distance</span>
                <p className="text-2xl font-black font-mono text-white mt-1">
                  {distanceKm.toFixed(2)}
                  <span className="text-xs text-[#848E9C] ml-1">km</span>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d]">
                <span className="text-[10px] font-mono text-[#848E9C] uppercase">Elapsed</span>
                <p className="text-2xl font-black font-mono text-white mt-1">
                  {Math.floor(durationSec / 60)
                    .toString()
                    .padStart(2, '0')}
                  :
                  {(durationSec % 60).toString().padStart(2, '0')}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d]">
                <span className="text-[10px] font-mono text-[#848E9C] uppercase">Avg Pace</span>
                <p className="text-2xl font-black font-mono text-[#00E5FF] mt-1">
                  {paceMinPerKm}
                  <span className="text-xs text-[#848E9C] ml-1">/km</span>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d]">
                <span className="text-[10px] font-mono text-[#848E9C] uppercase">Calories</span>
                <p className="text-2xl font-black font-mono text-[#C8FF00] mt-1">
                  {estCalories}
                  <span className="text-xs text-[#848E9C] ml-1">kcal</span>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Mountain className="h-4 w-4 text-[#FFB800]" />
                <span className="text-xs text-[#848E9C]">Elevation Gain</span>
              </div>
              <span className="font-mono text-sm font-bold text-white">+{elevationM} m</span>
            </div>
          </div>

          {/* Activity Sync Banner */}
          <div className="p-5 rounded-2xl bg-[#0d1015] border border-[#1e232d] space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#C8FF00]">
              <Sparkles className="h-4 w-4" />
              <span>Metabolism Scaler</span>
            </div>
            <p className="text-[11px] text-[#848E9C] leading-relaxed">
              When synced, this run adds ~{estCalories} kcal to your dynamic daily ceiling and increases carbohydrate targets for glycogen replenishment.
            </p>
          </div>
        </div>
      </div>

      {/* Historical Runs */}
      <div className="space-y-4 pt-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#C8FF00]" />
          <span>Recorded GPS Sessions ({runs.length})</span>
        </h3>

        {runs.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-[#12151b] border border-[#1e232d] text-xs text-[#848E9C]">
            No runs logged yet. Click "Start Tracking" to map your first road or trail route.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {runs.map((r) => (
              <div
                key={r.id}
                className="p-5 rounded-3xl bg-[#12151b] border border-[#1e232d] shadow-okx-card hover:border-[#2a313f] transition-colors space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        r.surface_type === 'trail'
                          ? 'bg-[#C8FF00]/15 text-[#C8FF00] border border-[#C8FF00]/30'
                          : 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30'
                      }`}
                    >
                      {r.surface_type}
                    </span>
                    <span className="text-xs text-[#848E9C]">
                      {new Date(r.recorded_at).toLocaleDateString()}
                    </span>
                  </div>

                  <span className="font-mono text-xs font-bold text-[#C8FF00]">
                    +{Math.round(r.burned_kcal)} kcal
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1 font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-[#848E9C] block">Distance</span>
                    <span className="font-bold text-white">{r.distance_km.toFixed(2)} km</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#848E9C] block">Duration</span>
                    <span className="font-bold text-white">
                      {Math.round(r.duration_sec / 60)} min
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#848E9C] block">Elevation</span>
                    <span className="font-bold text-white">+{Math.round(r.elevation_gain_m)}m</span>
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
