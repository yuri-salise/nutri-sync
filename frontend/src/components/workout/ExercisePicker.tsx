import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, X, Check } from 'lucide-react';
import { api } from '../../services/api';
import { Overlay } from '../common/Overlay';
import { Exercise } from '../../types';

export const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full body', 'cardio'];

interface ExercisePickerProps {
  exercises: Exercise[];
  alreadyAdded: number[];
  onPick: (exercise: Exercise) => void;
  onCreated: (exercise: Exercise) => void;
  onClose: () => void;
}

/** Bottom sheet for adding an exercise, with inline "create your own". */
export const ExercisePicker: React.FC<ExercisePickerProps> = ({
  exercises,
  alreadyAdded,
  onPick,
  onCreated,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newMuscle, setNewMuscle] = useState('chest');
  const [newCategory, setNewCategory] = useState<'compound' | 'isolation'>('compound');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises
      .filter((e) => (!muscle || e.muscle_group === muscle) && (!q || e.name.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.status === 'private') - Number(a.status === 'private') || a.name.localeCompare(b.name));
  }, [exercises, query, muscle]);

  const exactMatch = exercises.some((e) => e.name.toLowerCase() === query.trim().toLowerCase());

  const handleCreate = async () => {
    const name = query.trim();
    if (name.length < 2) {
      setError('Give your exercise a name (at least 2 letters).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await api.createExercise({
        name,
        muscle_group: newMuscle,
        category: newCategory,
        met_value: newCategory === 'compound' ? 6 : 4,
      });
      onCreated(created);
    } catch (err: any) {
      setError(err.message || 'Could not add that exercise.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-lg max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-well border border-line">
        <div className="p-4 border-b border-line space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="picker-title" className="text-base font-bold text-ink">
              Add an exercise
            </h2>
            <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-muted hover:text-ink">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <label htmlFor="exercise-search" className="sr-only">Search exercises</label>
            <input
              id="exercise-search"
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCreating(false);
              }}
              placeholder="Search, e.g. squat"
              className="w-full h-11 pl-9 pr-3 rounded-xl bg-well border border-line text-sm text-ink placeholder-muted focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {[null, ...MUSCLE_GROUPS].map((m) => (
              <button
                key={m ?? 'all'}
                onClick={() => setMuscle(m)}
                aria-pressed={muscle === m}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold capitalize border ${
                  muscle === m
                    ? 'bg-accent text-on-accent border-accent'
                    : 'bg-well text-soft border-line'
                }`}
              >
                {m ?? 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.map((e) => {
            const added = alreadyAdded.includes(e.id);
            return (
              <button
                key={e.id}
                onClick={() => onPick(e)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-card text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink truncate">{e.name}</span>
                  <span className="block text-xs text-muted capitalize">
                    {e.muscle_group}
                    {e.status === 'private' && ' · your exercise'}
                  </span>
                </span>
                {added ? (
                  <span className="text-xs text-muted flex items-center gap-1 shrink-0">
                    <Check className="h-3.5 w-3.5" /> Added
                  </span>
                ) : (
                  <Plus className="h-4 w-4 text-accent shrink-0" />
                )}
              </button>
            );
          })}

          {filtered.length === 0 && !query && (
            <p className="p-4 text-sm text-muted">No exercises for this muscle yet.</p>
          )}

          {query.trim().length >= 2 && !exactMatch && (
            <div className="m-2 p-4 rounded-2xl bg-card border border-dashed border-line-strong space-y-3">
              {!creating ? (
                <button onClick={() => setCreating(true)} className="w-full text-left text-sm text-ink">
                  {filtered.length === 0 ? 'Can’t find it? ' : ''}Add{' '}
                  <span className="font-bold text-accent">“{query.trim()}”</span> as your own exercise
                </button>
              ) : (
                <>
                  <p className="text-sm text-ink">
                    New exercise: <span className="font-bold">{query.trim()}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-muted space-y-1">
                      <span>Muscle</span>
                      <select
                        value={newMuscle}
                        onChange={(e) => setNewMuscle(e.target.value)}
                        className="w-full h-10 rounded-xl bg-well border border-line text-sm text-ink px-2 capitalize"
                      >
                        {MUSCLE_GROUPS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-muted space-y-1">
                      <span>Type</span>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as 'compound' | 'isolation')}
                        className="w-full h-10 rounded-xl bg-well border border-line text-sm text-ink px-2"
                      >
                        <option value="compound">Multi-joint</option>
                        <option value="isolation">Single-joint</option>
                      </select>
                    </label>
                  </div>
                  {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                  <button
                    onClick={handleCreate}
                    disabled={saving}
                    className="w-full h-11 rounded-xl bg-accent text-on-accent font-bold text-sm disabled:opacity-50"
                  >
                    {saving ? 'Adding…' : 'Add and use it'}
                  </button>
                  <p className="text-xs text-muted">Only you can see your custom exercises.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </Overlay>
  );
};
