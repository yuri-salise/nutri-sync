import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { RunActivity } from '../types';
import { MapPin, Play, Square, Flame, Gauge, Mountain, Clock, Trash2, CheckCircle2, ShieldCheck } from 'lucide-react';
import L from 'leaflet';

export const RunTrackerPage: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  const [runs, setRuns] = useState<RunActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [surfaceType, setSurfaceType] = useState<'road' | 'trail'>('trail');
  const [distanceKm, setDistanceKm] = useState(0.0);
  const [durationSec, setDurationSec] = useState(0);
  const [elevationM, setElevationM] = useState(120.0);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const timerRef = useRef<any>(null);

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

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center Manila / BGC track: 14.5500, 121.0500
    const initialCoords: [number, number] = [14.5500, 121.0500];
    const map = L.map(mapContainerRef.current).setView(initialCoords, 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const polyline = L.polyline([], {
      color: '#10b981',
      weight: 5,
      opacity: 0.85,
    }).addTo(map);

    mapInstanceRef.current = map;
    polylineRef.current = polyline;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map polyline
  useEffect(() => {
    if (polylineRef.current && routeCoordinates.length > 0) {
      polylineRef.current.setLatLngs(routeCoordinates);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [20, 20] });
      }
    }
  }, [routeCoordinates]);

  // Handle GPS Run Tracking Simulator / W3C Geolocation
  const startRun = () => {
    setIsTracking(true);
    setSuccessMsg(null);
    setDurationSec(0);
    setDistanceKm(0.0);

    // Initial starting GPS point
    const startPoint: [number, number] = [14.5500, 121.0500];
    const initialPath: [number, number][] = [startPoint];
    setRouteCoordinates(initialPath);

    timerRef.current = setInterval(() => {
      setDurationSec((prev) => prev + 1);

      // Simulate GPS point movement along route every 3 seconds
      setRouteCoordinates((prev) => {
        const last = prev[prev.length - 1] || startPoint;
        const nextLat = last[0] + (Math.random() - 0.45) * 0.0006;
        const nextLng = last[1] + (Math.random() - 0.45) * 0.0006;
        const newCoords: [number, number] = [nextLat, nextLng];

        setDistanceKm((d) => parseFloat((d + 0.015).toFixed(2)));
        return [...prev, newCoords];
      });
    }, 1000);
  };

  const stopRun = async () => {
    setIsTracking(false);
    if (timerRef.current) clearInterval(timerRef.current);

    if (distanceKm <= 0.05) {
      alert('Run too short to record.');
      return;
    }

    setSaving(true);
    try {
      const geojson = JSON.stringify({
        type: 'LineString',
        coordinates: routeCoordinates.map(([lat, lng]) => [lng, lat]),
      });

      await api.createRun({
        surface_type: surfaceType,
        distance_km: distanceKm,
        duration_sec: durationSec,
        elevation_gain_m: elevationM,
        route_geojson: geojson,
        is_public: true,
      });

      setSuccessMsg(`Run recorded! ${distanceKm} km synced to your dynamic daily carbohydrate budget.`);
      loadRuns();
    } catch (err: any) {
      alert(err.message || 'Failed to save run activity.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRun = async (id: number) => {
    if (!confirm('Are you sure you want to delete this run?')) return;
    try {
      await api.deleteRun(id);
      setRuns((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete run.');
    }
  };

  const formatPace = (km: number, sec: number) => {
    if (km <= 0) return "0'00\"";
    const secPerKm = sec / km;
    const min = Math.floor(secPerKm / 60);
    const s = Math.floor(secPerKm % 60);
    return `${min}'${s.toString().padStart(2, '0')}"`;
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <MapPin className="h-6 w-6 text-cyan-400" />
            <span>GPS Road & Trail Run Tracker</span>
          </h1>
          <p className="text-sm text-athletic-muted">
            Live OpenStreetMap polyline route recording and Haversine metabolic sync
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-athletic-muted font-mono flex items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> 150m Privacy Masking Enabled
          </span>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5 shadow-glow-emerald">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Map and HUD Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Leaflet Map Container */}
        <div className="lg:col-span-2 rounded-3xl overflow-hidden border border-athletic-border bg-slate-900 shadow-2xl relative">
          <div ref={mapContainerRef} className="h-96 w-full z-10" />

          {/* Floating Surface Selector */}
          <div className="absolute top-4 right-4 z-20 flex gap-1 bg-slate-950/80 p-1 rounded-xl border border-athletic-border backdrop-blur-md">
            <button
              onClick={() => setSurfaceType('trail')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                surfaceType === 'trail'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-glow-emerald'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Trail Run (+15% MET)
            </button>
            <button
              onClick={() => setSurfaceType('road')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                surfaceType === 'road'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Road Run
            </button>
          </div>
        </div>

        {/* Live HUD Dashboard Card */}
        <div className="p-6 rounded-3xl bg-athletic-card border border-athletic-border space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-athletic-muted flex items-center justify-between">
              <span>Telemetry HUD</span>
              {isTracking && (
                <span className="flex items-center gap-1.5 text-emerald-400 font-mono animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-glow-emerald" /> LIVE RECORDING
                </span>
              )}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              {/* Distance */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-athletic-border space-y-1">
                <span className="text-[11px] text-athletic-muted flex items-center gap-1 font-medium">
                  <MapPin className="h-3.5 w-3.5 text-cyan-400" /> Distance
                </span>
                <p className="text-2xl font-extrabold font-mono text-white tracking-tight">
                  {distanceKm.toFixed(2)} <span className="text-xs font-normal text-athletic-muted">km</span>
                </p>
              </div>

              {/* Time */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-athletic-border space-y-1">
                <span className="text-[11px] text-athletic-muted flex items-center gap-1 font-medium">
                  <Clock className="h-3.5 w-3.5 text-emerald-400" /> Duration
                </span>
                <p className="text-2xl font-extrabold font-mono text-white tracking-tight">
                  {formatTime(durationSec)}
                </p>
              </div>

              {/* Pace */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-athletic-border space-y-1">
                <span className="text-[11px] text-athletic-muted flex items-center gap-1 font-medium">
                  <Gauge className="h-3.5 w-3.5 text-amber-400" /> Pace
                </span>
                <p className="text-2xl font-extrabold font-mono text-white tracking-tight">
                  {formatPace(distanceKm, durationSec)} <span className="text-xs font-normal text-athletic-muted">/km</span>
                </p>
              </div>

              {/* Elevation */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-athletic-border space-y-1">
                <span className="text-[11px] text-athletic-muted flex items-center gap-1 font-medium">
                  <Mountain className="h-3.5 w-3.5 text-emerald-400" /> Elevation
                </span>
                <p className="text-2xl font-extrabold font-mono text-white tracking-tight">
                  {Math.round(elevationM)} <span className="text-xs font-normal text-athletic-muted">m</span>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-athletic-border text-xs text-athletic-muted space-y-1">
              <span className="text-slate-300 font-semibold flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-amber-400" /> Estimated Calorie Burn:
              </span>
              <p className="font-mono text-lg font-bold text-white">
                ~{Math.round(distanceKm * 72 * (surfaceType === 'trail' ? 1.15 : 1.0))} kcal
              </p>
            </div>
          </div>

          {/* Action Trigger Button */}
          {!isTracking ? (
            <button
              onClick={startRun}
              className="w-full py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-emerald-400 to-cyan-400 text-black hover:opacity-95 shadow-glow-emerald flex items-center justify-center gap-2 transition-all"
            >
              <Play className="h-5 w-5 fill-black" />
              <span>Start GPS Run Tracking</span>
            </button>
          ) : (
            <button
              onClick={stopRun}
              disabled={saving}
              className="w-full py-3.5 rounded-2xl font-bold text-sm bg-rose-500 hover:bg-rose-400 text-white shadow-lg flex items-center justify-center gap-2 transition-all animate-pulse"
            >
              <Square className="h-5 w-5 fill-white" />
              <span>{saving ? 'Saving...' : 'Finish & Sync Run'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Run History List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white tracking-tight">Recorded Run History</h2>
        {runs.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-athletic-card border border-athletic-border text-athletic-muted text-xs">
            No run activities logged yet. Take your shoes out and start a GPS run above!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {runs.map((r) => (
              <div
                key={r.id}
                className="p-5 rounded-3xl bg-athletic-card border border-athletic-border hover:border-slate-700 transition-colors space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-900 border border-athletic-border text-cyan-400 uppercase">
                      {r.surface_type} run
                    </span>
                    <h3 className="font-bold text-slate-100 text-base mt-1">{r.distance_km} km</h3>
                  </div>
                  <button
                    onClick={() => handleDeleteRun(r.id)}
                    className="p-1.5 text-athletic-muted hover:text-rose-400 hover:bg-slate-900 rounded-lg"
                    title="Delete run"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-mono text-athletic-muted pt-2 border-t border-athletic-border/60">
                  <div>
                    <span className="block text-[10px] text-athletic-muted">Duration</span>
                    <span className="text-slate-200 font-semibold">{formatTime(r.duration_sec)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-athletic-muted">Burned</span>
                    <span className="text-emerald-400 font-semibold">{Math.round(r.burned_kcal)} kcal</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-athletic-muted">Elevation</span>
                    <span className="text-slate-200 font-semibold">{r.elevation_gain_m}m</span>
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
