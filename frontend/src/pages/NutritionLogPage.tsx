import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { NutritionLog } from '../types';
import { UtensilsCrossed, Plus, Trash2, Flame, Sparkles, Clock } from 'lucide-react';

export const NutritionLogPage: React.FC = () => {
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
      alert(err.message || 'Failed to create meal log.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this meal log?')) return;
    try {
      await api.deleteNutritionLog(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete log.');
    }
  };

  const totalCalories = logs.reduce((sum, l) => sum + l.total_kcal, 0);
  const totalProtein = logs.reduce((sum, l) => sum + l.protein_g, 0);
  const totalCarbs = logs.reduce((sum, l) => sum + l.carbs_g, 0);
  const totalFat = logs.reduce((sum, l) => sum + l.fat_g, 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <UtensilsCrossed className="h-6 w-6 text-emerald-400" />
            <span>Daily Nutrition & Food Intake Log</span>
          </h1>
          <p className="text-sm text-athletic-muted">
            Confirmed nutritional records grounded in verified USDA & FNRI compositions
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 shadow-glow-emerald flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Manual Entry</span>
        </button>
      </div>

      {/* Quick Summary Pill Bar */}
      <div className="p-6 rounded-3xl bg-athletic-card border border-athletic-border grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <span className="text-[11px] text-athletic-muted uppercase tracking-wider font-semibold">Total Intake</span>
          <p className="text-2xl font-bold font-mono text-white mt-1">{Math.round(totalCalories)} kcal</p>
        </div>
        <div>
          <span className="text-[11px] text-emerald-400 uppercase tracking-wider font-semibold">Protein</span>
          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{Math.round(totalProtein)}g</p>
        </div>
        <div>
          <span className="text-[11px] text-cyan-400 uppercase tracking-wider font-semibold">Carbs</span>
          <p className="text-2xl font-bold font-mono text-cyan-400 mt-1">{Math.round(totalCarbs)}g</p>
        </div>
        <div>
          <span className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold">Fats</span>
          <p className="text-2xl font-bold font-mono text-amber-400 mt-1">{Math.round(totalFat)}g</p>
        </div>
      </div>

      {/* Manual Entry Form */}
      {showAddForm && (
        <form onSubmit={handleCreateManualMeal} className="p-6 rounded-3xl bg-athletic-card border border-athletic-border space-y-4 animate-fade-in">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Log Meal Manually</h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] text-athletic-muted">Meal Name</label>
              <input
                type="text"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="e.g. 2 Boiled Eggs & Whole Wheat Toast"
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-athletic-border text-slate-100 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-athletic-muted">Calories (kcal)</label>
              <input
                type="number"
                step="0.5"
                value={kcal}
                onChange={(e) => setKcal(e.target.value)}
                placeholder="350"
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-athletic-border text-slate-100 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-emerald-400">Protein (g)</label>
              <input
                type="number"
                step="0.5"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="25"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-athletic-border text-slate-100 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-cyan-400">Carbs (g)</label>
              <input
                type="number"
                step="0.5"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="30"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-athletic-border text-slate-100 text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl font-semibold text-xs bg-emerald-500 text-black hover:bg-emerald-400 shadow-glow-emerald"
            >
              {submitting ? 'Saving...' : 'Save Meal'}
            </button>
          </div>
        </form>
      )}

      {/* Logs Table / List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-athletic-card border border-athletic-border text-athletic-muted text-xs">
            No meals logged today yet. Try scanning a meal using the RAG Scanner or add a manual entry!
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-5 rounded-2xl bg-athletic-card border border-athletic-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-100 text-sm">{log.meal_name}</h3>
                    {log.rag_scan_id && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> RAG Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-athletic-muted font-mono flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-4 text-xs font-mono text-athletic-muted">
                    <div>
                      <span className="block text-[10px]">Calories</span>
                      <span className="font-bold text-white text-sm">{log.total_kcal} kcal</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-emerald-400">P</span>
                      <span className="font-bold text-emerald-400 text-sm">{log.protein_g}g</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-cyan-400">C</span>
                      <span className="font-bold text-cyan-400 text-sm">{log.carbs_g}g</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-amber-400">F</span>
                      <span className="font-bold text-amber-400 text-sm">{log.fat_g}g</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(log.id)}
                    className="p-2 text-athletic-muted hover:text-rose-400 hover:bg-slate-900 rounded-xl transition-colors"
                    title="Delete log"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
