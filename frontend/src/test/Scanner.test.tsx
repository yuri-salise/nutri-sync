import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RagNutritionScannerPage } from '../pages/RagNutritionScannerPage';
import { api } from '../services/api';
import type { RagScanResult } from '../types';

vi.mock('../services/api', () => ({
  api: { scanMealRAG: vi.fn(), createNutritionLog: vi.fn() },
}));

const adobo = {
  id: 1,
  food_name: 'Adobong Manok (Chicken Adobo)',
  source_dataset: 'FNRI',
  kcal_per_100g: 185,
  protein_per_100g: 22.4,
  carbs_per_100g: 2.8,
  fat_per_100g: 9.2,
  serving_description: '1 portion',
};

const result = (extra: Partial<RagScanResult>): RagScanResult => ({
  scan_id: 5,
  query_input: '120g chicken adobo',
  is_machine_generated: true,
  requires_human_confirmation: true,
  used_fallback: true,
  latency_ms: 12,
  top_similarity_score: 0.9,
  predicted_macros: { calories: 222, protein_g: 26.9, carbs_g: 3.4, fat_g: 11 },
  items: [
    {
      query_text: '120g chicken adobo',
      matched_food: adobo,
      grams: 120,
      macros: { calories: 222, protein_g: 26.9, carbs_g: 3.4, fat_g: 11 },
      match_score: 0.9,
      confidence: 'high',
      alternatives: [],
    },
  ],
  unmatched: [],
  retrieved_items: [adobo],
  model_version: 'test',
  ...extra,
});

const analyze = async (text: string) => {
  render(<RagNutritionScannerPage />);
  fireEvent.change(screen.getByLabelText(/what did you eat/i), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /analyze meal/i }));
  return screen.findByRole('status');
};

describe('meal scanner confirmation', () => {
  beforeEach(() => vi.mocked(api.scanMealRAG).mockReset());

  it('says the analysis is done and how many foods were found', async () => {
    vi.mocked(api.scanMealRAG).mockResolvedValue(result({}));
    const banner = await analyze('120g chicken adobo');
    expect(banner).toHaveTextContent('Meal analyzed: 1 food found.');
  });

  it('confirms a photo + note analysis and that typed amounts were used', async () => {
    vi.mocked(api.scanMealRAG).mockResolvedValue(
      result({
        photo_status: 'used',
        photo_description: '200g chicken adobo',
        note: 'I only had 120g chicken adobo',
        note_amounts_applied: 1,
      })
    );
    const banner = await analyze('I only had 120g chicken adobo');
    expect(banner).toHaveTextContent('Photo analyzed: 1 food found.');
    expect(banner).toHaveTextContent('1 amount came from what you typed');
    expect(screen.getByText(/takes priority over the photo/i)).toBeInTheDocument();
  });

  it('says when the photo could not be used and the text was analyzed instead', async () => {
    vi.mocked(api.scanMealRAG).mockResolvedValue(result({ photo_status: 'unavailable' }));
    const banner = await analyze('120g chicken adobo');
    expect(banner).toHaveTextContent('from your text');
    expect(banner).toHaveTextContent('Photo analysis is unavailable right now');
  });
});
