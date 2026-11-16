import { Exercise, WorkoutRoutine, WorkoutSession } from '../../types';

export interface ActiveSet {
  key: string;
  weight: number;
  reps: number;
  done: boolean;
}

export interface ActiveExercise {
  key: string;
  exercise: Exercise;
  restSec: number;
  sets: ActiveSet[];
  /** e.g. "3 × 8 @ 80 kg" from the last time this exercise was logged */
  lastTime?: string;
}

export interface ActiveWorkout {
  title: string;
  startedAt: number;
  routineId: number | null;
  exercises: ActiveExercise[];
  restEndsAt: number | null;
  restTotalSec: number;
}

export interface LastPerformance {
  sets: { weight: number; reps: number }[];
  label: string;
}

const STORAGE_KEY = 'nutrisync_active_workout';
export const DEFAULT_REST_SEC = 90;

let keyCounter = 0;
export const newKey = () => `${Date.now().toString(36)}-${(keyCounter++).toString(36)}`;

export function loadActiveWorkout(): ActiveWorkout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveWorkout;
    return parsed && Array.isArray(parsed.exercises) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveActiveWorkout(w: ActiveWorkout | null) {
  try {
    if (w) localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode): the workout just won't survive a reload */
  }
}

/** Most recent sets per exercise, from newest to oldest sessions. */
export function buildLastPerformance(sessions: WorkoutSession[]): Map<number, LastPerformance> {
  const map = new Map<number, LastPerformance>();
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
  );
  for (const s of sorted) {
    const byEx = new Map<number, { weight: number; reps: number }[]>();
    for (const set of [...s.sets].sort((a, b) => a.set_no - b.set_no)) {
      const list = byEx.get(set.exercise_id) ?? [];
      list.push({ weight: set.weight_kg, reps: set.reps });
      byEx.set(set.exercise_id, list);
    }
    byEx.forEach((sets, exId) => {
      if (map.has(exId)) return;
      const top = sets.reduce((m, x) => (x.weight > m.weight ? x : m), sets[0]);
      map.set(exId, {
        sets,
        label: `${sets.length} × ${top.reps}${top.weight > 0 ? ` @ ${formatKg(top.weight)} kg` : ''}`,
      });
    });
  }
  return map;
}

export function formatKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
}

export function exerciseFromHistory(
  exercise: Exercise,
  last: LastPerformance | undefined,
  restSec = DEFAULT_REST_SEC
): ActiveExercise {
  const sets: ActiveSet[] = last
    ? last.sets.map((s) => ({ key: newKey(), weight: s.weight, reps: s.reps, done: false }))
    : Array.from({ length: 3 }, () => ({ key: newKey(), weight: 0, reps: 10, done: false }));
  return { key: newKey(), exercise, restSec, sets, lastTime: last?.label };
}

export function workoutFromRoutine(
  routine: WorkoutRoutine,
  lastPerf: Map<number, LastPerformance>
): ActiveWorkout {
  return {
    title: routine.name,
    startedAt: Date.now(),
    routineId: routine.id,
    restEndsAt: null,
    restTotalSec: 0,
    exercises: routine.exercises
      .filter((re) => re.exercise)
      .map((re) => {
        const last = lastPerf.get(re.exercise_id);
        // Start from last time's working weight when there is one, so progress carries over.
        const lastTop = last ? Math.max(...last.sets.map((s) => s.weight)) : 0;
        const weight = lastTop > 0 ? lastTop : re.target_weight_kg;
        return {
          key: newKey(),
          exercise: re.exercise!,
          restSec: re.rest_sec,
          lastTime: last?.label,
          sets: Array.from({ length: re.target_sets }, () => ({
            key: newKey(),
            weight,
            reps: re.target_reps,
            done: false,
          })),
        };
      }),
  };
}

export function workoutFromSession(
  session: WorkoutSession,
  lastPerf: Map<number, LastPerformance>
): ActiveWorkout {
  const order: number[] = [];
  const byEx = new Map<number, { exercise: Exercise; sets: ActiveSet[] }>();
  for (const s of [...session.sets].sort((a, b) => a.set_no - b.set_no)) {
    if (!s.exercise) continue;
    if (!byEx.has(s.exercise_id)) {
      order.push(s.exercise_id);
      byEx.set(s.exercise_id, { exercise: s.exercise, sets: [] });
    }
    byEx.get(s.exercise_id)!.sets.push({ key: newKey(), weight: s.weight_kg, reps: s.reps, done: false });
  }
  return {
    title: session.split_title,
    startedAt: Date.now(),
    routineId: null,
    restEndsAt: null,
    restTotalSec: 0,
    exercises: order.map((id) => ({
      key: newKey(),
      exercise: byEx.get(id)!.exercise,
      restSec: DEFAULT_REST_SEC,
      sets: byEx.get(id)!.sets,
      lastTime: lastPerf.get(id)?.label,
    })),
  };
}

/** Routine targets taken from what was actually done in a workout. */
export function routineInputFromWorkout(exercises: ActiveExercise[]) {
  return exercises
    .map((ex) => {
      const done = ex.sets.filter((s) => s.done);
      const sets = done.length ? done : ex.sets;
      if (!sets.length) return null;
      const top = sets.reduce((m, s) => (s.weight > m.weight ? s : m), sets[0]);
      return {
        exercise_id: ex.exercise.id,
        target_sets: sets.length,
        target_reps: Math.max(1, top.reps),
        target_weight_kg: Math.max(0, top.weight),
        rest_sec: ex.restSec,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export function groupSessionSets(session: WorkoutSession) {
  const groups = new Map<number, { name: string; sets: number; topWeight: number; reps: number; pr: boolean }>();
  for (const s of session.sets) {
    const g = groups.get(s.exercise_id) ?? {
      name: s.exercise?.name ?? 'Exercise',
      sets: 0,
      topWeight: 0,
      reps: s.reps,
      pr: false,
    };
    g.sets += 1;
    if (s.weight_kg >= g.topWeight) {
      g.topWeight = s.weight_kg;
      g.reps = s.reps;
    }
    g.pr = g.pr || s.is_pr;
    groups.set(s.exercise_id, g);
  }
  return [...groups.values()];
}
