# Beverage can 3D reference: UK, EU and US

This is the dimensional reference Cantare's can models are built from. There is enough published
information to build convincing, dimensionally grounded models for UK, EU and US cans. The approach is
a few body families with interchangeable lid assemblies, keeping the differences between
manufacturers.

The familiar **330, 440, 500 and 568 ml beer cans** generally belong to the approximately **66 mm
body family**. A **330 ml sleek can is approximately 58 mm wide**, and a **250 ml slim can is
approximately 53 mm wide**. Those need different models. Manufacturer drawings also show differences
in shoulders, standing rings and lids within the same nominal capacity.
[help.nomoq.com](https://help.nomoq.com/hubfs/Product%20Specifications/04_5_1_66_330_1_07_en.pdf?hsLang=en)

The original study came with three companion files that were not supplied with this document:

| File | Contents |
|---|---|
| `beverage_can_3d_reference_uk_eu_us.pdf` | Illustrated study, dimensions, tolerances, lid details, modelling guidance and 57 linked sources |
| `beverage_can_parameters_uk_eu_us.json` | Supplier-specific measurements, evidence labels, artwork dimensions and three adjustable radius/height profiles |
| `beverage_can_size_comparison.png` | Comparison at the same scale |

The dataset covers **45 format and supplier records**, **36 with published height references**. The
remaining formats are identified with their missing dimensions left explicit. Cantare's own format
data lives in [`src/engine/formats.ts`](../src/engine/formats.ts) and is derived from the tables below.

**The main limitation:** public engineering sheets specify the important dimensions, but usually do
not fully define every shoulder curve, heel radius, tab contour and finished rim diameter. Published
measurements, calculated values and visual modelling assumptions are kept distinct throughout.

## 1. The measurements you must distinguish

Several different diameters are casually called "the can diameter" or "the lid diameter".

| Measurement | What it actually describes |
|---|---|
| **Body outside diameter** | The main cylindrical barrel |
| **Bottom body diameter** | The widest part of the body near its lower transition; this can slightly exceed the barrel diameter |
| **Standing-ring diameter** | The smaller ring that touches the table |
| **Neck plug diameter** | An inside fitting dimension at the neck |
| **Loose-end curl diameter** | The width of the unattached lid before seaming |
| **Finished seam outside diameter** | The outside of the visible rim on the closed can |
| **Open/flanged can height** | Height before the lid is attached |
| **Seamed can height** | Height after closing, measured to the specified seam datum |
| **Freeboard** | Space above the specified liquid level |
| **Nesting height** | A stacking-related dimension |

For example, Ardagh's 330 ml standard drawing specifies **66.3 mm maximum body diameter**, **66.6 mm
maximum bottom-body diameter**, **48.3 mm maximum stand diameter**, and **52.4 mm neck plug
diameter**. These are four different dimensions on one can.
[help.nomoq.com](https://help.nomoq.com/hubfs/Product%20Specifications/04_5_1_66_330_1_07_en.pdf?hsLang=en)

Likewise, a **202 end** can have a loose curl diameter around **59.3–59.4 mm** before seaming. That
does **not** mean the finished visible rim should be modelled at that diameter. The industry's
nominal size codes no longer translate directly into exact finished dimensions.
[help.nomoq.com](https://help.nomoq.com/hubfs/Product%20Specifications/04_5_2_52_202_1_06_en.pdf?hsLang=en)

### How to read the tables below

All dimensions are **millimetres**.

- **S — Seamed:** the source explicitly specifies the closed-can height.
- **F — Flanged/open:** the height is for the unclosed can.
- **C — Catalogue:** a manufacturer publishes the height but does not clearly specify its measurement datum.
- **Max:** a permitted maximum, rather than a measured average.

For the Ardagh European examples, empty and seamed heights have the **same nominal value**, with
different tolerances. There is no universal rule such as "add 1 mm for the lid".

## 2. UK and EU beer cans

### The principal sizes

| Nominal capacity | Manufacturer example | Body outside diameter | Published height | Height basis |
|---|---|---:|---:|---|
| **330 ml** | Ardagh standard | **66.3 max** | **115.2 ±0.4** | S |
| **440 ml** | Ardagh standard, round shoulder | **66.3 max** | **149.9 ±0.4** | S |
| **500 ml** | Ardagh standard | **66.3 max** | **168.0 ±0.4** | S |
| **550 ml** | CANPACK standard | **66.3** | **182.65** | C |
| **568 ml** | CANPACK standard | **66.3** | **188.09** | C |

The first three are supported by detailed Ardagh engineering drawings; the 550 and 568 ml values are
CANPACK catalogue dimensions.

For beer marketing work, **330, 440, 500 and 568 ml are the essential UK/EU standard-body assets**.

#### The pint distinction

| Quantity | Volume |
|---|---:|
| **UK imperial pint** | **568.26125 ml** |
| **US liquid pint: 16 US fl oz** | **473.176473 ml** |
| **19.2 US fl oz** | **567.8117676 ml** |
| **500 ml** | Neither a UK nor a US pint |

These are calculated from the relevant unit definitions. A commercial **568 ml** can and a **19.2 US
fl oz** can are practically the same capacity for visual planning, but the unit conversions are not
exactly equal.
[NIST](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)

### Other European formats worth including

Wider, shorter standard cans:

| Capacity | Manufacturer example | Body diameter | Height | Basis |
|---|---|---:|---:|---|
| **237 ml** | Crown standard | 66 | 88.05 | C |
| **250 ml** | Crown standard | 66 | 91.69 | C |
| **300 ml** | Crown standard | 66 | 106.3 | C |

Crown lists these for Europe, the Middle East and Africa. That establishes regional availability,
rather than popularity in every individual country.
[Crown](https://www.crowncork.com/beverage-packaging/products/beverage-cans/8oz-237-ml-standard)

A further distinct shape is **CANPACK's 449 ml Long Fit**, at **63.5 mm diameter × 168 mm height**.
It sits between the usual sleek and standard widths. Keep it as its own format rather than rounding it
into a generic 450 ml standard can.
[CANPACK](https://www.canpack.com/capabilities/beverage-cans/44-9-cl-long-fit/)

Ardagh's European range also includes **375, 470 and 530 ml standard cans**, plus **187 ml slim**.
Their existence is verified, but reliable complete mechanical dimensions for those specific products
were not established. Their public print-template heights are insufficient to determine overall can
height. They are incomplete records in the dataset.
[Ardagh brochure](https://www.ardaghmetalpackaging.com/uploads/sample-store/product_brochure-2024.pdf)

## 3. Smaller cans for soft drinks, mixers and cocktails

The useful distinction here is **slim versus sleek**.

### Slim: approximately 53 mm body diameter

| Capacity | Manufacturer example | Body diameter | Height | Basis |
|---|---|---:|---:|---|
| **150 ml** | CANPACK slim | **53.4** | **88.4** | C |
| **185 ml** | CANPACK slim | **53.4** | **103.38** | C |
| **200 ml** | Ardagh slim, wine specification | **53.4 max** | **111.2 ±0.4** | S |
| **240 ml** | Crown slim | **53** | **129.5** | C |
| **250 ml** | Ardagh slim | **53.4 max** | **134.0 ±0.4** | S |

[CANPACK 15 cl slim](https://www.canpack.com/capabilities/beverage-cans/15-cl-slim/)

**Supplier differences are real:** Crown's 250 ml slim catalogue gives **133 mm height**, whereas the
selected Ardagh drawing gives **134 mm**. Keep those as alternative supplier versions.
[Crown](https://www.crowncork.com/beverage-packaging/products/beverage-cans/83oz-250ml-slim)

### Sleek/Fit: approximately 57–58 mm body diameter

| Capacity | Manufacturer example | Body diameter | Height | Basis |
|---|---|---:|---:|---|
| **200 ml** | CANPACK Fit | **58.1** | **95.2** | C |
| **250 ml** | Ball sleek | **58.1 max** | **113.90 ±0.30** | F |
| **300 ml** | CANPACK Fit | **58.1** | **132.89** | C |
| **330 ml** | Ardagh sleek, 202 neck | **58.1 max** | **145.4 ±0.4** | S |
| **355 ml** | CANPACK Fit | **58.1** | **156.9** | C |

These are supplier-specific dimensions. Crown's alternative 300 ml sleek is **58 × 133.9 mm**, for
example. [CANPACK 20 cl Fit](https://www.canpack.com/capabilities/beverage-cans/20-cl-fit/)

**A 250 ml can can therefore have three substantially different silhouettes:**

| 250 ml form | Approximate diameter × height |
|---|---:|
| Short standard | **66 × 91.69 mm** |
| Sleek | **58.1 × 113.9 mm** |
| Slim | **53.4 × 134 mm** |

That is why capacity alone is a poor identifier for a 3D asset.
[Crown](https://www.crowncork.com/beverage-packaging/products/beverage-cans/83oz-250ml-standard)

#### The 330 ml sleek also has different lid sizes

Both **200-neck** and **202-neck** versions exist:

- Ardagh's 202 example has a **52.4 mm plug diameter** and **10 mm overall neck height**.
- NOMOQ's printed 200 example has a **50.0 mm plug diameter** and **12 mm overall neck height**.
- Both have **145.4 mm nominal seamed height**.

The shoulder and top assembly therefore need to change even though the nominal capacity and overall
height remain the same.
[help.nomoq.com](https://help.nomoq.com/hubfs/Product%20Specifications/04_5_1_58_330_1_02_en.pdf?hsLang=en)

## 4. US cans

### Main dimensional references

| US format | Nominal metric label | Manufacturer example | Body diameter | Height reference | Basis |
|---|---:|---|---:|---:|---|
| **7.5 fl oz sleek** | 222 ml | Ball | **57.30 ±0.20** | **103.84 ±0.38** | F |
| **12 fl oz standard** | 355 ml | Ball | **66.04 ±0.20** | **122.22 ±0.38** | F |
| **12 fl oz sleek** | 355 ml | Ball CS-A1185 | **57.37 ±0.20** | **155.63 ±0.38** | F |
| **16 fl oz standard** | 473 ml | Ball, cross-checked against Crown | **66.04 ±0.20** | **157.23 rounded** | F |
| **19.2 fl oz standard** | 568 ml | Ball/Saxco | **65.9 ±0.2** | **188.1 ±0.4** | F |
| **24 fl oz / Mega** | 710 ml | CANPACK | **73** | **193.29** | C |
| **32 fl oz Crowler** | 946 ml | Ball/Saxco | **83.59 ±0.25** | **193.14 ±0.38** | F |

The Ball values come from identified engineering drawings; the CANPACK 710 ml page explicitly
identifies the US among its markets.
[cansource.com](https://www.cansource.com/assets/Uploads/Products/Documents/Ball-7-v2.5oz-slk-can-specs-CBW.pdf)

Two useful visual observations:

- **US 12 oz standard is taller than European 330 ml standard.**
- **A 32 oz Crowler is much wider than a 24 oz can**, despite their similar heights.

The Crowler also uses a **300 end family**, with a **72.69 mm neck plug** in the selected drawing. It
needs a separate large lid assembly.

#### A source error worth knowing about

The Ball 16 oz drawing prints:

- **6.190 ±0.015 inches**, and
- **155.23 ±0.38 mm**.

Those disagree. The inch value converts to **157.226 ±0.381 mm**, and Crown independently publishes
**157.23 mm**. The cross-checked value is used, and the inconsistency is recorded in the data.
[craftbevwarehouse.com](https://craftbevwarehouse.com/assets/Uploads/Products/Documents/Ball-16oz-std-can-specs.pdf)

### Other US formats

The study also identifies:

- **8 oz squat/standard**
- **8.4 oz slim**
- **8.4 oz sleek**
- **10 oz sleek**
- **10.5 oz sleek**

Ardagh's US templates confirm the squat and sleek formats; Silver King confirms US manufacture of
8.4 oz slim. Crown's 10 oz page publishes a 58 mm diameter but gives its height as nominal code
**503**, rather than an unambiguous metric measurement. These incomplete references are not promoted
into exact finished-can dimensions.
[Ardagh Metal Packaging](https://www.ardaghmetalpackaging.com/regions/americas/north-america/graphics-portal/can-templates)

## 5. Detailed geometry for the main European beer bodies

| Parameter | 330 ml standard | 440 ml standard | 500 ml standard |
|---|---:|---:|---:|
| **Seamed height** | 115.2 ±0.4 | 149.9 ±0.4 | 168.0 ±0.4 |
| Empty can height | 115.2 ±0.3 | 149.9 ±0.3 | 168.0 ±0.3 |
| **Body outside diameter** | 66.3 max | 66.3 max | 66.3 max |
| Bottom body outside diameter | 66.6 max | 66.6 max | 66.6 max |
| **Overall neck height** | 19 ±1 | 20 ±1 | 20 ±1 |
| Neck plug diameter | 52.4 ±0.3 | 52.4 ±0.3 | 52.4 ±0.3 |
| **Standing-ring diameter** | 48.3 max | 48.3 max | 48.3 max |
| Nesting height | 2.5 nominal | 2.5 nominal | 2.5 nominal |
| Unseamed flange diameter | 57.5 max | 57.5 max | 57.5 max |
| Unseamed flange width | 2.13 ±0.25 | 2.13 ±0.25 | 2.13 ±0.25 |
| Flange thickness, including lacquer | 0.160 nominal | 0.160 nominal | 0.160 nominal |
| Neck seaming clearance | 3.0 min | 3.0 min | 3.0 min |

These values belong to the specific Ardagh drawings.
[help.nomoq.com 440 ml](https://help.nomoq.com/hubfs/Product%20Specifications/04_5_1_66_440_1_05_en.pdf?hsLang=en)

For modelling, the most valuable rows are **seamed height, barrel diameter, neck height,
standing-ring diameter and the lower-body maximum**. The unseamed flange rows explain the closure
interface; they should not be drawn as an exposed flange on a finished can.

### What the body profile should contain

From bottom to top:

1. A small contact ring.
2. A curved heel expanding outward.
3. The nearly straight cylindrical wall.
4. A rounded shoulder reducing the diameter.
5. The narrow neck.
6. The completed top seam.

For the underside, the dome rises **up into the can**. Two-piece drawn-and-ironed beverage cans have
an integral body and bottom, with the separate end attached at the top.
[Google Patents WO2017008961A1](https://patents.google.com/patent/WO2017008961A1/en)

**Modelling recommendation:** within a compatible family, create the other sizes primarily by
changing the straight barrel length. Retain the correct shoulder, heel and lid dimensions for each
SKU. Scaling the complete mesh vertically would also stretch the tab, seam and base.

## 6. Lid and rim geometry

For marketing, this is the area where a crude model most readily gives itself away.

The visible top consists of:

- The rounded seam crown.
- The inner wall descending from it.
- The recessed annular trough, called the countersink.
- The central panel.
- Reinforcement beads and finger recess.
- The tear score.
- The rivet.
- The pull tab.

### Published Ardagh CDL dimensions

| Parameter | 202 CDL end | 200 CDL end |
|---|---:|---:|
| **Loose curl diameter** | 59.31 ±0.25 | 56.90 ±0.20 |
| Loose curl height | 2.05 ±0.15 | 2.08 ±0.15 |
| Inside loose curl diameter | 57.66 min | 55.25 min |
| **Countersink depth** | 6.35 ±0.15 | 6.35 ±0.15 |
| Panel height above trough | 2.08 nominal | 2.08 nominal |
| End sheet thickness, including lacquer | 0.22 | 0.21 |
| **Finished seam axial height** | 2.50 ±0.15 | 2.50 ±0.15 |
| Approximate end mass | 2.5 g | 2.3 g |

The seam height comes from the matching seaming specifications.

A useful derived starting point for these CDL profiles is:

centre-panel depression ≈ 6.35 − 2.08 = **4.27 mm**

That calculation preserves the drawing's vertical references. Treat it as a profile construction
value rather than a scan of a pressurised can.

#### The finished rim diameter remains sample-dependent

No consistent current manufacturer specification establishes one universal finished outside seam
diameter for every 202 can. The starter profiles therefore use:

| Parameter | Visual starting value | Status |
|---|---:|---|
| 202 finished rim outside diameter | **54.0 mm** | Adjustable approximation |
| 200 finished rim outside diameter | **51.6 mm** | Adjustable approximation |

**These are the first two values to replace with a caliper measurement from an actual can.**

Also keep **end size** and **end profile** separate. A 202 B64, 202 CDL and a different proprietary
end can have different panels, countersinks and opening features. Crown's catalogue documents several
visibly different end designs, including SuperEnd, full-aperture and vented options.

## 7. Pull tab, opening and underside

### Pull-tab dimensions

Stolle publishes these example dimensions:

| Tab example | Length | Width |
|---|---:|---:|
| Conventional comparison tab | **25.019 mm** | **15.748 mm** |
| Short ecology-tab example | **21.844 mm** | **15.6464 mm** |

These are **published design examples**, not universal current specifications. They give a
defensible starting scale of approximately **25 × 15.75 mm**, with a shorter alternative around
**21.8 × 15.65 mm**.
[Google Patents US20210347526A1](https://patents.google.com/patent/US20210347526A1/en)

For a close-up model, expose:

| Tab feature | Required parameter |
|---|---|
| Outer shape | A traced two-dimensional contour |
| Finger hole | Its own contour, dimensions and position |
| Nose | Shape and position relative to the rivet |
| Formed section | Sheet thickness, rolled-edge shape and total formed height |
| Placement | Height above the panel and rotation |
| Rivet | Position, head diameter, flattened head shape and height |

The outline matters more than adding invisible internal metal folds.

### The drinking opening

Crown describes a historical large-opening example with:

- **384.5 mm² opening area**
- **1.47 aspect ratio**

An equal-area ellipse would be approximately **26.83 × 18.25 mm**. That is useful for judging scale,
but the actual manufactured score contour is more complex.
[Google Patents US7594585B1](https://patents.google.com/patent/US7594585B1/en)

For a **closed can**, model an intact metal tear panel with a fine scored outline and hinge. For an
**opened can**, keep the panel pushed inward and a plausible tab position.

### Bottom dome

A specific Ardagh US 12 oz drawing provides:

| Parameter | Published value |
|---|---:|
| Reformed dome depth | **11.176 ±0.381 mm** |
| Stand/base diameter | **47.3456 mm reference** |
| Neck length | **18.9738 mm reference** |

This is an older, particular **3LDM bottom design**. It establishes a realistic scale for the
recess, but should not become an asserted specification for every European can.
[stouttanks.com](https://www.stouttanks.com/amfile/file/download/file/220/product/5786/)

For marketing use, a correct foot, recessed dome and smooth heel usually contribute more than
recreating the hidden seam internals.

## 8. The complete parameter set for a reusable model

| Component | Parameters to expose |
|---|---|
| **Identity** | Manufacturer, SKU, drawing revision, capacity, body family, end code, end profile |
| **State** | Closed/opened, tab angle, tear-panel position, pressurised/vented reference |
| **Barrel** | Central OD, maximum OD, lower-body maximum OD, straight-wall start/end elevations, taper |
| **Shoulder** | Start/end elevations, radial reduction, spline or arc controls, blend into barrel |
| **Neck** | External OD, height, slope, blend into seam |
| **Seam** | Finished outside and inside diameter, axial height, crown radii, visible cross-section |
| **Lid panel** | Diameter, recess, shallow crown/slope, local formed features |
| **Countersink** | Trough diameter, depth, width, wall profile and blend radii |
| **Tab** | Outer contour, hole contour, length, width, thickness, rolled edges, nose and elevation |
| **Rivet** | XY position, head diameter, head height, flattened crown |
| **Score** | Contour, location, orientation, width, depth and hinge bridge |
| **Heel** | Start elevation, curvature and transition to the foot |
| **Standing ring** | Inner/outer diameters, contact width and contact elevation |
| **Dome** | Join diameter, recess depth and radial profile |
| **Decoration** | Print boundaries, UV rotation, artwork canvas, overlap, label/sleeve thickness |
| **Finish** | Metal, opaque ink, metallic/translucent ink, coating, roughness, embossed details |
| **Optional details** | Datecode, maker marks, necking bands, droplets, fine surface variation |

For axisymmetric parts, a **radius-versus-height profile** is more useful than dozens of
disconnected bevel settings. Keep separate profile paths for the body exterior, visible seam, lid and
underside.

The study's three supplied profiles are original visual approximations constrained by published
dimensions, covering **440 ml standard, 330 ml sleek and 250 ml slim**.

## 9. Artwork and UV mapping

For a straight cylindrical barrel, circumference C = πD:

| Diameter used | Calculated circumference |
|---:|---:|
| 66.3 mm | **208.288 mm** |
| 58.1 mm | **182.527 mm** |
| 53.4 mm | **167.761 mm** |

Where the diameter is a maximum, the calculated circumference inherits that maximum qualifier.

**A print template is a separate specification.** Ardagh's European templates include these
dimensions:

| Format | Artwork width | Artwork height |
|---|---:|---:|
| 150 ml slim | 166 | 83.3 |
| 250 ml slim | 166 | 130 |
| 330 ml sleek | 181 | 139 |
| 330 ml standard | 207 | 107 |
| 440 ml standard | 206 | 141.4 |
| 500 ml standard | 206 | 160 |
| 568 ml standard | 206 | 180 |

These are artwork dimensions, not physical can envelopes.
[Ardagh can templates](https://www.ardaghmetalpackaging.com/regions/europe/graphics-portal/can-templates)

For example, the **440 ml can is 149.9 mm high**, while that artwork template is **141.4 mm high**.
Stretching the whole artwork rectangle from the floor to the rim would place it incorrectly.

Ardagh explains that conventional printing occurs before necking and flanging, with the top edge
partly hidden during seaming. Its no-text areas allow for these effects and printing variation. A
no-text zone can still contain background colour; it does not automatically represent bare
aluminium.
[Ardagh no-text area](https://www.ardaghmetalpackaging.com/regions/europe/graphics-portal/can-guidelines/no-text-area)

For the model:

- Keep the artwork seam separate from the metal geometry.
- Add a physical overlap only where the product actually has a label or sleeve.
- Map the shoulder and heel deliberately.
- Give the lid assembly an independent rotation.
- Use the template for the chosen printing process; conventional and digital-print workflows can
  have different overlap requirements.

## 10. Materials and thickness

A real can has varying metal thickness. Patent background describes conventional cylindrical walls
around **0.094–0.097 mm** for 66 mm cans and **0.090–0.094 mm** for 58 mm cans. The referenced
European drawings separately specify approximately **0.15–0.16 mm flange stock** and **0.21–0.22 mm
end sheet**. These are contextual and supplier-specific values, not one universal shell thickness.

For a closed opaque model, the external surface does most of the work. Thickness matters more around
an exposed opening or a raised tab.

Material starting points:

| Surface | Rendering starting point |
|---|---|
| Exposed aluminium | Metalness 1; roughness roughly 0.15–0.30 |
| Opaque printed ink | Dielectric appearance; usually metalness 0 |
| Gloss coating | Roughness roughly 0.20–0.35, with appropriate clearcoat |
| Matte finish | Roughness roughly 0.45–0.65 |
| Metallic/translucent ink | Separate mask/material treatment that allows the metal effect |
| Paper or polymer label | Separate thin surface where its edge or overlap is visible |
| Fine scores and microtexture | Bump/normal detail unless they affect the silhouette |

These are **artistic starting values**, dependent on renderer and lighting. Match them against the
actual product rather than treating them as measured material properties.

## 11. Building the asset library

| Priority | Assets |
|---|---|
| **UK/EU beer** | 330, 440, 500 and 568 ml standard |
| **US beer and soda** | 12 oz standard, 16 oz standard and 19.2 oz standard |
| **UK/EU mixers and cocktails** | 150 ml slim, 200 ml slim, 250 ml slim, 250 ml sleek and 330 ml sleek |
| **Additional useful forms** | 300 ml sleek, 12 oz sleek, short 250 ml standard, 24 oz Mega and 32 oz Crowler |

Build the body and end as independently selectable components. Preserve supplier variants when their
shape differs.

For a faithful version of a particular brand's can, the most useful physical measurements are:

1. **Finished seam outside diameter.**
2. **Actual closed overall height.**
3. **Shoulder-start elevation and side silhouette.**
4. **Standing-ring diameter and heel shape.**
5. **Dome depth.**
6. **Lid-panel recess.**
7. **A square-on photograph of the tab, score and reinforcement features.**

A front view checks proportions; a three-quarter top view checks the lid; a tilted view checks the
base. A broad light reflected across the shoulder is particularly useful for exposing an incorrect
curve.

The published envelope dimensions plus those few sample measurements are the most effective route to
a "pretty darn close" model.
