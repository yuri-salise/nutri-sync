"""
Offline evaluation of the Smart Meal Scanner (Requirement T5).

Runs every meal in data/scanner_eval_set.csv through the same FoodMatcher the API uses,
against the same FNRI/USDA CSVs the database is seeded from, and reports:

* item precision / recall - did we pick the right foods?
* calorie MAPE           - how far is the total kcal from the reference portion?
* protein MAE (g)
* mean latency per meal (ms)

The reference kcal for a meal is computed from the expected foods and gram amounts in the
test set, using the same per-100 g values, so the metric isolates parsing, matching and
portion estimation errors (not errors in the food composition tables themselves).

Usage (from backend/):
    python -m app.scripts.evaluate_scanner
    python -m app.scripts.evaluate_scanner --csv-out ../docs/evaluation/scanner_eval_results.csv
"""

from __future__ import annotations

import argparse
import csv
import statistics
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.services.embedding_service import generate_embedding  # noqa: E402
from app.services.meal_parser import FoodMatcher, total_macros  # noqa: E402

DATA_DIR = Path(__file__).resolve().parent / "data"


@dataclass
class Food:
    id: int
    food_name: str
    source_dataset: str
    kcal_per_100g: float
    protein_per_100g: float
    carbs_per_100g: float
    fat_per_100g: float
    serving_description: str


@dataclass
class EvalReport:
    meals: int
    item_precision: float
    item_recall: float
    kcal_mape: float
    protein_mae_g: float
    mean_latency_ms: float
    rows: List[Dict]


def load_foods() -> List[Food]:
    foods: List[Food] = []
    for name in ("fnri_food_composition.csv", "usda_food_composition.csv"):
        with open(DATA_DIR / name, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                foods.append(
                    Food(
                        id=len(foods) + 1,
                        food_name=row["food_name"].strip(),
                        source_dataset=row["source_dataset"].strip().upper(),
                        kcal_per_100g=float(row["kcal_per_100g"]),
                        protein_per_100g=float(row["protein_per_100g"]),
                        carbs_per_100g=float(row["carbs_per_100g"]),
                        fat_per_100g=float(row["fat_per_100g"]),
                        serving_description=row["serving_description"].strip(),
                    )
                )
    return foods


def load_eval_set(path: Optional[Path] = None) -> List[Dict]:
    path = path or DATA_DIR / "scanner_eval_set.csv"
    cases = []
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            expected = {}
            for part in row["expected_items"].split(";"):
                name, grams = part.rsplit("=", 1)
                expected[name.strip()] = float(grams)
            cases.append({"meal": row["meal"], "expected": expected})
    return cases


def evaluate(
    matcher: Optional[FoodMatcher] = None, foods: Optional[List[Food]] = None
) -> EvalReport:
    foods = foods or load_foods()
    by_name = {f.food_name: f for f in foods}
    matcher = matcher or FoodMatcher(foods, embed=generate_embedding)

    tp = predicted = expected_total = 0
    apes: List[float] = []
    protein_errs: List[float] = []
    latencies: List[float] = []
    rows: List[Dict] = []

    for case in load_eval_set():
        expected = case["expected"]
        missing = [n for n in expected if n not in by_name]
        if missing:
            raise ValueError(f"Eval set references unknown foods: {missing}")

        t0 = time.perf_counter()
        items = matcher.match_meal(case["meal"])
        latencies.append((time.perf_counter() - t0) * 1000.0)

        found = [i.food.food_name for i in items if i.food is not None and i.confidence != "none"]
        hits = len(set(found) & set(expected))
        tp += hits
        predicted += len(found)
        expected_total += len(expected)

        ref_kcal = sum(by_name[n].kcal_per_100g * g / 100 for n, g in expected.items())
        ref_protein = sum(by_name[n].protein_per_100g * g / 100 for n, g in expected.items())
        pred = total_macros(items)
        ape = abs(pred["calories"] - ref_kcal) / ref_kcal if ref_kcal else 0.0
        apes.append(ape)
        protein_errs.append(abs(pred["protein_g"] - ref_protein))

        rows.append(
            {
                "meal": case["meal"],
                "expected_foods": "; ".join(expected),
                "predicted_foods": "; ".join(found) or "-",
                "items_correct": f"{hits}/{len(expected)}",
                "ref_kcal": round(ref_kcal, 1),
                "pred_kcal": pred["calories"],
                "abs_pct_error": round(ape * 100, 1),
            }
        )

    return EvalReport(
        meals=len(rows),
        item_precision=tp / predicted if predicted else 0.0,
        item_recall=tp / expected_total if expected_total else 0.0,
        kcal_mape=statistics.mean(apes) * 100 if apes else 0.0,
        protein_mae_g=statistics.mean(protein_errs) if protein_errs else 0.0,
        mean_latency_ms=statistics.mean(latencies) if latencies else 0.0,
        rows=rows,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate the Smart Meal Scanner (T5)")
    parser.add_argument("--csv-out", type=str, help="Write per-meal results to this CSV path")
    args = parser.parse_args()

    report = evaluate()

    print(f"{'Meal':<55} {'Items':>6} {'Ref':>7} {'Pred':>7} {'APE%':>6}")
    print("-" * 85)
    for r in report.rows:
        print(
            f"{r['meal'][:55]:<55} {r['items_correct']:>6} {r['ref_kcal']:>7} "
            f"{r['pred_kcal']:>7} {r['abs_pct_error']:>6}"
        )
    print("-" * 85)
    print(f"Meals evaluated     : {report.meals}")
    print(f"Item precision      : {report.item_precision:.1%}")
    print(f"Item recall         : {report.item_recall:.1%}")
    print(f"Calorie MAPE        : {report.kcal_mape:.1f}%")
    print(f"Protein MAE         : {report.protein_mae_g:.1f} g")
    print(f"Mean latency / meal : {report.mean_latency_ms:.2f} ms (matching only, no DB/HTTP)")

    if args.csv_out:
        out = Path(args.csv_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(report.rows[0].keys()))
            writer.writeheader()
            writer.writerows(report.rows)
        print(f"Per-meal results written to {out}")


if __name__ == "__main__":
    main()
