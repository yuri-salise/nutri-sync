import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
          <div className="h-12 w-12 rounded-full border-2 border-line border-t-accent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="h-4 w-4 text-accent" />
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
      {/* Top Calorie & Activity Status Cards */}
      <div
        className="animate-rise grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <div className="p-4 rounded-2xl bg-card border border-line shadow-neu relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-medium uppercase tracking-wider">Daily Calorie Goal</span>
            <Flame className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tabular-nums text-ink tracking-tight">
              {Math.round(dynamicKcal).toLocaleString()}
            </span>
            <span className="text-xs tabular-nums text-muted">kcal</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-success">
            <TrendingUp className="h-3 w-3" />
            <span>+{Math.round(burnedKcal)} kcal from workouts</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-line shadow-neu relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-medium uppercase tracking-wider">Calories Eaten</span>
            <UtensilsCrossed className="h-4 w-4 text-info" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tabular-nums text-ink tracking-tight">
              {Math.round(consumedKcal).toLocaleString()}
            </span>
            <span className="text-xs tabular-nums text-muted">kcal</span>
          </div>
          <div className="mt-1 text-[11px] font-medium text-muted">
            <span>{kcalPct}% of daily goal</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-line shadow-neu relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-medium uppercase tracking-wider">Remaining</span>
            <Zap className="h-4 w-4 text-warning" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-2xl font-black tabular-nums tracking-tight ${remainingKcal >= 0 ? 'text-success' : 'text-danger'}`}>
              {Math.round(remainingKcal).toLocaleString()}
            </span>
            <span className="text-xs tabular-nums text-muted">kcal</span>
          </div>
          <div className="mt-1 text-[11px] font-medium text-muted">
            <span>{remainingKcal >= 0 ? 'Calories left to eat' : 'Over daily target'}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-line shadow-neu relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-medium uppercase tracking-wider">Workouts Logged</span>
            <Activity className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tabular-nums text-ink tracking-tight">
              {workouts.length}
            </span>
            <span className="text-xs tabular-nums text-muted">today</span>
          </div>
          <div className="mt-1 text-[11px] font-medium text-accent flex items-center gap-1">
            <Award className="h-3 w-3" />
            <span>PRs Monitored</span>
          </div>
        </div>
      </div>

      {/* Main Hero: Daily Overview */}
      <div
        style={{ animationDelay: '0.1s' }}
        className="animate-rise p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-card via-well to-page border border-line shadow-2xl relative overflow-hidden"
      >
        {/* Accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-70" />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/30 shadow-neu-sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Smart Calorie & Activity Sync</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-ink ">
              Welcome Back, <span className="text-accent">{user?.full_name || 'Athlete'}</span>
            </h1>

            <p className="text-sm text-muted leading-relaxed">
              Your calorie and nutrient goals automatically increase whenever you log gym workouts or outdoor runs, helping you recover stronger and hit your goals.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/scanner"
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-accent text-on-accent hover:bg-accent-hover shadow-neu-sm transition-all transform hover:-translate-y-0.5"
              >
                <Compass className="h-4 w-4" />
                <span>Scan Meal with AI</span>
              </Link>
              <Link
                to="/workouts"
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold bg-card-hover hover:bg-line-strong text-ink border border-line-strong transition-all"
              >
                <Dumbbell className="h-4 w-4 text-accent" />
                <span>Log Workout</span>
              </Link>
              <Link
                to="/record"
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold bg-card-hover hover:bg-line-strong text-ink border border-line-strong transition-all"
              >
                <MapPin className="h-4 w-4 text-info" />
                <span>Record Activity</span>
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
                className="text-line"
                strokeWidth="12"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="96"
                cy="96"
                r={radius}
                stroke="#1D4ED8"
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                style={{
                  transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)',
                  filter: 'drop-shadow(0 0 10px rgba(29,78,216,0.5))',
                }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black tabular-nums text-ink tracking-tight">
                {kcalPct}%
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
                of Daily Goal
              </span>
              <span className="text-xs tabular-nums font-bold text-accent">
                {Math.round(consumedKcal)} / {Math.round(dynamicKcal)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Macro Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Protein */}
        <div
          style={{ animationDelay: '0.15s' }}
          className="animate-rise p-5 rounded-2xl bg-card border border-line shadow-neu space-y-3"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink flex items-center gap-1.5 ">
              <span className="h-2 w-2 rounded-full bg-info shadow-neu-sm" /> Protein
            </span>
            <span className="tabular-nums text-info font-bold">{proteinPct}%</span>
          </div>
          <div className="flex items-baseline justify-between text-xs tabular-nums">
            <span className="text-xl font-black text-ink">{proteinConsumed.toFixed(1)}g</span>
            <span className="text-muted">Target: {proteinTarget.toFixed(0)}g</span>
          </div>
          <div className="w-full bg-line rounded-full h-2 overflow-hidden">
            <div
              className="bg-info h-2 rounded-full transition-all duration-700 shadow-neu-sm"
              style={{ width: `${proteinPct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted">
            Supports muscle repair, strength, and recovery
          </p>
        </div>

        {/* Carbohydrates */}
        <div
          style={{ animationDelay: '0.2s' }}
          className="animate-rise p-5 rounded-2xl bg-card border border-line shadow-neu space-y-3"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink flex items-center gap-1.5 ">
              <span className="h-2 w-2 rounded-full bg-accent shadow-neu-sm" /> Carbohydrates
            </span>
            <span className="tabular-nums text-accent font-bold">{carbsPct}%</span>
          </div>
          <div className="flex items-baseline justify-between text-xs tabular-nums">
            <span className="text-xl font-black text-ink">{carbsConsumed.toFixed(1)}g</span>
            <span className="text-muted">Target: {carbsTarget.toFixed(0)}g</span>
          </div>
          <div className="w-full bg-line rounded-full h-2 overflow-hidden">
            <div
              className="bg-accent h-2 rounded-full transition-all duration-700 shadow-neu-sm"
              style={{ width: `${carbsPct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted">
            Primary energy fuel: auto-scales with your workouts
          </p>
        </div>

        {/* Lipids / Fat */}
        <div
          style={{ animationDelay: '0.25s' }}
          className="animate-rise p-5 rounded-2xl bg-card border border-line shadow-neu space-y-3"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink flex items-center gap-1.5 ">
              <span className="h-2 w-2 rounded-full bg-warning shadow-neu-sm" /> Healthy Fats
            </span>
            <span className="tabular-nums text-warning font-bold">{fatPct}%</span>
          </div>
          <div className="flex items-baseline justify-between text-xs tabular-nums">
            <span className="text-xl font-black text-ink">{fatConsumed.toFixed(1)}g</span>
            <span className="text-muted">Target: {fatTarget.toFixed(0)}g</span>
          </div>
          <div className="w-full bg-line rounded-full h-2 overflow-hidden">
            <div
              className="bg-warning h-2 rounded-full transition-all duration-700 shadow-neu-sm"
              style={{ width: `${fatPct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted">
            Essential for hormonal balance and overall vitality
          </p>
        </div>
      </div>

      {/* Energy Expended Breakdown & Recent Meals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Expenditure */}
        <div
          style={{ animationDelay: '0.3s' }}
          className="animate-rise p-6 rounded-3xl bg-card border border-line shadow-neu space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Flame className="h-4 w-4 text-accent" />
              <span>Calories Burned Today</span>
            </h3>
            <span className="text-xs tabular-nums text-accent font-bold">
              +{Math.round(burnedKcal)} kcal Total
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-well border border-line flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10 text-accent">
                  <Dumbbell className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink">Strength Training</p>
                  <p className="text-[11px] text-muted">
                    {workouts.length} session(s) logged
                  </p>
                </div>
              </div>
              <span className="tabular-nums text-xs font-bold text-accent">
                +{Math.round(summary?.activity_burn.workout_burned_kcal || 0)} kcal
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-well border border-line flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10 text-info">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink">Outdoor Running</p>
                  <p className="text-[11px] text-muted">
                    {(summary?.activity_burn.run_distance_km || 0).toFixed(1)} km recorded
                  </p>
                </div>
              </div>
              <span className="tabular-nums text-xs font-bold text-info">
                +{Math.round(summary?.activity_burn.run_burned_kcal || 0)} kcal
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-well border border-line flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10 text-warning">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink">Base Energy Needs (BMR)</p>
                  <p className="text-[11px] text-muted">Calories your body burns at rest</p>
                </div>
              </div>
              <span className="tabular-nums text-xs font-bold text-ink">
                {Math.round(baseKcal)} kcal
              </span>
            </div>
          </div>
        </div>

        {/* Recent Meals */}
        <div
          style={{ animationDelay: '0.35s' }}
          className="animate-rise p-6 rounded-3xl bg-card border border-line shadow-neu space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-info" />
              <span>Recent Meals</span>
            </h3>
            <Link to="/nutrition" className="text-xs tabular-nums text-info hover:underline flex items-center gap-1">
              <span>View All</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {meals && meals.length > 0 ? (
              meals.slice(0, 3).map((meal) => (
                <div
                  key={meal.id}
                  className="p-3.5 rounded-xl bg-well border border-line flex items-center justify-between hover:border-line-strong transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-ink">{meal.meal_name}</p>
                    <p className="text-[10px] tabular-nums text-muted">
                      P: {meal.protein_g}g &bull; C: {meal.carbs_g}g &bull; F: {meal.fat_g}g
                    </p>
                  </div>
                  <span className="tabular-nums text-xs font-bold text-info">
                    {meal.total_kcal} kcal
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-muted border border-dashed border-line rounded-2xl">
                No meals logged yet today. Tap "Scan Meal with AI" to quickly add your food.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
