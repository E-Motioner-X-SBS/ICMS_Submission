// Data layer: the RCSB Protein Data Bank (search, metadata, mmCIF coordinates) and an mmCIF
// parser. DOM-free apart from fetch; parseCif also runs in workers and Node.
//
// Conference Wi-Fi is unreliable, so: the five EXAMPLES are bundled in docs/examples/ and
// load without network; every remote request has a timeout; coordinates fall back from
// files.rcsb.org to models.rcsb.org to PDBe; every failure becomes an RcsbError whose
// `userMessage` is safe to show as is.

import { AA3, AA_NONSTANDARD, NA3, AA_CODE } from "./encoding.js";
import { sentenceCase, species, method as methodName } from "./format.js";

export const EXAMPLES = Object.freeze([
  { id: "1FNA", chain: "A", kind: "protein", name: "Fibronectin domain", blurb: "β-sandwich, 91 residues. The poster's protein." },
  { id: "1UBQ", chain: "A", kind: "protein", name: "Ubiquitin", blurb: "Small and famous, 76 residues." },
  { id: "2CI2", chain: "I", kind: "protein", name: "Chymotrypsin inhibitor 2", blurb: "A classic folding model, 65 residues modelled." },
  { id: "1BNA", chain: "A", kind: "dna", name: "B-DNA dodecamer", blurb: "Two strands of 12 bases." },
  { id: "1EHZ", chain: "A", kind: "rna", name: "Transfer RNA (Phe)", blurb: "76 nucleotides folded into an L." },
].map(Object.freeze));
export const isExample = (id) => EXAMPLES.some((e) => e.id === id);
export const DEFAULT_EXAMPLE = EXAMPLES[0];

const SEARCH_URL = "https://search.rcsb.org/rcsbsearch/v2/query";
const GRAPHQL_URL = "https://data.rcsb.org/graphql";
const ENTRY_URL = (id) => `https://data.rcsb.org/rest/v1/core/entry/${id}`;
const POLYMER_URL = (id, entity) => `https://data.rcsb.org/rest/v1/core/polymer_entity/${id}/${entity}`;
const CIF_SOURCES = [
  { name: "rcsb", url: (id) => `https://files.rcsb.org/download/${id}.cif` },
  { name: "rcsb-models", url: (id) => `https://models.rcsb.org/v1/${id}/full?encoding=cif` },
  { name: "pdbe", url: (id) => `https://www.ebi.ac.uk/pdbe/entry-files/download/${id.toLowerCase()}.cif` },
];
const MAX_BYTES = 80e6;                 // decoded mmCIF; beyond this a phone struggles
const KEEP_ATOMS = new Set(["CA", "CB", "N", "C", "O", "P", "C1'", "C4'", "O3'", "N1", "N3"]);   // N1/N3: base pairing (chapter 1101)

// ── Errors ───────────────────────────────────────────────────────────────────
export class RcsbError extends Error {
  /** kind: 'bad-id' | 'not-found' | 'network' | 'timeout' | 'too-large' | 'parse' | 'no-polymer' | 'aborted' */
  constructor(kind, userMessage, detail) {
    super(userMessage + (detail ? ` (${detail})` : ""));
    this.name = "RcsbError"; this.kind = kind; this.userMessage = userMessage; this.detail = detail;
  }
}
const OFFLINE_HINT = "The five examples work without a connection.";

// ── IDs ──────────────────────────────────────────────────────────────────────
/** "1fna" → "1FNA"; also accepts extended ids "pdb_00001fna". Returns null if not a PDB id. */
export function normalizeId(s) {
  if (typeof s !== "string") return null;
  const t = s.trim().toUpperCase();
  if (/^[0-9][A-Z0-9]{3}$/.test(t)) return t;
  const m = /^PDB_0000([0-9][A-Z0-9]{3})$/.exec(t);
  if (m) return m[1];
  if (/^PDB_[0-9]{4}[0-9][A-Z0-9]{3}$/.test(t)) return t;
  return null;
}

