# D1: System Documentation (Technical Manual)

**NutriSync-RAG: An Activity-Synced Nutritional Retrieval-Augmented Generation and Geolocation Workout Tracking Platform**
*Bachelor of Science in Information Technology · ITSD 85 · Special Topics in Software Development · AY 2026–2027, First Semester*

This folder holds the **technical content** of D1, written from the repository and checked against it. It is not yet the submission document. The school format (A4, Times New Roman 12 pt, front matter, numbered figures and tables, IEEE references, PDF export) must still be produced from these sources, and the items marked **[PEOPLE]** need real people.

## Status against the required outline (guidelines section 9.2)

| Part | File | Status |
| :--- | :--- | :--- |
| Front matter (title page, approval sheet, abstract, acknowledgment, TOC, LOF, LOT) | — | **[PEOPLE]** Approval sheet needs the instructor's signature. Not written. |
| 1. Introduction | — | Not written. Problem and objectives are summarized in the main [README](../../README.md). |
| 2. Related literature and systems | — | Not written. Needs real sources and at least 3 compared systems. |
| 3. Requirements specification | [03-requirements-traceability.md](03-requirements-traceability.md) | Draft: self-assessment of every rubric requirement with evidence. User stories and the use case diagram are not written. |
| 4. System design | [04-system-design.md](04-system-design.md) | Draft, complete for architecture, ERD, data dictionary, login sequence, security and RAG design. Wireframes-vs-final screens missing. |
| 5. Implementation | [05-implementation.md](05-implementation.md) | Draft. |
| 6. Testing and evaluation | [06-testing-and-evaluation.md](06-testing-and-evaluation.md) | Draft with real measured results. **SUS, ISO/IEC 25010 and user acceptance testing have no data yet [PEOPLE].** |
| 7. Deployment and operations | [07-deployment-and-operations.md](07-deployment-and-operations.md) | Draft, includes one real restore-test record. Green-pipeline screenshot missing. |
| 8. Summary, conclusions, recommendations | — | Not written (depends on the user testing results). |
| References (at least 15, at least 8 from the last 5 years) | [references-draft.md](references-draft.md) | **Partial.** Only sources the author is confident exist are listed; must be completed and verified. |
| Appendix A: user manual | [../02-user-manual/README.md](../02-user-manual/README.md) | Draft with screenshots. |
| Appendix B: API reference export | [../03-api/openapi.yaml](../03-api/openapi.yaml), [generated/endpoints.md](generated/endpoints.md) | Generated from the running app. |
| Appendices C–H (test cases, UAT instrument and results, consent form, work log, release links, team profiles) | — | **[PEOPLE]** Not written. |

## Generated files (always match the code)

Run `python -m app.scripts.export_docs` from `backend/` to regenerate:

- [generated/erd.md](generated/erd.md) and [../diagrams/database_erd.mmd](../diagrams/database_erd.mmd): entity-relationship diagram from the SQLAlchemy models.
- [generated/data-dictionary.md](generated/data-dictionary.md): every table and column.
- [generated/endpoints.md](generated/endpoints.md): every endpoint with its response codes.
- [../03-api/openapi.yaml](../03-api/openapi.yaml): the OpenAPI 3 document of the running app (also served live at `/api/docs`).

Diagram sources are in [../diagrams/](../diagrams/).

## Publication-readiness (section 9.7): honest checklist

- [ ] Every chapter and appendix present, nothing marked TBD. *Not yet.*
- [ ] Traceability matrix links every functional requirement to a passing test. *Draft exists; user stories are missing.*
- [x] ERD, data dictionary and OpenAPI generated from the code (regenerate on the day of submission).
- [ ] All screenshots from the deployed version with sample data. *Draft screenshots exist; retake on the final deployed version.*
- [ ] Test, SUS and ISO/IEC 25010 results with n, mean and interpretation. *No SUS or ISO data collected.*
- [ ] At least 15 references (D1) and 12 (D4), IEEE style. *Partial.*
- [ ] Spelling, originality and AI-use declaration. *AI-use declaration to be written by the team.*
- [ ] Approval sheet signed by the instructor.
- [ ] PDFs with embedded fonts and bookmarks.
