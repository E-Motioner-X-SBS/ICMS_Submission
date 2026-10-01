# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "brotli>=1.2.0",
#     "fonttools>=4.66.1",
#     "latex2mathml>=3.81.1",
# ]
# ///
"""Render the theorem statements (tools/statements.txt, LaTeX) to MathML for the site.

    uv run docs/tools/render-math.py

Writes js/core/statements.js (generated; the site shows these statements, never Lean code) and
fonts/STIXTwoMath-subset.woff2: STIX Two Math (SIL Open Font License, fonts/STIXTwoMath-OFL.txt)
cut down to the characters the statements use, with its MATH table, so formulas look the same on
every phone. The full font is downloaded once into a cache directory outside the site.
"""
import json
import re
import sys
import urllib.request
from html import escape, unescape
from pathlib import Path

from fontTools import subset
from latex2mathml.converter import convert

DOCS = Path(__file__).resolve().parent.parent
SRC = DOCS / "tools" / "statements.txt"
OUT = DOCS / "js" / "core" / "statements.js"
FONT_OUT = DOCS / "fonts" / "STIXTwoMath-subset.woff2"
CACHE = Path.home() / ".cache" / "icms-site-fonts"
FONT_URL = "https://raw.githubusercontent.com/stipub/stixfonts/v2.13/fonts/static_otf/STIXTwoMath-Regular.otf"   # release 2.13
OFL_URL = "https://raw.githubusercontent.com/stipub/stixfonts/v2.13/OFL.txt"

# Chrome draws only mathvariant="normal" (MathML Core): styled letters must be the Unicode
# mathematical alphanumerics themselves.
LETTERLIKE = {
    "script": {"B": "ℬ", "E": "ℰ", "F": "ℱ", "H": "ℋ", "I": "ℐ", "L": "ℒ", "M": "ℳ", "R": "ℛ", "e": "ℯ", "g": "ℊ", "o": "ℴ"},
    "double-struck": {"C": "ℂ", "H": "ℍ", "N": "ℕ", "P": "ℙ", "Q": "ℚ", "R": "ℝ", "Z": "ℤ"},
    "bold": {},
}
BASE = {"bold": 0x1D400, "script": 0x1D49C, "double-struck": 0x1D538}


def styled(ch, variant):
    if ch in LETTERLIKE.get(variant, {}):
        return LETTERLIKE[variant][ch]
    if variant in BASE and ch.isascii() and ch.isalpha():
        off = ord(ch) - (ord("A") if ch.isupper() else ord("a") - 26)
        return chr(BASE[variant] + off)
    return ch


def mathml(tex):
    m = convert(tex, display="inline")
    def fix(mo):
        variant, text = mo.group(2), mo.group(3)
        if variant in BASE:
            return f"<{mo.group(1)}>{''.join(styled(c, variant) for c in text)}</{mo.group(1)}>"
        return mo.group(0)
    m = re.sub(r'<(mi|mn|mtext) mathvariant="([a-z-]+)">([^<]*)</\1>', fix, m)
    # brackets and big operators the converter tags as identifiers are operators (spacing, stretching)
    m = re.sub(r"<mi>(&#x0230A;|&#x0230B;|&#x02A01;)</mi>", r"<mo>\1</mo>", m)
    # a prime is already a raised glyph: set it after its letter, not as a superscript again
    P = '<mo lspace="0" rspace="0">&#x02032;</mo>'
    m = re.sub(r"<msup>(<mi>[^<]*</mi>)<mi>&#x02032;</mi></msup>", lambda x: x.group(1) + P, m)
    m = re.sub(r"<msubsup>(<mi>[^<]*</mi>)(<mi>[^<]*</mi>)<mi>&#x02032;</mi></msubsup>", lambda x: f"<msub>{x.group(1)}{x.group(2)}</msub>" + P, m)
    if "&#x02032;</mi>" in m:
        raise SystemExit(f"unhandled prime in: {tex}")
    if "mathvariant=" in m and 'mathvariant="normal"' not in m:
        raise SystemExit(f"unhandled mathvariant in: {tex}\n{m}")
    return m


