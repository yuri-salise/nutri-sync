import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Cpu,
  Zap,
  CheckCircle2,
  UtensilsCrossed,
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

  const similarityScore = scanResult ? Math.round(scanResult.top_similarity_score * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Compass className="h-6 w-6 text-[#C8FF00]" />
            <span>RAG Semantic Nutrition Scanner</span>
          </h1>
          <p className="text-sm text-[#848E9C]">
            Grounded in DOST-FNRI and USDA composition vector indices via pgvector (384-dim)
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-[#12151b] border border-[#1e232d] text-[#848E9C]">
          <Database className="h-3.5 w-3.5 text-[#00E5FF]" />
          <span>Vector Index: <span className="text-[#C8FF00] font-bold">pgvector 384d</span></span>
        </div>
      </div>

      {/* Input Formulation Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-3xl bg-[#12151b] border border-[#1e232d] space-y-4 shadow-okx-card"
      >
        <form onSubmit={handleScan} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#848E9C] flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#C8FF00]" /> Natural Language Meal Query
            </label>
            <div className="relative">
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Describe your meal in plain English or Tagalog (e.g. 200g grilled salmon with quinoa)"
                className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-2xl pl-4 pr-32 py-3.5 text-xs sm:text-sm text-white placeholder-[#848E9C] focus:outline-none transition-all shadow-inner"
              />
              <button
                type="submit"
                disabled={scanning}
                className="absolute right-2 top-2 bottom-2 px-5 rounded-xl bg-[#C8FF00] text-black font-bold text-xs flex items-center gap-1.5 hover:bg-[#d4ff33] shadow-glow-lime transition-all disabled:opacity-50"
              >
                {scanning ? (
                  <>
                    <div className="h-3 w-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Scanning</span>
                  </>
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5" />
                    <span>Vector Scan</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Prompts */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-mono text-[#848E9C]">Quick Ingest:</span>
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setQueryInput(p)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-[#07080a] hover:bg-[#181c24] border border-[#1e232d] text-[#848E9C] hover:text-[#C8FF00] transition-colors"
              >
                {p.split(' with ')[0]}
              </button>
            ))}
          </div>
        </form>
      </motion.div>

      {/* Radar Animation While Scanning */}
      {scanning && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-12 rounded-3xl bg-[#12151b] border border-[#1e232d] flex flex-col items-center justify-center space-y-4 shadow-okx-card"
        >
          <div className="relative h-24 w-24 rounded-full border border-[#C8FF00]/30 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 rounded-full border border-[#C8FF00]/20 animate-ping" />
            <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_300deg,rgba(200,255,0,0.4)_360deg)] animate-radar" />
            <Compass className="h-8 w-8 text-[#C8FF00]" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-white font-poppins">Querying High-Dimensional Vector Embeddings...</p>
            <p className="text-xs font-mono text-[#848E9C]">
              Calculating cosine distances against USDA & DOST-FNRI food compositions
            </p>
          </div>
        </motion.div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-[#F6465D]/10 border border-[#F6465D]/30 text-[#F6465D] text-xs flex items-center gap-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {confirmedSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-[#00D26A]/10 border border-[#00D26A]/30 text-[#00D26A] text-xs flex items-center gap-2.5 shadow-glow-green"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="font-semibold">
            Success! Meal saved into daily nutrition ledger and synchronized with your metabolic targets.
          </span>
        </motion.div>
      )}

      {/* Scan Results Display */}
      {scanResult && !scanning && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Main Macro Estimation Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#12151b] to-[#07080a] border border-[#1e232d] shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1e232d]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#C8FF00] font-bold">
                  Grounded Prediction
                </span>
                <h2 className="text-xl font-black text-white mt-0.5">{scanResult.query_input}</h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-xl bg-[#07080a] border border-[#1e232d] text-right font-mono">
                  <span className="text-[10px] text-[#848E9C] block">Similarity</span>
                  <span className="text-xs font-bold text-[#C8FF00]">{similarityScore}% Match</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-[#07080a] border border-[#1e232d] text-right font-mono">
                  <span className="text-[10px] text-[#848E9C] block">Latency</span>
                  <span className="text-xs font-bold text-[#00E5FF]">{scanResult.latency_ms.toFixed(1)}ms</span>
                </div>
              </div>
            </div>

            {/* Macro Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d]">
                <span className="text-[10px] font-mono text-[#848E9C] uppercase">Calories</span>
                <p className="text-2xl font-black font-mono text-[#C8FF00] mt-1">
                  {Math.round(scanResult.predicted_macros.calories)}
                  <span className="text-xs text-[#848E9C] ml-1">kcal</span>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d]">
                <span className="text-[10px] font-mono text-[#848E9C] uppercase">Protein</span>
                <p className="text-2xl font-black font-mono text-[#00E5FF] mt-1">
                  {scanResult.predicted_macros.protein_g.toFixed(1)}
                  <span className="text-xs text-[#848E9C] ml-1">g</span>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d]">
                <span className="text-[10px] font-mono text-[#848E9C] uppercase">Carbohydrates</span>
                <p className="text-2xl font-black font-mono text-white mt-1">
                  {scanResult.predicted_macros.carbs_g.toFixed(1)}
                  <span className="text-xs text-[#848E9C] ml-1">g</span>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d]">
                <span className="text-[10px] font-mono text-[#848E9C] uppercase">Lipids / Fat</span>
                <p className="text-2xl font-black font-mono text-[#FFB800] mt-1">
                  {scanResult.predicted_macros.fat_g.toFixed(1)}
                  <span className="text-xs text-[#848E9C] ml-1">g</span>
                </p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <p className="text-xs text-[#848E9C] flex items-center gap-1.5">
                <Info className="h-4 w-4 text-[#C8FF00]" />
                <span>Grounded inference using {scanResult.model_version}</span>
              </p>

              <button
                onClick={handleConfirmAndSave}
                disabled={confirming || confirmedSuccess}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#C8FF00] text-black font-bold text-xs flex items-center justify-center gap-2 shadow-glow-lime hover:bg-[#d4ff33] transition-all disabled:opacity-50"
              >
                <UtensilsCrossed className="h-4 w-4" />
                <span>
                  {confirming
                    ? 'Saving Meal...'
                    : confirmedSuccess
                    ? 'Logged to Daily Nutrition'
                    : 'Log Meal to Daily Intake'}
                </span>
              </button>
            </div>
          </div>

          {/* Retrieved Knowledge Base Grounding Items */}
          <div className="p-6 rounded-3xl bg-[#12151b] border border-[#1e232d] space-y-4 shadow-okx-card">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#848E9C] flex items-center gap-2">
              <Database className="h-4 w-4 text-[#00E5FF]" />
              <span>Retrieved Vector Knowledge Items ({scanResult.retrieved_items.length})</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scanResult.retrieved_items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d] flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white">{item.food_name}</p>
                    <p className="text-[10px] font-mono text-[#848E9C]">
                      Dataset: <span className="text-[#00E5FF]">{item.source_dataset}</span> &bull; {item.serving_description}
                    </p>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <span className="text-[#C8FF00] font-bold block">{item.kcal_per_100g} kcal</span>
                    <span className="text-[10px] text-[#848E9C]">P: {item.protein_per_100g}g</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
