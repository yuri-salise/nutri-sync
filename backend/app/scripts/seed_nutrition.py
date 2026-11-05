import argparse
import asyncio
import csv
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy import delete, func, select

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.core.logging import logger
from app.db.models import NutritionKnowledgeItem
from app.db.session import AsyncSessionLocal
from app.services.embedding_service import generate_embedding

DATA_DIR = Path(__file__).resolve().parent / "data"


async def parse_csv_file(file_path: Path) -> List[Dict[str, Any]]:
    """Reads and validates nutritional CSV records."""
    if not file_path.exists():
        logger.error(f"CSV file not found: {file_path}")
        return []

    records = []
    with open(file_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_idx, row in enumerate(reader, start=2):
            try:
                food_name = row["food_name"].strip()
                source_dataset = row.get("source_dataset", "CUSTOM").strip().upper()
                kcal = float(row["kcal_per_100g"])
                protein = float(row["protein_per_100g"])
                carbs = float(row["carbs_per_100g"])
                fat = float(row["fat_per_100g"])
                serving = row.get("serving_description", "100g portion").strip()

                records.append({
                    "food_name": food_name,
                    "source_dataset": source_dataset,
                    "kcal_per_100g": kcal,
                    "protein_per_100g": protein,
                    "carbs_per_100g": carbs,
                    "fat_per_100g": fat,
                    "serving_description": serving,
                })
            except Exception as e:
                logger.warning(f"Skipping malformed row {row_idx} in {file_path.name}: {e}")

    return records


async def seed_dataset(
    records: List[Dict[str, Any]],
    batch_size: int = 50,
    truncate: bool = False
):
    """Computes vector embeddings and inserts records into PostgreSQL pgvector table."""
    async with AsyncSessionLocal() as session:
        if truncate:
            logger.info("Truncating existing nutrition_knowledge_items...")
            await session.execute(delete(NutritionKnowledgeItem))
            await session.commit()

        start_time = time.time()
        total = len(records)
        inserted_count = 0

        logger.info(f"Starting vector seeding for {total} food items (Batch size: {batch_size})...")

        for i in range(0, total, batch_size):
            batch = records[i:i + batch_size]
            db_objects = []

            for item in batch:
                # Semantic embedding of food name + description
                text_to_embed = f"{item['food_name']} ({item['source_dataset']}) {item['serving_description']}"
                vector = generate_embedding(text_to_embed)

                db_item = NutritionKnowledgeItem(
                    food_name=item["food_name"],
                    source_dataset=item["source_dataset"],
                    kcal_per_100g=item["kcal_per_100g"],
                    protein_per_100g=item["protein_per_100g"],
                    carbs_per_100g=item["carbs_per_100g"],
                    fat_per_100g=item["fat_per_100g"],
                    serving_description=item["serving_description"],
                    embedding=vector,
                )
                db_objects.append(db_item)

            session.add_all(db_objects)
            await session.commit()
            inserted_count += len(db_objects)
            pct = round((inserted_count / total) * 100, 1)
            logger.info(f"Seeded {inserted_count}/{total} items ({pct}%)")

        elapsed = round(time.time() - start_time, 2)
        total_items_stmt = select(func.count(NutritionKnowledgeItem.id))
        res = await session.execute(total_items_stmt)
        total_in_db = res.scalar_one()

        print("\n" + "=" * 65)
        print(" NUTRISYNC-RAG NUTRITION KNOWLEDGE BASE SEEDING REPORT")
        print("=" * 65)
        print(f" Items Processed from CSV : {inserted_count}")
        print(f" Total Rows in pgvector DB: {total_in_db}")
        print(" Embedding Dimensionality : 384 dimensions")
        print(f" Execution Duration       : {elapsed} seconds")
        print("=" * 65 + "\n")


async def main():
    parser = argparse.ArgumentParser(description="NutriSync-RAG USDA/FNRI CSV Dataset Seeder")
    parser.add_argument("--csv", type=str, help="Path to custom CSV file")
    parser.add_argument("--source", type=str, default="CUSTOM", help="Source dataset name (FNRI or USDA)")
    parser.add_argument("--truncate", action="store_true", help="Truncate table before seeding")
    parser.add_argument("--batch-size", type=int, default=50, help="Batch size for vector ingestion")
    args = parser.parse_args()

    all_records = []

    if args.csv:
        custom_path = Path(args.csv)
        records = await parse_csv_file(custom_path)
        for r in records:
            r["source_dataset"] = args.source.upper()
        all_records.extend(records)
    else:
        # Load built-in FNRI and USDA datasets
        fnri_path = DATA_DIR / "fnri_food_composition.csv"
        usda_path = DATA_DIR / "usda_food_composition.csv"

        logger.info(f"Loading FNRI dataset: {fnri_path}")
        fnri_records = await parse_csv_file(fnri_path)
        all_records.extend(fnri_records)

        logger.info(f"Loading USDA dataset: {usda_path}")
        usda_records = await parse_csv_file(usda_path)
        all_records.extend(usda_records)

    if not all_records:
        logger.error("No valid records found to seed.")
        return

    await seed_dataset(all_records, batch_size=args.batch_size, truncate=args.truncate)


if __name__ == "__main__":
    asyncio.run(main())
