import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import { Exercise, WorkoutSession, WorkoutSet } from '../types';
import {
  Dumbbell,
  Plus,
  Trash2,
  Award,
  Clock,
  Flame,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Sparkles,
  Zap,
  Timer,
  ChevronRight,
} from 'lucide-react';

export const WorkoutLoggerPage: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'log' | 'history'>('log');

  // Form State
  const [splitTitle, setSplitTitle] = useState('Push Day A - Upper Hypertrophy');
  const [durationMin, setDurationMin] = useState(60);
  const [isPublic, setIsPublic] = useState(true);
  const [sets, setSets] = useState<
    Array<{ exercise_id: number; set_no: number; reps: number; weight_kg: number }>
  >([
    { exercise_id: 1, set_no: 1, reps: 10, weight_kg: 80 },
    { exercise_id: 1, set_no: 2, reps: 8, weight_kg: 95 },
    { exercise_id: 1, set_no: 3, reps: 5, weight_kg: 105 },
  ]);

  // Rest Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let interval: any = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

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
        exercise_id: lastSet ? lastSet.exercise_id : exercises[0]?.id || 1,
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

  const calculate1RM = (weight: number, reps: number) => {
    if (reps <= 0 || weight <= 0) return 0;
    return Math.round(weight * (1 + reps / 30));
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
        setSuccessMsg(`Awesome work! You achieved ${prSets.length} new Personal Record(s)!`);
      } else {
        setSuccessMsg('Workout saved successfully!');
      }

      loadData();
      setActiveTab('history');
    } catch (err: any) {
      setError(err.message || 'Failed to save workout.');
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
            <Dumbbell className="h-6 w-6 text-[#C8FF00]" />
            <span>Workouts & Personal Records</span>
          </h1>
          <p className="text-sm text-[#848E9C]">
            Log your exercises, sets, and reps. We automatically calculate your 1-Rep Max and celebrate new Personal Records.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-[#12151b] p-1 rounded-xl border border-[#1e232d] text-xs">
          <button
            onClick={() => setActiveTab('log')}
            className={`px-4 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'log'
                ? 'bg-[#C8FF00] text-black shadow-glow-lime'
                : 'text-[#848E9C] hover:text-white'
            }`}
          >
            Log Workout
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-[#C8FF00] text-black shadow-glow-lime'
                : 'text-[#848E9C] hover:text-white'
            }`}
          >
            Past Workouts ({sessions.length})
          </button>
        </div>
      </div>

      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-[#00D26A]/10 border border-[#00D26A]/30 text-[#00D26A] text-xs flex items-center gap-2.5 shadow-glow-green"
        >
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </motion.div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-[#F6465D]/10 border border-[#F6465D]/30 text-[#F6465D] text-xs flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'log' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="p-6 rounded-3xl bg-[#12151b] border border-[#1e232d] space-y-4 shadow-cyber-card">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#C8FF00]" />
                  <span>Workout Details</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#848E9C]">Workout Name</label>
                    <input
                      type="text"
                      value={splitTitle}
                      onChange={(e) => setSplitTitle(e.target.value)}
                      placeholder="e.g. Chest & Triceps"
                      className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#848E9C] focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#848E9C]">Duration (minutes)</label>
                    <input
                      type="number"
                      value={durationMin}
                      onChange={(e) => setDurationMin(parseInt(e.target.value) || 0)}
                      min="5"
                      max="300"
                      className="w-full bg-[#07080a] border border-[#1e232d] focus:border-[#C8FF00] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="h-4 w-4 rounded border-[#1e232d] bg-[#07080a] text-[#C8FF00] focus:ring-0"
                  />
                  <label htmlFor="isPublic" className="text-xs text-[#848E9C]">
                    Share to Club Community Feed
                  </label>
                </div>
              </div>

              {/* Set Matrix Table */}
              <div className="p-6 rounded-3xl bg-[#12151b] border border-[#1e232d] space-y-4 shadow-cyber-card">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Award className="h-4 w-4 text-[#C8FF00]" />
                    <span>Exercises & Sets</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddSet}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#181c24] hover:bg-[#222733] text-[#C8FF00] border border-[#C8FF00]/30 flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Set</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {sets.map((set, idx) => {
                    const est1RM = calculate1RM(set.weight_kg, set.reps);
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-[#07080a] border border-[#1e232d] flex flex-wrap sm:flex-nowrap items-center gap-3 transition-colors hover:border-[#2a313f]"
                      >
                        <span className="text-xs font-mono font-bold text-[#848E9C] w-6 text-center">
                          #{set.set_no}
                        </span>

                        <div className="flex-1 min-w-[140px]">
                          <select
                            value={set.exercise_id}
                            onChange={(e) =>
                              handleUpdateSet(idx, 'exercise_id', parseInt(e.target.value))
                            }
                            className="w-full bg-[#12151b] border border-[#1e232d] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#C8FF00]"
                          >
                            {exercises.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                {ex.name} ({ex.muscle_group})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-24">
                          <div className="flex items-center bg-[#12151b] border border-[#1e232d] rounded-xl px-2 py-1">
                            <input
                              type="number"
                              value={set.weight_kg}
                              onChange={(e) =>
                                handleUpdateSet(idx, 'weight_kg', parseFloat(e.target.value) || 0)
                              }
                              step="0.5"
                              min="0"
                              className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
                            />
                            <span className="text-[10px] text-[#848E9C] font-mono">kg</span>
                          </div>
                        </div>

                        <div className="w-20">
                          <div className="flex items-center bg-[#12151b] border border-[#1e232d] rounded-xl px-2 py-1">
                            <input
                              type="number"
                              value={set.reps}
                              onChange={(e) =>
                                handleUpdateSet(idx, 'reps', parseInt(e.target.value) || 0)
                              }
                              min="1"
                              className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
                            />
                            <span className="text-[10px] text-[#848E9C] font-mono">reps</span>
                          </div>
                        </div>

                        <div className="w-20 text-center">
                          <span className="text-[10px] font-mono text-[#00E5FF] font-semibold">
                            ~{est1RM}kg 1RM
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSet(idx)}
                          disabled={sets.length === 1}
                          className="p-1.5 text-[#848E9C] hover:text-[#F6465D] hover:bg-[#F6465D]/10 rounded-lg transition-colors disabled:opacity-30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-2xl bg-[#C8FF00] text-black font-bold text-sm tracking-wide hover:bg-[#d4ff33] shadow-glow-lime transition-all disabled:opacity-50"
                  >
                    {submitting ? 'Saving Workout & Checking PRs...' : 'Save Workout'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Right Rail: Rest Stopwatch & Auto 1RM Formula */}
          <div className="space-y-6">
            {/* Rest Timer */}
            <div className="p-6 rounded-3xl bg-[#12151b] border border-[#1e232d] space-y-4 shadow-cyber-card text-center">
              <div className="flex items-center justify-between text-xs text-[#848E9C]">
                <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Timer className="h-4 w-4 text-[#C8FF00]" /> Rest Timer
                </span>
                <span className={`h-2 w-2 rounded-full ${timerRunning ? 'bg-[#00D26A] animate-pulse' : 'bg-[#848E9C]'}`} />
              </div>

              <div className="py-2">
                <span className="text-4xl font-black font-mono text-white tracking-tight">
                  {Math.floor(timerSeconds / 60)
                    .toString()
                    .padStart(2, '0')}
                  :
                  {(timerSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setTimerRunning(!timerRunning)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    timerRunning
                      ? 'bg-[#F6465D] text-white shadow-glow-red'
                      : 'bg-[#C8FF00] text-black shadow-glow-lime'
                  }`}
                >
                  {timerRunning ? 'Pause' : 'Start Rest'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setTimerSeconds(0);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#181c24] text-[#848E9C] hover:text-white border border-[#1e232d]"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* 1RM Mechanics Card */}
            <div className="p-6 rounded-3xl bg-[#12151b] border border-[#1e232d] space-y-3 shadow-cyber-card">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-[#C8FF00]" /> How PRs Are Calculated
              </h4>
              <p className="text-[11px] text-[#848E9C] leading-relaxed">
                Your estimated 1-Rep Max (1RM) is automatically calculated on each set using the standard strength formula:
              </p>
              <div className="p-2.5 rounded-xl bg-[#07080a] border border-[#1e232d] text-center font-mono text-xs text-[#00E5FF]">
                1RM = Weight &times; (1 + Reps / 30)
              </div>
              <p className="text-[10px] text-[#848E9C]">
                Whenever your lift beats your previous personal best, an official Personal Record (PR) is automatically saved!
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* History View */
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#12151b] border border-[#1e232d] text-xs text-[#848E9C]">
              No workouts logged yet. Switch to "Log Workout" to track your first training session.
            </div>
          ) : (
            sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-6 rounded-3xl bg-[#12151b] border border-[#1e232d] space-y-4 shadow-cyber-card hover:border-[#2a313f] transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{sess.split_title}</span>
                      {sess.sets.some((s) => s.is_pr) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#C8FF00]/15 text-[#C8FF00] border border-[#C8FF00]/30 shadow-glow-lime">
                          NEW PR
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-[#848E9C]">
                      {new Date(sess.session_date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="flex items-center gap-1 text-[#848E9C]">
                      <Clock className="h-3.5 w-3.5" /> {sess.duration_min} min
                    </span>
                    <span className="flex items-center gap-1 text-[#C8FF00] font-bold">
                      <Flame className="h-3.5 w-3.5" /> +{Math.round(sess.burned_kcal)} kcal
                    </span>
                  </div>
                </div>

                {/* Sets Pill Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                  {sess.sets.map((st) => (
                    <div
                      key={st.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        st.is_pr
                          ? 'bg-[#C8FF00]/10 border-[#C8FF00]/40 text-[#C8FF00]'
                          : 'bg-[#07080a] border-[#1e232d] text-[#848E9C]'
                      }`}
                    >
                      <span className="font-semibold text-white truncate max-w-[130px]">
                        {st.exercise?.name || 'Exercise'}
                      </span>
                      <span className="font-mono">
                        {st.weight_kg}kg &times; {st.reps}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