// ── Fetch helpers ────────────────────────────────────────────────────────────
function linkSignals(outer, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(new DOMException("timeout", "TimeoutError")), ms);
  const onAbort = () => ctl.abort(outer.reason);
  if (outer) { if (outer.aborted) ctl.abort(outer.reason); else outer.addEventListener("abort", onAbort, { once: true }); }
  return { signal: ctl.signal, done: () => { clearTimeout(timer); outer?.removeEventListener("abort", onAbort); } };
}
async function request(url, { signal, timeoutMs = 15000, method = "GET", body, headers, onProgress, as = "json" } = {}) {
  const link = linkSignals(signal, timeoutMs);
  try {
    let res;
    try {
      res = await fetch(url, { method, body, headers, signal: link.signal, mode: "cors" });
    } catch (e) {
      if (signal?.aborted) throw new RcsbError("aborted", "Cancelled.");
      if (link.signal.aborted) throw new RcsbError("timeout", "The Protein Data Bank did not answer in time.", url);
      throw new RcsbError("network", "The Protein Data Bank could not be reached.", `${url}: ${e.message}`);
    }
    if (res.status === 404) throw new RcsbError("not-found", "Not found.", url);
    if (res.status === 204) return as === "json" ? null : "";
    if (!res.ok) throw new RcsbError("network", `The Protein Data Bank answered with an error (HTTP ${res.status}).`, url);
    if (as === "json") return await res.json();
    // text, streamed for progress and a size cap
    const total = Number(res.headers.get("content-length")) || 0;
    if (!res.body || !res.body.getReader) { const t = await res.text(); onProgress?.({ loaded: t.length, total: t.length }); return t; }
    const reader = res.body.getReader(), dec = new TextDecoder(), parts = [];
    let loaded = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      loaded += value.byteLength;
      if (loaded > MAX_BYTES) { reader.cancel(); throw new RcsbError("too-large", `This entry is too large to explore on a phone (over ${Math.round(MAX_BYTES / 1e6)} MB). Try a smaller structure.`); }
      parts.push(dec.decode(value, { stream: true }));
      onProgress?.({ loaded, total });
    }
    parts.push(dec.decode());
    return parts.join("");
  } catch (e) {
    if (e instanceof RcsbError) throw e;
    if (signal?.aborted) throw new RcsbError("aborted", "Cancelled.");
    if (link.signal.aborted) throw new RcsbError("timeout", "The Protein Data Bank did not answer in time.", url);
    throw new RcsbError("network", "The download was interrupted.", e.message);
  } finally { link.done(); }
}

// ── mmCIF tokenizer ──────────────────────────────────────────────────────────
// Tokens: data_ blocks, loop_, _category.item tags, values (bare, 'single', "double" quoted,
// ;semicolon text fields;). An unquoted "." or "?" is a null value.
class Tokenizer {
  constructor(text) { this.s = text; this.i = 0; this.n = text.length; this.quoted = false; }
  next() {
    const s = this.s, n = this.n;
    let i = this.i;
    for (;;) {                                           // skip whitespace and comments
      while (i < n) { const c = s.charCodeAt(i); if (c === 32 || c === 9 || c === 10 || c === 13) i++; else break; }
      if (i < n && s.charCodeAt(i) === 35) { const e = s.indexOf("\n", i); i = e < 0 ? n : e + 1; continue; }
      break;
    }
    if (i >= n) { this.i = n; return null; }
    const c = s.charCodeAt(i);
    if (c === 59 && (i === 0 || s.charCodeAt(i - 1) === 10)) {   // ; text field at line start
      let e = s.indexOf("\n;", i + 1);
      if (e < 0) e = n;
      const v = s.slice(i + 1, e).replace(/^\r?\n/, "").replace(/\r?\n$/, "");
      this.i = Math.min(n, e + 2); this.quoted = true; return v;
    }
    if (c === 39 || c === 34) {                          // quoted: ends at quote + whitespace
      let j = i + 1;
      for (;;) {
        j = s.indexOf(s[i], j);
        if (j < 0) { j = n; break; }
        const d = j + 1 < n ? s.charCodeAt(j + 1) : 32;
        if (d === 32 || d === 9 || d === 10 || d === 13) break;
        j++;
      }
      this.i = j + 1; this.quoted = true; return s.slice(i + 1, j);
    }
    let j = i + 1;
    while (j < n) { const d = s.charCodeAt(j); if (d === 32 || d === 9 || d === 10 || d === 13) break; j++; }
    this.i = j; this.quoted = false; return s.slice(i, j);
  }
}

const KEEP_CATEGORIES = new Set(["_entry", "_struct", "_struct_keywords", "_exptl", "_refine", "_reflns", "_em_3d_reconstruction",
  "_entity", "_entity_poly", "_entity_src_gen", "_entity_src_nat", "_pdbx_entity_src_syn", "_pdbx_database_status", "_pdbx_audit_revision_history"]);
