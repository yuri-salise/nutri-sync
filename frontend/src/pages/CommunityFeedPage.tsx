import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="h-6 w-6 text-[#C8FF00]" />
            <span>Club Activity Feed</span>
          </h1>
          <p className="text-sm text-[#848E9C]">
            See workouts, runs, and new personal records shared by teammates.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 bg-[#12151b] p-1 rounded-xl border border-[#1e232d] self-start sm:self-auto text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterType === 'all'
                ? 'bg-[#C8FF00] text-black shadow-glow-lime'
                : 'text-[#848E9C] hover:text-white'
            }`}
          >
            All Activities
          </button>
          <button
            onClick={() => setFilterType('workouts')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterType === 'workouts'
                ? 'bg-[#C8FF00] text-black shadow-glow-lime'
                : 'text-[#848E9C] hover:text-white'
            }`}
          >
            Workouts
          </button>
          <button
            onClick={() => setFilterType('runs')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterType === 'runs'
                ? 'bg-[#00E5FF] text-black shadow-glow-cyan'
                : 'text-[#848E9C] hover:text-white'
            }`}
          >
            Runs
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 border-2 border-[#C8FF00] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : feedItems.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#12151b] border border-[#1e232d] text-xs text-[#848E9C]">
          No public training posts in the club feed yet.
        </div>
      ) : (
        <div className="space-y-4">
          {feedItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-3xl bg-[#12151b] border border-[#1e232d] shadow-cyber-card hover:border-[#2a313f] transition-all space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-2xl flex items-center justify-center ${
                      item.type === 'workout'
                        ? 'bg-[#C8FF00]/15 text-[#C8FF00] border border-[#C8FF00]/30'
                        : 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30'
                    }`}
                  >
                    {item.type === 'workout' ? <Dumbbell className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{item.user?.full_name || 'Athlete'}</span>
                      {item.has_pr && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#C8FF00]/15 text-[#C8FF00] border border-[#C8FF00]/30 shadow-glow-lime flex items-center gap-1">
                          <Award className="h-3 w-3" /> NEW PR
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-[#848E9C]">
                      {new Date(item.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#C8FF00]">
                  <Flame className="h-4 w-4" />
                  <span>+{Math.round(item.burned_kcal)} kcal</span>
                </div>
              </div>

              {/* Title & metrics */}
              <div className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d] space-y-2">
                <p className="text-sm font-semibold text-white">{item.title}</p>

                {item.type === 'workout' && item.sets && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.sets.slice(0, 4).map((s: any, idx: number) => (
                      <span
                        key={idx}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono ${
                          s.is_pr
                            ? 'bg-[#C8FF00]/15 text-[#C8FF00] border border-[#C8FF00]/30 font-bold'
                            : 'bg-[#12151b] text-[#848E9C] border border-[#1e232d]'
                        }`}
                      >
                        {s.exercise_name}: {s.weight_kg}kg &times; {s.reps}
                      </span>
                    ))}
                    {item.sets.length > 4 && (
                      <span className="text-[11px] font-mono text-[#848E9C] self-center">
                        +{item.sets.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                {item.type === 'run' && (
                  <div className="flex items-center gap-4 text-xs font-mono text-[#848E9C]">
                    <span>Distance: <b className="text-white">{item.distance_km} km</b></span>
                    <span>Duration: <b className="text-white">{Math.round(item.duration_sec / 60)} min</b></span>
                    <span>Surface: <b className="text-[#00E5FF] uppercase">{item.surface_type}</b></span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
