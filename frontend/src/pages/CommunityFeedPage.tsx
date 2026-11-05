import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Users, Dumbbell, MapPin, Award, Flame, Clock, ShieldCheck, Filter } from 'lucide-react';

export const CommunityFeedPage: React.FC = () => {
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    loadFeed();
  }, [filterType]);

  const loadFeed = async () => {
    try {
      setLoading(true);
      const res = await api.getCommunityFeed(1, 30, filterType === 'all' ? undefined : filterType);
      setFeedItems(res.data);
    } catch (err) {
      console.error('Failed to load community feed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="h-6 w-6 text-emerald-400" />
            <span>Club & Community Training Feed</span>
          </h1>
          <p className="text-sm text-athletic-muted">
            Public splits, verified member Personal Records (PRs), and GPS trail runs
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-2xl border border-athletic-border self-start sm:self-auto text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              filterType === 'all'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Activities
          </button>
          <button
            onClick={() => setFilterType('workouts')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              filterType === 'workouts'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Lifting Splits
          </button>
          <button
            onClick={() => setFilterType('runs')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              filterType === 'runs'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Trail Runs
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : feedItems.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-athletic-card border border-athletic-border text-athletic-muted text-xs">
          No public training posts in the club feed yet.
        </div>
      ) : (
        <div className="space-y-4">
          {feedItems.map((item) => (
            <div
              key={item.id}
              className="p-6 rounded-3xl bg-athletic-card border border-athletic-border hover:border-slate-700 transition-colors space-y-4 shadow-xl"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-2xl flex items-center justify-center ${
                      item.type === 'workout'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    }`}
                  >
                    {item.type === 'workout' ? <Dumbbell className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-100 text-sm leading-tight">{item.user_name}</h3>
                    <p className="text-[11px] text-athletic-muted">
                      {new Date(item.timestamp).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                {item.has_verified_pr && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 shadow-glow-amber">
                    <Award className="h-3.5 w-3.5" />
                    <span>Verified PR Claim</span>
                  </span>
                )}
              </div>

              {/* Title & Telemetry */}
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white tracking-tight">{item.title}</h4>
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-athletic-muted pt-1">
                  {item.type === 'workout' ? (
                    <>
                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock className="h-3.5 w-3.5 text-cyan-400" /> {item.duration_min} mins
                      </span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Flame className="h-3.5 w-3.5" /> {Math.round(item.burned_kcal)} kcal
                      </span>
                      <span>{item.sets.length} sets completed</span>
                    </>
                  ) : (
                    <>
                      <span className="text-white font-bold">{item.distance_km} km</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Flame className="h-3.5 w-3.5" /> {Math.round(item.burned_kcal)} kcal
                      </span>
                      <span>{Math.round(item.elevation_gain_m)}m elevation</span>
                    </>
                  )}
                </div>
              </div>

              {/* Workout Sets Snapshot */}
              {item.type === 'workout' && item.sets && (
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-athletic-border space-y-1.5">
                  {item.sets.slice(0, 4).map((s: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs font-mono text-slate-300">
                      <span>{s.exercise}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{s.weight_kg}kg × {s.reps}</span>
                        {s.is_pr && (
                          <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 rounded">
                            PR
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {item.sets.length > 4 && (
                    <p className="text-[10px] text-athletic-muted font-mono pt-1">
                      + {item.sets.length - 4} more sets
                    </p>
                  )}
                </div>
              )}

              {/* Privacy badge for GPS runs */}
              {item.type === 'run' && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>150m start/finish privacy zone applied (RA 10173)</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
