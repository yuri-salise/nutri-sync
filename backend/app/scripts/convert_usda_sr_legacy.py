"""
Convert the USDA FoodData Central SR Legacy CSV download into the app's food table.

Input : the unzipped SR Legacy CSV folder (food.csv, nutrient.csv, food_nutrient.csv,
        food_portion.csv, measure_unit.csv).
Output: app/scripts/data/usda_food_composition.csv, read by seed_nutrition.py and
        evaluate_scanner.py. Columns: food_name, source_dataset, kcal_per_100g,
        protein_per_100g, carbs_per_100g, fat_per_100g, serving_description.

Usage (from backend/):
    python -m app.scripts.convert_usda_sr_legacy --src "D:/Data/usda-sr-legacy"
"""

from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from pathlib import Path
from typing import Dict, Optional

DATA_DIR = Path(__file__).resolve().parent / "data"
OUT_PATH = DATA_DIR / "usda_food_composition.csv"

# Nutrients stored per 100 g in SR Legacy. Matched by name so the script does not
# depend on hard-coded IDs; the IDs it finds are printed for checking.
WANTED = {
    "kcal": ("Energy", "KCAL"),
    "protein": ("Protein", "G"),
    "fat": ("Total lipid (fat)", "G"),
    "carbs": ("Carbohydrate, by difference", "G"),
}
UNDETERMINED_MEASURE = "9999"


def _load_nutrient_ids(src: Path) -> Dict[str, str]:
    found: Dict[str, str] = {}
    with open(src / "nutrient.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            for key, (name, unit) in WANTED.items():
                if row["name"] == name and row["unit_name"] == unit:
                    found[key] = row["id"]
    missing = set(WANTED) - set(found)
    if missing:
        raise SystemExit(f"Could not find nutrient IDs for: {sorted(missing)}")
    return found


def _load_measures(src: Path) -> Dict[str, str]:
    with open(src / "measure_unit.csv", encoding="utf-8") as f:
        return {row["id"]: row["name"] for row in csv.DictReader(f)}


def _load_first_portions(src: Path, fdc_ids: set) -> Dict[str, Dict[str, str]]:
    """First portion (lowest seq_num) with a gram weight, per food."""
    best: Dict[str, Dict[str, str]] = {}
    with open(src / "food_portion.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            fid = row["fdc_id"]
            if fid not in fdc_ids or not row["gram_weight"]:
                continue
            seq = int(row["seq_num"] or 999)
            if fid not in best or seq < int(best[fid]["seq_num"] or 999):
                best[fid] = row
    return best


def _serving_text(portion: Optional[Dict[str, str]], measures: Dict[str, str]) -> str:
    if not portion:
        return "100g portion"
    unit = ""
    if portion["measure_unit_id"] != UNDETERMINED_MEASURE:
        unit = measures.get(portion["measure_unit_id"], "")
    if not unit:
        unit = portion["modifier"] or portion["portion_description"] or "serving"
    amount = portion["amount"] or "1"
    grams = float(portion["gram_weight"])
    return f"{float(amount):g} {unit.strip()} ({grams:g}g)"


def convert(src: Path, out: Path) -> None:
    nutrient_ids = _load_nutrient_ids(src)
    print("Nutrient IDs:", nutrient_ids)

    foods: Dict[str, str] = {}
    with open(src / "food.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["data_type"] == "sr_legacy_food":
                foods[row["fdc_id"]] = row["description"].strip()

    # Macros per 100 g, keyed by food then nutrient key.
    wanted_ids = {v: k for k, v in nutrient_ids.items()}
    values: Dict[str, Dict[str, float]] = defaultdict(dict)
    with open(src / "food_nutrient.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            fid = row["fdc_id"]
            key = wanted_ids.get(row["nutrient_id"])
            if key and fid in foods and row["amount"] != "":
                values[fid][key] = float(row["amount"])

    measures = _load_measures(src)
    portions = _load_first_portions(src, set(foods))

    kept = skipped = 0
    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "food_name",
                "source_dataset",
                "kcal_per_100g",
                "protein_per_100g",
                "carbs_per_100g",
                "fat_per_100g",
                "serving_description",
            ]
        )
        for fid, name in foods.items():
            vals = values.get(fid, {})
            if not all(k in vals for k in WANTED):
                skipped += 1
                continue
            writer.writerow(
                [
                    name,
                    "USDA",
                    round(vals["kcal"], 1),
                    round(vals["protein"], 1),
                    round(vals["carbs"], 1),
                    round(vals["fat"], 1),
                    _serving_text(portions.get(fid), measures),
                ]
            )
            kept += 1

    print(f"Wrote {kept} foods to {out} (skipped {skipped} with missing macros)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert USDA SR Legacy CSVs to the app format")
    parser.add_argument("--src", required=True, help="Folder with the unzipped SR Legacy CSVs")
    parser.add_argument("--out", default=str(OUT_PATH), help="Output CSV path")
    args = parser.parse_args()
    convert(Path(args.src), Path(args.out))


if __name__ == "__main__":
    main()
