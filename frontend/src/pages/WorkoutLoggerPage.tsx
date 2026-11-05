import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Exercise, WorkoutSession, WorkoutSet } from '../types';
import { Dumbbell, Plus, Trash2, Award, Clock, Flame, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';

export const WorkoutLoggerPage: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [splitTitle, setSplitTitle] = useState('Push Day A - Upper Strength');
  const [durationMin, setDurationMin] = useState(65);
  const [isPublic, setIsPublic] = useState(true);
  const [sets, setSets] = useState<Array<{ exercise_id: number; set_no: number; reps: number; weight_kg: number }>>([
    { exercise_id: 1, set_no: 1, reps: 10, weight_kg: 80 },
    { exercise_id: 1, set_no: 2, reps: 8, weight_kg: 95 },
    { exercise_id: 1, set_no: 3, reps: 5, weight_kg: 105 },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [exRes, sessRes] = await Promise.all([
        api.getExercises({ limit: 100 }),
        api.getWorkouts({ limit: 20, only_mine: true }),
      ]);
      setExercises(exRes.data);
      setSessions(sessRes.data);
      if (exRes.data.length > 0 && sets[0].exercise_id === 1) {
        setSets((prev) => prev.map((s) => ({ ...s, exercise_id: exRes.data[0].id })));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load workouts.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSet = () => {
    const lastSet = sets[sets.length - 1];
    setSets([
      ...sets,
      {
        exercise_id: lastSet ? lastSet.exercise_id : (exercises[0]?.id || 1),
        set_no: sets.length + 1,
        reps: lastSet ? lastSet.reps : 10,
        weight_kg: lastSet ? lastSet.weight_kg : 60,
      },
    ]);
  };

  const handleRemoveSet = (idx: number) => {
    const updated = sets.filter((_, i) => i !== idx).map((s, i) => ({ ...s, set_no: i + 1 }));
    setSets(updated);
  };

  const handleUpdateSet = (index: number, field: string, value: any) => {
    const updated = [...sets];
    updated[index] = { ...updated[index], [field]: value };
    setSets(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitTitle.trim()) {
      setError('Please provide a workout split title.');
      return;
    }
    if (sets.length === 0) {
      setError('Please add at least one exercise set.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const newSession = await api.createWorkout({
        split_title: splitTitle,
        duration_min: durationMin,
        is_public: isPublic,
        sets,
      });

      const prSets = newSession.sets.filter((s) => s.is_pr);
      if (prSets.length > 0) {
        setSuccessMsg(`Outstanding progressive overload! You unlocked ${prSets.length} new Personal Record(s)!`);
      } else {
        setSuccessMsg('Workout session logged successfully!');
      }

      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to log workout session.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSession = async (id: number) => {
    if (!confirm('Are you sure you want to delete this workout session?')) return;
    try {
      await api.deleteWorkout(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete session.');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Dumbbell className="h-6 w-6 text-emerald-400" />
            <span>Strength & Personal Record Logger</span>
          </h1>
          <p className="text-sm text-athletic-muted">
            Track compound movements, progressive overload, and automated PR detection
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5 shadow-glow-emerald">
          <Award className="h-5 w-5 text-amber-400 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Logging Form Card */}
      <form onSubmit={handleSubmit} className="p-6 rounded-3xl bg-athletic-card border border-athletic-border space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-slate-300">Split / Routine Title</label>
            <input
              type="text"
              value={splitTitle}
              onChange={(e) => setSplitTitle(e.target.value)}
              placeholder="e.g. Push Day A - Heavy Bench & Incline"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-athletic-border text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-athletic-muted" /> Duration (Minutes)
            </label>
            <input
              type="number"
              value={durationMin}
              onChange={(e) => setDurationMin(parseInt(e.target.value) || 0)}
              min="5"
              max="360"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-athletic-border text-slate-100 text-sm focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        {/* Sets Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-athletic-muted">Logged Sets</h3>
            <button
              type="button"
              onClick={handleAddSet}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Set</span>
            </button>
          </div>

          <div className="space-y-2">
            {sets.map((set, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2.5 items-center p-3 rounded-2xl bg-slate-900/90 border border-athletic-border text-xs"
              >
                <div className="col-span-1 text-center font-mono font-bold text-athletic-muted">
                  #{set.set_no}
                </div>

                <div className="col-span-5">
                  <select
                    value={set.exercise_id}
                    onChange={(e) => handleUpdateSet(idx, 'exercise_id', parseInt(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {exercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name} ({ex.muscle_group})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-3 flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.5"
                    value={set.weight_kg}
                    onChange={(e) => handleUpdateSet(idx, 'weight_kg', parseFloat(e.target.value) || 0)}
                    min="0"
                    placeholder="kg"
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-center font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-athletic-muted font-mono text-[11px]">kg</span>
                </div>

                <div className="col-span-2 flex items-center gap-1.5">
                  <input
                    type="number"
                    value={set.reps}
                    onChange={(e) => handleUpdateSet(idx, 'reps', parseInt(e.target.value) || 0)}
                    min="1"
                    placeholder="reps"
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-center font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-athletic-muted font-mono text-[11px]">reps</span>
                </div>

                <div className="col-span-1 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveSet(idx)}
                    disabled={sets.length === 1}
                    className="p-1.5 text-athletic-muted hover:text-rose-400 disabled:opacity-30 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-xs text-athletic-muted cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded bg-slate-900 border-athletic-border text-emerald-500 focus:ring-emerald-500 h-4 w-4"
            />
            <span>Share session to community splits feed</span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl font-semibold text-xs bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-90 shadow-glow-emerald transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <span className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>Save Workout & Detect PRs</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* History of Previous Sessions */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white tracking-tight">Recent Workout Sessions</h2>

        {sessions.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-athletic-card border border-athletic-border text-athletic-muted text-xs">
            No workout sessions logged yet. Record your first split above!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-5 rounded-3xl bg-athletic-card border border-athletic-border space-y-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-100 text-base">{sess.split_title}</h3>
                    <p className="text-xs text-athletic-muted">
                      {new Date(sess.session_date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteSession(sess.id)}
                    className="p-1.5 text-athletic-muted hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-colors"
                    title="Delete session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-athletic-muted">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Clock className="h-3.5 w-3.5 text-cyan-400" /> {sess.duration_min} min
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Flame className="h-3.5 w-3.5" /> {Math.round(sess.burned_kcal)} kcal
                  </span>
                  <span className="text-slate-400">
                    {sess.sets.length} sets
                  </span>
                </div>

                {/* Sets preview */}
                <div className="space-y-1.5 pt-2 border-t border-athletic-border/60">
                  {sess.sets.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs font-mono py-0.5">
                      <span className="text-slate-300">
                        {s.exercise?.name || 'Exercise'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">
                          {s.weight_kg}kg × {s.reps}
                        </span>
                        {s.is_pr && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
                            <Award className="h-3 w-3" /> PR
                          </span>
                        )}
                        {s.verified_by_id && (
                          <span className="text-[10px] text-cyan-400 font-sans">✓ Verified</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
