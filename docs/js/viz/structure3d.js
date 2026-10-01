// A small three.js structure viewer: a smooth tube through the backbone, per-residue
// colours, rungs between residue pairs, touch orbit, render-on-demand.
import { representativeCoords } from "../core/contacts.js";
import { css, reducedMotion } from "../ui.js";

const TRACE = { protein: { atom: "CA", fallback: "CB", glyAtom: "CA" }, dna: { atom: "C4'", fallback: "P" }, rna: { atom: "C4'", fallback: "P" } };

export async function createViewer(container, chain, { onPick } = {}) {
  let THREE, OrbitControls;
  try {
    THREE = await import("three");
    ({ OrbitControls } = await import("three/addons/OrbitControls.js"));
  } catch (e) { container.textContent = "The 3D view could not load on this device."; return null; }
  if (!(window.WebGL2RenderingContext || window.WebGLRenderingContext)) { container.textContent = "This browser has no WebGL, so the 3D view is off. Everything else works."; return null; }

  const { xyz } = representativeCoords(chain, TRACE[chain.entityType] || TRACE.protein);
  const idx = [], pts = [];
  for (let k = 0; k < chain.residues.length; k++) {
    const x = xyz[3 * k], y = xyz[3 * k + 1], z = xyz[3 * k + 2];
    if (Number.isFinite(x)) { idx.push(k); pts.push(new THREE.Vector3(x, y, z)); }
  }
  if (pts.length < 4) { container.textContent = "Too few coordinates for a 3D view."; return null; }
  const centre = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
  pts.forEach((p) => p.sub(centre));
  const radius = Math.max(...pts.map((p) => p.length()));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));   // sharp on phones, without a 3x framebuffer
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, radius * 20);
  camera.position.set(0, 0, radius * 3.2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(1, 1.2, 2); scene.add(key);

  // backbone tubes with vertex colours, one per unbroken run of the trace (strand ends and
  // missing residues break the tube); tube parameter u maps to a residue index
  const breakAt = chain.entityType === "protein" ? 4.6 : 9.5;
  const starts = new Set((chain.strands || []).reduce((acc, st) => { acc.push((acc.at(-1) ?? 0) + st.length); return acc; }, []));
  const runs = [[0]];
  for (let k = 1; k < pts.length; k++) {
    if (pts[k].distanceTo(pts[k - 1]) > breakAt || starts.has(idx[k])) runs.push([]);
    runs.at(-1).push(k);
  }
  const radial = 10, tubeR = chain.entityType === "protein" ? 0.55 : 0.9;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.0 });
  const pieces = runs.map((run) => {
    let geo, segs;
    if (run.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(run.map((k) => pts[k]), false, "centripetal");
      segs = Math.min(run.length * 8, 3000);
      geo = new THREE.TubeGeometry(curve, segs, tubeR, radial, false);
    } else { geo = new THREE.SphereGeometry(tubeR * 1.6, 12, 8); geo.translate(pts[run[0]].x, pts[run[0]].y, pts[run[0]].z); segs = 0; }
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    scene.add(new THREE.Mesh(geo, mat));
    return { run, geo, segs };
  });
  const rungs = new THREE.Group(); scene.add(rungs);

  const neutral = new THREE.Color(css("--cell-2") || "#b6c3d1");
  let colorOf = () => null;
  function applyColors() {
    const c = new THREE.Color();
    for (const { run, geo, segs } of pieces) {
      const colors = geo.attributes.color.array;
      if (!segs) { const hex = colorOf(idx[run[0]]); c.copy(hex ? new THREE.Color(hex) : neutral); for (let v = 0; v < colors.length / 3; v++) colors.set([c.r, c.g, c.b], v * 3); }
      else for (let q = 0; q <= segs; q++) {
        const res = idx[run[Math.min(run.length - 1, Math.round((q / segs) * (run.length - 1)))]];
        const hex = colorOf(res);
        c.copy(hex ? new THREE.Color(hex) : neutral);
        for (let r = 0; r <= radial; r++) { const v = q * (radial + 1) + r; if (v * 3 + 2 < colors.length) { colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b; } }
      }
      geo.attributes.color.needsUpdate = true;
    }
    request();
  }
  const posOf = (res) => { const k = idx.indexOf(res); return k < 0 ? null : pts[k]; };
  function setRungs(pairs) {
    rungs.children.forEach((l) => { l.geometry.dispose(); l.material.dispose(); });
    rungs.clear();
    const byColor = new Map();
    for (const [i, j, col] of pairs) {
      const a = posOf(i), b = posOf(j); if (!a || !b) continue;
      const k = col || "#1E86A8"; if (!byColor.has(k)) byColor.set(k, []); byColor.get(k).push(a, b);
    }
    for (const [col, arr] of byColor) rungs.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(arr), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.85 })));
    request();
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false; controls.minDistance = radius * 1.2; controls.maxDistance = radius * 8;
  controls.autoRotate = !reducedMotion(); controls.autoRotateSpeed = 0.9;
  // phones: a vertical swipe scrolls the page, a horizontal drag turns the molecule, two fingers zoom
  renderer.domElement.style.touchAction = "pan-y";
  renderer.domElement.addEventListener("pointerdown", () => { controls.autoRotate = false; });

  // One render loop at most. controls.update() fires "change" while the loop runs; that must not
  // schedule a second frame, or the number of pending frames doubles every frame. The loop also
  // sleeps while the viewer is off screen or the tab is hidden.
  let raf = 0, alive = true, needs = true, inLoop = false, visible = true;
  const running = () => alive && visible && !document.hidden;
  function request() { needs = true; if (!raf && !inLoop && running()) raf = requestAnimationFrame(loop); }
  function loop() {
    raf = 0;
    inLoop = true;
    const moved = controls.update();
    inLoop = false;
    if (needs || moved || controls.autoRotate) { renderer.render(scene, camera); needs = false; }
    if (!raf && running() && (moved || controls.autoRotate)) raf = requestAnimationFrame(loop);
  }
  controls.addEventListener("change", request);
  const ro = new ResizeObserver(() => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); request(); });
  ro.observe(container);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) request(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } });
  io.observe(container);
  const onVis = () => { if (!document.hidden) request(); };
  document.addEventListener("visibilitychange", onVis);

  // tap a residue: nearest projected backbone point
  if (onPick) renderer.domElement.addEventListener("click", (e) => {
    const b = renderer.domElement.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
    let best = -1, bd = 22 * 22;
    pts.forEach((p, k) => { const v = p.clone().project(camera); const x = (v.x + 1) / 2 * b.width, y = (1 - v.y) / 2 * b.height; const d = (x - mx) ** 2 + (y - my) ** 2; if (d < bd) { bd = d; best = k; } });
    if (best >= 0) onPick(idx[best]);
  });

  applyColors();
  return {
    setColors(fn) { colorOf = fn; applyColors(); },
    setRungs,
    dispose() { alive = false; cancelAnimationFrame(raf); raf = 0; ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); controls.dispose(); pieces.forEach((p) => p.geo.dispose()); mat.dispose(); rungs.children.forEach((l) => { l.geometry.dispose(); l.material.dispose(); }); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); },
  };
}
