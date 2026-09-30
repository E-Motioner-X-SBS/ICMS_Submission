// QR matrix for the demo URL (error correction H: survives a small centre mark).
import QRCode from "qrcode";
import fs from "node:fs";
const DEMO_URL = "https://e-motioner-x-sbs.github.io/ICMS_Submission/";
const qr = QRCode.create(DEMO_URL, { errorCorrectionLevel: "H" });
const n = qr.modules.size, rows = [];
for (let r = 0; r < n; r++) { let s = ""; for (let c = 0; c < n; c++) s += qr.modules.get(r, c) ? "1" : "0"; rows.push(s); }
fs.writeFileSync(new URL("./qr.json", import.meta.url), JSON.stringify({ url: DEMO_URL, ecc: "H", size: n, version: qr.version, rows }));
console.log(`QR v${qr.version}, ${n}×${n} modules, ECC H -> ${DEMO_URL}`);
