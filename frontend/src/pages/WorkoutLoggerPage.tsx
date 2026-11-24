import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  ChevronRight,
  Clock,
  Dumbbell,
  History,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api';
import { Exercise, WorkoutRoutine, WorkoutSession } from '../types';
import { RestTimer } from '../components/workout/RestTimer';
import { ExercisePicker } from '../components/workout/ExercisePicker';
import { Overlay } from '../components/common/Overlay';
import { useDialogs } from '../components/common/DialogProvider';
import {
  ActiveExercise,
  ActiveWorkout,
  DEFAULT_REST_SEC,
  buildLastPerformance,
  exerciseFromHistory,
  formatKg,
  groupSessionSets,
  loadActiveWorkout,
  newKey,
  routineInputFromWorkout,
  saveActiveWorkout,
  workoutFromRoutine,
  workoutFromSession,
} from '../components/workout/workoutState';

type View = 'train' | 'history';
const REST_OPTIONS = [60, 90, 120, 180];

// Ticks on its own so the whole logger page does not re-render every second.
const ElapsedClock: React.FC<{ startedAt: number; className?: string }> = ({ startedAt, className }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{formatClock(Math.floor((now - startedAt) / 1000))}</span>;
};

const formatClock = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

const formatRest = (sec: number) => (sec % 60 === 0 ? `${sec / 60}:00` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);

