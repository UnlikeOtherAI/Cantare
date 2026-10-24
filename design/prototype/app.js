/* Cantare editor prototype — vanilla JS, no build step.
   Only enough behaviour to walk the shell: tool switching, bottom sheet detents,
   format picker, light gizmo, spin dial, and the generate / export flows.       */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const body = document.body;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ------------------------------------------------------------ formats */
  // d/h in mm (from docs/can-reference.md). rim = finished seam OD (visual), neck = overall neck height.
  const FORMATS = [
    // Standard 66 mm
    { id: "std-237", family: "standard", name: "237 ml", alt: "8 oz", d: 66, h: 88.05, rim: 54, neck: 17, sup: "Crown", end: "202" },
    { id: "std-250", family: "standard", name: "250 ml", alt: "short", d: 66, h: 91.69, rim: 54, neck: 17, sup: "Crown", end: "202" },
    { id: "std-300", family: "standard", name: "300 ml", d: 66, h: 106.3, rim: 54, neck: 18, sup: "Crown", end: "202" },
    { id: "std-330", family: "standard", name: "330 ml", d: 66.3, h: 115.2, rim: 54, neck: 19, sup: "Ardagh", end: "202 CDL", tpl: "207 × 107" },
    { id: "std-440", family: "standard", name: "440 ml", d: 66.3, h: 149.9, rim: 54, neck: 20, sup: "Ardagh", end: "202 CDL", tpl: "206 × 141.4" },
    { id: "std-449", family: "standard", name: "449 ml", alt: "Long Fit · Ø63.5", d: 63.5, h: 168, rim: 54, neck: 20, sup: "CANPACK", end: "202" },
    { id: "std-500", family: "standard", name: "500 ml", d: 66.3, h: 168, rim: 54, neck: 20, sup: "Ardagh", end: "202 CDL", tpl: "206 × 160" },
    { id: "std-550", family: "standard", name: "550 ml", d: 66.3, h: 182.65, rim: 54, neck: 20, sup: "CANPACK", end: "202" },
    { id: "std-568", family: "standard", name: "568 ml", alt: "UK pint", d: 66.3, h: 188.09, rim: 54, neck: 20, sup: "CANPACK", end: "202", tpl: "206 × 180" },
    // Sleek 58 mm
    { id: "slk-200", family: "sleek", name: "200 ml", d: 58.1, h: 95.2, rim: 51.6, neck: 11, sup: "CANPACK Fit", end: "200" },
    { id: "slk-250", family: "sleek", name: "250 ml", d: 58.1, h: 113.9, rim: 54, neck: 11, sup: "Ball", end: "202" },
    { id: "slk-300", family: "sleek", name: "300 ml", d: 58.1, h: 132.89, rim: 54, neck: 11, sup: "CANPACK Fit", end: "202" },
    { id: "slk-330", family: "sleek", name: "330 ml", d: 58.1, h: 145.4, rim: 54, neck: 10, sup: "Ardagh", end: "202 / 200", tpl: "181 × 139", variants: true },
    { id: "slk-355", family: "sleek", name: "355 ml", d: 58.1, h: 156.9, rim: 54, neck: 11, sup: "CANPACK Fit", end: "202" },
    // Slim 53 mm
    { id: "slm-150", family: "slim", name: "150 ml", d: 53.4, h: 88.4, rim: 51.6, neck: 8, sup: "CANPACK", end: "200", tpl: "166 × 83.3" },
    { id: "slm-185", family: "slim", name: "185 ml", d: 53.4, h: 103.38, rim: 51.6, neck: 8, sup: "CANPACK", end: "200" },
    { id: "slm-200", family: "slim", name: "200 ml", alt: "wine", d: 53.4, h: 111.2, rim: 51.6, neck: 8, sup: "Ardagh", end: "200" },
    { id: "slm-240", family: "slim", name: "240 ml", d: 53, h: 129.5, rim: 51.6, neck: 8, sup: "Crown", end: "200" },
    { id: "slm-250", family: "slim", name: "250 ml", d: 53.4, h: 134, rim: 51.6, neck: 8, sup: "Ardagh", end: "200", tpl: "166 × 130" },
    // US
    { id: "us-7.5", family: "us", name: "7.5 fl oz", alt: "sleek · 222 ml", d: 57.3, h: 103.84, rim: 54, neck: 11, sup: "Ball", end: "202" },
    { id: "us-12", family: "us", name: "12 fl oz", alt: "standard · 355 ml", d: 66.04, h: 122.22, rim: 54, neck: 19, sup: "Ball", end: "202" },
    { id: "us-12s", family: "us", name: "12 fl oz", alt: "sleek · 355 ml", d: 57.37, h: 155.63, rim: 54, neck: 11, sup: "Ball", end: "202" },
    { id: "us-16", family: "us", name: "16 fl oz", alt: "standard · 473 ml", d: 66.04, h: 157.23, rim: 54, neck: 19, sup: "Ball", end: "202" },
    { id: "us-19.2", family: "us", name: "19.2 fl oz", alt: "standard · 568 ml", d: 65.9, h: 188.1, rim: 54, neck: 20, sup: "Ball", end: "202" },
    // Large
    { id: "lg-24", family: "large", name: "24 fl oz", alt: "Mega · 710 ml", d: 73, h: 193.29, rim: 60, neck: 20, sup: "CANPACK", end: "206" },
    { id: "lg-32", family: "large", name: "32 fl oz", alt: "Crowler · 946 ml", d: 83.59, h: 193.14, rim: 76, neck: 15, sup: "Ball", end: "300" },
  ];
  const FAMILY_LABEL = { standard: "Standard · Ø 66 mm", sleek: "Sleek · Ø 58 mm", slim: "Slim · Ø 53 mm", us: "US", large: "Large" };
  let current = FORMATS.find(f => f.id === "std-330");
  let family = "all";
  let query = "";

  const list = $("#format-list");
  function renderList() {
    list.innerHTML = "";
    const q = query.trim().toLowerCase();
    const groups = {};
    FORMATS.filter(f => (family === "all" || f.family === family))
      .filter(f => !q || `${f.name} ${f.alt || ""} ${f.family} ${f.sup} ${f.d} ${Math.round(f.h)}`.toLowerCase().includes(q))
      .forEach(f => (groups[f.family] ||= []).push(f));
    Object.entries(groups).forEach(([fam, items]) => {
      if (family === "all") {
        const h = document.createElement("div");
        h.className = "format-list__family"; h.textContent = FAMILY_LABEL[fam]; list.appendChild(h);
      }
      items.forEach(f => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "format-row" + (f.id === current.id ? " is-active" : ""); b.setAttribute("role", "option");
        b.setAttribute("aria-selected", f.id === current.id);
        const w = Math.round(f.d / 84 * 26), h = Math.round(f.h / 194 * 36);
        const badge = f.alt ? `<span class="format-row__badge">${f.alt}</span>` : f.tpl ? `<span class="format-row__badge" title="Print template ${f.tpl} mm">template</span>` : "";
        b.innerHTML = `<span class="format-row__sil"><i style="--w:${w}px;--h:${h}px"></i></span>
          <span><span class="format-row__name">${f.name}</span>${badge}<br><span class="format-row__sub">${f.sup} · ${f.end} end</span></span>
          <span class="format-row__dims mono">Ø ${f.d} × ${f.h}</span>`;
        b.addEventListener("click", () => selectFormat(f));
        list.appendChild(b);
      });
    });
    if (!list.children.length) list.innerHTML = `<p class="help" style="padding:12px 6px">No format matches "${query}". Try a capacity (440) or a family (sleek).</p>`;
  }
  function selectFormat(f) {
    current = f;
    $("#format-name").textContent = `${f.name} · ${({ standard: "Standard", sleek: "Sleek", slim: "Slim", us: "US", large: f.alt?.split(" ·")[0] || "Large" })[f.family]}`;
    $("#format-dims").textContent = `Ø ${f.d} × ${f.h} mm`;
    $("#format-sub").textContent = `${f.sup} · ${f.end} end · ${f.tpl ? `template ${f.tpl.replace(/ /g, "")} mm` : "no template, size inferred"}`;
    $("#doc-format").textContent = $("#format-name").textContent;
    $("#lid-variant").closest(".field").style.display = f.variants ? "" : "none";
    renderList(); drawCan(); drawThumb();
  }
  $("#family-tabs").addEventListener("click", e => {
    const t = e.target.closest("[data-family]"); if (!t) return;
    $$("#family-tabs .seg__item").forEach(x => x.classList.toggle("is-active", x === t));
    family = t.dataset.family; renderList();
  });
  $("#format-search").addEventListener("input", e => { query = e.target.value; renderList(); });

  /* -------------------------------------------------------------- can SVG */
  const S = 3.2; // px per mm inside the 400×640 viewBox
  const canSvg = $("#can");
  function canPath(f, cx, y0, s) {
    const H = f.h * s, r = f.d / 2 * s, sr = r * 0.73, nr = f.rim / 2 * s, nh = f.neck * s, heel = 8 * s, seam = 2.5 * s;
    const yTop = y0 - H, yShoulder = yTop + nh, ySeam = yTop + seam;
    const R = x => cx + x, L = x => cx - x;
    // right side up, left side down
    return [
      `M ${L(sr)} ${y0}`, `L ${R(sr)} ${y0}`,
      `C ${R(sr + heel * 0.6)} ${y0}, ${R(r)} ${y0 - heel * 0.35}, ${R(r)} ${y0 - heel}`,
      `L ${R(r)} ${yShoulder}`,
      `C ${R(r)} ${yShoulder - nh * 0.5}, ${R(nr)} ${yShoulder - nh * 0.62}, ${R(nr)} ${ySeam + 2 * s}`,
      `L ${R(nr)} ${ySeam}`, `L ${R(nr + 0.8 * s)} ${ySeam}`, `L ${R(nr + 0.8 * s)} ${yTop}`,
      `L ${L(nr + 0.8 * s)} ${yTop}`, `L ${L(nr + 0.8 * s)} ${ySeam}`, `L ${L(nr)} ${ySeam}`,
      `L ${L(nr)} ${ySeam + 2 * s}`,
      `C ${L(nr)} ${yShoulder - nh * 0.62}, ${L(r)} ${yShoulder - nh * 0.5}, ${L(r)} ${yShoulder}`,
      `L ${L(r)} ${y0 - heel}`,
      `C ${L(r)} ${y0 - heel * 0.35}, ${L(sr + heel * 0.6)} ${y0}, ${L(sr)} ${y0}`, "Z",
    ].join(" ");
  }
  function drawCan() {
    const f = current, cx = 200, y0 = 612, s = S;
    const H = f.h * s, r = f.d / 2 * s, nr = f.rim / 2 * s + 0.8 * s, yTop = y0 - H, ry = nr * 0.26;
    const hasArt = body.classList.contains("has-art");
    const lh = Math.min(84, f.h - 30), lb = y0 - 10 * s, lt = lb - lh * s; // label: 84 mm tall, 10 mm above the base, clamped to the can
    canSvg.innerHTML = `
      <defs>
        <linearGradient id="g-metal" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#4b4e53"/><stop offset=".16" stop-color="#a3a6ac"/><stop offset=".36" stop-color="#eceef1"/>
          <stop offset=".5" stop-color="#d2d5d9"/><stop offset=".64" stop-color="#9ea1a7"/><stop offset=".82" stop-color="#5f6267"/><stop offset="1" stop-color="#2f3135"/>
        </linearGradient>
        <linearGradient id="g-shade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".18" stop-color="#000" stop-opacity=".1"/><stop offset=".38" stop-color="#fff" stop-opacity=".22"/>
          <stop offset=".52" stop-color="#fff" stop-opacity=".05"/><stop offset=".7" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".6"/>
        </linearGradient>
        <linearGradient id="g-art" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#0e3b3a"/><stop offset=".42" stop-color="#1f6f6b"/><stop offset=".42" stop-color="#efe4cf"/><stop offset=".56" stop-color="#efe4cf"/><stop offset=".56" stop-color="#b03a2e"/><stop offset="1" stop-color="#7a1f17"/>
        </linearGradient>
        <radialGradient id="g-lid" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#9c9fa5"/><stop offset=".7" stop-color="#6d7075"/><stop offset="1" stop-color="#43464b"/></radialGradient>
        <radialGradient id="g-shadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".6" stop-color="#000" stop-opacity=".2"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
        <linearGradient id="g-refl" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <clipPath id="c-can"><path d="${canPath(f, cx, y0, s)}"/></clipPath>
        <mask id="m-refl"><rect x="0" y="${y0}" width="400" height="${H * 0.5}" fill="url(#g-refl)"/></mask>
        <linearGradient id="g-spec" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      </defs>
      <ellipse cx="${cx}" cy="${y0 + 2}" rx="${r * 1.9}" ry="${r * 0.42}" fill="url(#g-shadow)"/>
      <g mask="url(#m-refl)" transform="translate(0 ${2 * y0}) scale(1 -1)" opacity=".9">
        <path d="${canPath(f, cx, y0, s)}" fill="url(#g-metal)"/>
        ${hasArt ? `<rect x="${cx - r}" y="${lt}" width="${2 * r}" height="${lb - lt}" fill="url(#g-art)" clip-path="url(#c-can)"/>` : ""}
        <path d="${canPath(f, cx, y0, s)}" fill="url(#g-shade)"/>
      </g>
      <path class="can__body" d="${canPath(f, cx, y0, s)}" fill="url(#g-metal)"/>
      ${hasArt ? `<g clip-path="url(#c-can)">
        <rect x="${cx - r}" y="${lt}" width="${2 * r}" height="${lb - lt}" fill="url(#g-art)"/>
        <text x="${cx + r * 0.1}" y="${lt + (lb - lt) * 0.56}" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-style="italic" font-size="${(lb - lt) * 0.22}" fill="#1a1a1a" opacity=".85">Hopfen</text>
        <rect x="${cx + r * 0.42}" y="${lt}" width="1.2" height="${lb - lt}" fill="#000" opacity=".35"/>
        <rect x="${cx - r}" y="${lt}" width="${2 * r}" height="1" fill="#fff" opacity=".5"/><rect x="${cx - r}" y="${lb - 1}" width="${2 * r}" height="1" fill="#000" opacity=".35"/>
      </g>` : ""}
      <path d="${canPath(f, cx, y0, s)}" fill="url(#g-shade)"/>
      <rect x="${cx - r * 0.42}" y="${yTop + nr * 0.3}" width="${r * 0.28}" height="${H}" fill="url(#g-spec)" clip-path="url(#c-can)" opacity=".9"/>
      <ellipse cx="${cx}" cy="${yTop}" rx="${nr}" ry="${ry}" fill="#b9bcc1"/>
      <ellipse cx="${cx}" cy="${yTop + 1}" rx="${nr - 2.2 * s}" ry="${ry - 1.6 * s}" fill="url(#g-lid)"/>
      <ellipse cx="${cx}" cy="${yTop + 1}" rx="${nr - 2.2 * s}" ry="${ry - 1.6 * s}" fill="none" stroke="#2b2d31" stroke-width=".8" opacity=".6"/>
      <ellipse cx="${cx}" cy="${yTop + 1.2}" rx="${nr - 5.5 * s}" ry="${(ry - 1.6 * s) * 0.6}" fill="#7d8086"/>
      <rect x="${cx - 3 * s}" y="${yTop - 1.2}" width="${12 * s}" height="${2.6 * s}" rx="${1.3 * s}" transform="rotate(-18 ${cx} ${yTop})" fill="#c9ccd1" stroke="#45484d" stroke-width=".6"/>
      <circle cx="${cx}" cy="${yTop}" r="${1.4 * s}" fill="#e7e9ec" stroke="#5a5d62" stroke-width=".5"/>
      <ellipse cx="${cx}" cy="${yTop}" rx="${nr}" ry="${ry}" fill="none" stroke="#f3f4f6" stroke-width="1.2" opacity=".7"/>
    `;
    positionLabelHandles(lt, lb, r);
  }
  function positionLabelHandles(lt, lb, r) {
    const el = $("#label-handles"); const rect = canSvg.getBoundingClientRect(); const stage = $("#stage").getBoundingClientRect();
    if (!rect.height) return;
    const k = rect.height / 640;
    el.style.setProperty("--lt", `${((rect.top - stage.top) + lt * k) / stage.height * 100}%`);
    el.style.setProperty("--lb", `${((rect.top - stage.top) + lb * k) / stage.height * 100}%`);
    el.style.setProperty("--lw", `${(2 * r * k) / stage.width * 100 + 6}%`);
  }
  function drawThumb() {
    const f = current, s = 72 / 200, cx = 20, y0 = 70;
    $("#format-thumb").innerHTML = `<defs><linearGradient id="g-th" x1="0" x2="1"><stop offset="0" stop-color="#6c6f74"/><stop offset=".4" stop-color="#e5e7ea"/><stop offset=".7" stop-color="#a2a5ab"/><stop offset="1" stop-color="#55585d"/></linearGradient></defs><path d="${canPath(f, cx, y0, s)}" fill="url(#g-th)"/>`;
  }
  window.addEventListener("resize", () => drawCan());

  /* ----------------------------------------------------------- tools */
  function setTool(t) {
    body.dataset.tool = t;
    $$("[data-tool]").forEach(b => b.classList.toggle("is-active", b.dataset.tool === t && b.tagName === "BUTTON"));
    $$(".tool").forEach(p => p.classList.toggle("is-active", p.dataset.panel === t));
    $$(".rail__item, .toolstrip__item").forEach(b => b.setAttribute("aria-pressed", b.dataset.tool === t));
    body.classList.remove("is-collapsed");
    if (body.dataset.sheet === "peek") body.dataset.sheet = "half";
    if (t === "water") body.dataset.wtool = $("#water-tool .is-active")?.dataset.wtool || "brush";
  }
  document.addEventListener("click", e => {
    const t = e.target.closest("button[data-tool]"); if (t) {
      if (t.classList.contains("is-active") && matchMedia("(max-width:1024px)").matches) { body.dataset.sheet = body.dataset.sheet === "peek" ? "half" : "peek"; return; }
      if (t.classList.contains("is-active") && t.classList.contains("rail__item")) { body.classList.toggle("is-collapsed"); return; }
      setTool(t.dataset.tool);
    }
    const g = e.target.closest("[data-tool-go]"); if (g) setTool(g.dataset.toolGo);
    if (e.target.closest("[data-collapse]")) body.classList.add("is-collapsed");
  });
  document.addEventListener("keydown", e => {
    if (e.target.matches("input, textarea, select")) return;
    const tools = ["can", "colour", "artwork", "light", "water", "camera", "effects", "background"];
    if (/^[1-8]$/.test(e.key)) setTool(tools[+e.key - 1]);
    const angle = { f: "front", q: "three", l: "lid", h: "hero" }[e.key.toLowerCase()];
    if (angle && !e.metaKey && !e.ctrlKey) $(`.hud--angles [data-angle=${angle}]`)?.click();
    if (e.key === "Escape") { $$(".dialog-scrim").forEach(d => d.hidden = true); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") { e.preventDefault(); openDialog("export"); }
  });

  /* --------------------------------------------------- generic selection */
  document.addEventListener("click", e => {
    const item = e.target.closest(".seg__item, .chip, .swatch, .tile, .thumb");
    if (!item || item.closest(".hud--angles") || item.closest("#family-tabs")) return;
    const group = item.closest(".seg, .chips, .swatches, .tiles, .thumbs, [role=radiogroup]");
    if (!group) return;
    $$(".seg__item, .chip, .swatch, .tile, .thumb", group).forEach(x => x.classList.toggle("is-active", x === item));
    if (item.classList.contains("swatch--custom")) { $("#colour-pop").hidden = false; }
    else if (item.classList.contains("swatch")) { $("#colour-pop").hidden = true; }
  });
  $("#colour-pop").addEventListener("click", e => { if (e.target.closest(".btn")) $("#colour-pop").hidden = true; });

  // Sub-mode switches
  $("#bg-mode").addEventListener("click", e => { const b = e.target.closest("[data-bg]"); if (!b) return; body.dataset.bgMode = b.dataset.bg; $$("[data-bg-only]").forEach(x => x.hidden = x.dataset.bgOnly !== b.dataset.bg); });
  $("#art-mode").addEventListener("click", e => { const b = e.target.closest("[data-art]"); if (!b) return; applyArtMode(b.dataset.art); });
  function applyArtMode(m) {
    body.dataset.artMode = m;
    $$("[data-art-only]").forEach(x => x.hidden = x.dataset.artOnly !== m);
    $$("[data-art-help]").forEach(x => x.hidden = x.dataset.artHelp !== m);
  }
  applyArtMode("label");
  $("#water-tool").addEventListener("click", e => { const b = e.target.closest("[data-wtool]"); if (!b) return; body.dataset.wtool = b.dataset.wtool; });

  // Quick angles: HUD chips and camera tiles stay in sync
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-angle]"); if (!a) return;
    $$("[data-angle]").forEach(x => x.classList.toggle("is-active", x.dataset.angle === a.dataset.angle));
    const wrap = $("#can-wrap");
    const map = { front: "", three: "", lid: "rotateX(14deg) ", hero: "rotateX(-8deg) " };
    wrap.style.setProperty("--tilt", map[a.dataset.angle]);
    $("#hud-readout").textContent = ({ front: "Front", three: "¾", lid: "Lid", hero: "Hero" })[a.dataset.angle] + " · " + $("#c-fl").value + " mm";
  });

  // Range inputs: keep --p and the value field in step
  $$("input[type=range]").forEach(r => {
    const sync = () => {
      const p = (r.value - r.min) / (r.max - r.min) * 100; r.style.setProperty("--p", p + "%");
      const v = r.closest(".slider")?.querySelector(".value__input"); if (v && !r.classList.contains("slider__input--centre")) v.value = r.value;
      if (r.id === "w-brush") $("#brush-cursor").style.setProperty("--brush", (r.value * 2.2) + "px");
      if (r.id === "c-spin") $("#spin-needle").style.setProperty("--rot", r.value + "deg");
      if (r.id === "c-fl") $("#hud-readout").textContent = $("#hud-readout").textContent.split(" · ")[0] + " · " + r.value + " mm";
    };
    r.addEventListener("input", sync);
  });

  /* ------------------------------------------------------- light gizmo */
  const light = { az: 35, el: 40 };
  function applyLight() {
    const d = 1 - light.el / 90, a = light.az * Math.PI / 180;
    const hx = 50 + 47.5 * d * Math.sin(a), hy = 50 - 18 * d * Math.cos(a);
    const h = $("#light-handle"); h.style.setProperty("--hx", hx + "%"); h.style.setProperty("--hy", hy + "%");
    const box = $("#gizmo-light").getBoundingClientRect();
    const dx = (50 - hx) / 100 * box.width, dy = (50 - hy) / 100 * box.height;
    h.style.setProperty("--ray-rot", Math.atan2(dy, dx) * 180 / Math.PI + "deg"); h.style.setProperty("--ray", Math.hypot(dx, dy) * 0.82 + "px");
    $(".gizmo__tip").dataset.text = `${Math.round(light.az)}° · ${Math.round(light.el)}°`;
    const sun = $("#dome-sun"); sun.style.setProperty("--sx", 50 + 42 * d * Math.sin(a) + "%"); sun.style.setProperty("--sy", 50 - 42 * d * Math.cos(a) + "%");
    $("#ro-az").textContent = Math.round(light.az) + "°"; $("#ro-el").textContent = Math.round(light.el) + "°";
    h.setAttribute("aria-valuetext", `Azimuth ${Math.round(light.az)}°, elevation ${Math.round(light.el)}°`);
  }
  function dragLight(el, sxFrac, syFrac) {
    const move = e => {
      const b = el.getBoundingClientRect();
      const dx = (e.clientX - (b.left + b.width / 2)) / (b.width * sxFrac), dy = (e.clientY - (b.top + b.height / 2)) / (b.height * syFrac);
      let az = Math.atan2(dx, -dy) * 180 / Math.PI; if (az < 0) az += 360;
      light.az = az; light.el = (1 - clamp(Math.hypot(dx, dy), 0.1, 1)) * 90; applyLight();
    };
    el.addEventListener("pointerdown", e => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); move(e); el.addEventListener("pointermove", move); el.addEventListener("pointerup", () => el.removeEventListener("pointermove", move), { once: true }); });
  }
  dragLight($("#gizmo-light"), 0.475, 0.18);
  dragLight($("#dome"), 0.42, 0.42);
  $("#gizmo-light").style.pointerEvents = "none"; $("#light-handle").style.pointerEvents = "auto";
  $("#light-handle").addEventListener("pointerdown", e => { e.stopPropagation(); const g = $("#gizmo-light"); g.style.pointerEvents = "auto"; g.dispatchEvent(new PointerEvent("pointerdown", e)); g.addEventListener("pointerup", () => g.style.pointerEvents = "none", { once: true }); });
  window.addEventListener("resize", applyLight);
  requestAnimationFrame(applyLight);

  // Spin dial
  const dial = $("#spin-dial");
  dial.addEventListener("pointerdown", e => {
    dial.setPointerCapture(e.pointerId);
    const move = ev => { const b = dial.getBoundingClientRect(); let a = Math.atan2(ev.clientX - (b.left + b.width / 2), -(ev.clientY - (b.top + b.height / 2))) * 180 / Math.PI; if (a < 0) a += 360; const r = $("#c-spin"); r.value = Math.round(a); r.dispatchEvent(new Event("input")); };
    move(e); dial.addEventListener("pointermove", move); dial.addEventListener("pointerup", () => dial.removeEventListener("pointermove", move), { once: true });
  });

  /* --------------------------------------------------------- sheet drag */
  const handle = $("#sheet-handle"), panel = $("#panel");
  handle.addEventListener("click", () => { body.dataset.sheet = ({ peek: "half", half: "full", full: "peek" })[body.dataset.sheet]; });
  handle.addEventListener("pointerdown", e => {
    const startY = e.clientY, startH = panel.getBoundingClientRect().height; let moved = false;
    body.classList.add("is-dragging"); handle.setPointerCapture(e.pointerId);
    const move = ev => { const h = clamp(startH + (startY - ev.clientY), 56, innerHeight * 0.62); if (Math.abs(ev.clientY - startY) > 4) moved = true; body.style.setProperty("--sheet-h", h + "px"); };
    const up = ev => {
      handle.removeEventListener("pointermove", move); body.classList.remove("is-dragging"); body.style.removeProperty("--sheet-h");
      if (!moved) return; ev.stopPropagation();
      const h = startH + (startY - ev.clientY), vh = innerHeight; body.dataset.sheet = h < vh * 0.25 ? "peek" : h < vh * 0.53 ? "half" : "full";
      handle.addEventListener("click", c => c.stopImmediatePropagation(), { once: true, capture: true });
    };
    handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up, { once: true });
  });

  /* ------------------------------------------------------------ dialogs */
  function openDialog(id) { $("#" + id).hidden = false; }
  document.addEventListener("click", e => {
    const o = e.target.closest("[data-open]"); if (o) { openDialog(o.dataset.open); if (o.dataset.open === "gallery") $("#toast").hidden = true; }
    const c = e.target.closest("[data-close]"); if (c) $("#" + c.dataset.close).hidden = true;
    if (e.target.classList.contains("dialog-scrim")) e.target.hidden = true;
    const d = e.target.closest("[data-dismiss]"); if (d) $("#" + d.dataset.dismiss).hidden = true;
  });
  $("#export-ar").addEventListener("click", e => { const b = e.target.closest("[data-ar]"); if (!b) return; $("#export-frame").style.setProperty("--ar", b.dataset.ar); const [w, h] = b.dataset.ar.split("/").map(Number); const long = 2048; $(".export__frame-size").textContent = w >= h ? `${long} × ${Math.round(long * h / w)}` : `${Math.round(long * w / h)} × ${long}`; });

  // Export flow
  let expTimer;
  function exportState(s) { $$("[data-export-state]").forEach(x => x.hidden = x.dataset.exportState !== s); }
  document.addEventListener("click", e => {
    if (e.target.closest("[data-export-start]")) {
      exportState("progress"); let p = 0; $("#hud-status-text").textContent = "Rendering export…"; $("#hud-status").hidden = false;
      clearInterval(expTimer); expTimer = setInterval(() => {
        p = Math.min(100, p + 4 + Math.random() * 6); $("#exp-bar").style.width = p + "%"; $("#exp-pct").textContent = Math.round(p) + "%"; $("#exp-sub").textContent = `Tile ${Math.min(4, 1 + Math.floor(p / 25))} of 4 · supersampled`;
        if (p >= 100) { clearInterval(expTimer); setTimeout(() => { exportState("done"); $("#hud-status").hidden = true; $("#toast").hidden = false; setTimeout(() => $("#toast").hidden = true, 5000); }, 300); }
      }, 160);
    }
    if (e.target.closest("[data-export-cancel]")) { clearInterval(expTimer); exportState("settings"); $("#hud-status").hidden = true; }
    if (e.target.closest("[data-export-reset]")) { exportState("settings"); $("#exp-bar").style.width = "0%"; }
  });

  // Generate flow
  let genTimer;
  function genState(s) { $$("[data-gen-state]").forEach(x => x.hidden = x.dataset.genState !== s); $("#gen-shimmer").hidden = s !== "generating"; $("#hud-status").hidden = s !== "generating"; if (s === "generating") $("#hud-status-text").textContent = "Generating background…"; }
  function startGen() {
    genState("generating"); let p = 0; $("#gen-bar").style.width = "0%";
    clearInterval(genTimer); genTimer = setInterval(() => {
      p = Math.min(100, p + 1.5 + Math.random() * 3); $("#gen-bar").style.width = p + "%"; $("#gen-pct").textContent = Math.round(p) + "%";
      if (p >= 100) { clearInterval(genTimer); genState("idle"); body.classList.add("has-bg"); $("#proto [data-state=generating]").checked = false; }
    }, 220);
  }
  document.addEventListener("click", e => {
    if (e.target.closest("[data-gen-start]")) startGen();
    if (e.target.closest("[data-cancel-gen]")) { clearInterval(genTimer); genState("idle"); $("#proto [data-state=generating]").checked = false; }
  });

  /* ------------------------------------------------ prototype state menu */
  $("#proto").addEventListener("change", e => {
    const s = e.target.dataset.state, on = e.target.checked;
    if (s === "welcome") $("#welcome").hidden = !on;
    if (s === "artwork") { body.classList.toggle("has-art", on); $("#art-drop").hidden = on; $("#art-asset").hidden = !on; drawCan(); }
    if (s === "generating") { if (on) { setTool("background"); startGen(); } else { clearInterval(genTimer); genState("idle"); } }
    if (s === "generror") { setTool("background"); genState(on ? "error" : "idle"); }
    if (s === "toast") $("#toast").hidden = !on;
    if (s === "splash") $("#splash").hidden = !on;
    if (s === "collapsed") body.classList.toggle("is-collapsed", on);
    if (e.target.matches("[data-sheet-set]")) body.dataset.sheet = e.target.value;
  });
  // URL params for screenshots: ?tool=light&sheet=half&state=welcome,generating&art=0
  const q = new URLSearchParams(location.search);
  if (q.get("art") === "0") { body.classList.remove("has-art"); $("#proto [data-state=artwork]").checked = false; }
  else { body.classList.add("has-art"); $("#art-drop").hidden = true; $("#art-asset").hidden = false; }
  if (q.get("bg") === "1") body.classList.add("has-bg");
  if (q.get("sheet")) body.dataset.sheet = q.get("sheet");
  (q.get("state") || "").split(",").filter(Boolean).forEach(s => { const cb = $(`#proto [data-state=${s}]`); if (cb) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); } });
  if (q.get("bgmode")) $(`#bg-mode [data-bg=${q.get("bgmode")}]`)?.click();
  if (q.get("dialog")) openDialog(q.get("dialog"));
  if (q.get("export")) exportState(q.get("export"));
  if (q.get("gen")) genState(q.get("gen"));
  if (q.get("nostates")) $("#proto").style.display = "none";

  selectFormat(current);
  setTool(q.get("tool") || "light");
  if (q.get("sheet")) body.dataset.sheet = q.get("sheet");
})();
