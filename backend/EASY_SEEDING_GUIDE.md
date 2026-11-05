# 🥑 Beginner's Guide: Understanding RAG & Seeding Nutritional Datasets

Welcome! If you are new to **RAG (Retrieval-Augmented Generation)** and vector databases, don't worry. This guide explains everything in plain English with simple analogies and step-by-step commands.

---

## 1. What is RAG in Plain English?

Imagine asking a regular AI:  
> *"How many calories and protein are in a bowl of Chicken Tinola with malunggay?"*

- **Without RAG (Generic AI):** The AI makes an educated guess (hallucination). It might guess 500 kcal one day and 200 kcal the next day because it doesn't have access to genuine laboratory nutritional tables.
- **With RAG (NutriSync-RAG):**
  1. **Retrieve:** The system looks up **"Chicken Tinola with malunggay"** in your verified database containing official Philippine DOST-FNRI tables.
  2. **Augment:** It pulls the exact laboratory numbers: `128 kcal, 16.5g protein, 2.1g carbs, 5.8g fat`.
  3. **Generate:** The AI calculates your exact meal macros using those verified facts!

```
+-------------------------------------------------------------------------+
| User types: "Chicken Tinola with rice"                                  |
+-------------------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------------------+
| 1. RETRIEVE: Look up real food items in our database (DOST-FNRI & USDA) |
|    Found: "Tinolang Manok (128 kcal)" + "Cooked White Rice (130 kcal)"   |
+-------------------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------------------+
| 2. AUGMENT: Give the AI the real laboratory facts                      |
+-------------------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------------------+
| 3. GENERATE: Calculate exact meal calories & macros (Zero Guesses!)     |
+-------------------------------------------------------------------------+
```

---

## 2. What Does "Seeding" Mean?

**Seeding** simply means **populating an empty database with starter data**.

Right now, your database is empty. We already pre-packaged two clean CSV files for you:
1. `backend/app/scripts/data/fnri_food_composition.csv` (101 Filipino foods: Adobo, Sinigang, Tinola, Bangus, Taho, etc.)
2. `backend/app/scripts/data/usda_food_composition.csv` (65 Core foods: Chicken Breast, Oats, Salmon, Eggs, etc.)

When you run the seeder:
- It reads every row from the CSV.
- It turns each food name into a **384-dimensional mathematical vector (Embedding)**.
- It saves the food and its vector into PostgreSQL (`nutrition_knowledge_items`).

> **Why do we need "Vectors / Embeddings"?**  
> If someone types *"Grilled milkfish"* instead of *"Bangus Inihaw"*, traditional text search might fail. An embedding understands that both mean the exact same food semantically!

---

## 3. How to Seed the Database (Step-by-Step)

You have two easy ways to run this:

### Method A: If You Are Using Docker (Recommended)

1. Open your terminal in `nutri-sync`:
   ```powershell
   docker compose up -d
   ```
2. Run the seeder with one command:
   ```powershell
   docker compose exec api python -m app.scripts.seed_nutrition
   ```
3. *(Optional)* Seed demo accounts (Athlete Yuri and Coach Rinante):
   ```powershell
   docker compose exec api python -m app.scripts.seed_demo_data
   ```

---

### Method B: If You Are Running Locally (Without Docker)

1. Open PowerShell and go into the `backend` folder:
   ```powershell
   cd c:\Users\Yuri\Desktop\React\nutri-sync\backend
   ```
2. Activate your virtual environment:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```
3. Run the seeder script:
   ```powershell
   python -m app.scripts.seed_nutrition
   ```

---

## 4. What You Will See on Your Screen

When the seeder runs, you will see a clean progress report like this:

```text
2026-11-05 20:10:38 | INFO | Loading FNRI dataset: fnri_food_composition.csv
2026-11-05 20:10:38 | INFO | Loading USDA dataset: usda_food_composition.csv
2026-11-05 20:10:38 | INFO | Starting vector seeding for 166 food items (Batch size: 50)...
2026-11-05 20:10:39 | INFO | Seeded 50/166 items (30.1%)
2026-11-05 20:10:40 | INFO | Seeded 100/166 items (60.2%)
2026-11-05 20:10:41 | INFO | Seeded 150/166 items (90.4%)
2026-11-05 20:10:41 | INFO | Seeded 166/166 items (100.0%)

=================================================================
 NUTRISYNC-RAG NUTRITION KNOWLEDGE BASE SEEDING REPORT
=================================================================
 Items Processed from CSV : 166
 Total Rows in pgvector DB: 166
 Embedding Dimensionality : 384 dimensions
 Execution Duration       : 3.42 seconds
=================================================================
```

---

## 5. How to Test That It Worked

### Test 1: In the Web Application
1. Open your browser to: `http://localhost:8080` (or `http://localhost:5173` if running `npm run dev`).
2. Log in (Click **Demo: Athlete Yuri**).
3. Click **RAG Nutrition Scanner** on the left menu.
4. Type: `Chicken adobo with garlic rice and a boiled egg`.
5. Click **Run RAG**!
6. You will see:
   - Retrieved food cards: **Adobong Manok (FNRI)**, **Sinangag (FNRI)**, and **Hard-boiled Egg (FNRI)**.
   - Exact cosine similarity match percentage.
   - Grounded total calories and macros!

### Test 2: In the Swagger API Docs
1. Open: `http://localhost:8080/api/docs` (or `http://localhost:8000/api/docs`).
2. Scroll to `GET /api/v1/nutrition-knowledge-items`.
3. Click **Try it out** -> enter `q: bangus` -> click **Execute**.
4. You will see all matching milkfish records directly from the database!

---

## 6. How to Add Your Own Foods to the CSV

Want to add your favorite family recipe or a new gym snack? It's as easy as adding a row to Excel or Notepad!

1. Open `backend/app/scripts/data/fnri_food_composition.csv` in Excel or VS Code.
2. Scroll to the bottom and add your row following this format:
   ```csv
   food_name,source_dataset,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,serving_description
   My Protein Shake,CUSTOM,180.0,30.0,8.0,3.0,1 scoop with water (35g)
   ```
3. Save the file.
4. Re-run the seeder:
   ```powershell
   python -m app.scripts.seed_nutrition
   ```
5. Your new food is immediately converted into a 384-dimensional vector and searchable by the RAG scanner!
