# Cantare product brief

Cantare makes **hyper-realistic product images of beverage cans** for the beer and soft-drink
industry. A brewery or drinks brand picks the can it uses, puts its own artwork on it, stages it with
light, water and a background, and saves a picture that looks like a studio photograph.

The render is the product. Every decision below gives way to output quality: if a result could be
mistaken for a CGI mock-up, it is not finished.

## Platforms

- **Web**, plus **iOS and Android** on **phones and tablets**, from one codebase.
- Rendering, editing and export run **on the user's device** (WebGL in the browser or in the native
  app's web view). Cantare's servers do not render.
- The only server work is **background image generation**, proxied through **Ledger** (the
  UnlikeOtherAI AI proxy) to an OpenAI image model (**GPT Image 2 / 2.1**). The Ledger `lk_` token
  never reaches the client.

## Design

The main front-end design (layout, visual language, interaction model, phone/tablet/desktop
variants) is done by **Fable**. Implementation follows that design.

## Can selection

- The user chooses the exact can format they use: capacity **and** body family, because one capacity
  comes in several silhouettes (for example 250 ml standard, sleek and slim).
- Formats come from the measured data in [can-reference.md](can-reference.md): UK/EU standard (330,
  440, 500, 568 ml and others), slim, sleek/fit, US standard and sleek, 24 oz Mega and 32 oz Crowler.
- Geometry is built from real dimensions: heel, standing ring, bottom dome, barrel, shoulder, neck,
  seam, lid with countersink, score, rivet and pull tab. Other sizes in a family change the barrel
  length, not a vertical stretch of the whole mesh.

## Can colour and finish

- **Body and lid are coloured independently** and any combination is allowed (silver body with black
  lid, gold lid on a white can, and so on).
- **Presets** for both body and lid: **classic silver**, **classic gold**, **black**, **white** (the
  most used colours).
- **Custom colour code** (hex) for the body and for the lid, because suppliers offer specialty
  colours.
- Finish per part: gloss, satin, matte, and bare brushed aluminium.

## Artwork: printed cans and labels

Two decoration types, chosen by the user:

1. **Printed can.** The artwork is printed on the metal and covers the body **from the bottom to the
   lid**: heel, barrel, shoulder and neck. Metallic effects show through where the artwork lets them.
2. **Label.** A paper or film label wrapped around part of the body. Its visible edge, overlap and
   slight thickness are part of the realism.

Label and print sizes:

- Known print templates per format are in the reference (for example 206 × 141.4 mm on 440 ml
  standard).
- When the uploaded image does not match a known template, **infer the size from the image**: its
  width wraps the circumference (or a chosen part of it) and its aspect ratio sets the height. The
  user can adjust height, vertical position and rotation.
- The **base colour** of the can shows wherever the artwork does not cover it (top and bottom
  margins, no-text zones, transparent areas of a PNG) and can be any custom colour.

## Staging and effects

- **Rotation**: free orbit around the can plus quick angles (front, three-quarter, top-down lid,
  low hero angle). The can can also spin on its axis independently of the camera.
- **Lighting**: where the key light comes from (direction), its strength, softness and colour; rim
  light; studio environment presets for reflections.
- **Water**: droplets on the can with size and density; paint/spread droplets by hand; a **spray**
  tool that "waters" the can in place; condensation haze for an ice-cold look; runs and drips.
- **Photographic effects**: depth of field, bloom on highlights, vignette, film grain, colour grading
  and contact shadows/reflections on the surface the can stands on.

## Backgrounds

- **Upload** a background photo.
- **Generate** a background from a text prompt via Ledger and GPT Image 2 / 2.1.
- Solid colour or gradient.
- The can sits believably in the scene: matching light direction, shadow and reflection.

## Output

- Export **high-resolution** stills (larger than the screen preview), PNG or JPEG.
- **Web**: download the file directly.
- **iOS/Android**: save to the photo library or share through the system share sheet.
- Keep a gallery of saved pictures on the device.

## Open questions

- **Sign-in for generation.** Generation spends money through Ledger, so it needs a caller identity
  and limits. If Cantare uses UnlikeOtherAuthenticator (UOA) SSO, UOA stays the only identity store.
- **Shareable download links.** A link that works on another device needs server-side storage; v1
  saves and shares from the device.
- **Hosting** for the web app and the generation endpoint.
- **Image model id**: which of GPT Image 2 / 2.1 the Ledger model endpoint runs on is set in Ledger,
  not in Cantare.
