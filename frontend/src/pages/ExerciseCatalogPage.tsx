import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Exercise } from '../types';
import { BookOpen, Search, Plus, Filter, CheckCircle2, Clock, Dumbbell, X, Sparkles } from 'lucide-react';

export const ExerciseCatalogPage: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Proposal Form State
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('chest');
  const [category, setCategory] = useState('compound');
  const [metValue, setMetValue] = useState('6.0');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const muscleGroups = ['All', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
  const categories = ['All', 'compound', 'isolation', 'bodyweight', 'cardio'];

  useEffect(() => {
    fetchExercises();
  }, [searchQuery, selectedMuscle, selectedCategory]);

  const fetchExercises = async () => {
    try {
      setLoading(true);
      const res = await api.getExercises({
        q: searchQuery || undefined,
        muscle_group: selectedMuscle && selectedMuscle !== 'All' ? selectedMuscle : undefined,
        category: selectedCategory && selectedCategory !== 'All' ? selectedCategory : undefined,
        limit: 100,
      });
      setExercises(res.data);
    } catch (err) {
      console.error('Failed to load exercises:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setSuccessMsg(null);
    try {
      await api.createExercise({
        name,
        category,
        muscle_group: muscleGroup,
        met_value: parseFloat(metValue) || 6.0,
      });
      setName('');
      setShowSubmitModal(false);
      setSuccessMsg('Exercise submitted successfully! Pending approval by a coach/administrator.');
      fetchExercises();
    } catch (err: any) {
      alert(err.message || 'Failed to submit custom exercise.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <BookOpen className="h-6 w-6 text-emerald-400" />
            <span>Exercise & Movement Catalog</span>
          </h1>
          <p className="text-sm text-athletic-muted">
            Explore verified compound movements, isolation lifts, and submit custom exercises
          </p>
        </div>

        <button
          onClick={() => setShowSubmitModal(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-90 shadow-glow-emerald flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Propose Custom Movement</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-athletic-card border border-athletic-border space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-athletic-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exercises by name or muscle group (e.g. Bench, Squat, Lat Pulldown)..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-athletic-border text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-athletic-border/60">
          <span className="text-[11px] text-athletic-muted flex items-center gap-1 font-semibold uppercase">
            <Filter className="h-3 w-3" /> Muscle:
          </span>
          {muscleGroups.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMuscle(m === 'All' ? '' : m)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                (m === 'All' && !selectedMuscle) || selectedMuscle === m
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-athletic-border'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Exercises Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-athletic-card border border-athletic-border text-athletic-muted text-xs">
          No exercises matched your search filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exercises.map((ex) => (
            <div
              key={ex.id}
              className="p-5 rounded-2xl bg-athletic-card border border-athletic-border hover:border-slate-700 transition-colors space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-slate-100 text-sm">{ex.name}</h3>
                {ex.status === 'approved' ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Approved
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Pending Review
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-athletic-border text-slate-300 capitalize font-medium">
                  {ex.muscle_group}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-athletic-border text-slate-400 capitalize">
                  {ex.category}
                </span>
              </div>

              <div className="pt-2 border-t border-athletic-border/60 flex items-center justify-between text-[11px] text-athletic-muted font-mono">
                <span>Metabolic Cost (MET):</span>
                <span className="text-emerald-400 font-bold">{ex.met_value} MET</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Propose Exercise Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-athletic-card border border-athletic-border space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" /> Propose Custom Movement
              </h3>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="p-1 rounded-lg text-athletic-muted hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExercise} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Exercise Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bulgarian Split Squat with Dumbbells"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-athletic-border text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Target Muscle</label>
                  <select
                    value={muscleGroup}
                    onChange={(e) => setMuscleGroup(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-athletic-border text-slate-100 capitalize focus:outline-none focus:border-emerald-500"
                  >
                    <option value="chest">Chest</option>
                    <option value="back">Back</option>
                    <option value="legs">Legs</option>
                    <option value="shoulders">Shoulders</option>
                    <option value="arms">Arms</option>
                    <option value="core">Core</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-athletic-border text-slate-100 capitalize focus:outline-none focus:border-emerald-500"
                  >
                    <option value="compound">Compound</option>
                    <option value="isolation">Isolation</option>
                    <option value="bodyweight">Bodyweight</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">MET Value (Metabolic Equivalent)</label>
                <input
                  type="number"
                  step="0.5"
                  value={metValue}
                  onChange={(e) => setMetValue(e.target.value)}
                  min="1"
                  max="20"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-athletic-border text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-athletic-muted">Standard resistance training: 5.0 - 7.5 MET</span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl font-semibold bg-emerald-500 text-black hover:bg-emerald-400 shadow-glow-emerald"
                >
                  {submitting ? 'Submitting...' : 'Submit for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
