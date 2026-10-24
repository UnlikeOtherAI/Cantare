# Cantare — front-end design spec

Scope: the editor for web, iOS and Android (phone + tablet) from one codebase. Everything in
`docs/brief.md` has a home here; nothing outside it (no accounts UI, teams, pricing). Tokens live in
[`tokens.css`](tokens.css); the clickable shell is in [`prototype/`](prototype/index.html)
(`?tool=light&sheet=half&state=welcome…` URL params switch states — see the end of `app.js`).
Rendered captures of every tool and state at 1440×900, 1366×1024, 1024×1366 and 390×844 are in
[`screenshots/`](screenshots/) (desktop/tablet at 1×, phone at 2×).

---

## 1. Direction

**The render is the product; the chrome is the darkroom.** One dark, warm-neutral theme. The stage
(the photo) is the only large bright or saturated area on screen; every control is grey until it is
active. Amber ("tungsten") is the single accent and doubles as the lighting metaphor: the key-light
handle, the active tool, the primary button. Water tools get a cyan cursor, label handles get violet —
on the stage only, never in the chrome.

- **Feel**: studio tool, not SaaS. Flat surfaces separated by 6–10 % white hairlines, almost no
  shadows (dark UI shadows read as mud). Glassy HUD chips float over the stage.
- **Typography**: *Instrument Sans* for UI (13 px pointer / 14 px touch / 15 px phone). *Instrument
  Serif italic* only for the wordmark, the splash, and one display moment (first-run card title).
  *JetBrains Mono* for every number the user can read or type: dimensions, hex, degrees, pixels.
  Tabular figures everywhere.
- **Spacing**: 4 px grid. Panel content inset 16 px (24 px on tablet), groups 20 px apart, controls
  8 px apart. Density is "pro": one slider per 32 px row on desktop.
- **Radii**: 6 px segments/swatches, 8 px buttons/inputs, 12 px cards/tiles, 16 px sheets/dialogs,
  pill for chips and HUD bars.
- **Motion**: 120 ms hover/press, 200 ms panel switch, 320 ms sheets/dialogs/camera quick-angles,
  600 ms can morphs and colour crossfades (`--m-ease-inout`). Sheet snaps use `--m-spring`. All off
  under `prefers-reduced-motion`.
- **Iconography**: 24-unit grid rendered at 20 px, 1.5 px stroke, round caps/joins. Lucide-compatible;
  names used: `cylinder`(custom can), `palette`, `image`, `sun`, `droplet`, `camera`, `aperture`,
  `image`(landscape), `layout-grid`, `undo-2`, `redo-2`, `upload`, `download`, `share-2`, `x`,
  `chevron-*`, `check`, `plus`, `rotate-ccw`, `search`, `brush`, `spray-can`, `eraser`, `trash-2`,
  `sparkles`, `eye`, `maximize`, `triangle-alert`, `info`, `ellipsis`. Quick-angle icons are custom
  32-unit glyphs (front, ¾, lid, hero) in the prototype sprite.

Colour, type, spacing, radii, shadows, motion and z-layers are all tokens in `tokens.css`; this doc
only names them.

---

## 2. Layout

Three tiers, selected by width (and `pointer: coarse` for sizes):

| Tier | Width | Structure |
|---|---|---|
| **Desktop** | ≥ 1280 | Top bar 48 · Stage (fluid) · Panel 320 · Rail 56, right-aligned |
| **Tablet-wide** (iPad landscape) | 1025–1279 | Same, panel 288 |
| **Compact** (iPad portrait, phones) | ≤ 1024 | Top bar · Stage · **bottom sheet** (panel) · **tool strip** 64 + safe-area |

**Top bar** (all tiers): wordmark left; scene name + current format centre (left on compact);
right: undo/redo, gallery (with count badge), **Export** primary button. On phone the format meta and
redo are hidden and Export becomes a 36 px icon button (redo is a long-press on undo).

