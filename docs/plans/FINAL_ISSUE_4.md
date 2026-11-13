# Final hardening — issue #4

Base: `62d8bab5f8077a238ed5f5d2e97a6c956de77289`, branch `codex/blego-final-hardening`.
Preserve classifier, storage and existing native metadata engine. PR #1/#3 and other worktrees remain untouched. Original `6e57eab` is a visual reference, not a functional rollback.

## Sequential implementation

- [x] 0. Baseline verify/GUI; original and current screenshots at 1280×900 and narrow; control/operation audit.
- [x] 1. Proxy: reuse transports, real local measurements, documented quality formula, opt-in proxycheck v3 reputation, bounded/error-safe requests, tests.
- [x] 2. News: verified foreign catalogue, five topics, dedup/cache/consent, real-source evidence and GUI tests.
- [x] 3. Facebook: compact public-availability workflow, cancellation/rate/error tests.
- [x] 4. Photos: explicit date/GEO keep/set/remove, zero coordinates, previews/readback/batch/cancel/preservation tests.
- [ ] 5. Archive/generator/navigation: original components, per-element copying, preserved classifier/storage, compact secondary details.
- [ ] 6. Full regression and fresh review; native ARM64 engine, DMG and installed-app tests; PR without merge.

Each implementation stage gets focused tests, `npm run verify`, relevant GUI regression and a separate commit. Failed checks are fixed, not disabled. External services are tested separately from fixtures. Signing/notarization are excluded; no release publication. Evidence and limitations live in `docs/verification/final-issue-4/`.
