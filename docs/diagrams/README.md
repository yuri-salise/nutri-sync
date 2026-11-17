# Architecture and design diagrams

Mermaid sources (render on GitHub, or paste into mermaid.live, then export PNG or SVG at 300 dpi):

| File | Diagram |
| :--- | :--- |
| `system_architecture.mmd` | Architecture and deployment: browser, Tailscale Funnel, Caddy, web, API, PostgreSQL, CI/CD |
| `auth_login_sequence.mmd` | Login sequence with the rate limit and role claim |
| `rag_pipeline_dataflow.mmd` | Meal scanner data flow with the confidence cut-offs, logging and fallback |
| `database_erd.mmd` | Entity-relationship diagram, **generated** from the models by `python -m app.scripts.export_docs` |

Not drawn yet **[PEOPLE]**: use case diagram, wireframes versus final screens.