**Stage**: fills the remainder; the 3D canvas is the full stage. Overlays, all `z-stage-hud`:

- Top-left: quick-angle chips (Front · ¾ · Lid · Hero), glass, active = amber.
- Bottom-centre: glass pill — Spin, Frame can, Reset view │ Toggle background, readout (`¾ · 50 mm`).
- Bottom-left: status pill while generating/exporting (spinner + text + Cancel).
- Tool overlays (section 4): light gizmo, water brush cursor, label handles.
- First-run card (section 5) bottom-left on desktop, centred above the sheet on compact.

**Rail** (desktop/tablet-wide): 8 tools, 48 × 52 items (icon + 10 px label), amber 2 px bar on the
right edge for the active tool, `1–8` keyboard shortcuts shown on hover. Clicking the active tool
collapses the panel (stage takes the width); clicking any tool reopens it.

**Panel**: header 48 (title + collapse chevron), body scrolls. One tool at a time; switching tools
replaces the body with a 200 ms slide. Groups are separated by hairlines with uppercase 12 px titles.

**Bottom sheet** (compact): the same panel content, 16 px top radius, 36 × 4 handle. Three detents:

| Detent | Height | When |
|---|---|---|
| peek | 56 px (handle + title) | tap the active tool again, or drag down |
| half | 44 dvh | default when a tool is chosen |
| full | 62 dvh — **never more** | drag up; long lists (format picker, effects) |

The stage is never covered: the can re-frames into the strip above the sheet (camera framing uses the
visible stage rect, not the viewport). At *full* the angle chips and bottom pill fade out so the strip
is pure preview. On tablet the sheet content is a centred 720 px column.

**Tool strip** (compact): 8 items, ≥ 44 × 44. Tablet shows icon + label for all; phone shows labels
only on the active item (amber pill). Gallery and Export stay in the top bar so the strip never
scrolls.

**Touch**: every control is ≥ 44 px tall under `pointer: coarse` (sliders get a 24 px thumb, swatches
36 px, toggles 44 × 26). Sliders stack label/value above a full-width track so the thumb is reachable;
on desktop they are one 32 px row (label 96 · track · value 56).

---

## 3. Stage interaction (always on)

| Input | Pointer | Touch |
|---|---|---|
| Orbit | drag | one finger |
| Zoom | wheel / pinch on trackpad | pinch |
| Pan | shift-drag or middle-drag | two-finger drag |
| Spin can | drag the Spin button horizontally | — (use Camera panel dial) |

When a tool claims the stage (water brush/spray, artwork drag, light handle) a one-finger drag goes to
the tool; **two fingers always orbit**. Quick-angle chips animate the camera over 320 ms. Double-tap
the stage = Frame can.

---

## 4. Tools

Order in the rail is the workflow order. Each tool's panel is listed top-to-bottom with control types
(see section 6 for component specs).

### 4.1 Can

- **Current format card** (accent border): true-proportion silhouette 40 × 72, name
  (`330 ml · Standard`), `Ø 66.3 × 115.2 mm` (mono), supplier · end code · template size or
  "no template, size inferred".
- **Lid** select, shown only when the format has end variants (330 ml sleek: 202 / 200).
- **Search** field (matches capacity, oz, family, supplier, diameter).
- **Family tabs** (scrolling segmented): All · Standard 66 · Sleek 58 · Slim 53 · US · Large.
- **Format list**, grouped by family with group headers when "All" is active. Row: silhouette
  scaled to the largest can (Crowler) so height differences are visible · name + badge (`8 oz`,
  `UK pint`, `Long Fit · Ø63.5`, `template`) · supplier · end · `Ø d × h` right-aligned mono.
  Selected row = accent soft fill + accent border. 26 formats ship (data in `app.js` `FORMATS`),
  mirroring `docs/can-reference.md` §2–4.
- Selecting morphs the can over 600 ms (barrel length change, not a stretch — the lid, neck and heel
  keep their dimensions). Artwork re-wraps; a label keeps its mm height and base offset.
