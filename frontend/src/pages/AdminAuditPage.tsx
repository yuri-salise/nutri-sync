import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Exercise, RagScanLog, FoodItemSummary } from '../types';
import { useDialogs } from '../components/common/DialogProvider';
import {
  ShieldCheck,
  Plus,
  Trash2,
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
  const { confirm } = useDialogs();
  const [activeTab, setActiveTab] = useState<'exercises' | 'rag_logs' | 'knowledge' | 'info'>('exercises');

  // Built-in exercise library (shared with every user)
  const [libraryExercises, setLibraryExercises] = useState<Exercise[]>([]);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState('chest');
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryBusy, setLibraryBusy] = useState(false);

  // RAG Logs
  const [ragLogs, setRagLogs] = useState<RagScanLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Knowledge base
  const [knowledgeItems, setKnowledgeItems] = useState<FoodItemSummary[]>([]);
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);

  useEffect(() => {
    loadLibrary();
    loadRagLogs();
    loadKnowledgeBase();
  }, []);

  const loadLibrary = async () => {
    try {
      const res = await api.getExercises({ limit: 100, sort: 'name' });
      setLibraryExercises(res.data.filter((e) => e.status === 'approved'));
    } catch (err: any) {
      setLibraryError(err.message || 'Failed to load the exercise library.');
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

  const handleAddLibraryExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newExName.trim();
    if (name.length < 2) {
      setLibraryError('Exercise name needs at least 2 characters.');
      return;
    }
    setLibraryBusy(true);
    setLibraryError(null);
    try {
      // Coach-created exercises go straight into the shared library.
      const created = await api.createExercise({ name, muscle_group: newExMuscle, category: 'compound', met_value: 6 });
      setLibraryExercises((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewExName('');
    } catch (err: any) {
      setLibraryError(err.message || 'Failed to add exercise.');
    } finally {
      setLibraryBusy(false);
    }
  };

  const handleRemoveLibraryExercise = async (ex: Exercise) => {
    const ok = await confirm({
      title: `Remove “${ex.name}”?`,
      message: 'It will disappear from the shared library and from routines that use it.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteExercise(ex.id);
      setLibraryExercises((prev) => prev.filter((e) => e.id !== ex.id));
    } catch (err: any) {
      setLibraryError(err.message || 'Failed to remove exercise.');
    }
  };

  const visibleLibrary = libraryExercises.filter((e) =>
    `${e.name} ${e.muscle_group}`.toLowerCase().includes(libraryQuery.trim().toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-info" />
            <span>Coach & Administrator Dashboard</span>
          </h1>
          <p className="text-sm text-muted">
            Manage the built-in exercise library, inspect AI meal scan history, and browse the verified food database.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-line self-start sm:self-auto text-xs">
          <button
            onClick={() => setActiveTab('exercises')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'exercises'
                ? 'bg-accent text-on-accent shadow-neu-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Exercise Library ({libraryExercises.length})
          </button>
          <button
            onClick={() => setActiveTab('rag_logs')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'rag_logs'
                ? 'bg-info text-on-accent shadow-neu-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            AI Scan History
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'knowledge'
                ? 'bg-accent text-on-accent shadow-neu-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Food Database
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'info'
                ? 'bg-accent text-on-accent shadow-neu-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Capstone Credits
          </button>
        </div>
      </div>

      {/* Tab 1: Built-in exercise library (users add their own private exercises without approval) */}
      {activeTab === 'exercises' && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            These exercises show up for every athlete. Athletes can also add their own private exercises
            from the Workouts screen; those don’t need your approval.
          </p>

          <form onSubmit={handleAddLibraryExercise} className="p-4 rounded-3xl bg-card border border-line grid grid-cols-1 sm:grid-cols-[1fr_10rem_auto] gap-3 items-end">
            <label className="text-xs text-muted space-y-1">
              <span>Exercise name</span>
              <input
                value={newExName}
                onChange={(e) => setNewExName(e.target.value)}
                placeholder="e.g. Goblet Squat"
                className="w-full h-11 rounded-xl bg-well border border-line px-3 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </label>
            <label className="text-xs text-muted space-y-1">
              <span>Muscle</span>
              <select
                value={newExMuscle}
                onChange={(e) => setNewExMuscle(e.target.value)}
                className="w-full h-11 rounded-xl bg-well border border-line px-2 text-sm text-ink capitalize"
              >
                {['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full body', 'cardio'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={libraryBusy}
              className="h-11 px-5 rounded-xl bg-accent text-on-accent font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add to library
            </button>
          </form>

          {libraryError && (
            <p role="alert" className="text-sm text-danger">{libraryError}</p>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              aria-label="Search library"
              value={libraryQuery}
              onChange={(e) => setLibraryQuery(e.target.value)}
              placeholder="Search library"
              className="w-full h-11 pl-9 pr-3 rounded-xl bg-well border border-line text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {visibleLibrary.map((ex) => (
              <div key={ex.id} className="p-3 rounded-2xl bg-card border border-line flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{ex.name}</p>
                  <p className="text-xs text-muted capitalize">{ex.muscle_group} · {ex.category}</p>
                </div>
                <button
                  onClick={() => handleRemoveLibraryExercise(ex)}
                  aria-label={`Remove ${ex.name}`}
                  className="h-9 w-9 rounded-lg text-muted hover:text-danger flex items-center justify-center shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: RAG Traceability & Audit Logs (Requirement T4) */}
      {activeTab === 'rag_logs' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-well border border-line text-xs text-muted flex items-center gap-2">
            <Lock className="h-4 w-4 text-accent shrink-0" />
            <span>
              Every meal scan is logged with its input, matcher version, match score, time taken, and which embedding was used.
            </span>
          </div>

          {loadingLogs ? (
            <div className="p-12 text-center">
              <div className="h-8 w-8 border-2 border-info border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : ragLogs.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-card border border-line text-xs text-muted">
              No RAG scan logs captured yet. Run a meal query in the RAG Scanner to populate the audit ledger.
            </div>
          ) : (
            <div className="space-y-3">
              {ragLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-5 rounded-3xl bg-card border border-line shadow-neu space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-ink tabular-nums">&ldquo;{log.query_input}&rdquo;</span>
                      <p className="text-[11px] tabular-nums text-muted">
                        {new Date(log.created_at).toLocaleString()} &bull; Model: {log.model_version}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 tabular-nums text-xs">
                      <span className="px-2.5 py-1 rounded-xl bg-well border border-line text-accent font-bold">
                        {(log.top_similarity_score * 100).toFixed(1)}% Sim
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-well border border-line text-info">
                        {log.latency_ms.toFixed(1)} ms
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                          log.used_fallback
                            ? 'bg-warning/20 text-warning border border-warning/30'
                            : 'bg-success/20 text-success border border-success/30'
                        }`}
                      >
                        {log.used_fallback ? 'HASH EMBEDDING' : 'NEURAL EMBEDDING'}
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
          <div className="p-4 rounded-3xl bg-card border border-line flex items-center gap-3">
            <Search className="h-4 w-4 text-muted" />
            <input
              type="text"
              value={knowledgeQuery}
              onChange={(e) => setKnowledgeQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadKnowledgeBase()}
              placeholder="Filter knowledge items by name (Press Enter)..."
              className="w-full bg-transparent text-xs text-ink placeholder-muted focus:outline-none"
            />
            <button
              onClick={loadKnowledgeBase}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-accent text-on-accent hover:bg-accent-hover"
            >
              Search
            </button>
          </div>

          {loadingKnowledge ? (
            <div className="p-12 text-center">
              <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {knowledgeItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-card border border-line space-y-2 shadow-neu"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-bold text-ink leading-snug">{item.food_name}</p>
                    <span className="text-[10px] tabular-nums px-2 py-0.5 rounded bg-well border border-line text-info">
                      {item.source_dataset}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs tabular-nums text-muted">
                    <span className="text-accent font-bold">{item.kcal_per_100g} kcal/100g</span>
                    <span>P: {item.protein_per_100g}g</span>
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
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-card via-well to-page border border-line shadow-2xl space-y-6">
            <div>
              <span className="text-[10px] tabular-nums uppercase tracking-widest text-accent font-bold">
                Academic Capstone Specification
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-ink mt-1">
                NutriSync-RAG: Activity-Synced Nutrition & Workout Tracking
              </h2>
              <p className="text-xs text-muted mt-1">
                ITSD 85 &bull; Special Topics in Software Development &bull; Academic Year 2026–2027
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-well border border-line space-y-1">
                <span className="text-[10px] text-muted tabular-nums uppercase">Developer / Student</span>
                <p className="text-sm font-bold text-ink">Yuri D. Salise</p>
                <p className="text-[11px] text-info tabular-nums">Solo Full-Stack Architect</p>
              </div>

              <div className="p-4 rounded-2xl bg-well border border-line space-y-1">
                <span className="text-[10px] text-muted tabular-nums uppercase">Course & Section</span>
                <p className="text-sm font-bold text-ink">ITSD 85</p>
                <p className="text-[11px] text-accent tabular-nums">BSIT 4A</p>
              </div>

              <div className="p-4 rounded-2xl bg-well border border-line space-y-1">
                <span className="text-[10px] text-muted tabular-nums uppercase">Instructor / Coach</span>
                <p className="text-sm font-bold text-ink">Coach Rinante Buntod</p>
                <p className="text-[11px] text-muted tabular-nums">Project Evaluator</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
