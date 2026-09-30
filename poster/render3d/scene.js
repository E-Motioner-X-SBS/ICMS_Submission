// 1fnaA hero still: Catmull-Rom tube through the C-alpha trace, strand-pair
// clusters of the prime-implicant blocks coloured with the poster's categorical
// palette, and one thin rung per contacting residue pair inside a block.
//
// Image formation (all in linear light, accumulated in a float target):
//   - every pass renders the scene lit by ONE shadow-casting directional light,
//     plus a small constant ambient. Most passes take their light from a random
//     direction on the hemisphere facing the camera (sky light -> soft ambient
//     occlusion), the rest from a narrow cone around a key light (soft shadows);
//   - every pass is also jittered by a sub-pixel offset (Halton 2,3), so the
//     average is anti-aliased;
//   - a per-pass composite adds a depth-discontinuity silhouette (not on rungs)
//     and gentle depth cueing towards the poster wash, then the premultiplied
//     result is added to the accumulator.
// The final pass un-premultiplies and encodes sRGB with straight alpha.
// Query: w,h (px), amb,key (pass counts), roll,yaw,tilt (deg), fit=x0,y0,x1,y1
// (target box of the molecule, image fractions, y down), align=x,y (0..1),
// orad (silhouette width in mm on a print mmw mm wide).
import * as THREE from "three";
import { strandPairClusters } from "./clusters.js";

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const W = num("w", 1200), H = num("h", 640);
const N_AMB = num("amb", 48), N_KEY = num("key", 16), N = N_AMB + N_KEY;
const ROLL = num("roll", 145), YAW = num("yaw", 15), TILT = num("tilt", 0);
const FIT = (q.get("fit") ?? "0.03,0.05,0.63,0.95").split(",").map(Number);
const ALIGN = (q.get("align") ?? "0.5,0.5").split(",").map(Number);
const PAL = (q.get("pal") ?? "2a78d6,e34948,008300,e87ba4,4a3aa7,1baf7a,9b6a1c").split(",").map((s) => "#" + s);
const NEUTRAL = "#" + (q.get("neutral") ?? "d3d9df");
const OUTLINE = "#" + (q.get("outline") ?? "1c3450");
const WASH = "#" + (q.get("wash") ?? "f1f5f8");

const R_BASE = num("rb", 0.4), R_CL = num("rc", 0.78), R_RUNG = num("rr", 0.18); // Angstrom
const S_PER_RES = 14, RADIAL = 36;

function lin(hex) { return new THREE.Color(hex); } // Color.set(hex) converts sRGB -> linear working space

