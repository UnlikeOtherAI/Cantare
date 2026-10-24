# Cantare

Hyper-realistic beverage-can product images for the beer and soft-drink industry. Pick the can,
upload the artwork, light it, add water, drop in a background and export.

- [Product brief](docs/brief.md)
- [Beverage can 3D reference (UK, EU, US)](docs/can-reference.md)

## How it fits together

| Part | Where it runs | What it does |
|---|---|---|
| `src/engine` | User's device (WebGL) | Procedural can geometry from measured formats, materials, artwork wrap, droplets and condensation, studio lighting, post-processing, high-resolution export |
| `src/ui` | User's device | The editor |
| `src/platform` | User's device | Download / photo library / share sheet, local gallery (IndexedDB), generation client |
| `server` | Cantare server | `POST /api/backgrounds` → Ledger → GPT Image; serves the built web app |
| `ios`, `android` | Capacitor | Native shells for phones and tablets around the same web build |

Rendering and export never touch the server. The only server call is background generation, and
the Ledger `lk_` token stays on the server.

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:5180
pnpm server       # http://localhost:8797, proxied from /api in dev
pnpm test
pnpm typecheck
```

Copy `.env.example` to `.env` (or export the variables) to enable generation: `LEDGER_URL`,
`LEDGER_TOKEN` (an `lk_` proxy token) and `LEDGER_PURPOSE_ID` (a Ledger model endpoint that runs
GPT Image 2 / 2.1 on `images/generations`). Without them the endpoint answers 503 and the rest of
the app works.

## Native apps

```bash
VITE_API_BASE=https://<cantare-host> pnpm cap:sync
npx cap open ios       # on macOS, Xcode
npx cap open android   # Android Studio
```

Native builds call the hosted server, so `VITE_API_BASE` must point at it and the server's
`ALLOWED_ORIGINS` must include `capacitor://localhost` (iOS) and `https://localhost` (Android).

## Deploy

`Dockerfile` builds the web app and runs the server, which serves `dist/` and `/api`.
