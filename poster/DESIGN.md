# Poster design plan — ICMS 2026 (A0 portrait, 841 × 1189 mm)

## Brief
- **Subject:** a Lean 4 formalisation of the Karnaugh-map (K-map) encoding of biological
  sequences, and what those machine-checked proofs let us do and rule out.
- **Audience:** molecular-simulation researchers (physicists, chemists, computational
  biologists). Fluent in proteins and contacts; mostly new to Gray codes, K-maps,
  Boolean minimisation and proof assistants.
- **Job:** in 10 s, the main finding; in 3 min, every concept explained through a diagram;
  the poster must work as a silent presenter.
- **Fixed by the conference:** the template header (ICMS 2026 logo + abstract number, the
  Cambria conference line, IISc and SACM logos) and the title block. Kept as given.

## Principles (what makes this poster specific)
1. **Every claim wears its evidence.** Each statement carries a small tag saying how we
   know it: `⊢ theorem_name` (proved in Lean), `◆ measured` (data, with n / p), `✎ proved
   on paper`. The poster is itself "type-checked" — the reader can see which claims the
   proofs certify and which are empirical. This is the central idea of the work, made visual.
2. **Section numbers are a Gray code.** The eight sections are numbered
   000 → 001 → 011 → 010 → 110 → 111 → 101 → 100 — consecutive numbers differ in exactly
   one bit, and that bit is marked. The reader learns the core object by reading the order.
3. **Diagrams are computed, not drawn.** Every code, grid, distance, contact and block is
   generated from the real encodings (AminoAcidEncoding.lean) and real data (PSICOV 1fnaA,
   the 150-protein campaign), so the figures are correct by construction.
4. **One accent means one thing:** orange = *the bit that flips* (Gray adjacency, one-bit
   difference, the highlighted cell). Nothing else is orange.
5. **Limits are first-class.** The trust model (`native_decide` = compiler trust) and the
   information ceiling appear as results, not footnotes.

## Tokens
| role | hex | use |
|---|---|---|
| ink | `#14304F` | text, headings (from the ICMS logo navy) |
| ink-2 | `#4A5B6E` | secondary text, captions |
| teal | `#1E86A8` | measured / data (ICMS logo teal) |
| gold | `#A8912A` | proved-in-Lean tag (ICMS logo rim) |
| flip | `#E8871E` | the flipped bit — the single accent |
| wash | `#F2F6F9` | full-width bands |
| rule | `#C9D4DE` | hairlines |
| paper | `#FFFFFF` | page |
Categorical (7 amino-acid groups, 4 nucleotides): Okabe–Ito hues, validated with the
dataviz validator; letters are printed on every node, so hue is never the only channel.

## Type
- **Caladea** (metric clone of the template's Cambria): header, title, body text — the
  template's voice, readable at 30–32 pt.
- **Archivo** (from pdoom-video-sbs, semi-condensed widths): section heads, diagram labels,
  numbers — structure and data.
- **IBM Plex Mono**: Lean identifiers and code only (they *are* code).
Sizes: title 96 pt, section head 54 pt, body 31 pt, captions 25 pt, diagram labels ≥ 22 pt.

## Layout
```
┌──────────────── template header (logos · abstract no. · conference) ───────────────┐
├──────────────── template title block ──────────────────────────────────────────────┤
│ 000  main finding (large, plain)        │  3D hero: 1fnaA with its Boolean blocks   │
│      pipeline: sequence→bits→Gray→K-map→prime implicants, each hop ⊢-tagged          │
├──────────────────────────────┬────────────────────────────────────────────────────┤
│ 001 Gray code                │ 111 How Lean checks a claim (native_decide, trust) │
│ 011 K-maps & k-mer indexing  │ 101 What the proofs bought                          │
│ 010 Amino acids on a 5-cube  │     bug caught · claim refused · GF(2) linearity    │
│ 110 Contact maps & QM        │ 100 What it means for structure (blocks, ceiling)   │
├──────────────────────────────┴────────────────────────────────────────────────────┤
│ conclusions · evidence-tag legend · references · repositories                        │
└────────────────────────────────────────────────────────────────────────────────────┘
```
Left-aligned text, ragged right, 45–65 characters per line. Open layout: sections separated
by whitespace and hairlines, not boxed cards; the two full-width bands take the pale wash.

## Review against the generic defaults
- Not cream + serif + terracotta, not dark + acid accent, not broadsheet hairlines-only,
  not a SaaS card grid (the template's rounded boxes stay only where the template puts them).
- Numbered markers are justified: the content *is* a sequence, and the numbering itself is
  the Gray code being explained.
- Mono is used only for literal Lean identifiers, not as data-label chrome.
