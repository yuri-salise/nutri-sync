# NutriSync-RAG: USDA & FNRI Dataset Seeding Guide

This comprehensive technical guide explains how the **NutriSync-RAG** nutritional knowledge base is populated, how to run the automated seeder, and how to import custom or updated CSV datasets from the **DOST-FNRI (Food and Nutrition Research Institute)** and the **USDA FoodData Central**.

---

## 1. Architecture of the Nutrition Knowledge Base

NutriSync-RAG utilizes **PostgreSQL 17** equipped with the `pgvector` extension to power its hybrid Retrieval-Augmented Generation (RAG) engine.

Every food item in the table `nutrition_knowledge_items` contains:
- `food_name`: The descriptive title of the food (e.g. `Adobong Manok (Chicken Adobo)` or `Chicken Breast Boneless Skinless Grilled`).
- `source_dataset`: Identifies provenance (`FNRI` for Philippine Food Composition Tables, `USDA` for USDA FoodData Central, or `CUSTOM`).
- Macronutrient Breakdown per 100g portion:
  - `kcal_per_100g` (Energy in Calories)
  - `protein_per_100g` (Grams of Protein)
  - `carbs_per_100g` (Grams of Carbohydrates)
  - `fat_per_100g` (Grams of Dietary Fat)
- `serving_description`: Typical household portion description (e.g., `1 bowl (250g)` or `1 large egg (50g)`).
- `embedding`: A **384-dimensional dense vector (`VECTOR(384)`)** computed using the `all-MiniLM-L6-v2` semantic model.

```
+---------------------------------------------------------------------------------+
|                        CSV Dataset (FNRI / USDA)                               |
+---------------------------------------------------------------------------------+
                                      |
                                      v
       [ Universal CLI Seeder: app.scripts.seed_nutrition ]
                                      |
                     +----------------+----------------+
                     |                                 |
                     v                                 v
        [ Text Normalization ]          [ 384-d Vector Generator ]
                     |                                 |
                     +----------------+----------------+
                                      |
                                      v
         [ PostgreSQL 17 + pgvector (nutrition_knowledge_items) ]
                                      |
                                      v
           [ RAG Similarity Query: <=> (Cosine Distance) ]
```

---

## 2. CSV Schema Requirements

If you want to create your own CSV file or export from external spreadsheets, ensure your CSV file has the following header columns:

```csv
food_name,source_dataset,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,serving_description
Adobong Manok (Chicken Adobo),FNRI,185.0,22.4,2.8,9.2,1 piece with sauce (120g)
Chicken Breast Boneless Skinless Grilled,USDA,165.0,31.0,0.0,3.6,1 breast fillet (120g)
```

### Column Specifications
| Column | Type | Allowed Values / Format | Description |
| :--- | :--- | :--- | :--- |
| `food_name` | String | e.g. "Sinigang na Baboy" | Primary query target for semantic matching. |
| `source_dataset` | String | `FNRI`, `USDA`, or `CUSTOM` | Tag to distinguish national food tables. |
| `kcal_per_100g` | Float | e.g. 145.0 | Total energy in kilocalories per 100 grams. |
| `protein_per_100g`| Float | e.g. 14.8 | Protein content in grams per 100 grams. |
| `carbs_per_100g`  | Float | e.g. 4.2 | Available carbohydrates in grams per 100 grams. |
| `fat_per_100g`    | Float | e.g. 7.6 | Total lipids / fat in grams per 100 grams. |
| `serving_description`| String | e.g. "1 medium bowl (250g)" | Qualitative portion reference. |

---

## 3. How to Run the Seeder

### Option A: Via Docker Compose (Recommended)

When running the application with Docker, execute the seeder directly inside the `api` container:

```bash
# 1. Seed the default curated DOST-FNRI and USDA datasets
docker compose exec api python -m app.scripts.seed_nutrition

# 2. Seed initial demo users, workouts, and exercises
docker compose exec api python -m app.scripts.seed_demo_data
```

### Option B: Local Python Terminal

If running without Docker (in your virtual environment):

```bash
# Navigate to the backend directory
cd backend

# Run the default seeder
python -m app.scripts.seed_nutrition
```

---

## 4. Seeding Custom or Raw Datasets

The seeder provides flexible command-line arguments:

### 1. Ingesting a Custom CSV File
```bash
python -m app.scripts.seed_nutrition --csv /path/to/my_foods.csv --source FNRI
```

### 2. Clearing Existing Data Before Ingestion
```bash
python -m app.scripts.seed_nutrition --truncate
```

### 3. Adjusting Batch Size for Performance
For large datasets (>1,000 items), optimize batch insertion with `--batch-size`:
```bash
python -m app.scripts.seed_nutrition --batch-size 100
```

---

## 5. How to Verify Seeded Data

### Via psql CLI inside Docker
```bash
docker compose exec db psql -U nutrisync_user -d nutrisync_db -c "
  SELECT source_dataset, count(*), round(avg(kcal_per_100g)) as avg_kcal 
  FROM nutrition_knowledge_items 
  GROUP BY source_dataset;
"
```

Expected Output:
```text
 source_dataset | count | avg_kcal 
----------------+-------+----------
 FNRI           |   102 |      198
 USDA           |    65 |      174
(2 rows)
```

### Checking Vector Embeddings
```bash
docker compose exec db psql -U nutrisync_user -d nutrisync_db -c "
  SELECT food_name, source_dataset, vector_dims(embedding) 
  FROM nutrition_knowledge_items 
  LIMIT 3;
"
```

Expected Output:
```text
                  food_name                   | source_dataset | vector_dims 
----------------------------------------------+----------------+-------------
 Adobong Manok (Chicken Adobo)                | FNRI           |         384
 Sinigang na Baboy (Pork Sinigang)            | FNRI           |         384
 Bangus Inihaw (Grilled Milkfish)             | FNRI           |         384
(3 rows)
```

### Via Swagger UI API Explorer
1. Navigate to: `http://localhost:8080/api/docs` (or `http://localhost:8000/api/docs`).
2. Open endpoint: `GET /api/v1/nutrition-knowledge-items`.
3. Try searching `q=adobo` or filtering `source_dataset=FNRI`.
4. Observe the structured response matching verified tables.

---

## 6. Sourcing Full Raw DOST-FNRI and USDA Releases

- **DOST-FNRI Tables:** Official tables can be downloaded from the DOST-FNRI Food Composition Tables portal (https://i-fnri.fnri.dost.gov.ph/). Export the desired food group sheet as `.csv`, format the header according to Section 2, and drop into `backend/app/scripts/data/`.
- **USDA FoodData Central:** Full database dumps are available at https://fdc.nal.usda.gov/download-datasets.html. Extract `food.csv` and `food_nutrient.csv` and run the seeder targeting your extracted file.
