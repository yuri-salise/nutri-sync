# NutriSync-RAG: Estimating Meal Nutrition from Philippine and USDA Food Tables with Retrieval, Alongside GPS Activity Tracking

**[PEOPLE]** Authors, affiliation and email go here (IEEE conference template, 6–8 pages). This file is the **text draft**; it must be moved into the IEEE template and its figures and tables numbered.

## Abstract

Athletes who want to track what they eat usually type calories by hand or search long food lists. This paper describes NutriSync-RAG, a web application that combines workout logging, GPS activity recording and a meal scanner. The scanner takes a free-text meal in English or Tagalog, finds the closest foods in the DOST-FNRI and USDA FoodData Central (SR Legacy) tables, picks the household portion that matches the amount typed, and sums the per-100 g macronutrients; no generated text supplies any number. Every scan is logged, flagged as machine-generated and confirmed by the user before saving. On three sets of 28, 32 and 33 test meals, the scanner found the right food in 87.5% to 89.1% of items and its calorie total differed from the reference by 7.8% to 13.8% on average, with matching taking about 20 ms per scan on the deployed server. The reference values come from the same food tables and no meal was weighed, so these figures measure parsing, matching and portion choices, not real-world accuracy. A trial of a neural sentence-embedding model did not improve calorie accuracy and doubled matching time. The system runs on Docker Compose with free tooling and a public HTTPS address. Usability testing with users has not been done yet.

**Index Terms:** nutrition estimation, retrieval, food composition table, Philippine cuisine, activity tracking, web application, evaluation.

## I. Introduction

Logging meals is a barrier to nutrition tracking: searching a database for each ingredient is slow, and many databases lack Filipino dishes such as *sinigang* or *bulalo*. Athletes also train in several ways (strength sessions, running, cycling), and their energy needs change with the day's activity.

**Objectives.** (1) Estimate the nutrition of a typed meal from published food composition tables, with every number traceable to a table row. (2) Record strength workouts and GPS activities and adjust daily calorie targets. (3) Run the whole system on free tools with a public HTTPS address.

**Contributions.** (a) A retrieval-based meal matcher over Philippine and USDA tables that handles amounts, units and Filipino food names; (b) an evaluation on three meal sets with an honest account of which sets influenced the design; (c) a measured comparison of word matching, a built-in hash embedding and a neural embedding; (d) a deployed, tested and documented system.

## II. Related Work

Retrieval-augmented generation grounds a model's output in retrieved documents [1]. Sentence embeddings place short texts in a vector space where similar meanings are close [2]. Food-image datasets such as Food-101 [10] support image-based recognition, but they cover mostly Western dishes. Food composition tables supply the nutrient values: USDA FoodData Central [5] and the Philippine food composition tables of DOST-FNRI [14]. **[PEOPLE]** Add at least three existing nutrition-tracking systems with citations and a comparison table, and recent studies on text-based or image-based dietary assessment (the guidelines require at least 12 references in this paper; see `docs/01-system-documentation/references-draft.md`).

## III. System Design

The browser talks only to a REST API (FastAPI) behind a Caddy reverse proxy; PostgreSQL 17 with pgvector stores 13 tables created by five Alembic migrations. Authentication uses bcrypt password hashes and signed JWT access tokens [8]; two roles (athlete and coach) are enforced in each endpoint. Login is limited to five attempts per minute per email. **[PEOPLE]** Insert the architecture figure (`docs/diagrams/system_architecture.mmd`), the ERD (`docs/diagrams/database_erd.mmd`) and the API summary.

**Meal scanner.** For each meal the system (1) splits the text into items and reads amounts and units; (2) finds foods that share a word with the item; (3) scores each candidate as 0.8 × word match plus 0.2 × embedding similarity, with a small bonus when the first part of a USDA name is covered and penalties for forms the user did not ask for (powder, peel, dry pasta); (4) chooses the household portion that fits the unit (cup, medium piece, serving); and (5) scales the per-100 g macros by the grams. Items scoring below 0.40 are reported as not found and add no calories. Each scan is stored in `rag_scan_logs` with the input, the retrieved IDs, the top score, the macros, the matcher version, the latency and whether the fallback embedding was used. The response is marked machine-generated and the user confirms before a meal is saved, in line with responsible-use requirements.

## IV. Implementation and Deployment

The frontend is a React 18 and TypeScript single-page application built with Vite; the backend is Python 3.10 with FastAPI and async SQLAlchemy. The USDA SR Legacy download was converted into 7,793 foods with up to eight household portions each; 101 Philippine dishes were added from the FNRI values entered by the team. A word index limits scoring to candidate foods and embedding similarities are computed in one batch, reducing matching time from about 1.2 s to about 50 ms per meal in the evaluation, with identical results on 60 test meals. Continuous integration runs linting and tests on every pull request (45 backend tests at 78% line coverage, 29 frontend tests, 16 browser tests); a self-hosted runner deploys each merge to `main` and verifies that `/api/health` reports the new commit. Public HTTPS is provided by Tailscale Funnel. Backup and restore scripts were tested by restoring a dump into a scratch database and comparing row counts.

## V. Evaluation

