import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import { NutritionLog } from '../types';
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <UtensilsCrossed className="h-6 w-6 text-[#C8FF00]" />
            <span>Daily Nutrition Intake Ledger</span>
          </h1>
          <p className="text-sm text-[#848E9C]">
            Verified intake logs grounded in USDA & FNRI nutritional databases
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#C8FF00] text-black hover:bg-[#d4ff33] shadow-glow-lime flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Manual Entry</span>
        </button>
      </div>

      {/* Aggregate Order-Book Tickers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#12151b] border border-[#1e232d] shadow-okx-card">
          <span className="text-[10px] font-mono text-[#848E9C] uppercase">Total Calories</span>
          <p className="text-2xl font-black font-mono text-[#C8FF00] mt-1">
            {Math.round(totalCalories).toLocaleString()}
            <span className="text-xs text-[#848E9C] ml-1">kcal</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#12151b] border border-[#1e232d] shadow-okx-card">
          <span className="text-[10px] font-mono text-[#848E9C] uppercase">Protein</span>
          <p className="text-2xl font-black font-mono text-[#00E5FF] mt-1">
            {totalProtein.toFixed(1)}
            <span className="text-xs text-[#848E9C] ml-1">g</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#12151b] border border-[#1e232d] shadow-okx-card">
          <span className="text-[10px] font-mono text-[#848E9C] uppercase">Carbohydrates</span>
          <p className="text-2xl font-black font-mono text-white mt-1">
            {totalCarbs.toFixed(1)}
            <span className="text-xs text-[#848E9C] ml-1">g</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#12151b] border border-[#1e232d] shadow-okx-card">
          <span className="text-[10px] font-mono text-[#848E9C] uppercase">Lipids / Fat</span>
          <p className="text-2xl font-black font-mono text-[#FFB800] mt-1">
            {totalFat.toFixed(1)}
            <span className="text-xs text-[#848E9C] ml-1">g</span>
          </p>
        </div>
      </div>

      {/* Meal Ledger List */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#848E9C] flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#C8FF00]" />
          <span>Logged Meals ({logs.length})</span>
        </h3>

        {loading ? (
          <div className="p-12 text-center">
            <div className="h-8 w-8 border-2 border-[#C8FF00] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-[#12151b] border border-[#1e232d] text-xs text-[#848E9C]">
            No meals logged today. Use "RAG AI Food Scan" or "Manual Entry" above to add meals.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-5 rounded-3xl bg-[#12151b] border border-[#1e232d] shadow-okx-card hover:border-[#2a313f] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{log.meal_name}</span>
                  {log.rag_scan_id && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#C8FF00]/15 text-[#C8FF00] border border-[#C8FF00]/30">
                      RAG VERIFIED
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-mono text-[#848E9C]">
                  {new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull;{' '}
                  {new Date(log.logged_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-[#07080a] border border-[#1e232d] text-[#00E5FF]">
                    P: {log.protein_g}g
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#07080a] border border-[#1e232d] text-white">
                    C: {log.carbs_g}g
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#07080a] border border-[#1e232d] text-[#FFB800]">
                    F: {log.fat_g}g
                  </span>
                </div>

                <span className="text-base font-black font-mono text-[#C8FF00] min-w-[70px] text-right">
                  {Math.round(log.total_kcal)} kcal
                </span>

                <button
                  onClick={() => handleDelete(log.id)}
                  className="p-2 text-[#848E9C] hover:text-[#F6465D] hover:bg-[#F6465D]/10 rounded-xl transition-colors"
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
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-3xl bg-[#12151b] border border-[#1e232d] shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#1e232d]">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus className="h-4 w-4 text-[#C8FF00]" />
                  <span>Manual Meal Entry</span>
                </h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-1 text-[#848E9C] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateManualMeal} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#848E9C]">Meal / Food Title</label>
                  <input
                    type="text"
                    required
                    value={mealName}
                    onChange={(e) => setMealName(e.target.value)}
                    placeholder="e.g. Scrambled Eggs with Avocado"
                    className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#848E9C]">Calories (kcal)</label>
                    <input
                      type="number"
                      required
                      value={kcal}
                      onChange={(e) => setKcal(e.target.value)}
                      placeholder="450"
                      className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#848E9C]">Protein (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={protein}
                      onChange={(e) => setProtein(e.target.value)}
                      placeholder="35"
                      className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#848E9C]">Carbs (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={carbs}
                      onChange={(e) => setCarbs(e.target.value)}
                      placeholder="50"
                      className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#848E9C]">Fat (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={fat}
                      onChange={(e) => setFat(e.target.value)}
                      placeholder="15"
                      className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl bg-[#C8FF00] text-black font-bold text-xs hover:bg-[#d4ff33] shadow-glow-lime transition-all"
                  >
                    {submitting ? 'Recording...' : 'Commit Meal to Ledger'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