- Desktop: list lives in the panel. Compact: the sheet usually goes to *full* for this tool.

### 4.2 Colour & finish

Two identical groups, **Body** and **Lid**, independent:

- Swatch row: Classic silver · Classic gold · Black · White · **Custom** (conic rainbow with +) ·
  hex field (`#` + 6 mono chars, live-validated, accepts paste with or without `#`).
- Custom opens a popover (inline on compact): saturation/value area 140 px, hue bar, hex, Done,
  four recent colours. Picking updates the can live.
- Finish segmented: Gloss · Satin · Matte · Brushed.
- Lid group header has **Same as body** (copies colour + finish).
- Group hint on Body: "Shows wherever artwork doesn't cover" — this is the base colour from the brief.

### 4.3 Artwork

- **Mode** segmented: **Printed can** · **Label**, with a one-line help under it.
- **Dropzone** 112 px (empty) → **Asset card** (loaded): 72 × 48 thumb, filename, `px · dpi`, and a
  fit line:
  - green `Matches Ardagh 440 template (206 × 141.4 mm)` when the image ratio matches a known
    template for the chosen format (±1 %),
  - amber `Size inferred from image: 208 × 84 mm` otherwise (width = circumference or the chosen
    partial wrap; height from the aspect ratio).
  Overflow menu: Replace, Remove, Re-infer size.
- Label only: **Wrap** Full · Partial (partial exposes a Coverage % slider), **Material** Paper · Film.
- Sliders: **Height** mm (label only), **Position** mm from base (label only), **Rotation** °
  (both). Printed can covers heel→neck by definition, so only rotation applies.
- Stage: with Artwork active, horizontal drag on the can rotates the artwork (not the camera);
  vertical drag moves a label; the label's top/bottom edges show violet dashed lines with 44 × 14
  pill handles to resize. Printed cans show no handles.
- Note card reminds that the body colour shows around the artwork and links to Colour.
- Low-resolution warning (image < 150 dpi at the inferred size) appears as an amber line in the asset
  card; it never blocks.

### 4.4 Light

- **Key light** — direct manipulation in two synchronised places:
  1. **Stage gizmo**: a dashed horizon ellipse around the can (front half solid) and an amber sun
     handle (18 px, 28 px touch, 46 px hit area) with a ray toward the can and a mono readout
     `35° · 40°`. Drag anywhere: the handle's angle around the can centre = **azimuth**; its distance
     from the centre = **elevation** (on the horizon ring = 0°, at the can = 90° overhead). The ring is
     in screen space so the mapping is identical from any camera angle; the renderer converts to
     world space relative to the camera so "light from the left" stays left when you orbit.
  2. **Dome widget** in the panel (120 px top-down disc, same mapping) with Azimuth / Elevation /
     Distance readouts.
- Sliders: **Intensity** % · **Softness** % · **Temperature** K (2700–8000, warm→cool gradient
  track).
- **Rim light** group: toggle in the header, Intensity, Side (Opposite · Left · Right).
- **Environment** (reflections): 6 tiles 3 × 2 — Softbox · Hard studio · Daylight · Golden hour ·
  Bar · Overcast — plus Rotation °.
- Keyboard: arrow keys nudge the focused handle 1°, shift = 10°.

### 4.5 Water

- **Presets** chips: Dry · Chilled · Ice cold · Poured over (set the four sliders; "Dry" clears).
- **Droplets**: Density % · Size % · Runs & drips % · Haze % (condensation fog).
- **Paint by hand**: 4-way icon segmented — Orbit (hands the stage back to the camera) · **Brush** ·
  **Spray** · **Erase**; Brush size mm, Flow %. Stage cursor: cyan ring sized to the brush (dashed
  for spray, grey for erase). Brush paints droplets along the drag; spray accumulates while you hold
  still ("watering" the can in place) and drifts downward into runs; erase removes.
- **Clear all water** ghost button (undoable, no confirm).
- Hint card: "Two fingers still orbit."

