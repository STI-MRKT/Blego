# UX6 — Generator and Archive

Linux x64, 2026-11-12. `npm run verify`: lint PASS, unit 47/47, integration 84/84. `BLEGO_HEADLESS=1 npm run test:ui`: 8/8, zero skips.

Original archive row styling restored; search, date/status/order filters, open, individual filename/count/status/date/result copy, TXT/ZIP export, folder request and confirmed deletion retained. Real exported ZIP bytes equal the stored ZIP; canceled confirmation keeps the archive. Dialog and folder OS interactions use controlled fixtures; actual Finder dialog usability is separate acceptance.

Generator restores all six primary fields including postal code. Handle/bio copy beside their text; no duplicate extra fields. Every saved profile field independently copies through the existing native clipboard API. Long unique handles wrap in the existing card; local inline wrapping is the only sizing addition. Female-only generation, registry exhaustion, persisted settings/history and no expiry are exercised by existing regression suites. Exhaustion now retains the card and suggests choosing another country or importing data via Settings.

RED: original archive row absent / only five primary fields. GREEN: target GUI. First full GUI found duplicate handle/bio controls (removed) and a test using a now-folded filter (test follows disclosure). Final full GUI 8/8. No CSS tokens, original assets/icons, storage or ZIP format changed. Screenshots are synthetic test data at 1280×900.
