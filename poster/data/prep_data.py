#!/usr/bin/env python3
"""Export the real data the poster's figures are drawn from.

Everything here is computed by the project's own code, not typed in:

  contact_1fnaA.json   native contact map of PSICOV target 1fnaA (fibronectin
                       type-III domain), its minimal Boolean circuit, the
                       segment x segment block cubes (the same definition as
                       run_sequence_circuit_campaign._contact_stats), the
                       sequence, and C-alpha / C-beta coordinates for the 3D view.
  campaign.json        headline statistics of the 150-protein contact campaign
                       and the information-ceiling table.

Run:  /store/shuvam/.venv/bin/python data/prep_data.py
"""

import json
import sys
from pathlib import Path

ROOT = Path("/store/shuvam/E-motioner-X-SBS/co-evolution-analysis")
sys.path.insert(0, str(ROOT / "scripts"))
import kmap_structure as ks          # noqa: E402
import sequence_circuits as sc       # noqa: E402

# The PSICOV data moved to data/protein_legacy/ in the Sep 12 RNA reorganisation;
# kmap_structure.RAW still names the old path, so point it at the new one here.
ks.RAW = ROOT / "data" / "protein_legacy" / "psicov150" / "raw"

OUT = Path(__file__).resolve().parent
TARGET = "1fnaA"


def coords(pdb: Path, n_cols: int):
    """C-alpha and C-beta (C-alpha for Gly) per residue, in chain order."""
    ca, cb, order = {}, {}, []
    for line in pdb.read_text().splitlines():
        if not line.startswith("ATOM"):
            continue
        name, resseq = line[12:16].strip(), line[22:27]
        xyz = [float(line[30:38]), float(line[38:46]), float(line[46:54])]
        if resseq not in ca and name == "CA":
            order.append(resseq)
        if name == "CA":
            ca[resseq] = xyz
        elif name == "CB":
            cb[resseq] = xyz
    order = order[:n_cols]
    return ([ca[r] for r in order], [cb.get(r, ca[r]) for r in order])


def main() -> None:
    pd = ks.load_protein(TARGET, load_dense=False)
    L = pd.n_cols
    contacts = sorted({(min(int(i), int(j)), max(int(i), int(j))) for i, j in pd.contacts})

    # Same construction and block criterion as the campaign's _contact_stats.
    circ = sc.contact_circuit_positional(contacts, L, band_as_dc=False)
    p = circ.meta["pos_bits"]
    blocks = []
    for pi in circ.cover:
        s = sc.implicant_to_segments(pi, p, L)
        if s["i"]["contiguous"] and s["j"]["contiguous"] and s["n_free"] >= 2:
            i0, i1, j0, j1 = s["i"]["start"], s["i"]["end"], s["j"]["start"], s["j"]["end"]
            if i0 <= j0:                         # keep the upper triangle only
                blocks.append({"i0": i0, "i1": i1, "j0": j0, "j1": j1,
                               "size": s["size"], "n_free": s["n_free"],
                               "mask": pi.mask, "val": pi.val})
    blocks.sort(key=lambda b: -b["size"])

    seq = (ks.RAW / "seq" / f"{TARGET}.fasta")
    seq_txt = "".join(l.strip() for l in seq.read_text().splitlines()
                      if l.strip() and not l.startswith(">")) if seq.exists() else ""
    ca, cb = coords(ks.RAW / "pdb" / f"{TARGET}.pdb", L)

    json.dump({"target": TARGET, "length": L, "pos_bits": p, "sequence": seq_txt[:L],
               "contacts": contacts, "n_on": circ.n_on, "n_cover": len(circ.cover),
               "n_primes": len(circ.primes), "sound": circ.sound, "complete": circ.complete,
               "blocks": blocks, "ca": ca, "cb": cb,
               "contact_def": f"C-beta < {ks.CONTACT_CUTOFF_A} A, |i-j| >= {ks.MIN_SEPARATION}"},
              open(OUT / "contact_1fnaA.json", "w"))

    contact = json.load(open(ROOT / "results/sequence_circuits/stage_contact.json"))
    ceiling = json.load(open(ROOT / "results/sequence_circuits/stage_ceiling.json"))
    row = next(r for r in contact["per_target"] if r["target"] == TARGET)
    json.dump({"block_fraction": contact["block_fraction"], "compression": contact["compression"],
               "n_targets": contact["n_targets"], "n_shuffles": contact["n_shuffles"],
               "target_row": row, "ceiling": ceiling}, open(OUT / "campaign.json", "w"), indent=1)

    print(f"{TARGET}: L={L}, contacts={len(contacts)}, cover={len(circ.cover)}, "
          f"blocks(upper)={len(blocks)}, sound={circ.sound}, complete={circ.complete}, seq={len(seq_txt)}")


if __name__ == "__main__":
    main()