### 4.6 Camera

- **Quick angles** 4 tiles (same four as the HUD chips; both stay in sync).
- **Can spin**: 72 px dial (drag around) + Spin ° slider + **Turntable** toggle (slow continuous
  spin, pauses while any drag is active, never exported mid-frame). Help: "Rotates the can, not the
  camera."
- **Lens**: Focal length mm (24–135) · Height ° (camera elevation, −30…60).
- **Reset camera** ghost button.
- HUD readout shows angle name + focal length.

### 4.7 Effects

Accordion of six rows (48 px), each with an **enable toggle** in the header, a mono summary value on
the right and a chevron; expanded rows show sliders:

| Row | Controls |
|---|---|
| Depth of field | Aperture ƒ/ · Focus: Label · Lid · Tap to focus (tap the stage) |
| Bloom | Amount · Threshold |
| Vignette | Amount |
| Grain | Amount · Size |
| Colour grade | Presets chips Neutral · Crisp · Warm · Cool · Film · Mono; Exposure EV · Contrast · Saturation · Warmth (centre-zero sliders) |
| Ground | Shadow · Shadow softness · Reflection · Reflection blur |

Disabled rows render their title at `--c-text-3`.

### 4.8 Scene (background)

- **Source** segmented: **Generate** · Upload · Colour.
- **Generate**: prompt textarea (3 rows, 600 chars, counter, shows the aspect/size it will produce —
  always the current export aspect) · suggestion chips (scrolling) · state block (section 5) ·
  **Recent** 4 thumbs (tap to reuse; kept on device).
- **Upload**: dropzone · Fit: Fill · Fit · Blur % · "Drag the backdrop on the stage to reposition."
- **Colour**: Solid · Gradient (two 40 px stops + angle) · preset chips Studio grey · White sweep ·
  Charcoal · Brand (brand = body colour).
- **Match the scene** group (all sources): **Match light to background** (estimates key direction and
  temperature from the image; turning it off leaves the current light) · **Ground the can** (contact
  shadow + reflection on the backdrop).
- Toggle background visibility from the HUD eye button without losing it.

### 4.9 Export (top bar) and Gallery

**Export dialog** (720 px two-column on desktop; bottom sheet on phone): left a live preview framed to
the chosen aspect with a `w × h` tag; right:

- Aspect: 1:1 · 4:5 · 3:4 · 16:9 · 9:16.
- Size (longest edge px): 1024 · 2048 · 4096 · 6144, with the note that ≥ 4096 renders in tiles.
- Format: PNG · JPEG (JPEG adds a Quality slider).
- Transparent background toggle (PNG only; shadow kept as alpha).
- Primary button: **Download PNG** on web; **Save to Photos** + secondary **Share** on iOS/Android.
- Keyboard: `⌘E` opens, `⏎` exports.

**Gallery** (top bar icon with count badge): dialog grid of saved renders (thumb at its own aspect,
title = artwork name · format · scene, `w × h · FORMAT`). Tap → full view with Download/Share and
Delete. Empty state: serif "Nothing saved yet" + "Exports land here. They stay on this device."

---

## 5. States

