# Is KMAP Possible? — ICMS 2026 poster and interactive demo

Poster **ICMS2026-F-8** (Theory and Methodology), *The 7th International Conference on Molecular Simulation*, 4–8 October 2026, IISc Bengaluru.

**Shuvam Banerji Seal**, Susmita Roy\*, Dwaipayan Roy — IISER Kolkata (\*susmita.roy@iiserkol.ac.in)

| Path | What it is |
|---|---|
| `poster/` | The A0 poster: HTML/CSS + SVG figures computed from real data, rendered to PDF with headless Chrome (`cd poster && node build.mjs`) |
| `docs/` | The interactive demo website (GitHub Pages) |
| `SBS_ICMS_Abs.docx` | The submitted abstract |

Every figure is generated from the same definitions the Lean 4 proofs use, and every claim on the poster carries a tag saying how it is known: proved in Lean (`⊢ theorem_name`), measured on data (`◆`), or proved on paper (`✎`).
