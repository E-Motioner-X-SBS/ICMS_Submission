"""Are the Spike rule pairs structural contacts? Exact answer on an Omicron BA.2 RBD structure.

    /store/shuvam/.venv/bin/python poster/data/prep_spike_rbd.py      (writes spike_rbd.json)

Reads PDB 7XB0 (Omicron BA.2 RBD with human ACE2, X-ray 2.9 A; fetched from files.rcsb.org and
cached next to this script as 7XB0.cif, which is not committed), takes the RBD chain, and computes
its contact map with the poster's protein definition: C-beta (C-alpha for Gly) closer than 8 A and
at least 6 apart in residue number. For every co-evolving pair of spike_rules.json whose two
positions lie in the RBD, it records the residues in the structure, their C-beta distance and
whether the pair is a contact. Residue numbers are the author numbers of 7XB0, which follow
Wuhan-Hu-1 (UniProt P0DTC2), the numbering of spike_rules.json.
"""
import json
import urllib.request
from pathlib import Path

import gemmi

HERE = Path(__file__).parent
PDB, CHAIN, CUT, MIN_SEP = "7XB0", "B", 8.0, 6
cif = HERE / f"{PDB}.cif"
if not cif.exists():
    urllib.request.urlretrieve(f"https://files.rcsb.org/download/{PDB}.cif", cif)
st = gemmi.read_structure(str(cif))
title = gemmi.cif.read(str(cif)).sole_block().find_value("_struct.title").strip("'\"")

pos = {}
for r in st[0][CHAIN]:
    t = gemmi.find_tabulated_residue(r.name)
    if not t or not t.is_amino_acid():
        continue
    a = r.find_atom("CA" if r.name == "GLY" else "CB", "*") or r.find_atom("CA", "*")
    pos[r.seqid.num] = (t.one_letter_code.upper(), a.pos)
nums = sorted(pos)
first, last = nums[0], nums[-1]
assert nums == list(range(first, last + 1)), "gap in the RBD chain"
dist = lambda i, j: pos[i][1].dist(pos[j][1])
contacts = [[i, j] for i in nums for j in nums if j - i >= MIN_SEP and dist(i, j) < CUT]

rules = json.load(open(HERE / "spike_rules.json"))
pairs = []
for p in rules["pairs"]:
    a, b = p["wuhan"]
    if a is None or b is None or not (first <= a <= last and first <= b <= last):
        continue
    top_i = max(p["allowed"], key=lambda x: x["count"])["pair"]          # the most common combination
    d = dist(a, b)
    pairs.append({"p": a, "q": b, "res_p": pos[a][0], "res_q": pos[b][0], "most_common": top_i,
                  "cb_distance": round(d, 2), "separation": b - a, "contact": (b - a >= MIN_SEP and d < CUT)})

out = {"pdb": PDB, "title": title, "chain": CHAIN, "first": first, "last": last, "n_residues": len(nums),
       "definition": f"C-beta (C-alpha for Gly) < {CUT} A, residue numbers >= {MIN_SEP} apart",
       "n_contacts": len(contacts), "contacts": contacts, "pairs": pairs,
       "pairs_in_contact": sum(p["contact"] for p in pairs)}
json.dump(out, open(HERE / "spike_rbd.json", "w"))
print(json.dumps({k: v for k, v in out.items() if k != "contacts"}, indent=1))