**Method.** Each test meal lists the expected foods (exact table rows) and grams; reference calories are computed from those rows. *Family* precision and recall count the right food in any variant (raw or cooked broccoli); *exact* scores require the specific row. Calorie error is the mean absolute percentage error of the meal total.

| Set | Meals | Family P / R | Exact P / R | Calorie error |
| :--- | :---: | :---: | :---: | :---: |
| Tuned | 28 | 89.1% / 89.1% | 76.4% / 76.4% | 7.8% |
| Held-out | 32 | 87.5% / 87.5% | 65.6% / 65.6% | 13.8% |
| Third | 33 | 88.7% / 88.7% | 74.2% / 74.2% | 8.6% |

*Table I. Scanner results on three meal sets.*

| Variant | Family recall (tuned / held-out / third) | Calorie error (tuned / held-out / third) |
| :--- | :---: | :---: |
| Words only | 85.5% / 89.1% / 88.7% | 10.8% / 14.9% / 8.8% |
| Hash embedding (deployed) | 89.1% / 87.5% / 88.7% | 7.8% / 13.8% / 8.6% |
| `all-MiniLM-L6-v2` | 87.3% / 87.5% / 91.9% | 16.8% / 16.6% / 10.2% |

*Table II. Effect of the embedding choice (semantic weight 0.2).* The neural model was about twice as slow (about 100 ms per meal) and did not improve calorie accuracy, so it was not adopted.

On the first held-out run the family recall was 76.6% with a calorie error of 33.4%; fixes made after inspecting those failures raised it to the figures above. The held-out and third sets therefore influenced the design.

**Usability and quality.** **[PEOPLE]** No System Usability Scale or ISO/IEC 25010 data has been collected [3], [4]. This section must report n, the mean score and its interpretation from at least five target users, collected with consent and anonymized under RA 10173 [6].

**Performance.** About 20 ms per scan on the deployed server once the index is built; the first scan after a deploy takes 1 to 2 s. No load test was run.

## VI. Discussion and Limitations

1. The reference calories come from the same tables the scanner reads, and no meal was weighed. The results show that the scanner parses and matches consistently, not that its calories equal real intake. A weighed-meal procedure is provided with the project.
2. All three sets influenced the matcher in some way; only a new set frozen before testing gives a clean estimate.
3. Dishes missing from both tables are reported as not found. With no amount typed the scanner assumes one serving, which can be far from the real amount; the user can edit grams before saving.
4. The FNRI values were entered by the team and their source tables are not yet recorded in the repository.
5. Row-level security policies exist in the database but are bypassed in the deployed setup, and the login rate limit is held in memory; access control relies on checks in each endpoint.
6. The system is reachable only while the host computer is running.

## VII. Conclusion and Future Work

A table-grounded meal matcher with household-portion selection reached 87.5% to 89.1% family-level food recall and 7.8% to 13.8% calorie error on three meal sets, at about 20 ms per scan, and was deployed with automated tests and a restore-tested database. Future work: measure accuracy on weighed meals; document the FNRI sources and expand Filipino coverage; evaluate the photo-based meal input that is already implemented with free vision models (it needs a server key and has not been measured); make row-level security effective with a non-superuser application role; run the SUS and ISO/IEC 25010 evaluations.

## Acknowledgment

**[PEOPLE]** Confirm and complete. Draft declaration of AI tool use: an AI coding assistant (Claude, Anthropic) was used under the author's direction to write and refactor code and tests, to run evaluations and to draft documentation. The author reviewed and ran the results; **[PEOPLE]** state how each output was checked. Data sources: USDA FoodData Central (public domain) and DOST-FNRI values; mapping tiles and library: OpenStreetMap and Leaflet.

## References

Numbering follows `docs/01-system-documentation/references-draft.md` (partial list; to be completed and verified).

[1] P. Lewis *et al.*, "Retrieval-augmented generation for knowledge-intensive NLP tasks," in *Advances in Neural Information Processing Systems*, vol. 33, 2020, pp. 9459–9474.
[2] N. Reimers and I. Gurevych, "Sentence-BERT: Sentence embeddings using Siamese BERT-networks," in *Proc. EMNLP-IJCNLP*, Hong Kong, China, 2019, pp. 3982–3992.
[3] J. Brooke, "SUS: A 'quick and dirty' usability scale," in *Usability Evaluation in Industry*. London, U.K.: Taylor & Francis, 1996, pp. 189–194.
[4] *Systems and Software Quality Requirements and Evaluation (SQuaRE) — System and Software Quality Models*, ISO/IEC 25010:2011, 2011.
[5] U.S. Department of Agriculture, Agricultural Research Service, "FoodData Central." [Online]. Available: https://fdc.nal.usda.gov/
[6] *Data Privacy Act of 2012*, Republic Act No. 10173, Republic of the Philippines, 2012.
[8] M. Jones, J. Bradley, and N. Sakimura, "JSON Web Token (JWT)," IETF, RFC 7519, May 2015.
[10] L. Bossard, M. Guillaumin, and L. Van Gool, "Food-101 — Mining discriminative components with random forests," in *Computer Vision — ECCV 2014*, 2014, pp. 446–461.
[14] DOST-FNRI, *Philippine Food Composition Tables*. **[edition to be verified]**
