import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { Exercise, RagScanLog, FoodItemSummary } from '../types';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Compass,
  Database,
  Search,
  Layers,
  Award,
  Cpu,
  Lock,
} from 'lucide-react';

export const AdminAuditPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'exercises' | 'rag_logs' | 'knowledge' | 'info'>('exercises');

  // Exercise Moderation
  const [pendingExercises, setPendingExercises] = useState<Exercise[]>([]);
  const [moderating, setModerating] = useState<number | null>(null);

  // RAG Logs
  const [ragLogs, setRagLogs] = useState<RagScanLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Knowledge base
  const [knowledgeItems, setKnowledgeItems] = useState<FoodItemSummary[]>([]);
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);

  useEffect(() => {
    loadPendingExercises();
    loadRagLogs();
    loadKnowledgeBase();
  }, []);

  const loadPendingExercises = async () => {
    try {
      const res = await api.getExercises({ status: 'pending', limit: 50 });
      setPendingExercises(res.data);
    } catch (err) {
      console.error('Failed to load pending exercises:', err);
    }
  };

  const loadRagLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await api.getRagScanLogs(1, 30);
      setRagLogs(res.data);
    } catch (err) {
      console.error('Failed to load RAG scan logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadKnowledgeBase = async () => {
    try {
      setLoadingKnowledge(true);
      const res = await api.getNutritionKnowledgeItems({ q: knowledgeQuery || undefined, limit: 30 });
      setKnowledgeItems(res.data);
    } catch (err) {
      console.error('Failed to load knowledge items:', err);
    } finally {
      setLoadingKnowledge(false);
    }
  };

  const handleApproveExercise = async (id: number) => {
    setModerating(id);
    try {
      await api.updateExercise(id, { status: 'approved' });
      setPendingExercises((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to approve exercise.');
    } finally {
      setModerating(null);
    }
  };

  const handleRejectExercise = async (id: number) => {
    setModerating(id);
    try {
      await api.updateExercise(id, { status: 'rejected' });
      setPendingExercises((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to reject exercise.');
    } finally {
      setModerating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-[#00E5FF]" />
            <span>Coach & Administrator Dashboard</span>
          </h1>
          <p className="text-sm text-[#848E9C]">
            Review custom exercise proposals, inspect AI meal scan history, and browse the verified food database.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-[#12151b] p-1 rounded-xl border border-[#1e232d] self-start sm:self-auto text-xs">
          <button
            onClick={() => setActiveTab('exercises')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'exercises'
                ? 'bg-[#C8FF00] text-black shadow-glow-lime'
                : 'text-[#848E9C] hover:text-white'
            }`}
          >
            Pending Exercises ({pendingExercises.length})
          </button>
          <button
            onClick={() => setActiveTab('rag_logs')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'rag_logs'
                ? 'bg-[#00E5FF] text-black shadow-glow-cyan'
                : 'text-[#848E9C] hover:text-white'
            }`}
          >
            AI Scan History
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'knowledge'
                ? 'bg-[#C8FF00] text-black shadow-glow-lime'
                : 'text-[#848E9C] hover:text-white'
            }`}
          >
            Food Database
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'info'
                ? 'bg-[#C8FF00] text-black shadow-glow-lime'
                : 'text-[#848E9C] hover:text-white'
            }`}
          >
            Capstone Credits
          </button>
        </div>
      </div>

      {/* Tab 1: Exercise Moderation */}
      {activeTab === 'exercises' && (
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#848E9C]">
            Lifts Awaiting Coach Review ({pendingExercises.length})
          </h3>

          {pendingExercises.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#12151b] border border-[#1e232d] text-xs text-[#848E9C]">
              No exercises pending review. The movement catalog is fully audited.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingExercises.map((ex) => (
                <div
                  key={ex.id}
                  className="p-5 rounded-3xl bg-[#12151b] border border-[#1e232d] shadow-cyber-card space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{ex.name}</h4>
                      <p className="text-xs text-[#848E9C]">
                        Muscle: <span className="text-[#00E5FF] uppercase font-mono">{ex.muscle_group}</span> &bull;{' '}
                        Category: <span className="text-white uppercase font-mono">{ex.category}</span>
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-[#07080a] border border-[#1e232d] text-xs font-mono text-[#C8FF00]">
                      MET: {ex.met_value}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#1e232d]">
                    <button
                      onClick={() => handleApproveExercise(ex.id)}
                      disabled={moderating === ex.id}
                      className="flex-1 py-2 rounded-xl bg-[#00D26A] text-black font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#00c05e] transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleRejectExercise(ex.id)}
                      disabled={moderating === ex.id}
                      className="flex-1 py-2 rounded-xl bg-[#F6465D]/20 text-[#F6465D] border border-[#F6465D]/30 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#F6465D]/30 transition-all disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: RAG Traceability & Audit Logs (Requirement T4) */}
      {activeTab === 'rag_logs' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#0d1015] border border-[#1e232d] text-xs text-[#848E9C] flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#C8FF00] shrink-0" />
            <span>
              Requirement T4 RAG Audit Ledger: All semantic inferences record latency (ms), cosine similarity scores, prompt payloads, and fallback statuses.
            </span>
          </div>

          {loadingLogs ? (
            <div className="p-12 text-center">
              <div className="h-8 w-8 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : ragLogs.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#12151b] border border-[#1e232d] text-xs text-[#848E9C]">
              No RAG scan logs captured yet. Run a meal query in the RAG Scanner to populate the audit ledger.
            </div>
          ) : (
            <div className="space-y-3">
              {ragLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-5 rounded-3xl bg-[#12151b] border border-[#1e232d] shadow-cyber-card space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white font-mono">&ldquo;{log.query_input}&rdquo;</span>
                      <p className="text-[11px] font-mono text-[#848E9C]">
                        {new Date(log.created_at).toLocaleString()} &bull; Model: {log.model_version}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="px-2.5 py-1 rounded-xl bg-[#07080a] border border-[#1e232d] text-[#C8FF00] font-bold">
                        {(log.top_similarity_score * 100).toFixed(1)}% Sim
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-[#07080a] border border-[#1e232d] text-[#00E5FF]">
                        {log.latency_ms.toFixed(1)} ms
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                          log.used_fallback
                            ? 'bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/30'
                            : 'bg-[#00D26A]/20 text-[#00D26A] border border-[#00D26A]/30'
                        }`}
                      >
                        {log.used_fallback ? 'FALLBACK' : 'VECTOR GROUNDED'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Knowledge Base Vector Explorer */}
      {activeTab === 'knowledge' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-[#12151b] border border-[#1e232d] flex items-center gap-3">
            <Search className="h-4 w-4 text-[#848E9C]" />
            <input
              type="text"
              value={knowledgeQuery}
              onChange={(e) => setKnowledgeQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadKnowledgeBase()}
              placeholder="Filter knowledge items by name (Press Enter)..."
              className="w-full bg-transparent text-xs text-white placeholder-[#848E9C] focus:outline-none"
            />
            <button
              onClick={loadKnowledgeBase}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#C8FF00] text-black hover:bg-[#d4ff33]"
            >
              Search
            </button>
          </div>

          {loadingKnowledge ? (
            <div className="p-12 text-center">
              <div className="h-8 w-8 border-2 border-[#C8FF00] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {knowledgeItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-[#12151b] border border-[#1e232d] space-y-2 shadow-cyber-card"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-bold text-white leading-snug">{item.food_name}</p>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#07080a] border border-[#1e232d] text-[#00E5FF]">
                      {item.source_dataset}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono text-[#848E9C]">
                    <span className="text-[#C8FF00] font-bold">{item.kcal_per_100g} kcal/100g</span>
                    <span>P: {item.protein_per_100g}g</span>
                  </div>
                  <div className="text-[10px] font-mono text-[#848E9C] pt-1 border-t border-[#1e232d] flex justify-between">
                    <span>Embedding:</span>
                    <span className="text-[#C8FF00]">pgvector[384]</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Project & Capstone Information */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#12151b] via-[#0d1015] to-[#000000] border border-[#1e232d] shadow-2xl space-y-6">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#C8FF00] font-bold">
                Academic Capstone Specification
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                NutriSync-RAG: Activity-Synced Nutrition & Workout Tracking
              </h2>
              <p className="text-xs text-[#848E9C] mt-1">
                ITSD 85 &bull; Special Topics in Software Development &bull; Academic Year 2026–2027
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d] space-y-1">
                <span className="text-[10px] text-[#848E9C] font-mono uppercase">Developer / Student</span>
                <p className="text-sm font-bold text-white">Yuri D. Salise</p>
                <p className="text-[11px] text-[#00E5FF] font-mono">Solo Full-Stack Architect</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d] space-y-1">
                <span className="text-[10px] text-[#848E9C] font-mono uppercase">Course & Section</span>
                <p className="text-sm font-bold text-white">ITSD 85</p>
                <p className="text-[11px] text-[#C8FF00] font-mono">BSIT 4A</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d] space-y-1">
                <span className="text-[10px] text-[#848E9C] font-mono uppercase">Instructor / Coach</span>
                <p className="text-sm font-bold text-white">Coach Rinante Buntod</p>
                <p className="text-[11px] text-[#848E9C] font-mono">Project Evaluator</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#07080a] border border-[#1e232d] space-y-1">
                <span className="text-[10px] text-[#848E9C] font-mono uppercase">System Version</span>
                <p className="text-sm font-bold text-white">v1.0.0-production</p>
                <p className="text-[11px] text-[#00D26A] font-mono">Docker Compose + Caddy</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#07080a] border border-[#1e232d] space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                ITSD 85 Rubric Architecture Compliance
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-[#12151b] border border-[#1e232d]">
                  <span className="text-[#00D26A] font-bold block">F1–F6</span>
                  <span className="text-[10px] text-[#848E9C]">Frontend SPA</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#12151b] border border-[#1e232d]">
                  <span className="text-[#00D26A] font-bold block">B1–B9</span>
                  <span className="text-[10px] text-[#848E9C]">FastAPI REST</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#12151b] border border-[#1e232d]">
                  <span className="text-[#00D26A] font-bold block">D1–D4</span>
                  <span className="text-[10px] text-[#848E9C]">Postgres & RLS</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#12151b] border border-[#1e232d]">
                  <span className="text-[#00D26A] font-bold block">Q1–Q5</span>
                  <span className="text-[10px] text-[#848E9C]">Pytest & Coverage</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#12151b] border border-[#1e232d]">
                  <span className="text-[#00D26A] font-bold block">DP1–DP6</span>
                  <span className="text-[10px] text-[#848E9C]">Caddy Proxy</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#12151b] border border-[#1e232d]">
                  <span className="text-[#00D26A] font-bold block">T1–T6</span>
                  <span className="text-[10px] text-[#848E9C]">Traceability</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
