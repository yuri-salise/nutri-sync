# Evaluation

## Files in this folder

| File | What it is |
| :--- | :--- |
| `scanner_eval_results.csv` | Per-meal results for the 28-meal tuned set (`backend/app/scripts/data/scanner_eval_set.csv`). The matcher was tuned while looking at this set, so its scores are optimistic. |
| `scanner_holdout_results.csv` | Per-meal results for the 32-meal held-out set (`scanner_holdout_set.csv`). Expected foods were written from the tables before the scanner was run on it; failures were inspected afterwards. |
| `scanner_third_results.csv` | Per-meal results for the 33-meal third set (`scanner_third_set.csv`), written before the latest matcher fixes; some errors were inspected afterwards. |
| `weighed_meals_template.csv` | Empty template (header only) for real weighed meals, see below. |

Regenerate the results from `backend/`:

```bash
python -m app.scripts.evaluate_scanner --csv-out ../docs/evaluation/scanner_eval_results.csv
python -m app.scripts.evaluate_scanner --eval-set app/scripts/data/scanner_holdout_set.csv --csv-out ../docs/evaluation/scanner_holdout_results.csv
python -m app.scripts.evaluate_scanner --eval-set app/scripts/data/scanner_third_set.csv --csv-out ../docs/evaluation/scanner_third_results.csv
```

Add `--semantic-weight 0` to score on words only (the no-embedding baseline). The full tables, the embedding comparison and the limits are in [D1 chapter 6](../01-system-documentation/06-testing-and-evaluation.md).

## What the scores mean

- **Family precision / recall:** a hit when the scanner finds the right food in any variant (raw or cooked broccoli both count).
- **Exact entry:** a hit only for the specific table row that was expected.
- **Calorie error (MAPE):** compared with reference calories computed from the same food tables and the expected grams. It measures parsing, matching and portion estimates, not mistakes inside the tables.

## Not collected yet

No System Usability Scale, ISO/IEC 25010 or RAG-versus-no-RAG benchmark data exists in this repository. Do not report numbers for them until real responses and runs are added here.

## Measuring real accuracy with weighed meals

The two scanner sets use expected portions that were written, not measured. To measure accuracy against real meals:

1. Cook or plate a meal and weigh each food on a kitchen scale (grams, as eaten).
2. Write what you would type into the scanner as `meal`, e.g. `chicken adobo with 1 cup rice and an egg`.
3. Write `expected_items` as `Food name exactly as in the table=grams`, separated by `;`, e.g. `Adobong Manok (Chicken Adobo)=135;Cooked White Rice (Bigas Puti)=170;Egg, whole, cooked, fried=46`. Food names must match a row in `fnri_food_composition.csv` or `usda_food_composition.csv`; the evaluator stops with a list of unknown names if one does not.
4. Save the meals to a copy of `weighed_meals_template.csv` and run:

```bash
python -m app.scripts.evaluate_scanner --eval-set ../docs/evaluation/my_weighed_meals.csv
```

Aim for at least 30 meals, and write the expected foods before running the scanner. Keep in mind that the food tables are taken as correct, so the result includes the scanner's food and portion errors but not errors in the tables.