export const WorkoutLoggerPage: React.FC = () => {
  const { confirm, prompt } = useDialogs();
  const [view, setView] = useState<View>('train');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [workout, setWorkoutState] = useState<ActiveWorkout | null>(() => loadActiveWorkout());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [shareToFeed, setShareToFeed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ session: WorkoutSession; workout: ActiveWorkout } | null>(null);

  const setWorkout = useCallback((next: ActiveWorkout | null | ((w: ActiveWorkout | null) => ActiveWorkout | null)) => {
    setWorkoutState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      saveActiveWorkout(value);
      return value;
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [exRes, sessRes, routineRes] = await Promise.all([
        api.getExercises({ limit: 100 }),
        api.getWorkouts({ limit: 50, only_mine: true }),
        api.getRoutines({ limit: 50 }),
      ]);
      setExercises(exRes.data);
      setSessions(sessRes.data);
      setRoutines(routineRes.data);
    } catch (err: any) {
      setError(err.message || 'We couldn’t load your workouts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const lastPerf = useMemo(() => buildLastPerformance(sessions), [sessions]);

  // ---------------------------------------------------------------- starting
  const begin = (w: ActiveWorkout) => {
    setError(null);
    setNotice(null);
    setSummary(null);
    setWorkout(w);
    setView('train');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEmpty = () =>
    begin({
      title: `Workout ${new Date().toLocaleDateString(undefined, { weekday: 'long' })}`,
      startedAt: Date.now(),
      routineId: null,
      exercises: [],
      restEndsAt: null,
      restTotalSec: 0,
    });

  // ---------------------------------------------------------------- editing
  const updateExercise = (key: string, fn: (ex: ActiveExercise) => ActiveExercise) =>
    setWorkout((w) => (w ? { ...w, exercises: w.exercises.map((ex) => (ex.key === key ? fn(ex) : ex)) } : w));

  const addExercise = (exercise: Exercise) => {
    setWorkout((w) =>
      w ? { ...w, exercises: [...w.exercises, exerciseFromHistory(exercise, lastPerf.get(exercise.id))] } : w
    );
    setPickerOpen(false);
  };

  const updateSet = (exKey: string, setKey: string, patch: Partial<{ weight: number; reps: number }>) =>
    updateExercise(exKey, (ex) => ({
      ...ex,
      sets: ex.sets.map((s) => (s.key === setKey ? { ...s, ...patch } : s)),
    }));

  const toggleDone = (ex: ActiveExercise, setKey: string) => {
    const set = ex.sets.find((s) => s.key === setKey);
    if (!set) return;
    if (!set.done && set.reps < 1) {
      setError('Enter how many reps you did before ticking the set.');
      return;
    }
    setError(null);
    const markingDone = !set.done;
    setWorkout((w) =>
      w
        ? {
            ...w,
            exercises: w.exercises.map((e) =>
              e.key === ex.key ? { ...e, sets: e.sets.map((s) => (s.key === setKey ? { ...s, done: !s.done } : s)) } : e
            ),
            // Rest timer starts automatically when a set is ticked.
            restEndsAt: markingDone && ex.restSec > 0 ? Date.now() + ex.restSec * 1000 : w.restEndsAt,
            restTotalSec: markingDone && ex.restSec > 0 ? ex.restSec : w.restTotalSec,
          }
        : w
    );
  };

  const addSet = (ex: ActiveExercise) => {
    const last = ex.sets[ex.sets.length - 1];
    updateExercise(ex.key, (e) => ({
      ...e,
      sets: [...e.sets, { key: newKey(), weight: last?.weight ?? 0, reps: last?.reps ?? 10, done: false }],
    }));
  };

  const removeSet = (ex: ActiveExercise, setKey: string) =>
    updateExercise(ex.key, (e) => ({ ...e, sets: e.sets.filter((s) => s.key !== setKey) }));

  const removeExercise = (key: string) =>
    setWorkout((w) => (w ? { ...w, exercises: w.exercises.filter((e) => e.key !== key) } : w));

  const cycleRest = (ex: ActiveExercise) => {
    const idx = REST_OPTIONS.indexOf(ex.restSec);
    updateExercise(ex.key, (e) => ({ ...e, restSec: REST_OPTIONS[(idx + 1) % REST_OPTIONS.length] }));
  };

  const adjustRest = useCallback(
    (delta: number) =>
      setWorkout((w) =>
        w && w.restEndsAt ? { ...w, restEndsAt: Math.max(Date.now(), w.restEndsAt + delta * 1000), restTotalSec: Math.max(1, w.restTotalSec + delta) } : w
      ),
    [setWorkout]
  );
  const dismissRest = useCallback(() => setWorkout((w) => (w ? { ...w, restEndsAt: null } : w)), [setWorkout]);

  const discardWorkout = async () => {
    const ok = await confirm({
      title: 'Discard this workout?',
      message: 'Everything you logged so far will be lost.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep training',
      tone: 'danger',
    });
    if (ok) {
      setWorkout(null);
      setFinishOpen(false);
    }
  };

  // ---------------------------------------------------------------- finishing
  const doneSets = workout?.exercises.flatMap((ex) => ex.sets.filter((s) => s.done)) ?? [];
  const totalSets = workout?.exercises.reduce((n, ex) => n + ex.sets.length, 0) ?? 0;

  const openFinish = () => {
    if (!workout) return;
    if (doneSets.length === 0) {
      setError('Tick at least one set (the ✓ button) before finishing.');
      return;
    }
    setError(null);
    setFinishOpen(true);
  };

  const saveWorkout = async () => {
    if (!workout) return;
    const title = workout.title.trim();
    if (title.length < 2) {
      setError('Give your workout a name (at least 2 letters).');
      setFinishOpen(false);
      return;
    }
    setSaving(true);
    try {
      const sets = workout.exercises.flatMap((ex) =>
        ex.sets
          .filter((s) => s.done)
          .map((s, i) => ({ exercise_id: ex.exercise.id, set_no: i + 1, reps: s.reps, weight_kg: s.weight }))
      );
      const session = await api.createWorkout({
        split_title: title,
        duration_min: Math.max(1, Math.round((Date.now() - workout.startedAt) / 60000)),
        is_public: shareToFeed,
        sets,
      });
      setSummary({ session, workout });
      setWorkout(null);
      setFinishOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      loadData();
    } catch (err: any) {
      setError(err.message || 'We couldn’t save your workout. Your sets are still here, so try again.');
      setFinishOpen(false);
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------- routines
  const saveAsRoutine = async (name: string, source: ActiveExercise[], routineId: number | null) => {
    const items = routineInputFromWorkout(source);
    if (!items.length) return;
    try {
      if (routineId) {
        await api.updateRoutine(routineId, { exercises: items });
        setNotice(`Routine “${name}” updated with today’s weights.`);
      } else {
        await api.createRoutine({ name, exercises: items });
        setNotice(`Saved “${name}”. Next time, just tap it to start.`);
      }
      loadData();
    } catch (err: any) {
      setError(err.message || 'Could not save the routine.');
    }
  };

  const promptSaveRoutine = async (defaultName: string, source: ActiveExercise[]) => {
    const name = await prompt({
      title: 'Save as routine',
      message: 'Next time, start this whole workout with one tap.',
      label: 'Routine name',
      initialValue: defaultName,
      confirmLabel: 'Save routine',
      validate: (v) => (v.length < 2 ? 'Routine names need at least 2 letters.' : null),
    });
    if (name) await saveAsRoutine(name, source, null);
  };

  const deleteRoutine = async (r: WorkoutRoutine) => {
    const ok = await confirm({
      title: `Delete “${r.name}”?`,
      message: 'Your past workouts stay. Only this saved routine is removed.',
      confirmLabel: 'Delete routine',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteRoutine(r.id);
      setRoutines((prev) => prev.filter((x) => x.id !== r.id));
    } catch (err: any) {
      setError(err.message || 'Could not delete the routine.');
    }
  };

  const renameRoutine = async (r: WorkoutRoutine) => {
    const name = await prompt({
      title: 'Rename routine',
      label: 'Routine name',
      initialValue: r.name,
      confirmLabel: 'Rename',
      validate: (v) => (v.length < 2 ? 'Routine names need at least 2 letters.' : null),
    });
    if (!name || name === r.name) return;
    try {
      await api.updateRoutine(r.id, { name });
      loadData();
    } catch (err: any) {
      setError(err.message || 'Could not rename the routine.');
    }
  };

  const lastSession = sessions[0];
  const isNewUser = !loading && sessions.length === 0 && routines.length === 0;

  // ================================================================= render
  return (
    <div className="space-y-6 pb-28">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2.5">
            <Dumbbell className="h-6 w-6 text-accent" />
            <span>{workout ? 'Workout in progress' : 'Workouts'}</span>
          </h1>
          {!workout && (
            <p className="text-sm text-muted mt-1">What are you training today?</p>
          )}
        </div>
        {!workout && (
          <div role="tablist" className="flex items-center gap-1 bg-card p-1 rounded-xl border border-line text-sm self-start">
            {(['train', 'history'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`px-4 py-2 rounded-lg font-semibold ${view === v ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'}`}
              >
                {v === 'train' ? 'Train' : `History (${sessions.length})`}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-sm flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss" className="p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {notice && (
        <div className="p-4 rounded-2xl bg-success/10 border border-success/30 text-success text-sm flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ---------------------------------------------------- summary */}
      {summary && !workout && (
        <WorkoutSummary
          summary={summary}
          onSaveRoutine={() =>
            summary.workout.routineId
              ? saveAsRoutine(summary.workout.title, summary.workout.exercises, summary.workout.routineId)
              : promptSaveRoutine(summary.workout.title, summary.workout.exercises)
          }
          onClose={() => setSummary(null)}
        />
      )}

      {/* ---------------------------------------------------- active workout */}
      {workout && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-card border border-line space-y-3">
            <label htmlFor="workout-title" className="text-xs text-muted">
              Workout name
            </label>
            <input
              id="workout-title"
              value={workout.title}
              onChange={(e) => setWorkout((w) => (w ? { ...w, title: e.target.value } : w))}
              className="w-full bg-transparent text-lg font-bold text-ink focus:outline-none border-b border-line focus:border-accent pb-1"
            />
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted">
                <Clock className="h-4 w-4" />
                <ElapsedClock startedAt={workout.startedAt} className="tabular-nums text-ink" />
              </span>
              <span className="text-muted">
                <span className="text-ink font-semibold">{doneSets.length}</span> of {totalSets} sets done
              </span>
            </div>
          </div>

          {workout.exercises.length === 0 && (
            <div className="p-6 rounded-3xl border border-dashed border-line-strong text-center space-y-2">
              <p className="text-ink font-semibold">Let’s add your first exercise</p>
              <p className="text-sm text-muted">
                Pick from the list or create your own. After each set, tap ✓ and your rest timer starts.
              </p>
            </div>
          )}

          {workout.exercises.map((ex) => (
            <div key={ex.key} className="p-4 rounded-3xl bg-card border border-line space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-ink break-words">{ex.exercise.name}</h3>
                  <p className="text-xs text-muted">
                    {ex.lastTime ? `Last time: ${ex.lastTime}` : 'First time logging this one'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => cycleRest(ex)}
                    className="h-9 px-2.5 rounded-lg bg-well border border-line text-xs text-soft"
                    aria-label={`Rest time ${formatRest(ex.restSec)}, tap to change`}
                  >
                    Rest {formatRest(ex.restSec)}
                  </button>
                  <button
                    onClick={() => removeExercise(ex.key)}
                    aria-label={`Remove ${ex.exercise.name}`}
                    className="h-9 w-9 rounded-lg text-muted hover:text-danger flex items-center justify-center"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[2rem_1fr_1fr_2.75rem_1.75rem] gap-2 items-center text-xs text-muted px-1">
                <span>Set</span>
                <span>kg</span>
                <span>Reps</span>
                <span className="text-center">Done</span>
                <span />
              </div>

              {ex.sets.map((s, i) => (
                <div
                  key={s.key}
                  className={`grid grid-cols-[2rem_1fr_1fr_2.75rem_1.75rem] gap-2 items-center rounded-xl px-1 py-1 ${s.done ? 'bg-success/10' : ''}`}
                >
                  <span className="text-sm tabular-nums text-muted text-center">{i + 1}</span>
                  <input
                    aria-label={`Set ${i + 1} weight in kg`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.5}
                    value={s.weight}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => updateSet(ex.key, s.key, { weight: Math.max(0, Number(e.target.value) || 0) })}
                    className="h-11 w-full min-w-0 rounded-xl bg-well border border-line text-center text-base tabular-nums text-ink focus:border-accent focus:outline-none"
                  />
                  <input
                    aria-label={`Set ${i + 1} reps`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={s.reps}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => updateSet(ex.key, s.key, { reps: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    className="h-11 w-full min-w-0 rounded-xl bg-well border border-line text-center text-base tabular-nums text-ink focus:border-accent focus:outline-none"
                  />
                  <button
                    onClick={() => toggleDone(ex, s.key)}
                    aria-pressed={s.done}
                    aria-label={s.done ? `Undo set ${i + 1}` : `Mark set ${i + 1} done`}
                    className={`h-11 w-11 rounded-xl flex items-center justify-center border transition-colors ${
                      s.done ? 'bg-success border-success text-on-accent' : 'bg-well border-line-strong text-muted hover:border-accent'
                    }`}
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => removeSet(ex, s.key)}
                    aria-label={`Remove set ${i + 1}`}
                    className="h-11 w-7 flex items-center justify-center text-faint hover:text-danger"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => addSet(ex)}
                className="w-full h-10 rounded-xl bg-well border border-line text-sm font-semibold text-soft flex items-center justify-center gap-1.5 hover:text-ink"
              >
                <Plus className="h-4 w-4" /> Add set
              </button>
            </div>
          ))}

          <button
            onClick={() => setPickerOpen(true)}
            className="w-full h-12 rounded-2xl border border-accent/40 text-accent font-bold text-sm flex items-center justify-center gap-2 hover:bg-accent/10"
          >
            <Plus className="h-5 w-5" /> Add exercise
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={discardWorkout}
              className="h-12 rounded-2xl bg-card border border-line text-danger font-semibold text-sm"
            >
              Discard
            </button>
            <button
              onClick={openFinish}
              className="h-12 rounded-2xl bg-accent text-on-accent font-bold text-sm shadow-neu-sm"
            >
              Finish workout
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- start screen */}
      {!workout && view === 'train' && (
        <div className="space-y-5">
          {isNewUser && (
            <div className="p-5 rounded-3xl bg-gradient-to-br from-card to-well border border-line space-y-3">
              <p className="text-base font-bold text-ink">New here? It’s 3 steps:</p>
              <ol className="space-y-2 text-sm text-soft list-decimal pl-5">
                <li>Start a workout and add the exercises you’re doing.</li>
                <li>After each set, tap ✓. Your rest timer starts on its own.</li>
                <li>Finish, then save it as a routine so next time is one tap.</li>
              </ol>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={startEmpty}
              className="p-5 rounded-3xl bg-accent text-on-accent text-left flex items-center justify-between gap-3 shadow-neu-sm"
            >
              <span>
                <span className="block text-base font-black">Start empty workout</span>
                <span className="block text-sm opacity-80">Add exercises as you go</span>
              </span>
              <Play className="h-6 w-6 fill-on-accent shrink-0" />
            </button>
            {lastSession && (
              <button
                onClick={() => begin(workoutFromSession(lastSession, lastPerf))}
                className="p-5 rounded-3xl bg-card border border-line text-left flex items-center justify-between gap-3 hover:border-line-strong"
              >
                <span className="min-w-0">
                  <span className="block text-base font-bold text-ink">Repeat last workout</span>
                  <span className="block text-sm text-muted truncate">{lastSession.split_title}</span>
                </span>
                <RotateCcw className="h-5 w-5 text-accent shrink-0" />
              </button>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-bold text-ink">My routines</h2>
            {loading ? (
              <div className="h-24 rounded-3xl bg-card animate-pulse" />
            ) : routines.length === 0 ? (
              <p className="p-5 rounded-3xl bg-card border border-line text-sm text-muted">
                No routines yet. Finish a workout and tap <span className="text-ink font-semibold">Save as routine</span>, or
                save one from your history.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {routines.map((r) => (
                  <div key={r.id} className="p-4 rounded-3xl bg-card border border-line space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-ink break-words">{r.name}</h3>
                        <p className="text-xs text-muted">
                          {r.exercises.length} exercise{r.exercises.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => renameRoutine(r)} className="h-9 px-2 rounded-lg text-xs text-muted hover:text-ink">
                          Rename
                        </button>
                        <button
                          onClick={() => deleteRoutine(r)}
                          aria-label={`Delete ${r.name}`}
                          className="h-9 w-9 rounded-lg text-muted hover:text-danger flex items-center justify-center"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-soft line-clamp-2">
                      {r.exercises.map((e) => e.exercise?.name).filter(Boolean).join(' · ')}
                    </p>
                    <button
                      onClick={() => begin(workoutFromRoutine(r, lastPerf))}
                      className="w-full h-11 rounded-xl bg-accent/10 border border-accent/40 text-accent font-bold text-sm flex items-center justify-center gap-1.5"
                    >
                      Start <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- history */}
      {!workout && view === 'history' && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="p-8 text-center rounded-3xl bg-card border border-line text-sm text-muted space-y-2">
              <History className="h-6 w-6 mx-auto text-faint" />
              <p>Your finished workouts will show up here.</p>
            </div>
          ) : (
            sessions.map((s) => {
              const groups = groupSessionSets(s);
              const prCount = s.sets.filter((x) => x.is_pr).length;
              return (
                <div key={s.id} className="p-4 rounded-3xl bg-card border border-line space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-ink break-words">{s.split_title}</h3>
                      <p className="text-xs text-muted">
                        {new Date(s.session_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
                        {s.duration_min} min · {Math.round(s.burned_kcal)} kcal
                      </p>
                    </div>
                    {prCount > 0 && (
                      <span className="shrink-0 px-2.5 py-1 rounded-full bg-warning/15 text-warning text-xs font-bold flex items-center gap-1">
                        <Award className="h-3.5 w-3.5" /> {prCount} PR{prCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1 text-sm">
                    {groups.map((g) => (
                      <li key={g.name} className="flex justify-between gap-3">
                        <span className="text-ink truncate">
                          {g.name} {g.pr && <Award className="inline h-3.5 w-3.5 text-warning" />}
                        </span>
                        <span className="text-muted tabular-nums shrink-0">
                          {g.sets} × {g.reps}
                          {g.topWeight > 0 ? ` @ ${formatKg(g.topWeight)} kg` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => begin(workoutFromSession(s, lastPerf))}
                      className="h-10 rounded-xl bg-well border border-line text-sm font-semibold text-ink flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="h-4 w-4" /> Do again
                    </button>
                    <button
                      onClick={() => promptSaveRoutine(s.split_title, workoutFromSession(s, lastPerf).exercises)}
                      className="h-10 rounded-xl bg-well border border-line text-sm font-semibold text-ink flex items-center justify-center gap-1.5"
                    >
                      <Save className="h-4 w-4" /> Save as routine
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ---------------------------------------------------- overlays */}
      {workout?.restEndsAt && (
        <RestTimer endsAt={workout.restEndsAt} totalSec={workout.restTotalSec || DEFAULT_REST_SEC} onAdjust={adjustRest} onDismiss={dismissRest} />
      )}

      {pickerOpen && workout && (
        <ExercisePicker
          exercises={exercises}
          alreadyAdded={workout.exercises.map((e) => e.exercise.id)}
          onPick={addExercise}
          onCreated={(ex) => {
            setExercises((prev) => [...prev, ex]);
            addExercise(ex);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {finishOpen && workout && (
        <Overlay>
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="finish-title">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFinishOpen(false)} aria-hidden="true" />
          <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-well border border-line p-5 space-y-4">
            <h2 id="finish-title" className="text-lg font-bold text-ink">
              Finish workout?
            </h2>
            <p className="text-sm text-soft">
              You did <span className="text-ink font-semibold">{doneSets.length}</span> set{doneSets.length === 1 ? '' : 's'} in{' '}
              {formatClock(Math.floor((Date.now() - workout.startedAt) / 1000))}.
              {totalSets > doneSets.length && (
                <span className="block mt-1 text-warning">
                  {totalSets - doneSets.length} set{totalSets - doneSets.length === 1 ? ' isn’t' : 's aren’t'} ticked and won’t be saved.
                </span>
              )}
            </p>
            <label className="flex items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={shareToFeed}
                onChange={(e) => setShareToFeed(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              Share to the community feed
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setFinishOpen(false)} className="h-12 rounded-2xl bg-card border border-line text-ink font-semibold text-sm">
                Keep going
              </button>
              <button
                onClick={saveWorkout}
                disabled={saving}
                className="h-12 rounded-2xl bg-accent text-on-accent font-bold text-sm disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save workout'}
              </button>
            </div>
          </div>
        </div>
        </Overlay>
      )}
    </div>
  );
};

const WorkoutSummary: React.FC<{
  summary: { session: WorkoutSession; workout: ActiveWorkout };
  onSaveRoutine: () => void;
  onClose: () => void;
}> = ({ summary, onSaveRoutine, onClose }) => {
  const { session, workout } = summary;
  const prs = session.sets.filter((s) => s.is_pr);
  const volume = session.sets.reduce((v, s) => v + s.weight_kg * s.reps, 0);
  return (
    <div
      className="animate-rise p-5 rounded-3xl bg-gradient-to-br from-card to-well border border-accent/30 space-y-4"
    >
      <div>
        <p className="text-xl font-black text-ink">Workout saved. Nice job! 💪</p>
        <p className="text-sm text-muted">{session.split_title}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Time', value: `${session.duration_min} min` },
          { label: 'Sets', value: String(session.sets.length) },
          { label: 'Volume', value: `${Math.round(volume).toLocaleString()} kg` },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-2xl bg-well border border-line">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="text-base font-black tabular-nums text-ink">{s.value}</p>
          </div>
        ))}
      </div>
      {prs.length > 0 && (
        <div className="p-3 rounded-2xl bg-warning/10 border border-warning/30 space-y-1">
          <p className="text-sm font-bold text-warning flex items-center gap-1.5">
            <Award className="h-4 w-4" /> New personal record{prs.length > 1 ? 's' : ''}!
          </p>
          {prs.map((p) => (
            <p key={p.id} className="text-sm text-ink">
              {p.exercise?.name}: {formatKg(p.weight_kg)} kg × {p.reps}
            </p>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={onSaveRoutine}
          className="h-11 rounded-xl bg-accent text-on-accent font-bold text-sm flex items-center justify-center gap-1.5"
        >
          <Save className="h-4 w-4" />
          {workout.routineId ? 'Update routine with today’s weights' : 'Save as routine'}
        </button>
        <button onClick={onClose} className="h-11 rounded-xl bg-card border border-line text-ink font-semibold text-sm">
          Done
        </button>
      </div>
    </div>
  );
};
