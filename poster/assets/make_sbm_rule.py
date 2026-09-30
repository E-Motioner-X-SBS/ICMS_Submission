#!/usr/bin/env python3
"""Resolve the variables of one learned contact-state rule to residue pairs.

data/contact_logic_interpretation.json lists each example rule's target and
selected predictor contacts as residue pairs, but its sum-of-products `sop`
names inputs by their index in the SMOG contact list ("c5", "c0"). This script
reads that list and the raw rule record so the sbm figure can draw the rule
exactly, and writes assets/sbm_rule_<protein>.json.

Usage:  python3 assets/make_sbm_rule.py [protein] [target_index]
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
VAL = HERE.parents[2] / "kmap-sbm-validation"
protein = sys.argv[1] if len(sys.argv) > 1 else "1kms"
target_index = int(sys.argv[2]) if len(sys.argv) > 2 else 4

contacts_path = VAL / "results/sbm_topologies_v2/protein" / protein / "smog.contacts"
rules_path = VAL / "results/contact_logic/contact_logic.json"

# same columns as kmap_sbm.analysis.contact_logic.read_smog_contacts, but kept
# 1-based (SMOG atom = residue number in these C-alpha models), which is the
# numbering data/contact_logic_interpretation.json uses
pairs = []
for line in contacts_path.read_text().splitlines():
    f = line.split()
    if len(f) >= 4:
        pairs.append(sorted((int(f[1]), int(f[3]))))

entry = next(p for p in json.load(open(rules_path))["per_protein"] if p.get("target") == protein)
rule = next(r for r in entry["rules"] if r["target"] == target_index)
names = sorted(set(re.findall(r"c(\d+)", rule["sop"])), key=int)
out = {
    "protein": protein,
    "source": [str(contacts_path.relative_to(VAL.parent)), str(rules_path.relative_to(VAL.parent))],
    "residue_numbering": "1-based, along the SMOG C-alpha model chain (system.gro)",
    "n_frames": entry["n_frames"],
    "target_index": target_index,
    "target": pairs[target_index],
    "predictor_indices": rule["predictors"],
    "predictors": [pairs[i] for i in rule["predictors"]],
    "sop": rule["sop"],
    "variables": {f"c{n}": pairs[int(n)] for n in names},
    "acc_rule": rule["acc_rule"],
    "acc_qonly": rule["acc_qonly"],
    # every native (SMOG) contact within 4 residues of the target in i and j,
    # so the figure can draw the real contact-map neighbourhood
    "native_near_target": [q for q in pairs
                           if abs(q[0] - pairs[target_index][0]) <= 4
                           and abs(q[1] - pairs[target_index][1]) <= 4],
}
dst = HERE / f"sbm_rule_{protein}.json"
dst.write_text(json.dumps(out, indent=1))
print(json.dumps(out, indent=1))
