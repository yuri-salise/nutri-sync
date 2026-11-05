import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import { Exercise } from '../types';
import {
  BookOpen,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  Dumbbell,
  X,
  Sparkles,
  Zap,
} from 'lucide-react';

export const ExerciseCatalogPage: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
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
      setSuccessMsg('New exercise submitted! It has been sent for coach review.');
      fetchExercises();
    } catch (err: any) {
      alert(err.message || 'Failed to submit custom exercise.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <BookOpen className="h-6 w-6 text-[#C8FF00]" />
            <span>Exercise Library</span>
          </h1>
          <p className="text-sm text-[#848E9C]">
            Explore exercises, target muscle groups, and calorie burn estimates.
          </p>
        </div>

        <button
          onClick={() => setShowSubmitModal(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#C8FF00] text-black hover:bg-[#d4ff33] shadow-glow-lime flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Custom Exercise</span>
        </button>
      </div>

      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-[#00D26A]/10 border border-[#00D26A]/30 text-[#00D26A] text-xs flex items-center gap-2.5 shadow-glow-green"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </motion.div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-5 rounded-3xl bg-[#12151b] border border-[#1e232d] space-y-4 shadow-cyber-card">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#848E9C]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exercises by name (e.g. Barbell Squat, Lat Pulldown)..."
            className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-[#848E9C] focus:outline-none transition-colors"
          />
        </div>

        {/* Muscle group filter pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-mono text-[#848E9C] mr-1">Muscle:</span>
          {muscleGroups.map((mg) => (
            <button
              key={mg}
              onClick={() => setSelectedMuscle(mg)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                selectedMuscle === mg
                  ? 'bg-[#C8FF00] text-black shadow-glow-lime'
                  : 'bg-[#07080a] border border-[#1e232d] text-[#848E9C] hover:text-white'
              }`}
            >
              {mg}
            </button>
          ))}
        </div>
      </div>

      {/* Exercises Grid */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="h-8 w-8 border-2 border-[#C8FF00] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#12151b] border border-[#1e232d] text-xs text-[#848E9C]">
          No exercises found matching your filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exercises.map((ex) => (
            <div
              key={ex.id}
              className="p-5 rounded-3xl bg-[#12151b] border border-[#1e232d] shadow-cyber-card hover:border-[#2a313f] transition-all space-y-3 group"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white group-hover:text-[#C8FF00] transition-colors">
                    {ex.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono uppercase bg-[#07080a] border border-[#1e232d] text-[#00E5FF]">
                      {ex.muscle_group}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono uppercase bg-[#07080a] border border-[#1e232d] text-[#848E9C]">
                      {ex.category}
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-[#07080a] border border-[#1e232d] text-right font-mono">
                  <span className="text-[9px] text-[#848E9C] block">MET</span>
                  <span className="text-xs font-bold text-[#C8FF00]">{ex.met_value.toFixed(1)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#1e232d] flex items-center justify-between text-[11px] font-mono text-[#848E9C]">
                <span>Status:</span>
                <span
                  className={
                    ex.status === 'approved'
                      ? 'text-[#00D26A] font-bold'
                      : ex.status === 'pending'
                      ? 'text-[#FFB800] font-bold'
                      : 'text-[#F6465D]'
                  }
                >
                  {ex.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Propose Modal */}
      <AnimatePresence>
        {showSubmitModal && (
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
                  <span>Add New Exercise</span>
                </h3>
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="p-1 text-[#848E9C] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateExercise} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#848E9C]">Exercise Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Incline Smith Machine Press"
                    className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#848E9C]">Target Muscle</label>
                    <select
                      value={muscleGroup}
                      onChange={(e) => setMuscleGroup(e.target.value)}
                      className="w-full bg-[#07080a] border border-[#1e232d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      {muscleGroups.filter((m) => m !== 'All').map((m) => (
                        <option key={m} value={m}>
                          {m.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#848E9C]">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-[#07080a] border border-[#1e232d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="compound">Compound</option>
                      <option value="isolation">Isolation</option>
                      <option value="bodyweight">Bodyweight</option>
                      <option value="cardio">Cardio</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#848E9C]">MET Intensity Value (1.0 - 16.0)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1.0"
                    max="16.0"
                    value={metValue}
                    onChange={(e) => setMetValue(e.target.value)}
                    className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl bg-[#C8FF00] text-black font-bold text-xs hover:bg-[#d4ff33] shadow-glow-lime transition-all"
                  >
                    {submitting ? 'Submitting...' : 'Submit to Coach Moderation'}
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