const catOf = (tag) => { const k = tag.indexOf("."); return k < 0 ? tag : tag.slice(0, k); };
const itemOf = (tag) => tag.slice(tag.indexOf(".") + 1);

/** Low-level: categories as arrays of row objects, plus the filtered atom list. */
function readCif(text) {
  const T = new Tokenizer(text);
  const cats = Object.create(null);
  const atoms = [];
  let block = null, t = T.next(), pending = null;
  const put = (cat, row) => { (cats[cat] ||= []).push(row); };
  let singleRow = null, singleCat = null;
  const flushSingle = () => { if (singleCat) put(singleCat, singleRow); singleCat = null; singleRow = null; };
  const val = (v, q) => (!q && (v === "." || v === "?") ? null : v);
  while (t !== null) {
    if (!T.quoted && t.startsWith("data_")) {
      flushSingle();
      if (block !== null) break;                       // first data block only
      block = t.slice(5); t = T.next(); continue;
    }
    if (!T.quoted && t === "loop_") {
      flushSingle();
      const tags = [];
      t = T.next();
      while (t !== null && !T.quoted && t[0] === "_") { tags.push(t); t = T.next(); }
      const cat = tags.length ? catOf(tags[0]) : "";
      const items = tags.map(itemOf), nc = items.length;
      const isAtoms = cat === "_atom_site", keep = KEEP_CATEGORIES.has(cat);
      let col = null;
      if (isAtoms) {
        const ix = (k) => items.indexOf(k);
        col = {
          group: ix("group_PDB"), atom: ix("label_atom_id"), authAtom: ix("auth_atom_id"), alt: ix("label_alt_id"), comp: ix("label_comp_id"),
          asym: ix("label_asym_id"), entity: ix("label_entity_id"), seq: ix("label_seq_id"), ins: ix("pdbx_PDB_ins_code"),
          x: ix("Cartn_x"), y: ix("Cartn_y"), z: ix("Cartn_z"), authSeq: ix("auth_seq_id"), authAsym: ix("auth_asym_id"), model: ix("pdbx_PDB_model_num"),
          el: ix("type_symbol"),
        };
      }
      const row = new Array(nc), q = new Array(nc);
      let k = 0;
      while (t !== null && (T.quoted || !(t[0] === "_" || t === "loop_" || t.startsWith("data_")))) {
        row[k] = t; q[k] = T.quoted; k++;
        if (k === nc) {
          k = 0;
          if (isAtoms) {
            const name = row[col.atom >= 0 ? col.atom : col.authAtom];
            if (KEEP_ATOMS.has(name) && col.seq >= 0 && row[col.seq] !== "." && row[col.seq] !== "?") {
              atoms.push({
                name, alt: val(row[col.alt], q[col.alt]), comp: row[col.comp], asym: row[col.asym], entity: row[col.entity],
                seq: +row[col.seq], authSeq: col.authSeq >= 0 ? row[col.authSeq] : row[col.seq],
                ins: col.ins >= 0 ? val(row[col.ins], q[col.ins]) : null,
                chain: col.authAsym >= 0 ? row[col.authAsym] : row[col.asym],
                model: col.model >= 0 ? row[col.model] : "1",
                xyz: [+row[col.x], +row[col.y], +row[col.z]],
              });
            }
          } else if (keep) {
            const o = {};
            for (let m = 0; m < nc; m++) o[items[m]] = val(row[m], q[m]);
            put(cat, o);
          }
        }
        t = T.next();
      }
      continue;
    }
    if (!T.quoted && t[0] === "_") {                    // tag value
      const cat = catOf(t), item = itemOf(t);
      const v = T.next(); const q = T.quoted;
      if (cat !== singleCat) { flushSingle(); if (KEEP_CATEGORIES.has(cat)) { singleCat = cat; singleRow = {}; } }
      if (singleCat === cat) singleRow[item] = v === null ? null : val(v, q);
      t = T.next(); continue;
    }
    t = T.next();                                      // stray value: skip
  }
  flushSingle();
  return { block, cats, atoms };
}

