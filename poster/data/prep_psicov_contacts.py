"""Export the 150 PSICOV native contact maps (C-beta < 8 A, C-alpha for Gly, |i-j| >= 6) and
native sequences for the exact-results pipeline (exact_psicov.mjs).

    /store/shuvam/.venv/bin/python poster/data/prep_psicov_contacts.py

Uses co-evolution-analysis/scripts/kmap_structure.py read-only; its RAW path is stale (the data
moved to data/protein_legacy/psicov150 on 12 Sep), so it is overridden here in memory.
"""
import json, sys
from pathlib import Path

REPO = Path("/store/shuvam/E-motioner-X-SBS/co-evolution-analysis")
sys.path.insert(0, str(REPO / "scripts"))
import kmap_structure as ks  # noqa: E402

ks.RAW = REPO / "data" / "protein_legacy" / "psicov150" / "raw"
OUT = Path(__file__).with_name("psicov_contacts.json")

rows = []
for t in ks.list_targets():
    pd = ks.load_protein(t, load_dense=False)
    seq = "".join(l.strip() for l in open(ks.RAW / "seq" / f"{t}.fasta") if not l.startswith(">"))[: pd.n_cols]
    rows.append({"target": t, "length": int(pd.n_cols), "sequence": seq,
                 "contacts": sorted([int(i), int(j)] for i, j in pd.contacts)})
total = sum(len(r["contacts"]) for r in rows)
json.dump({"source": str(ks.RAW), "definition": "C-beta (C-alpha for Gly) < 8 A, |i-j| >= 6",
           "targets": len(rows), "contacts": total, "rows": rows}, open(OUT, "w"), separators=(",", ":"))
print(f"{len(rows)} targets, {total} contacts -> {OUT}")
