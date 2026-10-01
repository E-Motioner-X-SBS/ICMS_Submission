# Is KMAP Possible? — ICMS 2026 poster and interactive demo

Poster **ICMS2026-F-8** (Theory and Methodology), *The 7th International Conference on Molecular Simulation*, 4–8 October 2026, IISc Bengaluru.

**Shuvam Banerji Seal**, Susmita Roy\*, Dwaipayan Roy — IISER Kolkata (\*susmita.roy@iiserkol.ac.in)

| Path | What it is |
|---|---|
| `poster/` | The A0 poster: HTML/CSS + SVG figures computed from real data, rendered to PDF with headless Chrome (`cd poster && node build.mjs`) |
| `docs/` | The interactive demo website, served by GitHub Pages at <https://e-motioner-x-sbs.github.io/ICMS_Submission/> |
| `SBS_ICMS2026_Poster.pdf` | The final A0 poster |
| `SBS_ICMS_Abs.docx` | The submitted abstract |

Every figure is generated from the same definitions the Lean 4 proofs use, and every claim on the poster carries a tag saying how it is known: proved in Lean (`⊢ theorem_name`), measured on data (`◆`), or proved on paper (`✎`).

## The demo

Pick any protein, DNA or RNA entry from the Protein Data Bank (live search, or five bundled examples that work offline) and follow it through thirteen chapters, numbered in Gray code:

| Chapter | What happens to your structure |
|---|---|
| 0000 Pick | search RCSB, choose a chain (DNA/RNA strands can be followed together) |
| 0001 Bits | every letter gets its codeword: 5 bits per amino acid, 2 per nucleotide |
| 0011 Gray code | binary vs reflected Gray code, one bit per step, on your chain's positions |
| 0010 K-map | k-mer counts on a Gray-ordered Karnaugh map; tap a cell for its one-bit neighbours |
| 0110 Geometry | amino acids on the 5-cube (4 × 8 K-map) or bases on the 2-cube square |
| 0111 Contacts | the 3D contact map as a Boolean function, in 3D and as a truth table |
| 0101 Blocks | exact Quine–McCluskey in a Web Worker; blocks, strand pairs, shuffle control |
| 0100 Circuit | the whole entry as a two-level AND–OR circuit: AND plane, gate view, live evaluation, check on every input, .pla / Verilog export |
| 1100 Rules | every AND gate read as a rule (IF i ∈ … AND j ∈ … THEN contact), with support and zero exceptions |
| 1101 Inferences | block rules that continue one another → strand pairs, direction and register; base pairs for DNA/RNA |
| 1111 Read back | the sequence as a circuit, minimised and decoded without loss |
| 1110 Invariance | GF(2) linearity, the lexicographic ↔ Gray permutation, what Gray coding changes |
| 1010 Takeaways | your results with their provenance; all 131 theorems re-checked in the browser |

Each chapter shows the statements of the Lean theorems behind it, verbatim, with a button that runs the theorem's finite check in the browser (the proofs themselves live in the project's private Lean repository). The site is static (no build step, no server): vanilla ES modules, three.js for the 3D view, data from `files.rcsb.org` / `data.rcsb.org` / `search.rcsb.org`. Tests: `node docs/tests/qm.test.mjs` (minimiser against the campaign numbers), `node poster/sitetest.mjs <outdir> 1FNA/A 1BNA/A+B 1EHZ/A` (every chapter, phone and desktop, in headless Chrome).