// ── Polymer typing and residue letters ───────────────────────────────────────
function entityTypeOf(polyType) {
  const p = (polyType || "").toLowerCase();
  if (p.startsWith("polypeptide")) return "protein";
  if (p === "polydeoxyribonucleotide") return "dna";
  if (p === "polyribonucleotide") return "rna";
  if (p.startsWith("polydeoxyribonucleotide/polyribonucleotide")) return "dna";   // hybrid: read as DNA, U shares T's code
  return null;
}
function letterFor(name, entityType, canLetter) {
  if (entityType === "protein") {
    if (AA3[name]) return { one: AA3[name], how: "standard" };
    if (AA_NONSTANDARD[name]) return { one: AA_NONSTANDARD[name], how: "mapped" };
    if (canLetter && canLetter in AA_CODE) return { one: canLetter, how: "parent" };
    return { one: null, how: "skipped" };
  }
  const std = NA3[name];
  if (std) return { one: std, how: "standard" };
  if (canLetter && /^[ACGTU]$/.test(canLetter)) return { one: canLetter, how: "parent" };
  return { one: null, how: "skipped" };
}

// ── parseCif ─────────────────────────────────────────────────────────────────
/**
 * parseCif(text) → Structure (see ARCHITECTURE.md). Keeps the first model, the first
 * alternate location of each atom and the first residue at each position; only the atoms
 * in KEEP_ATOMS. Throws RcsbError('parse' | 'no-polymer').
 */