async function main() {
  const data = await (await fetch("../data/contact_1fnaA.json")).json();
  const clusters = strandPairClusters(data);
  const n = data.ca.length;
  const cen = data.ca.reduce((a, p) => a.map((v, k) => v + p[k] / n), [0, 0, 0]);
  const CA = data.ca.map((p) => new THREE.Vector3(p[0] - cen[0], p[1] - cen[1], p[2] - cen[2]));

  // residue -> clusters it belongs to (span of the cluster's i- or j-segment)
  const member = Array.from({ length: n }, () => []);
  clusters.forEach((c, k) => {
    c.color = PAL[k];
    c.iMid = CA.slice(c.i0, c.i1).reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / (c.i1 - c.i0));
    c.jMid = CA.slice(c.j0, c.j1).reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / (c.j1 - c.j0));
    for (let r = c.i0; r < c.i1; r++) member[r].push({ k, partner: c.jMid });
    for (let r = c.j0; r < c.j1; r++) member[r].push({ k, partner: c.iMid });
  });

  // ── frame: strand axis s from the cluster segments, then PCA of the rest ──
  const s = new THREE.Vector3();
  let ref = null;
  for (const c of clusters)
    for (const [a, b] of [[c.i0, c.i1 - 1], [c.j0, c.j1 - 1]]) {
      if (b <= a) continue;
      const d = CA[b].clone().sub(CA[a]);
      if (!ref) ref = d.clone().normalize();
      if (d.dot(ref) < 0) d.negate();
      s.add(d);
    }
  s.normalize();
  // PCA of all CA projected on the plane perpendicular to s
  const P = CA.map((v) => v.clone().sub(s.clone().multiplyScalar(v.dot(s))));
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const v of P) { const a = [v.x, v.y, v.z]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += a[i] * a[j]; }
  let e = new THREE.Vector3(1, 0.3, 0.2);          // power iteration for the major axis
  for (let it = 0; it < 200; it++) {
    e = new THREE.Vector3(cov[0][0] * e.x + cov[0][1] * e.y + cov[0][2] * e.z, cov[1][0] * e.x + cov[1][1] * e.y + cov[1][2] * e.z, cov[2][0] * e.x + cov[2][1] * e.y + cov[2][2] * e.z);
    e.sub(s.clone().multiplyScalar(e.dot(s))).normalize();
  }
  const u0 = e.clone();                            // screen up before roll
  // orientation: roll about s, then yaw about up, then tilt about view axis
  const rot = (v, axis, deg) => v.clone().applyAxisAngle(axis, THREE.MathUtils.degToRad(deg));
  let sx = s.clone(), up = u0.clone();
  up = rot(up, sx, ROLL);
  let view = new THREE.Vector3().crossVectors(sx, up).normalize(); // towards camera (right-handed)
  sx = rot(sx, up, YAW); view = rot(view, up, YAW);
  sx = rot(sx, view, TILT); up = rot(up, view, TILT);

  // ── geometry ──
  const curve = new THREE.CatmullRomCurve3(CA, false, "catmullrom", 0.5);
  const inCl = (r) => member[r].length > 0;
  const smooth = (x) => x * x * (3 - 2 * x);
  const neutral = lin(NEUTRAL);
  const resColor = (r, nrm, pos) => {
    const m = member[r];
    if (!m.length) return neutral;
    if (m.length === 1) return lin(clusters[m[0].k].color);
    // shared residue: each face takes the colour of the strand it faces
    let best = m[0], bd = -Infinity;
    for (const x of m) { const d = x.partner.clone().sub(pos).normalize().dot(nrm); if (d > bd) { bd = d; best = x; } }
    return lin(clusters[best.k].color);
  };
  const M = (n - 1) * S_PER_RES;
  const pts = [], tan = [];
  for (let k = 0; k <= M; k++) {
    const t = k / M;
    pts.push(curve.getPoint(t));
    tan.push(curve.getTangent(t).normalize());
  }
  const u = (k) => k / S_PER_RES;                 // residue coordinate
  const radius = (x) => {
    const a = Math.min(n - 1, Math.floor(x)), b = Math.min(n - 1, a + 1), f = x - a;
    const w = smooth(Math.min(1, Math.max(0, (f - 0.2) / 0.6)));
    return (inCl(a) ? R_CL : R_BASE) * (1 - w) + (inCl(b) ? R_CL : R_BASE) * w;
  };
  // parallel-transport frames
  const nor = [], bin = [];
  let N0 = new THREE.Vector3(0, 0, 1);
  if (Math.abs(N0.dot(tan[0])) > 0.9) N0.set(0, 1, 0);
  N0.sub(tan[0].clone().multiplyScalar(N0.dot(tan[0]))).normalize();
  nor.push(N0); bin.push(new THREE.Vector3().crossVectors(tan[0], N0));
  for (let k = 1; k <= M; k++) {
    const Nk = nor[k - 1].clone().sub(tan[k].clone().multiplyScalar(nor[k - 1].dot(tan[k]))).normalize();
    nor.push(Nk); bin.push(new THREE.Vector3().crossVectors(tan[k], Nk));
  }
  const pos = [], nrm = [], col = [], idx = [];
  const ds = (k) => pts[Math.min(M, k + 1)].distanceTo(pts[Math.max(0, k - 1)]) / (Math.min(M, k + 1) - Math.max(0, k - 1));
  for (let k = 0; k <= M; k++) {
    const x = u(k), r = radius(x);
    const drds = (radius(Math.min(n - 1, x + 0.05)) - radius(Math.max(0, x - 0.05))) / (0.1 * S_PER_RES * ds(k));
    const a = Math.min(n - 1, Math.floor(x)), b = Math.min(n - 1, a + 1), f = x - a;
    const w = smooth(Math.min(1, Math.max(0, (f - 0.2) / 0.6)));
    for (let j = 0; j <= RADIAL; j++) {
      const th = (2 * Math.PI * j) / RADIAL;
      const d = nor[k].clone().multiplyScalar(Math.cos(th)).add(bin[k].clone().multiplyScalar(Math.sin(th)));
      const p = pts[k].clone().add(d.clone().multiplyScalar(r));
      const nn = d.clone().sub(tan[k].clone().multiplyScalar(drds)).normalize();
      const ca = resColor(a, d, pts[k]), cb = resColor(b, d, pts[k]);
      const c = ca.clone().lerp(cb, w);
      pos.push(p.x, p.y, p.z); nrm.push(nn.x, nn.y, nn.z); col.push(c.r, c.g, c.b);
    }
  }
  for (let k = 0; k < M; k++)
    for (let j = 0; j < RADIAL; j++) {
      const a = k * (RADIAL + 1) + j, b = a + RADIAL + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1); // counter-clockwise seen from outside
    }
  const tubeGeo = new THREE.BufferGeometry();
  tubeGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  tubeGeo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  tubeGeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  tubeGeo.setIndex(idx);

  const scene = new THREE.Scene();
  const matTube = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: num("rough", 0.5), metalness: 0, blending: THREE.NoBlending });
  const tube = new THREE.Mesh(tubeGeo, matTube);
  tube.castShadow = tube.receiveShadow = true;
  scene.add(tube);
  for (const r of [0, n - 1]) { // termini caps
    const cap = new THREE.Mesh(new THREE.SphereGeometry(radius(r), 48, 24), new THREE.MeshStandardMaterial({ color: inCl(r) ? clusters[member[r][0].k].color : NEUTRAL, roughness: matTube.roughness, metalness: 0, blending: THREE.NoBlending }));
    cap.position.copy(CA[r]); cap.castShadow = cap.receiveShadow = true; scene.add(cap);
  }
  // rungs: class flag alpha = 0.5 so the silhouette pass can leave them un-outlined
  const flagAlpha = (mat) => { mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\n gl_FragColor.a = 0.5;"); }; return mat; };
  const rungs = [];
  for (const c of clusters) {
    const mat = flagAlpha(new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.55, metalness: 0, blending: THREE.NoBlending }));
    for (const [i, j] of c.pairs) {
      const a = CA[i], b = CA[j], len = a.distanceTo(b);
      const g = new THREE.CylinderGeometry(R_RUNG, R_RUNG, len, 20, 1, true);
      const m = new THREE.Mesh(g, mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      m.castShadow = m.receiveShadow = true;
      scene.add(m); rungs.push({ mesh: m, i, j, k: clusters.indexOf(c) });
    }
  }

  // ── camera & framing ──
  let Rmol = 0; for (const p of pts) Rmol = Math.max(Rmol, p.length());
  Rmol += R_CL;
  const FOV = num("fov", 14), D = Rmol / Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * 1.1;
  const cam = new THREE.PerspectiveCamera(FOV, W / H, D - Rmol - 4, D + Rmol + 4);
  cam.position.copy(view.clone().multiplyScalar(D));
  cam.up.copy(up); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const P0 = cam.projectionMatrix.clone();
  // projected bbox of the tube (with its radius)
  const toNDC = (v, P) => v.clone().applyMatrix4(cam.matrixWorldInverse).applyMatrix4(P);
  let bb = [Infinity, Infinity, -Infinity, -Infinity];
  const camR = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), camU = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  for (let k = 0; k <= M; k += 2) {
    const r = radius(u(k));
    for (const o of [camR, camR.clone().negate(), camU, camU.clone().negate()]) {
      const p = toNDC(pts[k].clone().add(o.clone().multiplyScalar(r)), P0);
      bb = [Math.min(bb[0], p.x), Math.min(bb[1], p.y), Math.max(bb[2], p.x), Math.max(bb[3], p.y)];
    }
  }
  // target box in NDC (image y down -> NDC y up)
  const tx0 = FIT[0] * 2 - 1, tx1 = FIT[2] * 2 - 1, ty0 = 1 - FIT[3] * 2, ty1 = 1 - FIT[1] * 2;
  let A = Math.min((tx1 - tx0) / (bb[2] - bb[0]), (ty1 - ty0) / (bb[3] - bb[1]));
  let bx = tx0 + ((tx1 - tx0) - A * (bb[2] - bb[0])) * ALIGN[0] - A * bb[0];
  let by = ty1 - ((ty1 - ty0) - A * (bb[3] - bb[1])) * ALIGN[1] - A * bb[3];
  // Optional keep-out corner (qr=x,y image fractions, y down): the lower-right region
  // x > qx AND y > qy must stay empty (a card overlays it). Largest scale for which some
  // offset keeps every silhouette point inside the fit box and outside that corner,
  // shrunk by `qscale` to leave room for labels; the offset is then centred in the
  // feasible set.
  if (q.has("qr")) {
    const [qx, qy] = q.get("qr").split(",").map(Number);
    const QX = qx * 2 - 1, QY = 1 - qy * 2;              // NDC: forbidden x > QX && y < QY
    const sil = [];
    for (let k = 0; k <= M; k += 3) {
      const r = radius(u(k));
      for (const o of [camR, camR.clone().negate(), camU, camU.clone().negate()]) { const p = toNDC(pts[k].clone().add(o.clone().multiplyScalar(r)), P0); sil.push(p.x, p.y); }
    }
    const feasible = (a, ox, oy) => {
      for (let i = 0; i < sil.length; i += 2) { const x = a * sil[i] + ox, y = a * sil[i + 1] + oy; if (x > QX && y < QY) return false; }
      return true;
    };
    const offsets = (a) => { // box-feasible offset ranges
      return [tx0 - a * bb[0], tx1 - a * bb[2], ty0 - a * bb[1], ty1 - a * bb[3]];
    };
    const G = 48;
    const feasSet = (a) => {
      const [ox0, ox1, oy0, oy1] = offsets(a); const out = [];
      if (ox1 < ox0 || oy1 < oy0) return out;
      for (let ix = 0; ix <= G; ix++) for (let iy = 0; iy <= G; iy++) {
        const ox = ox0 + ((ox1 - ox0) * ix) / G, oy = oy0 + ((oy1 - oy0) * iy) / G;
        if (feasible(a, ox, oy)) out.push([ox, oy]);
      }
      return out;
    };
    let lo = 0, hi = A;
    for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; if (feasSet(mid).length) lo = mid; else hi = mid; }
    A = lo * num("qscale", 1);
    const fs = feasSet(A);
    const wx = ALIGN[0], wy = ALIGN[1];
    // weighted centre of the feasible offsets; ALIGN (0..1) biases towards the low/high end
    const xs = fs.map((p) => p[0]), ys = fs.map((p) => p[1]);
    const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
    let best = fs[0], bd = Infinity;
    const tgt = [mnx + (mxx - mnx) * wx, mxy - (mxy - mny) * wy];
    for (const p of fs) { const d = (p[0] - tgt[0]) ** 2 + (p[1] - tgt[1]) ** 2; if (d < bd) { bd = d; best = p; } }
    [bx, by] = best;
  }
  const setProj = (jx, jy) => {
    const S = new THREE.Matrix4().set(A, 0, 0, bx + (2 * jx) / W, 0, A, 0, by + (2 * jy) / H, 0, 0, 1, 0, 0, 0, 0, 1);
    cam.projectionMatrix.multiplyMatrices(S, P0);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  };
  setProj(0, 0);
  const Pfinal = cam.projectionMatrix.clone();

  // ── renderer & targets ──
  const canvas = document.getElementById("c");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = !q.has("noshadow"); renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  if (!renderer.getContext().getExtension("EXT_float_blend")) throw new Error("EXT_float_blend unavailable");
  const rtPass = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(W, H, THREE.UnsignedIntType), minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const rtAcc = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
  const rtOut = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });

  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  const SH = num("shadow", 2048);
  sun.shadow.mapSize.set(SH, SH);
  Object.assign(sun.shadow.camera, { left: -Rmol, right: Rmol, top: Rmol, bottom: -Rmol, near: 1, far: 4 * Rmol + 10 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = num("nbias", 0.06);
  scene.add(sun, sun.target);
  const W_AMB = num("wamb", 0.62), W_KEY = num("wkey", 0.5), W_CONST = num("wconst", 0.06);
  scene.add(new THREE.AmbientLight(0xffffff, Math.PI * W_CONST));

  // composite (silhouette + depth cue) → additive accumulation
  const fsGeo = new THREE.PlaneGeometry(2, 2);
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const comp = new THREE.ShaderMaterial({
    uniforms: {
      tCol: { value: rtPass.texture }, tDep: { value: rtPass.depthTexture }, px: { value: new THREE.Vector2(1 / W, 1 / H) },
      near: { value: cam.near }, far: { value: cam.far }, zMid: { value: D }, zR: { value: Rmol },
      outline: { value: lin(OUTLINE) }, wash: { value: lin(WASH) }, oRad: { value: num("orad", 0.42) * W / num("mmw", 300) }, oThr: { value: num("othr", 2.2) },
      fog: { value: num("fog", 0.28) },
    },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      uniform sampler2D tCol; uniform sampler2D tDep; uniform vec2 px; uniform float near, far, zMid, zR, oRad, oThr, fog;
      uniform vec3 outline, wash; varying vec2 vUv;
      float linZ(float d){ return near * far / (far - d * (far - near)); }
      void main(){
        vec4 c = texture2D(tCol, vUv);
        bool cov = c.a > 0.25;
        float z = cov ? linZ(texture2D(tDep, vUv).r) : 1e9;
        float zmin = 1e9;
        for (int k = 0; k < 16; k++) {
          float a = 6.2831853 * float(k) / 16.0;
          for (int ring = 1; ring <= 2; ring++) {
            vec2 o = vec2(cos(a), sin(a)) * oRad * (ring == 1 ? 0.5 : 1.0);
            vec2 uv = vUv + o * px;
            vec4 cn = texture2D(tCol, uv);
            if (cn.a > 0.75) zmin = min(zmin, linZ(texture2D(tDep, uv).r));
          }
        }
        if (zmin < z - oThr) { gl_FragColor = vec4(outline, 1.0); return; }
        if (!cov) { gl_FragColor = vec4(0.0); return; }
        float f = clamp((z - (zMid - zR)) / (2.0 * zR), 0.0, 1.0);
        vec3 rgb = mix(c.rgb, wash, fog * f * f);
        gl_FragColor = vec4(rgb, 1.0);
      }`,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor, depthTest: false, depthWrite: false,
  });
  const compScene = new THREE.Scene(); compScene.add(new THREE.Mesh(fsGeo, comp));
  const fin = new THREE.ShaderMaterial({
    uniforms: { tAcc: { value: rtAcc.texture }, invN: { value: 1 / N }, expo: { value: num("expo", 1.0) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      uniform sampler2D tAcc; uniform float invN, expo; varying vec2 vUv;
      vec3 toSRGB(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        vec4 a = texture2D(tAcc, vUv) * invN;
        vec3 rgb = a.a > 0.0 ? a.rgb / a.a : vec3(0.0);
        rgb = rgb * expo;
        gl_FragColor = vec4(toSRGB(rgb), clamp(a.a, 0.0, 1.0));
      }`,
    blending: THREE.NoBlending, depthTest: false, depthWrite: false,
  });
  const finScene = new THREE.Scene(); finScene.add(new THREE.Mesh(fsGeo, fin));

  // light directions (world): key from upper-left-front in camera terms
  const camF = view.clone(); // towards camera
  const key = camR.clone().multiplyScalar(-0.55).add(camU.clone().multiplyScalar(0.62)).add(camF.clone().multiplyScalar(0.56)).normalize();
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const passes = [];
  const keyIdx = new Set(Array.from({ length: N_KEY }, (_, i) => Math.floor((i * N) / N_KEY)));
  let ia = 0;
  for (let k = 0; k < N; k++) {
    let dir;
    if (keyIdx.has(k)) {
      // cone around the key direction (half-angle ~ 9 deg)
      const a = rnd() * 2 * Math.PI, c = 1 - rnd() * (1 - Math.cos(THREE.MathUtils.degToRad(num("cone", 9))));
      const sN = Math.sqrt(1 - c * c);
      const t1 = new THREE.Vector3().crossVectors(key, new THREE.Vector3(0.3, 1, 0.1)).normalize(), t2 = new THREE.Vector3().crossVectors(key, t1);
      dir = key.clone().multiplyScalar(c).add(t1.multiplyScalar(sN * Math.cos(a))).add(t2.multiplyScalar(sN * Math.sin(a)));
      passes.push({ dir, key: true });
    } else {
      // uniform on the hemisphere facing the camera (stratified in height, Halton in azimuth)
      const z = (ia + rnd()) / (N - N_KEY), a = 2 * Math.PI * halton(ia + 1, 2);
      ia++;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      dir = camR.clone().multiplyScalar(r * Math.cos(a)).add(camU.clone().multiplyScalar(r * Math.sin(a))).add(camF.clone().multiplyScalar(z)).normalize();
      passes.push({ dir, key: false });
    }
  }
  const nk = passes.filter((p) => p.key).length, na = N - nk;
  renderer.setRenderTarget(rtAcc); renderer.clear(true, true, true);
  const t0 = performance.now();
  passes.forEach((p, k) => {
    sun.position.copy(p.dir.clone().multiplyScalar(2 * Rmol + 5));
    sun.target.position.set(0, 0, 0); sun.target.updateMatrixWorld();
    sun.intensity = Math.PI * (p.key ? (W_KEY * N) / nk : (2 * W_AMB * N) / na);
    setProj(halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5);
    renderer.setRenderTarget(rtPass); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true);
    renderer.render(scene, cam);
    renderer.setRenderTarget(rtAcc); renderer.autoClear = false;
    renderer.render(compScene, fsCam);
    renderer.autoClear = true;
  });
  renderer.setRenderTarget(rtOut); renderer.render(finScene, fsCam);
  const buf = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(rtOut, 0, 0, W, H, buf);
  const ms = performance.now() - t0;

  // ── label anchors: visible points on each cluster's segments, projected ──
  cam.projectionMatrix.copy(Pfinal); cam.projectionMatrixInverse.copy(Pfinal).invert();
  const ray = new THREE.Raycaster();
  const occluders = [tube, ...rungs.map((r) => r.mesh)];
  const project = (v) => { const p = toNDC(v, Pfinal); return [(p.x + 1) / 2, (1 - p.y) / 2]; };
  const visible = (v, r) => { // point on the tube surface facing the camera
    const surf = v.clone().add(cam.position.clone().sub(v).normalize().multiplyScalar(r * 0.98));
    const dir = surf.clone().sub(cam.position); const dist = dir.length(); dir.normalize();
    ray.set(cam.position, dir); ray.far = dist + 0.5;
    const hit = ray.intersectObjects(occluders, false)[0];
    return !hit || hit.distance > dist - 0.35;
  };
  const anchors = clusters.map((c, k) => {
    const out = [];
    for (const [side, r0, r1] of [["i", c.i0, c.i1], ["j", c.j0, c.j1]])
      for (let r = r0; r < r1; r++) {
        for (const f of [0, 0.5]) {
          if (f && r === r1 - 1) continue;
          const v = f ? curve.getPoint((r + f) / (n - 1)) : CA[r].clone();
          const [x, y] = project(v);
          out.push({ side, res: r + f, x, y, vis: visible(v, radius(r + f)), depth: v.clone().applyMatrix4(cam.matrixWorldInverse).z });
        }
      }
    for (const [i, j] of c.pairs) {
      const v = CA[i].clone().add(CA[j]).multiplyScalar(0.5);
      const [x, y] = project(v);
      out.push({ side: "rung", res: [i, j], x, y, vis: visible(v, R_RUNG), depth: v.clone().applyMatrix4(cam.matrixWorldInverse).z });
    }
    return { k, color: c.color, i0: c.i0, i1: c.i1, j0: c.j0, j1: c.j1, nBlocks: c.nBlocks, nPairs: c.nPairs, blocks: c.blocks, points: out };
  });
  const termini = [0, n - 1].map((r) => { const [x, y] = project(CA[r]); return { res: r, x, y, vis: visible(CA[r], radius(r)) }; });

  window.__result = {
    w: W, h: H, passes: N, ms: Math.round(ms), buf,
    meta: {
      source: "data/contact_1fnaA.json", target: data.target, length: n,
      camera: { fov: FOV, roll: ROLL, yaw: YAW, tilt: TILT, fit: FIT, align: ALIGN },
      palette: PAL, neutral: NEUTRAL, clusters: anchors, termini,
    },
  };
  window.__done = true;
}
main().catch((e) => { window.__error = e.stack || String(e); window.__done = true; });