def pieces(line):
    """Split one source line at top-level break points (never inside brackets, sets or groups):
    after a leading quantifier's colon, between list items written ",\\ \\ ", before ⇒ and ⇔,
    after ∧ and ∨, and before " for ". Each piece is valid LaTeX on its own."""
    out, depth, start, k, quant = [], 0, 0, 0, line.startswith(("\\forall", "\\exists"))
    def cut(at):
        nonlocal start
        piece = re.sub(r"^(?:\\[ ,;:!]|\s)+|(?:\\[ ,;:!]|\s)+$", "", line[start:at])   # the gap between pieces is the space
        if piece:
            out.append(piece)
        start = at
    while k < len(line):
        ch = line[k]
        if line.startswith(("\\{", "\\}"), k):
            depth += 1 if line[k + 1] == "{" else -1; k += 2; continue
        if ch in "({[":
            depth += 1
        elif ch in ")}]":
            depth -= 1
        elif depth == 0:
            rest = line[k:]
            if quant and rest.startswith(":\\ "):
                cut(k + 1); quant = False; k += 1; continue
            if rest.startswith(",\\ \\ "):
                cut(k + 1); k += 1; continue
            for op in (" \\Rightarrow", " \\Leftrightarrow", "\\ \\text{ for }", "\\ \\text{ with }", "\\text{with }"):
                if rest.startswith(op) and k > start:
                    cut(k); break
            for op in ("\\wedge", "\\vee"):
                if rest.startswith(op) and not rest[len(op):len(op) + 1].isalpha():
                    cut(k + len(op)); k += len(op); break
            else:
                k += 1
                continue
            continue
        k += 1
    cut(len(line))
    return out                         # a line may open a bracket that the next line closes


def inline(text):
    """Text with $...$ math → HTML."""
    out, parts = [], re.split(r"(\$[^$]+\$)", text)
    for p in parts:
        out.append(mathml(p[1:-1]) if p.startswith("$") else escape(p))
    return "".join(out)


def parse():
    notation, theorems, section, cur = {}, {}, None, None
    for raw in SRC.read_text(encoding="utf8").splitlines():
        line = raw.strip()
        if line.startswith("#"):
            continue
        if line.startswith("== "):
            section = line[3:]; cur = None; continue
        if not line:
            cur = None; continue
        if section == "notation":
            key, text = line.split(":", 1)
            notation[key.strip()] = text.strip()
        elif section == "theorems":
            if line.startswith("@ "):
                tid, keys = [s.strip() for s in line[2:].split("|")]
                cur = theorems[tid] = {"parts": [], "where": keys.split()}
            else:
                cur["parts"].append(line)
    for tid, t in theorems.items():
        missing = [k for k in t["where"] if k not in notation]
        if missing:
            raise SystemExit(f"{tid}: unknown notation {missing}")
        if not t["parts"]:
            raise SystemExit(f"{tid}: no statement")
    return notation, theorems


def fetch(url, path):
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(url, path)
    return path


def main():
    notation, theorems = parse()
    note_html = {k: inline(v) for k, v in notation.items()}
    stmt = {tid: {"html": "".join(f'<span class="stmt-part">{mathml(q)}</span>' for p in t["parts"] for q in pieces(p)), "where": t["where"]}
            for tid, t in theorems.items()}
    n = len(stmt)
    OUT.write_text(
        "// GENERATED by tools/render-math.py from tools/statements.txt. Do not edit by hand.\n"
        f"// The mathematical statement of each of the {n} theorems, as MathML, and the notation they use.\n"
        f"export const NOTATION = {json.dumps(note_html, ensure_ascii=False, indent=0)};\n"
        f"export const STATEMENTS = {json.dumps(stmt, ensure_ascii=False, indent=0)};\n", encoding="utf8")

    # the font: every character in the MathML, plus the italic letters MathML Core substitutes
    text = unescape(re.sub(r"<[^>]+>", "", "".join(note_html.values()) + "".join(s["html"] for s in stmt.values())))
    chars = set(text) | set("0123456789()[]{}=+−-,.:;|/<>")
    cps = {ord(c) for c in chars if not c.isspace()}
    cps |= set(range(0x1D434, 0x1D468)) | {0x210E} | set(range(0x1D6E2, 0x1D71C))   # math italic Latin and Greek
    font = fetch(FONT_URL, CACHE / "STIXTwoMath-Regular.otf")
    fetch(OFL_URL, CACHE / "STIX-OFL.txt")
    opts = subset.Options()
    opts.flavor = "woff2"; opts.layout_features = ["*"]; opts.notdef_outline = True; opts.name_IDs = ["*"]
    f = subset.load_font(str(font), opts)
    sub = subset.Subsetter(opts); sub.populate(unicodes=cps); sub.subset(f)
    if "MATH" not in f:
        raise SystemExit("the subset lost the MATH table")
    subset.save_font(f, str(FONT_OUT), opts)
    (DOCS / "fonts" / "STIXTwoMath-OFL.txt").write_text((CACHE / "STIX-OFL.txt").read_text(encoding="utf8"), encoding="utf8")
    print(f"{n} statements, {len(note_html)} notation entries → {OUT.relative_to(DOCS)}; "
          f"font subset {len(cps)} code points, {FONT_OUT.stat().st_size} bytes")


if __name__ == "__main__":
    sys.exit(main())
