"""Is there any exception-free contact rule on residue chemistry alone? Exact count over PSICOV-150.

    python3 poster/data/prep_absence.py      (reads psicov_contacts.json; writes absence.json)

Every residue pair with sequence separation >= 6 in the 150 native chains is put in a cell
(chemical group of residue i, chemical group of residue j, separation bin), with the seven groups of
the code and the separation bins of ContactCircuits.lean (6-10, 11-20, 21-30, >= 31). A rule "cell =>
contact" or "cell => no contact" holds without exception only if the cell is pure. Counted exactly.
"""
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
GROUPS = {"hydrophobic": "AVLI", "aromatic": "FYW", "sulfur": "MC", "breaker": "PG", "polar": "STNQ", "negative": "DE", "positive": "HKR"}
G = {a: g for g, aas in GROUPS.items() for a in aas}
def sbin(s): return 0 if s <= 10 else 1 if s <= 20 else 2 if s <= 30 else 3
d = json.load(open(HERE / "psicov_contacts.json"))
cells = defaultdict(lambda: [0, 0])          # [contacts, non-contacts]
pairs = 0
for r in d["rows"]:
    L, seq = r["length"], r["sequence"]; C = {tuple(c) for c in r["contacts"]}
    for i in range(L):
        for j in range(i + 6, L):
            if seq[i] not in G or seq[j] not in G: continue
            key = (G[seq[i]], G[seq[j]], sbin(j - i)); cells[key][(i, j) not in C] += 1; pairs += 1
pure_contact = [k for k, (c, n) in cells.items() if n == 0 and c > 0]
pure_none = [k for k, (c, n) in cells.items() if c == 0 and n > 0]
out = {"proteins": d["targets"], "pairs": pairs, "contacts": sum(c for c, n in cells.values()), "cells": len(cells), "possible_cells": 7 * 7 * 4,
       "mixed": sum(1 for c, n in cells.values() if c and n), "pure_contact": len(pure_contact), "pure_no_contact": len(pure_none),
       "pure_no_contact_cells": [list(k) + cells[k] for k in pure_none][:20]}
json.dump(out, open(HERE / "absence.json", "w"), indent=1)
print(json.dumps({k: v for k, v in out.items() if k != "pure_no_contact_cells"}), out["pure_no_contact_cells"][:5])
