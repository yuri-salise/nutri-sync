import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';

export const AdminAuditPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'exercises' | 'rag_logs' | 'knowledge'>('exercises');

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
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-cyan-400" />
            <span>Coach Moderation & RAG Audit Console</span>
          </h1>
          <p className="text-sm text-athletic-muted">
            Exercise approvals, PR certifications, and Requirement T4 RAG traceability telemetry
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-2xl border border-athletic-border self-start sm:self-auto text-xs">
          <button
            onClick={() => setActiveTab('exercises')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === 'exercises'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Exercise Approvals ({pendingExercises.length})
          </button>
          <button
            onClick={() => setActiveTab('rag_logs')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === 'rag_logs'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            RAG Traceability Logs (T4)
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === 'knowledge'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            pgvector Knowledge Base
          </button>
        </div>
      </div>

      {/* Tab 1: Exercise Moderation */}
      {activeTab === 'exercises' && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-athletic-muted">
            Athlete-Submitted Custom Exercises Awaiting Coach Review
          </h2>

          {pendingExercises.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-athletic-card border border-athletic-border text-athletic-muted text-xs">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              All submitted exercises have been reviewed. No pending approvals!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingExercises.map((ex) => (
                <div
                  key={ex.id}
                  className="p-5 rounded-3xl bg-athletic-card border border-athletic-border space-y-4 shadow-xl"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-100 text-base">{ex.name}</h3>
                      <p className="text-xs text-athletic-muted capitalize">
                        Target: <b className="text-slate-300">{ex.muscle_group}</b> | Category:{' '}
                        <b className="text-slate-300">{ex.category}</b>
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono">
                      Pending
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-900 border border-athletic-border text-xs font-mono text-athletic-muted flex justify-between">
                    <span>Assigned MET Burn:</span>
                    <span className="text-emerald-400 font-bold">{ex.met_value} MET</span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-athletic-border/60">
                    <button
                      onClick={() => handleRejectExercise(ex.id)}
                      disabled={moderating === ex.id}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleApproveExercise(ex.id)}
                      disabled={moderating === ex.id}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 shadow-glow-emerald transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Approve to Catalog</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: RAG Traceability Telemetry Logs (Requirement T4) */}
      {activeTab === 'rag_logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-athletic-muted flex items-center gap-2">
              <Compass className="h-4 w-4 text-emerald-400" /> RAG Audit Trail (Requirement T4)
            </h2>
            <button
              onClick={loadRagLogs}
              className="text-xs text-cyan-400 hover:underline font-mono"
            >
              Refresh Logs
            </button>
          </div>

          {loadingLogs ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ragLogs.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-athletic-card border border-athletic-border text-athletic-muted text-xs">
              No RAG scans recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {ragLogs.map((log) => {
                let parsedMacros: any = {};
                try {
                  parsedMacros = JSON.parse(log.predicted_macros_json);
                } catch (e) {}

                return (
                  <div
                    key={log.id}
                    className="p-5 rounded-2xl bg-athletic-card border border-athletic-border space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-mono text-athletic-muted">
                          Log #{log.id} • User ID #{log.user_id} • {new Date(log.created_at).toLocaleString()}
                        </span>
                        <h4 className="font-bold text-white text-sm font-sans">"{log.query_input}"</h4>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-athletic-border text-emerald-400 font-bold">
                          {(log.top_similarity_score * 100).toFixed(1)}% Sim
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-athletic-border text-cyan-400 font-bold">
                          {log.latency_ms} ms
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md border font-bold ${
                            log.used_fallback
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {log.used_fallback ? 'SQL Fallback' : 'pgvector'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/90 border border-athletic-border flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-athletic-muted">
                      <div>
                        <span>Model: </span>
                        <span className="text-slate-200">{log.model_version}</span>
                      </div>
                      <div>
                        <span>Retrieved IDs: </span>
                        <span className="text-slate-300">{log.retrieved_item_ids}</span>
                      </div>
                      <div>
                        <span>Predicted: </span>
                        <span className="text-white font-semibold">
                          {parsedMacros.calories} kcal (P:{parsedMacros.protein_g}g C:{parsedMacros.carbs_g}g F:{parsedMacros.fat_g}g)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Knowledge Base Explorer */}
      {activeTab === 'knowledge' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-athletic-muted flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-400" /> DOST-FNRI & USDA Knowledge Base Records
            </h2>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-athletic-muted" />
              <input
                type="text"
                value={knowledgeQuery}
                onChange={(e) => setKnowledgeQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadKnowledgeBase()}
                placeholder="Search food knowledge base..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-athletic-border text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {loadingKnowledge ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {knowledgeItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-athletic-card border border-athletic-border space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-slate-100">{item.food_name}</h4>
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
                      <span className="block text-[10px]">Kcal</span>
                      <span className="font-semibold text-white">{item.kcal_per_100g}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-emerald-400">P</span>
                      <span className="font-semibold text-emerald-400">{item.protein_per_100g}g</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-cyan-400">C</span>
                      <span className="font-semibold text-cyan-400">{item.carbs_per_100g}g</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-amber-400">F</span>
                      <span className="font-semibold text-amber-400">{item.fat_per_100g}g</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
