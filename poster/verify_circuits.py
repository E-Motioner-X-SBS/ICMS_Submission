"""Independent end-to-end check (usage: python verify_circuits.py <dir containing e2e*/ *.pla from e2e.mjs>): gemmi parses the structure and computes contacts; the PLA the
website exported is evaluated on every (i, j); both must agree on every cell."""
import sys, glob, os, urllib.request
import numpy as np, gemmi
SCR = sys.argv[1] if len(sys.argv) > 1 else "/tmp/claude-1000/-store-shuvam-E-motioner-X-SBS/9bd3c692-cfe5-4b5a-8cf1-ce5c1a2d74a5/scratchpad"
EX = "/store/shuvam/E-motioner-X-SBS/ICMS_Submission/docs/examples"
def cif(pdb):
    p = f"{EX}/{pdb}.cif"
    if os.path.exists(p): return p
    q = f"{SCR}/{pdb}.cif"
    if not os.path.exists(q): urllib.request.urlretrieve(f"https://files.rcsb.org/download/{pdb}.cif", q)
    return q
def residues(st, chain_ids):
    model = st[0]; out = []
    for cid in chain_ids:
        ch = model[cid]
        for r in ch.get_polymer(): out.append(r)
    return out
def rep(r, protein):
    names = [a.name for a in r]
    if protein:
        prim = "CA" if r.name == "GLY" else "CB"
        for n in (prim, "CA"):
            if n in names: return r[n][0].pos
    else:
        for n in ("C1'", "P"):
            if n in names: return r[n][0].pos
    return None
def contacts(pdb, chain_ids):
    st = gemmi.read_structure(cif(pdb)); st.setup_entities()
    rs = residues(st, chain_ids)
    protein = gemmi.find_tabulated_residue(rs[0].name).is_amino_acid()
    cut, sep = (8.0, 6) if protein else (10.0, 3)
    pos = [rep(r, protein) for r in rs]
    # strand of each residue and its label_seq_id: separation counts along one strand, by sequence number
    strand = []; seqid = []
    for k, cid in enumerate(chain_ids):
        for r in st[0][cid].get_polymer(): strand.append(k); seqid.append(r.label_seq)
    L = len(rs); C = set()
    for i in range(L):
        if pos[i] is None: continue
        for j in range(i + 1, L):
            if strand[i] == strand[j] and seqid[j] - seqid[i] < sep: continue
            if pos[j] is not None and pos[i].dist(pos[j]) < cut: C.add((i, j))
    return L, C
def pla_eval(path):
    lines = open(path).read().split("\n")
    n = int([l for l in lines if l.startswith(".i ")][0].split()[1]); p = n // 2
    rows = [l.split()[0] for l in lines if l and l[0] in "01-" and l.endswith(" 1")]
    def fires(i, j):
        bits = format(i, f"0{p}b") + format(j, f"0{p}b")
        return any(all(c == "-" or c == b for c, b in zip(row, bits)) for row in rows)
    return p, rows, fires
bad = 0
for f in sorted(glob.glob(f"{SCR}/e2e*/*.pla")):
    name = os.path.basename(f)[:-4]; pdb, ch = name.split("_")
    chain_ids = list(ch) if len(ch) > 1 and pdb in ("1BNA",) else [ch]
    L, C = contacts(pdb, chain_ids)
    p, rows, fires = pla_eval(f)
    # vectorised: evaluate every cell of the 2^p x 2^p table
    N = 1 << p
    pat = np.array([[c for c in r] for r in rows]) if rows else np.zeros((0, 2 * p), dtype="<U1")
    allbits = np.array([[(x >> (2 * p - 1 - k)) & 1 for k in range(2 * p)] for x in range(N * N)], dtype=np.int8) if N <= 1024 else None
    if allbits is not None and len(rows):
        fixed = (pat != "-"); want = np.where(pat == "1", 1, 0).astype(np.int8)
        out = np.zeros(N * N, dtype=bool)
        for k in range(len(rows)):
            m = fixed[k]; out |= (allbits[:, m] == want[k, m]).all(1)
    else:
        out = np.zeros(N * N, dtype=bool) if allbits is not None else None
    if out is None: print(name, "too large for the dense check"); continue
    truth = np.zeros(N * N, dtype=bool)
    for i, j in C: truth[i * N + j] = truth[j * N + i] = True
    agree = int((out == truth).sum())
    ok = agree == N * N
    bad += not ok
    print(f"{name:10s} L={L:4d} gemmi contacts={len(C):5d} PLA rows={len(rows):5d} cells agree {agree}/{N*N} {'OK' if ok else 'MISMATCH'}")
print("mismatches:", bad)
