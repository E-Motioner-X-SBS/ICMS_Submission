"""Contact rules that hold in EVERY frame of structure-based-model folding trajectories.

    /store/shuvam/.venv/bin/python poster/data/prep_sbm_exact.py

A native contact is formed in a frame when its C-alpha distance is below 1.2 x its native
distance (kmap-sbm-validation, contact_logic.load_contact_states, read-only). For each protein the
trajectory is a binary frames x contacts matrix S. A rule

    a => t        "whenever contact a is formed, contact t is formed"

is kept when it holds in every frame (zero counterexamples) and is not trivial: a is formed in at
least MIN_SUPPORT frames and t is broken in at least MIN_BROKEN frames. Two-input rules
a AND b => t are kept when they hold in every frame, a AND b is true in >= MIN_SUPPORT frames, and
neither a => t nor b => t holds on its own. Counts are exhaustive over all frames; nothing is fitted.
"""
import json
import sys
import time
import warnings
from pathlib import Path

import numpy as np

REPO = Path("/store/shuvam/E-motioner-X-SBS/kmap-sbm-validation")
sys.path.insert(0, str(REPO / "src"))
from kmap_sbm.analysis import contact_logic as cl  # noqa: E402

warnings.filterwarnings("ignore")
OUT = Path(__file__).with_name("sbm_exact.json")
MIN_SUPPORT, MIN_BROKEN, MIN_FRAMES = 20, 5, 50
NEIGHBOUR_L1 = 2              # contacts (i,j), (k,l) are neighbours on the map when |i-k| + |j-l| <= 2
DENSE = ["1yrf", "1yri", "1m1q", "1j0o", "1m1r", "1j0p", "1jxy", "1jxu", "1CBN", "1C75"]