| State | Where | Treatment |
|---|---|---|
| **Loading** | full-screen splash | wordmark in serif italic, 160 × 2 px amber indeterminate bar, "Compiling shaders…"; the can fades in over 600 ms when ready |
| **First run** | stage card | default scene is already beautiful: 330 ml standard, classic silver gloss body, brushed silver lid, no artwork, Softbox, "Chilled" water off, studio-grey gradient. Glass card: serif "Put your artwork on it." + one line + **Upload artwork** (primary) / **Choose a can**. Dismissable; never shown again once artwork is loaded |
| **AI generating** | Scene panel + stage | panel: progress card (bar, %, "Usually 15–30 s. You can keep editing the can.", Cancel). Stage: slow diagonal shimmer over the backdrop + bottom-left status pill with Cancel. The Generate button is replaced, not disabled, so there is no dead control |
| **Generation error** | Scene panel | danger alert: "Generation failed. The image service didn't respond. Your prompt is kept." + **Retry**. The previous background stays |
| **Export in progress** | Export dialog + stage | dialog body swaps to a large progress card ("Rendering 2048 × 2560", %, "Tile 2 of 4 · supersampled", Cancel); the stage status pill mirrors it; editing is locked until done or cancelled |
| **Export success** | Export dialog + toast | green check mark, "Saved to gallery", filename · size, **Download again** / **Share**, "Export another size". Toast "Saved to gallery — Open" for 5 s; gallery badge increments |
| **Export/save error** | toast (danger) | "Couldn't save — Retry". On mobile a denied Photos permission explains how to allow it |
| **Artwork too small** | Artwork asset card | amber line "Low resolution: 96 dpi at this size" |
| **Offline (generation)** | Scene panel | the Generate button becomes "Offline — generation needs a connection"; upload and colour still work |
| **Panel collapsed** | desktop | stage takes the panel width; rail stays |
| **Empty gallery** | gallery dialog | see 4.9 |

Undo/redo covers every scene change (not camera moves); the top bar buttons disable at the ends of
the stack.

---

## 6. Component inventory

Sizes are desktop → touch where they differ. All colours/radii reference `tokens.css`.

