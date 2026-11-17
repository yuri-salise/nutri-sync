# Chapter 6 (draft): Testing and evaluation

All numbers below were produced by commands in this repository on 2026-11-17 and 2026-11-18. Where something was **not** measured, it says so.

## 6.1 Test plan and results

| Level | Tool | What it covers | Result |
| :--- | :--- | :--- | :--- |
| Backend unit and API | pytest, pytest-asyncio, httpx | Auth, workouts, routines, exercises, activities, nutrition logs, scanner, community, health, data isolation, meal matcher | **45 tests pass** |
| Backend coverage | pytest-cov | Line coverage of `backend/app` | **78%** (CI fails below 60%) |
| Frontend component | Vitest, Testing Library | Login, activity detail, dialogs, GPS maths, workout state, activity helpers | **29 tests pass** (7 files) |
| End-to-end | Playwright (Chromium) | Login errors and redirects, roles, scan a meal, open an activity, 360 px layout on 7 pages | **16 tests pass** against the full Docker Compose stack |
| Static checks | ruff, ESLint, `tsc` | Style and types | No findings |
| CI | GitHub Actions | Lint and tests on pull requests; deploy and health check on `main`; separate e2e job | Green on the latest deploy |

Known gaps: line coverage of some API modules is low (`workout_sessions` 46%, `nutrition_logs` 46%, `rag_nutrition` 51%), so not every endpoint has both a success and a failure test (requirement Q1). No load test was run. The full per-test case table with pass/fail (appendix C) must be exported from the test runs **[PEOPLE]**.

## 6.2 Evaluation of the technology integration (requirement T5)

**What is evaluated:** given a free-text meal such as "chicken adobo with 1 cup rice and a boiled egg", does the scanner find the right foods, and how close is its calorie total?

**Metrics**

- *Family precision and recall:* an item counts as correct when the scanner picks the same food as expected in any variant (for example raw or cooked broccoli).
- *Exact-entry precision and recall:* the scanner must pick the specific table row.
- *Calorie MAPE:* mean absolute percentage error of the meal's total calories against a reference total.
- *Protein MAE (g):* mean absolute error of protein per meal.
- *Latency:* matching time per meal (no network or database).

**How the reference is built.** Each test meal lists the expected foods (exact table names) and the grams eaten. The reference calories are those foods' values from the same tables. So the calorie error measures *parsing, food choice and portion estimates*; it does **not** measure errors inside the food tables, and no meal was weighed on a scale.

**Test sets**

| Set | Meals | How it was made | Caution |
| :--- | :---: | :--- | :--- |
| Tuned (`scanner_eval_set.csv`) | 28 | Written first; the matcher was developed while looking at it. | Optimistic. |
| Held-out (`scanner_holdout_set.csv`) | 32 | Expected foods written from the tables before the scanner was run on it. | Its failures were inspected afterwards and used to improve the matcher, so it is no longer untouched. |
| Third (`scanner_third_set.csv`) | 33 | Written before the latest matcher fixes. | After its first run, the meals with large calorie errors were inspected to find general bugs (default portions of whole heads, "on" as a connector, "scoop"), so it is no longer untouched either. |

**Results (current code, default settings)**

| Set | Family precision / recall | Exact precision / recall | Calorie MAPE | Protein MAE | Latency per meal |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Tuned (28) | 89.1% / 89.1% | 76.4% / 76.4% | 7.8% | 3.1 g | 58 ms |
| Held-out (32) | 87.5% / 87.5% | 65.6% / 65.6% | 13.8% | 1.3 g | 51 ms |
| Third (33) | 88.7% / 88.7% | 74.2% / 74.2% | 8.6% | 2.8 g | 51 ms |

On the live site, the matcher takes about 20 ms per scan once warm; the first scan after a deploy takes 1 to 2 seconds while the index is built.

**Progress, to show the effect of each change** (family recall / calorie MAPE)

| Stage | Held-out | Third |
| :--- | :---: | :---: |
| First measurement (family grading as first written, which treated raw and cooked as different foods) | 76.6% / 33.4% | 90.3% / 36.8% |
| Same code after the grading was corrected to ignore preparation words | 84.4% / 33.4% | n/a |
| After the head-noun bonus, the boilerplate fix and portion-aware grams | 87.5% / 22.3% | n/a |
| After off-form and dry-staple rules and the portion/connector fixes (**current**) | 87.5% / 13.8% | 88.7% / 8.6% |

On the third set, family recall fell by 1.6 points (90.3% to 88.7%) while calorie error fell from 36.8% to 8.6%.

**What each embedding choice does** (family recall / calorie MAPE; semantic weight 0.2 unless stated)

| Variant | Tuned | Held-out | Third |
| :--- | :---: | :---: | :---: |
| Words only (semantic weight 0): the no-embedding baseline | 85.5% / 10.8% | 89.1% / 14.9% | 88.7% / 8.8% |
| Built-in hash embedding (**used in production**) | 89.1% / 7.8% | 87.5% / 13.8% | 88.7% / 8.6% |
| Real `all-MiniLM-L6-v2` (sentence-transformers 6.3, CPU torch) | 87.3% / 16.8% | 87.5% / 16.6% | 91.9% / 10.2% |

The real neural model did not improve calorie accuracy, was about twice as slow (95 to 105 ms per meal), and would add a large dependency to the Docker image, so it was **not adopted**. This is a measured result on these sets only.

**Limitations (threats to validity)**

1. The reference values come from the same tables the scanner reads. Real accuracy needs weighed meals (procedure in [docs/evaluation/README.md](../evaluation/README.md)); none have been collected.
2. All three sets have now influenced the matcher. Only a fresh set written and frozen before testing is a clean estimate.
3. Most expected foods are Filipino dishes the FNRI table covers (101 entries) plus common USDA foods. Dishes absent from both tables are reported as "not found" and add no calories.
4. When the user gives no amount, the scanner assumes one default serving, which can differ a lot from what was eaten. The screen lets the user edit grams before saving.
5. Photo analysis is not part of `main` and was not evaluated.

## 6.3 Usability and quality evaluation (SUS and ISO/IEC 25010)

**No data has been collected.** The guidelines require at least 5 target users, the 10-item SUS questionnaire and a 3-to-4-item-per-characteristic ISO/IEC 25010 questionnaire, with written consent, anonymized IDs (R1, R2, ...) and compliance with RA 10173. Until real responses exist, this section must not report scores. Instruments, consent form and result tables go in appendix D **[PEOPLE]**.

## 6.4 Accessibility and responsive checks

- Playwright checks that the login page and six signed-in pages do not scroll sideways at 360 px. The check found one real overflow (community page) which was fixed.
- Labels are linked to inputs on login, register and the manual meal form; errors use `role="alert"`.
- **Not done:** a keyboard-only walkthrough of every page and measured colour-contrast ratios (requirement F6).
