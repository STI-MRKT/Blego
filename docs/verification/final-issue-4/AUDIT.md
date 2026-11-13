# Baseline audit — 2026-11-13

Base `62d8bab`, original visual reference `6e57eab`. Isolated branch, clean starting tree; no other branch/PR changed. Linux x86_64, Node 24.22.1, Electron 45.3.1.

`npm ci`; `npm run verify`: lint PASS, unit 56/56, integration 75/75. First `npm run test:ui` failed to launch because no X server was available. `BLEGO_HEADLESS=1 npm run test:ui`: 8/8 PASS, no skipped tests. This is Electron GUI coverage on Linux, not Mac acceptance.

Original and baseline launched from their checkouts. Screenshots in `visual/` at 1280×900 and 980×720. Original News is embedded in Generator; current News has its own navigation entry. Inspection confirms the original speed gauge, packets, card/side panel geometry remain recognizable; current proxy password/reveal field, excess consent/layout text, FB table, photo table and archive diagnostics need local changes. Static screenshots do not establish animation smoothness or Mac performance.

| Control | Handler / actual operation | Baseline / required change | Verification |
|---|---|---|---|
| Generate; field copy | generate → local pool/SQLite registry; copy-model → native clipboard | Working; preserve 8 countries and phone formatting | generator integration; ux-restoration/copy GUI |
| Import; cookie icon | classification worker; classifier cell → clipboard | Working 11 columns/exact cookie/7-field export; preserve | classifier unit/integration/3 GUI |
| Proxy Check | proxy-check → checkProxy IPC → HTTPS echo through agent | Transports exist; missing public endpoint guard, real reputation, quality and clear errors | controlled transport integration; add v3/quality tests |
| Ping; full network test | net-ping/net-run → server TCP probes/bounded speed | Gauge exists; preserve explicit-only speed and honest missing measurements | network tests + GUI |
| News refresh/topic | refreshNews → feeds/service → SQLite cache | Disabled by default; catalogue empty; add selected-theme catalogue/cache | feed integration; add real-source and GUI evidence |
| Facebook validate/check/cancel | normalizeFacebook/checkFacebook/cancelFacebook → bounded public queue | Backend works; combine primary action, move notes/details secondary | Facebook integration + new GUI |
| Add photos/preview/save copies | imagesChoose/imagesPlan/imagesApply → native engine/readback | Backend exists; dates/GPS buried; fix quick controls and validate zero | metadata native/integration + GUI |
| Archive open/export/delete | archive IPC → existing ZIP service/dialogs | Backend exists; reduce primary diagnostics, move nav last | archive integration + GUI |

No protected palette/assets/animations are to be changed. Minimal approved-by-task changes: controls within existing cards, disclosure for advanced information, topic select, per-element copy icons, and Archive navigation position. No database/registry/clipboard/ZIP replacement.
