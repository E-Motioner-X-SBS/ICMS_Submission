"""Species-level rules that hold for 100% of the SARS-CoV-2 Spike sequences in the dataset.

    /store/shuvam/.venv/bin/python poster/data/prep_spike_rules.py

For each co-evolving column pair of the exact co-evolution campaign (stage_coevo.json), the
residue combinations are re-counted directly from the alignment: every observed combination is
ALLOWED, every combination of residues that each occur in their own column but never together is
FORBIDDEN, and implications "X at p => Y at q" are kept when they hold in every sequence with
support >= 5. Each rule is then checked against every sequence (exhaustive). Alignment columns are
mapped to Wuhan-Hu-1 numbering (UniProt P0DTC2) by a global alignment of the column consensus.
"""
import json
from collections import Counter
from pathlib import Path

from Bio import Align

REPO = Path("/store/shuvam/E-motioner-X-SBS/co-evolution-analysis")
ALN = REPO / "Spike_protein.aln-fasta"
COEVO = REPO / "results" / "sequence_circuits" / "stage_coevo.json"
SEQ = REPO / "results" / "sequence_circuits" / "stage_seq.json"
OUT = Path(__file__).with_name("spike_rules.json")
AA = set("ACDEFGHIKLMNPQRSTVWY")
MIN_SUPPORT = 5

# Wuhan-Hu-1 Spike, UniProt P0DTC2 (1,273 residues), saved from rest.uniprot.org/uniprotkb/P0DTC2.fasta
WUHAN = "".join(l.strip() for l in open(Path(__file__).with_name("P0DTC2.fasta")) if not l.startswith(">"))
assert len(WUHAN) == 1273, len(WUHAN)


def read_fasta(path):
    seqs, cur = [], []
    for line in open(path):
        if line.startswith(">"):
            if cur:
                seqs.append("".join(cur))
            cur = []
        else:
            cur.append(line.strip())
    if cur:
        seqs.append("".join(cur))
    return seqs


seqs = read_fasta(ALN)
W = len(seqs[0])
assert all(len(s) == W for s in seqs), "ragged alignment"

# column -> Wuhan position: align the per-column consensus (non-gap majority) to P0DTC2
cons_cols = []
for c in range(W):
    cnt = Counter(s[c] for s in seqs if s[c] in AA)
    if cnt and sum(cnt.values()) >= len(seqs) / 2:
        cons_cols.append((c, cnt.most_common(1)[0][0]))
cons = "".join(a for _, a in cons_cols)
aligner = Align.PairwiseAligner(mode="global", open_gap_score=-10, extend_gap_score=-0.5, match_score=2, mismatch_score=-1)
aln = aligner.align(cons, WUHAN)[0]
col2ref = {}
for (a0, a1), (b0, b1) in zip(*aln.aligned):
    for k in range(a1 - a0):
        col2ref[cons_cols[int(a0) + k][0]] = int(b0) + k + 1   # 1-based Wuhan numbering
identity = sum(cons[a0 + k] == WUHAN[b0 + k] for (a0, a1), (b0, b1) in zip(*aln.aligned) for k in range(a1 - a0)) / len(cons)