| Component | Spec |
|---|---|
| **Top bar** | h 48 (44 phone) + safe-top, `--c-bg-0`, bottom hairline `--c-line-1`. Wordmark serif italic 22/20 px |
| **Rail** | w 56, items 48 × 52, `--r-3`; active: `--c-bg-2` + 2 px `--c-accent` bar; label 10 px/500 |
| **Tool strip** | h 64 + safe-bottom; items flex ≥ 44 × 44, icon 20 + label 10 px; active `--c-accent` (phone: amber soft pill with label) |
| **Panel / sheet** | w 320 / 288; sheet detents 56 / 44 dvh / 62 dvh; handle 36 × 4 `--c-line-3`; head 48 (36 in sheet) title 14/600 |
| **Group** | title 12 px uppercase 0.06 em `--c-text-2` 600; hint 12 px `--c-text-3`; groups separated by hairline + 20 px |
| **Button** | h 32 → 44, px 12, `--r-3`, 500. Primary `--c-accent`/`--c-text-on-accent`; default `--c-bg-2` + `--c-line-2`; ghost transparent; `--sm` 24 → 36, `--lg` 44 |
| **Icon button** | 32 → 44 square, `--r-3`; glass variant `--c-glass` + `--c-glass-border` + blur 12 |
| **Chip** | h 28 → 36, pill, `--c-bg-2` + `--c-line-2`; active `--c-accent-soft` + `--c-accent-line`; glass on stage, active glass = solid accent |
| **Segmented** | container `--c-bg-2` + `--c-line-1`, 2 px padding, `--r-3`; items h 26 → 38, `--r-2`, active `--c-bg-4` + `--sh-1`; `--sm` h 26 → 34; `--icons` h 52 icon over 11 px label; `--scroll` for > 4 items |
| **Slider** | track 4 px `--c-bg-4`, fill `--c-text-2`; thumb 16 → 24 `--c-text-1`, 1.12× on hover; centre-zero variant fills from the middle; temperature/warmth tracks are gradients. Value field 56 (76 `--wide`) × 24 → 32, mono right-aligned, unit 11 px `--c-text-3` |
| **Toggle** | 36 × 20 → 44 × 26, knob 16/22, on = `--c-accent` with dark knob; `row-toggle` = label + hint left, toggle right, 8 px vertical padding |
| **Swatch** | 28 → 36, `--r-2`, inset gloss; active = 2 px gap ring in `--c-accent`; custom = conic rainbow + "+"; `--lg` 40 |
| **Hex field** | h 24 → 36, `#` prefix `--c-text-3`, 6 mono uppercase chars |
| **Select / Search / Textarea** | h 32 → 44, `--c-bg-2` + `--c-line-2`, `--r-3`; focus `--c-line-3`; textarea `--r-4` with footer counters |
| **Format card** | padding 12, `--r-4`, `--c-bg-2`, accent border; thumb 40 × 72 |
| **Format row** | grid 28 / 1fr / auto, min-h 44, `--r-3`; silhouette scaled to 84 × 194 mm envelope; badge 10 px `--c-bg-4` |
| **Dropzone** | min-h 112, dashed `--c-line-3`, `--r-4`; hover/drag-over = accent soft |
| **Asset card** | padding 8, `--r-4`, thumb 72 × 48; fit line 11 px (`--c-success` template / `--c-accent` inferred) |
| **Dome** | 120 (104 phone) disc, dashed inner ring at 30 %, crosshair, 22 px can disc, 14 px sun with `--sh-glow-accent` |
| **Tile** | min-h 72, `--r-4`, icon 28 or 16:9 art, label 11 px; active accent soft |
| **Dial** | 72 disc, 2 px amber needle, tick at 12 o'clock |
| **Effects row** | h 48, toggle + title + mono value + chevron; body padding 4/16/16 |
| **Progress** | card `--r-4`, bar 4 px `--c-bg-4` / `--c-accent`, rows 13/12 px |
| **Alert** | `--r-4`, icon 18, strong title; danger = `--c-danger-soft` + 35 % danger border |
| **Light gizmo** | ring ellipse rx 47.5 % ry 18 % of a square box (min(78 vmin, 560) desktop, min(64 vw, 52 vh) tablet, min(90 vw, 60 vh) phone); handle 18 → 28 with 46 px hit area; ray 1 px amber→transparent |
| **Brush cursor** | ring = brush size × 2.2 px, 1.5 px `--c-water`, fill `--c-water-soft`, 4 px centre dot |
| **Label handles** | dashed 1 px `--c-artwork` lines, pills 44 × 14 with 3 px `--c-bg-0` halo |
| **HUD pill** | `--c-glass`, border `--c-glass-border`, blur 12, pill radius, 4 px padding |
| **Welcome card** | w ≤ 360 (420 compact), padding 20, `--r-5`, glass + blur 20 + `--sh-2`; title serif 28/32 (24/28 phone) |
| **Dialog** | w ≤ 720 (export) / 480 compact; phone = bottom sheet 92 dvh, `--r-5` top; head 56; scrim `--c-scrim` + blur 6 |
| **Toast** | min-w 240 max 360, `--r-4`, `--c-bg-2` + `--c-line-2`, bottom 20 + safe (above the strip on compact), 5 s |
| **Splash** | `--c-bg-0`, wordmark 40 px serif italic, bar 160 × 2 |

Focus: `--sh-focus` (2 px bg gap + 2 px accent) on every interactive element via `:focus-visible`.

---

## 7. Keyboard (web / iPad keyboard)

`1–8` tools · `⌘Z / ⇧⌘Z` undo/redo · `⌘E` export · `F` front · `Q` ¾ · `L` lid · `H` hero ·
`R` reset view · `Space` toggle turntable · `Esc` close dialog/popover · arrows nudge the focused
handle/dial.

---

## 8. Implementation notes

- The stage canvas is the full stage element; overlays are DOM. Camera framing must respect a "safe
  rect" = stage minus the sheet height (compact) and minus 56 px top / 72 px bottom for HUDs, so Frame
  can and quick angles centre the can in what the user can see.
- `pointer: coarse` drives sizes; width drives layout. Test iPad with a trackpad (fine pointer,
  compact layout at portrait).
- All sliders expose their value as an editable mono field; typing commits on blur/enter and clamps.
- Light direction is stored as azimuth/elevation relative to the camera (section 4.4) so it survives
  orbiting; "Match light to background" writes the same two numbers.
- The prototype's `FORMATS` array is the format list UI contract (id, family, name, alt badge, d, h,
  rim, neck, supplier, end, template, variants).
