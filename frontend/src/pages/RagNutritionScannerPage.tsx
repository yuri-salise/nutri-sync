import React, { useState } from 'react';
import { api } from '../services/api';
import { RagScanResult } from '../types';
import {
  Compass,
  Sparkles,
  Search,
  CheckCircle,
  Database,
  Clock,
  Layers,
  Flame,
  ArrowRight,
  ShieldAlert,
  Info,
} from 'lucide-react';

export const RagNutritionScannerPage: React.FC = () => {
  const [queryInput, setQueryInput] = useState('Chicken Adobo with 1 cup garlic rice and a boiled egg');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<RagScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  const samplePrompts = [
    'Chicken Adobo with 1 cup garlic rice and a boiled egg',
    'Sinigang na Baboy with kangkong and 1 cup brown rice',
    'Tinolang Manok with sayote and malunggay leaves',
    'Grilled chicken breast with steamed broccoli and baked sweet potato',
    'Tapsilog with sunny side up egg and atchara',
  ];

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;

    setScanning(true);
    setError(null);
    setConfirmedSuccess(false);

    try {
      const result = await api.scanMealRAG(queryInput);
      setScanResult(result);
    } catch (err: any) {
      setError(err.message || 'RAG Scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!scanResult) return;
    setConfirming(true);
    try {
      await api.createNutritionLog({
        meal_name: scanResult.query_input,
        total_kcal: scanResult.predicted_macros.calories,
        protein_g: scanResult.predicted_macros.protein_g,
        carbs_g: scanResult.predicted_macros.carbs_g,
        fat_g: scanResult.predicted_macros.fat_g,
        rag_scan_id: scanResult.scan_id,
      });
      setConfirmedSuccess(true);
    } catch (err: any) {
      alert(err.message || 'Failed to save confirmed nutrition log.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Compass className="h-6 w-6 text-emerald-400" />
            <span>RAG-Grounded Food Macro Scanner</span>
          </h1>
          <p className="text-sm text-athletic-muted">
            Grounding natural language meal inputs in DOST-FNRI & USDA food vector tables
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-slate-900 border border-athletic-border text-athletic-muted">
          <Database className="h-3.5 w-3.5 text-cyan-400" />
          <span>pgvector (384-d Cosine)</span>
        </div>
      </div>

      {/* Input Formulation Card */}
      <div className="p-6 rounded-3xl bg-athletic-card border border-athletic-border space-y-4">
        <form onSubmit={handleScan} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Natural Language Meal Description
            </label>
            <div className="relative">
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Describe your meal (e.g. 200g chicken adobo, 1 cup sinangag, and 1 boiled egg)..."
                required
                className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-athletic-border text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 pr-28"
              />
              <button
                type="submit"
                disabled={scanning}
                className="absolute right-2 top-2 bottom-2 px-4 rounded-xl font-semibold text-xs bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-90 shadow-glow-emerald flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {scanning ? (
                  <span className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5" />
                    <span>Run RAG</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sample Prompts */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-athletic-muted font-medium">Quick Prompts:</span>
            {samplePrompts.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setQueryInput(p)}
                className="px-2.5 py-1 rounded-lg text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-athletic-border hover:border-slate-700 transition-colors"
              >
                {p.split(' ')[0]} {p.split(' ')[1]}...
              </button>
            ))}
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* RAG Inference Results Display */}
      {scanResult && (
        <div className="space-y-6 animate-fade-in">
          {/* Requirement T6 Notice Banner */}
          <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-start gap-3">
            <Info className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Machine-Generated RAG Estimate (Requirement T6)</span>
              <p className="text-athletic-muted text-[11px]">
                Nutritional values are calculated by retrieving verified records from the DOST-FNRI and USDA FoodData Central databases using semantic vector similarity. Human confirmation is required before adding to your daily intake.
              </p>
            </div>
          </div>

          {/* Telemetry Metrics & Calculated Macros Header */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-athletic-card border border-athletic-border space-y-1">
              <span className="text-[11px] text-athletic-muted uppercase tracking-wider font-semibold">Total Energy</span>
              <p className="text-3xl font-extrabold font-mono text-white tracking-tight">
                {scanResult.predicted_macros.calories} <span className="text-xs text-athletic-muted">kcal</span>
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-athletic-card border border-athletic-border space-y-1">
              <span className="text-[11px] text-emerald-400 uppercase tracking-wider font-semibold">Protein</span>
              <p className="text-3xl font-extrabold font-mono text-emerald-400 tracking-tight">
                {scanResult.predicted_macros.protein_g} <span className="text-xs text-athletic-muted">g</span>
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-athletic-card border border-athletic-border space-y-1">
              <span className="text-[11px] text-cyan-400 uppercase tracking-wider font-semibold">Carbohydrates</span>
              <p className="text-3xl font-extrabold font-mono text-cyan-400 tracking-tight">
                {scanResult.predicted_macros.carbs_g} <span className="text-xs text-athletic-muted">g</span>
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-athletic-card border border-athletic-border space-y-1">
              <span className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold">Dietary Fats</span>
              <p className="text-3xl font-extrabold font-mono text-amber-400 tracking-tight">
                {scanResult.predicted_macros.fat_g} <span className="text-xs text-athletic-muted">g</span>
              </p>
            </div>
          </div>

          {/* Traceability Telemetry Bar (Requirement T4) */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-athletic-border flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-athletic-muted">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              <span>Inference Latency: <b className="text-white">{scanResult.latency_ms} ms</b></span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              <span>Top Cosine Similarity: <b className="text-white">{(scanResult.top_similarity_score * 100).toFixed(1)}%</b></span>
            </div>
            <div className="flex items-center gap-2">
              <span>Fallback Used: <b className={scanResult.used_fallback ? 'text-amber-400' : 'text-emerald-400'}>{scanResult.used_fallback ? 'Yes (SQL Search)' : 'No (pgvector)'}</b></span>
            </div>
          </div>

          {/* Retrieved Knowledge Base Items Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-athletic-muted flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-emerald-400" /> Retrieved Nutritional Knowledge Base Records (Top Matching Chunks)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scanResult.retrieved_items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-athletic-card border border-athletic-border space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-slate-100 text-sm">{item.food_name}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        item.source_dataset === 'FNRI'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      }`}
                    >
                      {item.source_dataset}
                    </span>
                  </div>

                  <p className="text-[11px] text-athletic-muted">{item.serving_description}</p>

                  <div className="grid grid-cols-4 gap-2 text-[11px] font-mono text-athletic-muted pt-2 border-t border-athletic-border/60">
                    <div>
                      <span className="block text-[10px]">Calories</span>
                      <span className="font-semibold text-white">{item.kcal_per_100g} kcal</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-emerald-400">Protein</span>
                      <span className="font-semibold text-emerald-400">{item.protein_per_100g}g</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-cyan-400">Carbs</span>
                      <span className="font-semibold text-cyan-400">{item.carbs_per_100g}g</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-amber-400">Fat</span>
                      <span className="font-semibold text-amber-400">{item.fat_per_100g}g</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Confirmation Call to Action (Requirement T6) */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-transparent border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-glow-emerald">
            <div>
              <h4 className="font-bold text-white text-base">Confirm & Save Meal to Daily Log</h4>
              <p className="text-xs text-athletic-muted">
                Saving updates your activity-synced metabolic balance and carbohydrate recovery budgets.
              </p>
            </div>

            {confirmedSuccess ? (
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-semibold">
                <CheckCircle className="h-4 w-4" />
                <span>Saved & Synced!</span>
              </div>
            ) : (
              <button
                onClick={handleConfirmAndSave}
                disabled={confirming}
                className="px-6 py-3 rounded-xl font-bold text-xs bg-emerald-500 text-black hover:bg-emerald-400 shadow-glow-emerald transition-all flex items-center justify-center gap-2"
              >
                {confirming ? (
                  <span className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Confirm & Add to Nutrition Log</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