coevo = json.load(open(COEVO))
seqstage = json.load(open(SEQ))
pairs_out = []
for pr in coevo["pairs"]:
    ci, cj = pr["i"], pr["j"]                                # 0-based alignment columns (stage_coevo convention)
    rows = [(s[ci], s[cj]) for s in seqs if s[ci] in AA and s[cj] in AA]
    uniq = {s for s in seqs if s[ci] in AA and s[cj] in AA}
    n = len(rows)
    combo = Counter(rows)
    ai = sorted({a for a, _ in rows}); aj = sorted({b for _, b in rows})
    allowed = sorted(combo)
    forbidden = sorted((a, b) for a in ai for b in aj if (a, b) not in combo)
    # exhaustive checks
    viol_allowed = sum(1 for r in rows if r not in combo)
    viol_forbidden = sum(1 for r in rows if r in set(forbidden))
    # implications that hold in every sequence: residue X at p forces residue Y at q (and reverse)
    implications = []
    for side, (pp, qq) in (("i->j", (0, 1)), ("j->i", (1, 0))):
        for x in (ai if pp == 0 else aj):
            sup = [r for r in rows if r[pp] == x]
            ys = {r[qq] for r in sup}
            if len(sup) >= MIN_SUPPORT and len(ys) == 1:
                y = ys.pop()
                implications.append({"if": x, "at": "i" if pp == 0 else "j", "then": y, "support": len(sup),
                                     "counterexamples": sum(1 for r in sup if r[qq] != y)})
    pol = pr["polarities"]
    std, flp = pol["standard/off"]["summary"], pol["flipped/off"]["summary"]
    # the circuit's ON set must be exactly the allowed set (re-derived here from the alignment)
    std_alpha = (std.get("alphabet_i"), std.get("alphabet_j"))
    pairs_out.append({
        "columns": [ci, cj], "wuhan": [col2ref.get(ci), col2ref.get(cj)],
        "wuhan_ref": [WUHAN[col2ref[ci] - 1] if ci in col2ref else None, WUHAN[col2ref[cj] - 1] if cj in col2ref else None],
        "n_sequences": n, "n_unique_sequences": len(uniq), "alphabet_i": ai, "alphabet_j": aj,
        "allowed": [{"pair": a + b, "count": combo[(a, b)]} for a, b in allowed], "forbidden": [a + b for a, b in forbidden],
        "violations_of_allowed": viol_allowed, "sequences_with_forbidden": viol_forbidden,
        "implications": implications,
        "circuit": {
            "standard": {k: std[k] for k in ("n_on", "n_primes", "n_cover", "n_essential", "sound", "complete")},
            "flipped": {k: flp[k] for k in ("n_on", "n_primes", "n_cover", "n_essential", "sound", "complete")},
            "unique_minimum": std["n_cover"] == std["n_essential"] and flp["n_cover"] == flp["n_essential"],
            "matches_recount": std["n_on"] == len(allowed) and flp["n_on"] == len(forbidden) and std_alpha == (ai, aj) and std["n_sequences"] == n,
        },
    })

out = {
    "source": str(ALN), "n_sequences": len(seqs), "n_unique": len(set(seqs)), "columns": W,
    "numbering": "Wuhan-Hu-1 (UniProt P0DTC2), by global alignment of the column consensus",
    "consensus_identity_to_wuhan": round(identity, 4),
    "min_support": MIN_SUPPORT,
    "pairs": pairs_out,
    "totals": {
        "pairs": len(pairs_out),
        "allowed": sum(len(p["allowed"]) for p in pairs_out), "forbidden": sum(len(p["forbidden"]) for p in pairs_out),
        "implications": sum(len(p["implications"]) for p in pairs_out),
        "violations": sum(p["violations_of_allowed"] + p["sequences_with_forbidden"] for p in pairs_out)
        + sum(i["counterexamples"] for p in pairs_out for i in p["implications"]),
        "all_sound_complete": all(p["circuit"]["standard"]["sound"] and p["circuit"]["standard"]["complete"]
                                  and p["circuit"]["flipped"]["sound"] and p["circuit"]["flipped"]["complete"] for p in pairs_out),
        "all_unique_minimum": all(p["circuit"]["unique_minimum"] for p in pairs_out),
        "all_match_recount": all(p["circuit"]["matches_recount"] for p in pairs_out),
    },
    "sequence_circuits": {"sequences": seqstage.get("n_sequences") or seqstage.get("spike", {}).get("n_sequences"),
                          "all_lossless": seqstage.get("all_lossless"), "all_sound": seqstage.get("all_sound"), "all_complete": seqstage.get("all_complete")},
}
json.dump(out, open(OUT, "w"), indent=1)
print(json.dumps(out["totals"]), "identity", out["consensus_identity_to_wuhan"])
for p in pairs_out:
    print(p["columns"], "->", p["wuhan"], p["wuhan_ref"], "n", p["n_sequences"], "allowed", [a["pair"] for a in p["allowed"]], "forbidden", p["forbidden"],
          "imp", [(i["if"], i["at"], i["then"], i["support"]) for i in p["implications"]], "ok" if p["circuit"]["matches_recount"] else "MISMATCH")
