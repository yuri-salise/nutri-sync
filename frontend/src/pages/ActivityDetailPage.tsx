import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Flame, Globe, Lock, Mountain, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { RunActivity } from '../types';
import { useAuth } from '../context/AuthContext';
import { useDialogs } from '../components/common/DialogProvider';
import { SportIcon } from '../components/activity/SportIcon';
import { RouteThumb, parseRoute } from '../components/activity/RouteThumb';
import { formatSpeed, parseApiDate, sportInfo } from '../utils/activity';
import { formatDuration, formatPace } from '../utils/gps';

/** Detail view of one recorded activity (requirement F2). */
export const ActivityDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirm } = useDialogs();
  const [run, setRun] = useState<RunActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const runId = Number(id);
    if (!Number.isInteger(runId) || runId <= 0) {
      setError('This activity link is not valid.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getRun(runId)
      .then((data) => {
        if (!cancelled) setRun(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this activity.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleDelete = async () => {
    if (!run) return;
    const ok = await confirm({
      title: 'Delete this activity?',
      message: 'It will be removed from your history. This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.deleteRun(run.id);
      navigate('/record');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete this activity.');
      setDeleting(false);
    }
  };

  const back = (
    <Link
      to="/record"
      className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink focus:outline-none focus-visible:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to activities
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {back}
        <p role="status" className="text-sm text-muted">
          Loading activity…
        </p>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="space-y-4">
        {back}
        <div role="alert" className="p-4 rounded-2xl bg-card border border-line text-sm text-danger">
          {error ?? 'Activity not found.'}
        </div>
      </div>
    );
  }

  const sp = sportInfo(run.sport_type);
  const route = parseRoute(run.route_geojson);
  const metrics = [
    { label: 'Distance', value: `${run.distance_km.toFixed(2)} km` },
    { label: 'Time', value: formatDuration(run.duration_sec) },
    {
      label: sp.showSpeed ? 'Speed' : 'Pace',
      value: sp.showSpeed
        ? formatSpeed(run.distance_km * 1000, run.duration_sec)
        : `${formatPace(run.distance_km * 1000, run.duration_sec)} /km`,
    },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      {back}

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2.5">
          <span style={{ color: sp.color }}>
            <SportIcon sport={run.sport_type} className="h-6 w-6" />
          </span>
          {run.title || sp.label}
        </h1>
        <p className="text-sm text-muted flex items-center gap-2">
          {parseApiDate(run.recorded_at).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          <span aria-hidden="true">·</span>
          {run.is_public ? (
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" aria-hidden="true" /> Shared
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Private
            </span>
          )}
        </p>
      </header>

      <div className="h-64 sm:h-80 rounded-3xl bg-well border border-line flex items-center justify-center overflow-hidden">
        {route.length > 1 ? (
          <RouteThumb points={route} color={sp.color} label={`Route of ${run.title || sp.label}`} />
        ) : (
          <span className="text-sm text-muted">No route was recorded for this activity.</span>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="p-4 rounded-2xl bg-card border border-line">
            <dt className="text-xs text-muted">{m.label}</dt>
            <dd className="text-lg font-black tabular-nums text-ink">{m.value}</dd>
          </div>
        ))}
      </dl>

      <dl className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-line flex items-center gap-3">
          <Mountain className="h-5 w-5 text-muted" aria-hidden="true" />
          <div>
            <dt className="text-xs text-muted">Elevation gain</dt>
            <dd className="text-base font-bold tabular-nums text-ink">{Math.round(run.elevation_gain_m)} m</dd>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-card border border-line flex items-center gap-3">
          <Flame className="h-5 w-5 text-muted" aria-hidden="true" />
          <div>
            <dt className="text-xs text-muted">Estimated energy</dt>
            <dd className="text-base font-bold tabular-nums text-ink">{Math.round(run.burned_kcal)} kcal</dd>
          </div>
        </div>
      </dl>
      <p className="text-xs text-muted">
        Energy is an estimate from distance, time and body weight. Heart rate is not used.
      </p>

      {user?.id === run.user_id && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-danger/40 text-sm font-semibold text-danger hover:bg-danger/10 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {deleting ? 'Deleting…' : 'Delete activity'}
        </button>
      )}
    </div>
  );
};