export function parseCif(text, { id: idHint } = {}) {
  if (typeof text !== "string" || !/^\s*(#.*\n\s*)*data_/m.test(text.slice(0, 2000))) {
    throw new RcsbError("parse", "The file is not an mmCIF file.");
  }
  let raw;
  try { raw = readCif(text); } catch (e) { throw new RcsbError("parse", "The mmCIF file could not be read.", e.message); }
  const { cats, atoms } = raw;
  const one = (c) => (cats[c] && cats[c][0]) || {};
  const id = (one("_entry").id || raw.block || idHint || "").toUpperCase();

  // entities
  const entities = new Map();
  for (const e of cats._entity || []) entities.set(e.id, { id: e.id, type: e.type, description: e.pdbx_description || null });
  const polys = new Map();
  for (const p of cats._entity_poly || []) {
    polys.set(p.entity_id, {
      entityId: p.entity_id, polymerType: p.type, entityType: entityTypeOf(p.type),
      can: (p.pdbx_seq_one_letter_code_can || "").replace(/\s+/g, ""),
      strands: (p.pdbx_strand_id || "").split(",").map((s) => s.trim()).filter(Boolean),
    });
  }
  // organisms per entity
  const org = new Map();
  for (const r of cats._entity_src_gen || []) if (r.pdbx_gene_src_scientific_name) org.set(r.entity_id, species(r.pdbx_gene_src_scientific_name));
  for (const r of cats._entity_src_nat || []) if (r.pdbx_organism_scientific_name && !org.has(r.entity_id)) org.set(r.entity_id, species(r.pdbx_organism_scientific_name));
  for (const r of cats._pdbx_entity_src_syn || []) if (r.organism_scientific && !org.has(r.entity_id)) org.set(r.entity_id, species(r.organism_scientific));

  // residues, first model only
  const firstModel = atoms.length ? atoms[0].model : "1";
  const models = new Set(atoms.map((a) => a.model)).size;
  const chainMap = new Map();          // auth chain id → {entityId, labelIds:Set, residues: Map(seq → residue)}
  for (const a of atoms) {
    if (a.model !== firstModel) continue;
    const poly = polys.get(a.entity);
    if (!poly) continue;
    let ch = chainMap.get(a.chain);
    if (!ch) { ch = { entityId: a.entity, labelIds: new Set(), residues: new Map() }; chainMap.set(a.chain, ch); }
    if (ch.entityId !== a.entity) continue;               // a second polymer entity under the same author chain id: keep the first
    ch.labelIds.add(a.asym);
    let r = ch.residues.get(a.seq);
    if (!r) {
      r = { seqId: a.seq, authSeqId: a.authSeq + (a.ins ? a.ins : ""), name: a.comp, one: null, atoms: {} };
      ch.residues.set(a.seq, r);
    }
    if (r.name !== a.comp) continue;                      // microheterogeneity: first residue wins
    if (!(a.name in r.atoms)) r.atoms[a.name] = a.xyz;    // first alternate location wins
  }

  const chains = [], otherPolymers = [];
  for (const [chainId, ch] of chainMap) {
    const poly = polys.get(ch.entityId), ent = entities.get(ch.entityId) || {};
    if (!poly.entityType) { otherPolymers.push({ id: chainId, polymerType: poly.polymerType, description: ent.description }); continue; }
    const notes = new Map(), residues = [];
    for (const r of [...ch.residues.values()].sort((x, y) => x.seqId - y.seqId)) {
      const canLetter = poly.can.length >= r.seqId ? poly.can[r.seqId - 1] : null;
      const { one, how } = letterFor(r.name, poly.entityType, canLetter);
      if (how !== "standard") {
        const key = `${how}:${r.name}`;
        const n = notes.get(key) || { kind: how, name: r.name, one, count: 0, seqIds: [] };
        n.count++; n.seqIds.push(r.authSeqId); notes.set(key, n);
      }
      if (!one) continue;
      r.one = one; r.modified = how !== "standard";
      residues.push(r);
    }
    if (!residues.length) continue;
    chains.push({
      uid: `${id}/${chainId}`, id: chainId, labelIds: [...ch.labelIds], entityId: ch.entityId,
      entityType: poly.entityType, polymerType: poly.polymerType,
      description: ent.description ? sentenceCase(ent.description) : null, organism: org.get(ch.entityId) || null,
      residues, seq: residues.map((r) => r.one).join(""), seqCanonical: poly.can || null,
      length: residues.length, notes: [...notes.values()],
    });
  }
  if (!chains.length) throw new RcsbError("no-polymer", "This entry has no protein, DNA or RNA chain with coordinates.");

  const res = [one("_refine").ls_d_res_high, one("_reflns").d_resolution_high, one("_em_3d_reconstruction").resolution]
    .map((x) => (x == null ? NaN : parseFloat(x))).find((x) => Number.isFinite(x));
  const titleRaw = one("_struct").title || null;
  const methods = (cats._exptl || []).map((r) => r.method).filter(Boolean);
  const organisms = [...new Set(chains.map((c) => c.organism).filter(Boolean))];
  return {
    id, source: null, bytes: text.length, models,
    meta: {
      title: titleRaw ? sentenceCase(titleRaw) : id, titleRaw,
      methods: methods.map(methodName), method: methods.map(methodName).join(", ") || null,
      resolution: res ?? null,
      organisms, keywords: one("_struct_keywords").pdbx_keywords ? sentenceCase(one("_struct_keywords").pdbx_keywords) : null,
      date: one("_pdbx_database_status").recvd_initial_deposition_date || null,
    },
    chains, otherPolymers,
  };
}

/** The chain a visitor most likely wants: the first protein chain with ≥ 20 residues, else the longest chain. */
export function defaultChain(structure) {
  const ex = EXAMPLES.find((e) => e.id === structure.id);
  if (ex) { const c = structure.chains.find((c) => c.id === ex.chain); if (c) return c; }
  return structure.chains.find((c) => c.entityType === "protein" && c.length >= 20)
    || [...structure.chains].sort((a, b) => b.length - a.length)[0];
}

// ── fetchEntry ───────────────────────────────────────────────────────────────
const cache = new Map();
/**
 * fetchEntry(id, {signal, onProgress, timeoutMs}) → Promise<Structure>
 * Bundled examples load from docs/examples/ (no network). Others: files.rcsb.org, then
 * models.rcsb.org, then PDBe. onProgress({loaded, total, source}) while downloading.
 */
export async function fetchEntry(idIn, { signal, onProgress, timeoutMs = 25000 } = {}) {
  const id = normalizeId(idIn);
  if (!id) throw new RcsbError("bad-id", `"${String(idIn).trim()}" is not a PDB ID. PDB IDs have four characters, like 1UBQ.`);
  if (cache.has(id)) return cache.get(id);
  const job = (async () => {
    if (isExample(id)) {
      const url = new URL(`../../examples/${id}.cif`, import.meta.url);
      const text = await request(url.href, { signal, timeoutMs: 15000, as: "text", onProgress: (p) => onProgress?.({ ...p, source: "offline" }) });
      const s = parseCif(text, { id });
      s.source = "offline";
      return s;
    }
    let notFound = 0, lastErr = null;
    for (const src of CIF_SOURCES) {
      try {
        const text = await request(src.url(id), { signal, timeoutMs, as: "text", onProgress: (p) => onProgress?.({ ...p, source: src.name }) });
        const s = parseCif(text, { id });
        s.source = src.name;
        return s;
      } catch (e) {
        if (e.kind === "aborted" || e.kind === "too-large" || e.kind === "no-polymer") throw e;
        if (e.kind === "not-found") notFound++;
        lastErr = e;
      }
    }
    if (notFound === CIF_SOURCES.length || (notFound && lastErr?.kind === "not-found")) {
      throw new RcsbError("not-found", `No entry ${id} in the Protein Data Bank. Check the four characters, or pick an example.`);
    }
    if (lastErr?.kind === "parse") throw lastErr;
    throw new RcsbError(lastErr?.kind === "timeout" ? "timeout" : "network",
      `${id} could not be downloaded: the Protein Data Bank did not answer. ${OFFLINE_HINT}`, lastErr?.detail);
  })();
  cache.set(id, job);
  try { return await job; } catch (e) { cache.delete(id); throw e; }
}

// ── search ───────────────────────────────────────────────────────────────────
const SUMMARY_QUERY = `query($ids:[String!]!){entries(entry_ids:$ids){rcsb_id struct{title} exptl{method}
 rcsb_entry_info{resolution_combined deposited_polymer_monomer_count polymer_entity_count_protein polymer_entity_count_nucleic_acid}
 polymer_entities{entity_poly{type} rcsb_entity_source_organism{scientific_name}}}}`;

/** Titles, methods and polymer kinds for several entries in one request. Map id → Summary. */
export async function summaries(ids, { signal, timeoutMs = 12000 } = {}) {
  if (!ids.length) return new Map();
  const data = await request(GRAPHQL_URL, {
    signal, timeoutMs, method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: SUMMARY_QUERY, variables: { ids } }),
  });
  const out = new Map();
  for (const e of data?.data?.entries || []) {
    if (!e) continue;
    const kinds = new Set();
    for (const p of e.polymer_entities || []) { const k = entityTypeOf(p?.entity_poly?.type); if (k) kinds.add(k); }
    const orgs = [...new Set((e.polymer_entities || []).flatMap((p) => (p.rcsb_entity_source_organism || []).map((o) => species(o.scientific_name))).filter(Boolean))];
    out.set(e.rcsb_id, {
      id: e.rcsb_id, title: sentenceCase(e.struct?.title || e.rcsb_id),
      method: (e.exptl || []).map((x) => methodName(x.method)).join(", ") || null,
      resolution: e.rcsb_entry_info?.resolution_combined?.[0] ?? null,
      monomers: e.rcsb_entry_info?.deposited_polymer_monomer_count ?? null,
      kinds: [...kinds], organisms: orgs,
    });
  }
  return out;
}

