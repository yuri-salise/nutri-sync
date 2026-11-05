import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ActivitySyncedSummary } from '../types';
import {
  Flame,
  Dumbbell,
  MapPin,
  UtensilsCrossed,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  ShieldAlert,
  Compass,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ActivitySyncedSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const data = await api.getActivitySyncedSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load activity sync summary:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const baseKcal = summary?.base_goals.calories || 2200;
  const burnedKcal = summary?.activity_burn.total_burned_kcal || 0;
  const dynamicKcal = summary?.dynamic_targets.calories || baseKcal + burnedKcal;
  const consumedKcal = summary?.consumed.calories || 0;
  const remainingKcal = dynamicKcal - consumedKcal;

  const kcalPct = Math.min(Math.round((consumedKcal / dynamicKcal) * 100), 100);

  const proteinPct = Math.min(
    Math.round(((summary?.consumed.protein_g || 0) / (summary?.dynamic_targets.protein_g || 1)) * 100),
    100
  );
  const carbsPct = Math.min(
    Math.round(((summary?.consumed.carbs_g || 0) / (summary?.dynamic_targets.carbs_g || 1)) * 100),
    100
  );
  const fatPct = Math.min(
    Math.round(((summary?.consumed.fat_g || 0) / (summary?.dynamic_targets.fat_g || 1)) * 100),
    100
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner: Athlete Identity & Dynamic Target Sync */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-[#101726] to-[#0c1c28] border border-athletic-border shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Activity-Synced Dynamic Metabolism</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Hello, {user?.full_name || 'Athlete'}
            </h1>
            <p className="text-sm text-athletic-muted max-w-xl">
              Your daily caloric and glycogen targets dynamically scale in real-time as you log gym sets and GPS runs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/scanner"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-90 shadow-glow-emerald transition-all"
            >
              <Compass className="h-4 w-4" />
              <span>RAG Food Scan</span>
            </Link>
            <Link
              to="/workouts"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              <Dumbbell className="h-4 w-4 text-emerald-400" />
              <span>Log Split</span>
            </Link>
            <Link
              to="/runs"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              <MapPin className="h-4 w-4 text-cyan-400" />
              <span>GPS Run</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Primary Metabolic Dials & Numbers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Dynamic Energy Balance Card */}
        <div className="p-6 rounded-3xl bg-athletic-card border border-athletic-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-athletic-muted uppercase tracking-wider">Dynamic Daily Energy</span>
            <Flame className="h-5 w-5 text-amber-400" />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-white font-mono tracking-tight">{Math.round(dynamicKcal)}</span>
            <span className="text-xs text-athletic-muted">kcal Target</span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-athletic-muted">
              <span>Consumed: <b className="text-white font-mono">{Math.round(consumedKcal)}</b></span>
              <span>Remaining: <b className="text-emerald-400 font-mono">{Math.round(remainingKcal)}</b></span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-emerald-400 to-cyan-400 h-2.5 rounded-full transition-all duration-500 shadow-glow-emerald"
                style={{ width: `${kcalPct}%` }}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-athletic-border/60 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-athletic-border">
              <span className="text-athletic-muted block text-[11px]">Base Target</span>
              <span className="font-mono font-semibold text-slate-200">{Math.round(baseKcal)} kcal</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-athletic-border">
              <span className="text-emerald-400 block text-[11px]">+ Activity Burn</span>
              <span className="font-mono font-semibold text-emerald-400">+{Math.round(burnedKcal)} kcal</span>
            </div>
          </div>
        </div>

        {/* Strength Workout Expenditure */}
        <div className="p-6 rounded-3xl bg-athletic-card border border-athletic-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-athletic-muted uppercase tracking-wider">Strength Training Burn</span>
            <Dumbbell className="h-5 w-5 text-emerald-400" />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-white font-mono tracking-tight">
              {summary?.activity_burn.workout_burned_kcal || 0}
            </span>
            <span className="text-xs text-athletic-muted">kcal Burned</span>
          </div>

          <div className="flex items-center justify-between text-xs text-athletic-muted py-2 border-y border-athletic-border/60">
            <span>Session Duration:</span>
            <span className="font-mono text-slate-200">{summary?.activity_burn.workout_minutes || 0} mins</span>
          </div>

          <p className="text-xs text-athletic-muted">
            Lifting heavy triggers muscle protein synthesis. Your daily protein allocation has adjusted by{' '}
            <b className="text-emerald-400">+20g</b>.
          </p>
        </div>

        {/* GPS Run Aerobic Burn */}
        <div className="p-6 rounded-3xl bg-athletic-card border border-athletic-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-athletic-muted uppercase tracking-wider">GPS Trail & Road Runs</span>
            <MapPin className="h-5 w-5 text-cyan-400" />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-white font-mono tracking-tight">
              {summary?.activity_burn.run_burned_kcal || 0}
            </span>
            <span className="text-xs text-athletic-muted">kcal Burned</span>
          </div>

          <div className="flex items-center justify-between text-xs text-athletic-muted py-2 border-y border-athletic-border/60">
            <span>Distance Logged:</span>
            <span className="font-mono text-slate-200">{summary?.activity_burn.run_distance_km || 0} km</span>
          </div>

          <p className="text-xs text-athletic-muted">
            Endurance sessions deplete glycogen stores. Additional carbohydrates are dynamically credited for post-run recovery.
          </p>
        </div>
      </div>

      {/* Macronutrient Breakdown Dials */}
      <div className="p-6 sm:p-8 rounded-3xl bg-athletic-card border border-athletic-border space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Activity-Scaled Macronutrient Budgets</h2>
            <p className="text-xs text-athletic-muted">Balanced dynamically according to your training volume</p>
          </div>
          <Link to="/nutrition" className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-medium">
            <span>View Food Log</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Protein */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-athletic-border space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-emerald-400">Protein</span>
              <span className="font-mono text-slate-300">{proteinPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-white">
                {Math.round(summary?.consumed.protein_g || 0)}g
              </span>
              <span className="text-xs text-athletic-muted font-mono">
                / {Math.round(summary?.dynamic_targets.protein_g || 150)}g
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div className="bg-emerald-400 h-2 rounded-full transition-all duration-500 shadow-glow-emerald" style={{ width: `${proteinPct}%` }} />
            </div>
            <p className="text-[11px] text-athletic-muted">Muscle repair & preservation</p>
          </div>

          {/* Carbs */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-athletic-border space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-cyan-400">Carbohydrates</span>
              <span className="font-mono text-slate-300">{carbsPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-white">
                {Math.round(summary?.consumed.carbs_g || 0)}g
              </span>
              <span className="text-xs text-athletic-muted font-mono">
                / {Math.round(summary?.dynamic_targets.carbs_g || 250)}g
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div className="bg-cyan-400 h-2 rounded-full transition-all duration-500 shadow-glow-cyan" style={{ width: `${carbsPct}%` }} />
            </div>
            <p className="text-[11px] text-athletic-muted">Glycogen replenishment & fuel</p>
          </div>

          {/* Fat */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-athletic-border space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-amber-400">Dietary Fats</span>
              <span className="font-mono text-slate-300">{fatPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-white">
                {Math.round(summary?.consumed.fat_g || 0)}g
              </span>
              <span className="text-xs text-athletic-muted font-mono">
                / {Math.round(summary?.dynamic_targets.fat_g || 65)}g
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div className="bg-amber-400 h-2 rounded-full transition-all duration-500 shadow-glow-amber" style={{ width: `${fatPct}%` }} />
            </div>
            <p className="text-[11px] text-athletic-muted">Hormonal health & absorption</p>
          </div>
        </div>
      </div>
    </div>
  );
};
