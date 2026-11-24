import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { NutritionLog } from '../types';
import { useDialogs } from '../components/common/DialogProvider';
import {
  UtensilsCrossed,
  Plus,
  Trash2,
  Flame,
  Sparkles,
  Clock,
  Layers,
  X,
  CheckCircle2,
} from 'lucide-react';

export const NutritionLogPage: React.FC = () => {
  const { confirm, alert } = useDialogs();
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Manual Form State
  const [mealName, setMealName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getNutritionLogs(1, 50);
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load nutrition logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManualMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealName.trim()) return;

    setSubmitting(true);
    try {
      await api.createNutritionLog({
        meal_name: mealName,
        total_kcal: parseFloat(kcal) || 0,
        protein_g: parseFloat(protein) || 0,
        carbs_g: parseFloat(carbs) || 0,
        fat_g: parseFloat(fat) || 0,
      });
      setMealName('');
      setKcal('');
      setProtein('');
      setCarbs('');
      setFat('');
      setShowAddForm(false);
      loadLogs();
    } catch (err: any) {
      await alert({ title: 'Couldn’t save this meal', message: err.message || 'Failed to create meal log.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'Delete this meal?',
      message: 'It will be removed from your food log and today’s totals.',
      confirmLabel: 'Delete meal',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteNutritionLog(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      await alert({ title: 'Couldn’t delete this meal', message: err.message || 'Failed to delete log.' });
    }
  };

  const totalCalories = logs.reduce((sum, l) => sum + l.total_kcal, 0);
  const totalProtein = logs.reduce((sum, l) => sum + l.protein_g, 0);
  const totalCarbs = logs.reduce((sum, l) => sum + l.carbs_g, 0);
  const totalFat = logs.reduce((sum, l) => sum + l.fat_g, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2.5">
            <UtensilsCrossed className="h-6 w-6 text-accent" />
            <span>Daily Food Log</span>
          </h1>
          <p className="text-sm text-muted">
            Track your daily meals, calories, and macros with verified nutrition data.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-accent text-on-accent hover:bg-accent-hover shadow-neu-sm flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Manual Entry</span>
        </button>
      </div>

      {/* Aggregate Order-Book Tickers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-line shadow-neu">
          <span className="text-[10px] tabular-nums text-muted uppercase">Total Calories</span>
          <p className="text-2xl font-black tabular-nums text-accent mt-1">
            {Math.round(totalCalories).toLocaleString()}
            <span className="text-xs text-muted ml-1">kcal</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-line shadow-neu">
          <span className="text-[10px] tabular-nums text-muted uppercase">Protein</span>
          <p className="text-2xl font-black tabular-nums text-info mt-1">
            {totalProtein.toFixed(1)}
            <span className="text-xs text-muted ml-1">g</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-line shadow-neu">
          <span className="text-[10px] tabular-nums text-muted uppercase">Carbohydrates</span>
          <p className="text-2xl font-black tabular-nums text-ink mt-1">
            {totalCarbs.toFixed(1)}
            <span className="text-xs text-muted ml-1">g</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-line shadow-neu">
          <span className="text-[10px] tabular-nums text-muted uppercase">Fat</span>
          <p className="text-2xl font-black tabular-nums text-warning mt-1">
            {totalFat.toFixed(1)}
            <span className="text-xs text-muted ml-1">g</span>
          </p>
        </div>
      </div>

      {/* Meal Ledger List */}
      <div className="space-y-3">
        <h3 className="text-xs tabular-nums font-bold uppercase tracking-wider text-muted flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent" />
          <span>Logged Meals ({logs.length})</span>
        </h3>

        {loading ? (
          <div className="p-12 text-center">
            <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-card border border-line text-xs text-muted">
            No meals logged today yet. Use "Scan Meal with AI" or "Manual Entry" above to add your food.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-5 rounded-3xl bg-card border border-line shadow-neu hover:border-line-strong transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink">{log.meal_name}</span>
                  {log.rag_scan_id && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] tabular-nums font-bold bg-accent/15 text-accent border border-accent/30">
                      AI VERIFIED
                    </span>
                  )}
                </div>
                <p className="text-[11px] tabular-nums text-muted">
                  {new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull;{' '}
                  {new Date(log.logged_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 tabular-nums text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-well border border-line text-info">
                    P: {log.protein_g}g
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-well border border-line text-ink">
                    C: {log.carbs_g}g
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-well border border-line text-warning">
                    F: {log.fat_g}g
                  </span>
                </div>

                <span className="text-base font-black tabular-nums text-accent min-w-[70px] text-right">
                  {Math.round(log.total_kcal)} kcal
                </span>

                <button
                  onClick={() => handleDelete(log.id)}
                  className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-xl transition-colors"
                  title="Delete Entry"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual Entry Modal */}
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md">
            <div
              className="animate-rise w-full max-w-md p-6 rounded-3xl bg-card border border-line shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Plus className="h-4 w-4 text-accent" />
                  <span>Manual Meal Entry</span>
                </h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-1 text-muted hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateManualMeal} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="meal-title" className="text-xs font-semibold text-muted">Meal / Food Title</label>
                  <input id="meal-title"
                    type="text"
                    required
                    value={mealName}
                    onChange={(e) => setMealName(e.target.value)}
                    placeholder="e.g. Scrambled Eggs with Avocado"
                    className="w-full bg-well border border-line focus:border-accent rounded-xl px-3.5 py-2 text-xs text-ink focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="meal-kcal" className="text-xs font-semibold text-muted">Calories (kcal)</label>
                    <input id="meal-kcal"
                      type="number"
                      required
                      value={kcal}
                      onChange={(e) => setKcal(e.target.value)}
                      placeholder="450"
                      className="w-full bg-well border border-line focus:border-accent rounded-xl px-3.5 py-2 text-xs text-ink tabular-nums focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="meal-protein" className="text-xs font-semibold text-muted">Protein (g)</label>
                    <input id="meal-protein"
                      type="number"
                      step="0.1"
                      value={protein}
                      onChange={(e) => setProtein(e.target.value)}
                      placeholder="35"
                      className="w-full bg-well border border-line focus:border-accent rounded-xl px-3.5 py-2 text-xs text-ink tabular-nums focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="meal-carbs" className="text-xs font-semibold text-muted">Carbs (g)</label>
                    <input id="meal-carbs"
                      type="number"
                      step="0.1"
                      value={carbs}
                      onChange={(e) => setCarbs(e.target.value)}
                      placeholder="50"
                      className="w-full bg-well border border-line focus:border-accent rounded-xl px-3.5 py-2 text-xs text-ink tabular-nums focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="meal-fat" className="text-xs font-semibold text-muted">Fat (g)</label>
                    <input id="meal-fat"
                      type="number"
                      step="0.1"
                      value={fat}
                      onChange={(e) => setFat(e.target.value)}
                      placeholder="15"
                      className="w-full bg-well border border-line focus:border-accent rounded-xl px-3.5 py-2 text-xs text-ink tabular-nums focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl bg-accent text-on-accent font-bold text-xs hover:bg-accent-hover shadow-neu-sm transition-all"
                  >
                    {submitting ? 'Recording...' : 'Commit Meal to Ledger'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
};