def rules_for(S, pairs, two_input=True):
    """S: frames x contacts (0/1, only contacts that vary). Exhaustive every-frame rules."""
    F = S.shape[0]
    S = S.astype(np.int32)
    co = S.T @ S                                   # co[a, t] = frames with a and t both formed
    n1 = S.sum(0)
    n0 = F - n1
    off = ~np.eye(len(n1), dtype=bool)
    imp = (co == n1[:, None]) & off & (n1[:, None] >= MIN_SUPPORT) & (n0[None, :] >= MIN_BROKEN)
    ia, it = np.nonzero(imp)
    l1 = np.abs(pairs[ia, 0] - pairs[it, 0]) + np.abs(pairs[ia, 1] - pairs[it, 1])
    out = {"implications": int(imp.sum()), "neighbour_implications": int((l1 <= NEIGHBOUR_L1).sum())}
    # identical columns: exact equivalences a <=> t
    cols = {}
    for k in range(S.shape[1]):
        cols.setdefault(S[:, k].tobytes(), []).append(k)
    out["equivalences"] = int(sum(len(v) * (len(v) - 1) // 2 for v in cols.values()))
    best = None
    if len(ia):
        order = np.lexsort((-n0[it], -n1[ia], l1))       # neighbours first, then largest support
        k = order[0]
        best = (int(ia[k]), int(it[k]), int(l1[k]))
    out["two_input"] = 0
    if two_input and S.shape[1] <= 400:
        # a AND b => t, not implied by a => t or b => t alone
        imp1 = (co == n1[:, None])
        nV = S.shape[1]
        cnt = 0
        for a in range(nV):
            sa = S[:, a].astype(bool)
            if sa.sum() < MIN_SUPPORT:
                continue
            ab = S[sa][:, a + 1:]                       # frames where a holds, partners b > a
            n_ab = ab.sum(0)                            # frames with a and b
            ok_b = np.nonzero(n_ab >= MIN_SUPPORT)[0]
            if not len(ok_b):
                continue
            Sa = S[sa]
            for bb in ok_b:
                b = a + 1 + bb
                frames = Sa[ab[:, bb].astype(bool)]     # frames with a and b formed
                holds = frames.min(0) == 1              # t formed in every such frame
                holds &= n0 >= MIN_BROKEN
                holds &= ~imp1[a] & ~imp1[b]
                holds[[a, b]] = False
                cnt += int(holds.sum())
        out["two_input"] = cnt
    return out, best


def check_rule_by_loop(S, a, t):
    """Independent check: walk every frame."""
    bad = 0
    for f in range(S.shape[0]):
        if S[f, a] == 1 and S[f, t] == 0:
            bad += 1
    return bad


def analyse(target, traj_root="trajectories_v2"):
    cs = cl.load_contact_states(target, REPO, traj_root=traj_root)
    S = cs.states[:, cs.varying].astype(np.int8)
    pairs = cs.pairs[cs.varying]
    F = S.shape[0]
    if F < MIN_FRAMES:
        return None
    r, best = rules_for(S, pairs, two_input=False)   # single-input rules only (two-input search is optional)
    row = {"target": target, "frames": int(F), "contacts": int(cs.states.shape[1]), "varying": int(S.shape[1]), **r}
    if best:
        a, t, l1 = best
        row["example"] = {
            "if": [int(x) + 1 for x in pairs[a]], "then": [int(x) + 1 for x in pairs[t]], "l1": l1,      # 1-based residues
            "if_formed": int(S[:, a].sum()), "then_formed": int(S[:, t].sum()), "frames": int(F),
            "counterexamples": check_rule_by_loop(S, a, t),
        }
    return row


t0 = time.time()
d = json.load(open(REPO / "results" / "contact_logic" / "contact_logic.json"))
targets = [p["target"] for p in d["per_protein"] if "rules" in p]
rows, seen = [], set()
for tg in targets:
    try:
        row = analyse(tg)
    except Exception as e:                                # noqa: BLE001
        row = {"target": tg, "error": str(e)}
    if row:
        row["duplicate_id"] = tg.upper() in seen
        seen.add(tg.upper())
        rows.append(row)
dense = []
for tg in DENSE:
    try:
        row = analyse(tg, traj_root="trajectories_dense")
        if row:
            dense.append(row)
    except Exception as e:                                # noqa: BLE001
        dense.append({"target": tg, "error": str(e)})

ok = [r for r in rows if "error" not in r]
uniq = [r for r in ok if not r["duplicate_id"]]


def tot(rs):
    return {
        "proteins": len(rs), "frames": int(sum(r["frames"] for r in rs)),
        "with_rules": sum(1 for r in rs if r["implications"] > 0),
        "implications": int(sum(r["implications"] for r in rs)),
        "neighbour_implications": int(sum(r["neighbour_implications"] for r in rs)),
        "with_neighbour_rules": sum(1 for r in rs if r["neighbour_implications"] > 0),
        "equivalences": int(sum(r["equivalences"] for r in rs)),
        "two_input": int(sum(r.get("two_input", 0) for r in rs)),
        "counterexamples_in_examples": int(sum(r.get("example", {}).get("counterexamples", 0) for r in rs)),
    }


out = {
    "definition": "contact formed when C-alpha distance < 1.2 x native (SMOG2 C-alpha model); rule holds in every frame",
    "thresholds": {"min_support_frames": MIN_SUPPORT, "min_broken_frames": MIN_BROKEN, "min_frames": MIN_FRAMES, "neighbour_l1": NEIGHBOUR_L1},
    "source": str(REPO / "results"), "runtime_s": round(time.time() - t0, 1),
    "all_runs": tot(ok), "unique_ids": tot(uniq), "dense": {"totals": tot([r for r in dense if "error" not in r]), "rows": dense},
    "errors": [r for r in rows if "error" in r], "rows": ok,
}
json.dump(out, open(OUT, "w"))
print(json.dumps({k: out[k] for k in ("all_runs", "unique_ids", "runtime_s")}, indent=1))
print("dense", json.dumps(out["dense"]["totals"]))
for r in dense:
    if "example" in r:
        print(r["target"], r["frames"], r["implications"], r["neighbour_implications"], r["example"])
