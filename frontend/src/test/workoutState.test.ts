import { describe, expect, it } from 'vitest';
import { Exercise, WorkoutRoutine, WorkoutSession } from '../types';
import {
  buildLastPerformance,
  routineInputFromWorkout,
  workoutFromRoutine,
} from '../components/workout/workoutState';

const bench: Exercise = {
  id: 1,
  name: 'Barbell Bench Press',
  category: 'compound',
  muscle_group: 'chest',
  met_value: 6,
  status: 'approved',
  created_at: '2026-11-01T00:00:00Z',
};

const session = (date: string, weights: number[]): WorkoutSession => ({
  id: Math.random(),
  user_id: 1,
  split_title: 'Push',
  duration_min: 60,
  burned_kcal: 300,
  is_public: true,
  session_date: date,
  created_at: date,
  sets: weights.map((w, i) => ({
    exercise_id: 1,
    set_no: i + 1,
    reps: 8,
    weight_kg: w,
    is_pr: false,
    exercise: bench,
  })),
});

describe('workout state helpers', () => {
  it('uses the most recent session for "last time"', () => {
    const perf = buildLastPerformance([
      session('2026-11-01T10:00:00Z', [60, 60]),
      session('2026-11-10T10:00:00Z', [70, 75, 75]),
    ]);
    expect(perf.get(1)?.label).toBe('3 × 8 @ 75 kg');
  });

  it('starts a routine pre-filled, carrying over last time’s weight', () => {
    const routine: WorkoutRoutine = {
      id: 9,
      user_id: 1,
      name: 'Push Day',
      created_at: '',
      updated_at: '',
      exercises: [
        { id: 1, exercise_id: 1, position: 1, target_sets: 4, target_reps: 6, target_weight_kg: 60, rest_sec: 120, exercise: bench },
      ],
    };
    const fresh = workoutFromRoutine(routine, new Map());
    expect(fresh.exercises[0].sets).toHaveLength(4);
    expect(fresh.exercises[0].sets[0]).toMatchObject({ weight: 60, reps: 6, done: false });
    expect(fresh.exercises[0].restSec).toBe(120);

    const withHistory = workoutFromRoutine(routine, buildLastPerformance([session('2026-11-10T10:00:00Z', [80])]));
    expect(withHistory.exercises[0].sets[0].weight).toBe(80);
  });

  it('builds routine targets from the sets that were actually done', () => {
    const items = routineInputFromWorkout([
      {
        key: 'a',
        exercise: bench,
        restSec: 90,
        sets: [
          { key: '1', weight: 60, reps: 8, done: true },
          { key: '2', weight: 65, reps: 6, done: true },
          { key: '3', weight: 70, reps: 3, done: false },
        ],
      },
    ]);
    expect(items).toEqual([
      { exercise_id: 1, target_sets: 2, target_reps: 6, target_weight_kg: 65, rest_sec: 90 },
    ]);
  });
});