/**
 * search(query, {signal, rows}) → Promise<{total, results: Summary[]}>
 * Full-text search of the PDB; a query that is itself a PDB ID comes first. Summaries are
 * filled in from one GraphQL request; if that fails the results carry ids only.
 */
export async function search(query, { signal, rows = 10, timeoutMs = 12000 } = {}) {
  const q = (query || "").trim();
  if (!q) return { total: 0, results: [] };
  const asId = normalizeId(q);
  const body = {
    query: { type: "terminal", service: "full_text", parameters: { value: q } },
    return_type: "entry", request_options: { paginate: { start: 0, rows }, results_content_type: ["experimental"] },
  };
  let ids = [], total = 0;
  try {
    const r = await request(SEARCH_URL, { signal, timeoutMs, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    ids = (r?.result_set || []).map((x) => x.identifier);
    total = r?.total_count || ids.length;
  } catch (e) {
    if (e.kind === "not-found") { ids = []; total = 0; }       // the search API answers 204/404 for no hits
    else if (!asId) throw new RcsbError(e.kind, `Search is unavailable right now: ${e.userMessage} ${OFFLINE_HINT}`, e.detail);
  }
  if (asId) { ids = [asId, ...ids.filter((x) => x !== asId)]; total = Math.max(total, 1); }
  let meta = new Map();
  try { meta = await summaries(ids, { signal, timeoutMs }); } catch { /* ids only */ }
  return { total, results: ids.map((id) => meta.get(id) || { id, title: null, method: null, resolution: null, kinds: [], organisms: [] }) };
}

/** Optional REST lookups (entry, polymer entity), for chapters that want more metadata. */
export const entryMeta = (id, opts) => request(ENTRY_URL(normalizeId(id)), opts);
export const polymerEntityMeta = (id, entity, opts) => request(POLYMER_URL(normalizeId(id), entity), opts);
