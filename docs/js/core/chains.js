// Chain choices for a parsed structure (DOM-free: shared by the app and tools/precompute-examples.mjs).

/** Chains a visitor can pick; for nucleic acids with several strands, also all strands together. */
export function chainOptions(structure) {
  const opts = structure.chains.map((c) => ({ id: c.id, chain: c, label: `${c.id}`, sub: `${c.entityType}, ${c.length}` }));
  for (const type of ["dna", "rna"]) {
    const cs = structure.chains.filter((c) => c.entityType === type);
    if (cs.length >= 2 && cs.length <= 4) {
      const residues = cs.flatMap((c) => c.residues);
      const merged = { ...cs[0], uid: `${structure.id}/${cs.map((c) => c.id).join("+")}`, id: cs.map((c) => c.id).join("+"),
        residues, seq: cs.map((c) => c.seq).join(""), seqCanonical: cs.map((c) => c.seqCanonical ?? c.seq).join(""), length: residues.length,
        strands: cs.map((c) => ({ id: c.id, length: c.length })), notes: cs.flatMap((c) => c.notes || []) };
      opts.unshift({ id: merged.id, chain: merged, label: `${merged.id}`, sub: `all ${type === "dna" ? "DNA" : "RNA"} strands, ${merged.length}` });
    }
  }
  return opts;
}
