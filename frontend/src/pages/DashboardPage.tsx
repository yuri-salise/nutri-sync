import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ActivitySyncedSummary, WorkoutSession, NutritionLog } from '../types';
import {
  Flame,
  Dumbbell,
  MapPin,
  UtensilsCrossed,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Compass,
  Zap,
  Activity,
  Layers,
  Award,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ActivitySyncedSummary | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [meals, setMeals] = useState<NutritionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [summaryData, workoutData, mealData] = await Promise.all([
        api.getActivitySyncedSummary(),
        api.getWorkouts({ limit: 5, only_mine: true }).catch(() => ({ data: [], meta: { page: 1, limit: 5, total: 0, total_pages: 0 } })),
        api.getNutritionLogs(1, 5).catch(() => ({ data: [], meta: { page: 1, limit: 5, total: 0, total_pages: 0 } })),
      ]);
      setSummary(summaryData);
      setWorkouts(workoutData.data);
      setMeals(mealData.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-2 border-[#1e232d] border-t-[#C8FF00] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="h-4 w-4 text-[#C8FF00]" />
          </div>
        </div>
      </div>
    );
  }

  const baseKcal = summary?.base_goals.calories || 2200;
  const burnedKcal = summary?.activity_burn.total_burned_kcal || 0;
  const dynamicKcal = summary?.dynamic_targets.calories || (baseKcal + burnedKcal);
  const consumedKcal = summary?.consumed.calories || 0;
  const remainingKcal = dynamicKcal - consumedKcal;

  const kcalPct = Math.min(Math.round((consumedKcal / dynamicKcal) * 100), 100);

  const proteinConsumed = summary?.consumed.protein_g || 0;
  const proteinTarget = summary?.dynamic_targets.protein_g || 150;
  const proteinPct = Math.min(Math.round((proteinConsumed / proteinTarget) * 100), 100);

  const carbsConsumed = summary?.consumed.carbs_g || 0;
  const carbsTarget = summary?.dynamic_targets.carbs_g || 250;
  const carbsPct = Math.min(Math.round((carbsConsumed / carbsTarget) * 100), 100);

  const fatConsumed = summary?.consumed.fat_g || 0;
  const fatTarget = summary?.dynamic_targets.fat_g || 65;
  const fatPct = Math.min(Math.round((fatConsumed / fatTarget) * 100), 100);

  // SVG Ring Calculations
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (kcalPct / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* OKX Crypto-Ticker Ribbon */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <div className="p-4 rounded-2xl bg-[#12151b] border border-[#1e232d] shadow-okx-card relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-[#848E9C]">
            <span className="font-mono uppercase tracking-wider">Dynamic Ceiling</span>
            <Flame className="h-4 w-4 text-[#C8FF00]" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-white tracking-tight">
              {Math.round(dynamicKcal).toLocaleString()}
            </span>
            <span className="text-xs font-mono text-[#848E9C]">kcal</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-mono text-[#00D26A]">
            <TrendingUp className="h-3 w-3" />
            <span>+{Math.round(burnedKcal)} kcal active</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#12151b] border border-[#1e232d] shadow-okx-card relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-[#848E9C]">
            <span className="font-mono uppercase tracking-wider">Total Consumed</span>
            <UtensilsCrossed className="h-4 w-4 text-[#00E5FF]" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-white tracking-tight">
              {Math.round(consumedKcal).toLocaleString()}
            </span>
            <span className="text-xs font-mono text-[#848E9C]">kcal</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[#848E9C]">
            <span>{kcalPct}% of daily budget</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#12151b] border border-[#1e232d] shadow-okx-card relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-[#848E9C]">
            <span className="font-mono uppercase tracking-wider">Budget Balance</span>
            <Zap className="h-4 w-4 text-[#FFB800]" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-2xl font-black font-mono tracking-tight ${remainingKcal >= 0 ? 'text-[#00D26A]' : 'text-[#F6465D]'}`}>
              {Math.round(remainingKcal).toLocaleString()}
            </span>
            <span className="text-xs font-mono text-[#848E9C]">kcal</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[#848E9C]">
            <span>{remainingKcal >= 0 ? 'Surplus room' : 'Calorie deficit'}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#12151b] border border-[#1e232d] shadow-okx-card relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-[#848E9C]">
            <span className="font-mono uppercase tracking-wider">Activity Sessions</span>
            <Activity className="h-4 w-4 text-[#C8FF00]" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-white tracking-tight">
              {workouts.length}
            </span>
            <span className="text-xs font-mono text-[#848E9C]">logged</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[#C8FF00] flex items-center gap-1">
            <Award className="h-3 w-3" />
            <span>PR Tracked</span>
          </div>
        </div>
      </motion.div>

      {/* Main Hero: Dynamic Telemetry Terminal */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#12151b] via-[#0d1015] to-[#000000] border border-[#1e232d] shadow-2xl relative overflow-hidden"
      >
        {/* Neon laser accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C8FF00] to-transparent opacity-70" />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-[#C8FF00]/10 text-[#C8FF00] border border-[#C8FF00]/30 shadow-glow-lime">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Real-Time Biometric & Activity Synchronization</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white font-poppins">
              Welcome Back, <span className="text-[#C8FF00]">{user?.full_name || 'Athlete'}</span>
            </h1>

            <p className="text-sm text-[#848E9C] leading-relaxed">
              Your metabolic ceiling dynamically adapts to mechanical energy expended from heavy gym sets and GPS road/trail runs. Macro allocations auto-scale to accelerate recovery.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/scanner"
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-[#C8FF00] text-black hover:bg-[#d4ff33] shadow-glow-lime transition-all transform hover:-translate-y-0.5"
              >
                <Compass className="h-4 w-4" />
                <span>RAG AI Food Scan</span>
              </Link>
              <Link
                to="/workouts"
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold bg-[#181c24] hover:bg-[#202530] text-white border border-[#2a313f] transition-all"
              >
                <Dumbbell className="h-4 w-4 text-[#C8FF00]" />
                <span>Log Split</span>
              </Link>
              <Link
                to="/runs"
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold bg-[#181c24] hover:bg-[#202530] text-white border border-[#2a313f] transition-all"
              >
                <MapPin className="h-4 w-4 text-[#00E5FF]" />
                <span>GPS Run</span>
              </Link>
            </div>
          </div>

          {/* SVG Animated Dynamic Ring */}
          <div className="relative flex flex-col items-center justify-center p-4">
            <svg className="w-48 h-48 transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r={radius}
                className="text-[#1e232d]"
                strokeWidth="12"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="96"
                cy="96"
                r={radius}
                stroke="#C8FF00"
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                style={{
                  transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)',
                  filter: 'drop-shadow(0 0 10px rgba(200, 255, 0, 0.5))',
                }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black font-mono text-white tracking-tight">
                {kcalPct}%
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#848E9C]">
                Daily Ceiling
              </span>
              <span className="text-xs font-mono font-bold text-[#C8FF00]">
                {Math.round(consumedKcal)} / {Math.round(dynamicKcal)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Dynamic Macro Allocation Order-Book Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Protein */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-5 rounded-2xl bg-[#12151b] border border-[#1e232d] shadow-okx-card space-y-3"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5 font-poppins">
              <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-glow-cyan" /> Protein Pace
            </span>
            <span className="font-mono text-[#00E5FF] font-bold">{proteinPct}%</span>
          </div>
          <div className="flex items-baseline justify-between text-xs font-mono">
            <span className="text-xl font-black text-white">{proteinConsumed.toFixed(1)}g</span>
            <span className="text-[#848E9C]">Target: {proteinTarget.toFixed(0)}g</span>
          </div>
          <div className="w-full bg-[#1e232d] rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#00E5FF] h-2 rounded-full transition-all duration-700 shadow-glow-cyan"
              style={{ width: `${proteinPct}%` }}
            />
          </div>
          <p className="text-[11px] text-[#848E9C]">
            Muscle protein synthesis & repair allocation
          </p>
        </motion.div>

        {/* Carbohydrates */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-5 rounded-2xl bg-[#12151b] border border-[#1e232d] shadow-okx-card space-y-3"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5 font-poppins">
              <span className="h-2 w-2 rounded-full bg-[#C8FF00] shadow-glow-lime" /> Dynamic Carbs
            </span>
            <span className="font-mono text-[#C8FF00] font-bold">{carbsPct}%</span>
          </div>
          <div className="flex items-baseline justify-between text-xs font-mono">
            <span className="text-xl font-black text-white">{carbsConsumed.toFixed(1)}g</span>
            <span className="text-[#848E9C]">Target: {carbsTarget.toFixed(0)}g</span>
          </div>
          <div className="w-full bg-[#1e232d] rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#C8FF00] h-2 rounded-full transition-all duration-700 shadow-glow-lime"
              style={{ width: `${carbsPct}%` }}
            />
          </div>
          <p className="text-[11px] text-[#848E9C]">
            Glycogen replenish: scaled by workout + GPS runs
          </p>
        </motion.div>

        {/* Lipids / Fat */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="p-5 rounded-2xl bg-[#12151b] border border-[#1e232d] shadow-okx-card space-y-3"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5 font-poppins">
              <span className="h-2 w-2 rounded-full bg-[#FFB800] shadow-glow-amber" /> Essential Lipids
            </span>
            <span className="font-mono text-[#FFB800] font-bold">{fatPct}%</span>
          </div>
          <div className="flex items-baseline justify-between text-xs font-mono">
            <span className="text-xl font-black text-white">{fatConsumed.toFixed(1)}g</span>
            <span className="text-[#848E9C]">Target: {fatTarget.toFixed(0)}g</span>
          </div>
          <div className="w-full bg-[#1e232d] rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#FFB800] h-2 rounded-full transition-all duration-700 shadow-glow-amber"
              style={{ width: `${fatPct}%` }}
            />
          </div>
          <p className="text-[11px] text-[#848E9C]">
            Hormonal baseline & cellular integrity target
          </p>
        </motion.div>
      </div>

      {/* Energy Expended Breakdown & Recent Ledgers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Expenditure Ledger */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 rounded-3xl bg-[#12151b] border border-[#1e232d] shadow-okx-card space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="h-4 w-4 text-[#C8FF00]" />
              <span>Activity Expenditure Breakdown</span>
            </h3>
            <span className="text-xs font-mono text-[#C8FF00] font-bold">
              +{Math.round(burnedKcal)} kcal Total
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-[#0d1015] border border-[#1e232d] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#C8FF00]/10 text-[#C8FF00]">
                  <Dumbbell className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Strength Resistance</p>
                  <p className="text-[11px] text-[#848E9C]">
                    {workouts.length} session(s) logged
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-[#C8FF00]">
                +{Math.round(summary?.activity_burn.workout_burned_kcal || 0)} kcal
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0d1015] border border-[#1e232d] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#00E5FF]/10 text-[#00E5FF]">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">GPS Road & Trail Runs</p>
                  <p className="text-[11px] text-[#848E9C]">
                    {(summary?.activity_burn.run_distance_km || 0).toFixed(1)} km recorded
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-[#00E5FF]">
                +{Math.round(summary?.activity_burn.run_burned_kcal || 0)} kcal
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0d1015] border border-[#1e232d] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#FFB800]/10 text-[#FFB800]">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Basal Metabolic Rate (BMR)</p>
                  <p className="text-[11px] text-[#848E9C]">Base daily maintenance allowance</p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-[#EAECEF]">
                {Math.round(baseKcal)} kcal
              </span>
            </div>
          </div>
        </motion.div>

        {/* Recent Meals Grounded in USDA/FNRI */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="p-6 rounded-3xl bg-[#12151b] border border-[#1e232d] shadow-okx-card space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-[#00E5FF]" />
              <span>Recent Grounded Meals</span>
            </h3>
            <Link to="/nutrition" className="text-xs font-mono text-[#00E5FF] hover:underline flex items-center gap-1">
              <span>View All</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {meals && meals.length > 0 ? (
              meals.slice(0, 3).map((meal) => (
                <div
                  key={meal.id}
                  className="p-3.5 rounded-xl bg-[#0d1015] border border-[#1e232d] flex items-center justify-between hover:border-[#2a313f] transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-white">{meal.meal_name}</p>
                    <p className="text-[10px] font-mono text-[#848E9C]">
                      P: {meal.protein_g}g &bull; C: {meal.carbs_g}g &bull; F: {meal.fat_g}g
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#00E5FF]">
                    {meal.total_kcal} kcal
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-[#848E9C] border border-dashed border-[#1e232d] rounded-2xl">
                No meals recorded today. Tap "RAG AI Food Scan" to estimate meals in natural language.
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
