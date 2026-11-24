import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { FoodItemSummary, PredictedMacros, RagScanResult } from '../types';
import {
  Compass,
  Sparkles,
  Search,
  Database,
  ShieldAlert,
  Info,
  CheckCircle2,
  UtensilsCrossed,
  HelpCircle,
  Minus,
  Plus,
  X,
  Camera,
} from 'lucide-react';

interface EditableItem {
  query_text: string;
  food: FoodItemSummary | null;
  grams: number;
  confidence: 'high' | 'low' | 'none';
  alternatives: FoodItemSummary[];
  removed: boolean;
}

const macrosFor = (food: FoodItemSummary | null, grams: number): PredictedMacros => {
  if (!food) return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const f = grams / 100;
  return {
    calories: food.kcal_per_100g * f,
    protein_g: food.protein_per_100g * f,
    carbs_g: food.carbs_per_100g * f,
    fat_g: food.fat_per_100g * f,
  };
};

/** Default grams for one serving, read from e.g. "1 cup (158g)". */
const servingGrams = (food: FoodItemSummary): number => {
  const m = food.serving_description.match(/\((\d+(?:\.\d+)?)\s*(?:g|ml)\)/i);
  return m ? parseFloat(m[1]) : 100;
};

/** Downscale a photo to max 1024 px and return it as a JPEG data URL (keeps uploads small). */
const shrinkPhoto = async (file: File): Promise<string> => {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Clear "analysis is done" confirmation, saying what was used (photo, text or both). */
const ScanDoneBanner: React.FC<{ result: RagScanResult; found: number }> = ({ result, found }) => {
  const foods = plural(found, 'food');
  let title = `Meal analyzed: ${foods} found.`;
  let detail = 'Check them below before saving.';
  let warn = false;
  if (result.photo_status === 'used') {
    title = `Photo analyzed: ${foods} found.`;
    if (result.note) {
      const n = result.note_amounts_applied ?? 0;
      detail = n
        ? `Your note was applied; ${plural(n, 'amount')} came from what you typed.`
        : 'Your note was applied. Check the foods below before saving.';
    }
  } else if (result.photo_status === 'no_food') {
    title = `Meal analyzed from your text: ${foods} found.`;
    detail = 'We couldn’t spot any food in the photo, so only what you typed was used.';
    warn = true;
  } else if (result.photo_status === 'unavailable') {
    title = `Meal analyzed from your text: ${foods} found.`;
    detail = 'Photo analysis is unavailable right now, so only what you typed was used.';
    warn = true;
  }
  const tone = warn
    ? 'bg-warning/10 border-warning/30 text-warning'
    : 'bg-success/10 border-success/30 text-success';
  return (
    <div role="status" className={`p-4 rounded-2xl border text-sm flex items-start gap-2.5 ${tone}`}>
      {warn ? <Info className="h-4 w-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-xs opacity-90">{detail}</p>
      </div>
    </div>
  );
};

export const RagNutritionScannerPage: React.FC = () => {
  const [queryInput, setQueryInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<RagScanResult | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null); // JPEG data URL
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const fromPhoto = scanResult?.photo_status === 'used';

  // When an analysis finishes, bring the results into view (they sit below the fold on
  // phones) and move focus there so screen readers announce them.
  useEffect(() => {
    if (!scanResult) return;
    resultsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    resultsRef.current?.focus({ preventScroll: true });
  }, [scanResult]);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('That file is not a photo. Please pick a JPG or PNG image.');
      return;
    }
    try {
      setPhoto(await shrinkPhoto(file));
      setError(null);
    } catch {
      setError('We could not read that photo. Please try another one.');
    }
  };

  const samplePrompts = [
    'Chicken adobo with 1 cup rice and a boiled egg',
    'Sinigang na baboy with 1 cup brown rice',
    '200g grilled chicken breast with broccoli',
    'Tapsilog and a glass of buko juice',
    '2 pandesal and 1 cup oatmeal',
  ];

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo && queryInput.trim().length < 2) {
      setError('Tell us what you ate first, e.g. "1 cup rice and chicken adobo".');
      return;
    }

    setScanning(true);
    setError(null);
    setConfirmedSuccess(false);

    try {
      const result = await api.scanMealRAG(queryInput.trim(), photo?.split(',')[1]);
      if (!Array.isArray(result.items)) {
        // An older API build returns totals only; don't crash, explain instead.
        setScanResult(null);
        setItems([]);
        setError(
          'The server is running an older version of the meal scanner. Please restart the backend and try again.'
        );
        return;
      }
      setScanResult(result);
      setItems(
        result.items.map((it) => ({
          query_text: it.query_text,
          food: it.matched_food,
          grams: it.grams,
          confidence: it.confidence,
          alternatives: it.alternatives ?? [],
          removed: false,
        }))
      );
    } catch (err: any) {
      setError(err.message || 'We could not analyze that meal. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<EditableItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    setConfirmedSuccess(false);
  };

  const swapFood = (idx: number, food: FoodItemSummary) => {
    const current = items[idx];
    const others = [current.food, ...current.alternatives].filter(
      (f): f is FoodItemSummary => !!f && f.id !== food.id
    );
    updateItem(idx, {
      food,
      grams: servingGrams(food),
      confidence: 'high',
      alternatives: others,
    });
  };

  const activeItems = items.filter((it) => !it.removed && it.food && it.grams > 0);

  const totals = useMemo(
    () =>
      activeItems.reduce(
        (acc, it) => {
          const m = macrosFor(it.food, it.grams);
          return {
            calories: acc.calories + m.calories,
            protein_g: acc.protein_g + m.protein_g,
            carbs_g: acc.carbs_g + m.carbs_g,
            fat_g: acc.fat_g + m.fat_g,
          };
        },
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      ),
    [activeItems]
  );

  const needsReview = items.some((it) => !it.removed && it.confidence !== 'high');

  const handleConfirmAndSave = async () => {
    if (!scanResult || activeItems.length === 0) return;
    setConfirming(true);
    setError(null);
    try {
      await api.createNutritionLog({
        meal_name: scanResult.query_input.slice(0, 255),
        total_kcal: Math.round(totals.calories * 10) / 10,
        protein_g: Math.round(totals.protein_g * 10) / 10,
        carbs_g: Math.round(totals.carbs_g * 10) / 10,
        fat_g: Math.round(totals.fat_g * 10) / 10,
        rag_scan_id: scanResult.scan_id,
      });
      setConfirmedSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to save this meal to your food log.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2.5">
          <Compass className="h-6 w-6 text-accent" />
          <span>Smart Meal Scanner</span>
        </h1>
        <p className="text-sm text-muted mt-1">
          Snap a photo of your meal, or type what you ate in English (Filipino dish names and
          words like “kanin” and “tasa” work too). Add amounts
          like “1 cup” or “200g” for a better estimate.
        </p>
      </div>

      {/* Input */}
      <div className="p-4 sm:p-6 rounded-3xl bg-card border border-line space-y-4 shadow-neu">
        <form onSubmit={handleScan} className="space-y-3">
          <label htmlFor="meal-input" className="text-sm font-semibold text-ink flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-accent" /> What did you eat?
          </label>
          {photo ? (
            <div className="relative w-fit">
              <img src={photo} alt="Your meal photo" className="h-32 rounded-2xl border border-line object-cover" />
              <button
                type="button"
                onClick={() => setPhoto(null)}
                aria-label="Remove photo"
                className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-well/80 text-ink hover:text-danger"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-well border border-dashed border-line hover:border-accent text-sm text-soft hover:text-accent flex items-center justify-center gap-2 cursor-pointer focus-within:border-accent transition-colors">
              <Camera className="h-4 w-4" />
              <span>Take or upload a photo</span>
              <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="sr-only" />
            </label>
          )}
          <textarea
            id="meal-input"
            rows={2}
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) handleScan(e);
            }}
            placeholder={
              photo
                ? 'Optional note; it wins over the photo, e.g. "1 cup brown rice, no egg"'
                : 'e.g. chicken adobo with 1 cup rice and a boiled egg'
            }
            className="w-full bg-well border border-line focus:border-accent rounded-2xl px-4 py-3 text-sm text-ink placeholder-muted focus:outline-none resize-none"
          />
          <button
            type="submit"
            disabled={scanning}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-accent text-on-accent font-bold text-sm flex items-center justify-center gap-2 hover:bg-accent-hover shadow-neu-sm transition-all disabled:opacity-50"
          >
            {scanning ? (
              <>
                <div className="h-4 w-4 border-2 border-on-accent border-t-transparent rounded-full animate-spin" />
                <span>{photo ? 'Reading your photo…' : 'Analyzing…'}</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Analyze meal</span>
              </>
            )}
          </button>

          <div className="space-y-2 pt-1">
            <span className="text-xs font-medium text-muted">Or try one of these:</span>
            <div className="flex flex-wrap gap-2">
              {samplePrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setQueryInput(p)}
                  className="text-xs px-3 py-2 rounded-xl bg-well hover:bg-card-hover border border-line text-soft hover:text-accent transition-colors text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-sm flex items-center gap-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {scanResult && !scanning && (
        <div className="animate-rise space-y-4">
          <ScanDoneBanner result={scanResult} found={items.filter((it) => it.food).length} />

          {/* Items */}
          <div className="p-4 sm:p-6 rounded-3xl bg-card border border-line space-y-3 shadow-neu">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 ref={resultsRef} tabIndex={-1} className="text-base font-bold text-ink scroll-mt-4 focus:outline-none">
                  Here’s what we found
                </h2>
                <p className="text-sm text-muted">
                  Check each food and adjust the amount if needed.
                </p>
                {fromPhoto && (
                  <p className="text-xs text-muted mt-1">
                    Photo read as: “{scanResult.photo_description}”
                  </p>
                )}
                {fromPhoto && scanResult.note && (
                  <p className="text-xs text-muted">
                    Your note: “{scanResult.note}” — it takes priority over the photo.
                  </p>
                )}
              </div>
            </div>

            {items.length === 0 && (
              <p className="text-sm text-muted">
                We couldn’t pick out any foods. Try naming them separately, like “rice, adobo, egg”.
              </p>
            )}

            {items.map((it, idx) =>
              it.removed ? null : (
                <div key={idx} className="p-4 rounded-2xl bg-well border border-line space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted">
                        {fromPhoto ? 'Read as' : 'You said'} “{it.query_text}”
                      </p>
                      {it.food ? (
                        <p className="text-sm font-bold text-ink break-words">{it.food.food_name}</p>
                      ) : (
                        <p className="text-sm font-bold text-warning flex items-center gap-1.5">
                          <HelpCircle className="h-4 w-4" /> We couldn’t find this food
                        </p>
                      )}
                      {it.food && (
                        <p className="text-xs text-muted">
                          {it.food.source_dataset} · {it.food.serving_description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => updateItem(idx, { removed: true })}
                      aria-label={`Remove ${it.query_text}`}
                      className="p-2 rounded-lg text-muted hover:text-danger hover:bg-danger/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {it.food && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Decrease amount"
                          onClick={() => updateItem(idx, { grams: Math.max(0, it.grams - 25) })}
                          className="h-10 w-10 rounded-xl bg-card border border-line text-ink flex items-center justify-center"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <label className="sr-only" htmlFor={`grams-${idx}`}>Grams</label>
                        <input
                          id={`grams-${idx}`}
                          type="number"
                          min={0}
                          inputMode="decimal"
                          value={Math.round(it.grams)}
                          onChange={(e) => updateItem(idx, { grams: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-20 h-10 bg-card border border-line rounded-xl text-center text-sm tabular-nums text-ink focus:border-accent focus:outline-none"
                        />
                        <span className="text-sm text-muted">g</span>
                        <button
                          type="button"
                          aria-label="Increase amount"
                          onClick={() => updateItem(idx, { grams: it.grams + 25 })}
                          className="h-10 w-10 rounded-xl bg-card border border-line text-ink flex items-center justify-center"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <span className="text-sm tabular-nums font-bold text-accent">
                        {Math.round(macrosFor(it.food, it.grams).calories)} kcal
                      </span>
                    </div>
                  )}

                  {it.confidence !== 'high' && it.alternatives.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-warning">
                        {it.food ? 'Not quite right? Did you mean:' : 'Did you mean:'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {it.alternatives.map((alt) => (
                          <button
                            key={alt.id}
                            type="button"
                            onClick={() => swapFood(idx, alt)}
                            className="text-xs px-3 py-2 rounded-xl bg-card border border-line text-ink hover:border-accent text-left"
                          >
                            {alt.food_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {/* Totals */}
          <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-br from-card to-well border border-line space-y-4">
            <h2 className="text-base font-bold text-ink">Meal total</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Calories', value: Math.round(totals.calories), unit: 'kcal', color: 'text-accent' },
                { label: 'Protein', value: totals.protein_g.toFixed(1), unit: 'g', color: 'text-info' },
                { label: 'Carbs', value: totals.carbs_g.toFixed(1), unit: 'g', color: 'text-ink' },
                { label: 'Fat', value: totals.fat_g.toFixed(1), unit: 'g', color: 'text-warning' },
              ].map((m) => (
                <div key={m.label} className="p-4 rounded-2xl bg-well border border-line">
                  <span className="text-xs font-medium text-muted">{m.label}</span>
                  <p className={`text-2xl font-black tabular-nums mt-1 ${m.color}`}>
                    {m.value}
                    <span className="text-xs text-muted ml-1">{m.unit}</span>
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted flex items-start gap-1.5">
              <Info className="h-4 w-4 text-accent shrink-0" />
              <span>
                This is a machine-generated estimate based on DOST-FNRI and USDA food data. Please
                review it before saving.
                {fromPhoto && ' Portions read from a photo are rough guesses.'}
                {needsReview && ' Some items need a quick check above.'}
              </span>
            </p>

            {confirmedSuccess && (
              <div className="p-3 rounded-2xl bg-success/10 border border-success/30 text-success text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Saved! Your daily targets have been updated.</span>
              </div>
            )}

            <button
              onClick={handleConfirmAndSave}
              disabled={confirming || confirmedSuccess || activeItems.length === 0}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-accent text-on-accent font-bold text-sm flex items-center justify-center gap-2 shadow-neu-sm hover:bg-accent-hover transition-all disabled:opacity-50"
            >
              <UtensilsCrossed className="h-4 w-4" />
              <span>
                {confirming ? 'Saving…' : confirmedSuccess ? 'Saved to food log' : 'Looks right — save to food log'}
              </span>
            </button>

            <p className="text-xs text-faint flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Match score at scan {Math.round(scanResult.top_similarity_score * 100)}% ·{' '}
              {scanResult.latency_ms.toFixed(0)} ms
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
